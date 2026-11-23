import {HomepageSlideStatus} from "@prisma/client";
import {Router, type Request, type Router as ExpressRouter} from "express";
import {z} from "zod";
import {env} from "../config/env.js";
import {sendSuccess} from "../helpers/api-response.js";
import {parseInput} from "../helpers/parse-input.js";
import {requireSession} from "../middleware/session.middleware.js";
import {canAttachImage} from "../uploads/images.js";
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";
import {workspacePrisma} from "./db.js";

const link = z.string().trim().max(2048).refine((value) => {
  if (value.startsWith("/") && !value.startsWith("//") && !/[\\\u0000-\u0020]/.test(value)) return true;
  try {const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password;}
  catch {return false;}
}, "Use a local page path or HTTPS link.");
const fields = z.object({
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().max(240).nullable().optional(),
  imageUrl: z.string().regex(/^\/api\/v1\/uploads\/[a-f0-9]{64}\.webp$/, "Upload an image or video poster."),
  videoUrl: z.string().regex(/^\/api\/v1\/uploads\/[a-f0-9]{64}\.mp4$/, "Upload a video.").nullable().optional(),
  imageAlt: z.string().trim().min(2, "Describe the slide image.").max(140),
  ctaLabel: z.string().trim().min(1).max(40).nullable().optional(),
  ctaHref: link.nullable().optional(),
  sortOrder: z.number().int().min(1).optional(),
  status: z.nativeEnum(HomepageSlideStatus).optional(),
}).strict();
const states: Record<HomepageSlideStatus, HomepageSlideStatus[]> = {
  DRAFT: ["PUBLISHED", "ARCHIVED"], PUBLISHED: ["PAUSED", "ARCHIVED"], PAUSED: ["PUBLISHED", "ARCHIVED"], ARCHIVED: [],
};

function admin(req: Request) {
  if (req.session?.role !== "ADMIN") throw new ApiError(403, "ROLE_FORBIDDEN", "Only administrators can manage homepage slides.");
  return req.session;
}

export const homepageSlidesRouter: ExpressRouter = Router();

homepageSlidesRouter.get("/public/homepage-slides", asyncHandler(async (req, res) => {
  const tenantId = req.session?.tenantId ?? env.PUBLIC_TENANT_ID;
  const slides = await workspacePrisma.homepageSlide.findMany({
    where: {tenantId, status: "PUBLISHED", tenant: {isDemo: false}}, orderBy: [{sortOrder: "asc"}, {id: "asc"}],
    select: {id: true, title: true, description: true, imageUrl: true, videoUrl: true, imageAlt: true, ctaLabel: true, ctaHref: true},
  });
  sendSuccess(res, slides);
}));

homepageSlidesRouter.use("/workspace/homepage-slides", requireSession);
homepageSlidesRouter.get("/workspace/homepage-slides", asyncHandler(async (req, res) => {
  const {tenantId} = admin(req);
  sendSuccess(res, await workspacePrisma.homepageSlide.findMany({where: {tenantId}, orderBy: [{status: "asc"}, {sortOrder: "asc"}, {id: "asc"}]}));
}));

const saveSlide = asyncHandler(async (req, res) => {
  const session = admin(req);
  const id = typeof req.params.id === "string" ? req.params.id : undefined;
  const {tenantId} = session;
  const body = parseInput(id ? fields.partial() : fields, req.body);
  const result = await workspacePrisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId} FOR NO KEY UPDATE`;
    const previous = id ? await tx.homepageSlide.findFirst({where: {id, tenantId}}) : null;
    if (id && !previous) throw new ApiError(404, "SLIDE_NOT_FOUND", "Homepage slide not found.");
    if (previous?.status === "ARCHIVED") throw new ApiError(409, "SLIDE_ARCHIVED", "Archived slides cannot be edited.");
    const slide = parseInput(fields, {...(previous ? {
      title: previous.title, description: previous.description, imageUrl: previous.imageUrl,
      videoUrl: previous.videoUrl, imageAlt: previous.imageAlt, ctaLabel: previous.ctaLabel,
      ctaHref: previous.ctaHref, sortOrder: previous.sortOrder, status: previous.status,
    } : {}), ...body});
    const status = slide.status ?? "DRAFT";
    const before = previous?.status ?? "DRAFT";
    if (status !== before && !states[before].includes(status)) throw new ApiError(409, "INVALID_TRANSITION", "This slide status change is unavailable.");
    if (Boolean(slide.ctaHref) !== Boolean(slide.ctaLabel)) throw new ApiError(422, "INCOMPLETE_CTA", "Enter both the link and the button label.", {[slide.ctaHref ? "ctaLabel" : "ctaHref"]: ["Enter both the link and the button label."]});
    for (const field of ["imageUrl", "videoUrl"] as const) {
      const value = slide[field];
      if (value && value !== previous?.[field] && !(await canAttachImage(value, session, "homepageSlides:" + field))) {
        throw new ApiError(422, "INVALID_MEDIA", "Upload this file using its slide field.", {[field]: ["Upload this file using its slide field."]});
      }
    }
    const siblings = {tenantId, status: {not: "ARCHIVED" as const}};
    const max = await tx.homepageSlide.count({where: siblings});
    let sortOrder = slide.sortOrder ?? max + 1;
    if (status !== "ARCHIVED" && sortOrder > max + Number(!previous)) {
      throw new ApiError(422, "SLIDE_ORDER", "Choose an available sort position.", {sortOrder: [`Choose a position from 1 to ${max + Number(!previous)}.`]});
    }
    const old = previous?.sortOrder;
    if (status === "ARCHIVED" && previous) {
      await tx.homepageSlide.updateMany({where: {...siblings, sortOrder: {gt: previous.sortOrder}}, data: {sortOrder: {decrement: 1}}});
      sortOrder = previous.sortOrder;
    } else if (old === undefined || sortOrder < old) {
      await tx.homepageSlide.updateMany({where: {...siblings, sortOrder: {gte: sortOrder, lt: old}}, data: {sortOrder: {increment: 1}}});
    } else if (sortOrder > old) {
      await tx.homepageSlide.updateMany({where: {...siblings, sortOrder: {gt: old, lte: sortOrder}}, data: {sortOrder: {decrement: 1}}});
    }
    const data = {...slide, sortOrder, status};
    return id ? tx.homepageSlide.update({where: {id}, data}) : tx.homepageSlide.create({data: {tenantId, ...data}});
  });
  sendSuccess(res, result, id ? 200 : 201);
});
homepageSlidesRouter.post("/workspace/homepage-slides", saveSlide);
homepageSlidesRouter.patch("/workspace/homepage-slides/:id", saveSlide);
