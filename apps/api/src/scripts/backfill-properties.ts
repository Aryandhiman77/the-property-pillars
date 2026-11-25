import { prisma } from "../database/prisma.js";
import { ensureCatalog } from "../profiles/masters.js";
import { syncProperty } from "../properties/domain.js";
try {
  let migrated = 0;
  for (const tenant of await prisma.tenant.findMany({ select: { id: true } })) {
    if (
      !(await prisma.workspaceItem.count({
        where: { tenantId: tenant.id, collection: "PROPERTIES" },
      }))
    )
      continue;
    await ensureCatalog(tenant.id);
    for (;;) {
      const rows = await prisma.workspaceItem.findMany({
        where: {
          tenantId: tenant.id,
          collection: "PROPERTIES",
          OR: [{ property: null }, { property: { projectionVersion: 0 } }],
        },
        orderBy: { id: "asc" },
        take: 100,
        select: { id: true },
      });
      if (!rows.length) break;
      for (const { id } of rows)
        await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "WorkspaceItem" WHERE id=${id} FOR UPDATE`;
          const existing = await tx.property.findUnique({
            where: { id },
            select: { projectionVersion: true },
          });
          if (existing?.projectionVersion === 1) return;
          await syncProperty(
            tx,
            await tx.workspaceItem.findUniqueOrThrow({ where: { id } }),
            !existing,
          );
          migrated++;
        });
    }
  }
  console.log(
    JSON.stringify({
      migrated,
      properties: await prisma.property.count(),
      migrationNotes: await prisma.propertyMigrationNote.count(),
      media: await prisma.propertyMedia.count(),
    }),
  );
} finally {
  await prisma.$disconnect();
}
