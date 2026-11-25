import { Router, type Router as ExpressRouter } from "express";
import { resolve } from "node:path";
import { unlink } from "node:fs/promises";
import { z } from "zod";
import {
  directory,
  parseMultipart,
  saveFile,
} from "../uploads/project-files.js";
import { prisma } from "../database/prisma.js";
import { env } from "../config/env.js";
import { requireSession } from "../middleware/session.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../helpers/api-response.js";
import { parseInput } from "../helpers/parse-input.js";
import {
  access,
  hierarchy,
  invalid,
  master,
  missing,
  mutate,
} from "./service.js";
import { name } from "./validation.js";
import type { AuthSessionContext } from "../types/auth.js";

const base = "/projects/:id/assets";
const kinds = [
  "Master Plan",
  "Site Plan",
  "Unit Floor Plan",
  "Typical Floor Layout",
  "Tower Plan",
  "Plot Layout",
  "Office Layout",
  "Retail Layout",
  "Other",
] as const;
const plan = z
  .object({
    title: name,
    planType: z.enum(kinds),
    phaseId: name.nullish(),
    towerId: name.nullish(),
    configurationId: name.nullish(),
    description: z.string().max(2000).nullish(),
    areaValue: z.number().positive().nullish(),
    areaUnitId: name.nullish(),
    sortOrder: z.number().int().min(0).default(0),
    isPrimary: z.boolean().default(false),
  })
  .strict();
const doc = z
  .object({
    title: name,
    category: z.enum([
      "Brochure",
      "Price list",
      "Project fact sheet",
      "Marketing document",
      "RERA certificate",
      "Legal proof",
      "Business proof",
      "Other",
    ]),
    visibility: z.enum(["PRIVATE", "PUBLIC"]),
    version: name.nullish(),
    documentDate: z.string().date().nullish(),
    current: z.boolean().default(false),
  })
  .strict();
async function view(id: string, s?: AuthSessionContext) {
  const p = await prisma.builderProject.findFirst({
    where: { id, tenantId: s?.tenantId ?? env.PUBLIC_TENANT_ID },
    include: {
      workspace: {
        select: {
          ownerId: true,
          publicAt: true,
          tenant: { select: { isDemo: true } },
        },
      },
    },
  });
  if (!p) throw missing();
  const privileged = Boolean(
    s &&
    (s.role === "ADMIN" ||
      (s.role === "BUILDER" && p.workspace.ownerId === s.userId)),
  );
  if (
    !privileged &&
    (p.publication !== "PUBLISHED" ||
      !p.workspace.publicAt ||
      p.workspace.tenant.isDemo)
  )
    throw missing();
  return privileged;
}
export const projectFiles: ExpressRouter = Router();
projectFiles.get(
  base,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id),
      privileged = await view(id, req.session),
      url = (row: string, k: string) =>
        "/api/v1/projects/" + id + "/assets/" + row + "/" + k;
    const [plans, documents] = await Promise.all([
      prisma.projectPlan.findMany({
        where: { projectId: id },
        include: {
          areaUnit: { select: { code: true } },
          configuration: { select: { name: true } },
        },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      }),
      prisma.projectDocument.findMany({
        where: {
          projectId: id,
          ...(privileged
            ? {}
            : {
                visibility: "PUBLIC",
                OR: [{ category: { not: "Price list" } }, { current: true }],
              }),
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    res.set("Cache-Control", "private, no-store");
    sendSuccess(res, {
      plans: plans.map(({ imageKey, pdfKey, ...v }) => ({
        ...v,
        image: imageKey ? url(v.id, "image") : null,
        pdf: pdfKey ? url(v.id, "pdf") : null,
      })),
      documents: documents.map(({ key: _, ...v }) => ({
        ...v,
        url: url(v.id, "document"),
      })),
    });
  }),
);
projectFiles.get(
  base + "/:asset/:kind",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id),
      privileged = await view(id, req.session),
      where = { id: String(req.params.asset), projectId: id };
    let key: string | null = null;
    if (req.params.kind === "document") {
      const d = await prisma.projectDocument.findFirst({ where });
      if (
        d &&
        (privileged ||
          (d.visibility === "PUBLIC" &&
            (d.category !== "Price list" || d.current)))
      ) {
        key = d.key;
        if (!privileged && d.category === "Brochure" && req.method === "GET")
          await prisma.workspaceEvent.create({
            data: {
              tenantId: req.session?.tenantId ?? env.PUBLIC_TENANT_ID,
              itemId: id,
              actorId: req.session?.userId,
              action: "PROJECT_BROCHURE_REQUESTED",
              metadata: { documentId: d.id },
            },
          });
      }
    } else if (req.params.kind === "image" || req.params.kind === "pdf") {
      const p = await prisma.projectPlan.findFirst({ where });
      key = (req.params.kind === "image" ? p?.imageKey : p?.pdfKey) ?? null;
    }
    if (!key) throw missing();
    res.set({
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    });
    if (key.endsWith(".pdf")) res.attachment("project-document.pdf");
    res.sendFile(resolve(directory, key));
  }),
);
projectFiles.post(
  base + "/:kind",
  requireSession,
  asyncHandler(async (req, _res, next) => {
    await access(prisma, req.session!, String(req.params.id));
    next();
  }),
  parseMultipart,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id),
      s = req.session!;
    if (!Buffer.isBuffer(req.body)) throw invalid("file", "Choose a file.");
    const form = await new Response(new Uint8Array(req.body), {
      headers: { "Content-Type": req.get("Content-Type")! },
    })
      .formData()
      .catch(() => {
        throw invalid("file", "Invalid multipart form.");
      });
    const rev = parseInput(
      z.coerce.number().int().nonnegative(),
      form.get("revision") ?? undefined,
    );
    let values: unknown;
    try {
      values = JSON.parse(String(form.get("metadata")));
    } catch {
      throw invalid("metadata", "Enter the file details.");
    }
    const created: string[] = [],
      old: string[] = [];
    const asset = form.get("id")?.toString();
    try {
      const result = await mutate(
        s,
        id,
        rev,
        "PROJECT_FILE_SAVED",
        true,
        async (tx, p) => {
          if (s.role === "BUILDER")
            await tx.builderProject.update({
              where: { id },
              data: { step: req.params.kind === "plans" ? 13 : 14 },
            });
          if (req.params.kind === "plans") {
            const v = parseInput(plan, values);
            await hierarchy(tx, id, v.phaseId, v.towerId, v.configurationId);
            if (Boolean(v.areaValue) !== Boolean(v.areaUnitId))
              throw invalid(
                "areaValue",
                "Enter the plan area and unit together.",
              );
            if (v.areaUnitId)
              await master(tx, p.tenantId, v.areaUnitId, "AREA_UNIT");
            const previous = asset
              ? await tx.projectPlan.findFirst({
                  where: { id: asset, projectId: id },
                })
              : null;
            if (asset && !previous) throw missing();
            const img = await saveFile(form.get("image"), "image", created),
              pdf = await saveFile(form.get("pdf"), "pdf", created);
            if (!img && !pdf && !previous)
              throw invalid("image", "Attach an image or PDF.");
            if (img && previous?.imageKey) old.push(previous.imageKey);
            if (pdf && previous?.pdfKey) old.push(previous.pdfKey);
            const scope = {
              projectId: id,
              phaseId: v.phaseId ?? null,
              towerId: v.towerId ?? null,
              configurationId: v.configurationId ?? null,
              planType: v.planType,
            };
            const primary =
              v.isPrimary ||
              !(await tx.projectPlan.count({
                where: { ...scope, id: { not: asset }, isPrimary: true },
              }));
            if (primary)
              await tx.projectPlan.updateMany({
                where: { ...scope, isPrimary: true },
                data: { isPrimary: false },
              });
            const data = {
              ...v,
              ...scope,
              isPrimary: primary,
              imageKey: img ?? previous?.imageKey,
              pdfKey: pdf ?? previous?.pdfKey,
            };
            const row = asset
              ? await tx.projectPlan.update({
                  where: { id: asset, projectId: id },
                  data,
                })
              : await tx.projectPlan.create({ data });
            return { id: row.id };
          }
          if (req.params.kind !== "documents") throw missing();
          const v = parseInput(doc, values);
          if (
            v.visibility === "PUBLIC" &&
            ![
              "Brochure",
              "Price list",
              "Project fact sheet",
              "Marketing document",
            ].includes(v.category)
          )
            throw invalid(
              "visibility",
              "Verification files must remain private.",
            );
          if (v.category === "Price list" && !v.documentDate)
            throw invalid("documentDate", "Date the price list.");
          const prior = asset
            ? await tx.projectDocument.findFirst({
                where: { id: asset, projectId: id },
              })
            : null;
          if (asset && !prior) throw missing();
          const replacement = await saveFile(form.get("file"), "pdf", created);
          if(prior?.visibility==="PRIVATE"&&v.visibility==="PUBLIC"&&!replacement)throw invalid("file","Upload the document you intend to make public.");
          if(prior?.category==="RERA certificate"&&(replacement||v.category!==prior.category))await tx.builderProject.update({where:{id},data:{regulatoryVerified:false}});
          const key = replacement ?? prior?.key;
          if (!key) throw invalid("file", "Choose a PDF document.");
          if (v.current && v.category === "Price list")
            await tx.projectDocument.updateMany({
              where: { projectId: id, category: v.category, current: true },
              data: { current: false },
            });
          if (prior && replacement) old.push(prior.key);
          const data = { projectId: id, ...v, key, mime: "application/pdf" };
          const row = asset
            ? await tx.projectDocument.update({
                where: { id: asset, projectId: id },
                data,
              })
            : await tx.projectDocument.create({ data });
          return { id: row.id };
        },
      );
      await Promise.allSettled(old.map((k) => unlink(resolve(directory, k))));
      sendSuccess(res, result);
    } catch (e) {
      await Promise.allSettled(
        created.map((k) => unlink(resolve(directory, k))),
      );
      throw e;
    }
  }),
);
projectFiles.delete(
  base + "/:kind/:asset",
  requireSession,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id),
      asset = String(req.params.asset),
      rev = parseInput(
        z.coerce.number().int().nonnegative(),
        req.query.revision,
      );
    const removed: string[] = [];
    const result = await mutate(
      req.session!,
      id,
      rev,
      "PROJECT_FILE_REMOVED",
      true,
      async (tx) => {
        if (req.params.kind === "plans") {
          const p = await tx.projectPlan.delete({
            where: { id: asset, projectId: id },
          });
          if (p.imageKey) removed.push(p.imageKey);
          if (p.pdfKey) removed.push(p.pdfKey);
          if (p.isPrimary) {
            const next = await tx.projectPlan.findFirst({
              where: {
                projectId: id,
                configurationId: p.configurationId,
                towerId: p.towerId,
                phaseId: p.phaseId,
                planType: p.planType,
              },
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            });
            if (next)
              await tx.projectPlan.update({
                where: { id: next.id },
                data: { isPrimary: true },
              });
          }
        } else if (req.params.kind === "documents") {
          const d = await tx.projectDocument.delete({
            where: { id: asset, projectId: id },
          });
          if(d.category==="RERA certificate")await tx.builderProject.update({where:{id},data:{regulatoryVerified:false}});
          removed.push(d.key);
        } else throw missing();
        return { id: asset };
      },
    );
    await Promise.allSettled(removed.map((k) => unlink(resolve(directory, k))));
    sendSuccess(res, result);
  }),
);
