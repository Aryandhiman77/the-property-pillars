import {Router, type Router as ExpressRouter} from "express";
import {z} from "zod";
import {prisma} from "../database/prisma.js";
import {requireRole, requireSession} from "../middleware/session.middleware.js";
import {activeMasters, ensureCatalog} from "../profiles/masters.js";
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";
import {parseInput} from "../helpers/parse-input.js";
import {sendSuccess} from "../helpers/api-response.js";
import {definitionInput} from "./specifications.js";

export const materialCatalog: ExpressRouter = Router();
materialCatalog.use(requireSession);
materialCatalog.get("/specifications", asyncHandler(async (req, res) => {
  const {tenantId, role} = req.session!;
  const q = parseInput(z.object({categoryId:z.string().min(1).max(100), subcategoryId:z.string().max(100).optional(), all:z.literal("1").optional()}), req.query);
  await ensureCatalog(tenantId);
  const admin = role === "ADMIN" && q.all;
  const items = await prisma.productSpecificationDefinition.findMany({
    where: {tenantId, categoryId:q.categoryId, ...(admin ? {} : {active:true}),
      ...(admin && !q.subcategoryId ? {} : {OR:[{subcategoryId:null}, ...(q.subcategoryId ? [{subcategoryId:q.subcategoryId}] : [])]})},
    orderBy:[{sortOrder:"asc"},{name:"asc"},{id:"asc"}],
  });
  sendSuccess(res,items);
}));

materialCatalog.get("/selection",asyncHandler(async (req,res)=>{
  const {tenantId}=req.session!;
  const q=parseInput(z.object({category:z.string().max(100).optional(),subcategoryId:z.string().max(100).optional(),unit:z.string().max(100).optional()}),req.query);
  await ensureCatalog(tenantId);
  const resolve=(kind:string,key?:string)=>key?prisma.masterItem.findFirst({where:{tenantId,kind,OR:[{id:key},{code:key}]},select:{id:true,code:true,name:true}}):null;
  const [category,subcategory,unit]=await Promise.all([resolve("MATERIAL_CATEGORY",q.category),resolve("MATERIAL_SUBCATEGORY",q.subcategoryId),resolve("MATERIAL_UNIT",q.unit)]);
  sendSuccess(res,{category,subcategory,unit});
}));
const save = asyncHandler(async (req, res) => {
  const {tenantId} = req.session!;
  const id = typeof req.params.id === "string" ? req.params.id : undefined;
  const data = parseInput(definitionInput,req.body);
  await ensureCatalog(tenantId);
  const result = await prisma.$transaction(async tx => {
    if (!(await tx.masterItem.count({where:{id:data.categoryId,tenantId,kind:"MATERIAL_CATEGORY",...activeMasters("MATERIAL_CATEGORY")}})))
      throw new ApiError(422,"CATEGORY_INVALID","Choose an active material category.",{categoryId:["Choose an active category."]});
    if (data.subcategoryId && !(await tx.masterItem.count({where:{id:data.subcategoryId,tenantId,parentId:data.categoryId,kind:"MATERIAL_SUBCATEGORY",active:true}})))
      throw new ApiError(422,"SUBCATEGORY_INVALID","Choose a subcategory belonging to the category.",{subcategoryId:["Choose a matching subcategory."]});
    if (!id) return tx.productSpecificationDefinition.create({data:{...data,tenantId}});
    const [locked] = await tx.$queryRaw<{id:string}[]>`SELECT id FROM "ProductSpecificationDefinition" WHERE id=${id} AND "tenantId"=${tenantId} FOR UPDATE`;
    if (!locked) throw new ApiError(404,"NOT_FOUND","Specification not found.");
    const original = await tx.productSpecificationDefinition.findUniqueOrThrow({where:{id},include:{_count:{select:{values:true}}}});
    if (original._count.values && (original.fieldType !== data.fieldType || original.categoryId !== data.categoryId ||
      original.subcategoryId !== (data.subcategoryId ?? null) || original.unit !== (data.unit ?? null) || original.options.some(o=>!data.options.includes(o))))
      throw new ApiError(409,"SPECIFICATION_IN_USE","Products use this definition. Deactivate it and add a new definition to change its meaning.");
    return tx.productSpecificationDefinition.update({where:{id},data:{...data,subcategoryId:data.subcategoryId ?? null,unit:data.unit ?? null}});
  });
  sendSuccess(res,result,id ? 200 : 201);
});
materialCatalog.post("/specifications",requireRole("ADMIN"),save);
materialCatalog.put("/specifications/:id",requireRole("ADMIN"),save);
