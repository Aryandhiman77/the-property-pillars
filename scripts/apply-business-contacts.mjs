import {readFile, writeFile, rename} from "node:fs/promises";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const root = new URL("../", import.meta.url);
process.loadEnvFile(fileURLToPath(new URL(".env", root)));
const require = createRequire(new URL("apps/api/package.json",root));
const {PrismaClient} = require("@prisma/client");
const db = new PrismaClient();
const folder = new URL("seed-data/", root);
async function read(name) {return JSON.parse(await readFile(new URL(name,folder),"utf8"));}
async function save(name,value) {
  const tmp = new URL(name+".tmp",folder);
  await writeFile(tmp,JSON.stringify(value,null,2)+"\n"); await rename(tmp,new URL(name,folder));
}
const discoveries = await read("office-sources.json");
const registrations = await read("registration.json");
const businesses = new Map();
const term = value => (value || "").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
for (const {profile} of registrations.registrations) {
  if (!["dealer","builder"].includes(profile.role)) continue;
  // The existing Chandigarh match points to a different Mumbai company's domain.
  const found = profile.displayName === "KS Group" && profile.market === "Chandigarh" ? {} : discoveries[profile.id] || {};
  const candidate = key => found[key]?.value;
  const website = candidate("website") || profile.website;
  const priorAddress = typeof profile.address === "string" ? profile.address :
    ["streetAddress","addressLocality","addressRegion","postalCode"].map(k=>profile.address?.[k]).filter(Boolean).join(", ");
  const address = candidate("address") || priorAddress;
  const coordinates = candidate("officeCoordinates");
  let embed = candidate("officeEmbed");
  const target = embed && term(decodeURIComponent(embed).match(/!2s([^!]+)/)?.[1]);
  const name = term(profile.displayName).replace(/ (llp|pvt ltd|limited)$/,"");
  if (!target || !(target.includes(name) || (address && term(address).includes(target)))) embed = undefined;
  const placeUrl = profile.googleMapsUrl;
  const sameAddress = !candidate("address") || term(address) === term(priorAddress);
  const mapUrl = coordinates ? "https://www.google.com/maps/search/?api=1&query="+coordinates.join(",") :
    sameAddress && placeUrl && new URL(placeUrl).searchParams.has("query_place_id") ? placeUrl : undefined;
  const office = Object.fromEntries(Object.entries({website,address,registered:!!candidate("registeredSource"),coordinates,embed,mapUrl,
    email:profile.contactEmail || candidate("contactEmail")}).filter(([,v])=>v));
  const evidence = [...new Set([...(profile.contactSources || []), ...Object.values(found).map(field=>field.source),
    ...(candidate("registeredSource") ? [candidate("registeredSource")] : []), ...(placeUrl ? [placeUrl] : [])])];
  const mobile = profile.mobileNumber || candidate("mobileNumber");
  const phone = mobile || profile.contactPhone || candidate("contactPhone");
  if (!phone && !Object.keys(office).length) continue;
  if (!evidence.length && phone && profile.sourceUrls?.length) evidence.push(profile.sourceUrls[0]);
  businesses.set(profile.id,{office,evidence,phone,mobile,contacts:found,existingMobile:profile.mobileNumber});
}
function enrich(profile) {
  const info = businesses.get(profile.id);
  if (!info) return;
  if (info.mobile) profile.mobileNumber ||= info.mobile;
  if (info.phone) profile.contactPhone ||= info.phone;
  if (info.office.email) profile.contactEmail ||= info.office.email;
  if (info.office.website) profile.website = info.office.website;
  profile.businessOffice = info.office;
  profile.contactSources = info.evidence;
}
const tenantId = process.env.PUBLIC_TENANT_ID || "the-property-pillar-marketplace";
let listings = 0;
try {
  for (const [profileId,info] of businesses) {
    const ownerId = "seed-account-"+profileId;
    await db.$transaction(async tx=>{
      const domain = await tx.domainProfile.findFirst({where:{userId:ownerId,user:{tenantId}},select:{id:true,role:true}});
      if (!domain) return;
      const office = info.office;
      const profileModel = domain.role === "DEALER" ? tx.dealerProfile : tx.builderProfile;
      const existing = await profileModel.findUnique({where:{profileId:domain.id}});
      if (existing) {
        const update = {};
        if (!existing.address && office.address) {
          update.address = office.address;
          if (office.coordinates) [update.latitude,update.longitude] = office.coordinates;
        }
        if (!existing.website && office.website) update.website = office.website;
        if (domain.role==="BUILDER") {
          if (!existing.contactEmail && office.email) update.contactEmail = office.email;
          if (!existing.contactPhone && info.phone) update.contactPhone = info.phone;
        }
        if (Object.keys(update).length) await profileModel.update({where:{profileId:domain.id},data:update});
      }
      const rows = await tx.$queryRaw`SELECT id,data FROM "WorkspaceItem" WHERE "tenantId"=${tenantId} AND "ownerId"=${ownerId} AND collection='PROPERTIES' AND data ? 'sourceListing' FOR UPDATE`;
      for (const {id,data} of rows) {
        const source = data.sourceListing;
        const contacts = [...(source.relatedBusinessContacts || [])];
        const match = contacts.find(c=>c.profileId===profileId);
        if (info.phone && info.evidence.length) {
          const entry = match || {profileId,relationship:domain.role.toLowerCase()};
          entry.phone ||= info.phone;
          entry.mobileNumber ||= info.mobile;
          entry.email ||= office.email;
          if (!info.existingMobile && !match?.whatsappPhone) entry.whatsappPhone = null;
          entry.evidence = [...new Set([...(entry.evidence || []),...info.evidence])];
          if (!match) contacts.push(entry);
        }
        await tx.workspaceItem.update({where:{id},data:{data:{...data,sourceListing:{...source,relatedBusinessContacts:contacts,publisherOffice:office}}}});
        listings++;
      }
    });
  }
  for (const item of registrations.registrations) enrich(item.profile);
  await save("registration.json",registrations);
  const eligible = registrations.registrations.filter(({profile,listings}) =>
    [profile.mobileNumber,profile.contactPhone].some(n=>typeof n==="string" && /^\d{7,15}$/.test(n.replace(/\D/g,""))) &&
    listings.some(l=>l.relationship==="panelPublisher" && l.panelPublisherId===profile.id));
  const ids = new Set(eligible.map(r=>r.profile.id));
  const eligibleListings = new Set(eligible.flatMap(r=>r.listings.filter(l=>l.relationship==="panelPublisher" && l.panelPublisherId===r.profile.id).map(l=>l.id)));
  const subset = eligible.map(r=>{
    const listings = r.listings.filter(l=>eligibleListings.has(l.id));
    return {...r,listings,profile:{...r.profile,propertyIds:listings.map(l=>l.id)}};
  });
  await save("phone-listed/registration.json",{...registrations,registrations:subset,projectsWithoutNamedBuilder:[]});
  const logins = await read("login-profiles.json");
  await save("phone-listed/login-profiles.json",{...logins,accounts:logins.accounts.filter(a=>ids.has(a.profileId))});
  const catalog = await read("property-pillars.json");
  for (const profile of [...catalog.dealers,...catalog.builders]) enrich(profile);
  await save("property-pillars.json",catalog);
  console.log(JSON.stringify({businessProfiles:businesses.size,listingUpdates:listings,
    phone:[...businesses.values()].filter(v=>v.phone).length,mobile:[...businesses.values()].filter(v=>v.mobile).length,
    email:[...businesses.values()].filter(v=>v.office.email).length,address:[...businesses.values()].filter(v=>v.office.address).length,
    map:[...businesses.values()].filter(v=>v.office.coordinates||v.office.embed||v.office.mapUrl).length}));
} finally {await db.$disconnect();}

