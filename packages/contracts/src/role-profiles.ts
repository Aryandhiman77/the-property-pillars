export type ProfileRole =
  | "BUYER"
  | "OWNER"
  | "DEALER"
  | "BUILDER"
  | "VENDOR"
  | "PROFESSIONAL"
  | "WHITE_COLLAR_SEEKER"
  | "BLUE_COLLAR_WORKER";
export const masterKinds = [
  "COUNTRY",
  "STATE",
  "CITY",
  "LOCALITY",
  "PROPERTY_CATEGORY",
  "PROPERTY_TYPE",
  "AMENITY",
  "PROFESSIONAL_CATEGORY",
  "PROFESSIONAL_SUBCATEGORY",
  "TRADE",
  "MATERIAL_CATEGORY",
  "MATERIAL_SUBCATEGORY",
  "MATERIAL_UNIT",
  "BRAND",
  "JOB_CATEGORY",
  "SKILL",
  "QUALIFICATION",
  "AREA_UNIT",
] as const;
export type MasterKind = (typeof masterKinds)[number];
export const parentKind: Partial<Record<MasterKind, MasterKind>> = {
  STATE: "COUNTRY",
  CITY: "STATE",
  LOCALITY: "CITY",
  PROPERTY_TYPE: "PROPERTY_CATEGORY",
  PROFESSIONAL_SUBCATEGORY: "PROFESSIONAL_CATEGORY",
  MATERIAL_SUBCATEGORY: "MATERIAL_CATEGORY",
};
export type ProfileField = {
  key: string;
  label: string;
  kind:
    | "phone"
    | "language"
    | "many"
    | "masters"
    | "select"
    | "boolean"
    | "number"
    | "currency"
    | "master"
    | "text"
    | "latitude"
    | "longitude"
    | "file"
    | "year"
    | "years"
    | "integer"
    | "long"
    | "url"
    | "date"
    | "languages"
    | "email"
    | "rows"
    | "months";
  required?: boolean;
  options?: string[];
  master?: MasterKind;
  parent?: string;
  fields?: ProfileField[];
  use?: "IMAGE" | "PORTFOLIO" | "DOCUMENT" | "RESUME";
};
export type ProfileSection = { title: string; fields: ProfileField[] };
export const roleSections: Record<ProfileRole, ProfileSection[]> = {
  BUYER: [
    {
      title: "Personal",
      fields: [
        { key: "whatsapp", label: "WhatsApp number", kind: "phone" },
        {
          key: "preferredLanguage",
          label: "Preferred language",
          kind: "language",
        },
      ],
    },
    {
      title: "Property preferences",
      fields: [
        {
          key: "lookingFor",
          label: "Looking for",
          kind: "many",
          required: true,
          options: ["Buy", "Rent", "Lease", "Investment"],
        },
        {
          key: "categories",
          label: "Property categories",
          kind: "masters",
          required: true,
          master: "PROPERTY_CATEGORY",
        },
        {
          key: "types",
          label: "Preferred property types",
          kind: "masters",
          master: "PROPERTY_TYPE",
          parent: "categories",
        },
        {
          key: "configuration",
          label: "Configuration",
          kind: "many",
          options: ["Studio", "1 BHK", "2 BHK", "3 BHK", "4 BHK", "5+ BHK"],
        },
        {
          key: "possession",
          label: "Possession",
          kind: "select",
          options: ["Ready to Move", "Under Construction", "New Launch", "Any"],
        },
        { key: "homeLoan", label: "Need a home loan", kind: "boolean" },
      ],
    },
    {
      title: "Budget",
      fields: [
        { key: "budgetMin", label: "Minimum budget", kind: "number" },
        {
          key: "budgetMax",
          label: "Maximum budget",
          kind: "number",
          required: true,
        },
        {
          key: "currency",
          label: "Currency",
          kind: "currency",
          required: true,
        },
      ],
    },
    {
      title: "Preferred locations",
      fields: [
        {
          key: "country",
          label: "Country",
          kind: "master",
          required: true,
          master: "COUNTRY",
        },
        {
          key: "state",
          label: "State or province",
          kind: "master",
          required: true,
          master: "STATE",
          parent: "country",
        },
        {
          key: "city",
          label: "City",
          kind: "master",
          required: true,
          master: "CITY",
          parent: "state",
        },
        {
          key: "localities",
          label: "Preferred localities",
          kind: "masters",
          master: "LOCALITY",
          parent: "city",
        },
        {
          key: "currentCity",
          label: "Current city",
          kind: "master",
          master: "CITY",
        },
      ],
    },
    {
      title: "Alerts",
      fields: [
        {
          key: "alertChannels",
          label: "Alert preferences",
          kind: "many",
          options: ["Email", "WhatsApp", "SMS"],
        },
      ],
    },
  ],
  OWNER: [
    {
      title: "Ownership",
      fields: [
        {
          key: "ownerType",
          label: "Owner type",
          kind: "select",
          required: true,
          options: [
            "Individual Owner",
            "Joint Owner",
            "Authorized Representative",
          ],
        },
        { key: "whatsapp", label: "WhatsApp number", kind: "phone" },
        {
          key: "preferredLanguage",
          label: "Preferred language",
          kind: "language",
        },
      ],
    },
    {
      title: "Location",
      fields: [
        {
          key: "country",
          label: "Country",
          kind: "master",
          required: true,
          master: "COUNTRY",
        },
        {
          key: "state",
          label: "State or province",
          kind: "master",
          required: true,
          master: "STATE",
          parent: "country",
        },
        {
          key: "city",
          label: "City",
          kind: "master",
          required: true,
          master: "CITY",
          parent: "state",
        },
        {
          key: "locality",
          label: "Locality",
          kind: "master",
          master: "LOCALITY",
          parent: "city",
        },
        { key: "postalCode", label: "Postal code", kind: "text" },
        { key: "address", label: "Formatted address", kind: "text" },
        { key: "latitude", label: "Latitude", kind: "latitude" },
        { key: "longitude", label: "Longitude", kind: "longitude" },
      ],
    },
    {
      title: "Documentation",
      fields: [
        {
          key: "ownershipProof",
          label: "Ownership or authorization proof",
          kind: "file",
          use: "DOCUMENT",
        },
      ],
    },
  ],
  DEALER: [
    {
      title: "Contact person",
      fields: [
        {
          key: "designation",
          label: "Designation",
          kind: "text",
          required: true,
        },
        { key: "whatsapp", label: "WhatsApp number", kind: "phone" },
        {
          key: "preferredLanguage",
          label: "Preferred language",
          kind: "language",
        },
      ],
    },
    {
      title: "Agency",
      fields: [
        {
          key: "agencyName",
          label: "Agency name",
          kind: "text",
          required: true,
        },
        {
          key: "businessType",
          label: "Business type",
          kind: "select",
          required: true,
          options: [
            "Sole Proprietor",
            "Partnership",
            "LLP",
            "Private Limited",
            "Other",
          ],
        },
        { key: "establishedYear", label: "Established year", kind: "year" },
        { key: "yearsExperience", label: "Years of experience", kind: "years" },
        { key: "teamSize", label: "Team size", kind: "integer" },
        { key: "about", label: "About agency", kind: "long" },
        { key: "website", label: "Agency website", kind: "url" },
      ],
    },
    {
      title: "Office",
      fields: [
        {
          key: "country",
          label: "Country",
          kind: "master",
          required: true,
          master: "COUNTRY",
        },
        {
          key: "state",
          label: "State or province",
          kind: "master",
          required: true,
          master: "STATE",
          parent: "country",
        },
        {
          key: "city",
          label: "City",
          kind: "master",
          required: true,
          master: "CITY",
          parent: "state",
        },
        {
          key: "locality",
          label: "Locality",
          kind: "master",
          master: "LOCALITY",
          parent: "city",
        },
        { key: "postalCode", label: "Postal code", kind: "text" },
        { key: "address", label: "Formatted address", kind: "text" },
        { key: "latitude", label: "Latitude", kind: "latitude" },
        { key: "longitude", label: "Longitude", kind: "longitude" },
      ],
    },
    {
      title: "Registration",
      fields: [
        {
          key: "reraRegistered",
          label: "RERA registered",
          kind: "boolean",
          required: true,
        },
        { key: "reraNumber", label: "Registration number", kind: "text" },
        { key: "reraAuthority", label: "Registration authority", kind: "text" },
        { key: "issueDate", label: "Issue date", kind: "date" },
        { key: "expiryDate", label: "Expiry date", kind: "date" },
        {
          key: "reraCertificate",
          label: "RERA certificate",
          kind: "file",
          use: "DOCUMENT",
        },
      ],
    },
    {
      title: "Specializations",
      fields: [
        {
          key: "citiesServed",
          label: "Cities served",
          kind: "masters",
          required: true,
          master: "CITY",
        },
        {
          key: "specializations",
          label: "Specializations",
          kind: "many",
          required: true,
          options: [
            "Residential Sale",
            "Residential Rent",
            "Commercial Sale",
            "Commercial Lease",
            "Plots/Land",
            "Luxury",
            "New Projects",
            "Resale",
            "Industrial",
            "Investment",
          ],
        },
        {
          key: "localitiesServed",
          label: "Localities served",
          kind: "masters",
          master: "LOCALITY",
          parent: "citiesServed",
        },
        {
          key: "propertyTypes",
          label: "Property types",
          kind: "masters",
          master: "PROPERTY_TYPE",
        },
      ],
    },
    {
      title: "Communication",
      fields: [
        { key: "languages", label: "Languages", kind: "languages" },
        {
          key: "workingDays",
          label: "Working days",
          kind: "many",
          options: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ],
        },
        { key: "workingHours", label: "Working hours", kind: "text" },
        {
          key: "contactChannel",
          label: "Preferred contact channel",
          kind: "select",
          options: ["Call", "WhatsApp", "Email", "Platform Enquiry"],
        },
        { key: "facebookUrl", label: "Facebook", kind: "url" },
        { key: "instagramUrl", label: "Instagram", kind: "url" },
        { key: "linkedinUrl", label: "LinkedIn", kind: "url" },
        { key: "youtubeUrl", label: "YouTube", kind: "url" },
        { key: "whatsappchannelUrl", label: "WhatsApp Channel", kind: "url" },
      ],
    },
    {
      title: "Media",
      fields: [
        { key: "logo", label: "Business logo", kind: "file", use: "IMAGE" },
        { key: "cover", label: "Cover photo", kind: "file", use: "IMAGE" },
      ],
    },
  ],
  BUILDER: [
    {
      title: "Company",
      fields: [
        {
          key: "brandName",
          label: "Builder brand name",
          kind: "text",
          required: true,
        },
        {
          key: "legalName",
          label: "Legal company name",
          kind: "text",
          required: true,
        },
        {
          key: "businessType",
          label: "Business type",
          kind: "select",
          options: [
            "Sole Proprietor",
            "Partnership",
            "LLP",
            "Private Limited",
            "Other",
          ],
        },
        { key: "establishedYear", label: "Established year", kind: "year" },
        { key: "about", label: "About company", kind: "long" },
        { key: "website", label: "Website", kind: "url" },
        {
          key: "completedProjects",
          label: "Completed projects",
          kind: "integer",
        },
        { key: "ongoingProjects", label: "Ongoing projects", kind: "integer" },
        { key: "logo", label: "Business logo", kind: "file", use: "IMAGE" },
        { key: "cover", label: "Cover photo", kind: "file", use: "IMAGE" },
      ],
    },
    {
      title: "Representative",
      fields: [
        {
          key: "representative",
          label: "Representative name",
          kind: "text",
          required: true,
        },
        {
          key: "designation",
          label: "Designation",
          kind: "text",
          required: true,
        },
        { key: "contactPhone", label: "Representative phone", kind: "phone" },
        { key: "contactEmail", label: "Representative email", kind: "email" },
        { key: "whatsapp", label: "WhatsApp number", kind: "phone" },
        {
          key: "preferredLanguage",
          label: "Preferred language",
          kind: "language",
        },
      ],
    },
    {
      title: "Registered office",
      fields: [
        {
          key: "country",
          label: "Country",
          kind: "master",
          required: true,
          master: "COUNTRY",
        },
        {
          key: "state",
          label: "State or province",
          kind: "master",
          required: true,
          master: "STATE",
          parent: "country",
        },
        {
          key: "city",
          label: "City",
          kind: "master",
          required: true,
          master: "CITY",
          parent: "state",
        },
        {
          key: "locality",
          label: "Locality",
          kind: "master",
          master: "LOCALITY",
          parent: "city",
        },
        { key: "postalCode", label: "Postal code", kind: "text" },
        { key: "address", label: "Formatted address", kind: "text" },
        { key: "latitude", label: "Latitude", kind: "latitude" },
        { key: "longitude", label: "Longitude", kind: "longitude" },
      ],
    },
    {
      title: "Registration",
      fields: [
        {
          key: "reraRegistered",
          label: "RERA registered",
          kind: "boolean",
          required: true,
        },
        { key: "reraNumber", label: "Registration number", kind: "text" },
        { key: "reraAuthority", label: "Registration authority", kind: "text" },
        { key: "issueDate", label: "Issue date", kind: "date" },
        { key: "expiryDate", label: "Expiry date", kind: "date" },
        {
          key: "reraCertificate",
          label: "RERA certificate",
          kind: "file",
          use: "DOCUMENT",
        },
        {
          key: "companyReference",
          label: "Company registration reference",
          kind: "text",
        },
        { key: "taxReference", label: "GST or tax reference", kind: "text" },
        {
          key: "businessProof",
          label: "Business verification document",
          kind: "file",
          use: "DOCUMENT",
        },
      ],
    },
    {
      title: "Markets",
      fields: [
        {
          key: "countries",
          label: "Countries",
          kind: "masters",
          master: "COUNTRY",
        },
        { key: "states", label: "States", kind: "masters", master: "STATE" },
        {
          key: "cities",
          label: "Cities",
          kind: "masters",
          required: true,
          master: "CITY",
        },
        {
          key: "specializations",
          label: "Project specialization",
          kind: "many",
          required: true,
          options: [
            "Residential",
            "Commercial",
            "Mixed Use",
            "Plotted Development",
            "Industrial",
            "Retail",
            "Hospitality",
            "Other",
          ],
        },
      ],
    },
    {
      title: "Social",
      fields: [
        { key: "facebookUrl", label: "Facebook", kind: "url" },
        { key: "instagramUrl", label: "Instagram", kind: "url" },
        { key: "linkedinUrl", label: "LinkedIn", kind: "url" },
        { key: "youtubeUrl", label: "YouTube", kind: "url" },
        { key: "whatsappchannelUrl", label: "WhatsApp Channel", kind: "url" },
      ],
    },
  ],
  VENDOR: [
    {
      title: "Business",
      fields: [
        {
          key: "businessName",
          label: "Business name",
          kind: "text",
          required: true,
        },
        {
          key: "contactName",
          label: "Contact person",
          kind: "text",
          required: true,
        },
        {
          key: "businessType",
          label: "Business type",
          kind: "select",
          options: [
            "Sole Proprietor",
            "Partnership",
            "LLP",
            "Private Limited",
            "Other",
          ],
        },
        { key: "establishedYear", label: "Established year", kind: "year" },
        { key: "about", label: "About business", kind: "long" },
        { key: "website", label: "Website", kind: "url" },
        { key: "whatsapp", label: "WhatsApp number", kind: "phone" },
        {
          key: "preferredLanguage",
          label: "Preferred language",
          kind: "language",
        },
        { key: "logo", label: "Business logo", kind: "file", use: "IMAGE" },
        { key: "cover", label: "Cover photo", kind: "file", use: "IMAGE" },
      ],
    },
    {
      title: "Address",
      fields: [
        {
          key: "country",
          label: "Country",
          kind: "master",
          required: true,
          master: "COUNTRY",
        },
        {
          key: "state",
          label: "State or province",
          kind: "master",
          required: true,
          master: "STATE",
          parent: "country",
        },
        {
          key: "city",
          label: "City",
          kind: "master",
          required: true,
          master: "CITY",
          parent: "state",
        },
        {
          key: "locality",
          label: "Locality",
          kind: "master",
          master: "LOCALITY",
          parent: "city",
        },
        { key: "postalCode", label: "Postal code", kind: "text" },
        { key: "address", label: "Formatted address", kind: "text" },
        { key: "latitude", label: "Latitude", kind: "latitude" },
        { key: "longitude", label: "Longitude", kind: "longitude" },
      ],
    },
    {
      title: "Supplies",
      fields: [
        {
          key: "categories",
          label: "Material categories supplied",
          kind: "masters",
          required: true,
          master: "MATERIAL_CATEGORY",
        },
        {
          key: "brands",
          label: "Brands supplied",
          kind: "masters",
          master: "BRAND",
        },
      ],
    },
    {
      title: "Delivery",
      fields: [
        {
          key: "delivery",
          label: "Delivery available",
          kind: "boolean",
          required: true,
        },
        {
          key: "deliveryCities",
          label: "Delivery cities",
          kind: "masters",
          master: "CITY",
        },
        { key: "radius", label: "Delivery radius (km)", kind: "number" },
        { key: "minimumOrder", label: "Minimum order", kind: "text" },
        { key: "leadTime", label: "Typical lead time", kind: "text" },
      ],
    },
    {
      title: "Verification",
      fields: [
        {
          key: "businessProof",
          label: "Business verification document",
          kind: "file",
          use: "DOCUMENT",
        },
      ],
    },
  ],
  PROFESSIONAL: [
    {
      title: "Practice",
      fields: [
        {
          key: "practiceName",
          label: "Person or business name",
          kind: "text",
          required: true,
        },
        {
          key: "category",
          label: "Professional category",
          kind: "master",
          required: true,
          master: "PROFESSIONAL_CATEGORY",
        },
        {
          key: "subcategory",
          label: "Subcategory",
          kind: "master",
          master: "PROFESSIONAL_SUBCATEGORY",
          parent: "category",
        },
        { key: "designation", label: "Designation", kind: "text" },
        { key: "about", label: "About the practice", kind: "long" },
        { key: "logo", label: "Business logo", kind: "file", use: "IMAGE" },
        { key: "cover", label: "Cover photo", kind: "file", use: "IMAGE" },
        { key: "whatsapp", label: "WhatsApp number", kind: "phone" },
        {
          key: "preferredLanguage",
          label: "Preferred language",
          kind: "language",
        },
      ],
    },
    {
      title: "Portfolio",
      fields: [
        {
          key: "portfolio",
          label: "Work photos",
          kind: "file",
          use: "PORTFOLIO",
        },
      ],
    },
    {
      title: "Experience",
      fields: [
        {
          key: "yearsExperience",
          label: "Years of experience",
          kind: "years",
          required: true,
        },
        {
          key: "projectsCompleted",
          label: "Projects completed",
          kind: "integer",
        },
        {
          key: "availability",
          label: "Availability",
          kind: "select",
          options: ["Available", "Busy", "By appointment"],
        },
        {
          key: "qualifications",
          label: "Qualifications",
          kind: "rows",
          fields: [
            {
              key: "type",
              label: "Qualification type",
              kind: "master",
              required: true,
              master: "QUALIFICATION",
            },
            {
              key: "institution",
              label: "Institution",
              kind: "text",
              required: true,
            },
            { key: "specialization", label: "Specialization", kind: "text" },
            { key: "year", label: "Year", kind: "year" },
            {
              key: "proof",
              label: "Supporting document",
              kind: "file",
              use: "DOCUMENT",
            },
          ],
        },
        {
          key: "certifications",
          label: "Licenses and certifications",
          kind: "rows",
          fields: [
            {
              key: "type",
              label: "Certificate or license",
              kind: "text",
              required: true,
            },
            { key: "number", label: "Number", kind: "text" },
            { key: "authority", label: "Authority", kind: "text" },
            { key: "issueDate", label: "Issue date", kind: "date" },
            { key: "expiryDate", label: "Expiry date", kind: "date" },
            {
              key: "proof",
              label: "Supporting document",
              kind: "file",
              use: "DOCUMENT",
            },
          ],
        },
      ],
    },
    {
      title: "Service area",
      fields: [
        {
          key: "country",
          label: "Country",
          kind: "master",
          required: true,
          master: "COUNTRY",
        },
        {
          key: "state",
          label: "State or province",
          kind: "master",
          required: true,
          master: "STATE",
          parent: "country",
        },
        {
          key: "citiesServed",
          label: "Cities served",
          kind: "masters",
          required: true,
          master: "CITY",
          parent: "state",
        },
        {
          key: "localitiesServed",
          label: "Localities served",
          kind: "masters",
          master: "LOCALITY",
          parent: "citiesServed",
        },
        { key: "radius", label: "Service radius (km)", kind: "number" },
        { key: "remote", label: "Remote consultation", kind: "boolean" },
      ],
    },
    {
      title: "Contact and social",
      fields: [
        { key: "website", label: "Website", kind: "url" },
        { key: "facebookUrl", label: "Facebook", kind: "url" },
        { key: "instagramUrl", label: "Instagram", kind: "url" },
        { key: "linkedinUrl", label: "LinkedIn", kind: "url" },
        { key: "youtubeUrl", label: "YouTube", kind: "url" },
        { key: "whatsappchannelUrl", label: "WhatsApp Channel", kind: "url" },
      ],
    },
  ],
  WHITE_COLLAR_SEEKER: [
    {
      title: "Career",
      fields: [
        {
          key: "headline",
          label: "Professional headline",
          kind: "text",
          required: true,
        },
        {
          key: "designation",
          label: "Current designation",
          kind: "text",
          required: true,
        },
        { key: "company", label: "Current company", kind: "text" },
        { key: "yearsExperience", label: "Years of experience", kind: "years" },
        { key: "experienceMonths", label: "Additional months", kind: "months" },
        {
          key: "employmentStatus",
          label: "Employment status",
          kind: "select",
          options: ["Employed", "Self-employed", "Seeking work", "Student"],
        },
        { key: "city", label: "Current city", kind: "master", master: "CITY" },
      ],
    },
    {
      title: "Preferences",
      fields: [
        {
          key: "employmentTypes",
          label: "Employment preferences",
          kind: "many",
          required: true,
          options: [
            "Full Time",
            "Part Time",
            "Contract",
            "Freelance",
            "Internship",
          ],
        },
        {
          key: "workModes",
          label: "Work mode",
          kind: "many",
          options: ["On-site", "Hybrid", "Remote"],
        },
        {
          key: "cities",
          label: "Preferred cities",
          kind: "masters",
          master: "CITY",
        },
        {
          key: "categories",
          label: "Job categories",
          kind: "masters",
          master: "JOB_CATEGORY",
        },
        { key: "expectedSalary", label: "Expected salary", kind: "number" },
        { key: "currentSalary", label: "Current salary", kind: "number" },
        { key: "currency", label: "Currency", kind: "currency" },
        {
          key: "salaryPeriod",
          label: "Salary period",
          kind: "select",
          options: ["Monthly", "Annual", "Hourly"],
        },
        { key: "noticePeriod", label: "Notice period", kind: "text" },
        { key: "availableFrom", label: "Available from", kind: "date" },
      ],
    },
    {
      title: "Skills and history",
      fields: [
        {
          key: "skills",
          label: "Skills",
          kind: "rows",
          required: true,
          fields: [
            {
              key: "skill",
              label: "Skill",
              kind: "master",
              required: true,
              master: "SKILL",
            },
            {
              key: "proficiency",
              label: "Proficiency",
              kind: "select",
              options: ["Beginner", "Intermediate", "Advanced", "Expert"],
            },
            {
              key: "yearsExperience",
              label: "Years of experience",
              kind: "years",
            },
          ],
        },
        {
          key: "experience",
          label: "Work experience",
          kind: "rows",
          fields: [
            { key: "company", label: "Company", kind: "text", required: true },
            {
              key: "designation",
              label: "Designation",
              kind: "text",
              required: true,
            },
            {
              key: "employmentType",
              label: "Employment type",
              kind: "select",
              options: [
                "Full Time",
                "Part Time",
                "Contract",
                "Freelance",
                "Internship",
              ],
            },
            { key: "location", label: "Location", kind: "text" },
            { key: "startDate", label: "Start date", kind: "date" },
            { key: "endDate", label: "End date", kind: "date" },
            { key: "current", label: "Current position", kind: "boolean" },
            { key: "description", label: "Description", kind: "long" },
          ],
        },
        {
          key: "qualifications",
          label: "Qualifications",
          kind: "rows",
          fields: [
            {
              key: "type",
              label: "Qualification type",
              kind: "master",
              required: true,
              master: "QUALIFICATION",
            },
            {
              key: "institution",
              label: "Institution",
              kind: "text",
              required: true,
            },
            { key: "specialization", label: "Specialization", kind: "text" },
            { key: "year", label: "Year", kind: "year" },
            {
              key: "proof",
              label: "Supporting document",
              kind: "file",
              use: "DOCUMENT",
            },
          ],
        },
        {
          key: "certifications",
          label: "Licenses and certifications",
          kind: "rows",
          fields: [
            {
              key: "type",
              label: "Certificate or license",
              kind: "text",
              required: true,
            },
            { key: "number", label: "Number", kind: "text" },
            { key: "authority", label: "Authority", kind: "text" },
            { key: "issueDate", label: "Issue date", kind: "date" },
            { key: "expiryDate", label: "Expiry date", kind: "date" },
            {
              key: "proof",
              label: "Supporting document",
              kind: "file",
              use: "DOCUMENT",
            },
          ],
        },
      ],
    },
    {
      title: "Resume and privacy",
      fields: [
        {
          key: "resume",
          label: "Current resume",
          kind: "file",
          required: true,
          use: "RESUME",
        },
        { key: "searchable", label: "Employer searchable", kind: "boolean" },
        {
          key: "contactVisibility",
          label: "Contact visibility",
          kind: "select",
          options: ["Private", "After application"],
        },
        {
          key: "resumeVisibility",
          label: "Resume visibility",
          kind: "select",
          options: ["Private", "After application"],
        },
      ],
    },
  ],
  BLUE_COLLAR_WORKER: [
    {
      title: "Trade and rate",
      fields: [
        {
          key: "trade",
          label: "Primary trade",
          kind: "master",
          required: true,
          master: "TRADE",
        },
        { key: "rate", label: "Rate amount", kind: "number", required: true },
        {
          key: "currency",
          label: "Currency",
          kind: "currency",
          required: true,
        },
        {
          key: "availability",
          label: "Availability",
          kind: "select",
          required: true,
          options: ["Available Now", "Busy", "Available From Date"],
        },
        {
          key: "rateType",
          label: "Rate type",
          kind: "select",
          options: ["Hourly", "Daily", "Weekly", "Per Job", "Negotiable"],
        },
        { key: "availableFrom", label: "Available from", kind: "date" },
      ],
    },
    {
      title: "Experience",
      fields: [
        {
          key: "skillLevel",
          label: "Skill level",
          kind: "select",
          required: true,
          options: ["Helper", "Semi-Skilled", "Skilled", "Expert / Supervisor"],
        },
        { key: "yearsExperience", label: "Years of experience", kind: "years" },
        {
          key: "additionalTrades",
          label: "Additional trades",
          kind: "masters",
          master: "TRADE",
        },
        {
          key: "workPreference",
          label: "Work preferences",
          kind: "many",
          options: [
            "Residential",
            "Commercial",
            "Construction Site",
            "Renovation",
            "Maintenance",
            "Industrial",
          ],
        },
        { key: "ownTools", label: "Own tools", kind: "boolean" },
        { key: "ownVehicle", label: "Own vehicle", kind: "boolean" },
      ],
    },
    {
      title: "Service area",
      fields: [
        { key: "country", label: "Country", kind: "master", master: "COUNTRY", required: true },
        { key: "state", label: "State", kind: "master", master: "STATE", parent: "country", required: true },
        { key: "city", label: "City", kind: "master", master: "CITY", parent: "state", required: true },
        {
          key: "localities",
          label: "Localities",
          kind: "masters",
          master: "LOCALITY",
          parent: "city",
        },
        { key: "radius", label: "How far can you travel for work? (km)", kind: "number" },
        { key: "travel", label: "Willing to travel", kind: "boolean" },
      ],
    },
    {
      title: "Contact and portfolio",
      fields: [
        { key: "whatsapp", label: "WhatsApp number", kind: "phone" },
        {
          key: "preferredLanguage",
          label: "Preferred language",
          kind: "language",
        },
        { key: "languages", label: "Languages", kind: "languages" },
        {
          key: "channels",
          label: "Contact preferences",
          kind: "many",
          options: ["Call", "WhatsApp", "Platform Enquiry"],
        },
        {
          key: "portfolio",
          label: "Work portfolio photo",
          kind: "file",
          use: "PORTFOLIO",
        },
      ],
    },
  ],
};
