import {test} from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import {app} from "../src/app.js";
import {prisma} from "../src/database/prisma.js";
import {env} from "../src/config/env.js";
import {sessionService} from "../src/services/session.service.js";
import {definitionInput,specificationValue} from "../src/materials/specifications.js";
import type {AppRole} from "../src/types/auth.js";

test("material specifications validate type, range, unit and controlled choices",()=>{
  const d={id:"grade",name:"Grade",options:["A","B"]};
  for(const [type,valid,invalid] of [
    ["TEXT","Cement",""],["NUMBER",3,3.5],["DECIMAL",.5,"0.5"],["BOOLEAN",false,0],["DROPDOWN","A","C"],
    ["MULTI_SELECT",["A","B"],["A","A"]],["UNIT_VALUE",12,"12 kg"],["RANGE",{min:1,max:2},{min:2,max:1}]
  ] as const){
    assert.deepEqual(specificationValue({...d,fieldType:type},valid),valid);
    assert.throws(()=>specificationValue({...d,fieldType:type},invalid));
  }
  assert.ok(!definitionInput.safeParse({categoryId:"cement",name:"Weight",fieldType:"UNIT_VALUE"}).success);
});
test("M5 material catalogue permissions, specification builder and product transactions on restored PostgreSQL",{skip:process.env.RUN_MATERIAL_REHEARSAL!=="1"},async()=>{
  const u=new URL(env.DATABASE_URL);assert.ok(u.hostname==="127.0.0.1"&&/^\/tpp_rehearsal_\d+$/.test(u.pathname));
  const tenant=await prisma.tenant.create({data:{name:"Materials catalogue rehearsal"}});
  const http=request(app),url="/api/v1/workspace/materialProducts",defs="/api/v1/material-catalog/specifications";
  async function cookie(role:AppRole){
    const user=await prisma.user.create({data:{tenantId:tenant.id,role,fullName:role,passwordHash:"disabled"}});
    const s=await sessionService.issue({tenantId:tenant.id,role,userId:user.id,passwordHash:"disabled"});
    return env.SESSION_COOKIE_NAME+"="+s.token;
  }
  const admin=await cookie("ADMIN"),vendor=await cookie("VENDOR"),buyer=await cookie("BUYER");
  const category=(await http.get("/api/v1/material-catalog/selection?category=CEMENT&unit=BAG").set("Cookie",vendor).expect(200)).body.data.category.id;
  const payload={categoryId:category,name:"Strength",fieldType:"UNIT_VALUE",unit:"MPa",required:true};
  await http.post(defs).set("Cookie",vendor).send(payload).expect(403);
  const def=(await http.post(defs).set("Cookie",admin).send(payload).expect(201)).body.data;
  const body={title:"High strength cement",data:{category:"CEMENT",unit:"BAG",sku:"CEM-01",specifications:{[def.id]:53}}};
  await http.post(url).set("Cookie",buyer).send(body).expect(403);
  const record=(await http.post(url).set("Cookie",vendor).send(body).expect(201)).body.data;
  let product=await prisma.materialProduct.findUniqueOrThrow({where:{id:record.id},include:{specifications:true}});
  assert.ok(product.vendorProfileId);assert.equal(product.categoryId,category);assert.equal(product.specifications[0]?.value,53);
  await http.put(defs+"/"+def.id).set("Cookie",admin).send({...payload,unit:"kg"}).expect(409);
  await http.patch(url+"/"+record.id).set("Cookie",vendor).send({data:{specifications:{[def.id]:"wrong"}}}).expect(422);
  product=await prisma.materialProduct.findUniqueOrThrow({where:{id:record.id},include:{specifications:true}});
  assert.equal(product.specifications[0]?.value,53);
  await http.patch(url+"/"+record.id).set("Cookie",vendor).send({data:{specifications:{[def.id]:48}}}).expect(200);
  assert.equal((await prisma.materialProductSpecification.findFirstOrThrow({where:{productId:record.id}})).value,48);
});
