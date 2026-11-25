import {Prisma} from "@prisma/client";
import {ApiError} from "../utils/api-error.js";

type Line = {quantity:number;unitPrice:number;taxRate?:number;discount?:number};
export type QuoteInput = {items:Line[];taxRate?:number;pricesIncludeTax?:boolean;discount?:number;deliveryCharge?:number;otherCharges?:number};
const money=(n:Prisma.Decimal)=>n.toDecimalPlaces(2,Prisma.Decimal.ROUND_HALF_UP);
function invalid(k:string,m:string):never{throw new ApiError(422,"INVALID_QUOTE",m,{[k]:[m]});}
export function quoteTotals(input:QuoteInput){
  const zero=new Prisma.Decimal(0);
  let subtotal=zero,lineDiscount=zero,tax=zero;
  const lines=input.items.map((item,i)=>{
    const gross=money(new Prisma.Decimal(item.quantity).times(item.unitPrice));
    const discount=money(new Prisma.Decimal(item.discount??0));
    if(discount.gt(gross))invalid("items."+i+".discount","Line discount exceeds the line amount.");
    const rate=new Prisma.Decimal(item.taxRate??input.taxRate??0).div(100);
    const after=gross.minus(discount);
    const part=input.pricesIncludeTax?money(after.minus(after.div(rate.plus(1)))):money(after.times(rate));
    const total=input.pricesIncludeTax?after:after.plus(part);
    subtotal=subtotal.plus(gross);lineDiscount=lineDiscount.plus(discount);tax=tax.plus(part);
    return {gross:gross.toNumber(),discount:discount.toNumber(),tax:part.toNumber(),total:total.toNumber()};
  });
  const beforeDiscount=subtotal.minus(lineDiscount).plus(input.pricesIncludeTax?0:tax);
  const discount=money(new Prisma.Decimal(input.discount??0));
  if(discount.gt(beforeDiscount))invalid("discount","Additional discount exceeds the quoted amount.");
  const total=money(beforeDiscount.minus(discount).plus(input.deliveryCharge??0).plus(input.otherCharges??0));
  return {lines,subtotal:subtotal.toNumber(),lineDiscount:lineDiscount.toNumber(),tax:tax.toNumber(),discount:discount.toNumber(),total:total.toNumber()};
}
