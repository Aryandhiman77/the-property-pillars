import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import {directory, imageLimit, pdfLimit, parseMultipart, saveFile} from "../uploads/project-files.js";
import {
  Router,
  type Router as ExpressRouter,
  type Request as HttpRequest,
} from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  AREA_UNITS,
  floorPlanTypes,
  propertyDocumentTypes,
} from "@the-property-pillar/contracts";
import { prisma } from "../database/prisma.js";
import { env } from "../config/env.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import { sendSuccess } from "../helpers/api-response.js";
import { requireSession } from "../middleware/session.middleware.js";
import {
  lockFeaturedOrder,
  shiftFeaturedOrder,
} from "../workspace/featured-order.js";
import { parseInput } from "../helpers/parse-input.js";
import { invalidProperty } from "./domain.js";
import { requireConfirmedListingRole } from "../workspace/role-reviews.js";

const route = "/properties/:propertyId/assets";
const missing = () =>
  new ApiError(404, "ASSET_UNAVAILABLE", "The listing or file is unavailable.");
const conflict = () =>
  new ApiError(
    409,
    "PROPERTY_CHANGED",
    "The listing changed. Reload its details and try again.",
  );
const short = z.string().trim().max(160);
const planSchema = z
  .object({
    title: short.min(1),
    planType: z.enum(floorPlanTypes),
    floorLabel: short.optional(),
    configurationLabel: short.optional(),
    bedrooms: z.number().int().min(0).max(100).optional(),
    bathrooms: z.number().int().min(0).max(100).optional(),
    areaValue: z.number().positive().max(1e9).optional(),
    areaUnit: z.enum(AREA_UNITS).optional(),
    description: z.string().trim().max(2000).optional(),
    isPrimary: z.boolean().optional(),
  })
  .strict();
const documentSchema = z
  .object({
    title: short.min(1),
    category: z.enum(propertyDocumentTypes),
    visibility: z.enum(["PUBLIC", "PRIVATE"]),
  })
  .strict();
const expected = z.coerce.number().int().nonnegative();
const url = (propertyId: string, id: string, kind: string) =>
  "/api/v1/properties/" + propertyId + "/assets/" + id + "/" + kind;

async function access(req: HttpRequest, write = false) {
  const session = req.session,
    tenantId = session?.tenantId ?? env.PUBLIC_TENANT_ID,
    id = String(req.params.propertyId);
  const item = await prisma.workspaceItem.findFirst({
    where: { id, tenantId, collection: "PROPERTIES" },
    select: {
      id: true,
      updatedAt: true,
      publicAt: true,
      ownerId: true,
      status: true,
      tenant: { select: { isDemo: true } },
      property: { select: { revision: true,projectId:true,projectUnit:{select:{configurationId:true,towerId:true,phaseId:true}} } },
    },
  });
  if (!item?.property) throw missing();
  const owner = Boolean(
    session &&
    item.ownerId === session.userId &&
    ["OWNER", "DEALER", "BUILDER"].includes(session.role),
  );
  const privileged = owner || session?.role === "ADMIN";
  if (write) {
    if (!owner || !session)
      throw new ApiError(
        403,
        "LISTING_OWNER_REQUIRED",
        "Only the listing creator can edit its files.",
      );
    if (
      ![
        "DRAFT",
        "CHANGES_REQUESTED",
        "REJECTED",
        "PUBLISHED",
        "APPROVED",
      ].includes(item.status)
    )
      throw conflict();
    await requireConfirmedListingRole(tenantId, session.userId);
  } else if (
    !privileged &&
    (item.status !== "PUBLISHED" || !item.publicAt || item.tenant.isDemo)
  )
    throw missing();
  return { id, tenantId, item, privileged };
}
export const propertyAssets: ExpressRouter = Router();
propertyAssets.get(
  route,
  asyncHandler(async (req, res) => {
    const { id, privileged, item, tenantId } = await access(req);
    const link=item.property!.projectUnit;
    const project=link && item.property!.projectId ? await prisma.builderProject.findFirst({
      where:{id:item.property!.projectId,tenantId,...(privileged?{}:{publication:"PUBLISHED",workspace:{publicAt:{not:null},status:"PUBLISHED",tenant:{isDemo:false}}})},
      select:{id:true,name:true,slug:true,publication:true,plans:{where:{AND:[
        {OR:[{configurationId:null},{configurationId:link.configurationId}]},
        {OR:[{towerId:null},{towerId:link.towerId}]},
        {OR:[{phaseId:null},{phaseId:link.phaseId}]}
      ]},orderBy:[{isPrimary:"desc"},{sortOrder:"asc"},{id:"asc"}],select:{id:true,title:true,planType:true,imageKey:true,pdfKey:true,areaValue:true,areaUnit:{select:{code:true}}}}}
    }):null;
    const [plans, docs] = await Promise.all([
      prisma.propertyFloorPlan.findMany({
        where: { propertyId: id },
        include: { areaUnit: { select: { code: true } } },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
      prisma.propertyDocument.findMany({
        where: {
          propertyId: id,
          ...(!privileged ? { visibility: "PUBLIC" } : {}),
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    res.set("Cache-Control", "private, no-store");
    sendSuccess(res, {
      project:project?{name:project.name,slug:project.publication==="PUBLISHED"?project.slug:null,plans:project.plans.map(p=>{
        const root="/api/v1/projects/"+project.id+"/assets/"+p.id;
        return {id:p.id,title:p.title,planType:p.planType,areaValue:p.areaValue?.toNumber(),areaUnit:p.areaUnit?.code,image:p.imageKey?root+"/image":null,pdf:p.pdfKey?root+"/pdf":null};
      })}:null,
      revision: item.property!.revision,
      status: item.status,
      updatedAt: item.updatedAt,
      imageLimit,
      pdfLimit,
      plans: plans.map(({ imageKey, pdfKey, areaUnit, ...p }) => ({
        ...p,
        areaUnit: areaUnit?.code,
        areaValue: p.areaValue?.toNumber(),
        image: imageKey ? url(id, p.id, "image") : null,
        pdf: pdfKey ? url(id, p.id, "pdf") : null,
      })),
      documents: docs.map(({ id: doc, title, category, visibility, mime }) => ({
        id: doc,
        title,
        category,
        visibility,
        mime,
        url: url(id, doc, "document"),
      })),
    });
  }),
);
propertyAssets.get(
  route + "/:id/:kind",
  asyncHandler(async (req, res) => {
    const { id, privileged } = await access(req),
      assetId = String(req.params.id),
      kind = req.params.kind;
    let key: string | null = null;
    if (kind === "document") {
      const doc = await prisma.propertyDocument.findFirst({
        where: {
          propertyId: id,
          id: assetId,
          ...(!privileged ? { visibility: "PUBLIC" } : {}),
        },
      });
      key = doc?.fileKey ?? null;
    }
    if (kind === "image" || kind === "pdf") {
      const plan = await prisma.propertyFloorPlan.findFirst({
        where: { id: assetId, propertyId: id },
      });
      key = (kind === "image" ? plan?.imageKey : plan?.pdfKey) ?? null;
    }
    if (!key) throw missing();
    res.set({
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    });
    if (key.endsWith(".pdf")) res.attachment("property-document.pdf");
    res.sendFile(resolve(directory, key));
  }),
);
type Tx = Prisma.TransactionClient;
async function mutate(
  req: HttpRequest,
  revision: number,
  action: string,
  write: (tx: Tx, id: string) => Promise<void>,
) {
  const { id, item, tenantId } = await access(req, true);
  await prisma.$transaction(async (tx) => {
    const pending = ["PUBLISHED", "APPROVED"].includes(item.status),
      next = pending ? "PENDING_REVIEW" : item.status;
    if (pending) await lockFeaturedOrder(tx, tenantId);
    const rank = pending
      ? (
          await tx.workspaceItem.findUnique({
            where: { id },
            select: { featuredOrder: true },
          })
        )?.featuredOrder
      : null;
    const changed = await tx.workspaceItem.updateMany({
      where: { id, tenantId, updatedAt: item.updatedAt, status: item.status },
      data: {
        updatedAt: new Date(Math.max(Date.now(), +item.updatedAt + 1)),
        ...(pending
          ? {
              status: next,
              publicAt: null,
              featuredAt: null,
              featuredOrder: null,
            }
          : {}),
      },
    });
    if (changed.count !== 1) throw conflict();
    if (rank != null) await shiftFeaturedOrder(tx, tenantId, rank, null);
    const locked = await tx.property.updateMany({
      where: { id, revision },
      data: {
        revision: { increment: 1 },
        ...(pending
          ? { moderationState: "UNDER_REVIEW", publicationState: "UNPUBLISHED" }
          : {}),
      },
    });
    if (locked.count !== 1) throw conflict();
    await write(tx, id);
    await tx.workspaceEvent.create({
      data: {
        tenantId,
        itemId: id,
        actorId: req.session!.userId,
        action,
        fromStatus: item.status,
        toStatus: next,
      },
    });
  });
}
propertyAssets.post(
  route + "/:kind",
  requireSession,
  asyncHandler(async (req, _res, next) => {
    await access(req, true);
    next();
  }),
  parseMultipart,
  asyncHandler(async (req, res) => {
    if (!Buffer.isBuffer(req.body))
      throw invalidProperty("file", "Choose files using the upload form.");
    const form = await new Response(new Uint8Array(req.body), {
      headers: { "Content-Type": req.get("Content-Type")! },
    })
      .formData()
      .catch(() => {
        throw invalidProperty("file", "Invalid multipart form.");
      });
    let metadata: unknown;
    try {
      metadata = JSON.parse(String(form.get("metadata")));
    } catch {
      throw invalidProperty("metadata", "Enter the file details.");
    }
    const revision = parseInput(expected, form.get("revision") ?? undefined),
      created: string[] = [],
      replaced: string[] = [];
    try {
      if (req.params.kind === "plans") {
        const p = parseInput(planSchema, metadata),
          id = form.get("id")?.toString();
        if (Boolean(p.areaUnit) !== Boolean(p.areaValue))
          throw invalidProperty(
            "areaValue",
            "Enter both the floor plan area and its unit.",
          );
        const image = await saveFile(form.get("image"), "image", created),
          pdf = await saveFile(form.get("pdf"), "pdf", created);
        await mutate(
          req,
          revision,
          "FLOOR_PLAN_SAVED",
          async (tx, propertyId) => {
            const current = id
              ? await tx.propertyFloorPlan.findFirst({
                  where: { id, propertyId },
                })
              : null;
            if (id && !current) throw missing();
            if (!image && !pdf && !current)
              throw invalidProperty(
                "image",
                "Attach a floor plan image or PDF.",
              );
            const count = await tx.propertyFloorPlan.count({
              where: { propertyId },
            });
            if (!id && count >= 40)
              throw invalidProperty(
                "plans",
                "A listing supports up to 40 plans.",
              );
            const primary =
              p.isPrimary || !count || current?.isPrimary === true;
            if (primary)
              await tx.propertyFloorPlan.updateMany({
                where: { propertyId, isPrimary: true },
                data: { isPrimary: false },
              });
            const { areaUnit, ...fields } = p,
              unit = areaUnit
                ? await tx.masterItem.findFirst({
                    where: {
                      tenantId: req.session!.tenantId,
                      kind: "AREA_UNIT",
                      code: areaUnit,
                      OR: [{ active: true }, { id: current?.areaUnitId ?? "" }],
                    },
                  })
                : null;
            if (areaUnit && !unit)
              throw invalidProperty(
                "areaUnit",
                "Choose an available area unit.",
              );
            const values = {
              ...fields,
              description: p.description ?? null,
              floorLabel: p.floorLabel ?? null,
              configurationLabel: p.configurationLabel ?? null,
              bedrooms: p.bedrooms ?? null,
              bathrooms: p.bathrooms ?? null,
              areaValue: p.areaValue ?? null,
              areaUnitId: unit?.id ?? null,
              isPrimary: primary,
              imageKey: image ?? current?.imageKey,
              pdfKey: pdf ?? current?.pdfKey,
            };
            if (current) {
              await tx.propertyFloorPlan.update({
                where: { id: current.id },
                data: values,
              });
              if (image && current.imageKey) replaced.push(current.imageKey);
              if (pdf && current.pdfKey) replaced.push(current.pdfKey);
            } else
              await tx.propertyFloorPlan.create({
                data: { propertyId, sortOrder: count, ...values },
              });
          },
        );
      } else if (req.params.kind === "documents") {
        const d = parseInput(documentSchema, metadata);
        if (
          d.visibility === "PUBLIC" &&
          !["Brochure", "Marketing plan"].includes(d.category)
        )
          throw invalidProperty(
            "visibility",
            "Verification documents must be private.",
          );
        const key = await saveFile(form.get("file"), "either", created);
        if (!key) throw invalidProperty("file", "Attach a document.");
        await mutate(
          req,
          revision,
          "PROPERTY_DOCUMENT_ADDED",
          async (tx, propertyId) => {
            await tx.propertyDocument.create({
              data: {
                ...d,
                propertyId,
                fileKey: key,
                mime: key.endsWith(".pdf") ? "application/pdf" : "image/webp",
                uploadedBy: req.session!.userId,
              },
            });
          },
        );
      } else throw missing();
    } catch (e) {
      await Promise.allSettled(
        created.map((k) => unlink(resolve(directory, k))),
      );
      throw e;
    }
    await Promise.allSettled(
      replaced.map((k) => unlink(resolve(directory, k))),
    );
    sendSuccess(res, { saved: true });
  }),
);
propertyAssets.patch(
  route + "/plans/order",
  requireSession,
  asyncHandler(async (req, res) => {
    const { revision, ids } = parseInput(
      z
        .object({ revision: expected, ids: z.array(z.string()).max(40) })
        .strict(),
      req.body,
    );
    await mutate(
      req,
      revision,
      "FLOOR_PLANS_REORDERED",
      async (tx, propertyId) => {
        const plans = await tx.propertyFloorPlan.findMany({
          where: { propertyId },
          select: { id: true },
        });
        if (
          plans.length !== ids.length ||
          new Set(ids).size !== plans.length ||
          plans.some((p) => !ids.includes(p.id))
        )
          throw conflict();
        for (const [sortOrder, id] of ids.entries())
          await tx.propertyFloorPlan.update({
            where: { id },
            data: { sortOrder },
          });
      },
    );
    sendSuccess(res, { saved: true });
  }),
);
propertyAssets.delete(
  route + "/:kind/:id",
  requireSession,
  asyncHandler(async (req, res) => {
    const revision = parseInput(expected, req.query.revision),
      id = String(req.params.id),
      remove: string[] = [];
    await mutate(
      req,
      revision,
      "PROPERTY_ASSET_REMOVED",
      async (tx, propertyId) => {
        if (req.params.kind === "plans") {
          const plan = await tx.propertyFloorPlan.findFirst({
            where: { id, propertyId },
          });
          if (!plan) throw missing();
          await tx.propertyFloorPlan.delete({ where: { id } });
          if (plan.imageKey) remove.push(plan.imageKey);
          if (plan.pdfKey) remove.push(plan.pdfKey);
          const plans = await tx.propertyFloorPlan.findMany({
            where: { propertyId },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          });
          for (const [sortOrder, p] of plans.entries())
            await tx.propertyFloorPlan.update({
              where: { id: p.id },
              data: {
                sortOrder,
                ...(plan.isPrimary && sortOrder === 0
                  ? { isPrimary: true }
                  : {}),
              },
            });
        } else if (req.params.kind === "documents") {
          const d = await tx.propertyDocument.findFirst({
            where: { id, propertyId },
          });
          if (!d) throw missing();
          await tx.propertyDocument.delete({ where: { id } });
          remove.push(d.fileKey);
        } else throw missing();
      },
    );
    await Promise.allSettled(remove.map((k) => unlink(resolve(directory, k))));
    sendSuccess(res, { removed: true });
  }),
);
