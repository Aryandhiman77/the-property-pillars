import { prisma } from "../database/prisma.js";
import { ensureCatalog } from "../profiles/masters.js";
import { reconcileProfile } from "../profiles/legacy.js";
try {
  for (const t of await prisma.tenant.findMany({ select: { id: true } })) {
    await ensureCatalog(t.id);
    const profiles = await prisma.domainProfile.findMany({
      where: {
        user: { tenantId: t.id },
        revision: 0,
        role: { in: ["DEALER", "PROFESSIONAL", "BLUE_COLLAR_WORKER"] },
      },
    });
    for (const p of profiles) await reconcileProfile(p, t.id);
  }
  console.log(
    await prisma.profileMigrationNote.groupBy({ by: ["note"], _count: true }),
  );
} finally {
  await prisma.$disconnect();
}
