import { prisma } from "../database/prisma.js";
import type { UserRole } from "@prisma/client";
const publicRoles: Record<string, UserRole> = {
  dealerProfiles: "DEALER",
  serviceProfiles: "PROFESSIONAL",
  workerProfiles: "BLUE_COLLAR_WORKER",
  builderProjects: "BUILDER",
  materialProducts: "VENDOR",
};
export async function publicBusinessProfiles(
  tenantId: string,
  collection: string,
  ownerIds: string[],
) {
  const result = new Map<
    string,
    {
      name: string | null;
      about: string | null;
      categories: string[];
      specializations: string[];
      logo: string | null;
      yearsExperience: number | null;
      website: string | null;
    }
  >();
  const role = publicRoles[collection];
  if (!role || !ownerIds.length) return result;
  const rows = await prisma.domainProfile.findMany({
    where: {
      role,
      verification: "VERIFIED",
      userId: { in: ownerIds },
      user: { tenantId, role, status: "ACTIVE" },
    },
    select: {
      userId: true,
      choices: {
        where: {
          field: {
            in: [
              "trade",
              "category",
              "categories",
              "citiesServed",
              "cities",
              "specializations",
            ],
          },
        },
        select: { master: { select: { name: true } } },
      },
      files: {
        where: { field: "logo", visibility: "PUBLIC" },
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { id: true },
      },
      dealerProfile: {
        select: {
          agencyName: true,
          about: true,
          specializations: true,
          website: true,
          yearsExperience: true,
        },
      },
      builderProfile: {
        select: {
          brandName: true,
          about: true,
          specializations: true,
          website: true,
        },
      },
      professionalProfile: {
        select: {
          practiceName: true,
          about: true,
          website: true,
          yearsExperience: true,
        },
      },
      workerProfile: { select: { yearsExperience: true } },
      vendorProfile: {
        select: { businessName: true, about: true, website: true },
      },
    },
  });
  for (const r of rows)
    result.set(r.userId, {
      name:
        r.dealerProfile?.agencyName ??
        r.builderProfile?.brandName ??
        r.professionalProfile?.practiceName ??
        r.vendorProfile?.businessName ??
        null,
      about:
        r.dealerProfile?.about ??
        r.builderProfile?.about ??
        r.professionalProfile?.about ??
        r.vendorProfile?.about ??
        null,
      specializations:
        r.dealerProfile?.specializations ??
        r.builderProfile?.specializations ??
        [],
      yearsExperience:
        r.dealerProfile?.yearsExperience ??
        r.professionalProfile?.yearsExperience ??
        r.workerProfile?.yearsExperience ??
        null,
      website:
        r.dealerProfile?.website ??
        r.builderProfile?.website ??
        r.professionalProfile?.website ??
        r.vendorProfile?.website ??
        null,
      categories: r.choices.map((c) => c.master.name),
      logo: r.files[0] ? "/api/v1/profiles/files/" + r.files[0].id : null,
    });
  return result;
}
