import {createHmac} from "node:crypto";
import {Router, type Request, type Router as ExpressRouter} from "express";
import rateLimit, {ipKeyGenerator} from "express-rate-limit";
import {z} from "zod";
import {normalizeContactPhone, siteLocales} from "@the-property-pillar/contracts";
import {env} from "../config/env.js";
import {sendSuccess} from "../helpers/api-response.js";
import {parseInput} from "../helpers/parse-input.js";
import {requireSession} from "../middleware/session.middleware.js";
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";
import {contactPhone, reportReasonSchema} from "./config.js";
import {workspacePrisma} from "./db.js";
import {readLeadIdentity} from "../services/lead-identity.js";
import {hasPropertyLead} from "./property-reports.js";
import {propertyVisitorHash} from "./property-views.js";

export const propertyEngagementRouter: ExpressRouter = Router();

const idSchema = z.string().regex(/^[a-z0-9_-]{1,80}$/i);
function limitPropertyWrites() {
  return rateLimit({windowMs: 600_000, limit: 12, standardHeaders: "draft-8", legacyHeaders: false,
    keyGenerator: (req) => req.session ? "account:" + req.session.userId : ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? ""),
    handler: (_req, res) => res.status(429).json({error: {code: "TOO_MANY_REQUESTS", message: "Please wait before sending another submission."}})});
}
const person = {
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  phone: contactPhone.refine((phone) => /^\+[1-9]\d{6,14}$/.test(phone), "Include the international country code."),
  requestId: z.string().uuid(),
};
const commentInput = z.object({...person, body: z.string().trim().min(3, "Enter a comment.").max(1200)}).strict();
const enquiryInput = z.object({...person, locale: z.enum(siteLocales).default("en")}).strict();
const pageInput = z.object({page: z.coerce.number().int().min(1).max(1000).default(1)});
const publicComment = {id: true, fullName: true, body: true, createdAt: true} as const;
const reportInput = z.object({reason: reportReasonSchema, details: z.string().trim().min(3, "Describe the issue with this listing.").max(2000)}).strict();

const tenantFor = (req: Request) => req.session?.tenantId ?? env.PUBLIC_TENANT_ID;
const publicProperty = (id: string, tenantId: string) => ({id, tenantId, collection: "PROPERTIES" as const, status: "PUBLISHED", publicAt: {not: null}});
const replayKey = (req: Request, propertyId: string, requestId: string, purpose: string) =>
  createHmac("sha256", env.JWT_SECRET).update(JSON.stringify([purpose, propertyId, req.session?.userId ?? null, requestId])).digest("hex");

propertyEngagementRouter.post("/public/properties/:id/views", asyncHandler(async (req, res) => {
  const propertyId = parseInput(idSchema, req.params.id);
  const tenantId = tenantFor(req);
  const visitorHash = propertyVisitorHash(tenantId, propertyId, req.ip ?? req.socket.remoteAddress);
  const viewCount = await workspacePrisma.$transaction(async (tx) => {
    const [property] = await tx.$queryRaw<{id: string}[]>`
      SELECT id FROM "WorkspaceItem" WHERE id = ${propertyId} AND "tenantId" = ${tenantId}
        AND collection = 'PROPERTIES' AND status = 'PUBLISHED' AND "publicAt" IS NOT NULL FOR SHARE
    `;
    if (!property) throw new ApiError(404, "PROPERTY_UNAVAILABLE", "This property is no longer available.");
    if (visitorHash) await tx.propertyView.createMany({data: {propertyId, visitorHash}, skipDuplicates: true});
    return tx.propertyView.count({where: {propertyId}});
  });
  sendSuccess(res, {viewCount});
}));

propertyEngagementRouter.get("/public/properties/:id/comments", asyncHandler(async (req, res) => {
  const propertyId = parseInput(idSchema, req.params.id);
  const {page} = parseInput(pageInput, req.query);
  const tenantId = tenantFor(req);
  if (!await workspacePrisma.workspaceItem.findFirst({where: publicProperty(propertyId, tenantId), select: {id: true}})) {
    throw new ApiError(404, "PROPERTY_UNAVAILABLE", "This property is no longer available.");
  }
  const rows = await workspacePrisma.propertyComment.findMany({
    where: {tenantId, propertyId, hidden: false, property: publicProperty(propertyId, tenantId)}, select: publicComment,
    orderBy: [{createdAt: "desc"}, {id: "desc"}], skip: (page - 1) * 10, take: 11,
  });
  sendSuccess(res, {items: rows.slice(0, 10), hasMore: rows.length > 10});
}));

propertyEngagementRouter.post("/public/properties/:id/comments", limitPropertyWrites(), asyncHandler(async (req, res) => {
  const propertyId = parseInput(idSchema, req.params.id);
  const {body, phone, fullName, requestId} = parseInput(commentInput, req.body);
  const tenantId = tenantFor(req);
  const requestKey = replayKey(req, propertyId, requestId, "comment");
  const comment = await workspacePrisma.$transaction(async (tx) => {
    const [property] = await tx.$queryRaw<{id: string}[]>`
      SELECT id FROM "WorkspaceItem" WHERE id = ${propertyId} AND "tenantId" = ${tenantId}
        AND collection = 'PROPERTIES' AND status = 'PUBLISHED' AND "publicAt" IS NOT NULL FOR SHARE
    `;
    if (!property) throw new ApiError(404, "PROPERTY_UNAVAILABLE", "This property is no longer available.");
    return tx.propertyComment.upsert({
      where: {tenantId_requestKey: {tenantId, requestKey}}, update: {},
      create: {tenantId, propertyId, requestKey, authorId: req.session?.userId, fullName, phone, body},
      select: {...publicComment, hidden: true},
    });
  });
  const {hidden, ...visible} = comment;
  if (hidden) throw new ApiError(409, "COMMENT_HIDDEN", "This comment has been hidden.");
  sendSuccess(res, visible, 201);
}));

propertyEngagementRouter.post("/public/properties/:id/enquiries", requireSession, limitPropertyWrites(), asyncHandler(async (req, res) => {
  const propertyId = parseInput(idSchema, req.params.id);
  const {phone, fullName, requestId, locale} = parseInput(enquiryInput, req.body);
  if (req.session!.role === "ADMIN") throw new ApiError(403, "ROLE_FORBIDDEN", "Administrators cannot send enquiries.");
  const visitorType = (await readLeadIdentity(req, "property:" + propertyId))?.visitorType ?? req.session!.role;
  const tenantId = tenantFor(req);
  const enquiryRequestKey = replayKey(req, propertyId, requestId, "enquiry");
  const result = await workspacePrisma.$transaction(async (tx) => {
    const [property] = await tx.$queryRaw<{ownerId: string; title: string; data: {shareContactWithEnquirers?: boolean; contactPhone?: string}}[]>`
      SELECT "ownerId", title, data FROM "WorkspaceItem" WHERE id = ${propertyId} AND "tenantId" = ${tenantId}
        AND collection = 'PROPERTIES' AND status = 'PUBLISHED' AND "publicAt" IS NOT NULL FOR SHARE
    `;
    if (!property) throw new ApiError(404, "PROPERTY_UNAVAILABLE", "This property is no longer available.");
    if (req.session?.userId === property.ownerId) throw new ApiError(422, "OWN_PROPERTY", "You cannot send an enquiry about your own property.");
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${enquiryRequestKey}, 0))`;
    const existing = await tx.workspaceItem.findUnique({where: {tenantId_enquiryRequestKey: {tenantId, enquiryRequestKey}}, select: {id: true, status: true}});
    const item = existing ?? await tx.workspaceItem.create({
      data: {tenantId, enquiryRequestKey, collection: "PROPERTY_INQUIRIES", parentId: propertyId, targetUserId: property.ownerId,
        ownerId: req.session?.userId, title: property.title, status: "NEW",
        data: {propertyId, fullName, phone, visitorType, isDealer: visitorType === "DEALER",
          inquiryType: "CALLBACK", consentAccepted: true, consentAcceptedAt: new Date().toISOString()},
        events: {create: {tenantId, actorId: req.session?.userId, action: "CREATED", toStatus: "NEW"}},
        enquiryEmail: {create: {locale, nextAttempt: new Date()}}},
      select: {id: true, status: true},
    });
    const contact = !["SPAM", "ARCHIVED"].includes(item.status) && property.data.shareContactWithEnquirers === true && property.data.contactPhone
      ? normalizeContactPhone(property.data.contactPhone) : undefined;
    return {id: item.id, ...(contact ? {phone: contact} : {})};
  });
  res.set("Cache-Control", "private, no-store");
  sendSuccess(res, result, 201);
}));

propertyEngagementRouter.get("/public/properties/:id/reports/eligibility", requireSession, asyncHandler(async (req, res) => {
  const id = parseInput(idSchema, req.params.id);
  const {userId, tenantId, role} = req.session!;
  sendSuccess(res, {eligible: role !== "ADMIN" && await hasPropertyLead(tenantId, userId, id)});
}));

propertyEngagementRouter.post("/public/properties/:id/reports", requireSession, limitPropertyWrites(), asyncHandler(async (req, res) => {
  const propertyId = parseInput(idSchema, req.params.id);
  const {reason, details} = parseInput(reportInput, req.body);
  const {tenantId, userId, role} = req.session!;
  if (role === "ADMIN") throw new ApiError(403, "ROLE_FORBIDDEN", "Administrators can review listing reports.");
  const result = await workspacePrisma.$transaction(async (tx) => {
    const property = await tx.workspaceItem.findFirst({where: publicProperty(propertyId, tenantId), select: {id: true, title: true}});
    if (!property) throw new ApiError(404, "PROPERTY_UNAVAILABLE", "This property is no longer available.");
    if (!await hasPropertyLead(tenantId, userId, propertyId, tx)) {
      throw new ApiError(403, "PROPERTY_LEAD_REQUIRED", "Submit an enquiry for this property before reporting it.");
    }
    const key = replayKey(req, propertyId, userId, "listing-report");
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    const existing = await tx.workspaceItem.findUnique({where: {tenantId_enquiryRequestKey: {tenantId, enquiryRequestKey: key}}, select: {id: true, status: true}});
    if (existing) return {report: existing, exists: true};
    const report = await tx.workspaceItem.create({data: {
      tenantId, ownerId: userId, parentId: propertyId, enquiryRequestKey: key, collection: "GRIEVANCES",
      title: `Property report · ${property.title}`.slice(0, 160), status: "OPEN",
      data: {category: "LISTING", relatedItemId: propertyId, reportReason: reason, details},
      events: {create: {tenantId, actorId: userId, action: "CREATED", toStatus: "OPEN"}},
    }, select: {id: true, status: true}});
    return {report, exists: false};
  });
  sendSuccess(res, result, result.exists ? 200 : 201);
}));

propertyEngagementRouter.use("/workspace/property-comments", requireSession);
propertyEngagementRouter.get("/workspace/property-comments", asyncHandler(async (req, res) => {
  const {role, tenantId} = req.session!;
  if (role !== "ADMIN") throw new ApiError(403, "ROLE_FORBIDDEN", "Only administrators can review comments.");
  const {page} = parseInput(pageInput, req.query);
  const rows = await workspacePrisma.propertyComment.findMany({where: {tenantId},
    select: {...publicComment, hidden: true, property: {select: {id: true, title: true}}},
    orderBy: [{createdAt: "desc"}, {id: "desc"}], skip: (page - 1) * 25, take: 26});
  sendSuccess(res, {items: rows.slice(0, 25), hasMore: rows.length > 25});
}));

propertyEngagementRouter.patch("/workspace/property-comments/:id", asyncHandler(async (req, res) => {
  const {role, tenantId} = req.session!;
  if (role !== "ADMIN") throw new ApiError(403, "ROLE_FORBIDDEN", "Only administrators can review comments.");
  const id = parseInput(idSchema, req.params.id);
  const {hidden} = parseInput(z.object({hidden: z.boolean()}).strict(), req.body);
  const updated = await workspacePrisma.propertyComment.updateMany({where: {id, tenantId}, data: {hidden}});
  if (!updated.count) throw new ApiError(404, "COMMENT_UNAVAILABLE", "This comment is no longer available.");
  sendSuccess(res, {hidden});
}));
