import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import test from "node:test";
import {prisma} from "../src/database/prisma.js";
import {env} from "../src/config/env.js";
import {syncManagedAdmin} from "../src/services/managed-admin.js";
import {authService} from "../src/services/auth.service.js";

test("environment administrator keeps its identity across startup and credential changes", {skip:process.env.RUN_MANAGED_ADMIN_REHEARSAL !== "1"}, async () => {
  const db = new URL(env.DATABASE_URL);
  assert.ok(["localhost","127.0.0.1"].includes(db.hostname) && /^\/tpp_rehearsal_\d+$/.test(db.pathname));
  const initial = {ADMIN_EMAIL:"operations@example.test",ADMIN_USERNAME:"operations",ADMIN_PASSWORD:randomUUID()};
  await Promise.all([syncManagedAdmin(initial),syncManagedAdmin(initial)]);
  const admin = await prisma.user.findUniqueOrThrow({where:{email:initial.ADMIN_EMAIL}});
  await authService.signIn({email:initial.ADMIN_USERNAME,password:initial.ADMIN_PASSWORD});
  await syncManagedAdmin(initial);
  assert.equal(await prisma.session.count({where:{userId:admin.id,revokedAt:null}}),1);
  const changed = {ADMIN_EMAIL:"editor@example.test",ADMIN_USERNAME:"editor",ADMIN_PASSWORD:randomUUID()};
  await syncManagedAdmin(changed);
  const edited = await prisma.user.findUniqueOrThrow({where:{email:changed.ADMIN_EMAIL}});
  assert.equal(edited.id,admin.id);
  assert.equal(edited.fullName,"editor");
  assert.equal(await prisma.session.count({where:{userId:admin.id,revokedAt:null}}),0);
  await authService.signIn({email:changed.ADMIN_EMAIL,password:changed.ADMIN_PASSWORD});
  await assert.rejects(authService.signIn({email:initial.ADMIN_USERNAME,password:initial.ADMIN_PASSWORD}));
  await prisma.user.create({data:{tenantId:admin.tenantId,email:"buyer@example.test",fullName:"Buyer",role:"BUYER"}});
  await assert.rejects(syncManagedAdmin({...changed,ADMIN_EMAIL:"buyer@example.test"}));
  await authService.signIn({email:changed.ADMIN_USERNAME,password:changed.ADMIN_PASSWORD});
});
