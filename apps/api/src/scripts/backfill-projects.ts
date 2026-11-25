import { prisma } from "../database/prisma.js";
import { importProject } from "../projects/legacy.js";

try {
  let migrated = 0;
  for (;;) {
    const rows = await prisma.workspaceItem.findMany({
      where: { collection: "BUILDER_PROJECTS", builderProject: null },
      orderBy: { id: "asc" },
      take: 50,
      select: { id: true },
    });
    if (!rows.length) break;
    for (const { id } of rows) {
      const inserted = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "WorkspaceItem" WHERE id=${id} FOR UPDATE`;
        if (
          await tx.builderProject.findUnique({
            where: { id },
            select: { id: true },
          })
        )
          return false;
        await importProject(
          tx,
          await tx.workspaceItem.findUniqueOrThrow({ where: { id } }),
        );
        return true;
      });
      if (inserted) migrated++;
    }
  }
  console.log(
    JSON.stringify({
      migrated,
      projects: await prisma.builderProject.count(),
      notes: await prisma.projectMigrationNote.count(),
      images: await prisma.projectMedia.count(),
      videos: await prisma.projectVideo.count(),
    }),
  );
} finally {
  await prisma.$disconnect();
}
