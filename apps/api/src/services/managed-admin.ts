import {z} from "zod";
import {prisma} from "../database/prisma.js";
import {getOrCreateMarketplaceTenant} from "../database/tenant.js";
import {hashPassword, verifyPassword} from "../utils/password.js";

import {adminUsernamePattern} from "../schemas/auth.schema.js";
const credentials = z.object({
  ADMIN_EMAIL: z.string().trim().email().transform(s => s.toLowerCase()),
  ADMIN_USERNAME: z.string().trim().regex(adminUsernamePattern).transform(s => s.toLowerCase()).optional(),
  ADMIN_NAME: z.string().trim().min(2).max(100).optional(),
  ADMIN_PASSWORD: z.string().min(14).max(128),
}).refine(v => v.ADMIN_NAME || v.ADMIN_USERNAME);

export async function syncManagedAdmin(config: NodeJS.ProcessEnv = process.env, required = false) {
  const keys = ["ADMIN_EMAIL","ADMIN_NAME","ADMIN_USERNAME","ADMIN_PASSWORD"];
  const supplied = Object.fromEntries(keys.filter(k => config[k]?.trim()).map(k => [k,config[k]]));
  if (!required && !Object.keys(supplied).length) return;
  const parsed = credentials.safeParse(supplied);
  if (!parsed.success) throw new Error("Configure ADMIN_EMAIL, ADMIN_PASSWORD (14–128 characters) and ADMIN_USERNAME or ADMIN_NAME. Usernames must begin with a letter and contain 3–64 letters, digits, dots, underscores or hyphens.");
  const {ADMIN_EMAIL:email, ADMIN_USERNAME:username, ADMIN_PASSWORD:password, ADMIN_NAME} = parsed.data;
  const fullName = ADMIN_NAME ?? username!;
  const tenant = await getOrCreateMarketplaceTenant();
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id=${tenant.id} FOR UPDATE`;
    const [binding] = await tx.$queryRaw<{userId:string; username:string|null}[]>`SELECT "userId",username FROM "ManagedAdmin" WHERE "tenantId"=${tenant.id}`;
    const owner = await tx.user.findUnique({where:{email}});
    const existing = binding ? await tx.user.findUniqueOrThrow({where:{id:binding.userId}}) : owner;
    if ((existing && (existing.tenantId !== tenant.id || existing.role !== "ADMIN")) || (owner && owner.id !== existing?.id)) {
      throw new Error("Configured admin email is already assigned to a different account.");
    }
    const newPassword = !existing?.passwordHash || !await verifyPassword(password,existing.passwordHash);
    const identityChanged = existing?.email !== email || (binding?.username ?? null) !== (username ?? null);
    const passwordHash = newPassword ? await hashPassword(password) : existing!.passwordHash!;
    const user = existing ?? await tx.user.create({data:{tenantId:tenant.id,role:"ADMIN",status:"ACTIVE",email,fullName,passwordHash}});
    if (!binding) {
      await tx.$executeRaw`INSERT INTO "ManagedAdmin" ("tenantId","userId",username) VALUES (${tenant.id},${user.id},${username ?? null})`;
    } else if (binding.username !== (username ?? null)) {
      await tx.$executeRaw`UPDATE "ManagedAdmin" SET username=${username ?? null} WHERE "tenantId"=${tenant.id}`;
    }
    if (existing && (newPassword || identityChanged || fullName !== existing.fullName)) {
      await tx.user.update({where:{id:user.id},data:{fullName,email,passwordHash,
        ...(email !== existing.email ? {emailVerifiedAt:null,emailVerificationCodeHash:null,emailVerificationExpiresAt:null} : {}),
        ...(newPassword || identityChanged ? {passwordResetCodeHash:null,passwordResetExpiresAt:null} : {}),
      }});
      if (newPassword || identityChanged) await tx.session.updateMany({where:{userId:user.id,revokedAt:null},data:{revokedAt:new Date()}});
    }
  });
}
