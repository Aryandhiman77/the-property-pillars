import type { ProfileRole } from "@the-property-pillar/contracts";
export const profileMenu: Record<ProfileRole, [string, string][]> = {
  BUYER: [
    ["properties", "My properties"],
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
    ["properties", "My properties"],
    ["materialProducts", "Products"],
    ["materialRfqs", "RFQs"],
    ["materialQuotes", "Quotes"],
    ["billing", "Promotions"],
  ],
  PROFESSIONAL: [
    ["properties", "My properties"],
    ["serviceProfiles", "Services"],
    ["serviceInquiries", "Enquiries"],
    ["portfolio", "Portfolio"],
    ["billing", "Promotions"],
  ],
  WHITE_COLLAR_SEEKER: [
    ["properties", "My properties"],
    ["find-jobs", "Find jobs"],
    ["jobApplications", "Applications"],
    ["saved-jobs", "Saved jobs"],
  ],
  BLUE_COLLAR_WORKER: [
    ["properties", "My properties"],
    ["serviceInquiries", "Work enquiries"],
    ["jobApplications", "Jobs / Applications"],
    ["portfolio", "Portfolio"],
  ],
};
