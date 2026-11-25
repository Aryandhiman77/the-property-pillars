import {createHash} from "node:crypto";
import {Prisma, type ProductSpecificationDefinition} from "@prisma/client";
import {specificationTypes, type SpecificationType} from "@the-property-pillar/contracts";
import {z} from "zod";
import {ApiError} from "../utils/api-error.js";

const label = z.string().trim().min(1).max(120);
export const definitionInput = z.object({
  name: label, categoryId: label, subcategoryId: label.nullish(), fieldType: z.enum(specificationTypes),
  unit: label.nullish(), options: z.array(label).max(100).default([]), required: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(100000).default(0), active: z.boolean().default(true),
}).strict().superRefine((input, ctx) => {
  const selectable = ["DROPDOWN","MULTI_SELECT"].includes(input.fieldType);
  if (selectable && (!input.options.length || new Set(input.options).size !== input.options.length))
    ctx.addIssue({code: "custom", path: ["options"], message: "Add distinct choices for this specification."});
  if (!selectable && input.options.length)
    ctx.addIssue({code: "custom", path: ["options"], message: "Choices apply to dropdown and multi-select specifications."});
  if (input.fieldType === "UNIT_VALUE" && !input.unit)
    ctx.addIssue({code: "custom", path:["unit"], message:"Enter the measurement unit."});
});

export function specificationValue(def: Pick<ProductSpecificationDefinition,"name"|"fieldType"|"options"|"id">, value: unknown): Prisma.InputJsonValue {
  const number = z.number().finite();
  const choice = label.refine(v => def.options.includes(v));
  const shapes = {
    TEXT: z.string().trim().min(1).max(1500), NUMBER: number.int(), DECIMAL: number, BOOLEAN: z.boolean(),
    DROPDOWN: choice, MULTI_SELECT: z.array(choice).min(1).max(100).refine(v => new Set(v).size === v.length),
    UNIT_VALUE: number, RANGE: z.object({min:number,max:number}).strict().refine(v => v.min <= v.max),
  };
  const result = shapes[def.fieldType as SpecificationType]?.safeParse(value);
  if (!result?.success) throw new ApiError(422,"INVALID_SPECIFICATION","Check the specification value.",{
    ["specifications." + def.id]: ["Enter a valid value for " + def.name + "."],
  });
  return result.data;
}

type Seed = [string, SpecificationType, (string | string[])?];
const defaults: Record<string, Seed[]> = {
  CEMENT: [["Cement type","DROPDOWN",["OPC","PPC","PSC","White cement"]],["Grade","TEXT"],["Bag weight","UNIT_VALUE","kg"],["Standard","TEXT"],["Colour","TEXT"]],
  TMT_STEEL: [["Grade","TEXT"],["Diameter","UNIT_VALUE","mm"],["Length","UNIT_VALUE","m"],["Standard","TEXT"],["Weight","UNIT_VALUE","kg"]],
  TILES: [["Material","TEXT"],["Size","TEXT"],["Finish","DROPDOWN",["Matt","Glossy","Textured","Polished"]],["Thickness","UNIT_VALUE","mm"],["Application","MULTI_SELECT",["Wall","Floor","Outdoor","Parking"]],["Colour","TEXT"],["Pattern","TEXT"]],
  PAINTS: [["Paint type","TEXT"],["Finish","TEXT"],["Pack size","UNIT_VALUE","L"],["Coverage","TEXT"],["Application","MULTI_SELECT",["Interior","Exterior"]],["Colour family","TEXT"]],
};
export async function seedSpecifications(tx: Prisma.TransactionClient, tenantId: string) {
  const categories = await tx.masterItem.findMany({where:{tenantId,kind:"MATERIAL_CATEGORY",code:{in:Object.keys(defaults)}},select:{id:true,code:true}});
  await tx.productSpecificationDefinition.createMany({
    data: categories.flatMap(category => defaults[category.code]!.map(([name, fieldType, extra], sortOrder) => ({
      id: createHash("sha256").update(JSON.stringify([tenantId, category.id, name])).digest("hex"),
      tenantId, categoryId: category.id, name, fieldType, sortOrder,
      unit: typeof extra === "string" ? extra : null, options: Array.isArray(extra) ? extra : [],
    }))), skipDuplicates: true,
  });
}
