import {Router,type Router as ExpressRouter} from "express";
import {z} from "zod";
import {prisma} from "../database/prisma.js";
import {requireSession} from "../middleware/session.middleware.js";
import {asyncHandler} from "../utils/async-handler.js";
import {ApiError} from "../utils/api-error.js";
import {parseInput} from "../helpers/parse-input.js";
import {sendSuccess} from "../helpers/api-response.js";
import {quoteTotals} from "./quotation.js";
import {syncQuote} from "./requests.js";
import {collectionSchemas} from "../workspace/config.js";
import {validateTransitionReadiness} from "../workspace/validation.js";
import {quotingRfqStatuses} from "../workspace/material-matching.js";
const missing=()=>new ApiError(404,"NOT_FOUND","Request or quote not found.");
export const rfqRouter:ExpressRouter=Router();
rfqRouter.use(requireSession);
rfqRouter.get("/rfqs/:id/compare",asyncHandler(async(req,res)=>{
  const {tenantId,userId,role}=req.session!;
  const rfq=await prisma.workspaceItem.findFirst({where:{tenantId,id:String(req.params.id),collection:"MATERIAL_RFQS",...(role==="ADMIN"?{}:{ownerId:userId})},select:{id:true}});
  if(!rfq)throw missing();
  const quotes=await prisma.materialQuote.findMany({where:{tenantId,rfqId:rfq.id,workspace:{status:{notIn:["DRAFT","WITHDRAWN"]}}},select:{id:true,currency:true,total:true,deliveryDays:true,validUntil:true,paymentTerms:true,
    workspace:{select:{status:true,owner:{select:{fullName:true,domainProfiles:{where:{role:"VENDOR"},select:{verification:true}}}}}},
    lines:{orderBy:{position:"asc"},select:{description:true,quantity:true,unit:true,unitPrice:true,taxRate:true,discount:true,total:true}}},orderBy:{id:"asc"}});
  sendSuccess(res,quotes.map(({workspace,...q})=>({...q,status:workspace.status,vendor:workspace.owner?.fullName??"Vendor",verified:workspace.owner?.domainProfiles[0]?.verification==="VERIFIED"})));
}));
rfqRouter.get("/quotes/:id/revisions",asyncHandler(async(req,res)=>{
  const {tenantId,userId,role}=req.session!;
  const quote=await prisma.workspaceItem.findFirst({where:{tenantId,id:String(req.params.id),collection:"MATERIAL_QUOTES",...(role==="ADMIN"?{}:{OR:[{ownerId:userId},{targetUserId:userId,status:{not:"DRAFT"}}]})},select:{id:true}});
  if(!quote)throw missing();
  sendSuccess(res,await prisma.materialQuoteRevision.findMany({where:{quoteId:quote.id},select:{version:true,createdAt:true,snapshot:true},orderBy:{version:"desc"},take:50}));
}));
rfqRouter.post("/quotes/:id/revise",asyncHandler(async(req,res)=>{
  const {tenantId,userId,role}=req.session!;if(role!=="VENDOR")throw new ApiError(403,"FORBIDDEN","Only the quoting vendor can revise a quote.");
  const body=parseInput(z.object({version:z.number().int().nonnegative(),changes:collectionSchemas.materialQuotes.partial().omit({rfqId:true,grandTotal:true})}).strict(),req.body);
  const id=String(req.params.id);
  const result=await prisma.$transaction(async tx=>{
    const original=await tx.workspaceItem.findFirst({where:{id,tenantId,collection:"MATERIAL_QUOTES",ownerId:userId}});
    if(!original?.parentId)throw missing();
    const [parent]=await tx.$queryRaw<{status:string,data:Record<string,unknown>}[]>`SELECT status,data FROM "WorkspaceItem" WHERE id=${original.parentId} AND "tenantId"=${tenantId} FOR UPDATE`;
    if(!parent||!quotingRfqStatuses.includes(parent.status)||typeof parent.data.requiredByDate==="string"&&parent.data.requiredByDate<new Date().toISOString().slice(0,10))throw new ApiError(409,"RFQ_CLOSED","This RFQ no longer accepts revisions.");
    await tx.$queryRaw`SELECT id FROM "WorkspaceItem" WHERE id=${id} FOR UPDATE`;
    const quote=await tx.workspaceItem.findUniqueOrThrow({where:{id}});
    if(!["SUBMITTED","VIEWED","SHORTLISTED"].includes(quote.status))throw new ApiError(409,"QUOTE_FINAL","This quote cannot be revised.");
    const version=await tx.materialQuoteRevision.count({where:{quoteId:id}});
    if(body.version!==version)throw new ApiError(409,"QUOTE_CHANGED","Reload the quote before revising.");
    const next=collectionSchemas.materialQuotes.parse({...quote.data as object,...body.changes});
    validateTransitionReadiness("materialQuotes","SUBMITTED",next,quote.description);
    next.grandTotal=quoteTotals({...next,items:next.items!}).total;
    const updated=await tx.workspaceItem.update({where:{id},data:{status:"SUBMITTED",data:next}});
    if(!version)await syncQuote(tx,quote,false,true);
    await syncQuote(tx,updated,false,true);
    await tx.workspaceEvent.create({data:{tenantId,itemId:id,actorId:userId,action:"QUOTE_REVISED",fromStatus:quote.status,toStatus:updated.status}});
    return {version:version?version+1:2,total:next.grandTotal};
  });sendSuccess(res,result);
}));
