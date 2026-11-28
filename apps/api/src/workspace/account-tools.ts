import {bump} from "../profiles/profile.js";
import {Router, type Router as ExpressRouter} from "express";
import {isValidPhoneNumber} from "libphonenumber-js/max";
import {propertyPricePerSqft} from "./search-filters.js";
import {Prisma, UserRole} from "@prisma/client";
import {z} from "zod";
import {env} from "../config/env.js";
import {sendSuccess} from "../helpers/api-response.js";
import {parseInput} from "../helpers/parse-input.js";
import {requireRole} from "../middleware/session.middleware.js";
import {syncProperty} from "../properties/domain.js";
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";
import {contactPhone} from "./config.js";
import {workspacePrisma as db} from "./db.js";
import {limitPropertyWrites} from "./property-engagement.js";

export const accountTools: ExpressRouter = Router();
const eligible = ["DEALER","BUILDER","PROFESSIONAL","WHITE_COLLAR_SEEKER","BLUE_COLLAR_WORKER"] as const;
const admin = requireRole("ADMIN");
const phone = contactPhone.refine(v=>v.startsWith("+") && isValidPhoneNumber(v),"Enter a valid number including the country code.");
const message = z.object({requestId:z.string().uuid(), name:z.string().trim().min(2).max(120),
  email:z.string().trim().email().max(254), phone:phone.optional(), whatsapp:phone, message:z.string().trim().min(10).max(4000)}).strict();
const paging = z.object({page:z.coerce.number().int().min(1).max(100000).default(1)});
const missing = () => new ApiError(404,"NOT_FOUND","This record is unavailable.");

accountTools.post("/public/contact-messages",limitPropertyWrites(),asyncHandler(async(req,res) => {
  const input = parseInput(message,req.body);
  const tenantId = req.session?.tenantId ?? env.PUBLIC_TENANT_ID;
  const {id} = await db.contactMessage.upsert({where:{tenantId_requestId:{tenantId,requestId:input.requestId}},
    create:{tenantId,...input},update:{},select:{id:true}});
  sendSuccess(res,{id},201);
}));
accountTools.get("/admin/contact-messages",admin,asyncHandler(async(req,res) => {
  const {page} = parseInput(paging,req.query);
  const where = {tenantId:req.session!.tenantId};
  const [items,total] = await db.$transaction([db.contactMessage.findMany({where,skip:(page-1)*20,take:20,
    orderBy:[{createdAt:"desc"},{id:"desc"}]}),db.contactMessage.count({where})]);
  sendSuccess(res,{items,total});
}));
accountTools.get("/admin/accounts",admin,asyncHandler(async(req,res) => {
  const {page,q,role} = parseInput(paging.extend({q:z.string().trim().max(160).optional(),role:z.nativeEnum(UserRole).optional()}),req.query);
  const where:Prisma.UserWhereInput = {tenantId:req.session!.tenantId,role,...(q?{OR:[{fullName:{contains:q,mode:"insensitive"}},{email:{contains:q,mode:"insensitive"}},{phone:{contains:q}}]}:{})};
  const [items,total] = await db.$transaction([db.user.findMany({where,orderBy:[{fullName:"asc"},{id:"asc"}],skip:(page-1)*20,take:20,
    select:{id:true,fullName:true,role:true,status:true,featuredAt:true,domainProfiles:{select:{role:true,verification:true}},_count:{select:{ownedItems:{where:{collection:"PROPERTIES"}}}}}}),db.user.count({where})]);
  sendSuccess(res,{items:items.map(({domainProfiles,...account})=>({...account,verified:domainProfiles.some(p=>p.role===account.role && p.verification==="VERIFIED")})),total});
}));
accountTools.patch("/admin/accounts/:id/verification",admin,asyncHandler(async(req,res)=>{
  const {verified}=parseInput(z.object({verified:z.boolean()}).strict(),req.body);
  const session=req.session!;
  await db.$transaction(async tx=>{
    const member=await tx.user.findFirst({where:{id:String(req.params.id),tenantId:session.tenantId,status:"ACTIVE",
      role:{in:["DEALER","BUILDER","PROFESSIONAL"]}},select:{id:true,role:true}});
    if (!member) throw missing();
    const relation={DEALER:"dealerProfile",BUILDER:"builderProfile",PROFESSIONAL:"professionalProfile"}[member.role as "DEALER"|"BUILDER"|"PROFESSIONAL"];
    const profile=await tx.domainProfile.upsert({where:{userId_role:{userId:member.id,role:member.role}},update:{},
      create:{userId:member.id,role:member.role,[relation]:{create:{}}}});
    if ((profile.verification==="VERIFIED") !== verified) {
      await bump(tx,profile,session.userId,verified?"VERIFIED":"NOT_SUBMITTED",verified?"Verified by account administrator":"Verification removed by account administrator");
    }
  });
  sendSuccess(res,{verified});
}));
accountTools.patch("/admin/accounts/:id/featured",admin,asyncHandler(async(req,res) => {
  const {featured} = parseInput(z.object({featured:z.boolean()}).strict(),req.body);
  const {count} = await db.user.updateMany({where:{id:String(req.params.id),tenantId:req.session!.tenantId,
    ...(featured?{status:"ACTIVE",role:{in:[...eligible]}}:{})},data:{featuredAt:featured?new Date():null}});
  if (!count) throw missing();
  sendSuccess(res,{featured});
}));
accountTools.get("/public/featured-accounts",asyncHandler(async(req,res) => {
  const tenantId = req.session?.tenantId ?? env.PUBLIC_TENANT_ID;
  const groups = await Promise.all(eligible.map(role=>db.user.findMany({where:{tenantId,status:"ACTIVE",role,featuredAt:{not:null}},
    orderBy:[{featuredAt:"desc"},{id:"asc"}],take:12,select:{id:true,role:true,fullName:true,profileLogoUrl:true,profileLocation:true,domainProfiles:{select:{role:true,verification:true}},
      ownedItems:{where:{tenantId,publicAt:{not:null},OR:[{collection:"PROPERTIES",status:"PUBLISHED"},{collection:"DEALER_PROFILES",status:"VERIFIED"},
      {collection:"SERVICE_PROFILES",status:"PUBLISHED"},{collection:"WORKER_PROFILES",status:{in:["AVAILABLE","BUSY"]}}]},distinct:["collection"],select:{id:true,collection:true}}}})));
  sendSuccess(res,groups.flat().map(({id,ownedItems,role,domainProfiles,...identity})=>{
    const directory = ownedItems.find(i=>i.collection===({DEALER:"DEALER_PROFILES",PROFESSIONAL:"SERVICE_PROFILES",BLUE_COLLAR_WORKER:"WORKER_PROFILES"} as Record<string,string>)[role]);
    const segment = ({DEALER:"dealer",PROFESSIONAL:"professionals",BLUE_COLLAR_WORKER:"workers"} as Record<string,string>)[role];
    const path = directory ? segment+"/"+encodeURIComponent(directory.id) : ownedItems.some(i=>i.collection==="PROPERTIES") ? "advertisers/"+encodeURIComponent(id) : null;
    return {id,role,...identity,path,verified:domainProfiles.some(p=>p.role===role && p.verification==="VERIFIED")};
  }));
}));
accountTools.patch("/admin/properties/:id",admin,asyncHandler(async(req,res) => {
  const input = parseInput(z.object({updatedAt:z.string().datetime(),title:z.string().trim().min(3).max(180),description:z.string().trim().max(12000),
    price:z.number().finite().nonnegative().max(1e15).nullable(),city:z.string().trim().max(140),locality:z.string().trim().max(160)}).strict(),req.body);
  const where = {id:String(req.params.id),tenantId:req.session!.tenantId,collection:"PROPERTIES" as const};
  await db.$transaction(async tx=>{
    const current = await tx.workspaceItem.findFirst({where});
    if (!current) throw missing();
    const previousData=current.data as Prisma.JsonObject;
    const cityChanged=input.city!==(previousData.city??"");
    const localityChanged=input.locality!==(previousData.locality??"");
    const updatedData:Prisma.JsonObject = {...previousData,city:input.city,locality:input.locality,price:input.price};
    if(cityChanged)delete updatedData.placeCityId;
    if(cityChanged || localityChanged){
      const canonical={...(previousData.canonicalLocation as Prisma.JsonObject)};
      delete canonical.localityId;
      if(cityChanged)delete canonical.cityId;
      updatedData.canonicalLocation=canonical;
    }
    if (current.description !== input.description && "aboutPropertyHtml" in updatedData) delete updatedData.aboutPropertyHtml;
    const changed=await tx.workspaceItem.updateMany({where:{...where,updatedAt:new Date(input.updatedAt)},data:{title:input.title,
      description:input.description,data:updatedData,searchPrice:input.price,pricePerSqft:propertyPricePerSqft(updatedData)}});
    if (!changed.count) throw new ApiError(409,"LISTING_CHANGED","This listing changed. Reload it before saving.");
    const projection=await tx.property.updateMany({where:{id:where.id,tenantId:where.tenantId},data:{
      title:input.title,description:input.description,price:updatedData.priceMode==="ON_REQUEST"?null:input.price,
      pricePerSqft:propertyPricePerSqft(updatedData),cityName:input.city,localityName:input.locality,revision:{increment:1},
      ...(current.description!==input.description?{aboutHtml:null}:{}),...(cityChanged?{cityId:null}:{}),
      ...(cityChanged||localityChanged?{localityId:null}:{})
    }});
    if(!projection.count)await syncProperty(tx,await tx.workspaceItem.findUniqueOrThrow({where:{id:where.id}}),true);
    await tx.workspaceEvent.create({data:{tenantId:where.tenantId,itemId:where.id,actorId:req.session!.userId,action:"ADMIN_EDITED",fromStatus:current.status,toStatus:current.status}});
  });
  sendSuccess(res,{saved:true});
}));
accountTools.get("/public/property-rate-trends/:id",asyncHandler(async(req,res)=>{
  const tenantId=req.session?.tenantId??env.PUBLIC_TENANT_ID;
  const listing=await db.workspaceItem.findFirst({where:{tenantId,id:String(req.params.id),collection:"PROPERTIES",status:"PUBLISHED",publicAt:{not:null}},select:{data:true}});
  if(!listing) throw missing();
  const {city,currency,listingIntent,countryCode}=listing.data as Record<string,string>;
  if(!city || !currency || !listingIntent || !countryCode){sendSuccess(res,[]);return;}
  const rows=await db.$queryRaw<{month:string;average:number;count:number}[]>`
    SELECT to_char(w."publicAt",'YYYY-MM') AS month, avg(p."pricePerSqft")::float8 AS average, count(*)::int AS count
    FROM "WorkspaceItem" w JOIN "Property" p ON p.id=w.id
    WHERE w."tenantId"=${tenantId} AND w.collection='PROPERTIES' AND w.status='PUBLISHED'
    AND w."publicAt" >= date_trunc('month',CURRENT_DATE) - interval '11 months'
    AND w.data->>'city'=${city} AND w.data->>'countryCode'=${countryCode} AND p.currency=${currency}
    AND coalesce(w.data->>'priceMode','') <> 'ON_REQUEST'
    AND w.data->>'listingIntent'=${listingIntent} AND p."pricePerSqft">0
    GROUP BY 1 ORDER BY 1 DESC`;
  sendSuccess(res,rows);
}));
