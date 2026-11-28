import {readFile,writeFile} from "node:fs/promises";
import {prisma} from "../src/database/prisma.ts";
import {syncProperty} from "../src/properties/domain.ts";
import {propertyPricePerSqft} from "../src/workspace/search-filters.ts";

const folder=new URL("../../../seed-data/source-runs/",import.meta.url);
const batch=JSON.parse(await readFile(new URL("market-registrations.json",folder),"utf8"));
const database=new URL(process.env.DATABASE_URL);
if (!["localhost","127.0.0.1"].includes(database.hostname)) throw Error("Choose the local marketplace database.");
const tenantId=process.env.PUBLIC_TENANT_ID;
if (!tenantId) throw Error("Missing public tenant.");
const types={"Residential Land":"RESIDENTIAL_PLOT","Residential Apartment":"APARTMENT","Independent House/Villa":"INDEPENDENT_HOUSE","Builder Floor":"BUILDER_FLOOR","Showroom":"SHOWROOM","Warehouse":"WAREHOUSE"};
const report={createdProfiles:[],featuredProfiles:[],enrichedProfiles:[],newListings:[],refreshedListings:[],skipped:[]};
const canonicalPhone=value=>{const digits=String(value||"").replace(/\D/g,"");return digits.length>=8 && digits.length<=15?"+"+digits:null;};
try {
  for (const p of batch.registrations) {
    const ownerId="seed-account-"+p.id;
    const role=p.role.toUpperCase(),number=canonicalPhone(p.businessMobile || p.phone);
    if (!number || !["BUILDER","DEALER"].includes(role)) continue;
    const result=await prisma.$transaction(async tx=>{
      const out={createdProfiles:[],featuredProfiles:[],enrichedProfiles:[],newListings:[],refreshedListings:[],skipped:[]};
      let user=await tx.user.findFirst({where:{id:ownerId,tenantId,role,status:"ACTIVE"}});
      if (!user && !p.listings.length) return out;
      const phoneOwner=await tx.user.findUnique({where:{phone:number},select:{id:true}});
      if (!user && phoneOwner && phoneOwner.id!==ownerId) {out.skipped.push([p.displayName,"phone already assigned"]);return out;}
      const office={address:p.address,coordinates:p.coordinates,mapUrl:p.mapUrl,website:p.website,email:p.contactEmail,registered:false};
      const ids=p.listings.map(l=>l.id);
      const prior=await tx.workspaceItem.findMany({where:{id:{in:ids}},select:{id:true,ownerId:true,tenantId:true,collection:true,status:true}});
      const allowed=p.listings.filter(l=>!prior.some(i=>i.id===l.id && (i.ownerId!==ownerId || i.tenantId!==tenantId || i.collection!=="PROPERTIES" || i.status!=="PUBLISHED")));
      if (!user && !allowed.length) return out;
      if (!user) {
        user=await tx.user.create({data:{id:ownerId,tenantId,fullName:p.displayName,role,status:"ACTIVE",phone:number,profileLocation:p.market,profileLogoUrl:p.logoUrl}});
        out.createdProfiles.push(ownerId);
      } else if (!user.profileLogoUrl && p.logoUrl || !user.phone && !phoneOwner) {
        await tx.user.update({where:{id:ownerId},data:{profileLogoUrl:user.profileLogoUrl || p.logoUrl || undefined,phone:user.phone || (!phoneOwner?number:undefined)}});
      }
      const relation=role==="DEALER"?"dealerProfile":"builderProfile";
      const domain=await tx.domainProfile.upsert({where:{userId_role:{userId:ownerId,role}},update:{},create:{userId:ownerId,role,[relation]:{create:{}}}});
      const model=tx[relation];
      const previous=await model.findUnique({where:{profileId:domain.id}});
      const fields=role==="DEALER"?{agencyName:p.displayName}:{brandName:p.displayName,contactPhone:number,contactEmail:p.contactEmail};
      Object.assign(fields,{website:p.website,address:p.address,whatsapp:p.whatsapp});
      if (!previous?.address || previous.address===p.address) Object.assign(fields,{latitude:p.coordinates?.[0],longitude:p.coordinates?.[1]});
      const fill=Object.fromEntries(Object.entries(fields).filter(([k,v])=>v!=null && !previous?.[k]));
      await model.upsert({where:{profileId:domain.id},update:fill,create:{profileId:domain.id,...fill}});
      const contact={profileId:p.id,relationship:p.role,phone:number,whatsappPhone:p.whatsapp || null,email:p.contactEmail,evidence:[...new Set([p.mapUrl,p.mobileSource,p.whatsappSource,p.emailSource].filter(Boolean))]};
      for (const l of allowed) {
        const existing=await tx.workspaceItem.findUnique({where:{id:l.id}});
        const old=existing?.data ?? {};
        const source={...old.sourceListing,sourceUrl:l.sourceUrl,sourceDataset:l.sourceDataset,relatedBusinessContacts:[...(old.sourceListing?.relatedBusinessContacts||[]).filter(c=>c.profileId!==p.id),contact],publisherOffice:old.sourceListing?.publisherOffice?.registered?old.sourceListing.publisherOffice:office,panelPublisherId:p.id,panelAssignmentBasis:"named listing publisher"};
        const data={...old,...l.data,propertyType:types[l.data.propertyType]||l.data.propertyType,mediaUrls:[...new Set([...(old.mediaUrls||[]),...l.data.mediaUrls])],sourceUrl:l.sourceUrl,sourceListing:source};
        const listing=await tx.workspaceItem.upsert({where:{id:l.id},update:{data,searchPrice:data.price,pricePerSqft:propertyPricePerSqft(data)},create:{id:l.id,tenantId,collection:"PROPERTIES",ownerId,title:l.title,description:l.description,status:"PUBLISHED",publicAt:new Date(),data,searchPrice:data.price,pricePerSqft:propertyPricePerSqft(data)}});
        await syncProperty(tx,listing,true);
        out[existing?"refreshedListings":"newListings"].push(l.id);
      }
      let eligible=allowed.length>0;
      const published=await tx.workspaceItem.findMany({where:{tenantId,ownerId,collection:"PROPERTIES",status:"PUBLISHED",publicAt:{not:null}}});
      for (const item of published) {
        eligible ||= p.existingListingIds.includes(item.id);
        if (allowed.some(l=>l.id===item.id)) continue;
        const data=item.data,src=data?.sourceListing;
        if (!src) continue;
        const contacts=[...(src.relatedBusinessContacts||[]).filter(c=>c.profileId!==p.id),contact];
        await tx.workspaceItem.update({where:{id:item.id},data:{data:{...data,sourceListing:{...src,relatedBusinessContacts:contacts,publisherOffice:src.publisherOffice?.registered?src.publisherOffice:office}}}});
      }
      if (eligible && published.length) {
        if (!user.featuredAt) await tx.user.update({where:{id:ownerId},data:{featuredAt:new Date()}});
        out.featuredProfiles.push(ownerId);
      }
      out.enrichedProfiles.push(ownerId);
      return out;
    },{timeout:35000});
    for (const key of Object.keys(report)) report[key].push(...result[key]);
  }
  const previous=await readFile(new URL("market-import-report.json",folder),"utf8").then(JSON.parse,()=>null);
  for (const key of ["createdProfiles","newListings"]) report[key]=[...new Set([...(previous?.[key]||[]),...report[key]])];
  const exported=[];
  for(const profile of batch.registrations.filter(p=>report.featuredProfiles.includes("seed-account-"+p.id))){
    const ownerId="seed-account-"+profile.id;
    const rows=await prisma.workspaceItem.findMany({where:{ownerId,tenantId,collection:"PROPERTIES",status:"PUBLISHED",publicAt:{not:null}},orderBy:{publicAt:"desc"}});
    const {existingListingIds,listings,...identity}=profile;
    exported.push({profile:{...identity,accountId:ownerId,featured:true},listings:rows.map(item=>{
      const {sourceListing,...fields}=item.data;
      return {id:item.id,title:item.title,description:item.description,...fields,sourceUrl:fields.sourceUrl||sourceListing?.sourceUrl,publicationStatus:item.status};
    })});
  }
  await writeFile(new URL("../featured-registrations.json",folder),JSON.stringify({sourceDatasets:batch.sourceDatasets,registrations:exported},null,2)+"\n");
  await writeFile(new URL("market-import-report.json",folder),JSON.stringify(report,null,2)+"\n");
  console.log(Object.fromEntries(Object.entries(report).map(([k,v])=>[k,v.length])));
} finally {await prisma.$disconnect();}

