import {Prisma, type WorkspaceItem} from "@prisma/client";
import {getDeliveryCity, getDeliveryCityCentre} from "../locations/delivery-cities.js";
import {masterCode, masterSeed} from "../profiles/masters.js";
import {ApiError} from "../utils/api-error.js";
import {specificationValue} from "./specifications.js";

type Tx = Prisma.TransactionClient;
const str = (v: unknown) => typeof v === "string" && v.trim() ? v.trim() : null;
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : null;
const bool = (v: unknown) => typeof v === "boolean" ? v : null;
const list = (v: unknown): string[] => Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === "string"))] : [];
function invalid(key: string, message: string): never {
  throw new ApiError(422,"INVALID_PRODUCT",message,{[key]:[message]});
}
export async function syncMaterialProduct(tx: Tx, row: WorkspaceItem, importing = false) {
  const d = (row.data ?? {}) as Record<string,unknown>;
  const notes: string[] = [];
  const {id,tenantId,ownerId} = row;
  const existing = await tx.materialProduct.findUnique({where:{id}});
  async function resolve(kind: string, key: string, previous?: string | null, parentId?: string | null) {
    const value = str(d[key]);
    if (!value) return null;
    const found = await tx.masterItem.findFirst({where:{tenantId,kind,...(parentId !== undefined ? {parentId}:{}),OR:[{code:value},{id:value}]}});
    if (!found || (!importing && !found.active && found.id !== previous)) {
      if (!importing) invalid(key,"Choose a valid catalogue option.");
      notes.push(key + " has no canonical match");
      return null;
    }
    return found.id;
  }
  const categoryId = await resolve("MATERIAL_CATEGORY","category",existing?.categoryId);
  const subcategoryId = await resolve("MATERIAL_SUBCATEGORY","subcategoryId",existing?.subcategoryId,categoryId);
  const unitId = await resolve("MATERIAL_UNIT","unit",existing?.unitId);
  const vendor = ownerId && await tx.vendorProfile.findFirst({where:{profile:{userId:ownerId,user:{tenantId}}},select:{profileId:true}});
  if (!vendor) {
    if (!importing && !existing) invalid("vendor","A Vendor profile is required to list a product.");
    notes.push("No linked vendor profile");
  }
  const pricingType = str(d.pricingType) ?? (num(d.indicativePrice) != null ? "FIXED":null);
  const minPrice = num(d.indicativePrice);
  const maxPrice = num(d.maxPrice);
  const ready = ["PENDING_REVIEW","PUBLISHED"].includes(row.status);
  if (!importing && ready && pricingType === "RANGE" && (minPrice == null || maxPrice == null || maxPrice < minPrice)) invalid("maxPrice","Maximum price must be at least the starting price.");
  if (!importing && ready && ["FIXED","STARTING_FROM"].includes(pricingType ?? "") && minPrice == null) invalid("indicativePrice","Enter a price.");
  const data = {tenantId, vendorProfileId:vendor ? vendor.profileId : null,categoryId,subcategoryId,unitId,reference:str(d.reference),sku:str(d.sku),brand:str(d.brand),
    model:str(d.model) ?? str(d.variant),summary:str(d.summary),pricingType,minPrice:pricingType==="ON_REQUEST"?null:minPrice,maxPrice:pricingType==="RANGE"?maxPrice:null,
    currency:str(d.currency),includesTax:bool(d.priceIncludesTax),minimumQuantity:num(d.minimumOrderQuantity),availability:str(d.availabilityStatus),
    delivery:bool(d.deliveryAvailable) ?? (list(d.deliveryCityIds).length ? true:null),pickup:bool(d.pickupAvailable),radiusKm:num(d.deliveryRadiusKm),
    leadTimeValue:num(d.leadTimeValue),leadTimeUnit:str(d.leadTimeUnit),deliveryNotes:str(d.deliveryNotes),specificationText:str(d.specification)};
  await tx.materialProduct.upsert({where:{id},create:{id,...data},update:data});
  const urls = [...new Set([...list(d.mediaUrls),...list([d.videoUrl])])];
  await tx.materialProductMedia.deleteMany({where:{productId:id,url:{notIn:urls}}});
  for (const [position,url] of urls.entries()) {
    const kind = url === d.videoUrl ? "VIDEO":"IMAGE";
    await tx.materialProductMedia.upsert({where:{productId_url:{productId:id,url}},create:{productId:id,url,kind,position},update:{position,kind}});
  }
  const places: string[] = [];
  for (const code of list(d.deliveryCityIds)) {
    const city = getDeliveryCity(code);
    if (!city) {notes.push("Unresolved delivery city "+code);continue;}
    const country=masterSeed(tenantId,"COUNTRY",city.countryCode,city.countryCode);
    const region=masterSeed(tenantId,"STATE",city.countryCode+"-"+masterCode(city.region||city.name),city.region||city.name,country.id);
    const place=masterSeed(tenantId,"CITY",code,city.name,region.id);
    await tx.masterItem.createMany({data:[country,region,{...place,...getDeliveryCityCentre(code)}],skipDuplicates:true});
    places.push(place.id);
  }
  await tx.materialProductDeliveryArea.deleteMany({where:{productId:id,placeId:{notIn:places}}});
  await tx.materialProductDeliveryArea.createMany({data:places.map(placeId=>({productId:id,placeId})),skipDuplicates:true});
  const values = (d.specifications ?? {}) as Record<string,unknown>;
  const defs = categoryId ? await tx.productSpecificationDefinition.findMany({where:{tenantId,categoryId,OR:[{subcategoryId:null},{subcategoryId}]}}):[];
  const stored = await tx.materialProductSpecification.findMany({where:{productId:id}});
  for (const [definitionId,v] of Object.entries(values)) {
    const def=defs.find(s=>s.id===definitionId);
    if (!def?.active) {
      if (stored.some(s=>s.definitionId===definitionId && JSON.stringify(s.value)===JSON.stringify(v))) continue;
      invalid("specifications."+definitionId,"Choose a specification for this category.");
    }
    const value=specificationValue(def,v);
    await tx.materialProductSpecification.upsert({where:{productId_definitionId:{productId:id,definitionId}},create:{productId:id,definitionId,value},update:{value}});
  }
  if (!importing && ready) for (const def of defs) if(def.active && def.required && values[def.id] == null) invalid("specifications."+def.id,"Enter "+def.name+".");
  await tx.materialProductSpecification.deleteMany({where:{productId:id,definitionId:{notIn:Object.keys(values)}}});
  if (importing) {
    const mapped = ["category","unit","brand","variant","specification","indicativePrice","currency","priceIncludesTax","minimumOrderQuantity","deliveryCityIds","availabilityStatus","mediaUrls","videoUrl"].filter(k=>d[k]!=null && !(k==="category"&&!categoryId) && !(k==="unit"&&!unitId));
    await tx.marketplaceMigrationNote.create({data:{sourceId:id,domain:"MATERIAL_PRODUCT",mappedFields:mapped,retainedFields:Object.keys(d).filter(k=>!mapped.includes(k)),notes}});
  }
}
