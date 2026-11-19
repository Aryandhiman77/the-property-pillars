import type {LucideIcon} from "lucide-react";

import type {UserRole} from "@/features/auth/types";

export type WorkspaceItem = {
  id: string;
  title: string;
  status: string;
  description?: string | null;
  data: Record<string, unknown>;
  allowedNextStatuses?: string[];
  canEditContent?: boolean;
  latestReview?: {status: string; note: string; decidedAt: string};
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceCollection = {
  key: string;
  label: string;
  items: WorkspaceItem[];
};

export type Workspace = {
  role: UserRole;
  name: string;
  collections: WorkspaceCollection[];
};

export type MetricDefinition = {
  label: string;
  hint: string;
  collectionKeys?: string[];
  statuses?: string[];
  icon: LucideIcon;
};

export type RoleConfig = {
  role: UserRole;
  label: string;
  shortLabel: string;
  description: string;
  workspaceTitle: string;
  workspaceDescription: string;
  primaryCollection: string;
  primaryAction: string;
  emptyTitle: string;
  emptyDescription: string;
  notificationsEmpty: string;
  icon: LucideIcon;
  metrics: MetricDefinition[];
  collectionOrder: string[];
};

export type FieldOption = {label: string; value: string};

export type FieldDescriptor = {
  key: string;
  label: string;
  type: "text" | "tel" | "email" | "number" | "select" | "date" | "datetime" | "url" | "toggle" | "list" | "postal-code" | "image" | "images" | "resume" | "delivery-city" | "delivery-cities";
  maxFiles?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  required?: boolean;
  options?: FieldOption[];
  wide?: boolean;
};

export type CollectionDescriptor = {
  key: string;
  label: string;
  singular: string;
  description: string;
  createLabel: string;
  createEnabled: boolean;
  createRoles: UserRole[];
  fields: FieldDescriptor[];
  statuses: string[];
};

