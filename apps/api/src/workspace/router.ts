import {Prisma, WorkspaceCollection, type EntitlementType} from "@prisma/client";
import {Router, type NextFunction, type Response} from "express";
import {z} from "zod";
import {materialCategories, materialOptionValue, workspaceSubmissionStatuses} from "@the-property-pillar/contracts";
import {env} from "../config/env.js";
import {sendFailure, sendSuccess} from "../helpers/api-response.js";
import {requireSession as requireSessionMiddleware} from "../middleware/session.middleware.js";
import {
  collectionConfigs,
  collectionSchemas,
  deliveryCityId,
  publicAliasToCollection,
  type CollectionConfig,
  type CollectionKey
} from "./config.js";
import {workspacePrisma} from "./db.js";
import {resolveJobLocation} from "./job-location.js";
import {findDeliveryCities, getDeliveryCity} from "../locations/delivery-cities.js";
import {prepareMaterialData, quotingRfqStatuses, vendorRfqIds} from "./material-matching.js";
import {defaultListingCountry, listingCountry, validateListingPostalCode} from "./listing-geography.js";
import {assertResumeUploaded} from "../uploads/resumes.js";
import {validateImageAttachments} from "../uploads/images.js";
import type {WorkspaceItemDto, WorkspaceRequest, WorkspaceSession} from "./types.js";
import {
  deriveTrustedData,
  validateCollectionConsistency,
  validateNewSubmission,
  validateTransitionReadiness
} from "./validation.js";

const router: Router = Router();

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
  propertyType: z.string().trim().max(80).optional(),
  intent: z.enum(["SALE", "RENT"]).optional(),
  q: z.string().trim().max(120).optional(),
  nearCity: z.string().trim().min(1).max(120).optional(),
  nearArea: z.string().trim().min(1).max(120).optional(),
  nearState: z.string().trim().min(1).max(120).optional(),
  item: z.string().trim().min(1).max(160).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

class WorkspaceHttpError extends Error {
  constructor(public readonly statusCode: number, message: string, public readonly field?: string) {
    super(message);
  }
}

const explicitlyNullable = new Set(["postalCode", "state", "locality", "cityId", "logoUrl", "coverUrl"]);
const singleProfiles = new Set<CollectionKey>(["dealerProfiles", "serviceProfiles", "workerProfiles"]);

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

function toDto(item: {
  id: string;
  title: string;
  status: string;
  description: string | null;
  data: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}, dataOverride?: Record<string, unknown>, allowedNextStatuses?: string[], canEditContent?: boolean, latestReview?: WorkspaceItemDto["latestReview"]): WorkspaceItemDto {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    description: item.description,
    data: dataOverride ?? asJsonObject(item.data),
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
  return sanitized;
}

function publicDataFor(config: CollectionConfig, data: Record<string, unknown>) {
  const safe = projectData(data, config.publicDataKeys ?? []);
  if (config.key === "properties" || config.key === "jobs" || config.key === "dealerProfiles") safe.countryCode ??= defaultListingCountry;
  if ((config.key === "properties" || config.key === "dealerProfiles") && safe.countryCode !== defaultListingCountry) delete safe.reraNumber;
  if (config.key === "properties") {
    if (safe.propertyType === "OTHER" && typeof data.propertyTypeOther === "string") safe.propertyType = data.propertyTypeOther;
    if (Array.isArray(safe.mediaUrls)) safe.mediaUrls = safe.mediaUrls.slice(0, 15);
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
  item: {ownerId: string; targetUserId: string | null; data: Prisma.JsonValue},
  session: WorkspaceSession,
  config: CollectionConfig
) {
  const data = asJsonObject(item.data);
  if (session.role === "ADMIN" || item.ownerId === session.userId || item.targetUserId === session.userId) {
    if (config.key === "materialProducts" || config.key === "materialRfqs") {
      const ids = Array.isArray(data.deliveryCityIds) ? data.deliveryCityIds : [data.cityId];
      return {...data, deliveryCityOptions: ids.map(getDeliveryCity).filter(Boolean)};
    }
    return data;
  }
  if (config.key === "materialRfqs" && session.role === "VENDOR") return projectData(data, indirectRfqKeys);
  return {};
}

function assertTenantSession(session: WorkspaceSession) {
  if (!session.tenantId || !session.userId) throw new WorkspaceHttpError(401, "Invalid session scope");
}

async function resolveParentAndTarget(
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

  const parent = await workspacePrisma.workspaceItem.findFirst({
    where: {
      id: parentId,
      tenantId: session.tenantId,
      collection: relation.parent as WorkspaceCollection,
      ...(relation.publicStatuses ? {status: {in: [...relation.publicStatuses]}} : {})
    },
    select: {id: true, ownerId: true}
  });
  if (!parent) throw new WorkspaceHttpError(404, "The selected record is no longer available.", relation.field);

  if (config.key === "materialQuotes" && parent.ownerId === session.userId) {
    throw new WorkspaceHttpError(403, "A vendor cannot quote on their own RFQ");
  }
  if (config.key === "materialQuotes" && !(await vendorRfqIds(session.tenantId, session.userId, parent.id)).length) {
    throw new WorkspaceHttpError(409, "This RFQ is closed or does not match a published product in your delivery area.", "rfqId");
  }

  if (config.key === "adCampaigns" && parent.ownerId !== session.userId && session.role !== "ADMIN") {
    throw new WorkspaceHttpError(403, "Campaigns can only target your own project.", "projectId");
  }
  return {parentId: parent.id, targetUserId: parent.ownerId};
}

function canTransition(
  config: CollectionConfig,
  item: {ownerId: string; targetUserId: string | null; status: string},
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
  item: {ownerId: string; targetUserId: string | null; status: string},
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
  return editableContentStatuses.has(status) || (status === "REJECTED" && singleProfiles.has(key));
}

router.use("/workspace", requireSessionMiddleware);

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
            : config.key === "materialRfqs" && session.role === "VENDOR"
              ? {
                  OR: [
                    {ownerId: session.userId},
                    {targetUserId: session.userId},
                    {id: {in: await vendorRfqIds(session.tenantId, session.userId)}}
                  ]
                }
              : {OR: [{ownerId: session.userId}, {targetUserId: session.userId}]};

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
              item.ownerId === session.userId && canEditStatus(config.key, item.status),
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

    const body = createBodySchema.parse(req.body);
    const allowedSubmission = workspaceSubmissionStatuses[config.key as keyof typeof workspaceSubmissionStatuses];
    if (body.status && body.status !== allowedSubmission) throw new WorkspaceHttpError(400, "This is not a valid submission status for this form.", "status");
    const parsedData = collectionSchemas[config.key].parse(sanitizeClientData(body.data)) as Record<string, unknown>;
    const data = config.key === "jobs" ? await resolveJobLocation(parsedData) : prepareMaterialData(config.key, parsedData);
    if (config.key === "properties" || config.key === "jobs") data.countryCode ??= defaultListingCountry;
    if (config.key === "properties" && data.postalCode) validateListingPostalCode(data);
    const initialStatus = body.status ?? config.initialStatus;
    if (body.status) validateTransitionReadiness(config.key, initialStatus, data, body.description);
    validateNewSubmission(config.key, data);
    const trustedData = deriveTrustedData(config.key, initialStatus, data);
    await validateImageAttachments(config.key, trustedData, session);
    if (config.key === "jobApplications") await assertResumeUploaded(parsedData.resumeUrl, session.tenantId, session.userId);
    validateCollectionConsistency(config.key, data);
    const relation = await resolveParentAndTarget(config, data, session);

    if (singleProfiles.has(config.key)) {
      const exists = await workspacePrisma.workspaceItem.findFirst({
        where: {tenantId: session.tenantId, ownerId: session.userId, collection: config.dbCollection as WorkspaceCollection, status: {not: "ARCHIVED"}},
        select: {id: true}
      });
      if (exists) throw new WorkspaceHttpError(409, "Open your existing profile to update or resubmit it.");
    }
    if (["savedProperties", "jobApplications", "materialQuotes"].includes(config.key) && relation.parentId) {
      const duplicate = await workspacePrisma.workspaceItem.findFirst({
        where: {tenantId: session.tenantId, ownerId: session.userId, collection: config.dbCollection as WorkspaceCollection, parentId: relation.parentId, status: {notIn: ["ARCHIVED", "WITHDRAWN"]}},
        select: {id: true}
      });
      const field = config.key === "savedProperties" ? "propertyId" : config.key === "jobApplications" ? "jobId" : "rfqId";
      const message = config.key === "savedProperties" ? "This property is already saved." : config.key === "jobApplications" ? "You already applied for this job." : "You already have a quote for this RFQ.";
      if (duplicate) throw new WorkspaceHttpError(409, message, field);
    }

    const item = await workspacePrisma.$transaction(async (tx) => {
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
          data: asInputJson(trustedData),
          publicAt: publicAtFor(config, initialStatus, null)
        }
      });
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
  "/workspace/:collection/:id",
  asyncRoute(async (req, res) => {
    const session = getSession(req);
    assertTenantSession(session);
    const config = requireConfig(routeParam(req.params.collection, "collection"));
    const itemId = routeParam(req.params.id, "id");
    const body = patchBodySchema.parse(req.body);
    const item = await workspacePrisma.workspaceItem.findFirst({
      where: {id: itemId, tenantId: session.tenantId, collection: config.dbCollection as WorkspaceCollection}
    });
    if (!item) throw new WorkspaceHttpError(404, "Workspace item not found");

    const isOwner = item.ownerId === session.userId;
    const isTarget = item.targetUserId === session.userId;
    const isAdmin = session.role === "ADMIN";
    if (!isOwner && !isTarget && !isAdmin) throw new WorkspaceHttpError(403, "Item is outside your workspace");
    const statusChanged = body.status !== undefined && body.status !== item.status;
    if (body.reviewNote !== undefined && !isAdmin) {
      throw new WorkspaceHttpError(403, "Only an administrator can add a moderation note");
    }
    if (body.reviewNote !== undefined && !statusChanged) {
      throw new WorkspaceHttpError(422, "Choose a status to save a review note.", "status");
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

    const currentData = asJsonObject(item.data);
    const clientPatchData = sanitizeClientData(body.data);
    if (config.key === "jobApplications" && clientPatchData.resumeUrl !== undefined) {
      await assertResumeUploaded(clientPatchData.resumeUrl, session.tenantId, session.userId);
    }
    const privacyOnlyPatch =
      body.title === undefined &&
      body.description === undefined &&
      body.data !== undefined &&
      singleProfiles.has(config.key) &&
      Object.keys(clientPatchData).length > 0 &&
      Object.keys(clientPatchData).every((key) => key === "publicContactConsent");
    if (
      (body.title !== undefined || body.description !== undefined || body.data !== undefined) &&
      (!isOwner || (!canEditStatus(config.key, item.status) && !privacyOnlyPatch))
    ) {
      throw new WorkspaceHttpError(409, "Content cannot be edited in the current state");
    }
    if (body.status && body.status !== item.status && !canTransition(config, item, session, body.status)) {
      throw new WorkspaceHttpError(409, "This status change is no longer available. Refresh the record and choose another status.", "status");
    }

    const relationFields: Partial<Record<CollectionKey, string>> = {
      savedProperties: "propertyId",
      propertyInquiries: currentData.projectId ? "projectId" : "propertyId",
      materialQuotes: "rfqId",
      serviceInquiries: "serviceProfileId",
      jobApplications: "jobId"
    };
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
    let mergedData = body.data
      ? (collectionSchemas[config.key].parse(mergeInput(currentData, clientPatchData)) as Record<string, unknown>)
      : currentData;
    const nextStatus = body.status ?? item.status;
    if (config.key === "properties" && body.data && (nextStatus !== "DRAFT" || mergedData.postalCode)) validateListingPostalCode(mergedData);
    if (config.key === "jobs" && (body.data || (statusChanged && ["PENDING_REVIEW", "PUBLISHED"].includes(nextStatus)))) {
      mergedData = await resolveJobLocation(mergedData, currentData);
    }
    if (body.data || statusChanged) mergedData = prepareMaterialData(config.key, mergedData);
    if (config.key === "workerProfiles" && body.status === "AVAILABLE") mergedData.availableNow = true;
    if (config.key === "workerProfiles" && body.status === "BUSY") mergedData.availableNow = false;
    if (config.key === "materialProducts" && statusChanged) {
      if (nextStatus === "OUT_OF_STOCK") mergedData.availabilityStatus = "OUT_OF_STOCK";
      if (item.status === "OUT_OF_STOCK" && nextStatus === "PUBLISHED") mergedData.availabilityStatus = "IN_STOCK";
    }
    if (body.data) validateCollectionConsistency(config.key, mergedData);
    const effectiveDescription = body.description === undefined ? item.description : body.description;
    if (statusChanged) {
      validateTransitionReadiness(config.key, nextStatus, mergedData, effectiveDescription);
    }
    const trustedData = statusChanged ? deriveTrustedData(config.key, nextStatus, mergedData) : mergedData;
    if (body.data) await validateImageAttachments(config.key, trustedData, session, currentData);

    if (config.key === "materialQuotes" && statusChanged && nextStatus === "SUBMITTED") {
      if (!item.parentId || !(await vendorRfqIds(session.tenantId, item.ownerId, item.parentId)).length) {
        throw new WorkspaceHttpError(409, "This RFQ is no longer accepting quotes");
      }
    }

    let campaignParentId = item.parentId;
    if (config.key === "adCampaigns" && ["PENDING_REVIEW", "APPROVED", "ACTIVE"].includes(nextStatus)) {
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
      if (config.key === "materialQuotes" && item.parentId && statusChanged && nextStatus === "SUBMITTED") {
        const today = new Date().toISOString().slice(0, 10);
        const open = await tx.$queryRaw<Array<{id: string}>>(Prisma.sql`
          SELECT "id" FROM "WorkspaceItem" WHERE "id" = ${item.parentId} AND "tenantId" = ${session.tenantId}
            AND "collection" = 'MATERIAL_RFQS' AND "status" IN (${Prisma.join(quotingRfqStatuses)})
            AND ("data"->>'requiredByDate' IS NULL OR "data"->>'requiredByDate' >= ${today}) FOR UPDATE
        `);
        if (!open.length) throw new WorkspaceHttpError(409, "This RFQ is no longer accepting quotes");
      }
      if (config.key === "materialQuotes" && item.parentId && statusChanged && nextStatus === "ACCEPTED") {
        const claimed = await tx.workspaceItem.updateMany({
          where: {
            id: item.parentId,
            tenantId: session.tenantId,
            collection: WorkspaceCollection.MATERIAL_RFQS,
            status: {in: quotingRfqStatuses},
            OR: [{data: {path: ["requiredByDate"], gte: new Date().toISOString().slice(0, 10)}},
              {data: {path: ["requiredByDate"], equals: Prisma.AnyNull}}]
          },
          data: {status: "VENDOR_SELECTED"}
        });
        if (claimed.count !== 1) {
          throw new WorkspaceHttpError(409, "Another quote has already been selected for this RFQ");
        }
      }

      const write = await tx.workspaceItem.updateMany({
        where: {
          id: item.id,
          tenantId: session.tenantId,
          status: item.status,
          updatedAt: item.updatedAt
        },
        data: {
          title: body.title,
          description: body.description,
          status: nextStatus,
          data: asInputJson(trustedData),
          parentId: campaignParentId,
          publicAt: publicAtFor(config, nextStatus, item.publicAt)
        }
      });
      if (write.count !== 1) {
        throw new WorkspaceHttpError(409, "This item changed in another session; refresh before retrying");
      }
      const changed = await tx.workspaceItem.findUniqueOrThrow({where: {id: item.id}});
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

      if (config.key === "materialQuotes" && item.parentId && statusChanged && nextStatus === "SUBMITTED") {
        const quoteCount = await tx.workspaceItem.count({
          where: {tenantId: session.tenantId, parentId: item.parentId, collection: WorkspaceCollection.MATERIAL_QUOTES, status: {in: ["SUBMITTED", "VIEWED", "SHORTLISTED", "ACCEPTED"]}}
        });
        await tx.workspaceItem.updateMany({
          where: {id: item.parentId, tenantId: session.tenantId, status: {in: ["OPEN", "QUOTING"]}},
          data: {status: quoteCount >= 2 ? "QUOTES_RECEIVED" : "QUOTING"}
        });
      }
      if (config.key === "materialQuotes" && item.parentId && statusChanged && nextStatus === "ACCEPTED") {
        await tx.workspaceItem.updateMany({
          where: {tenantId: session.tenantId, parentId: item.parentId, collection: WorkspaceCollection.MATERIAL_QUOTES, id: {not: item.id}, status: {in: ["SUBMITTED", "VIEWED", "SHORTLISTED"]}},
          data: {status: "REJECTED"}
        });
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
        actorLabel:
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
  "/public/:collection",
  asyncRoute(async (req, res) => {
    const config = publicAliasToCollection[routeParam(req.params.collection, "collection")];
    if (!config?.publicStatuses) throw new WorkspaceHttpError(404, "Unknown public collection");
    const query = publicQuerySchema.parse(req.query);
    const areaMatch = query.nearArea;
    const cityMatch = query.nearCity;
    const stateMatch = query.nearState;
    const locationListing = config.key === "properties" || config.key === "jobs" || config.key === "dealerProfiles";
    function countryWhere(code: string): Prisma.WorkspaceItemWhereInput {
      const match = {data: {path: ["countryCode"], equals: code}};
      return code === defaultListingCountry ? {OR: [match, {data: {path: ["countryCode"], equals: Prisma.AnyNull}}]} : match;
    }
    const propertyFilters: Prisma.WorkspaceItemWhereInput[] = [];
    const materials = config.key === "materialProducts" && !query.item;
    if (query.q && !query.item) {
      const search = query.q;
      const fields = ["trade", "primaryTrade", "category", "categoryId", "employmentType", "workMode", "propertyType", "areaUnit", "brand", "brandName", "unit", "serviceType", "employerName", "reraNumber", "propertyCategory", "projectType", "agencyName", "variant", "specification", "projectName"];
      propertyFilters.push({OR: [
        {title: {contains: search, mode: "insensitive"}},
        {description: {contains: search, mode: "insensitive"}},
        ...fields.filter((field) => config.publicDataKeys?.includes(field)).map((field) => ({data: {path: [field], string_contains: search, mode: "insensitive" as const}})),
      ]});
    }
    if (!materials && query.city && !query.item) propertyFilters.push({data: {path: ["city"], string_contains: query.city, mode: "insensitive"}});
    if (!materials && query.category && !query.item && config.key !== "properties") {
      propertyFilters.push({OR: ["category", "serviceType", "trade"].map((field) => ({data: {path: [field], string_contains: query.category, mode: "insensitive" as const}}))});
    }
    const locationFilter = query.location ?? (materials ? query.city : undefined);
    const deliveryLocations = materials ? findDeliveryCities(locationFilter, query.country) : [];
    const deliveryFilter = materials && (query.cityId || deliveryLocations.length) ? {OR: [
      ...(query.cityId ? [query.cityId] : deliveryLocations.map(({id}) => id)).map((id) => ({data: {path: ["deliveryCityIds"], array_contains: [id]}})),
      ...(!query.cityId && locationFilter ? [{data: {path: ["deliveryCities"], array_contains: [locationFilter]}}] : []),
    ]} : null;
    const browsingLocation = deliveryFilter ?? (locationFilter && !query.item ? {OR: [
      ...["city", "cityName", "locality", "localityName", "cityId"].map((key) => ({data: {path: [key], string_contains: locationFilter, mode: "insensitive" as const}})),
      ...["deliveryCities", "citiesServed"].map((key) => ({data: {path: [key], array_contains: [locationFilter]}})),
    ]} : null);
    if (materials && query.category) {
      const option = materialCategories.find(({value}) => value === materialOptionValue(materialCategories, query.category));
      if (!option) { sendSuccess(res, []); return; }
      const keys = [...new Set([option.value, option.label, ...option.aliases].flatMap((value) => [value, value.toLowerCase(), value.toUpperCase()]))];
      propertyFilters.push({OR: keys.map((value) => ({data: {path: ["category"], equals: value}}))});
    }
    if (config.key === "properties" && !query.item) {
      if (query.intent) propertyFilters.push({data: {path: ["listingIntent"], equals: query.intent}});
      if (query.category) propertyFilters.push({data: {path: ["propertyCategory"], equals: query.category.toUpperCase()}});
      if (query.propertyType) propertyFilters.push({OR: [
        {data: {path: ["propertyType"], equals: query.propertyType}},
        {data: {path: ["propertyType"], string_contains: query.propertyType.replaceAll("_", " "), mode: "insensitive"}},
      ]});
    }
    const nearbyDeliveryIds = materials ? findDeliveryCities(cityMatch, query.nearCountry, stateMatch).map(({id}) => id) : [];
    const cityFields = [
      ...(cityMatch ? ["city", "cityName"].map((key) => ({data: {path: [key], string_contains: cityMatch, mode: "insensitive" as const}})) : []),
      ...(cityMatch ? ["deliveryCities", "citiesServed"].map((key) => ({data: {path: [key], array_contains: [cityMatch]}})) : []),
      ...nearbyDeliveryIds.map((id) => ({data: {path: ["deliveryCityIds"], array_contains: [id]}})),
    ];

    let tenantId: string | undefined = req.session?.tenantId;
    if (!tenantId) {
      const publicTenant = await workspacePrisma.tenant.findFirst({
        where: {id: env.PUBLIC_TENANT_ID, isDemo: false},
        select: {id: true}
      });
      tenantId = publicTenant?.id;
    }
    if (!tenantId) {
      sendSuccess(res, []);
      return;
    }

    const now = new Date();
    const benefit = publicBenefits[config.key];
    const activePackages = benefit ? await workspacePrisma.billingEntitlement.findMany({
      where: activeBenefit(tenantId, benefit, now),
      select: {userId: true, targetId: true}
    }) : [];
    const isDealer = config.key === "dealerProfiles";
    const isAd = config.key === "adCampaigns";
    const priorityIds = new Set(activePackages.flatMap(({userId, targetId}) => isDealer ? [userId] : targetId ? [targetId] : []));
    const matchPriority = isDealer ? "ownerId" : "id";
    const baseWhere: Prisma.WorkspaceItemWhereInput = {
      tenantId,
      collection: config.dbCollection as WorkspaceCollection,
      status: {in: [...config.publicStatuses]},
      publicAt: {not: null},
      ...(query.item ? {OR: [{id: query.item}, {data: {path: ["slug"], equals: query.item}}]} : {}),
      ...(isAd ? {parent: {is: {tenantId, collection: "BUILDER_PROJECTS", status: "PUBLISHED"}}} : {})
    };
    const listPublicItems = (where: Prisma.WorkspaceItemWhereInput) => workspacePrisma.workspaceItem.findMany({
      where: {AND: [baseWhere, where, ...propertyFilters, ...(browsingLocation ? [browsingLocation] : []), ...(locationListing && !query.item && query.country ? [countryWhere(query.country)] : [])]},
      orderBy: [{publicAt: "desc"}, {createdAt: "desc"}],
      take: query.limit
    });
    const [priority, regular, localArea, localCity, localState, localCountry] = await Promise.all([
      priorityIds.size ? listPublicItems({[matchPriority]: {in: [...priorityIds]}}) : Promise.resolve([]),
      isAd ? Promise.resolve([]) : listPublicItems(priorityIds.size ? {[matchPriority]: {notIn: [...priorityIds]}} : {}),
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
    if (cityMatch || stateMatch || query.nearCountry) candidates.sort((left, right) => score(right) - score(left));
    const data = candidates
      .filter((item) => {
        if (!isAd) return true;
        const {startsAt, endsAt} = asJsonObject(item.data);
        return typeof startsAt === "string" && typeof endsAt === "string" &&
          new Date(startsAt) <= now && new Date(endsAt) > now;
      })
      .map((item) => {
        const safeData = publicDataFor(config, asJsonObject(item.data));
        if (isDealer) safeData.pro = priorityIds.has(item.ownerId);
        if (config.key === "jobs") safeData.featured = priorityIds.has(item.id);
        if (config.key === "properties") {
          if (typeof safeData.latitude === "number") safeData.latitude = Math.round(safeData.latitude * 100) / 100;
          if (typeof safeData.longitude === "number") safeData.longitude = Math.round(safeData.longitude * 100) / 100;
        }
        return toDto(item, safeData);
      })
      .slice(0, query.limit);
    sendSuccess(res, data);
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
