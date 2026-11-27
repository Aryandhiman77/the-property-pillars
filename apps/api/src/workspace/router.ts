import {lockFeaturedOrder,shiftFeaturedOrder} from './featured-order.js';
import {propertyCompletion} from "@the-property-pillar/contracts";
import {publicBusinessProfiles} from "../profiles/public.js";
import {Prisma, WorkspaceCollection, type EntitlementType} from "@prisma/client";
import {Router, type NextFunction, type Response} from "express";
import {z} from "zod";
import {AREA_UNITS, constructionStatuses, paidFeatureCollections, materialCategories, materialOptionValue, normalizeContactPhone, propertyBudgetTiers, propertyCategoryCards, propertyGalleryLimit, propertyGalleryUrls, propertyPosterRoles, propertyTypeKey, siteLocales, workspaceSubmissionStatuses} from "@the-property-pillar/contracts";
import {env} from "../config/env.js";
import {sendFailure, sendSuccess} from "../helpers/api-response.js";
import {requireSession as requireSessionMiddleware} from "../middleware/session.middleware.js";
import {
  collectionConfigs,
  collectionSchemas,
  deliveryCityId,
  propertyInputKeys, propertyAmenitySchema,
  publicAliasToCollection,
  type CollectionConfig,
  type CollectionKey
} from "./config.js";
import {requireConfirmedListingRole} from "./role-reviews.js";
import {ensureProfile} from "../profiles/profile.js";
import {projectFromWorkspace} from "../projects/workspace-bridge.js";
import {checkLinkedProperty} from "../projects/inventory.js";
import {syncRequest,syncQuote} from "../materials/requests.js";
import {syncMaterialProduct} from "../materials/product.js";
import {syncProperty,validateSpecifications} from "../properties/domain.js";
import {ensureCatalog} from "../profiles/masters.js";
import {recordPropertyPost} from "../billing/listing-plans.js";
import {workspacePrisma} from "./db.js";
import {resolveJobLocation} from "./job-location.js";
import {findDeliveryCities, getDeliveryCity} from "../locations/delivery-cities.js";
import {prepareMaterialData, quotingRfqStatuses, vendorRfqIds} from "./material-matching.js";
import {applyCatalogLocation, defaultListingCountry, listingCountry, listingCurrency, validateListingPostalCode} from "./listing-geography.js";
import {areaContainsLandmark, nearbyLandmarks, propertyNearbyArea} from "./property-nearby.js";
import {propertySuggestions} from "./property-suggestions.js";
import {propertyViewCounts} from "./property-views.js";
import {publicPropertyPosters} from "./property-posters.js";
import {normalizePropertyKitchen} from "./property-content.js";
import {mapLocationSchema} from "./map-location.js";
import {squareFeet,directoryFacets, placeFilter, placeQuery, propertyBudgetFilter, propertyPricePerSqft, propertyTypeFilter} from "./search-filters.js";
import {assertResumeUploaded} from "../uploads/resumes.js";
import {validateImageAttachments} from "../uploads/images.js";
import {manualJobReview, reviewJobPublication} from "./job-publication.js";
import {moderateListing} from "./listing-moderation.js";
import {enquiryAccess, readLeadIdentity} from "../services/lead-identity.js";
import {hasPropertyLead} from "./property-reports.js";
import type {WorkspaceItemDto, WorkspaceRequest, WorkspaceSession} from "./types.js";
import {
  deriveTrustedData,
  jobAcceptsApplications,
  validateCollectionConsistency,
  validateNewSubmission,
  validateTransitionReadiness
} from "./validation.js";

const router: Router = Router();
const directoryFeatures = new Set<CollectionKey>(paidFeatureCollections);
const leadCollections = new Set<CollectionKey>(["propertyInquiries", "loanInquiries", "materialRfqs", "serviceInquiries"]);

const publicBenefits: Partial<Record<CollectionKey, EntitlementType>> = {
  adCampaigns: "BUILDER_AD_CAMPAIGN",
  dealerProfiles: "DEALER_PRO",
  jobs: "FEATURED_JOB_BOOST"
};

function activeBenefit(tenantId: string, type: EntitlementType, now: Date) {
  return {
    tenantId, type, status: "ACTIVE" as const, startsAt: {lte: now}, endsAt: {gt: now}, revokedAt: null
  };
}

const createBodySchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(5000).optional(),
    requestId: z.string().uuid().optional(),
    locale: z.enum(siteLocales).optional(),
    status: z.enum(["PENDING_REVIEW", "PENDING_VERIFICATION", "OPEN"]).optional(),
    data: z.record(z.string(), z.unknown()).optional()
  })
  .strict();

const patchBodySchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: z.string().trim().min(1).max(50).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    expectedUpdatedAt: z.string().datetime().optional(),
    manualReview: manualJobReview.optional(),
    reviewNote: z.string().trim().max(1000).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one change is required");

const publicQuerySchema = z.object({
  city: z.string().trim().max(120).optional(),
  cityId: deliveryCityId.optional(),
  location: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().max(100).optional(),
  country: listingCountry.optional(),
  nearCountry: listingCountry.optional(),
  landmarkFrom: z.string().min(1).max(80).optional(),
  landmark: z.string().trim().min(1).max(120).optional(),
  landmarkKind: z.string().regex(/^[A-Z_]{2,20}$/).optional(),
  propertyType: z.string().trim().max(80).optional(),
  types: z.string().max(400).transform((value) => value.split(",")).pipe(z.array(z.string().regex(/^[A-Z_]{2,40}$/)).max(20)).optional(),
  segment: z.enum(["RESIDENTIAL", "COMMERCIAL", "PLOT_LAND"]).optional(),
  locationKind: z.enum(["state", "city", "locality"]).optional(),
  minPrice: z.coerce.number().nonnegative().max(1e15).optional(),
  maxPrice: z.coerce.number().nonnegative().max(1e15).optional(),
  currency: listingCurrency.optional(),
  bedrooms: z.enum(["0", "1", "2", "3", "4", "5+"]).optional(),
  construction: z.enum(constructionStatuses).optional(),
  ...propertyAmenitySchema.shape,
  postedBy: z.enum(propertyPosterRoles).optional(),
  dealer: z.string().trim().min(1).max(160).optional(),
  intent: z.enum(["SALE", "RENT","LEASE"]).optional(),
  acceptingApplications: z.literal("1").optional(),
  featured: z.literal("1").optional(),
  budget: z.enum(propertyBudgetTiers).optional(),
  q: z.string().trim().max(120).optional(),
  nearCity: z.string().trim().min(1).max(120).optional(),
  nearArea: z.string().trim().min(1).max(120).optional(),
  nearState: z.string().trim().min(1).max(120).optional(),
  item: z.string().trim().min(1).max(160).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  place: placeQuery,
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  amenity: z.string().max(600).regex(/^[A-Z0-9_,]+$/).optional(),
  verifiedSeller:z.literal("1").optional(),possessionBy:z.string().date().optional(),floor:z.coerce.number().int().min(0).max(250).optional(),
  sort: z.enum(["match", "newest", "price-low", "price-high","area-low","area-high"]).default("match"),
  minArea: z.coerce.number().nonnegative().max(1e9).optional(),
  maxArea: z.coerce.number().nonnegative().max(1e9).optional(),
  unit: z.enum(AREA_UNITS).optional(),
  rera: z.literal("1").optional(),
  relatedTo: z.string().min(1).max(80).optional(),
  scope: z.enum(["legal-vastu", "building-services"]).optional(),
  brand: z.string().trim().max(120).optional(),
  availability: z.string().trim().max(60).optional(),
  serviceType: z.string().trim().max(100).optional(),
  trade: z.string().trim().max(100).optional(),
  projectType: z.string().trim().max(100).optional(),
  employment: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"]).optional(),
  workMode: z.enum(["ON_SITE", "HYBRID", "REMOTE"]).optional(),
  experience: z.coerce.number().int().min(0).max(80).optional(),
}).refine(({minPrice, maxPrice}) => minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice, {
  path: ["maxPrice"], message: "Maximum budget must be at least the minimum budget."
});

class WorkspaceHttpError extends Error {
  constructor(public readonly statusCode: number, message: string, public readonly field?: string) {
    super(message);
  }
}

const explicitlyNullable = new Set(["postalCode", "state", "locality", "cityId", "logoUrl", "coverUrl", "kitchenType"]);
const singleProfiles = new Set<CollectionKey>(["dealerProfiles", "serviceProfiles", "workerProfiles"]);
const uniqueRelatedRecords: Partial<Record<CollectionKey, {field: string; message: string}>> = {
  savedProperties: {field: "propertyId", message: "This property is already saved."},
  jobApplications: {field: "jobId", message: "You already applied for this job."},
  materialQuotes: {field: "rfqId", message: "You already have a quote for this RFQ."}
};

async function ensureUniqueSubmission(
  tx: Prisma.TransactionClient, config: CollectionConfig, session: WorkspaceSession, parentId: string | null, currentId?: string
) {
  const profile = singleProfiles.has(config.key);
  const related = uniqueRelatedRecords[config.key];
  if (!profile && (!related || !parentId)) return;
  // Use the same transaction lock for new submissions and reactivating saved records.
  const lock = JSON.stringify([session.tenantId, session.userId, config.key, profile ? null : parentId]);
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${lock}, 0))`;
  const existing = await tx.workspaceItem.findFirst({
    where: {
      tenantId: session.tenantId, ownerId: session.userId, collection: config.dbCollection as WorkspaceCollection,
      ...(currentId && {id: {not: currentId}}),
      ...(profile ? {status: {not: "ARCHIVED"}} : {parentId, status: {notIn: ["ARCHIVED", "WITHDRAWN"]}})
    },
    select: {id: true}
  });
  if (!existing) return;
  if (related) throw new WorkspaceHttpError(409, related.message, related.field);
  throw new WorkspaceHttpError(409, "Open your existing profile to update or resubmit it.");
}

function mergeInput(current: Record<string, unknown>, patch: Record<string, unknown>) {
  const merged = {...current, ...patch};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null && !explicitlyNullable.has(key)) merged[key] = undefined;
  }
  return merged;
}

const asyncRoute =
  (handler: (req: WorkspaceRequest, res: Response) => Promise<void>) =>
  (req: WorkspaceRequest, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };

function getSession(req: WorkspaceRequest): WorkspaceSession {
  if (!req.session) throw new WorkspaceHttpError(401, "Authentication is required");
  return req.session;
}

function requireConfig(rawKey: string): CollectionConfig {
  const config = Object.hasOwn(collectionConfigs, rawKey) ? collectionConfigs[rawKey as CollectionKey] : undefined;
  if (!config) throw new WorkspaceHttpError(404, "Unknown workspace collection");
  return config;
}

function routeParam(value: string | string[] | undefined, name: string) {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized) throw new WorkspaceHttpError(400, `Missing route parameter: ${name}`);
  return normalized;
}

function asJsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asInputJson(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function reviewNoteFromMetadata(value: Prisma.JsonValue) {
  const metadata = asJsonObject(value);
  return typeof metadata.reviewNote === "string" && metadata.reviewNote.trim()
    ? metadata.reviewNote
    : null;
}

async function latestReviewsFor(
  tenantId: string,
  itemIds: string[]
): Promise<Map<string, NonNullable<WorkspaceItemDto["latestReview"]>>> {
  if (itemIds.length === 0) return new Map();
  const events = await workspacePrisma.$queryRaw<
    Array<{itemId: string; toStatus: string | null; note: string; createdAt: Date}>
  >(Prisma.sql`
    SELECT DISTINCT ON (event."itemId")
      event."itemId",
      event."toStatus",
      event."metadata" ->> 'reviewNote' AS note,
      event."createdAt"
    FROM "WorkspaceEvent" AS event
    INNER JOIN "User" AS actor
      ON actor."id" = event."actorId"
      AND actor."tenantId" = ${tenantId}
    WHERE event."tenantId" = ${tenantId}
      AND event."itemId" IN (${Prisma.join(itemIds)})
      AND event."action" = 'STATUS_CHANGED'
      AND actor."role"::text = ${"ADMIN"}
      AND NULLIF(BTRIM(COALESCE(event."metadata" ->> 'reviewNote', '')), '') IS NOT NULL
    ORDER BY event."itemId", event."createdAt" DESC, event."id" DESC
  `);
  const latest = new Map<string, NonNullable<WorkspaceItemDto["latestReview"]>>();
  for (const event of events) {
    if (!event.toStatus) continue;
    latest.set(event.itemId, {
      status: event.toStatus,
      note: event.note,
      decidedAt: event.createdAt.toISOString()
    });
  }
  return latest;
}

export function toDto(item: {
  id: string;
  parentId?: string|null;
  title: string;
  status: string;
  description: string | null;
  data: Prisma.JsonValue;
  collection: WorkspaceCollection;
  featuredOrder: number | null;
  featuredAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}, dataOverride?: Record<string, unknown>, allowedNextStatuses?: string[], canEditContent?: boolean, latestReview?: WorkspaceItemDto["latestReview"]): WorkspaceItemDto {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    description: item.description,
    data: dataOverride ?? asJsonObject(item.data),
    ...(item.collection==="PROPERTIES" && item.parentId && canEditContent!==undefined?{linkedProjectId:item.parentId}:{}),
    ...(item.collection==="PROPERTIES" && canEditContent!==undefined?{completion:propertyCompletion(item.title,item.description,asJsonObject(item.data))}:{}),
    ...(item.collection === "PROPERTIES" ? {featured: item.featuredOrder !== null, featuredOrder: item.featuredOrder} : {}),
    ...(allowedNextStatuses ? {allowedNextStatuses} : {}),
    ...(canEditContent !== undefined ? {canEditContent} : {}),
    ...(latestReview ? {latestReview} : {}),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

function projectData(data: Record<string, unknown>, allowedKeys: readonly string[]) {
  return Object.fromEntries(allowedKeys.filter((key) => key in data).map((key) => [key, data[key]]));
}

function sanitizeClientData(data: Record<string, unknown> | undefined) {
  const sanitized = {...(data ?? {})};
  delete sanitized.consentAcceptedAt;
  delete sanitized.grandTotal;
  delete sanitized.materialCategoryIds;
  delete sanitized.visitorType;
  delete sanitized.isDealer;
  return sanitized;
}

function sharedPropertyPhone(data: Record<string, unknown>) {
  return data.shareContactWithEnquirers === true && typeof data.contactPhone === "string"
    ? normalizeContactPhone(data.contactPhone)
    : undefined;
}

export function publicDataFor(config: CollectionConfig, data: Record<string, unknown>) {
  const safe = projectData(config.key === "properties" ? normalizePropertyKitchen(data) : data, config.publicDataKeys ?? []);
  if (config.key === "properties" || config.key === "jobs" || config.key === "dealerProfiles") safe.countryCode ??= defaultListingCountry;
  if ((config.key === "properties" || config.key === "dealerProfiles") && safe.countryCode !== defaultListingCountry) delete safe.reraNumber;
  if (config.key === "properties") {
    if(data.priceMode==="ON_REQUEST")delete safe.price;
    safe.hasMap = data.addressVisibility!=="LOCALITY_ONLY" && mapLocationSchema.safeParse(data.mapLocation).success;
    if (safe.propertyType === "OTHER" && typeof data.propertyTypeOther === "string") safe.propertyType = data.propertyTypeOther;
    safe.mediaUrls = propertyGalleryUrls(safe).slice(0, propertyGalleryLimit);
    const phone = sharedPropertyPhone(data);
    if (phone) safe.contactPhoneMasked = phone.replace(/\d(?=\d{3})/g, "*");
  }
  if (
    singleProfiles.has(config.key) &&
    data.publicContactConsent === true
  ) {
    if (typeof data.phone === "string") safe.phone = data.phone;
    if (typeof data.whatsappPhone === "string") safe.whatsappPhone = data.whatsappPhone;
  }
  return safe;
}

const indirectRfqKeys = ["requesterType", "projectName", "countryCode", "cityId", "city", "locality", "requiredByDate", "items"];

function workspaceDataFor(
  item: {ownerId: string | null; targetUserId: string | null; data: Prisma.JsonValue},
  session: WorkspaceSession,
  config: CollectionConfig
) {
  const data = asJsonObject(item.data);
  if (session.role === "ADMIN" || item.ownerId === session.userId || item.targetUserId === session.userId) {
    if (config.key === "materialProducts" || config.key === "materialRfqs") {
      const ids = Array.isArray(data.deliveryCityIds) ? data.deliveryCityIds : [data.cityId];
      return {...data, deliveryCityOptions: ids.map(getDeliveryCity).filter(Boolean)};
    }
    if (config.key !== "properties") return data;
    const {featuredRequested: _legacyFeature, shareContactWithEnquirers: _contactPreference, ...details} = normalizePropertyKitchen(data);
    return details;
  }
  if (config.key === "materialRfqs" && session.role === "VENDOR") return projectData(data, indirectRfqKeys);
  return {};
}

function assertTenantSession(session: WorkspaceSession) {
  if (!session.tenantId || !session.userId) throw new WorkspaceHttpError(401, "Invalid session scope");
}

async function resolveParentAndTarget(
  tx: Prisma.TransactionClient,
  config: CollectionConfig,
  data: Record<string, unknown>,
  session: WorkspaceSession
) {
  const relationByCollection: Partial<Record<CollectionKey, {field: string; parent: string; publicStatuses?: string[]}>> = {
    savedProperties: {field: "propertyId", parent: "PROPERTIES", publicStatuses: ["PUBLISHED"]},
    propertyInquiries: data.projectId
      ? {field: "projectId", parent: "BUILDER_PROJECTS", publicStatuses: ["PUBLISHED"]}
      : {field: "propertyId", parent: "PROPERTIES", publicStatuses: ["PUBLISHED"]},
    materialQuotes: {field: "rfqId", parent: "MATERIAL_RFQS", publicStatuses: quotingRfqStatuses},
    serviceInquiries: {field: "serviceProfileId", parent: "SERVICE_PROFILES", publicStatuses: ["PUBLISHED"]},
    jobApplications: {field: "jobId", parent: "JOBS", publicStatuses: ["PUBLISHED"]},
    adCampaigns: {field: "projectId", parent: "BUILDER_PROJECTS"}
  };
  const relation = relationByCollection[config.key];
  if (!relation) return {parentId: null, targetUserId: null};

  const parentId = data[relation.field];
  if (typeof parentId !== "string" || !parentId) {
    if (config.key === "adCampaigns") return {parentId: null, targetUserId: null};
    throw new WorkspaceHttpError(422, "Select a related record.", relation.field);
  }

  const [parent] = await tx.$queryRaw<Array<{id: string; ownerId: string; status: string; data: Prisma.JsonValue}>>`
    SELECT "id", "ownerId", "status", "data" FROM "WorkspaceItem"
    WHERE "id" = ${parentId} AND "tenantId" = ${session.tenantId}
      AND "collection" = CAST(${relation.parent} AS "WorkspaceCollection")
    FOR SHARE
  `;
  if (!parent || (relation.publicStatuses && !relation.publicStatuses.includes(parent.status))) {
    throw new WorkspaceHttpError(404, "The selected record is no longer available.", relation.field);
  }
  if (config.key === "jobApplications" && !jobAcceptsApplications(asJsonObject(parent.data))) {
    throw new WorkspaceHttpError(409, "Applications have closed for this job.", relation.field);
  }

  if (config.key === "materialQuotes" && parent.ownerId === session.userId) {
    throw new WorkspaceHttpError(403, "A vendor cannot quote on their own RFQ");
  }
  if (config.key === "materialQuotes" && !(await vendorRfqIds(session.tenantId, session.userId, parent.id, tx)).length) {
    throw new WorkspaceHttpError(409, "This RFQ is closed or does not match a published product in your delivery area.", "rfqId");
  }

  if (config.key === "adCampaigns" && parent.ownerId !== session.userId && session.role !== "ADMIN") {
    throw new WorkspaceHttpError(403, "Campaigns can only target your own project.", "projectId");
  }
  return {parentId: parent.id, targetUserId: ["savedProperties", "jobApplications"].includes(config.key) ? null : parent.ownerId};
}

function canTransition(
  config: CollectionConfig,
  item: {ownerId: string | null; targetUserId: string | null; status: string},
  session: WorkspaceSession,
  nextStatus: string
) {
  if (!config.statuses.includes(nextStatus)) return false;
  const transitions =
    session.role === "ADMIN"
      ? config.adminTransitions
      : item.targetUserId === session.userId && item.ownerId !== session.userId
        ? config.targetTransitions
        : item.ownerId === session.userId
          ? config.ownerTransitions
          : undefined;
  return Boolean(transitions?.[item.status]?.includes(nextStatus));
}

function allowedNextStatuses(
  config: CollectionConfig,
  item: {ownerId: string | null; targetUserId: string | null; status: string},
  session: WorkspaceSession
) {
  return config.statuses.filter((status) => status !== item.status && canTransition(config, item, session, status));
}

function publicAtFor(config: CollectionConfig, status: string, existing: Date | null) {
  return config.publicStatuses?.includes(status) ? existing ?? new Date() : null;
}

const editableContentStatuses = new Set([
  "DRAFT",
  "CHANGES_REQUESTED",
  "PAUSED",
  "ACTIVE",
  "AVAILABLE",
  "BUSY",
  "WAITING_USER",
  "NEW"
]);

function canEditStatus(key: CollectionKey, status: string) {
  return editableContentStatuses.has(status) || (status === "REJECTED" && singleProfiles.has(key)) ||
    (["properties","materialProducts"].includes(key) && ["PUBLISHED", "APPROVED", "PENDING_REVIEW"].includes(status));
}

router.post("/workspace/:collection", (req, res, next) => {
  if (!leadCollections.has(String(req.params.collection) as CollectionKey)) return next();
  return enquiryAccess(request => "workspace:" + request.params.collection)(req, res, next);
});
router.use("/workspace", requireSessionMiddleware);

router.get("/workspace/savedProperties", asyncRoute(async (req, res) => {
  const session = getSession(req);
  const items = await workspacePrisma.workspaceItem.findMany({
    where: {tenantId: session.tenantId, ownerId: session.userId, collection: "SAVED_PROPERTIES", parentId: {not: null}},
    orderBy: [{updatedAt: "desc"}, {id: "desc"}], select: {id: true, parentId: true, status: true},
  });
  const byProperty = new Map<string, {id: string; propertyId: string; status: string}>();
  for (const {id, parentId, status} of items) {
    if (parentId && (!byProperty.has(parentId) || (status === "ACTIVE" && byProperty.get(parentId)?.status !== "ACTIVE"))) {
      byProperty.set(parentId, {id, propertyId: parentId, status});
    }
  }
  sendSuccess(res, [...byProperty.values()]);
}));

router.get("/workspace/property-review",asyncRoute(async(req,res)=>{
  const session=getSession(req);
  if(session.role!=="ADMIN")throw new WorkspaceHttpError(403,"Administrator access required.");
  const q=z.object({source:z.enum(["OWNER","DEALER","BUILDER"]).optional(),city:z.string().max(120).optional(),category:z.string().max(80).optional(),q:z.string().max(160).optional(),status:z.string().max(40).optional(),submitted:z.string().date().optional(),reported:z.literal("1").optional(),page:z.coerce.number().int().min(1).max(100000).default(1)}).parse(req.query);
  const start=q.submitted?new Date(q.submitted+"T00:00:00Z"):null;
  const where:Prisma.WorkspaceItemWhereInput={tenantId:session.tenantId,collection:"PROPERTIES",status:q.status,title:q.q?{contains:q.q,mode:"insensitive"}:undefined,
    property:{source:q.source,cityName:q.city?{contains:q.city,mode:"insensitive"}:undefined,category:q.category?{code:q.category}:undefined},
    ...(q.reported?{children:{some:{collection:"GRIEVANCES"}}}:{}),
    ...(start?{events:{some:{toStatus:"PENDING_REVIEW",createdAt:{gte:start,lt:new Date(+start+86400000)}}}}:{})};
  const profile={select:{profile:{select:{verification:true,user:{select:{fullName:true}}}}}} as const;
  const [total,items]=await workspacePrisma.$transaction([workspacePrisma.workspaceItem.count({where}),workspacePrisma.workspaceItem.findMany({where,orderBy:[{updatedAt:"desc"},{id:"desc"}],skip:20*(q.page-1),take:20,include:{property:{select:{source:true,ownerProfile:profile,dealerProfile:profile,builderProfile:profile,migration:{select:{issues:true,retainedKeys:true}}}}}})]);
  const config=collectionConfigs.properties;
  sendSuccess(res,{total,items:items.map(item=>{const p=item.property,profile=p?.ownerProfile?.profile??p?.dealerProfile?.profile??p?.builderProfile?.profile;
    return toDto(item,{...workspaceDataFor(item,session,config),sellerSource:p?.source,listingContact:profile?.user.fullName,profileVerification:profile?.verification,legacyMapping:p?.migration??undefined},allowedNextStatuses(config,item,session),false);})});
}));
router.get("/workspace/properties/:id", asyncRoute(async (req, res) => {
  const session = getSession(req);
  assertTenantSession(session);
  const config = collectionConfigs.properties;
  const item = await workspacePrisma.workspaceItem.findFirst({where: {
    id: routeParam(req.params.id, "id"), tenantId: session.tenantId, collection: "PROPERTIES", ...(session.role==="ADMIN"?{}:{ownerId:session.userId}),
  }});
  if (!item) throw new WorkspaceHttpError(404, "Property listing not found.");
  sendSuccess(res, toDto(item, workspaceDataFor(item, session, config), allowedNextStatuses(config,item,session), item.ownerId===session.userId&&canEditStatus(config.key,item.status)));
}));

router.get("/workspace/propertyInquiries/:id", asyncRoute(async (req, res) => {
  const session = getSession(req);
  const config = collectionConfigs.propertyInquiries;
  const id = routeParam(req.params.id, "id");
  const item = await workspacePrisma.workspaceItem.findFirst({where: {id, tenantId: session.tenantId, collection: "PROPERTY_INQUIRIES",
    ...(session.role === "ADMIN" ? {} : {OR: [{ownerId: session.userId}, {targetUserId: session.userId}]})}});
  if (!item) throw new WorkspaceHttpError(404, "Property enquiry not found.");
  sendSuccess(res, toDto(item, workspaceDataFor(item, session, config), allowedNextStatuses(config, item, session),
    item.ownerId === session.userId && canEditStatus(config.key, item.status)));
}));

router.get(
  "/workspace",
  asyncRoute(async (req, res) => {
    const session = getSession(req);
    assertTenantSession(session);

    const configs = Object.values(collectionConfigs).filter((config) => config.visibleRoles.includes(session.role));
    const collections = await Promise.all(
      configs.map(async (config) => {
        const scope: Prisma.WorkspaceItemWhereInput =
          session.role === "ADMIN"
            ? {}
            : config.key === "jobApplications" ? {ownerId: session.userId}
            : config.key === "materialRfqs" && session.role === "VENDOR"
              ? {
                  OR: [
                    {ownerId: session.userId},
                    {targetUserId: session.userId},
                    {id: {in: await vendorRfqIds(session.tenantId, session.userId)}}
                  ]
                }
              : {OR: [{ownerId: session.userId}, {targetUserId: session.userId,...(config.key==="materialQuotes"?{status:{not:"DRAFT"}}:{})}]};

        const items = await workspacePrisma.workspaceItem.findMany({
          where: {tenantId: session.tenantId, collection: config.dbCollection as WorkspaceCollection, ...scope},
          orderBy: {updatedAt: "desc"},
          take: 100
        });
        const reviewableItemIds = items
          .filter((item) => session.role === "ADMIN" || item.ownerId === session.userId)
          .map((item) => item.id);
        const latestReviews = await latestReviewsFor(session.tenantId, reviewableItemIds);
        return {
          key: config.key,
          label: config.label,
          items: items.map((item) =>
            toDto(
              item,
              workspaceDataFor(item, session, config),
              allowedNextStatuses(config, item, session),
              (config.key === "jobs" && session.role === "ADMIN") || (item.ownerId === session.userId && canEditStatus(config.key, item.status)),
              latestReviews.get(item.id)
            )
          )
        };
      })
    );

    sendSuccess(res, {role: session.role, name: session.name, collections});
  })
);

router.post(
  "/workspace/:collection",
  asyncRoute(async (req, res) => {
    const session = getSession(req);
    assertTenantSession(session);
    const config = requireConfig(routeParam(req.params.collection, "collection"));
    if (!config.createRoles.includes(session.role)) throw new WorkspaceHttpError(403, "Role cannot create this resource");

    if (["properties","dealerProfiles","workerProfiles"].includes(config.key)) await requireConfirmedListingRole(session.tenantId,session.userId);
    const body = createBodySchema.parse(req.body);
    const allowedSubmission = workspaceSubmissionStatuses[config.key as keyof typeof workspaceSubmissionStatuses];
    if (body.status && body.status !== allowedSubmission) throw new WorkspaceHttpError(400, "This is not a valid submission status for this form.", "status");
    const parsedData = collectionSchemas[config.key].parse(sanitizeClientData(body.data)) as Record<string, unknown>;
    const catalogData = ["properties", "jobs", "dealerProfiles"].includes(config.key) ? applyCatalogLocation(parsedData) : parsedData;
    const data = config.key === "jobs" ? await resolveJobLocation(catalogData) : prepareMaterialData(config.key, catalogData);
    if (config.key === "properties") {
      data.addressVisibility ??= "LOCALITY_ONLY";
      if (data.contactPhone) data.shareContactWithEnquirers ??= true;
    }
    if (config.key === "properties" || config.key === "jobs") data.countryCode ??= defaultListingCountry;
    if (leadCollections.has(config.key)) {
      const identity = await readLeadIdentity(req, "workspace:" + config.key);
      data.visitorType = identity?.visitorType ?? session.role;
      data.fullName ??= identity?.fullName ?? session.name;
      if (identity) data.phone = identity.phone;
      if (config.key === "propertyInquiries") data.isDealer = data.visitorType === "DEALER";
    }
    if (config.key === "properties" && data.postalCode) validateListingPostalCode(data);
    if(config.key==="properties"){validateSpecifications(data);await ensureCatalog(session.tenantId);}
    if(config.key==="propertyInquiries"&&(data.configurationId||data.unitId||["CONFIGURATION","PROJECT","BROCHURE"].includes(String(data.inquiryType))))throw new WorkspaceHttpError(422,"Use the enquiry form on the project page.","projectId");
    if(config.key==="builderProjects"&&session.role==="BUILDER")await ensureProfile(session);
    const initialStatus = body.status ?? config.initialStatus;
    if (body.status) validateTransitionReadiness(config.key, initialStatus, data, body.description);
    validateNewSubmission(config.key, data);
    const trustedData = deriveTrustedData(config.key, initialStatus, data);
    await validateImageAttachments(config.key, trustedData, session);
    if (config.key === "jobApplications") await assertResumeUploaded(parsedData.resumeUrl, session.tenantId, session.userId);
    validateCollectionConsistency(config.key, data);
    await moderateListing(config.key, initialStatus, body.title, body.description, trustedData);
    if(config.key==="materialRfqs" || config.key==="materialQuotes")await ensureCatalog(session.tenantId);
    if(config.key==="materialProducts"){await ensureCatalog(session.tenantId);if(session.role==="VENDOR")await ensureProfile(session);}
    const item = await workspacePrisma.$transaction(async (tx) => {
      const enquiryRequestKey = body.requestId && (leadCollections.has(config.key) || config.key === "properties") ? [session.userId, config.key, body.requestId].join(":") : undefined;
      if (enquiryRequestKey) {
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${enquiryRequestKey}, 0))`;
        const replay = await tx.workspaceItem.findUnique({where: {tenantId_enquiryRequestKey: {tenantId: session.tenantId, enquiryRequestKey}}});
        if (replay) return replay;
      }
      const relation = await resolveParentAndTarget(tx, config, data, session);
      if (config.key === "propertyInquiries" && relation.targetUserId === session.userId) throw new WorkspaceHttpError(422, "You cannot enquire about your own listing.");
      if (config.key === "grievances" && data.category === "LISTING" && typeof data.relatedItemId === "string") {
        const property = await tx.workspaceItem.findFirst({where: {id: data.relatedItemId, tenantId: session.tenantId, collection: "PROPERTIES"}, select: {id: true}});
        if (property && !await hasPropertyLead(session.tenantId, session.userId, property.id, tx)) {
          throw new WorkspaceHttpError(403, "Submit an enquiry for this property before reporting it.", "relatedItemId");
        }
      }
      await ensureUniqueSubmission(tx, config, session, relation.parentId);
      const created = await tx.workspaceItem.create({
        data: {
          tenantId: session.tenantId,
          ownerId: session.userId,
          targetUserId: relation.targetUserId,
          parentId: relation.parentId,
          collection: config.dbCollection as WorkspaceCollection,
          title: body.title,
          description: body.description,
          status: initialStatus,
          enquiryRequestKey,
          ...(config.key === "propertyInquiries" && relation.targetUserId ? {enquiryEmail: {create: {locale: body.locale ?? "en", nextAttempt: new Date()}}} : {}),
          data: asInputJson(trustedData),
          ...(config.key === "properties" ? {searchPrice: typeof trustedData.price === "number" ? trustedData.price : null, pricePerSqft: propertyPricePerSqft(trustedData)} : {}),
          publicAt: publicAtFor(config, initialStatus, null)
        }
      });
      if(config.key==="materialRfqs")await syncRequest(tx,created);
      if(config.key==="materialQuotes"){
        await syncQuote(tx,created,false,initialStatus==="SUBMITTED");
        if(initialStatus==="SUBMITTED" && relation.parentId){
          const changed=await tx.workspaceItem.updateMany({where:{id:relation.parentId,status:{in:quotingRfqStatuses}},data:{status:"QUOTES_RECEIVED"}});
          if(!changed.count)throw new WorkspaceHttpError(409,"This RFQ is closed.");
          await tx.workspaceEvent.create({data:{tenantId:session.tenantId,itemId:relation.parentId,actorId:session.userId,action:"QUOTE_RECEIVED",toStatus:"QUOTES_RECEIVED"}});
        }
      }
      if(config.key==="materialProducts")await syncMaterialProduct(tx,created);
      if(config.key==="properties")await syncProperty(tx,created);
      if(config.key==="builderProjects")await projectFromWorkspace(tx,created,session.userId);
      if (config.key === "properties" && initialStatus === "PENDING_REVIEW") await recordPropertyPost(tx, session.tenantId, session.userId, created.id);
      await tx.workspaceEvent.create({
        data: {tenantId: session.tenantId, itemId: created.id, actorId: session.userId, action: "CREATED", toStatus: created.status}
      });
      return created;
    });
    sendSuccess(
      res,
      toDto(
        item,
        undefined,
        allowedNextStatuses(config, item, session),
        item.ownerId === session.userId && canEditStatus(config.key, item.status)
      ),
      201
    );
  })
);

router.patch(
  "/workspace/properties/:id/feature",
  asyncRoute(async (req, res) => {
    const session = getSession(req);
    assertTenantSession(session);
    if (session.role !== "ADMIN") throw new WorkspaceHttpError(403, "Only administrators can feature properties.");
    const id = routeParam(req.params.id, "id");
    const {featured, order} = z.object({featured: z.boolean(), order: z.number().int().min(1).max(2_147_483_647).optional()}).strict().parse(req.body);
    const scope = {id, tenantId: session.tenantId, collection: WorkspaceCollection.PROPERTIES};
    const featuredOrder = await workspacePrisma.$transaction(async (tx) => {
      await lockFeaturedOrder(tx, session.tenantId);
      const item = await tx.workspaceItem.findFirst({where: scope, select: {status: true, publicAt: true, featuredAt: true, featuredOrder: true}});
      if (!item) throw new WorkspaceHttpError(404, "Property not found.");
      if (item.status !== "PUBLISHED" || !item.publicAt) {
        throw new WorkspaceHttpError(409, "Publish the property before changing its featured placement.");
      }
      if (!featured || !await tx.billingEntitlement.findFirst({
        where: {...activeBenefit(session.tenantId, "LISTING_FEATURE", new Date()), targetId: id, sourceOrder: {status: "CAPTURED"}}, select: {id: true},
      })) throw new WorkspaceHttpError(409, "Only properties with an active featuring payment can be reordered.");
      const oldOrder = item.featuredOrder;
      const lastOrder = featured && (order !== undefined || oldOrder === null)
        ? (await tx.workspaceItem.aggregate({where: {tenantId: session.tenantId}, _max: {featuredOrder: true}}))._max.featuredOrder ?? 0 : 0;
      const lastPosition = lastOrder + (oldOrder === null ? 1 : 0);
      if (featured && order !== undefined && order > lastPosition) {
        throw new WorkspaceHttpError(422, `Choose a position from 1 to ${lastPosition}.`, "order");
      }
      const newOrder = featured ? order ?? oldOrder ?? lastPosition : null;
      if (oldOrder === newOrder) return newOrder;
      await shiftFeaturedOrder(tx, session.tenantId, oldOrder, newOrder);
      await tx.workspaceItem.update({where: {id}, data: {featuredAt: featured ? item.featuredAt ?? new Date() : null, featuredOrder: newOrder}});
      await tx.workspaceEvent.create({data: {
        tenantId: session.tenantId, itemId: id, actorId: session.userId,
        action: !featured ? "UNFEATURED" : oldOrder === null ? "FEATURED" : "FEATURE_ORDER_CHANGED",
        fromStatus: item.status, toStatus: item.status, metadata: {fromOrder: oldOrder, toOrder: newOrder}
      }});
      return newOrder;
    });
    sendSuccess(res, {featured, featuredOrder});
  })
);

router.patch(
  "/workspace/:collection/:id",
  asyncRoute(async (req, res) => {
    const session = getSession(req);
    assertTenantSession(session);
    const config = requireConfig(routeParam(req.params.collection, "collection"));
    if (!config.visibleRoles.includes(session.role)) throw new WorkspaceHttpError(403, "Role cannot access this resource");
    if (session.role !== "ADMIN" && ["properties","dealerProfiles","workerProfiles"].includes(config.key)) await requireConfirmedListingRole(session.tenantId,session.userId);
    const itemId = routeParam(req.params.id, "id");
    const body = patchBodySchema.parse(req.body);
    if (body.manualReview && (config.key !== "jobs" || session.role !== "ADMIN" || body.status !== "PUBLISHED")) {
      throw new WorkspaceHttpError(403, "Manual review is restricted to admin job publication.");
    }
    const item = await workspacePrisma.workspaceItem.findFirst({
      where: {id: itemId, tenantId: session.tenantId, collection: config.dbCollection as WorkspaceCollection}
    });
    if (!item) throw new WorkspaceHttpError(404, "Workspace item not found");

    if(body.expectedUpdatedAt && body.expectedUpdatedAt!==item.updatedAt.toISOString()) throw new WorkspaceHttpError(409,"The listing changed. Reload the saved version before editing.");
    const isOwner = item.ownerId === session.userId;
    const isTarget = config.key !== "jobApplications" && item.targetUserId === session.userId;
    const isAdmin = session.role === "ADMIN";
    if (!isOwner && !isTarget && !isAdmin) throw new WorkspaceHttpError(403, "Item is outside your workspace");
    const clientPatchData = sanitizeClientData(body.data);
    const dataOnly = body.title === undefined && body.description === undefined && Object.keys(clientPatchData).length === 1;
    const privacyOnlyPatch = dataOnly && ((singleProfiles.has(config.key) && "publicContactConsent" in clientPatchData) ||
      (config.key === "properties" && clientPatchData.shareContactWithEnquirers === false));
    const galleryOnly = isOwner && config.key === "properties" && item.status === "PUBLISHED" &&
      (!body.status || body.status === item.status) && dataOnly && Array.isArray(clientPatchData.mediaUrls);
    const updatesContent = body.title !== undefined || body.description !== undefined || body.data !== undefined;
    const requiresReview = (isOwner || isAdmin) && (config.key === "builderProjects" || (isOwner && ["properties","materialProducts"].includes(config.key))) && updatesContent && !galleryOnly && !privacyOnlyPatch &&
      (!body.status || body.status === item.status) && ["PUBLISHED", "APPROVED"].includes(item.status);
    const nextStatus = requiresReview ? "PENDING_REVIEW" : body.status ?? item.status;
    const statusChanged = nextStatus !== item.status;
    if (body.reviewNote !== undefined && !isAdmin) {
      throw new WorkspaceHttpError(403, "Only an administrator can add a moderation note");
    }
    if (body.reviewNote !== undefined && !statusChanged) {
      throw new WorkspaceHttpError(422, "Choose a status to save a review note.", "status");
    }
    if (body.manualReview && !statusChanged && !updatesContent) {
      throw new WorkspaceHttpError(409, "This job is already published.");
    }
    if (!statusChanged && body.status !== undefined && body.title === undefined && body.description === undefined && body.data === undefined) {
      sendSuccess(res, toDto(item, workspaceDataFor(item, session, config), allowedNextStatuses(config, item, session), isOwner && canEditStatus(config.key, item.status)));
      return;
    }
    const statusesRequiringReason = new Set(["CHANGES_REQUESTED", "REJECTED", "SUSPENDED"]);
    if (
      isAdmin &&
      statusChanged &&
      body.status &&
      statusesRequiringReason.has(body.status) &&
      (!body.reviewNote || body.reviewNote.length < 10)
    ) {
      throw new WorkspaceHttpError(422, "Enter a reason of at least 10 characters.", "reviewNote");
    }

    const storedData = asJsonObject(item.data);
    const currentData = config.key === "properties" && body.data ? normalizePropertyKitchen(storedData) : storedData;
    if (galleryOnly) {
      const previous = propertyGalleryUrls(currentData);
      const parsed = z.array(z.string()).min(1, "Keep at least one photo or video in a published listing.").max(propertyGalleryLimit).safeParse(clientPatchData.mediaUrls);
      if (!parsed.success) throw new WorkspaceHttpError(422, parsed.error.issues[0].message, "mediaUrls");
      const reordered = parsed.data;
      if (new Set(reordered).size !== reordered.length || !reordered.every((url) => previous.includes(url))) {
        throw new WorkspaceHttpError(422, "Use the listing editor to submit new gallery items for review.", "mediaUrls");
      }
      const {videoUrl: _legacyVideo, ...data} = currentData;
      await moderateListing(config.key, item.status, item.title, item.description, {...data, mediaUrls: reordered});
      const updated = await workspacePrisma.$transaction(async (tx) => {
        const row = await tx.workspaceItem.updateManyAndReturn({
          where: {id: item.id, tenantId: session.tenantId, ownerId: session.userId, status: "PUBLISHED", updatedAt: item.updatedAt},
          data: {data: asInputJson({...data, mediaUrls: reordered})},
        });
        if (!row.length) throw new WorkspaceHttpError(409, "The listing changed. Refresh it and try again.", "mediaUrls");
        await tx.workspaceEvent.create({data: {tenantId: session.tenantId, itemId: item.id, actorId: session.userId,
          action: reordered.length < previous.length ? "GALLERY_UPDATED" : "GALLERY_REORDERED", fromStatus: item.status, toStatus: item.status}});
        await syncProperty(tx,row[0]!);
        return row[0];
      });
      sendSuccess(res, toDto(updated, workspaceDataFor(updated, session, config), allowedNextStatuses(config, updated, session), true));
      return;
    }
    if (config.key === "jobApplications" && clientPatchData.resumeUrl !== undefined) {
      await assertResumeUploaded(clientPatchData.resumeUrl, session.tenantId, session.userId);
    }
    if (
      updatesContent && !(config.key === "jobs" && isAdmin) &&
      (!isOwner || (!canEditStatus(config.key, item.status) && !privacyOnlyPatch))
    ) {
      throw new WorkspaceHttpError(409, "Content cannot be edited in the current state");
    }
    if (statusChanged && !canTransition(config, item, session, nextStatus)) {
      throw new WorkspaceHttpError(409, "This status change is no longer available. Refresh the record and choose another status.", "status");
    }

    const relationFields: Partial<Record<CollectionKey, string>> = {
      savedProperties: "propertyId",
      propertyInquiries: currentData.projectId ? "projectId" : "propertyId",
      materialQuotes: "rfqId",
      serviceInquiries: "serviceProfileId",
      jobApplications: "jobId"
    };
    if(config.key==="propertyInquiries"){for(const k of ["configurationId","unitId"])if(k in clientPatchData&&clientPatchData[k]!==currentData[k])throw new WorkspaceHttpError(409,"The project lead association cannot be changed.",k);}
    const immutableRelationField = relationFields[config.key];
    if (config.key === "propertyInquiries" && ("projectId" in clientPatchData || "propertyId" in clientPatchData)) {
      const alternate = immutableRelationField === "projectId" ? "propertyId" : "projectId";
      if (clientPatchData[alternate] !== undefined) throw new WorkspaceHttpError(409, "The linked record cannot be changed after creation.", alternate);
    }
    if (
      immutableRelationField &&
      immutableRelationField in clientPatchData &&
      clientPatchData[immutableRelationField] !== currentData[immutableRelationField]
    ) {
      throw new WorkspaceHttpError(409, "The linked record cannot be changed after creation.", immutableRelationField);
    }
    const legacy= config.key==="properties"?Object.fromEntries(Object.entries(currentData).filter(([key])=>!propertyInputKeys.has(key))):{};
    const editableData= config.key==="properties"?Object.fromEntries(Object.entries(currentData).filter(([key])=>propertyInputKeys.has(key))):currentData;
    let mergedData = body.data
      ? {...legacy,...collectionSchemas[config.key].parse(mergeInput(editableData, clientPatchData))} as Record<string,unknown>
      : currentData;
    if (config.key === "properties" && Object.hasOwn(clientPatchData, "contactPhone") && mergedData.contactPhone !== currentData.contactPhone) {
      mergedData.shareContactWithEnquirers = Boolean(mergedData.contactPhone) && clientPatchData.shareContactWithEnquirers !== false;
    }
    if (body.data && ["properties", "jobs", "dealerProfiles"].includes(config.key)) mergedData = applyCatalogLocation(mergedData);
    if (config.key === "properties" && body.data && (nextStatus !== "DRAFT" || mergedData.postalCode)) validateListingPostalCode(mergedData);
    if (config.key === "jobs" && (body.data || (statusChanged && ["PENDING_REVIEW", "PUBLISHED"].includes(nextStatus)))) {
      mergedData = await resolveJobLocation(mergedData, currentData);
    }
    if (body.data || statusChanged) mergedData = prepareMaterialData(config.key, mergedData);
    if (config.key === "workerProfiles" && ["AVAILABLE", "BUSY"].includes(nextStatus)) mergedData.availableNow = nextStatus === "AVAILABLE";
    if (config.key === "materialProducts" && statusChanged) {
      if (nextStatus === "OUT_OF_STOCK") mergedData.availabilityStatus = "OUT_OF_STOCK";
      if (item.status === "OUT_OF_STOCK" && nextStatus === "PUBLISHED") mergedData.availabilityStatus = "IN_STOCK";
    }
    if (body.data) {
      if (config.key === "grievances" && session.role !== "ADMIN" &&
        ("category" in clientPatchData || "relatedItemId" in clientPatchData) &&
        mergedData.category === "LISTING" && typeof mergedData.relatedItemId === "string") {
        const property = await workspacePrisma.workspaceItem.findFirst({where: {
          id: mergedData.relatedItemId, tenantId: session.tenantId, collection: "PROPERTIES",
        }, select: {id: true}});
        if (property && !await hasPropertyLead(session.tenantId, session.userId, property.id)) {
          throw new WorkspaceHttpError(403, "Submit an enquiry for this property before reporting it.", "relatedItemId");
        }
      }
      if (config.key === "loanInquiries") validateNewSubmission(config.key, mergedData);
      validateCollectionConsistency(config.key, mergedData);
    }
    const effectiveDescription = body.description === undefined ? item.description : body.description;
    if (statusChanged || (config.key === "properties" && updatesContent && nextStatus === "PENDING_REVIEW") || (config.key === "jobs" && updatesContent && nextStatus === "PUBLISHED")) {
      validateTransitionReadiness(config.key, nextStatus, mergedData, effectiveDescription);
    }
    if(config.key==="properties" && body.data)validateSpecifications(mergedData, currentData);
    const trustedData = statusChanged ? deriveTrustedData(config.key, nextStatus, mergedData) : mergedData;
    if (body.data) await validateImageAttachments(config.key, trustedData, session, currentData);
    let jobDecision: Awaited<ReturnType<typeof reviewJobPublication>> | undefined;
    if (config.key === "jobs" && nextStatus === "PUBLISHED" && (statusChanged || updatesContent)) {
      jobDecision = await reviewJobPublication(session, item, body.title ?? item.title, effectiveDescription, trustedData, body.manualReview);
    } else if ((updatesContent && !privacyOnlyPatch) || statusChanged) {
      await moderateListing(config.key, nextStatus, body.title ?? item.title, effectiveDescription, trustedData);
    }

    if (config.key === "materialQuotes" && statusChanged && nextStatus === "SUBMITTED") {
      if (!item.ownerId || !item.parentId || !(await vendorRfqIds(session.tenantId, item.ownerId, item.parentId)).length) {
        throw new WorkspaceHttpError(409, "This RFQ is no longer accepting quotes");
      }
    }

    if(["materialProducts","materialRfqs","materialQuotes"].includes(config.key))await ensureCatalog(session.tenantId);
    let campaignParentId = item.parentId;
    if (config.key === "adCampaigns" && ["PENDING_REVIEW", "APPROVED", "ACTIVE"].includes(nextStatus)) {
      if (!item.ownerId) throw new WorkspaceHttpError(409, "The campaign owner is unavailable.");
      const projectId = trustedData.projectId;
      if (typeof projectId !== "string") throw new WorkspaceHttpError(422, "Select an approved builder project.", "projectId");
      const project = await workspacePrisma.workspaceItem.findFirst({
        where: {
          id: projectId,
          tenantId: session.tenantId,
          ownerId: item.ownerId,
          collection: WorkspaceCollection.BUILDER_PROJECTS,
          status: {in: nextStatus === "ACTIVE" ? ["PUBLISHED"] : ["APPROVED", "PUBLISHED"]}
        },
        select: {id: true}
      });
      if (!project) throw new WorkspaceHttpError(409, "Select one of your approved builder projects.", "projectId");
      if (nextStatus === "ACTIVE") {
        const paidPack = await workspacePrisma.billingEntitlement.findFirst({
          where: {
            ...activeBenefit(session.tenantId, "BUILDER_AD_CAMPAIGN", new Date()),
            userId: item.ownerId,
            targetId: item.id
          },
          select: {id: true}
        });
        if (!paidPack) throw new WorkspaceHttpError(409, "An active paid ad package is required for this campaign");
      }
      campaignParentId = project.id;
    }

    const updateResult = await workspacePrisma.$transaction(async (tx) => {
      if(config.key==="properties")await checkLinkedProperty(tx,item.id,trustedData,nextStatus,session.userId);
      const leavesFeatured = config.key === "properties" && item.status === "PUBLISHED" && nextStatus !== "PUBLISHED";
      if (leavesFeatured) await lockFeaturedOrder(tx, session.tenantId);
      const rankBeforeChange = leavesFeatured
        ? (await tx.workspaceItem.findUnique({where: {id: item.id}, select: {featuredOrder: true}}))?.featuredOrder ?? null
        : null;
      if (config.key === "savedProperties" && statusChanged && nextStatus === "ACTIVE") {
        await ensureUniqueSubmission(tx, config, session, item.parentId, item.id);
      }
      let quoteRfq: {id: string; status: string} | undefined;
      if (config.key === "materialQuotes" && item.parentId && statusChanged && ["SUBMITTED", "ACCEPTED"].includes(nextStatus)) {
        const today = new Date().toISOString().slice(0, 10);
        const [open] = await tx.$queryRaw<Array<{id: string; status: string}>>(Prisma.sql`
          SELECT "id", "status" FROM "WorkspaceItem" WHERE "id" = ${item.parentId} AND "tenantId" = ${session.tenantId}
            AND "collection" = 'MATERIAL_RFQS' AND "status" IN (${Prisma.join(quotingRfqStatuses)})
            AND ("data"->>'requiredByDate' IS NULL OR "data"->>'requiredByDate' >= ${today}) FOR UPDATE
        `);
        if (nextStatus==="ACCEPTED" && typeof trustedData.validUntil==="string" && trustedData.validUntil<today) throw new WorkspaceHttpError(409,"This quote has expired.");
        if (!open) throw new WorkspaceHttpError(409, nextStatus === "ACCEPTED"
          ? "This RFQ is no longer accepting a quote selection." : "This RFQ is no longer accepting quotes.");
        quoteRfq = open;
      }

      const write = await tx.workspaceItem.updateMany({
        where: {
          id: item.id,
          tenantId: session.tenantId,
          status: item.status,
          updatedAt: item.updatedAt
        },
        data: {
          ...(config.key === "jobs" ? {updatedAt: new Date(Math.max(Date.now(), item.updatedAt.getTime() + 1))} : {}),
          title: body.title,
          description: body.description,
          status: nextStatus,
          data: asInputJson(trustedData),
          ...(config.key === "properties" ? {searchPrice: typeof trustedData.price === "number" ? trustedData.price : null, pricePerSqft: propertyPricePerSqft(trustedData)} : {}),
          parentId: campaignParentId,
          ...(leavesFeatured ? {featuredAt: null, featuredOrder: null} : {}),
          publicAt: publicAtFor(config, nextStatus, item.publicAt)
        }
      });
      if (write.count !== 1) {
        throw new WorkspaceHttpError(409, "This item changed in another session; refresh before retrying");
      }
      if (config.key === "properties" && item.status === "DRAFT" && nextStatus === "PENDING_REVIEW" && item.ownerId) await recordPropertyPost(tx, session.tenantId, item.ownerId, item.id);
      if (rankBeforeChange !== null) await shiftFeaturedOrder(tx, session.tenantId, rankBeforeChange, null);
      const changed = await tx.workspaceItem.findUniqueOrThrow({where: {id: item.id}});
      if(config.key==="materialRfqs")await syncRequest(tx,changed);
      if(config.key==="materialQuotes")await syncQuote(tx,changed,false,nextStatus==="SUBMITTED"&&(statusChanged||updatesContent));
      if(config.key==="materialProducts")await syncMaterialProduct(tx,changed);
      if(config.key==="properties")await syncProperty(tx,changed);
      if(config.key==="builderProjects")await projectFromWorkspace(tx,changed,session.userId,item);
      if (jobDecision) {
        await tx.workspaceEvent.create({data: {tenantId: session.tenantId, itemId: item.id, actorId: session.userId,
          fromStatus: item.status, toStatus: nextStatus, action: "JOB_MODERATION_" + jobDecision.state,
          metadata: asInputJson({...jobDecision, reviewNote: jobDecision.confirmed
            ? "Administrator confirmed manual review after " + jobDecision.reason + "." : "Automated content check passed."})}});
      }
      const decisionEvent = await tx.workspaceEvent.create({
        data: {
          tenantId: session.tenantId,
          itemId: item.id,
          actorId: session.userId,
          action: body.status && body.status !== item.status ? "STATUS_CHANGED" : "UPDATED",
          fromStatus: item.status,
          toStatus: nextStatus,
          metadata: body.reviewNote ? asInputJson({reviewNote: body.reviewNote}) : undefined
        }
      });

      if (quoteRfq) {
        const selection = nextStatus === "ACCEPTED";
        let nextRfqStatus = selection ? "VENDOR_SELECTED" : quoteRfq.status;
        if (!selection && quoteRfq.status !== "QUOTES_RECEIVED") {
          const quoteCount = await tx.workspaceItem.count({
            where: {tenantId: session.tenantId, parentId: quoteRfq.id, collection: WorkspaceCollection.MATERIAL_QUOTES, status: {in: ["SUBMITTED", "VIEWED", "SHORTLISTED"]}}
          });
          nextRfqStatus = quoteCount >= 2 ? "QUOTES_RECEIVED" : "QUOTING";
        }
        if (nextRfqStatus !== quoteRfq.status) {
          await tx.workspaceItem.update({where: {id: quoteRfq.id}, data: {status: nextRfqStatus}});
          await tx.workspaceEvent.create({
            data: {tenantId: session.tenantId, actorId: session.userId, itemId: quoteRfq.id, action: "STATUS_CHANGED", fromStatus: quoteRfq.status, toStatus: nextRfqStatus}
          });
        }
        if (selection) {
          const competing = await tx.$queryRaw<Array<{id: string; status: string}>>`
            SELECT "id", "status" FROM "WorkspaceItem"
            WHERE "tenantId" = ${session.tenantId} AND "parentId" = ${quoteRfq.id}
              AND "collection" = 'MATERIAL_QUOTES' AND "id" <> ${item.id}
              AND "status" IN ('SUBMITTED', 'VIEWED', 'SHORTLISTED')
            FOR UPDATE
          `;
          if (competing.length) {
            await tx.workspaceItem.updateMany({where: {id: {in: competing.map(({id}) => id)}}, data: {status: "REJECTED"}});
            await tx.workspaceEvent.createMany({
              data: competing.map(({id, status}) => ({tenantId: session.tenantId, actorId: session.userId, itemId: id, action: "STATUS_CHANGED", fromStatus: status, toStatus: "REJECTED"}))
            });
          }
        }
      }
      return {changed, decisionEvent};
    });
    const updated = updateResult.changed;
    const latestReview =
      isAdmin && body.reviewNote && statusChanged
        ? {
            status: nextStatus,
            note: body.reviewNote,
            decidedAt: updateResult.decisionEvent.createdAt.toISOString()
          }
        : undefined;
    sendSuccess(
      res,
      toDto(
        updated,
        undefined,
        allowedNextStatuses(config, updated, session),
        updated.ownerId === session.userId && canEditStatus(config.key, updated.status),
        latestReview
      )
    );
  })
);

router.get(
  "/workspace/:collection/:id/history",
  asyncRoute(async (req, res) => {
    const session = getSession(req);
    assertTenantSession(session);
    if (session.role !== "ADMIN") {
      throw new WorkspaceHttpError(403, "Moderation history is available to administrators only");
    }
    const config = requireConfig(routeParam(req.params.collection, "collection"));
    const itemId = routeParam(req.params.id, "id");
    const item = await workspacePrisma.workspaceItem.findFirst({
      where: {
        id: itemId,
        tenantId: session.tenantId,
        collection: config.dbCollection as WorkspaceCollection
      },
      select: {id: true}
    });
    if (!item) throw new WorkspaceHttpError(404, "Workspace item not found");

    const events = await workspacePrisma.workspaceEvent.findMany({
      where: {tenantId: session.tenantId, itemId: item.id},
      orderBy: {createdAt: "desc"},
      take: 50,
      select: {
        action: true,
        toStatus: true,
        fromStatus: true,
        metadata: true,
        createdAt: true,
        actor: {select: {role: true}}
      }
    });
    sendSuccess(res, {
      itemId: item.id,
      events: events.map((event) => ({
        status: event.toStatus ?? event.fromStatus,
        action: event.action,
        note: reviewNoteFromMetadata(event.metadata),
        actorLabel: !event.actor ? "Guest" :
          event.actor.role === "ADMIN"
            ? "Platform administrator"
            : event.actor.role
                .toLowerCase()
                .split("_")
                .map((part) => part[0]?.toUpperCase() + part.slice(1))
                .join(" "),
        timestamp: event.createdAt.toISOString()
      }))
    });
  })
);

router.get(
  "/public/properties/:id/contact",
  requireSessionMiddleware,
  asyncRoute(async (req, res) => {
    const session = getSession(req);
    assertTenantSession(session);
    const property = await workspacePrisma.workspaceItem.findFirst({
      where: {
        id: routeParam(req.params.id, "id"), tenantId: session.tenantId,
        collection: "PROPERTIES", status: "PUBLISHED", publicAt: {not: null},
        children: {some: {
          tenantId: session.tenantId, collection: "PROPERTY_INQUIRIES", ownerId: session.userId,
          status: {notIn: ["SPAM", "ARCHIVED"]}, data: {path: ["consentAccepted"], equals: true}
        }}
      },
      select: {data: true}
    });
    const phone = property && sharedPropertyPhone(asJsonObject(property.data));
    if (!phone) throw new WorkspaceHttpError(404, "Contact details are unavailable. Send an enquiry to request access.");
    res.set("Cache-Control", "private, no-store");
    sendSuccess(res, {phone});
  })
);

async function publicTenantId(req: WorkspaceRequest) {
  if (req.session?.tenantId) return req.session.tenantId;
  const tenant = await workspacePrisma.tenant.findFirst({where: {id: env.PUBLIC_TENANT_ID, isDemo: false}, select: {id: true}});
  return tenant?.id;
}

router.get("/public/properties/suggestions", asyncRoute(async (req, res) => {
  const {q, country, directory, preferred} = z.object({q: z.string().trim().min(2).max(120), country: listingCountry.optional(), preferred: listingCountry.optional(),
    directory: z.enum(["properties", "projects", "dealers", "materials", "professionals", "jobs", "workers", "finance-services"]).optional()}).parse(req.query);
  const tenantId = await publicTenantId(req);
  sendSuccess(res, tenantId ? await propertySuggestions(tenantId, q, country, directory, preferred) : []);
}));

router.get("/public/properties/categories", asyncRoute(async (req, res) => {
  const {place} = z.object({place: placeQuery}).parse(req.query);
  const tenantId = await publicTenantId(req);
  const location = place.length ? [{OR: place.map((entry) => placeFilter(entry, "properties"))}] : [];
  const counts = await Promise.all(Object.entries(propertyCategoryCards).map(async ([key, types]) => [
    key,
    tenantId ? await workspacePrisma.workspaceItem.count({where: {
      tenantId, collection: "PROPERTIES", status: "PUBLISHED", publicAt: {not: null},
      AND: [...location, {OR: types.map(propertyTypeFilter)}],
    }}) : 0,
  ]));
  sendSuccess(res, Object.fromEntries(counts));
}));

router.get("/public/:collection/facets", asyncRoute(async (req, res) => {
  const alias = routeParam(req.params.collection, "collection");
  const config = publicAliasToCollection[alias];
  if (!config?.publicStatuses) throw new WorkspaceHttpError(404, "Unknown public collection");
  const tenantId = await publicTenantId(req);
  if (!tenantId) {sendSuccess(res, {}); return;}
  const facets = directoryFacets[alias] ?? {};
  const result = await Promise.all(Object.entries(facets).map(async ([key, field]) => {
    const values = await workspacePrisma.$queryRaw<Array<{value: string}>>`
      SELECT DISTINCT data->>CAST(${field} AS text) AS value FROM "WorkspaceItem" WHERE "tenantId" = ${tenantId}
        AND collection = CAST(${config.dbCollection} AS "WorkspaceCollection") AND "publicAt" IS NOT NULL
        AND status IN (${Prisma.join(config.publicStatuses!)}) AND length(data->>CAST(${field} AS text)) > 0 ORDER BY value LIMIT 60
    `;
    return [key, values.map(({value}) => value)];
  }));
  sendSuccess(res, Object.fromEntries(result));
}));

router.get(
  ["/public/:collection", "/public/:collection/search"],
  asyncRoute(async (req, res) => {
    const config = publicAliasToCollection[routeParam(req.params.collection, "collection")];
    if (!config?.publicStatuses) throw new WorkspaceHttpError(404, "Unknown public collection");
    const query = publicQuerySchema.parse(req.query);
    const paginated = req.path.endsWith("/search");
    if (paginated && config.key !== "properties") throw new WorkspaceHttpError(404, "Unknown paginated directory.");
    if (paginated && query.sort.startsWith("price-") && !query.currency) throw new WorkspaceHttpError(422, "Select a currency to sort by price.", "currency");
    if (paginated && (query.minArea !== undefined || query.maxArea !== undefined) && !query.unit) throw new WorkspaceHttpError(422, "Select an area unit.", "unit");
    if (query.minArea !== undefined && query.maxArea !== undefined && query.minArea > query.maxArea) throw new WorkspaceHttpError(422, "Maximum area must be at least the minimum area.", "maxArea");
    const featuredOnly = config.key === "properties" && query.featured === "1";
    const featuredDealersOnly = config.key === "dealerProfiles" && query.featured === "1";
    const areaMatch = query.nearArea;
    const cityMatch = query.nearCity;
    const stateMatch = query.nearState;
    const locationListing = config.key === "properties" || config.key === "jobs" || config.key === "dealerProfiles";
    function countryWhere(code: string): Prisma.WorkspaceItemWhereInput {
      const match = {data: {path: ["countryCode"], equals: code}};
      return code === defaultListingCountry ? {OR: [match, {data: {path: ["countryCode"], equals: Prisma.AnyNull}}]} : match;
    }
    const propertyFilters: Prisma.WorkspaceItemWhereInput[] = [];
    if (!query.item && query.place.length) propertyFilters.push({OR: query.place.map((place) => placeFilter(place, config.key))});
    if (!query.item && config.key !== "properties") {
      const filtersByCollection: Partial<Record<CollectionKey, Record<string, string | undefined>>> = {
        materialProducts: {brand: query.brand, availabilityStatus: query.availability, currency: query.currency},
        workerProfiles: {trade: query.trade, currency: query.currency},
        serviceProfiles: {serviceType: query.serviceType}, jobs: {employmentType: query.employment, workMode: query.workMode},
        builderProjects: {projectType: query.projectType},
      };
      const values = filtersByCollection[config.key];
      for (const [field, value] of Object.entries(values ?? {})) {
        if (value) propertyFilters.push({data: {path: [field], equals: value}});
      }
      const priceField = config.key === "materialProducts" ? "indicativePrice" : config.key === "workerProfiles" ? "dailyRate" : null;
      if (priceField && query.minPrice !== undefined) propertyFilters.push({data: {path: [priceField], gte: query.minPrice}});
      if (priceField && query.maxPrice !== undefined) propertyFilters.push({data: {path: [priceField], lte: query.maxPrice}});
      if (config.key === "workerProfiles" && query.availability === "AVAILABLE") propertyFilters.push({status: "AVAILABLE"});
      if (config.key === "workerProfiles" && query.availability === "BUSY") propertyFilters.push({status: "BUSY"});
      if (config.key === "serviceProfiles" && query.experience !== undefined) propertyFilters.push({data: {path: ["yearsExperience"], gte: query.experience}});
      if (config.key === "serviceProfiles" && query.scope) {
        const legal = {OR: ["lawyer", "legal", "vastu", "document"].map((value) => ({data: {path: ["serviceType"], string_contains: value, mode: "insensitive" as const}}))};
        propertyFilters.push(query.scope === "legal-vastu" ? legal : {NOT: legal});
      }
    }
    if (config.key === "jobs" && query.acceptingApplications) {
      propertyFilters.push({OR: [
        {data: {path: ["applicationDeadline"], gte: new Date().toISOString().slice(0, 10)}},
        {data: {path: ["applicationDeadline"], equals: Prisma.AnyNull}}
      ]});
    }
    const materials = config.key === "materialProducts" && !query.item;
    if (query.q && !query.item) {
      const search = query.q;
      const fields = ["trade", "primaryTrade", "category", "categoryId", "employmentType", "workMode", "propertyType", "areaUnit", "brand", "brandName", "unit", "serviceType", "employerName", "reraNumber", "propertyCategory", "projectType", "agencyName", "variant", "specification", "projectName"];
      const propertyKeywordMatches: Prisma.WorkspaceItemWhereInput[] = config.key === "properties" ? [
        ...["city", "state", "locality", "projectOrSociety", "propertyTypeOther", "constructionStatus"].map((key) => ({data: {path: [key], string_contains: search, mode: "insensitive" as const}})),
        placeFilter({kind: "city", value: search, country: query.country}, config.key),
        {data: {path: ["propertyType"], string_contains: propertyTypeKey(search), mode: "insensitive"}},
        {data: {path: ["constructionStatus"], string_contains: propertyTypeKey(search), mode: "insensitive"}},
      ] : [];
      propertyFilters.push({OR: [
        {title: {contains: search, mode: "insensitive"}},
        {description: {contains: search, mode: "insensitive"}},
        ...propertyKeywordMatches,
        ...fields.filter((field) => config.publicDataKeys?.includes(field)).map((field) => ({data: {path: [field], string_contains: search, mode: "insensitive" as const}})),
      ]});
    }
    if (!materials && query.city && !query.item) {
      const cityText: Prisma.WorkspaceItemWhereInput = {data: {path: ["city"], string_contains: query.city, mode: "insensitive"}};
      propertyFilters.push(config.key === "properties" ? {OR: [cityText, placeFilter({kind: "city", value: query.city, country: query.country}, config.key)]} : cityText);
    }
    if (!materials && query.category && !query.item && config.key !== "properties") {
      propertyFilters.push({OR: ["category", "serviceType", "trade"].map((field) => ({data: {path: [field], string_contains: query.category, mode: "insensitive" as const}}))});
    }
    const locationFilter = query.location ?? (materials ? query.city : undefined);
    const deliveryLocations = materials ? findDeliveryCities(locationFilter, query.country) : [];
    const deliveryFilter = materials && (query.cityId || deliveryLocations.length) ? {OR: [
      ...(query.cityId ? [query.cityId] : deliveryLocations.map(({id}) => id)).map((id) => ({data: {path: ["deliveryCityIds"], array_contains: [id]}})),
      ...(!query.cityId && locationFilter ? [{data: {path: ["deliveryCities"], array_contains: [locationFilter]}}] : []),
    ]} : null;
    const selectedLocation = config.key === "properties" && locationFilter && query.locationKind
      ? {data: {path: [query.locationKind], equals: locationFilter}} : null;
    const searchLocationKeys = ["city", "cityName", "locality", "localityName", "cityId", ...(config.key === "properties" ? ["state"] : [])];
    const browsingLocation = selectedLocation ?? deliveryFilter ?? (locationFilter && !query.item ? {OR: [
      ...searchLocationKeys.map((key) => ({data: {path: [key], string_contains: locationFilter, mode: "insensitive" as const}})),
      ...(config.key === "properties" ? [placeFilter({kind: "city", value: locationFilter, country: query.country}, config.key)] : []),
      ...["deliveryCities", "citiesServed", "serviceAreas"].map((key) => ({data: {path: [key], array_contains: [locationFilter]}})),
    ]} : null);
    if (materials && query.category) {
      const option = materialCategories.find(({value}) => value === materialOptionValue(materialCategories, query.category));
      const keys = [...new Set((option?[option.value, option.label, ...option.aliases]:[query.category]).flatMap(value=>[value,value.toLowerCase(),value.toUpperCase()]))];
      propertyFilters.push({OR:[{materialProduct:{category:{OR:[{id:query.category},{code:{in:keys}},{name:{equals:query.category,mode:"insensitive"}}]}}},...keys.map(value=>({data:{path:["category"],equals:value}}))]});
    }
    if (config.key === "properties" && !query.item) {
      if (query.intent) propertyFilters.push({data: {path: ["listingIntent"], equals: query.intent}});
      if (query.category) propertyFilters.push({data: {path: ["propertyCategory"], equals: query.category.toUpperCase()}});
      if (query.segment === "PLOT_LAND") propertyFilters.push({data: {path: ["propertyCategory"], equals: query.segment}});
      if (query.segment === "RESIDENTIAL" || query.segment === "COMMERCIAL") {
        const plotTypes = query.segment === "RESIDENTIAL" ? ["RESIDENTIAL_PLOT"] : ["COMMERCIAL_PLOT", "INDUSTRIAL_PLOT"];
        propertyFilters.push({OR: [
          {data: {path: ["propertyCategory"], equals: query.segment}},
          {AND: [{data: {path: ["propertyCategory"], equals: "PLOT_LAND"}}, {OR: plotTypes.map(propertyTypeFilter)}]}
        ]});
      }
      if (query.propertyType) propertyFilters.push({OR: [
        propertyTypeFilter(query.propertyType),
        {data: {path: ["propertyTypeOther"], string_contains: query.propertyType.replaceAll("_", " "), mode: "insensitive"}},
      ]});
      if (query.types?.length) propertyFilters.push({OR: [...new Set(query.types)].map(propertyTypeFilter)});
      if (query.currency) propertyFilters.push({data: {path: ["currency"], equals: query.currency}});
      if (query.budget) propertyFilters.push(propertyBudgetFilter(query.budget));
      if (query.minPrice !== undefined) propertyFilters.push({property:{OR:[{price:{gte:query.minPrice}},{priceMode:"RANGE",maxPrice:{gte:query.minPrice}}]}});
      if (query.maxPrice !== undefined) propertyFilters.push({property:{price:{lte:query.maxPrice}}});
      if (query.bedrooms !== undefined) propertyFilters.push({data: {path: ["bedrooms"], ...(query.bedrooms === "5+" ? {gte: 5} : {equals: Number(query.bedrooms)})}});
      if (query.construction) propertyFilters.push({data: {path: ["constructionStatus"], equals: query.construction}});
      for (const field of ["parking", "furnishing", "powerBackup"] as const) {
        const value = query[field];
        if (!value) continue;
        const exact = {data: {path: [field], equals: value}};
        propertyFilters.push(field === "parking" && (value === "COVERED_PARKING" || value === "OPEN_PARKING")
          ? {OR: [exact, {data: {path: [field], equals: "OPEN_AND_COVERED"}}]}
          : exact);
      }
      if(query.postedBy)propertyFilters.push({property:{source:query.postedBy}});
      for(const code of new Set(query.amenity?.split(",").filter(Boolean)))propertyFilters.push({property:{amenities:{some:{master:{code}}}}});
      if(query.floor!==undefined)propertyFilters.push({data:{path:["floorNumber"],equals:query.floor}});
      if(query.possessionBy)propertyFilters.push({property:{possessionDate:{lte:query.possessionBy}}});
      if(query.verifiedSeller)propertyFilters.push({property:{OR:[{ownerProfile:{profile:{verification:"VERIFIED"}}},{dealerProfile:{profile:{verification:"VERIFIED"}}},{builderProfile:{profile:{verification:"VERIFIED"}}}]}});
      const factor=query.unit?squareFeet[query.unit]:undefined;
      if(factor && (query.minArea!==undefined||query.maxArea!==undefined))propertyFilters.push({property:{areaSqft:{gte:query.minArea!==undefined?query.minArea*factor:undefined,lte:query.maxArea!==undefined?query.maxArea*factor:undefined}}});
      else {
      if (query.unit) propertyFilters.push({data: {path: ["areaUnit"], equals: query.unit}});
      if (query.minArea !== undefined) propertyFilters.push({data: {path: ["areaValue"], gte: query.minArea}});
      if (query.maxArea !== undefined) propertyFilters.push({data: {path: ["areaValue"], lte: query.maxArea}});
      }
      if (query.rera) propertyFilters.push({AND: [{NOT: {data: {path: ["reraNumber"], equals: Prisma.AnyNull}}}, {NOT: {data: {path: ["reraNumber"], equals: ""}}}]});
    }
    const nearbyDeliveryIds = materials ? findDeliveryCities(cityMatch, query.nearCountry, stateMatch).map(({id}) => id) : [];
    const cityFields = [
      ...(cityMatch ? ["city", "cityName"].map((key) => ({data: {path: [key], string_contains: cityMatch, mode: "insensitive" as const}})) : []),
      ...(cityMatch ? ["deliveryCities", "citiesServed"].map((key) => ({data: {path: [key], array_contains: [cityMatch]}})) : []),
      ...nearbyDeliveryIds.map((id) => ({data: {path: ["deliveryCityIds"], array_contains: [id]}})),
    ];

    const tenantId = await publicTenantId(req);
    if (!tenantId) {
      sendSuccess(res, paginated ? {items: [], related: [], total: 0, page: query.page, pageSize: 20} : []);
      return;
    }

    if (config.key === "properties" && query.dealer && !query.item) {
      const profile = await workspacePrisma.workspaceItem.findFirst({
        where: {tenantId, collection: "DEALER_PROFILES", status: "VERIFIED", publicAt: {not: null}, owner: {role: "DEALER"},
          OR: [{id: query.dealer}, {data: {path: ["slug"], equals: query.dealer}}]},
        select: {ownerId: true},
      });
      propertyFilters.push({ownerId: {in: profile?.ownerId ? [profile.ownerId] : []}});
    }

    const now = new Date();
    const benefit = publicBenefits[config.key];
    const profileDirectory = ["dealerProfiles","builderProjects","serviceProfiles","workerProfiles"].includes(config.key);
    const [activePackages, paidPlacements, profilePlans] = await Promise.all([
      benefit ? workspacePrisma.billingEntitlement.findMany({
        where: activeBenefit(tenantId, benefit, now), select: {userId: true, targetId: true},
      }) : [],
      directoryFeatures.has(config.key) ? workspacePrisma.billingEntitlement.findMany({
        where: {...activeBenefit(tenantId, "LISTING_FEATURE", now), targetId: {not: null}, sourceOrder: {status: "CAPTURED"}},
        select: {targetId: true},
      }) : [],
      profileDirectory ? workspacePrisma.billingEntitlement.findMany({where: {...activeBenefit(tenantId, "PROFILE_FEATURE", now), sourceOrder: {status: "CAPTURED"}}, select: {userId: true}}) : [],
    ]);
    const isDealer = config.key === "dealerProfiles";
    const isAd = config.key === "adCampaigns";
    const priorityIds = new Set(activePackages.flatMap(({userId, targetId}) => isDealer ? [userId] : targetId ? [targetId] : []));
    for (const {userId} of profilePlans) priorityIds.add(userId);
    const matchPriority = profileDirectory ? "ownerId" : "id";
    const boostFilter = priorityIds.size ? {[matchPriority]: {in: [...priorityIds]}} : undefined;
    const paidIds = new Set(paidPlacements.flatMap(({targetId}) => targetId ? [targetId] : []));
    const paidFilter = {id: {in: [...paidIds]}};
    const featureFilters = [boostFilter, paidIds.size ? paidFilter : undefined].filter((entry) => entry !== undefined);
    const priorityFilter: Prisma.WorkspaceItemWhereInput | undefined = featureFilters.length ? {
      OR: featureFilters,
      ...(config.key === "jobs" ? {AND: [{OR: [
        {data: {path: ["applicationDeadline"], gte: now.toISOString().slice(0, 10)}},
        {data: {path: ["applicationDeadline"], equals: Prisma.AnyNull}},
      ]}]} : {}),
    } : undefined;
    const baseListingWhere: Prisma.WorkspaceItemWhereInput = {
      tenantId,
      collection: config.dbCollection as WorkspaceCollection,
      status: {in: [...config.publicStatuses]},
      publicAt: {not: null},
    };
    const baseWhere: Prisma.WorkspaceItemWhereInput = {
      ...baseListingWhere,
      ...(featuredOnly ? paidFilter : {}),
      ...(featuredDealersOnly ? {AND: [
        priorityFilter ?? {id: {in: []}},
        {owner: {is: {role: "DEALER", status: "ACTIVE"}}},
      ]} : {}),
      ...(query.item ? {OR: [{id: query.item}, {data: {path: ["slug"], equals: query.item}}]} : {}),
      ...(isAd ? {parent: {is: {tenantId, collection: "BUILDER_PROJECTS", status: "PUBLISHED"}}} : {})
    };
    if (config.key === "properties" && !query.item && (query.landmark || query.landmarkFrom || query.landmarkKind)) {
      if (!query.landmarkFrom || !query.landmark || !query.landmarkKind) throw new WorkspaceHttpError(422, "Choose a nearby place from a property.");
      const source = await workspacePrisma.workspaceItem.findFirst({where: {...baseListingWhere, id: query.landmarkFrom}, select: {data: true}});
      const sourceData = source ? asJsonObject(source.data) : {};
      const landmark = source && (await nearbyLandmarks(sourceData)).places.find(place => place.name === query.landmark && place.category === query.landmarkKind);
      const ids: string[] = [];
      if (landmark) {
        // Only inspect plausible neighbourhoods. The final distance uses the same rounded area as the public nearby list.
        const lat = landmark.latitude, lon = landmark.longitude;
        const latSpan = .06, lonSpan = latSpan / Math.max(.001, Math.cos(Math.min(89.99, Math.abs(lat) + latSpan) * Math.PI / 180));
        const boxes: Prisma.WorkspaceItemWhereInput[] = [["mapLocation"], []].map(prefix => ({
          AND: [{data: {path: [...prefix, "latitude"], gte: lat - latSpan, lte: lat + latSpan}},
            ...(Math.abs(lon) + lonSpan < 180 ? [{data: {path: [...prefix, "longitude"], gte: lon - lonSpan, lte: lon + lonSpan}}] : [])],
        }));
        if (typeof sourceData.city === "string") boxes.push({AND: [
          countryWhere(typeof sourceData.countryCode === "string" ? sourceData.countryCode : defaultListingCountry),
          {data: {path: ["city"], string_contains: sourceData.city, mode: "insensitive"}},
          {data: {path: ["mapLocation", "latitude"], equals: Prisma.AnyNull}},
          {data: {path: ["latitude"], equals: Prisma.AnyNull}},
        ]});
        let after: string | undefined;
        while (true) {
          const batch: {id:string;data:Prisma.JsonValue}[] = await workspacePrisma.workspaceItem.findMany({
            where: {...baseListingWhere, OR: boxes, ...(after ? {id: {gt: after}} : {})},
            orderBy: {id: "asc"}, select: {id:true, data:true}, take: 200,
          });
          for (const record of batch) if (areaContainsLandmark(propertyNearbyArea(asJsonObject(record.data)), landmark)) ids.push(record.id);
          if (batch.length < 200) break;
          after = batch[batch.length - 1]!.id;
        }
      }
      propertyFilters.push({id: {in: ids}});
    }
    const publicWhere = {AND: [baseWhere, ...propertyFilters, ...(browsingLocation ? [browsingLocation] : []), ...(locationListing && !query.item && query.country ? [countryWhere(query.country)] : [])]};
    const mapProperty = (item: {id: string; data: Prisma.JsonValue}) => asJsonObject(item.data);
    const relatedWhere = (items: Array<{id: string; data: Prisma.JsonValue}>, exclude: string[]): Prisma.WorkspaceItemWhereInput => {
      const fields: Prisma.WorkspaceItemWhereInput[] = [];
      for (const item of items.slice(0, 6)) {
        const data = mapProperty(item);
        if (typeof data.city !== "string" || !data.city || typeof data.listingIntent !== "string" || typeof data.propertyType !== "string") continue;
        fields.push({AND: [
          countryWhere(typeof data.countryCode === "string" ? data.countryCode : defaultListingCountry),
          ...["city", "listingIntent", "propertyType"].map((key) => ({data: {path: [key], equals: String(data[key])}})),
          ...(typeof data.state === "string" && data.state ? [{data: {path: ["state"], equals: data.state}}] : []),
        ]});
      }
      return {AND: [baseListingWhere, {id: {notIn: exclude}}, {OR: fields}]};
    };
    const paged = paginated ? await (async () => {
      const pageSize = 20;
      const orderBy: Prisma.WorkspaceItemOrderByWithRelationInput[] = [
        ...(query.sort.startsWith("area-")?[{property:{areaSqft:{sort:query.sort==="area-low"?"asc" as const:"desc" as const,nulls:"last" as const}}}]:[]),
        ...(query.sort.startsWith("price-") ? [{property:{price: {sort: query.sort === "price-low" ? "asc" as const : "desc" as const, nulls: "last" as const}}}] : []),
        {publicAt: "desc"}, {id: "desc"},
      ];
      const rankedOrder = [{featuredOrder: {sort: "asc" as const, nulls: "last" as const}}, ...orderBy];
      const source = query.relatedTo ? await workspacePrisma.workspaceItem.findFirst({where: {...baseWhere, id: query.relatedTo}}) : null;
      const where = query.relatedTo ? relatedWhere(source ? [source] : [], [query.relatedTo]) : publicWhere;
      const skip = (query.page - 1) * pageSize;
      const {items, total} = await workspacePrisma.$transaction(async (tx) => {
        const total = await tx.workspaceItem.count({where});
        if (query.sort !== "match" || !paidIds.size || featuredOnly || source) {
          return {total, items: await tx.workspaceItem.findMany({where, orderBy: featuredOnly ? rankedOrder : orderBy, skip, take: pageSize})};
        }
        const paidWhere = {AND: [where, paidFilter]};
        const paidCount = await tx.workspaceItem.count({where: paidWhere});
        const paidPage = skip < paidCount ? await tx.workspaceItem.findMany({where: paidWhere, orderBy: rankedOrder, skip, take: pageSize}) : [];
        const regular = paidPage.length < pageSize ? await tx.workspaceItem.findMany({
          where: {AND: [where, {NOT: paidFilter}]}, orderBy, skip: Math.max(0, skip - paidCount), take: pageSize - paidPage.length,
        }) : [];
        return {total, items: [...paidPage, ...regular]};
      }, {isolationLevel: "RepeatableRead"});
      if (source && mapProperty(source).locality) {
        const locality = mapProperty(source).locality;
        items.sort((left, right) => Number(mapProperty(right).locality === locality) - Number(mapProperty(left).locality === locality));
      }
      const related = query.relatedTo || !items.length ? [] : await workspacePrisma.workspaceItem.findMany({
        where: relatedWhere(items, items.map(({id}) => id)), orderBy: [{publicAt: "desc"}, {id: "desc"}], take: 24,
      });
      const localities = new Set(items.map((item) => mapProperty(item).locality).filter(Boolean));
      related.sort((left, right) => Number(localities.has(mapProperty(right).locality)) - Number(localities.has(mapProperty(left).locality)));
      return {items, related: related.slice(0, 6), total, pageSize};
    })() : null;
    const listPublicItems = (where: Prisma.WorkspaceItemWhereInput) => workspacePrisma.workspaceItem.findMany({
      where: {AND: [publicWhere, where]},
      orderBy: [...(featuredOnly ? [{featuredOrder: {sort: "asc" as const, nulls: "last" as const}}] : []), {publicAt: "desc"}, {createdAt: "desc"}],
      take: query.limit
    });
    const [priority, regular, localArea, localCity, localState, localCountry] = paged ? [[], paged.items, [], [], [], []] : await Promise.all([
      priorityFilter ? listPublicItems(priorityFilter) : Promise.resolve([]),
      isAd ? Promise.resolve([]) : listPublicItems(priorityFilter ? {NOT: priorityFilter} : {}),
      !isAd && !query.item && areaMatch && cityFields.length
        ? listPublicItems({AND: [{OR: cityFields}, {data: {path: ["locality"], string_contains: areaMatch, mode: "insensitive"}}]}) : [],
      !isAd && !query.item && cityFields.length ? listPublicItems({OR: cityFields}) : [],
      !isAd && !query.item && stateMatch
        ? listPublicItems({data: {path: ["state"], string_contains: stateMatch, mode: "insensitive"}}) : [],
      locationListing && !query.item && !query.country && query.nearCountry ? listPublicItems(countryWhere(query.nearCountry)) : [],
    ]);
    const normalize = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";
    const score = (item: typeof regular[number]) => {
      const data = asJsonObject(item.data);
      const city = normalize(cityMatch);
      const area = normalize(areaMatch);
      const state = normalize(stateMatch);
      const country = locationListing && query.nearCountry ? query.nearCountry : "";
      const sameCountry = country && (data.countryCode ?? defaultListingCountry) === country;
      if (country && !sameCountry) return 0;
      const countryScore = sameCountry ? 1 : 0;
      const delivery = Array.isArray(data.deliveryCities) ? data.deliveryCities : [];
      const deliveryIds = Array.isArray(data.deliveryCityIds) ? data.deliveryCityIds : [];
      if (nearbyDeliveryIds.some((id) => deliveryIds.includes(id))) return countryScore + 2;
      const served = Array.isArray(data.citiesServed) ? data.citiesServed : [];
      if (city && [data.city, data.cityName, ...delivery, ...served].some((value) => normalize(value) === city)) {
        return countryScore + (area && normalize(data.locality ?? data.localityName) === area ? 3 : 2);
      }
      return countryScore + (state && normalize(data.state) === state ? 1 : 0);
    };
    const candidates = [...new Map([...priority, ...localArea, ...localCity, ...localState, ...localCountry, ...regular].map((item) => [item.id, item])).values()];
    function hasPlacement(item: typeof regular[number]) {
      const promoted = paidIds.has(item.id) || priorityIds.has(item[matchPriority] ?? "");
      return promoted && (config.key !== "jobs" || jobAcceptsApplications(asJsonObject(item.data)));
    }
    if (featuredOnly) candidates.sort((left, right) => (left.featuredOrder ?? Infinity) - (right.featuredOrder ?? Infinity) || 0);
    else if (!paged) candidates.sort((left, right) => Number(hasPlacement(right)) - Number(hasPlacement(left)) || score(right) - score(left));
    const visible = candidates.filter((item) => {
      if (!isAd) return true;
      const {startsAt, endsAt} = asJsonObject(item.data);
      return typeof startsAt === "string" && typeof endsAt === "string" &&
        new Date(startsAt) <= now && new Date(endsAt) > now;
    }).slice(0, query.limit);
    const displayed = [...visible, ...(paged?.related ?? [])];
    const typedProperties = config.key==="properties"?await workspacePrisma.property.findMany({where:{tenantId,id:{in:displayed.map(i=>i.id)}},select:{id:true,latitude:true,longitude:true,addressVisibility:true,source:true,availability:true,price:true,priceMode:true,areaValue:true,pricePerSqft:true,transactionType:true,cityName:true,localityName:true,bedrooms:true,bathrooms:true}}):[];
    const byListing=new Map(typedProperties.map(p=>[p.id,p]));
    const [views, postersById] = config.key === "properties" ? await Promise.all([
      propertyViewCounts(displayed.map(({id}) => id)),
      publicPropertyPosters(tenantId, displayed.flatMap(({ownerId}) => ownerId ? [ownerId] : []), Boolean(query.item)),
    ]) : [null, null];
    const dealerIds = featuredDealersOnly ? [...new Set(visible.flatMap(({ownerId}) => ownerId ? [ownerId] : []))] : [];
    const [dealers, dealerListings, dealerEnquiries] = dealerIds.length ? await Promise.all([
      workspacePrisma.user.findMany({
        where: {tenantId, id: {in: dealerIds}}, select: {id: true, fullName: true, createdAt: true, profileLogoUrl: true},
      }),
      workspacePrisma.workspaceItem.groupBy({
        by: ["ownerId"], where: {tenantId, collection: "PROPERTIES", status: "PUBLISHED", publicAt: {not: null}, ownerId: {in: dealerIds}},
        _count: true,
      }),
      workspacePrisma.workspaceItem.groupBy({
        by: ["targetUserId"], where: {tenantId, collection: "PROPERTY_INQUIRIES", targetUserId: {in: dealerIds},
          status: {notIn: ["SPAM", "REJECTED"]}, createdAt: {gte: new Date(now.getTime() - 7 * 86_400_000)}},
        _count: true,
      }),
    ]) : [[], [], []];
    const productDetails = query.item && config.key==="materialProducts" ? await workspacePrisma.materialProduct.findMany({
      where:{tenantId,id:{in:visible.map(i=>i.id)}},select:{id:true,subcategory:{select:{name:true}},category:{select:{name:true}},unit:{select:{name:true}},
      specifications:{select:{value:true,definition:{select:{name:true,unit:true}}},orderBy:{definition:{sortOrder:"asc"}}}}}):[];
    const businessCards=await publicBusinessProfiles(tenantId,config.key,query.item || isDealer ? visible.flatMap(i=>i.ownerId?[i.ownerId]:[]):[]);
    const dealerById = new Map(dealers.map((dealer) => [dealer.id, dealer]));
    const listingCount = new Map(dealerListings.map(({ownerId, _count}) => [ownerId, _count]));
    const enquiryCount = new Map(dealerEnquiries.map(({targetUserId, _count}) => [targetUserId, _count]));
    const projectItem = (item: typeof regular[number]) => {
      const safeData = publicDataFor(config, asJsonObject(item.data));
      const product=productDetails.find(p=>p.id===item.id);
      if(product){safeData.categoryLabel=product.category?.name;safeData.subcategoryLabel=product.subcategory?.name;safeData.unitLabel=product.unit?.name;
        safeData.technicalSpecs=product.specifications.map(s=>({name:s.definition.name,unit:s.definition.unit,value:s.value}));}
      const business=businessCards.get(item.ownerId??"");
      if(business)safeData.businessProfile=business;
      if (isDealer) safeData.pro = priorityIds.has(item.ownerId ?? "");
      if (directoryFeatures.has(config.key)) safeData.featured = hasPlacement(item);
      const dealer = dealerById.get(item.ownerId ?? "");
      if (dealer) {
        safeData.dealerName = dealer.fullName;
        safeData.memberSince = dealer.createdAt.toISOString();
        safeData.propertyCount = listingCount.get(dealer.id) ?? 0;
        safeData.weeklyEnquiries = enquiryCount.get(dealer.id) ?? 0;
        if (!safeData.logoUrl && dealer.profileLogoUrl && (listingCount.get(dealer.id) ?? 0) > 0) safeData.logoUrl = dealer.profileLogoUrl;
      }
      if (config.key === "jobs") {
        safeData.acceptingApplications = jobAcceptsApplications(safeData);
      }
      if (config.key === "workerProfiles") safeData.availableNow = item.status === "AVAILABLE";
      if (config.key === "properties") {
        const property=byListing.get(item.id);
        if(property?.addressVisibility!=="LOCALITY_ONLY"&&property?.latitude!=null&&property.longitude!=null){
          // Search maps show only the approximate area; precise pins use the detail access flow.
          safeData.searchPin={latitude:Math.round(Number(property.latitude)*100)/100,longitude:Math.round(Number(property.longitude)*100)/100};
        }
        if(property){safeData.availability=property.availability;safeData.listingIntent=property.transactionType;safeData.price=property.price?.toNumber();safeData.pricePerSqft=property.pricePerSqft?.toNumber();safeData.areaValue=property.areaValue?.toNumber();safeData.bedrooms=property.bedrooms;safeData.bathrooms=property.bathrooms;if(property.cityName)safeData.city=property.cityName;if(property.localityName)safeData.locality=property.localityName;}
        const poster=postersById?.get(item.ownerId??"");safeData.postedBy=poster?{...poster,role:property?.source??poster.role}:undefined;
        safeData.postedAt = (item.publicAt ?? item.createdAt).toISOString();
        safeData.viewCount = views?.get(item.id) ?? 0;
        if (!query.item) for(const key of ["aboutPropertyHtml","additionalCharges","areaUnits","videoTours","localPlaces","galleryDetails"])delete safeData[key];
      }
      return {...toDto(item, safeData), ...(config.key === "properties" ? {featured: hasPlacement(item)} : {})};
    };
    const data = visible.map(projectItem);
    sendSuccess(res, paged ? {items: data, related: paged.related.map(projectItem), page: query.page, pageSize: paged.pageSize, total: paged.total} : data);
  })
);

router.use((error: unknown, _req: WorkspaceRequest, res: Response, next: NextFunction) => {
  if (error instanceof z.ZodError) {
    const fieldErrors = new Map<string, string[]>();
    for (const issue of error.issues) {
      const path = issue.path.join(".");
      fieldErrors.set(path, [...(fieldErrors.get(path) ?? []), issue.message]);
    }
    sendFailure(res, {statusCode: 422, code: "VALIDATION_ERROR", message: "Request validation failed", details: Object.fromEntries(fieldErrors)});
    return;
  }
  if (error instanceof WorkspaceHttpError) {
    sendFailure(res, {statusCode: error.statusCode, code: "WORKSPACE_ERROR", message: error.message,
      details: error.field ? {[error.field]: [error.message]} : undefined});
    return;
  }
  next(error);
});

export {router as workspaceRouter};
