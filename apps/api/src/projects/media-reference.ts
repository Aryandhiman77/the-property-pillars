import type { Prisma } from "@prisma/client";
export function projectFileReference(
  url: string,
): Prisma.BuilderProjectWhereInput {
  return {
    OR: [
      { media: { some: { url } } },
      { videos: { some: { OR: [{ url }, { thumbnail: url }] } } },
      {
        updates: {
          some: { OR: [{ mediaUrls: { has: url } }, { videoUrl: url }] },
        },
      },
    ],
  };
}
