import { createHash } from "node:crypto";
import { seedSpecifications } from "../materials/specifications.js";
import { all } from "country-codes-list";
import { Prisma } from "@prisma/client";
import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import {
  AREA_UNITS,
  masterKinds,
  materialCategories,
  materialUnits,
  parentKind,
  propertyAmenities,
  propertyTypesByCategory,
  type MasterKind,
} from "@the-property-pillar/contracts";
import { prisma } from "../database/prisma.js";
import {
  requireSession,
  requireRole,
} from "../middleware/session.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import { sendSuccess } from "../helpers/api-response.js";
import { parseInput } from "../helpers/parse-input.js";
import {
  catalogRegions,
  getDeliveryCityCentre,
  searchDeliveryCities,
  searchSuggestionCities,
} from "../locations/delivery-cities.js";

export const masterCode = (name: string) =>
  name
    .trim()
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/_$/, "");
export function masterSeed(
  tenantId: string,
  kind: MasterKind,
  code: string,
  name: string,
  parentId?: string,
) {
  const id = createHash("sha256")
    .update(JSON.stringify([tenantId, kind, code]))
    .digest("hex");
  return { id, tenantId, kind, code, name, parentId, sortOrder: 0 };
}
const defaults: Partial<Record<MasterKind, string[]>> = {
  PROFESSIONAL_CATEGORY: [
    "Architect",
    "Civil Engineer",
    "Structural Engineer",
    "Interior Designer",
    "Contractor",
    "Property Lawyer",
    "Vastu Consultant",
    "Document Writer",
    "Surveyor",
    "Fabrication Specialist",
    "Pest Control",
    "Other",
  ],
  TRADE: [
    "Mason",
    "Plumber",
    "Electrician",
    "Carpenter",
    "Painter",
    "Welder",
    "Helper",
    "Tile Installer",
    "POP / Gypsum Worker",
    "Fabricator",
    "AC / HVAC Technician",
    "Equipment Operator",
    "Other",
  ],
  JOB_CATEGORY: [
    "Engineering",
    "Architecture",
    "Real Estate Sales",
    "Construction Management",
    "Legal",
    "Administration",
    "Other",
  ],
  SKILL: [
    "AutoCAD",
    "Estimating",
    "Site Supervision",
    "Project Management",
    "Real Estate Sales",
    "Surveying",
    "BIM",
  ],
  QUALIFICATION: [
    "Secondary School",
    "Diploma",
    "Bachelor's Degree",
    "Master's Degree",
    "Doctorate",
    "Trade Certificate",
    "Other",
  ],
  BRAND: ["UltraTech", "ACC", "Asian Paints", "Tata Steel"],
  AREA_UNIT: [...AREA_UNITS],
};
export async function ensureCatalog(tenantId: string) {
  if (
    (
      await prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { masterCatalogVersion: true },
      })
    ).masterCatalogVersion >= 3
  )
    return;
  const rows: ReturnType<typeof masterSeed>[] = [];
  function add(
    kind: MasterKind,
    name: string,
    code = masterCode(name),
    parentId?: string,
  ) {
    const row = masterSeed(tenantId, kind, code, name, parentId);
    rows.push(row);
    return row.id;
  }
  const regions = new Intl.DisplayNames(["en"], { type: "region" });
  for (const { countryCode } of all())
    add("COUNTRY", regions.of(countryCode) ?? countryCode, countryCode);
  for (const [kind, values] of Object.entries(defaults))
    for (const name of values) add(kind as MasterKind, name);
  for (const [category, types] of Object.entries(propertyTypesByCategory)) {
    const parent = add(
      "PROPERTY_CATEGORY",
      category === "PLOT_LAND"
        ? "Plot / Land"
        : category[0] + category.slice(1).toLowerCase(),
      category,
    );
    for (const name of types)
      add("PROPERTY_TYPE", name, masterCode(name), parent);
  }
  const shared=add("PROPERTY_CATEGORY", "PG / Shared", "PG_SHARED");
  for(const name of ["Private room","Shared room","Student housing"])add("PROPERTY_TYPE",name,masterCode(name),shared);
  for(const category of rows.filter(r=>r.kind==="PROPERTY_CATEGORY"))add("PROPERTY_TYPE","Other","OTHER_"+category.code,category.id);
  for (const [code, name] of Object.entries(propertyAmenities))
    add("AMENITY", name, code);
  for (const entry of materialCategories)
    add("MATERIAL_CATEGORY", entry.label, entry.value);
  for (const entry of materialUnits) add("MATERIAL_UNIT", entry.label, entry.value);
  for (const name of [
    "Cement",
    "TMT Steel",
    "Bricks",
    "Blocks",
    "Sand",
    "Aggregate",
    "Tiles",
    "Marble",
    "Granite",
    "Paint",
    "Electrical",
    "Plumbing",
    "Sanitaryware",
    "Doors/Windows",
    "Hardware",
    "Roofing",
    "Waterproofing",
    "Adhesives",
    "Plywood / Boards",
    "Glass",
    "Fabrication Materials",
    "Doors",
    "Windows",
    "Other",
  ]) {
    if (
      !rows.some(
        (r) =>
          r.kind === "MATERIAL_CATEGORY" &&
          r.name.toLowerCase() === name.toLowerCase(),
      )
    )
      add("MATERIAL_CATEGORY", name);
  }
  for (const [kind, parent, children] of [
    ["MATERIAL_SUBCATEGORY", "Cement", ["OPC cement", "PPC cement"]],
    ["MATERIAL_SUBCATEGORY", "Tiles", ["Floor Tiles", "Wall Tiles", "Outdoor Tiles", "Parking Tiles"]],
    ["MATERIAL_SUBCATEGORY", "Electricals", ["Wires", "Switches", "Lighting", "Distribution Boards"]],
    ["MATERIAL_SUBCATEGORY", "Plumbing", ["Pipes", "Fittings", "Valves", "Pumps"]],
    ["MATERIAL_SUBCATEGORY", "Paints", ["Interior Paint", "Exterior Paint", "Primer", "Wood Coating"]],
    [
      "PROFESSIONAL_SUBCATEGORY",
      "Architect",
      ["Residential architecture", "Commercial architecture"],
    ],
  ] as const) {
    const parentId = rows.find(
      (r) =>
        r.kind === parentKind[kind] &&
        r.name.toLowerCase() === parent.toLowerCase(),
    )!.id;
    for (const child of children) add(kind, child, masterCode(child), parentId);
  }
  await prisma.$transaction(async (tx) => {
    const claim = await tx.tenant.updateMany({
      where: { id: tenantId, masterCatalogVersion: {lt:3} },
      data: { masterCatalogVersion: 3 },
    });
    if (claim.count) {
      await tx.masterItem.createMany({ data: rows, skipDuplicates: true });
      await seedSpecifications(tx, tenantId);
    }
  });
}
export function activeMasters(kind: MasterKind): Prisma.MasterItemWhereInput {
  const parent = parentKind[kind];
  return { active: true, ...(parent ? { parent: activeMasters(parent) } : {}) };
}

// Materialize only the geographic subset requested; local GeoNames IDs stay stable across imports.
async function preparePlaces(
  tenantId: string,
  kind: MasterKind,
  parentId: string | undefined,
  q: string,
) {
  if (!["STATE", "CITY", "LOCALITY"].includes(kind)) return;
  const parent = parentId
    ? await prisma.masterItem.findFirst({
        where: { tenantId, id: parentId, kind: parentKind[kind] },
      })
    : null;
  if (parentId && !parent) return;
  const countries = await prisma.masterItem.findMany({
    where: { tenantId, kind: "COUNTRY" },
    select: { id: true, code: true },
  });
  const countryIds = new Map(countries.map((c) => [c.code, c.id]));
  function state(country: string, region: string) {
    return masterSeed(
      tenantId,
      "STATE",
      country + "-" + masterCode(region),
      region,
      countryIds.get(country),
    );
  }
  if (kind === "STATE" && (parent || q.length >= 2)) {
    const states = (parent ? [parent] : countries).flatMap((c) =>
      catalogRegions(c.code)
        .filter(
          (name) => parent || name.toLowerCase().includes(q.toLowerCase()),
        )
        .map((name) => state(c.code, name)),
    );
    if (states.length)
      await prisma.masterItem.createMany({
        data: states,
        skipDuplicates: true,
      });
  } else if (kind === "CITY") {
    const country = parent
      ? countries.find((c) => c.id === parent.parentId)?.code
      : undefined;
    const region =
      country && parent
        ? catalogRegions(country).find(
            (name) => country + "-" + masterCode(name) === parent.code,
          )
        : undefined;
    const matched = country
      ? searchDeliveryCities(country, q, region ?? parent!.name)
      : searchSuggestionCities(q, undefined);
    const states = matched
      .filter((c) => countryIds.has(c.countryCode))
      .map((c) => state(c.countryCode, c.region || c.name));
    const cities = matched
      .filter((c) => countryIds.has(c.countryCode))
      .map((c) => ({
        ...masterSeed(
          tenantId,
          "CITY",
          c.id,
          c.name,
          state(c.countryCode, c.region || c.name).id,
        ),
        ...getDeliveryCityCentre(c.id),
      }));
    if (states.length)
      await prisma.$transaction([
        prisma.masterItem.createMany({ data: states, skipDuplicates: true }),
        prisma.masterItem.createMany({ data: cities, skipDuplicates: true }),
      ]);
  } else if (kind === "LOCALITY" && parent) {
    const areas = await prisma.$queryRaw<
      { name: string }[]
    >`SELECT DISTINCT data->>'locality' AS name FROM "WorkspaceItem" WHERE "tenantId"=${tenantId} AND data->>'placeCityId'=${parent.code} AND length(data->>'locality') BETWEEN 1 AND 120 AND "publicAt" IS NOT NULL AND status='PUBLISHED' LIMIT 250`;
    if (areas.length)
      await prisma.masterItem.createMany({
        data: areas.map(({ name }) =>
          masterSeed(
            tenantId,
            kind,
            parent.code + "-" + masterCode(name),
            name,
            parent.id,
          ),
        ),
        skipDuplicates: true,
      });
  }
}
const create = z
  .object({
    kind: z.enum(masterKinds),
    name: z.string().trim().min(1).max(120),
    code: z
      .string()
      .trim()
      .regex(/^[\w-]+$/)
      .max(120),
    parentId: z.string().max(100).optional(),
    sortOrder: z.number().int().nonnegative().max(100000).default(0),
  })
  .strict();
const edit = z
  .object({
    name: create.shape.name.optional(),
    sortOrder: create.shape.sortOrder.optional(),
    active: z.boolean().optional(),
  })
  .strict();
export const mastersRouter: ExpressRouter = Router();
mastersRouter.use(requireSession);
mastersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = req.session!.tenantId;
    const {
      kind,
      parentId,
      parentIds,
      q,
      all: include,
      cursor,
    } = parseInput(
      z.object({
        kind: z.enum(masterKinds),
        parentId: z.string().max(100).optional(),
        parentIds: z
          .string()
          .max(6500)
          .transform((v) => v.split(",").filter(Boolean))
          .optional(),
        q: z.string().trim().max(120).default(""),
        all: z.literal("1").optional(),
        cursor: z.string().max(100).optional(),
      }),
      req.query,
    );
    await ensureCatalog(tenantId);
    if (parentIds?.length) {
      for (const id of new Set(parentIds.slice(0, 100)))
        await preparePlaces(tenantId, kind, id, q);
    } else await preparePlaces(tenantId, kind, parentId, q);
    const data = await prisma.masterItem.findMany({
      where: {
        tenantId,
        kind,
        parentId: parentIds ? { in: parentIds } : parentId,
        ...(include && req.session!.role === "ADMIN"
          ? {}
          : activeMasters(kind)),
        name: { contains: q, mode: "insensitive" },
      },
      select: {
        id: true,
        name: true,
        kind: true,
        code: true,
        parentId: true,
        active: true,
        sortOrder: true,
        latitude: true,
        longitude: true,
        parent: { select: { name: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      take: 51,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    sendSuccess(res, {
      items: data.slice(0, 50),
      next: data.length > 50 ? data[49]!.id : null,
    });
  }),
);
mastersRouter.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const tenantId = req.session!.tenantId;
    await ensureCatalog(tenantId);
    const body = parseInput(create, req.body);
    const parent = parentKind[body.kind];
    if (
      parent
        ? !body.parentId ||
          !(await prisma.masterItem.findFirst({
            where: {
              id: body.parentId,
              tenantId,
              kind: parent,
              ...activeMasters(parent),
            },
          }))
        : body.parentId
    )
      throw new ApiError(
        422,
        "INVALID_PARENT",
        "Choose an active parent of the correct type.",
        { parentId: ["Choose a valid parent."] },
      );
    const row = await prisma.masterItem
      .create({ data: { ...body, tenantId } })
      .catch((e) => {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        )
          throw new ApiError(
            409,
            "DUPLICATE_CODE",
            "This code already exists.",
            { code: ["Choose a unique code."] },
          );
        throw e;
      });
    sendSuccess(res, row, 201);
  }),
);
mastersRouter.patch(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = parseInput(edit, req.body);
    const result = await prisma.masterItem.updateMany({
      where: { id: String(req.params.id), tenantId: req.session!.tenantId },
      data,
    });
    if (!result.count)
      throw new ApiError(404, "NOT_FOUND", "Master entry not found.");
    sendSuccess(res, { updated: true });
  }),
);
