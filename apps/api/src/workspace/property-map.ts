import {createCipheriv, createDecipheriv, createHmac, randomBytes} from "node:crypto";
import {PropertyMapLeadStatus, type Prisma} from "@prisma/client";
import {Router, type Request, type Router as ExpressRouter} from "express";
import rateLimit from "express-rate-limit";
import {SignJWT, jwtVerify} from "jose";
import {z} from "zod";
import {env} from "../config/env.js";
import {sendSuccess} from "../helpers/api-response.js";
import {parseInput} from "../helpers/parse-input.js";
import {requireSession} from "../middleware/session.middleware.js";
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";
import {workspacePrisma} from "./db.js";
import {mapLink, mapLocationSchema, resolveMapLink, type MapLocation} from "./map-location.js";
import {readLeadIdentity} from "../services/lead-identity.js";
import {propertyNearbyPlaces} from "./property-nearby.js";

const derive = (purpose: string) => createHmac("sha256", env.MAP_LEAD_DATA_KEY ?? env.JWT_SECRET).update(purpose).digest();
const accessKey = derive("property-map-access/v1");
const contactKey = derive("property-map-contact/v1");
const dedupKey = derive("property-map-dedup/v1");
export const mapLeadPhoneHash = (propertyId: string, phone: string) => createHmac("sha256", dedupKey).update(propertyId + ":" + phone).digest("hex");
const tokenAge = 24 * 60 * 60;
const leadInput = z.object({
  consent: z.literal(true, {errorMap: () => ({message: "Confirm that your details can be shared with the property poster."})}),
}).strict();
const statuses: Record<PropertyMapLeadStatus, PropertyMapLeadStatus[]> = {
  NEW: ["CONTACTED", "SPAM"], CONTACTED: ["CLOSED", "SPAM"], CLOSED: [], SPAM: [],
};

function encryptContact(contact: {fullName: string; phone: string}) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", contactKey, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(contact), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}
function readContact(value: string): {fullName: string; phone: string} {
  const packed = Buffer.from(value, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", contactKey, packed.subarray(0, 12));
  decipher.setAuthTag(packed.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString("utf8"));
}
function publishedPin(data: Prisma.JsonValue): MapLocation {
  const value = data && typeof data === "object" && !Array.isArray(data) ? data.mapLocation : null;
  const pin = mapLocationSchema.safeParse(value);
  if (!pin.success) throw new ApiError(404, "MAP_UNAVAILABLE", "This property does not have an available map.");
  if(data && typeof data==="object" && !Array.isArray(data)){
    if(data.addressVisibility==="LOCALITY_ONLY")throw new ApiError(404,"MAP_UNAVAILABLE","The seller shares the locality only.");
    if(data.addressVisibility==="APPROXIMATE")return {latitude:Math.round(pin.data.latitude*100)/100,longitude:Math.round(pin.data.longitude*100)/100};
  }
  return pin.data;
}
const revision = (pin: MapLocation) => createHmac("sha256", accessKey).update(JSON.stringify(pin)).digest("base64url");
const propertyId = (req: Request) => parseInput(z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/), req.params.id);
const tenantFor = (req: Request) => req.session?.tenantId ?? env.PUBLIC_TENANT_ID;
const cookieName = "tpp_map_access";
const cookiePath = (id: string) => "/api/v1/public/properties/" + id + "/map";

async function loadPublishedPin(id: string, tenantId: string) {
  const property = await workspacePrisma.workspaceItem.findFirst({
    where: {id, tenantId, collection: "PROPERTIES", status: "PUBLISHED", publicAt: {not: null}, tenant: {isDemo: false}},
    select: {data: true},
  });
  if (!property) throw new ApiError(404, "MAP_UNAVAILABLE", "This property map is unavailable.");
  return publishedPin(property.data);
}

export const propertyMapRouter: ExpressRouter = Router();

propertyMapRouter.get("/public/properties/:id/nearby", asyncHandler(async (req, res) => {
  const property = await workspacePrisma.workspaceItem.findFirst({
    where: {id: propertyId(req), tenantId: tenantFor(req), collection: "PROPERTIES", status: "PUBLISHED", publicAt: {not: null}, tenant: {isDemo: false}},
    select: {data: true},
  });
  if (!property) throw new ApiError(404, "PROPERTY_UNAVAILABLE", "This property is no longer available.");
  const data = property.data && typeof property.data === "object" && !Array.isArray(property.data) ? property.data : {};
  sendSuccess(res, await propertyNearbyPlaces(data));
}));

propertyMapRouter.post("/workspace/property-map/resolve", requireSession, asyncHandler(async (req, res) => {
  const {url} = parseInput(z.object({url: z.string().trim().max(2048).refine((value) => mapLink(value) !== null, "Enter a supported Maps link.")}), req.body);
  const pin = await resolveMapLink(url);
  if (!pin) throw new ApiError(422, "MAP_PIN_REQUIRED", "This link has no precise pin. Paste a pin link or enter the coordinates.", {url: ["Use a pin link or enter the coordinates."]});
  sendSuccess(res, pin);
}));

propertyMapRouter.post("/public/properties/:id/map/unlock", rateLimit({windowMs: 600_000, limit: 12, standardHeaders: "draft-8", legacyHeaders: false,
  handler: (_req, res) => {res.status(429).json({error: {code: "TOO_MANY_MAP_REQUESTS", message: "Too many unlock requests. Try again later."}});}}),
asyncHandler(async (req, res) => {
  const id = propertyId(req);
  const tenantId = tenantFor(req);
  res.set("Cache-Control", "private, no-store");
  const identity = await readLeadIdentity(req, "map:" + id);
  if (req.session && !identity) {
    sendSuccess(res, await loadPublishedPin(id, tenantId));
    return;
  }
  if (!identity) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Verify your mobile number to unlock this map.");
  parseInput(leadInput, req.body);
  const {fullName, phone, visitorType} = identity;
  const pin = await workspacePrisma.$transaction(async (tx) => {
    const [property] = await tx.$queryRaw<Array<{ownerId: string; data: Prisma.JsonValue}>>`
      SELECT item."ownerId", item.data FROM "WorkspaceItem" item
      JOIN "Tenant" tenant ON tenant.id = item."tenantId"
      WHERE item.id = ${id} AND item."tenantId" = ${tenantId} AND NOT tenant."isDemo"
        AND item.collection = 'PROPERTIES' AND item.status = 'PUBLISHED' AND item."publicAt" IS NOT NULL FOR SHARE OF item
    `;
    if (!property) throw new ApiError(404, "MAP_UNAVAILABLE", "This property map is unavailable.");
    const map = publishedPin(property.data);
    const phoneHash = mapLeadPhoneHash(id, phone);
    await tx.propertyMapLead.createMany({data: [{tenantId, propertyId: id, posterId: property.ownerId,
      contact: encryptContact({fullName, phone}), phoneHash, visitorType, isDealer: visitorType === "DEALER"}], skipDuplicates: true});
    return map;
  });
  const token = await new SignJWT({propertyId: id, tenantId, revision: revision(pin)}).setProtectedHeader({alg: "HS256"})
    .setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1000) + tokenAge).sign(accessKey);
  res.cookie(cookieName, token, {httpOnly: true, sameSite: "lax", secure: env.NODE_ENV === "production", path: cookiePath(id), maxAge: tokenAge * 1000});
  sendSuccess(res, pin);
}));

propertyMapRouter.get("/public/properties/:id/map", asyncHandler(async (req, res) => {
  const id = propertyId(req);
  const tenantId = tenantFor(req);
  res.set("Cache-Control", "private, no-store");
  if (req.session) {
    sendSuccess(res, await loadPublishedPin(id, tenantId));
    return;
  }
  const token = req.cookies?.[cookieName];
  const denied = () => new ApiError(403, "MAP_LOCKED", "Submit the map unlock form to see the pin.");
  if (typeof token !== "string") throw denied();
  const access = await jwtVerify(token, accessKey, {algorithms: ["HS256"]}).catch(() => null);
  if (access?.payload.propertyId !== id || access.payload.tenantId !== tenantId) throw denied();
  const pin = await loadPublishedPin(id, tenantId);
  if (access.payload.revision !== revision(pin)) throw denied();
  sendSuccess(res, pin);
}));

propertyMapRouter.use("/workspace/property-map-leads", requireSession);
propertyMapRouter.get("/workspace/property-map-leads", asyncHandler(async (req, res) => {
  const {tenantId, userId} = req.session!;
  const {page, status} = parseInput(z.object({page: z.coerce.number().int().min(1).max(10_000).default(1), status: z.nativeEnum(PropertyMapLeadStatus).optional()}), req.query);
  const where = {tenantId, posterId: userId, status};
  const [rows, total] = await workspacePrisma.$transaction([
    workspacePrisma.propertyMapLead.findMany({where, orderBy: [{createdAt: "desc"}, {id: "desc"}], skip: (page - 1) * 25, take: 25, include: {property: {select: {title: true}}}}),
    workspacePrisma.propertyMapLead.count({where}),
  ]);
  sendSuccess(res, {page, total, items: rows.map(({id, propertyId, property, contact, isDealer, visitorType, status, createdAt}) =>
    ({id, propertyId, title: property.title, ...readContact(contact), isDealer, visitorType, status, createdAt}))});
}));
propertyMapRouter.patch("/workspace/property-map-leads/:id", asyncHandler(async (req, res) => {
  const {tenantId, userId} = req.session!;
  const {status} = parseInput(z.object({status: z.nativeEnum(PropertyMapLeadStatus)}).strict(), req.body);
  const where = {id: propertyId(req), tenantId, posterId: userId};
  const current = await workspacePrisma.propertyMapLead.findFirst({where, select: {status: true}});
  if (!current) throw new ApiError(404, "LEAD_NOT_FOUND", "Map lead not found.");
  if (current.status !== status) {
    if (!statuses[current.status].includes(status)) throw new ApiError(409, "INVALID_LEAD_STATUS", "This lead cannot move to that status.");
    const written = await workspacePrisma.propertyMapLead.updateMany({where: {...where, status: current.status}, data: {status}});
    if (!written.count) throw new ApiError(409, "LEAD_CHANGED", "This lead changed. Refresh and try again.");
  }
  sendSuccess(res, {status});
}));
