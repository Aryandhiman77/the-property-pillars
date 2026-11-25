import type { DomainProfile, Prisma, WorkspaceItem } from "@prisma/client";
import {
  findDeliveryCities,
  getDeliveryCity,
  getDeliveryCityCentre,
} from "../locations/delivery-cities.js";
import { prisma } from "../database/prisma.js";
import { ensureCatalog, masterCode, masterSeed } from "./masters.js";

const sources = {
  DEALER: "DEALER_PROFILES",
  PROFESSIONAL: "SERVICE_PROFILES",
  BLUE_COLLAR_WORKER: "WORKER_PROFILES",
} as const;
type LegacyRole = keyof typeof sources;
export async function reconcileProfile(p: DomainProfile, tenantId: string) {
  if (p.revision !== 0 || !(p.role in sources)) return;
  const role = p.role as LegacyRole;
  const source = await prisma.workspaceItem.findFirst({
    where: { tenantId, ownerId: p.userId, collection: sources[role] },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
  if (!source) return;
  const note = await prisma.profileMigrationNote.findUnique({
    where: { sourceId: source.id },
  });
  if (
    note &&
    ![
      "Copied compatible fields; other keys retained on original workspace item",
      "Matched canonical references; unmatched source fields retained",
    ].includes(note.note)
  )
    return;
  await ensureCatalog(tenantId);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "DomainProfile" WHERE id=${p.id} FOR UPDATE`;
    if (
      (await tx.domainProfile.findUniqueOrThrow({ where: { id: p.id } }))
        .revision !== 0
    )
      return;
    await mapSource(tx, p.id, role, source, note?.mappedFields ?? []);
  });
}
async function mapSource(
  tx: Prisma.TransactionClient,
  profileId: string,
  role: LegacyRole,
  source: WorkspaceItem,
  prior: string[],
) {
  const { tenantId } = source,
    d = (source.data ?? {}) as Record<string, unknown>;
  const mapped = new Set(prior);
  async function link(field: string, masterId: string) {
    await tx.profileChoice.createMany({
      data: [{ field, masterId, profileId }],
      skipDuplicates: true,
    });
  }
  async function cityMasters(
    city: NonNullable<ReturnType<typeof getDeliveryCity>>,
  ) {
    const country = masterSeed(
      tenantId,
      "COUNTRY",
      city.countryCode,
      city.countryCode,
    );
    const state = masterSeed(
      tenantId,
      "STATE",
      city.countryCode + "-" + masterCode(city.region || city.name),
      city.region || city.name,
      country.id,
    );
    const place = masterSeed(tenantId, "CITY", city.id, city.name, state.id);
    await tx.masterItem.createMany({
      data: [country, state, { ...place, ...getDeliveryCityCentre(city.id) }],
      skipDuplicates: true,
    });
    return { country, state, place };
  }
  const typeField =
    role === "PROFESSIONAL"
      ? "serviceType"
      : role === "BLUE_COLLAR_WORKER"
        ? "trade"
        : "";
  if (typeField && typeof d[typeField] === "string") {
    const item = await tx.masterItem.findFirst({
      where: {
        tenantId,
        kind: typeField === "trade" ? "TRADE" : "PROFESSIONAL_CATEGORY",
        name: { equals: d[typeField], mode: "insensitive" },
        active: true,
      },
    });
    if (item) {
      await link(typeField === "trade" ? "trade" : "category", item.id);
      mapped.add(typeField);
    }
  }
  const matches = findDeliveryCities(d.city, d.countryCode, d.state);
  const city =
    getDeliveryCity(d.placeCityId) ??
    (matches.length === 1 ? matches[0] : undefined);
  if (
    city &&
    (!d.countryCode || d.countryCode === city.countryCode) &&
    (!d.state || masterCode(String(d.state)) === masterCode(city.region))
  ) {
    const { country, state, place } = await cityMasters(city);
    await link("country", country.id);
    await link("state", state.id);
    await link(role === "PROFESSIONAL" ? "citiesServed" : "city", place.id);
    for (const k of ["city", "countryCode", "placeCityId", "state"])
      if (d[k]) mapped.add(k);
  }
  const areaField =
    role === "DEALER"
      ? "citiesServed"
      : role === "PROFESSIONAL"
        ? "serviceAreas"
        : null;
  if (areaField && Array.isArray(d[areaField])) {
    let allMatched = true;
    for (const area of d[areaField]) {
      const matches = findDeliveryCities(area, d.countryCode);
      const match = matches.length === 1 ? matches[0] : undefined;
      if (
        !match ||
        (role === "PROFESSIONAL" &&
          (!city ||
            city.countryCode !== match.countryCode ||
            city.region !== match.region))
      ) {
        allMatched = false;
        continue;
      }
      const { place } = await cityMasters(match);
      await link("citiesServed", place.id);
    }
    if (allMatched) mapped.add(areaField);
  }
  function sourceText(key: string) {
    const value = d[key];
    if (typeof value !== "string" || !value.trim()) return undefined;
    mapped.add(key);
    return value;
  }
  const experience =
    typeof d.yearsExperience === "number" &&
    Number.isInteger(d.yearsExperience) &&
    d.yearsExperience >= 0 &&
    d.yearsExperience <= 100
      ? d.yearsExperience
      : undefined;
  if (role === "DEALER") {
    await tx.dealerProfile.update({
      where: { profileId },
      data: {
        agencyName: sourceText("agencyName"),
        address: sourceText("officeAddress"),
        reraNumber: sourceText("reraNumber"),
        postalCode: sourceText("postalCode"),
        whatsapp: sourceText("whatsappPhone"),
        about: source.description ?? undefined,
      },
    });
  }
  if (role === "PROFESSIONAL") {
    await tx.professionalProfile.update({
      where: { profileId },
      data: {
        practiceName: source.title,
        about: source.description ?? undefined,
        whatsapp: sourceText("whatsappPhone"),
        yearsExperience: experience,
      },
    });
    if (experience !== undefined) mapped.add("yearsExperience");
  }
  if (role === "BLUE_COLLAR_WORKER") {
    const rate =
      typeof d.dailyRate === "number" && d.dailyRate >= 0
        ? d.dailyRate
        : undefined;
    const availability =
      typeof d.availableNow === "boolean"
        ? d.availableNow
          ? "Available Now"
          : "Busy"
        : undefined;
    await tx.workerProfile.update({
      where: { profileId },
      data: {
        rate,
        whatsapp: sourceText("whatsappPhone"),
        yearsExperience: experience,
        rateType: rate !== undefined ? "Daily" : undefined,
        currency: typeof d.currency === "string" ? d.currency : undefined,
        availability,
      },
    });
    if (experience !== undefined) mapped.add("yearsExperience");
    if (rate !== undefined) mapped.add("dailyRate");
    if (availability) mapped.add("availableNow");
    if (typeof d.currency === "string") mapped.add("currency");
  }
  const report = {
    profileId,
    role,
    mappedFields: [...mapped],
    retainedFields: Object.keys(d).filter((k) => !mapped.has(k)),
    note: "Reconciled scalar fields, classifications and service cities; other keys retained",
  };
  await tx.profileMigrationNote.upsert({
    where: { sourceId: source.id },
    create: { sourceId: source.id, ...report },
    update: report,
  });
}
