import type {LucideIcon} from "lucide-react";
import {
  BadgeIndianRupee,
  BriefcaseBusiness,
  Building2,
  CircleGauge,
  ClipboardCheck,
  LifeBuoy,
} from "lucide-react";

export type AdminSection = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  collectionKeys: readonly string[];
  icon: LucideIcon;
};

export const adminSections = [
  {
    id: "admin-overview",
    label: "Operations overview",
    shortLabel: "Overview",
    description: "Review submissions and track marketplace, hiring, commercial and support work.",
    collectionKeys: [],
    icon: CircleGauge,
  },
  {
    id: "admin-review",
    label: "Review & verification",
    shortLabel: "Review queue",
    description: "Review submitted listings, profiles, jobs, projects and campaigns.",
    collectionKeys: ["properties", "dealerProfiles", "materialProducts", "serviceProfiles", "jobs", "workerProfiles", "builderProjects", "adCampaigns"],
    icon: ClipboardCheck,
  },
  {
    id: "admin-marketplace",
    label: "Marketplace operations",
    shortLabel: "Marketplace",
    description: "Manage listings, dealer profiles, projects, material requests and quotes.",
    collectionKeys: ["properties", "dealerProfiles", "builderProjects", "materialProducts", "materialRfqs", "materialQuotes", "propertyInquiries", "savedProperties"],
    icon: Building2,
  },
  {
    id: "admin-hiring",
    label: "Hiring & services",
    shortLabel: "Hiring",
    description: "Find professional and worker profiles, inquiries, jobs and applications.",
    collectionKeys: ["serviceProfiles", "serviceInquiries", "jobs", "jobApplications", "workerProfiles"],
    icon: BriefcaseBusiness,
  },
  {
    id: "admin-commercial",
    label: "Commercial operations",
    shortLabel: "Commercial",
    description: "Track advertising campaigns, property leads and loan inquiries.",
    collectionKeys: ["adCampaigns", "loanInquiries", "propertyInquiries", "materialQuotes"],
    icon: BadgeIndianRupee,
  },
  {
    id: "admin-support",
    label: "Support & redressal",
    shortLabel: "Support",
    description: "Follow up on grievances, member inquiries and buyer alerts.",
    collectionKeys: ["grievances", "propertyInquiries", "serviceInquiries", "loanInquiries", "buyerAlerts"],
    icon: LifeBuoy,
  },
] as const satisfies readonly AdminSection[];

const adminSectionIds = new Set<string>(adminSections.map((section) => section.id));

export function isAdminSection(view: string) {
  return adminSectionIds.has(view);
}

export function getAdminSection(view: string) {
  return adminSections.find((section) => section.id === view) ?? adminSections[0];
}

export function adminStatusLabel(status: string) {
  return status.toLowerCase().replaceAll("_", " ").replace(/^./, (first) => first.toUpperCase());
}

