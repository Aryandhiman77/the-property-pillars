import type {Prisma} from "@prisma/client";
import {workspacePrisma} from "./db.js";
import {mapLeadPhoneHash} from "./property-map.js";

export async function hasPropertyLead(tenantId: string, userId: string, propertyId: string, db: Prisma.TransactionClient = workspacePrisma) {
  const enquiry = await db.workspaceItem.findFirst({where: {
    tenantId, ownerId: userId, parentId: propertyId, collection: "PROPERTY_INQUIRIES", status: {not: "SPAM"},
  }, select: {id: true}});
  if (enquiry) return true;

  const account = await db.user.findFirst({where: {tenantId, id: userId, phoneVerifiedAt: {not: null}}, select: {phone: true}});
  if (!account?.phone) return false;
  return Boolean(await db.propertyMapLead.findFirst({where: {
    tenantId, propertyId, phoneHash: mapLeadPhoneHash(propertyId, account.phone), status: {not: "SPAM"},
  }, select: {id: true}}));
}
