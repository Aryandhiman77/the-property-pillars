import type { Prisma, WorkspaceItem } from "@prisma/client";
import { isUploadedVideoUrl } from "@the-property-pillar/contracts";

export function projectStates(status: string) {
  const moderation =
    (
      {
        PENDING_REVIEW: "UNDER_REVIEW",
        CHANGES_REQUESTED: "CHANGES_REQUIRED",
        PUBLISHED: "APPROVED",
        PAUSED: "APPROVED",
        EXPIRED: "APPROVED",
        ARCHIVED: "ARCHIVED",
      } as Record<string, string>
    )[status] ?? status;
  return {
    moderation,
    publication:
      status === "PUBLISHED"
        ? "PUBLISHED"
        : status === "ARCHIVED"
          ? "ARCHIVED"
          : "UNPUBLISHED",
  };
}

export function stableProjectSlug(name: string, id: string) {
  return (
    (name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 90) || "project") +
    "-" +
    id
  );
}

/** Import only facts present on the historical card. Publication never confers regulatory verification. */
export async function importProject(
  tx: Prisma.TransactionClient,
  item: WorkspaceItem,
) {
  if (item.collection !== "BUILDER_PROJECTS")
    throw new Error("Expected a Builder project");
  const data = (item.data ?? {}) as Record<string, unknown>;
  const str = (key: string) =>
    typeof data[key] === "string" ? data[key] : undefined;
  const name = str("projectName") || item.title;
  const builder = item.ownerId
    ? await tx.builderProfile.findFirst({
        where: {
          profile: {
            role: "BUILDER",
            userId: item.ownerId,
            user: { tenantId: item.tenantId },
          },
        },
        select: { profileId: true },
      })
    : null;
  const issues: string[] = [];
  if (!builder) issues.push("Builder profile requires reconciliation");
  const cityName = str("city"),
    localityName = str("locality");
  const cities = cityName
    ? await tx.masterItem.findMany({
        where: {
          tenantId: item.tenantId,
          kind: "CITY",
          name: { equals: cityName, mode: "insensitive" },
        },
        take: 2,
        include: { parent: { include: { parent: true } } },
      })
    : [];
  const city = cities.length === 1 ? cities[0] : null;
  const locality =
    city && localityName
      ? await tx.masterItem.findMany({
          where: {
            tenantId: item.tenantId,
            kind: "LOCALITY",
            parentId: city.id,
            name: { equals: localityName, mode: "insensitive" },
          },
          take: 2,
        })
      : [];
  if (cityName && !city) issues.push("Canonical city unresolved");
  if (localityName && locality.length !== 1)
    issues.push("Canonical locality unresolved");
  const urls = [
    ...new Set(
      (Array.isArray(data.mediaUrls) ? data.mediaUrls : []).filter(
        (v): v is string => typeof v === "string",
      ),
    ),
  ];
  const videos = [
    ...new Set([
      ...urls.filter(isUploadedVideoUrl),
      ...(str("videoUrl") ? [str("videoUrl")!] : []),
    ]),
  ];
  const images = urls.filter((v) => !videos.includes(v));
  if (images.length)
    issues.push("Historical photo classification not recorded");
  if (str("reraNumber"))
    issues.push(
      "Historical registration number supplied without verification evidence",
    );
  const fields = new Set([
    "projectName",
    "projectType",
    "city",
    "locality",
    "startingPrice",
    "currency",
    "reraNumber",
    "mediaUrls",
    "videoUrl",
  ]);
  return tx.builderProject.create({
    data: {
      id: item.id,
      tenantId: item.tenantId,
      reference: "PRJ-" + item.id,
      slug: stableProjectSlug(name, item.id),
      name,
      builderProfileId: builder?.profileId,
      createdAt: item.createdAt,
      shortDescription: item.description,
      cityName,
      localityName,
      cityId: city?.id,
      stateId: city?.parent?.kind === "STATE" ? city.parent.id : null,
      countryId:
        city?.parent?.kind === "COUNTRY"
          ? city.parent.id
          : city?.parent?.parent?.kind === "COUNTRY"
            ? city.parent.parent.id
            : null,
      localityId: locality.length === 1 ? locality[0]!.id : null,
      projectType: str("projectType"),
      registrationNumber: str("reraNumber"),
      currency: str("currency"),
      startingPrice:
        typeof data.startingPrice === "number" ? data.startingPrice : undefined,
      ...projectStates(item.status),
      media: {
        create: images.map((url, sortOrder) => ({
          url,
          category: "Other",
          sortOrder,
        })),
      },
      videos: {
        create: videos.map((url, sortOrder) => ({
          url,
          title: "Project video",
          kind: "Other",
          sortOrder,
        })),
      },
      migration: {
        create: {
          issues,
          retainedKeys: Object.keys(data).filter((k) => !fields.has(k)),
        },
      },
    },
  });
}
