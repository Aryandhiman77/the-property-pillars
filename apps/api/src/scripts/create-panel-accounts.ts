import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

import { env } from '../config/env.js';
import { disconnectDatabase, prisma } from '../database/prisma.js';
import { getOrCreateMarketplaceTenant } from '../database/tenant.js';
import { USER_ROLES, type AppRole } from '../types/auth.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

const panelNames: Record<AppRole, { alias: string; name: string }> = {
  BUYER: { alias: 'buyer', name: 'Property Buyer' },
  OWNER: { alias: 'owner', name: 'Property Owner' },
  DEALER: { alias: 'dealer', name: 'Property Dealer' },
  BUILDER: { alias: 'builder', name: 'Project Builder' },
  VENDOR: { alias: 'vendor', name: 'Material Vendor' },
  PROFESSIONAL: { alias: 'professional', name: 'Service Professional' },
  WHITE_COLLAR_SEEKER: { alias: 'job-seeker', name: 'Job Seeker' },
  BLUE_COLLAR_WORKER: { alias: 'worker', name: 'Skilled Worker' },
  ADMIN: { alias: 'admin', name: 'Platform Administrator' },
};

const origin = 'http://127.0.0.1:3000';
const accountSchema = z.object({
  role: z.enum(USER_ROLES),
  name: z.string(),
  email: z.string().email(),
  password: z.string().min(24).max(128),
});
type Account = z.infer<typeof accountSchema>;

async function loadAccounts(file: string): Promise<Account[] | null> {
  try {
    const { accounts } = z.object({
      accounts: z.array(accountSchema).length(USER_ROLES.length),
    }).parse(JSON.parse(await readFile(file, 'utf8')));
    if (new Set(accounts.map(({ role }) => role)).size !== USER_ROLES.length) {
      throw new Error('The credentials file must contain one account for every role.');
    }
    return accounts;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function provisionAccounts() {
  const database = new URL(env.DATABASE_URL);
  if (
    env.NODE_ENV === 'production' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname) ||
    database.pathname !== '/the-property-pillar'
  ) {
    throw new Error('Panel accounts can only be created in the local the-property-pillar database.');
  }

  const filename = process.argv[2] ?? 'panel-credentials.json';
  if (basename(filename) !== filename || !/^panel-credentials(?:\.[a-z0-9-]+)?\.json$/.test(filename)) {
    throw new Error('Use panel-credentials.json or panel-credentials.<name>.json.');
  }
  const file = join(fileURLToPath(new URL('../../../../tmp/', import.meta.url)), filename);
  const existingAccounts = await loadAccounts(file);
  const accounts = existingAccounts ?? USER_ROLES.map((role) => ({
    role,
    name: panelNames[role].name,
    email: panelNames[role].alias + '@thepropertypillar.test',
    password: randomBytes(24).toString('base64url'),
  }));

  const tenant = await getOrCreateMarketplaceTenant();
  const existing = await prisma.user.findMany({
    where: { email: { in: accounts.map(({ email }) => email) } },
    select: { email: true, tenantId: true, role: true, status: true, passwordHash: true },
  });
  const usersByEmail = new Map(existing.map((user) => [user.email, user]));
  const newUsers: Prisma.UserCreateManyInput[] = [];

  for (const account of accounts) {
    if (account.email !== panelNames[account.role].alias + '@thepropertypillar.test') {
      throw new Error('A credentials entry uses an unexpected panel email.');
    }
    const user = usersByEmail.get(account.email);
    if (user) {
      if (
        (user.role !== account.role && !(user.role === 'DEALER' && ['BUYER', 'OWNER'].includes(account.role))) || user.tenantId !== tenant.id || user.status !== 'ACTIVE' ||
        !user.passwordHash || !await verifyPassword(account.password, user.passwordHash)
      ) {
        throw new Error(`Existing account ${account.email} does not match the credentials file. No accounts were changed.`);
      }
      continue;
    }
    newUsers.push({
      tenantId: tenant.id,
      email: account.email,
      fullName: account.name,
      passwordHash: await hashPassword(account.password),
      role: account.role,
      status: 'ACTIVE',
    });
  }

  if (!existingAccounts) {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({
      origin,
      loginUrl: origin + '/en/dashboard',
      accounts,
    }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  if (newUsers.length) await prisma.user.createMany({ data: newUsers });
  console.info(`Verified ${accounts.length} panel accounts. Credentials saved to ${file}.`);
}

try {
  await provisionAccounts();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Panel account provisioning failed.');
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
