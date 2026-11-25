import type { Prisma } from "@prisma/client";
import type { ProfileRole } from "@the-property-pillar/contracts";

export const profileRelations = {
  BUYER: "buyerProfile",
  OWNER: "ownerProfile",
  DEALER: "dealerProfile",
  BUILDER: "builderProfile",
  VENDOR: "vendorProfile",
  PROFESSIONAL: "professionalProfile",
  WHITE_COLLAR_SEEKER: "jobSeekerProfile",
  BLUE_COLLAR_WORKER: "workerProfile",
} as const;

export async function saveDetail(
  tx: Prisma.TransactionClient,
  role: ProfileRole,
  profileId: string,
  data: Record<string, unknown>,
) {
  switch (role) {
    case "BUYER":
      return tx.buyerProfile.upsert({
        where: { profileId },
        create: { profileId, ...data },
        update: data,
      });
    case "OWNER":
      return tx.ownerProfile.upsert({
        where: { profileId },
        create: { profileId, ...data },
        update: data,
      });
    case "DEALER":
      return tx.dealerProfile.upsert({
        where: { profileId },
        create: { profileId, ...data },
        update: data,
      });
    case "BUILDER":
      return tx.builderProfile.upsert({
        where: { profileId },
        create: { profileId, ...data },
        update: data,
      });
    case "VENDOR":
      return tx.vendorProfile.upsert({
        where: { profileId },
        create: { profileId, ...data },
        update: data,
      });
    case "PROFESSIONAL":
      return tx.professionalProfile.upsert({
        where: { profileId },
        create: { profileId, ...data },
        update: data,
      });
    case "WHITE_COLLAR_SEEKER":
      return tx.jobSeekerProfile.upsert({
        where: { profileId },
        create: { profileId, ...data },
        update: data,
      });
    case "BLUE_COLLAR_WORKER":
      return tx.workerProfile.upsert({
        where: { profileId },
        create: { profileId, ...data },
        update: data,
      });
  }
}
