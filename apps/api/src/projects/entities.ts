import { Prisma } from "@prisma/client";
import { parseInput } from "../helpers/parse-input.js";
import { canAttachImage } from "../uploads/images.js";
import { isUploadedVideoUrl } from "@the-property-pillar/contracts";
import * as schemas from "./validation.js";
import {
  dates,
  hierarchy,
  invalid,
  master,
  missing,
  type Owned,
  type Tx,
} from "./service.js";

export async function saveChild(
  tx: Tx,
  p: Owned,
  kind: string,
  body: unknown,
  id?: string,
  actorId?: string,
) {
  const projectId = p.id;
  const where = { id: id ?? "", projectId };
  async function file(url: string, purpose: "mediaUrls" | "videoUrl") {
    const uploadPurpose = "builderProjects:" + purpose;
    const owners = [
      ...new Set(
        [p.workspace.ownerId, actorId].filter((v): v is string => Boolean(v)),
      ),
    ];
    if (
      !(
        await Promise.all(
          owners.map((userId) =>
            canAttachImage(
              url,
              { tenantId: p.tenantId, userId },
              uploadPurpose,
            ),
          ),
        )
      ).some(Boolean)
    )
      throw invalid(
        purpose,
        "Choose a file uploaded for this Builder project.",
      );
  }
  switch (kind) {
    case "phases": {
      const v = parseInput(schemas.phase, body);
      dates(v);
      if (
        !id &&
        p.declaredPhases != null &&
        (await tx.projectPhase.count({ where: { projectId } })) >=
          p.declaredPhases
      )
        throw invalid(
          "name",
          "Increase the declared phase count before adding another phase.",
        );
      return id
        ? tx.projectPhase.update({ where, data: v })
        : tx.projectPhase.create({ data: { projectId, ...v } });
    }
    case "towers": {
      const v = parseInput(schemas.tower, body);
      await hierarchy(tx, projectId, v.phaseId);
      if (
        !id &&
        p.declaredTowers != null &&
        (await tx.projectTower.count({ where: { projectId } })) >=
          p.declaredTowers
      )
        throw invalid(
          "name",
          "Increase the declared tower count before adding another tower.",
        );
      if (id) {
        const current = await tx.projectTower.findFirst({
          where,
          include: {
            _count: { select: { units: true, plans: true, updates: true } },
          },
        });
        if (!current) throw missing();
        if (
          v.phaseId !== undefined &&
          v.phaseId !== current.phaseId &&
          Object.values(current._count).some((n) => n > 0)
        )
          throw invalid(
            "phaseId",
            "Move the associated units, plans and updates before changing this tower’s phase.",
          );
        if (v.declaredUnits != null && v.declaredUnits < current._count.units)
          throw invalid(
            "declaredUnits",
            "The tower already has more tracked units.",
          );
      }
      return id
        ? tx.projectTower.update({ where, data: v })
        : tx.projectTower.create({ data: { projectId, ...v } });
    }
    case "configurations": {
      const v = parseInput(schemas.configuration, body);
      const cat = await master(
        tx,
        p.tenantId,
        v.categoryId,
        "PROPERTY_CATEGORY",
      );
      await master(tx, p.tenantId, v.typeId, "PROPERTY_TYPE", cat.id);
      await master(tx, p.tenantId, v.areaUnitId, "AREA_UNIT");
      if (
        cat.code !== "RESIDENTIAL" &&
        (v.bedrooms != null || v.balconies != null)
      )
        throw invalid(
          "bedrooms",
          "Bedroom and balcony counts apply to residential configurations.",
        );
      if (!(v.carpetArea || v.plotArea || v.builtUpArea || v.superBuiltUpArea))
        throw invalid("carpetArea", "Enter a measured area.");
      if (
        v.priceMode !== "ON_REQUEST" &&
        (!v.currency || v.startingPrice == null)
      )
        throw invalid(
          "startingPrice",
          "Enter the starting price and currency.",
        );
      if (
        v.priceMode === "RANGE" &&
        (v.maximumPrice == null || v.maximumPrice < (v.startingPrice ?? 0))
      )
        throw invalid("maximumPrice", "Enter a valid upper price.");
      if (
        id &&
        !v.active &&
        (await tx.projectUnit.count({
          where: { projectId, configurationId: id, active: true },
        }))
      )
        throw invalid("active", "Deactivate the configuration’s units first.");
      if (
        id &&
        v.declaredUnits != null &&
        (await tx.projectUnit.count({
          where: { projectId, configurationId: id, active: true },
        })) > v.declaredUnits
      )
        throw invalid(
          "declaredUnits",
          "The estimate cannot be below tracked inventory.",
        );
      return id
        ? tx.projectConfiguration.update({ where, data: v })
        : tx.projectConfiguration.create({ data: { projectId, ...v } });
    }
    case "amenities": {
      const v = parseInput(schemas.amenity, body);
      await master(tx, p.tenantId, v.masterId, "AMENITY");
      return id
        ? tx.projectAmenity.update({ where, data: v })
        : tx.projectAmenity.create({ data: { projectId, ...v } });
    }
    case "specifications": {
      const v = parseInput(schemas.specification, body);
      return id
        ? tx.projectSpecification.update({ where, data: v })
        : tx.projectSpecification.create({ data: { projectId, ...v } });
    }
    case "places": {
      const v = parseInput(schemas.nearby, body);
      return id
        ? tx.projectNearbyPlace.update({ where, data: v })
        : tx.projectNearbyPlace.create({ data: { projectId, ...v } });
    }
    case "payment-plans": {
      const { milestones, ...v } = parseInput(schemas.payment, body);
      const create = milestones.map((m, sequence) => ({ ...m, sequence }));
      return id
        ? tx.projectPaymentPlan.update({
            where,
            data: { ...v, milestones: { deleteMany: {}, create } },
          })
        : tx.projectPaymentPlan.create({
            data: { projectId, ...v, milestones: { create } },
          });
    }
    case "media": {
      const v = parseInput(schemas.image, body);
      const categoryClasses: Record<string, string> = {
        "Exterior render": "Render",
        "Sample flat": "Sample unit",
        "Actual site": "Actual photo",
        "Construction progress": "Construction progress",
      };
      const classification = categoryClasses[v.category];
      if (classification && v.classification !== classification)
        throw invalid(
          "classification",
          "Select " + classification + " for this image category.",
        );
      await file(v.url, "mediaUrls");
      if (v.category === "Cover")
        await tx.projectMedia.updateMany({
          where: { projectId, category: "Cover", id: { not: id } },
          data: { category: "Other" },
        });
      return id
        ? tx.projectMedia.update({ where, data: v })
        : tx.projectMedia.create({ data: { projectId, ...v } });
    }
    case "videos": {
      const v = parseInput(schemas.video, body);
      if (isUploadedVideoUrl(v.url)) await file(v.url, "videoUrl");
      if (v.thumbnail) await file(v.thumbnail, "mediaUrls");
      return id
        ? tx.projectVideo.update({ where, data: v })
        : tx.projectVideo.create({ data: { projectId, ...v } });
    }
    case "updates": {
      const v = parseInput(schemas.update, body);
      await hierarchy(tx, projectId, v.phaseId, v.towerId);
      for (const url of v.mediaUrls) await file(url, "mediaUrls");
      if (v.videoUrl && isUploadedVideoUrl(v.videoUrl))
        await file(v.videoUrl, "videoUrl");
      return id
        ? tx.constructionUpdate.update({ where, data: v })
        : tx.constructionUpdate.create({ data: { projectId, ...v } });
    }
    default:
      throw missing();
  }
}
export async function removeChild(
  tx: Tx,
  projectId: string,
  kind: string,
  id: string,
) {
  const where = { id, projectId };
  const references =
    kind === "phases"
      ? await tx.projectPhase.findFirst({
          where,
          select: {
            _count: {
              select: { towers: true, units: true, plans: true, updates: true },
            },
          },
        })
      : kind === "towers"
        ? await tx.projectTower.findFirst({
            where,
            select: {
              _count: { select: { units: true, plans: true, updates: true } },
            },
          })
        : kind === "configurations"
          ? await tx.projectConfiguration.findFirst({
              where,
              select: { _count: { select: { units: true, plans: true } } },
            })
          : null;
  if (references && Object.values(references._count).some((count) => count > 0))
    throw invalid("id", "This record is used by other project records.");
  try {
    switch (kind) {
      case "phases":
        return await tx.projectPhase.delete({ where });
      case "towers":
        return await tx.projectTower.delete({ where });
      case "configurations":
        return await tx.projectConfiguration.delete({ where });
      case "amenities":
        return await tx.projectAmenity.delete({ where });
      case "specifications":
        return await tx.projectSpecification.delete({ where });
      case "places":
        return await tx.projectNearbyPlace.delete({ where });
      case "payment-plans":
        return await tx.projectPaymentPlan.delete({ where });
      case "media":
        return await tx.projectMedia.delete({ where });
      case "videos":
        return await tx.projectVideo.delete({ where });
      case "updates":
        return await tx.constructionUpdate.delete({ where });
      default:
        throw missing();
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003")
      throw invalid("id", "This record is used by other project records.");
    throw e;
  }
}
