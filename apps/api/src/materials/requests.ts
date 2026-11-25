import {Prisma,type WorkspaceItem} from "@prisma/client";
import {createHash} from "node:crypto";
import {ApiError} from "../utils/api-error.js";
import {quoteTotals,type QuoteInput} from "./quotation.js";
type Tx=Prisma.TransactionClient;
type Data=Record<string,unknown>;
const string=(v:unknown)=>typeof v==="string"?v:null;
const numeric=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)?v:null;
const lineId=(id:string,i:number)=>createHash("sha256").update(id+"/"+i).digest("hex");
const records=(d:Data)=>Array.isArray(d.items)?d.items.filter((v):v is Data=>v&&typeof v==="object"&&!Array.isArray(v)):[];
function invalid(key:string,message:string):never{throw new ApiError(422,"INVALID_LINE",message,{[key]:[message]});}

export async function syncRequest(tx:Tx,row:WorkspaceItem,importing=false){
  const {tenantId,id}=row, d=(row.data??{}) as Data, notes:string[]=[];
  const data={tenantId,requesterId:row.ownerId,projectName:string(d.projectName),requiredBy:string(d.requiredByDate),contactPreference:string(d.contactPreference),
    cityCode:string(d.cityId),countryCode:string(d.countryCode),state:string(d.state),locality:string(d.locality),postalCode:string(d.postalCode),address:string(d.deliveryAddress)};
  await tx.materialRFQ.upsert({where:{id},create:{id,...data},update:data});
  const lines=records(d), keep:string[]=[];
  for(const [i,line] of lines.entries()){
    const master=async(kind:string,key:string,parentId?:string|null)=>{
      const val=string(line[key]);if(!val)return null;
      const found=await tx.masterItem.findFirst({where:{tenantId,kind,...(parentId!==undefined?{parentId}:{}),OR:[{code:val},{id:val}]}});
      if(!found){if(!importing)invalid("items."+i+"."+key,"Choose a valid catalogue option.");notes.push("Unmapped "+key+" on item "+(i+1));}
      return found?.id??null;
    };
    const categoryId=await master("MATERIAL_CATEGORY","category");
    const fields={position:i,itemName:string(line.itemName)??"",categoryId,subcategoryId:await master("MATERIAL_SUBCATEGORY","subcategoryId",categoryId),unitId:await master("MATERIAL_UNIT","unit"),
      brand:string(line.preferredBrand),specification:string(line.specification),notes:string(line.notes),quantity:numeric(line.quantity)};
    const key=lineId(id,i);keep.push(key);
    await tx.materialRFQItem.upsert({where:{id:key},create:{rfqId:id,id:key,...fields},update:fields});
  }
  await tx.materialRFQItem.deleteMany({where:{rfqId:id,id:{notIn:keep}}});
  if(importing)await migrationNote(tx,row,["projectName","requiredByDate","cityId","countryCode","state","postalCode","locality","deliveryAddress","items"],notes);
}
async function migrationNote(tx:Tx,row:WorkspaceItem,keys:string[],notes:string[]){
  const present=Object.keys((row.data??{}) as Data);
  await tx.marketplaceMigrationNote.create({data:{sourceId:row.id,domain:row.collection,mappedFields:present.filter(k=>keys.includes(k)),retainedFields:present.filter(k=>!keys.includes(k)),notes}});
}
export async function syncQuote(tx:Tx,row:WorkspaceItem,importing=false,recordRevision=false){
  const {tenantId,id}=row,d=(row.data??{}) as Data,lines=records(d),notes:string[]=[];
  let rfq=row.parentId?await tx.materialRFQ.findFirst({where:{id:row.parentId,tenantId}}):null;
  if(!rfq&&row.parentId&&!importing){const parent=await tx.workspaceItem.findFirst({where:{id:row.parentId,tenantId,collection:"MATERIAL_RFQS"}});if(parent){await syncRequest(tx,parent,true);rfq=await tx.materialRFQ.findUnique({where:{id:parent.id}});}}
  if(!rfq){if(!importing)invalid("rfqId","Choose an eligible material request.");notes.push("Unresolved original RFQ");}
  const complete=lines.length>0&&lines.every(l=>numeric(l.quantity)!=null&&numeric(l.unitPrice)!=null);
  const totals=complete?quoteTotals(d as QuoteInput):null;
  const fields={tenantId,rfqId:rfq?.id,vendorId:row.ownerId,currency:string(d.currency),validUntil:string(d.validUntil),deliveryDays:numeric(d.deliveryLeadTimeDays),paymentTerms:string(d.paymentTerms),
    notes:string(d.notes),taxNotes:string(d.taxNotes),subtotal:totals?.subtotal??null,discount:totals?(totals.lineDiscount+totals.discount):null,tax:totals?.tax??null,
    delivery:numeric(d.deliveryCharge),otherCharges:numeric(d.otherCharges),total:importing?numeric(d.grandTotal):totals?.total??null};
  await tx.materialQuote.upsert({where:{id},create:{id,...fields},update:fields});
  const requested=rfq?await tx.materialRFQItem.findMany({where:{rfqId:rfq.id}}):[];
  const keep:string[]=[];
  for(const [i,line] of lines.entries()){
    const requestedId=string(line.rfqItemId),productId=string(line.productId);
    const match=requestedId?requested.find(r=>r.id===requestedId):requested.filter(r=>r.itemName===line.itemName);
    if(requestedId&&!match)invalid("items."+i+".rfqItemId","Choose an item from this RFQ.");
    if(productId && !(await tx.materialProduct.count({where:{id:productId,tenantId,workspace:{ownerId:row.ownerId,status:"PUBLISHED"}}})))invalid("items."+i+".productId","Choose your own published product.");
    const key=lineId(id,i);keep.push(key);
    const fields={rfqItemId:Array.isArray(match)?match.length===1?match[0]!.id:null:match?.id??null,productId,position:i,description:string(line.itemName)??"",quantity:numeric(line.quantity),unit:string(line.unit),unitPrice:numeric(line.unitPrice),taxRate:numeric(line.taxRate)??numeric(d.taxRate),discount:numeric(line.discount),total:totals?.lines[i]?.total??null};
    await tx.materialQuoteItem.upsert({where:{id:key},create:{id:key,quoteId:id,...fields},update:fields});
  }
  await tx.materialQuoteItem.deleteMany({where:{quoteId:id,id:{notIn:keep}}});
  if(recordRevision||importing){const version=await tx.materialQuoteRevision.count({where:{quoteId:id}})+1;
    await tx.materialQuoteRevision.create({data:{quoteId:id,version,snapshot:{title:row.title,status:row.status,data:row.data} as Prisma.InputJsonValue}});}
  if(importing)await migrationNote(tx,row,["rfqId","items","currency","validUntil","deliveryCharge","deliveryLeadTimeDays","paymentTerms","taxRate","pricesIncludeTax","grandTotal"],notes);
}
