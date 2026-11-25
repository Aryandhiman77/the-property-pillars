import {randomBytes} from "node:crypto";
import {mkdir, rename, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {Router, type Router as ExpressRouter} from "express";
import rateLimit from "express-rate-limit";
import type {WorkspaceCollection} from "@prisma/client";
import {env} from "../config/env.js";
import {sendSuccess} from "../helpers/api-response.js";
import {requireSession} from "../middleware/session.middleware.js";
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";
import {collectionConfigs, type CollectionKey} from "../workspace/config.js";
import {workspacePrisma} from "../workspace/db.js";
import {projectFileReference} from "../projects/media-reference.js";
import {imageOwner, imageReferenceWhere, isImagePurpose, uploadDirectory, uploadName, workspaceImageFields} from "./images.js";
import {mediaLimits, processImage, processVideo, reserveVideo, writeUpload} from "./media-processing.js";

const acceptedTypes = {image: ["image/jpeg", "image/png", "image/webp"], video: ["video/mp4", "video/quicktime", "video/webm"]};

export const uploadsRouter: ExpressRouter = Router();
uploadsRouter.get("/limits", (_request, response) => {sendSuccess(response, mediaLimits);});

uploadsRouter.get("/:filename", asyncHandler(async (request, response, next) => {
  const missing = new ApiError(404, "IMAGE_NOT_FOUND", "Image not found.");
  const name = request.params.filename;
  if (typeof name !== "string" || !uploadName.test(name)) throw missing;
  const url = `/api/v1/uploads/${name}`;
  const owner = await imageOwner(name);
  const session = request.session;
  const tenantId = session?.tenantId ?? env.PUBLIC_TENANT_ID;
  if (owner && owner.tenantId !== tenantId) throw missing;
  const ownsFile = Boolean(session && owner?.userId === session.userId);
  if (!ownsFile) {
    const candidateCollections = Object.keys(workspaceImageFields) as CollectionKey[];
    const projectReference = owner?.purpose.startsWith("builderProjects:") && await workspacePrisma.builderProject.findFirst({where:{tenantId,...projectFileReference(url),...(session?.role==="ADMIN"?{}:{publication:"PUBLISHED",workspace:{status:"PUBLISHED",publicAt:{not:null},tenant:{isDemo:false}}})},select:{id:true}});
    const visibleReference = projectReference || await workspacePrisma.workspaceItem.findFirst({
      where: {tenantId, OR: candidateCollections.map((collection) => {
        const config = collectionConfigs[collection];
        return {
          collection: config.dbCollection as WorkspaceCollection,
          AND: [
            {OR: imageReferenceWhere(collection, url)},
            {OR: [
              {status: {in: [...(config.publicStatuses ?? [])]}, publicAt: {not: null}, ...(session ? {} : {tenant: {isDemo: false}})},
              ...(session ? [session.role === "ADMIN" ? {} : {ownerId: session.userId}] : []),
            ]},
          ],
        };
      })}, select: {id: true},
    });
    const accountLogo = !visibleReference && name.endsWith(".webp") && (!owner || owner.purpose === "account:logoUrl")
      ? await workspacePrisma.user.findFirst({
        where: {tenantId, id: owner?.userId, profileLogoUrl: url, OR: [
          ...(!owner && session ? [{id: session.userId}] : []),
          {status: "ACTIVE", tenant: {isDemo: false}, ownedItems: {some: {tenantId, collection: "PROPERTIES", status: "PUBLISHED", publicAt: {not: null}}}},
        ]}, select: {id: true},
      }) : null;
    const slide = owner?.purpose.startsWith("homepageSlides:") ? await workspacePrisma.homepageSlide.findFirst({
      where: {tenantId, OR: [{imageUrl: url}, {videoUrl: url}], ...(session?.role === "ADMIN" ? {} : {status: "PUBLISHED", tenant: {isDemo: false}})}, select: {id: true},
    }) : null;
    const article = owner?.purpose === "articles:coverImage" ? await workspacePrisma.article.findFirst({
      where: {tenantId, coverImage: url, ...(session?.role === "ADMIN" ? {} : {status: "PUBLISHED", tenant: {isDemo: false}})}, select: {id: true},
    }) : null;
    if (!visibleReference && !accountLogo && !slide && !article) throw missing;
  }
  response.sendFile(name, {root: uploadDirectory, cacheControl: false, dotfiles: "deny"}, (error) => {
    if (error) next("status" in error && error.status === 404 ? missing : error);
  });
}));

uploadsRouter.post(
  "/",
  requireSession,
  rateLimit({windowMs: 60_000, limit: 40, standardHeaders: "draft-8", legacyHeaders: false}),
  asyncHandler(async (request, response) => {
    const purpose = request.get("X-Upload-Purpose");
    if (!isImagePurpose(purpose)) throw new ApiError(422, "IMAGE_PURPOSE_REQUIRED", "Choose the form where this image will be used.");
    const {tenantId, userId, role} = request.session!;
    if (purpose.startsWith("homepageSlides:") || purpose === "articles:coverImage") {
      if (role !== "ADMIN") throw new ApiError(403, "ROLE_FORBIDDEN", "Only administrators can upload editorial media.");
    } else if (purpose !== "account:logoUrl") {
      const collection = purpose.split(":")[0] as CollectionKey;
      if (!(role==="ADMIN"&&collection==="builderProjects")&&!collectionConfigs[collection].createRoles.includes(role)) {
        throw new ApiError(403, "ROLE_FORBIDDEN", "Your account cannot upload images for this form.");
      }
    }
    const isGalleryVideo = purpose === "properties:mediaUrls" && acceptedTypes.video.some((type) => request.is(type));
    const kind = purpose.endsWith(":videoUrl") || isGalleryVideo ? "video" : "image";
    if (!acceptedTypes[kind].some((type) => request.is(type)) || (request.get("Content-Encoding") ?? "identity") !== "identity") {
      throw new ApiError(415, "UNSUPPORTED_MEDIA", kind === "image" ? "Choose a JPEG, PNG, or WebP image." : "Choose an MP4, MOV, or WebM video.");
    }
    const extension = kind === "image" ? "webp" : "mp4";
    const name = randomBytes(32).toString("hex") + "." + extension;
    await mkdir(uploadDirectory, {recursive: true});
    const path = join(uploadDirectory, name);
    const input = path + ".input";
    const output = path + ".tmp." + extension;
    const release = kind === "video" ? reserveVideo() : undefined;
    const controller = new AbortController();
    const abort = () => controller.abort();
    response.once("close", abort);
    try {
      await writeUpload(request, input, kind);
      if (kind === "image") await processImage(input, output);
      else await processVideo(input, output, controller.signal);
      if (controller.signal.aborted) return;
      await rename(output, path);
      const staged = request.get("X-Staged-Upload") === "1";
      try {await writeFile(path + ".json", JSON.stringify({tenantId, userId, purpose, ...(staged ? {stagedAt: Date.now()} : {})}), {flag: "wx"});}
      catch (error) {await rm(path, {force: true}); throw error;}
    } catch (error) {
      if (controller.signal.aborted) return;
      throw error;
    } finally {
      response.off("close", abort);
      release?.();
      await Promise.all([rm(input, {force: true}), rm(output, {force: true})]);
    }
    sendSuccess(response, {url: "/api/v1/uploads/" + name}, 201);
  }),
);
