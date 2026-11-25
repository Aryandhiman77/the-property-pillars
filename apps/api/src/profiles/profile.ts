import { Prisma, type ProfileVerification } from "@prisma/client";
import {
  roleSections,
  listingCurrencyCodes,
  siteLocales,
  type ProfileField,
  type ProfileRole,
} from "@the-property-pillar/contracts";
import { z } from "zod";
import { prisma } from "../database/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { profileRelations, saveDetail } from "./details.js";
import { activeMasters } from "./masters.js";
import type { AuthSessionContext } from "../types/auth.js";

import { reconcileProfile } from "./legacy.js";

type Tx = Prisma.TransactionClient;
export const roleOf = (role: string): ProfileRole => {
  if (!Object.hasOwn(roleSections, role))
    throw new ApiError(
      403,
      "NO_MARKETPLACE_PROFILE",
      "This role has no marketplace profile.",
    );
  return role as ProfileRole;
};
export const invalid = (field: string, message: string) =>
  new ApiError(422, "INVALID_PROFILE", message, { [field]: [message] });
export const conflict = () =>
  new ApiError(
    409,
    "PROFILE_CHANGED",
    "This profile changed. Reload before saving or reviewing it.",
  );
export async function ensureProfile(session: AuthSessionContext) {
  const role = roleOf(session.role);
  const profile = await prisma.domainProfile.upsert({
    where: { userId_role: { userId: session.userId, role } },
    update: {},
    create: {
      userId: session.userId,
      role,
      [profileRelations[role]]: { create: {} },
    },
  });
  await reconcileProfile(profile, session.tenantId);
  return profile;
}
export const fileInfo = {
  id: true,
  field: true,
  category: true,
  visibility: true,
  originalName: true,
  mime: true,
  size: true,
  createdAt: true,
} as const;
const attached = {
  user: {
    select: {
      id: true,
      tenantId: true,
      role: true,
      fullName: true,
      email: true,
      phone: true,
      pendingRegistrationPhone: true,
      profileLogoUrl: true,
      profileLocation: true,
    },
  },
  choices: {
    include: {
      master: {
        select: {
          id: true,
          kind: true,
          name: true,
          parentId: true,
          active: true,
        },
      },
    },
  },
  files: { select: fileInfo, orderBy: { createdAt: "desc" } },
  history: { orderBy: { createdAt: "desc" }, take: 30 },
  buyerProfile: true,
  ownerProfile: true,
  dealerProfile: true,
  builderProfile: true,
  vendorProfile: true,
  professionalProfile: true,
  jobSeekerProfile: true,
  workerProfile: true,
} satisfies Prisma.DomainProfileInclude;
export async function snapshot(tx: Tx, id: string, tenantId: string) {
  const p = await tx.domainProfile.findFirst({
    where: { id, user: { tenantId } },
    include: attached,
  });
  if (!p || p.user.role !== p.role)
    throw new ApiError(404, "PROFILE_NOT_FOUND", "Profile not found.");
  const role = roleOf(p.role);
  const values: Record<string, unknown> = { ...p[profileRelations[role]] };
  delete values.profileId;
  for (const f of roleSections[role].flatMap((s) => s.fields)) {
    const choices = p.choices.filter((c) => c.field === f.key);
    if (f.kind === "master") values[f.key] = choices[0]?.masterId ?? null;
    if (f.kind === "masters") values[f.key] = choices.map((c) => c.masterId);
    if (f.kind === "file")
      values[f.key] = p.files.find((file) => file.field === f.key)?.id ?? null;
  }
  const selected = p.choices.map(c => c.master);
  // Older Worker profiles saved a canonical city or state without all its ancestors.
  if (role === "BLUE_COLLAR_WORKER") {
    for (const [child, field, kind] of [["city", "state", "STATE"], ["state", "country", "COUNTRY"]] as const) {
      const parentId = selected.find(o => o.id === values[child])?.parentId;
      if (values[field] || !parentId) continue;
      const master = await tx.masterItem.findFirst({
        where: {id: parentId, tenantId, kind}, select: attached.choices.include.master.select,
      });
      if (master) { values[field] = master.id; selected.push(master); }
    }
  }
  const { pendingRegistrationPhone, ...account } = p.user;
  account.phone ??= pendingRegistrationPhone;
  return {
    id: p.id,
    role,
    revision: p.revision,
    verification: p.verification,
    account,
    values,
    selected,
    files: p.files,
    history: p.history,
    completion: completion(role, values, account),
  };
}
const present = (v: unknown) =>
  v !== null &&
  v !== undefined &&
  v !== "" &&
  (!Array.isArray(v) || v.length > 0);
export function completion(
  role: ProfileRole,
  values: Record<string, unknown>,
  user: { fullName: string; phone: string | null; email: string | null },
) {
  const sections = [
    {
      key: "Account",
      missing: [
        ...(!user.fullName ? ["Full name"] : []),
        ...(!user.phone ? ["Mobile number"] : []),
        ...(!user.email && role !== "BLUE_COLLAR_WORKER" ? ["Email"] : []),
      ],
    },
    ...roleSections[role]
      .map((s) => {
        const required = s.fields.filter(
          (f) =>
            f.required ||
            (s.title === "Registration" &&
              values.reraRegistered === true &&
              ["reraNumber", "reraAuthority", "reraCertificate"].includes(
                f.key,
              )),
        );
        return {
          key: s.title,
          required: required.length > 0,
          missing: required
            .filter((f) => !present(values[f.key]))
            .map((f) => f.label),
        };
      })
      .filter((s) => s.required),
  ];
  const completedSections = sections
    .filter((s) => !s.missing.length)
    .map((s) => s.key);
  const incompleteSections = sections.filter((s) => s.missing.length);
  return {
    percentage: Math.round((100 * completedSections.length) / sections.length),
    completedSections,
    incompleteSections,
    sections,
    nextRecommendedActions: incompleteSections.map(
      (s) => "Complete " + s.key.toLowerCase() + " - " + s.missing[0],
    ),
  };
}
export function fieldSchema(f: ProfileField): z.ZodTypeAny {
  const text = z.string().trim().min(1).max(180);
  const options = (values: readonly string[]) =>
    text.refine((v) => values.includes(v), "Select a listed option.");
  switch (f.kind) {
    case "boolean":
      return z.boolean();
    case "number":
      return z.number().finite().nonnegative().max(1e15);
    case "integer":
    case "years":
    case "year":
    case "months":
      return z
        .number()
        .int()
        .min(f.kind === "year" ? 1800 : 0)
        .max(
          f.kind === "year"
            ? new Date().getFullYear()
            : f.kind === "years"
              ? 100
              : f.kind === "months"
                ? 11
                : 1e7,
        );
    case "latitude":
      return z.number().min(-90).max(90);
    case "longitude":
      return z.number().min(-180).max(180);
    case "phone":
      return z
        .string()
        .regex(
          /^\+[1-9]\d{6,14}$/,
          "Include a valid international calling code.",
        );
    case "email":
      return text.email();
    case "date":
      return z.string().date();
    case "url":
      return z
        .string()
        .max(2048)
        .url()
        .regex(/^https?:\/\//i, "Use an HTTP or HTTPS link.");
    case "currency":
      return options(listingCurrencyCodes);
    case "language":
      return options(siteLocales);
    case "languages":
      return z.array(options(siteLocales)).max(siteLocales.length);
    case "select":
      return options(f.options!);
    case "many":
      return z.array(options(f.options!)).max(f.options!.length);
    case "masters":
      return z.array(text).max(100);
    case "rows":
      return z
        .array(
          z
            .object(
              Object.fromEntries(
                f.fields!.map((c) => [
                  c.key,
                  c.required ? fieldSchema(c) : fieldSchema(c).nullish(),
                ]),
              ),
            )
            .strict(),
        )
        .max(40);
    case "long":
      return z.string().trim().max(5000);
    default:
      return text;
  }
}
export async function bump(
  tx: Tx,
  p: { id: string; revision: number; verification: ProfileVerification },
  actorId: string,
  next: ProfileVerification,
  reason: string,
) {
  const write = await tx.domainProfile.updateMany({
    where: { id: p.id, revision: p.revision, verification: p.verification },
    data: { revision: { increment: 1 }, verification: next },
  });
  if (write.count !== 1) throw conflict();
  if (next !== p.verification)
    await tx.profileDecision.create({
      data: {
        profileId: p.id,
        actorId,
        revision: p.revision + 1,
        fromState: p.verification,
        toState: next,
        reason,
      },
    });
}
export const editState = (state: ProfileVerification) =>
  state === "SUSPENDED" ? "SUSPENDED" : "NOT_SUBMITTED";
export async function saveSection(
  session: AuthSessionContext,
  id: string,
  section: string,
  values: Record<string, unknown>,
  revision: number,
) {
  const role = roleOf(session.role);
  const sectionFields = roleSections[role].find((s) => s.title === section)?.fields;
  const legacyWorkerCity = role === "BLUE_COLLAR_WORKER" && section === "Trade and rate" && "city" in values;
  const fields = legacyWorkerCity && sectionFields
    ? [...sectionFields, ...roleSections[role].flatMap(s => s.fields).filter(f => ["country", "state", "city"].includes(f.key))]
    : sectionFields;
  if (!fields)
    throw invalid("section", "Choose a profile section for your role.");
  return prisma.$transaction(async (tx) => {
    const current = await snapshot(tx, id, session.tenantId);
    if (current.role !== role || current.account.id !== session.userId)
      throw new ApiError(403, "FORBIDDEN", "Profile access denied.");
    if (current.revision !== revision) throw conflict();
    const parsed: Record<string, unknown> = {};
    for (const [k, input] of Object.entries(values)) {
      const f = fields.find((f) => f.key === k && f.kind !== "file");
      if (!f) throw invalid(k, "This field cannot be changed here.");
      if (input === null || input === "")
        parsed[k] = ["many", "masters", "languages", "rows"].includes(f.kind)
          ? []
          : null;
      else {
        const result = fieldSchema(f).safeParse(input);
        if (!result.success) throw invalid(k, result.error.issues[0]!.message);
        parsed[k] = result.data;
      }
    }
    if (
      !Object.entries(parsed).some(
        ([k, v]) =>
          JSON.stringify(current.values[k] ?? null) !== JSON.stringify(v),
      )
    )
      return current;
    if (legacyWorkerCity && parsed.city) {
      const city = await tx.masterItem.findFirst({
        where: {tenantId: session.tenantId, id: String(parsed.city), kind: "CITY"},
        select: {parent: {select: {id: true, parentId: true}}},
      });
      if (!city?.parent?.parentId) throw invalid("city", "Choose a city with a state and country.");
      parsed.state ??= city.parent.id;
      parsed.country ??= city.parent.parentId;
    }
    const merged = { ...current.values, ...parsed };
    for (const [a, b] of [
      ["budgetMin", "budgetMax"],
      ["issueDate", "expiryDate"],
    ] as const) {
      if (present(merged[a]) && present(merged[b]) && merged[a]! > merged[b]!)
        throw invalid(b, "Enter a value on or after the minimum.");
    }
    const all = roleSections[role].flatMap((s) => s.fields);
    // Validate the complete dependent chain, including children saved in an earlier section.
    for (const f of all.filter((f) => f.master && f.parent)) {
      const v = merged[f.key],
        ids = Array.isArray(v) ? v : v ? [v] : [];
      if (!ids.length) continue;
      const parentValue = merged[f.parent!],
        parents = Array.isArray(parentValue)
          ? parentValue.map(String)
          : parentValue
            ? [String(parentValue)]
            : [];
      if (
        !parents.length ||
        (await tx.masterItem.count({
          where: {
            id: { in: ids as string[] },
            tenantId: session.tenantId,
            kind: f.master,
            parentId: { in: parents },
          },
        })) !== ids.length
      )
        throw invalid(
          f.key,
          "Choose a value belonging to the selected parent.",
        );
    }
    async function choices(
      f: ProfileField,
      field: string,
      ids: string[],
      labelKey: string,
    ) {
      const unique = [...new Set(ids)];
      const prior = await tx.profileChoice.findMany({
        where: { profileId: id, field },
        select: { masterId: true },
      });
      const existing = prior.map((c) => c.masterId);
      const valid = await tx.masterItem.count({
        where: {
          tenantId: session.tenantId,
          kind: f.master,
          id: { in: unique },
          OR: [activeMasters(f.master!), { id: { in: existing } }],
        },
      });
      if (valid !== unique.length)
        throw invalid(labelKey, "Choose an active value from the list.");
      await tx.profileChoice.deleteMany({ where: { profileId: id, field } });
      await tx.profileChoice.createMany({
        data: unique.map((masterId) => ({ profileId: id, field, masterId })),
      });
    }
    const detail: Record<string, unknown> = {};
    for (const f of fields.filter((f) => Object.hasOwn(parsed, f.key))) {
      const v = parsed[f.key];
      if (f.master) {
        await choices(
          f,
          f.key,
          Array.isArray(v) ? v : v ? [String(v)] : [],
          f.key,
        );
        continue;
      }
      if (f.kind === "rows") {
        const rows = v as Record<string, unknown>[];
        for (const sub of f.fields!) {
          const vals = rows
            .map((row) => row[sub.key])
            .filter(present)
            .map(String);
          if (sub.master)
            await choices(sub, f.key + "." + sub.key, vals, f.key);
          if (
            sub.kind === "file" &&
            vals.some(
              (fileId) =>
                !current.files.some(
                  (file) =>
                    file.id === fileId && file.field === f.key + "." + sub.key,
                ),
            )
          )
            throw invalid(
              f.key,
              "Choose a supporting document from this profile.",
            );
        }
        for (const row of rows)
          if (
            (row.startDate && row.endDate && row.endDate < row.startDate) ||
            (row.issueDate && row.expiryDate && row.expiryDate < row.issueDate)
          )
            throw invalid(f.key, "Check the start and end dates.");
      }
      detail[f.key] = v;
    }
    await saveDetail(tx, role, id, detail);
    await bump(
      tx,
      current,
      session.userId,
      editState(current.verification),
      "Profile section updated: " + section,
    );
    return snapshot(tx, id, session.tenantId);
  });
}
