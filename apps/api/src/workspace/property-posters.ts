import type {UserRole} from "@prisma/client";
import {workspacePrisma} from "./db.js";

type PropertyPoster = {name: string; role: UserRole; logoUrl?: string; aboutMe?: string; agencyName?: string; dealer?: string; project?: string};
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

export async function publicPropertyPosters(tenantId: string, ownerIds: string[], includeBio = false): Promise<Map<string, PropertyPoster>> {
  if (!ownerIds.length) return new Map();
  const posters = await workspacePrisma.user.findMany({
    where: {tenantId, id: {in: [...new Set(ownerIds)]}},
    select: {id: true, fullName: true, role: true, status: true, profileLogoUrl: true, aboutMe: includeBio},
  });
  const dealers = posters.filter(({role}) => role === "DEALER").map(({id}) => id);
  const builders = posters.filter(({role}) => role === "BUILDER").map(({id}) => id);
  const profiles = dealers.length || builders.length ? await workspacePrisma.workspaceItem.findMany({
    where: {tenantId, publicAt: {not: null}, OR: [
      {ownerId: {in: dealers}, collection: "DEALER_PROFILES", status: "VERIFIED"},
      {ownerId: {in: builders}, collection: "BUILDER_PROJECTS", status: "PUBLISHED"},
    ]}, orderBy: {publicAt: "desc"}, distinct: ["ownerId"], select: {id: true, ownerId: true, data: true, description: includeBio},
  }) : [];
  const now = new Date();
  const featured = new Set((await workspacePrisma.billingEntitlement.findMany({where: {tenantId,userId: {in: ownerIds}, type:"PROFILE_FEATURE",status:"ACTIVE",revokedAt:null, startsAt:{lte:now},endsAt:{gt:now},sourceOrder:{status:"CAPTURED"}},select:{userId:true}})).map(row => row.userId));
  const profilesByOwner = new Map(profiles.map((profile) => [profile.ownerId, profile]));
  return new Map(posters.map(({id, fullName, role, status, profileLogoUrl, aboutMe}) => {
    const profile = profilesByOwner.get(id);
    const value = profile?.data;
    const data = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const logo = (status === "ACTIVE" && profileLogoUrl) || (role === "DEALER" && text(data.logoUrl));
    const bio = includeBio && role === "DEALER" && status === "ACTIVE" ? aboutMe?.trim() || profile?.description?.trim() : undefined;
    return [id, {name: fullName, featured: featured.has(id), role: role === "BUYER" ? "OWNER" : role,
      ...(logo ? {logoUrl: logo} : {}), ...(bio ? {aboutMe: bio} : {}),
      ...(profile && role === "DEALER" ? {agencyName: text(data.agencyName), dealer: text(data.slug) || profile.id} : {}),
      ...(profile && role === "BUILDER" ? {project: profile.id} : {}),
    }];
  }));
}
