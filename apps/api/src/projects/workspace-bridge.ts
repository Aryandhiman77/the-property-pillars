import { isUploadedVideoUrl } from "@the-property-pillar/contracts";
import type { Prisma, WorkspaceItem } from "@prisma/client";
import { importProject, projectStates } from "./legacy.js";
import { invalid, setup } from "./service.js";
import { refreshLinked } from "./inventory.js";

/** Project cards in the original marketplace read public media from workspace data. */
export async function mirrorProjectMedia(
  tx: Prisma.TransactionClient,
  projectId: string,
  section: string,
) {
  if (section !== "media" && section !== "videos") return;
  const row = await tx.workspaceItem.findUniqueOrThrow({
    where: { id: projectId },
    select: { data: true },
  });
  const data = { ...(row.data as Prisma.InputJsonObject) };
  if (section === "media") {
    const images = await tx.projectMedia.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { url: true, category: true },
    });
    data.mediaUrls = [
      ...images.filter((m) => m.category === "Cover"),
      ...images.filter((m) => m.category !== "Cover"),
    ]
      .slice(0, 30)
      .map((m) => m.url);
  } else {
    const video = await tx.projectVideo.findFirst({
      where: {
        projectId,
        url: { startsWith: "/api/v1/uploads/", endsWith: ".mp4" },
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { url: true },
    });
    if (video) data.videoUrl = video.url;
    else delete data.videoUrl;
  }
  await tx.workspaceItem.update({ where: { id: projectId }, data: { data } });
}

/** Keep existing workspace routes, moderation history, enquiries and ad campaigns on the same project identity. */
export async function projectFromWorkspace(
  tx: Prisma.TransactionClient,
  item: WorkspaceItem,
  actorId: string,
  previous?: WorkspaceItem,
) {
  const old = previous?.data as Record<string, unknown> | undefined;
  const data = item.data as Record<string, unknown>,
    changed = (k: string) =>
      !old || JSON.stringify(data[k]) !== JSON.stringify(old[k]);
  const found = await tx.builderProject.findUnique({
    where: { id: item.id },
    include: { builderProfile: { include: { profile: true } } },
  });
  if (!found) {
    await importProject(tx, item);
    if (!previous)
      await tx.projectMigrationNote.delete({ where: { projectId: item.id } });
  } else {
    const locationChanged = changed("city") || changed("locality");
    const row = await tx.builderProject.update({
      where: { id: item.id },
      data: {
        name: String(data.projectName ?? item.title),
        shortDescription: item.description,
        projectType:
          typeof data.projectType === "string" ? data.projectType : null,
        cityName: typeof data.city === "string" ? data.city : null,
        localityName: typeof data.locality === "string" ? data.locality : null,
        ...(locationChanged ? { cityId: null, localityId: null } : {}),
        registrationNumber:
          typeof data.reraNumber === "string" ? data.reraNumber : null,
        ...(changed("reraNumber") ? { regulatoryVerified: false } : {}),
        startingPrice:
          typeof data.startingPrice === "number" ? data.startingPrice : null,
        currency: typeof data.currency === "string" ? data.currency : null,
        revision: { increment: 1 },
        ...(item.status !== previous?.status
          ? {
              ...projectStates(item.status),
              ...(item.status === "PENDING_REVIEW"
                ? { moderation: "SUBMITTED" }
                : {}),
            }
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
    if (changed("mediaUrls") && Array.isArray(data.mediaUrls)) {
      const urls = data.mediaUrls.filter(
        (v): v is string => typeof v === "string",
      );
      const removed = Array.isArray(old?.mediaUrls)
        ? old.mediaUrls.filter(
            (url): url is string =>
              typeof url === "string" && !urls.includes(url),
          )
        : [];
      if (removed.length)
        await tx.projectMedia.deleteMany({
          where: { projectId: item.id, url: { in: removed } },
        });
      for (const [sortOrder, url] of urls.entries())
        await tx.projectMedia.upsert({
          where: { projectId_url: { projectId: item.id, url } },
          update: { sortOrder },
          create: { projectId: item.id, url, category: "Other", sortOrder },
        });
    }
    if (changed("videoUrl") && previous) {
      if (typeof old?.videoUrl === "string")
        await tx.projectVideo.deleteMany({
          where: { projectId: item.id, url: old.videoUrl },
        });
      if (
        typeof data.videoUrl === "string" &&
        isUploadedVideoUrl(data.videoUrl) &&
        !(await tx.projectVideo.findFirst({
          where: { projectId: item.id, url: data.videoUrl },
          select: { id: true },
        }))
      ) {
        await tx.projectVideo.create({
          data: {
            projectId: item.id,
            url: data.videoUrl,
            title: "Project video",
            kind: "Other",
            sortOrder: 0,
          },
        });
      }
    }
    await refreshLinked(tx, row, actorId);
  }
  if (
    ["PENDING_REVIEW", "APPROVED", "PUBLISHED"].includes(item.status) &&
    item.status !== previous?.status &&
    !(
      item.status === "PENDING_REVIEW" &&
      ["APPROVED", "PUBLISHED"].includes(previous?.status ?? "")
    )
  ) {
    const profile = await tx.builderProject.findUniqueOrThrow({
      where: { id: item.id },
      include: { builderProfile: { include: { profile: true } } },
    });
    if (profile.builderProfile?.profile.verification !== "VERIFIED")
      throw invalid(
        "builder",
        "Complete Builder verification before submitting this project.",
      );
    const check = await setup(tx, item.id);
    if (check.percentage < 100)
      throw invalid(
        "completion",
        "Complete the project wizard sections: " +
          check.missingSections.join(", "),
      );
  }
}
