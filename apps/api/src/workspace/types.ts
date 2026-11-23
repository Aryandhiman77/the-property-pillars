import type {Request} from "express";

export const USER_ROLES = [
  "BUYER",
  "OWNER",
  "DEALER",
  "BUILDER",
  "VENDOR",
  "PROFESSIONAL",
  "WHITE_COLLAR_SEEKER",
  "BLUE_COLLAR_WORKER",
  "ADMIN"
] as const;

export type UserRoleValue = (typeof USER_ROLES)[number];

export type WorkspaceSession = {
  sessionId: string;
  userId: string;
  tenantId: string;
  role: UserRoleValue;
  name: string;
};

export type WorkspaceRequest = Request & {session?: WorkspaceSession};

export type WorkspaceItemDto = {
  id: string;
  title: string;
  status: string;
  description: string | null;
  data: Record<string, unknown>;
  featured?: boolean;
  featuredOrder?: number | null;
  allowedNextStatuses?: string[];
  canEditContent?: boolean;
  latestReview?: {
    status: string;
    note: string;
    decidedAt: string;
  };
  createdAt: string;
  updatedAt: string;
};
