import type { Prisma } from "@prisma/client";
import {
  normalizeContactPhone,
  propertyListingSource,
} from "@the-property-pillar/contracts";
import { publicBusinessProfiles } from "../profiles/public.js";
import { workspacePrisma } from "./db.js";

type Contact = { phone?: string; whatsapp?: string };
type ListingFields = {
  id: string;
  city: string | null;
  locality: string | null;
  intent: string | null;
  contactPhone: unknown;
  whatsappPhone: unknown;
  shareContactWithEnquirers: unknown;
  contacts: unknown;
  office: {address?:string; registered?:boolean; mapUrl?:string; embed?:string; coordinates?:number[]; website?:string; email?:string} | null;
  cover: string | null;
  title: string;
};
const phone = (v: unknown) =>
  typeof v === "string" ? normalizeContactPhone(v) || undefined : undefined;
const international = (v: unknown) => {
  const n = phone(v);
  return n && /^\+[1-9]\d{6,14}$/.test(n) ? n : undefined;
};

function sourcedBusinessContact(ownerId: string, contacts: unknown): Contact {
  if (!Array.isArray(contacts)) return {};
  // The import records contacts for several businesses on the same listing. Match the actual publisher.
  const match = contacts.find(
    (entry) =>
      entry &&
      typeof entry.profileId === "string" &&
      "seed-account-" + entry.profileId === ownerId &&
      Array.isArray(entry.evidence) &&
      entry.evidence.length,
  );
  return {
    phone: phone(match?.phone) ?? phone(match?.mobileNumber),
    whatsapp: international(match?.whatsappPhone),
  };
}

export function listingContactChannels(
  ownerId: string,
  data: {
    contactPhone?: unknown;
    whatsappPhone?: unknown;
    shareContactWithEnquirers?: unknown;
  },
  contacts: unknown,
  enquired: boolean,
): Contact {
  if (data.shareContactWithEnquirers === false) return {};
  const sourced = sourcedBusinessContact(ownerId, contacts);
  const shared = enquired && data.shareContactWithEnquirers === true;
  return {
    phone: sourced.phone || (shared ? phone(data.contactPhone) : undefined),
    whatsapp:
      sourced.whatsapp ||
      (shared ? international(data.whatsappPhone) : undefined),
  };
}

export async function sharedBusinessContact(
  tenantId: string,
  ownerId: string,
  db: Prisma.TransactionClient = workspacePrisma,
): Promise<Contact> {
  const dealer = await db.workspaceItem.findFirst({
    where: {
      tenantId,
      ownerId,
      collection: "DEALER_PROFILES",
      status: "VERIFIED",
      publicAt: { not: null },
      data: { path: ["publicContactConsent"], equals: true },
    },
    orderBy: { publicAt: "desc" },
    select: { data: true },
  });
  const data = dealer?.data;
  if (!data || Array.isArray(data) || typeof data !== "object") return {};
  return {
    phone: phone(data.phone),
    whatsapp: international(data.whatsappPhone),
  };
}

export async function listingProfile(tenantId: string, ownerId: string) {
  const owner = await workspacePrisma.user.findFirst({
    where: {
      tenantId,
      id: ownerId,
      status: "ACTIVE",
      ownedItems: {
        some: {
          tenantId,
          collection: "PROPERTIES",
          status: "PUBLISHED",
          publicAt: { not: null },
        },
      },
    },
    select: {
      fullName: true,
      role: true,
      profileLogoUrl: true,
      featuredAt:true,
      aboutMe: true,
      createdAt: true,
    },
  });
  if (!owner) return null;
  const [rows, businesses, businessContact] = await Promise.all([
    workspacePrisma.$queryRaw<ListingFields[]>`
      SELECT id, title, data->'mediaUrls'->>0 AS cover, data->>'city' AS city, data->>'locality' AS locality, data->>'listingIntent' AS intent,
        data->'contactPhone' AS "contactPhone", data->'whatsappPhone' AS "whatsappPhone", data->'shareContactWithEnquirers' AS "shareContactWithEnquirers",
        data#>'{sourceListing,relatedBusinessContacts}' AS contacts, data#>'{sourceListing,publisherOffice}' AS office
      FROM "WorkspaceItem" WHERE "tenantId" = ${tenantId} AND "ownerId" = ${ownerId}
        AND collection = 'PROPERTIES' AND status = 'PUBLISHED' AND "publicAt" IS NOT NULL
      ORDER BY "publicAt" DESC, id DESC`,
    publicBusinessProfiles(
      tenantId,
      owner.role === "BUILDER" ? "builderProjects" : "dealerProfiles",
      [ownerId],
    ),
    sharedBusinessContact(tenantId, ownerId),
  ]);
  const first = rows[0];
  if (!first) return null;
  const choices = rows.map((row) => {
    const channels = listingContactChannels(ownerId, row, row.contacts, true);
    const direct = listingContactChannels(ownerId, row, row.contacts, false);
    return {
      id: row.id,
      masked: (businessContact.phone || channels.phone)?.replace(/\d(?=\d{3})/g,"*"),
      phone: Boolean(businessContact.phone || channels.phone),
      whatsapp: Boolean(businessContact.whatsapp || channels.whatsapp),
      phoneEnquiry: Boolean(
        channels.phone && !businessContact.phone && !direct.phone,
      ),
      whatsappEnquiry: Boolean(
        channels.whatsapp && !businessContact.whatsapp && !direct.whatsapp,
      ),
    };
  });
  const contact =
    choices.find((c) => c.phone && c.whatsapp) ??
    choices.find((c) => c.phone || c.whatsapp) ??
    choices[0]!;
  const business = businesses.get(ownerId);
  const unique = (values: (string | null)[]) => [
    ...new Set(values.filter((v): v is string => Boolean(v?.trim()))),
  ];
  return {
    verified: Boolean(business),
    featured:Boolean(owner.featuredAt),
    name: business?.name || owner.fullName,
    representative: owner.fullName,
    role: propertyListingSource(owner.role),
    logo: business?.logo || owner.profileLogoUrl,
    about: business?.about || owner.aboutMe,
    website: business?.website || first.office?.website,
    office: business?.office?.address && business.office.address !== first.office?.address
      ? business.office : first.office || business?.office,
    businessEmail: first.office?.email,
    gallery: rows.flatMap(row => row.cover ? [{url:row.cover,title:row.title}] : []).slice(0,8),
    memberSince: owner.createdAt,
    cities: unique(rows.map((r) => r.city)),
    localities: unique(rows.map((r) => r.locality)),
    specializations: business?.specializations ?? [],
    total: rows.length,
    sale: rows.filter((r) => r.intent === "SALE").length,
    rent: rows.filter((r) => r.intent === "RENT" || r.intent === "LEASE")
      .length,
    contact,
  };
}
