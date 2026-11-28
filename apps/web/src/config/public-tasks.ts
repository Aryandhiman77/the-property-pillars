export const publicTasks = {
  "post-property": {collection: "properties", title: "listProperty", action: "Submit listing", directory: "properties"},
  "properties/enquire": {collection: "propertyInquiries", title: "propertyEnquiry", action: "Send enquiry", directory: "properties"},
  "properties/save-search": {collection: "buyerAlerts", title: "savePropertySearch", action: "Save search", directory: "properties"},
  "materials/request-quote": {collection: "materialRfqs", title: "requestMaterials", action: "Request quotes", directory: "materials"},
  "materials/add-product": {collection: "materialProducts", title: "addProduct", action: "Submit product", directory: "materials"},
  "professionals/request": {collection: "serviceInquiries", title: "requestService", action: "Send service request", directory: "professionals"},
  "professionals/register": {collection: "serviceProfiles", title: "registerProfessional", action: "Submit professional profile", directory: "professionals"},
  "jobs/apply": {collection: "jobApplications", title: "applyJob", action: "Submit application", directory: "jobs"},
  "workers/register": {collection: "workerProfiles", title: "registerWorker", action: "Submit worker profile", directory: "workers"},
  "dealers/register": {collection: "dealerProfiles", title: "registerDealer", action: "Submit dealer profile", directory: "dealers"},
  "projects/new": {collection: "builderProjects", title: "submitProject", action: "Submit project", directory: "projects"},
  "finance-services/apply": {collection: "loanInquiries", title: "loanEnquiry", action: "Send loan enquiry", directory: "finance-services"},
  "support/report": {collection: "grievances", title: "reportProblem", action: "Submit report", directory: null},
} as const;

export type PublicTaskPath = keyof typeof publicTasks;

export function isPublicTask(path: string): path is PublicTaskPath {
  return Object.hasOwn(publicTasks, path);
}

export function publicTaskHref(locale: string, path: PublicTaskPath, params?: URLSearchParams) {
  return `/${locale}/${path}${params?.size ? `?${params}` : ""}`;
}

export function propertyEnquiryHref(locale: string, id: string) {
  return `/${locale}/properties/${encodeURIComponent(id)}?${new URLSearchParams({enquire: id})}#property-actions`;
}

export function professionalEnquiryHref(locale: string, id: string) {
  return `/${locale}/professionals/${encodeURIComponent(id)}?${new URLSearchParams({enquire: id})}`;
}

export const directoryTasks: Partial<Record<string, readonly PublicTaskPath[]>> = {
  properties: ["post-property", "properties/save-search"],
  materials: ["materials/request-quote", "materials/add-product"],
  professionals: ["professionals/register"],
  jobs: ["jobs/apply"],
  workers: ["workers/register"],
  dealers: ["dealers/register"],
  projects: ["projects/new"],
  "finance-services": ["finance-services/apply"],
};
