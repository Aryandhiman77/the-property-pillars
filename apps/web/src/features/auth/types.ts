export const userRoles = [
  "BUYER",
  "OWNER",
  "DEALER",
  "BUILDER",
  "VENDOR",
  "PROFESSIONAL",
  "WHITE_COLLAR_SEEKER",
  "BLUE_COLLAR_WORKER",
  "ADMIN",
] as const;

export type UserRole = (typeof userRoles)[number];

export type AuthSession = {
  role: UserRole;
  name: string;
  logoUrl?: string | null;
};

export type RegisterRole = Exclude<UserRole, "ADMIN">;

export type AccountCredentials = {email: string; password: string};

export type RegistrationInput = AccountCredentials & {
  fullName: string;
  role: RegisterRole;
  mobileCountry?: string;
  mobileNumber?: string;
};

export type EmailVerificationInput = AccountCredentials & {code: string};

