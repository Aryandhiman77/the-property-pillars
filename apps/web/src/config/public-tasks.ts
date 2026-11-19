export const publicTasks = {
  "post-property": {collection: "properties", title: "List a property", action: "Submit listing", directory: "properties"},
  "properties/enquire": {collection: "propertyInquiries", title: "Enquire about a property or project", action: "Send enquiry", directory: "properties"},
  "properties/save-search": {collection: "buyerAlerts", title: "Save a property search", action: "Save search", directory: "properties"},
  "materials/request-quote": {collection: "materialRfqs", title: "Request material quotes", action: "Request quotes", directory: "materials"},
  "materials/add-product": {collection: "materialProducts", title: "Add a supplier product", action: "Submit product", directory: "materials"},
  "professionals/request": {collection: "serviceInquiries", title: "Request a professional service", action: "Send service request", directory: "professionals"},
  "professionals/register": {collection: "serviceProfiles", title: "Register as a professional", action: "Submit professional profile", directory: "professionals"},
  "jobs/post": {collection: "jobs", title: "Post a job", action: "Submit job", directory: "jobs"},
  "jobs/apply": {collection: "jobApplications", title: "Apply for a job", action: "Submit application", directory: "jobs"},
  "workers/register": {collection: "workerProfiles", title: "Register as a skilled worker", action: "Submit worker profile", directory: "workers"},
  "dealers/register": {collection: "dealerProfiles", title: "Register as a property dealer", action: "Submit dealer profile", directory: "dealers"},
  "projects/new": {collection: "builderProjects", title: "Submit a builder project", action: "Submit project", directory: "projects"},
  "finance-services/apply": {collection: "loanInquiries", title: "Submit a loan enquiry", action: "Send loan enquiry", directory: "finance-services"},
  "support/report": {collection: "grievances", title: "Report a problem", action: "Submit report", directory: null},
} as const;

export type PublicTaskPath = keyof typeof publicTasks;

export function isPublicTask(path: string): path is PublicTaskPath {
  return Object.hasOwn(publicTasks, path);
}

export function publicTaskHref(locale: string, path: PublicTaskPath, params?: URLSearchParams) {
  return `/${locale}/${path}${params?.size ? `?${params}` : ""}`;
}

export const directoryTasks: Partial<Record<string, readonly PublicTaskPath[]>> = {
  properties: ["post-property", "properties/save-search", "properties/enquire"],
  materials: ["materials/request-quote", "materials/add-product"],
  professionals: ["professionals/request", "professionals/register"],
  jobs: ["jobs/post", "jobs/apply"],
  workers: ["workers/register"],
  dealers: ["dealers/register"],
  projects: ["projects/new"],
  "finance-services": ["finance-services/apply"],
};
