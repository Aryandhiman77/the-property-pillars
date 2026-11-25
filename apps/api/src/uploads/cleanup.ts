import {projectFileReference} from "../projects/media-reference.js";
import {randomUUID} from "node:crypto";
import {opendir, rename, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import type {WorkspaceCollection} from "@prisma/client";
import {workspacePrisma} from "../workspace/db.js";
import {collectionConfigs, type CollectionKey} from "../workspace/config.js";
import {imageOwner, imageReferenceWhere, stagedUploadLifetime, uploadDirectory, uploadName, type UploadOwner} from "./images.js";

async function isReferenced(owner: UploadOwner, url: string) {
  const {tenantId, userId, purpose} = owner;
  if (purpose === "account:logoUrl") {
    return Boolean(await workspacePrisma.user.findFirst({where: {id: userId, tenantId, profileLogoUrl: url}, select: {id: true}}));
  }
  if (purpose.startsWith("homepageSlides:")) {
    return Boolean(await workspacePrisma.homepageSlide.findFirst({where: {tenantId, OR: [{imageUrl: url}, {videoUrl: url}]}, select: {id: true}}));
  }
  if (purpose === "articles:coverImage") {
    return Boolean(await workspacePrisma.article.findFirst({where: {tenantId, coverImage: url}, select: {id: true}}));
  }
  const collection = purpose.split(":")[0] as CollectionKey;
  if(collection==="builderProjects" && await workspacePrisma.builderProject.count({where:{tenantId,...projectFileReference(url)}}))return true;
  if (!Object.hasOwn(collectionConfigs, collection)) return false;
  return Boolean(await workspacePrisma.workspaceItem.findFirst({
    where: {tenantId, collection: collectionConfigs[collection].dbCollection as WorkspaceCollection, OR: imageReferenceWhere(collection, url)},
    select: {id: true},
  }));
}

export async function cleanStagedUploads(now = Date.now()) {
  const directory = await opendir(uploadDirectory).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  });
  if (!directory) return;
  for await (const entry of directory) {
    const name = entry.name.slice(0, -5);
    if (!entry.isFile() || !entry.name.endsWith(".json") || !uploadName.test(name)) continue;
    const owner = await imageOwner(name);
    // Attachment requests expire a day before cleanup, so in-flight saves can commit.
    if (!owner?.stagedAt || now - owner.stagedAt < 2 * stagedUploadLifetime) continue;
    const path = join(uploadDirectory, name);
    const metadata = path + ".json";
    if (await isReferenced(owner, "/api/v1/uploads/" + name)) {
      const {tenantId, userId, purpose} = owner;
      const temporary = metadata + "." + randomUUID();
      try {
        await writeFile(temporary, JSON.stringify({tenantId, userId, purpose}), {flag: "wx"});
        await rename(temporary, metadata);
      } finally {
        await rm(temporary, {force: true});
      }
    } else {
      await rm(path, {force: true});
      await rm(metadata, {force: true});
    }
  }
}
