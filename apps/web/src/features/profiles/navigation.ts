import type { ProfileRole } from "@the-property-pillar/contracts";
export const profileMenu: Record<ProfileRole, [string, string][]> = {
  BUYER: [
    ["savedProperties", "Saved properties"],
    ["propertyInquiries", "Enquiries"],
    ["visits", "Site visits"],
    ["buyerAlerts", "Alerts"],
  ],
  OWNER: [
    ["properties", "My properties"],
    ["propertyInquiries", "Enquiries"],
    ["billing", "Promotions"],
  ],
  DEALER: [
    ["properties", "Properties"],
    ["propertyInquiries", "Enquiries"],
    ["visits", "Site visits"],
    ["billing", "Promotions"],
  ],
  BUILDER: [
    ["builderProjects", "Projects"],
    ["project-inventory", "Unit inventory"],
    ["properties", "Property listings"],
    ["visits", "Site visits"],
    ["propertyInquiries", "Enquiries"],
    ["billing", "Promotions"],
  ],
  VENDOR: [
    ["materialProducts", "Products"],
    ["materialRfqs", "RFQs"],
    ["materialQuotes", "Quotes"],
    ["billing", "Promotions"],
  ],
  PROFESSIONAL: [
    ["serviceProfiles", "Services"],
    ["serviceInquiries", "Enquiries"],
    ["portfolio", "Portfolio"],
    ["billing", "Promotions"],
  ],
  WHITE_COLLAR_SEEKER: [
    ["find-jobs", "Find jobs"],
    ["jobApplications", "Applications"],
    ["saved-jobs", "Saved jobs"],
  ],
  BLUE_COLLAR_WORKER: [
    ["serviceInquiries", "Work enquiries"],
    ["jobApplications", "Jobs / Applications"],
    ["portfolio", "Portfolio"],
  ],
};
