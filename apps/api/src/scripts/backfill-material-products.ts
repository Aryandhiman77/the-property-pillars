import {prisma} from "../database/prisma.js";
import {ensureCatalog} from "../profiles/masters.js";
import {syncMaterialProduct} from "../materials/product.js";

try {
  let migrated = 0;
  for (const {id:tenantId} of await prisma.tenant.findMany({select:{id:true}})) {
    await ensureCatalog(tenantId);
    for (;;) {
      const rows = await prisma.workspaceItem.findMany({where:{tenantId,collection:"MATERIAL_PRODUCTS",materialProduct:null},select:{id:true},orderBy:{id:"asc"},take:50});
      if (!rows.length) break;
      for (const {id} of rows) {
        const added=await prisma.$transaction(async tx=>{
          await tx.$queryRaw`SELECT id FROM "WorkspaceItem" WHERE id=${id} FOR UPDATE`;
          if(await tx.materialProduct.count({where:{id}})) return false;
          await syncMaterialProduct(tx,await tx.workspaceItem.findUniqueOrThrow({where:{id}}),true);
          return true;
        });
        if(added)migrated++;
      }
    }
  }
  console.log(JSON.stringify({migrated,products:await prisma.materialProduct.count(),media:await prisma.materialProductMedia.count(),areas:await prisma.materialProductDeliveryArea.count()}));
} finally {await prisma.$disconnect();}
