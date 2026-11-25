import { Prisma, type BuilderProject } from "@prisma/client";
import type { AuthSessionContext } from "../types/auth.js";
import { prisma } from "../database/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { projectStates } from "./legacy.js";
export type Tx = Prisma.TransactionClient;
export const missing = () =>
  new ApiError(
    404,
    "PROJECT_NOT_FOUND",
    "Project or project record not found.",
  );
export const invalid = (field: string, message: string) =>
  new ApiError(422, "INVALID_PROJECT", message, { [field]: [message] });
export const conflict = () =>
  new ApiError(
    409,
    "PROJECT_CHANGED",
    "This project has changed. Reload before saving.",
  );
export async function access(tx: Tx, session: AuthSessionContext, id: string) {
  if (!["BUILDER", "ADMIN"].includes(session.role))
    throw new ApiError(
      403,
      "PROJECT_ROLE",
      "Builder or Admin access is required.",
    );
  const p = await tx.builderProject.findFirst({
    where: {
      id,
      tenantId: session.tenantId,
      ...(session.role === "BUILDER"
        ? { builderProfile: { profile: { userId: session.userId } } }
        : {}),
    },
    include: {
      workspace: { select: { ownerId: true, status: true } },
      builderProfile: {
        select: {
          brandName: true,
          profile: { select: { verification: true } },
        },
      },
    },
  });
  if (!p) throw missing();
  return p;
}
export async function master(
  tx: Tx,
  tenantId: string,
  id: string,
  kind: string,
  parent?: string | null,
) {
  const row = await tx.masterItem.findFirst({
    where: {
      id,
      tenantId,
      kind,
      active: true,
      ...(parent ? { parentId: parent } : {}),
    },
  });
  if (!row)
    throw invalid(
      kind.toLowerCase() + "Id",
      "Choose an active " +
        kind.toLowerCase().replaceAll("_", " ") +
        " for this project.",
    );
  return row;
}
export function dates(v: {
  constructionStart?: string | null;
  completed?: string | null;
  launch?: string | null;
  possession?: string | null;
  registrationDate?: string | null;
  registrationExpiry?: string | null;
}) {
  for (const [start, end] of [
    ["constructionStart", "completed"],
    ["launch", "possession"],
    ["registrationDate", "registrationExpiry"],
  ] as const)
    if (v[start] && v[end] && v[start]! > v[end]!)
      throw invalid(end, "This date cannot precede the start date.");
}
export async function setup(tx: Tx, id: string) {
  const p = await tx.builderProject.findUniqueOrThrow({
    where: { id },
    include: {
      _count: {
        select: {
          configurations: { where: { active: true } },
          media: { where: { category: "Cover" } },
        },
      },
    },
  });
  const sections: Record<string, boolean> = {
    "Basic project details": Boolean(
      p.name && p.category && p.projectType && p.builderProfileId,
    ),
    Location: Boolean(p.countryId && p.cityId),
    Regulatory:
      p.regulatoryApplicable !== null &&
      (!p.regulatoryApplicable || Boolean(p.authority && p.registrationNumber)),
    "Scale and timeline": Boolean(
      p.constructionStatus && (p.possession || p.completed),
    ),
    Configurations: p._count.configurations > 0,
    Images: p._count.media > 0,
    Pricing: p.priceOnRequest || Boolean(p.startingPrice && p.currency),
    Description: Boolean(p.shortDescription || p.aboutHtml),
    Contact: Boolean(p.contactMethod),
  };
  const missingSections = Object.keys(sections).filter((k) => !sections[k]);
  return {
    percentage: Math.round(
      100 * (1 - missingSections.length / Object.keys(sections).length),
    ),
    missingSections,
    next: missingSections[0] ?? "Preview",
    sections,
  };
}
export async function event(
  tx: Tx,
  p: Pick<BuilderProject, "tenantId" | "id">,
  actorId: string,
  action: string,
  fromStatus?: string,
  toStatus?: string,
  metadata?: Prisma.InputJsonValue,
) {
  await tx.workspaceEvent.create({
    data: {
      tenantId: p.tenantId,
      itemId: p.id,
      actorId,
      action,
      fromStatus,
      toStatus,
      metadata,
    },
  });
}
export type Owned = Awaited<ReturnType<typeof access>>;
export async function mutate<T>(
  s: AuthSessionContext,
  id: string,
  revision: number,
  action: string,
  material: boolean,
  fn: (tx: Tx, p: Owned) => Promise<T>,
) {
  return prisma
    .$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "BuilderProject" WHERE id=${id} AND "tenantId"=${s.tenantId} FOR UPDATE`;
      const p = await access(tx, s, id);
      if (p.revision !== revision) throw conflict();
      if (
        s.role !== "ADMIN" &&
        material &&
        ["SUSPENDED", "UNDER_REVIEW", "SUBMITTED"].includes(p.moderation)
      )
        throw new ApiError(
          409,
          "PROJECT_IN_REVIEW",
          "Wait for the project review before editing.",
        );
      const result = await fn(tx, p);
      const recheck = material && p.moderation === "APPROVED";
      await tx.builderProject.update({
        where: { id },
        data: {
          revision: { increment: 1 },
          ...(recheck ? projectStates("PENDING_REVIEW") : {}),
        },
      });
      if (recheck)
        await tx.workspaceItem.update({
          where: { id },
          data: { status: "PENDING_REVIEW", publicAt: null },
        });
      if (action !== "PROJECT_REVIEWED")
        await event(
          tx,
          p,
          s.userId,
          action,
          p.workspace.status,
          recheck ? "PENDING_REVIEW" : undefined,
        );
      return { result, revision: p.revision + 1 };
    })
    .catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") throw missing();
        if (error.code === "P2003")
          throw invalid("id", "A linked record prevents this change.");
        if (error.code === "P2002") {
          const target = String(error.meta?.target ?? "");
          const key = target.includes("number")
            ? "number"
            : target.includes("code")
              ? "code"
              : target.includes("masterId")
                ? "masterId"
                : "name";
          throw invalid(key, "This value already exists within the project.");
        }
      }
      throw error;
    });
}
export async function hierarchy(
  tx: Tx,
  projectId: string,
  phaseId?: string | null,
  towerId?: string | null,
  configurationId?: string | null,
) {
  if (
    phaseId &&
    !(await tx.projectPhase.findFirst({ where: { id: phaseId, projectId } }))
  )
    throw invalid("phaseId", "Choose a phase from this project.");
  if (towerId) {
    const t = await tx.projectTower.findFirst({
      where: { id: towerId, projectId },
    });
    if (!t || (phaseId && t.phaseId !== phaseId))
      throw invalid(
        "towerId",
        "Choose a tower belonging to this project and phase.",
      );
  }
  if (
    configurationId &&
    !(await tx.projectConfiguration.findFirst({
      where: { id: configurationId, projectId, active: true },
    }))
  )
    throw invalid(
      "configurationId",
      "Choose an active configuration from this project.",
    );
}
