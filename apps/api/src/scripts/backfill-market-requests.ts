import {prisma} from "../database/prisma.js";
import {ensureCatalog} from "../profiles/masters.js";
import {syncQuote,syncRequest} from "../materials/requests.js";

try {
  for(const collection of ["MATERIAL_RFQS","MATERIAL_QUOTES"] as const){
    const isRfq=collection==="MATERIAL_RFQS";
    let migrated=0;
    const missing=isRfq?{materialRfq:null}:{materialQuote:null};
    for(const {id:tenantId} of await prisma.tenant.findMany({select:{id:true}})){
      await ensureCatalog(tenantId);
      for(;;){
        const rows=await prisma.workspaceItem.findMany({where:{tenantId,collection,...missing},select:{id:true},orderBy:{id:"asc"},take:50});if(!rows.length)break;
        for(const {id} of rows){
          const inserted=await prisma.$transaction(async tx=>{
            await tx.$queryRaw`SELECT id FROM "WorkspaceItem" WHERE id=${id} FOR UPDATE`;
            const row=await tx.workspaceItem.findFirst({where:{id,...missing}});if(!row)return false;
            if(isRfq)await syncRequest(tx,row,true);else await syncQuote(tx,row,true);return true;
          });
          if(inserted)migrated++;
        }
      }
    }
    console.log(JSON.stringify({collection,migrated}));
  }
} finally {await prisma.$disconnect();}
