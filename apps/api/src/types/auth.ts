export const USER_ROLES = [
  'BUYER',
  'OWNER',
  'DEALER',
  'BUILDER',
  'VENDOR',
  'PROFESSIONAL',
  'WHITE_COLLAR_SEEKER',
  'BLUE_COLLAR_WORKER',
  'ADMIN',
] as const;

export type AppRole = (typeof USER_ROLES)[number];

export const SELF_REGISTERABLE_ROLES = USER_ROLES.filter(
  (role): role is Exclude<AppRole, 'ADMIN'> => role !== 'ADMIN',
);

export interface AuthSessionContext {
  sessionId: string;
  userId: string;
  tenantId: string;
  role: AppRole;
  name: string;
  logoUrl?: string;
}
