import {readFile} from "node:fs/promises";
import {join} from "node:path";
import sharp from "sharp";
import sanitizeHtml from "sanitize-html";
import {blockedListingWords, listingContexts, listingIssueMessages, type ListingIssue} from "@the-property-pillar/contracts";
import {contentModerationProvider} from "./moderation-provider.js";
import {imageFields, uploadDirectory, uploadedImageName} from "../uploads/images.js";
import {ApiError} from "../utils/api-error.js";
import {collectionConfigs, type CollectionKey} from "./config.js";

const unavailable = () => new ApiError(503, "CONTENT_CHECK_UNAVAILABLE", "Content could not be checked. Please try submitting again later.");
function rejectIssues(issues: ListingIssue[]) {
  if (!issues.length) return;
  throw new ApiError(422, "LISTING_CONTENT_REJECTED", "Please review the flagged content before submitting.", {
    issues, fieldErrors: Object.fromEntries(issues.map(issue => [issue.field, listingIssueMessages[issue.reason]])),
  });
}

export async function moderateListing(key: CollectionKey, status: string, title: string, description: string | null | undefined, data: Record<string, unknown>) {
  const config = collectionConfigs[key];
  if (!config.publicAlias || ![...(config.publicStatuses ?? []), "PENDING_REVIEW", "PENDING_VERIFICATION", "APPROVED"].includes(status)) return;
  const context = listingContexts[key] ?? config.label;
  const fields: Record<string, string> = {title, description: description ?? ""};
  const media = imageFields(key) ?? {};
  for (const field of config.publicDataKeys ?? []) {
    if (field in media || /(?:ids?|url|links|consent|number)$/i.test(field)) continue;
    const value = data[field];
    const text = Array.isArray(value) ? value.filter(v => typeof v === "string").join("\n") : typeof value === "string" ? value : key === "jobs" && typeof value === "number" ? String(value) : "";
    if (text) fields[field] = field.endsWith("Html") ? sanitizeHtml(text, {allowedTags: [], allowedAttributes: {}}) : text;
  }
  const attachments = Object.keys(media).flatMap(field => {
    const value = data[field];
    const urls = Array.isArray(value) ? value : [value];
    return urls.filter((url): url is string => typeof url === "string" && Boolean(url)).map(url => ({field, url}));
  });
  await moderatePublicContent(context, fields, attachments);
}

export async function moderatePublicContent(context: string, fields: Record<string, string>, attachments: {field: string; url: string}[] = []) {
  rejectIssues(Object.entries(fields).flatMap(([field, value]) => blockedListingWords(field, value)));
  rejectIssues(await contentModerationProvider.check({context, fields}));
  const flagged: ListingIssue[] = [];
  // Review small groups so a large gallery cannot buffer all videos at once.
  for (let offset = 0; offset < attachments.length; offset += 2) {
    const issues = await Promise.all(attachments.slice(offset, offset + 2).map(async ({field, url}): Promise<ListingIssue[]> => {
      const name = uploadedImageName(url);
      const unreadable: ListingIssue = {field, mediaUrl: url, reason: "unreadable"};
      if (!name) return [unreadable];
      const path = join(uploadDirectory, name);
      const video = name.endsWith(".mp4");
      let bytes: Buffer;
      try {
        const source = await readFile(path);
        bytes = video ? source : await sharp(source).resize({width: 1280, height: 1280, fit: "inside", withoutEnlargement: true}).webp().toBuffer();
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [unreadable];
        throw unavailable();
      }
      try {
        const flags = await contentModerationProvider.check({context, fields, attachment: {mimeType: video ? "video/mp4" : "image/webp", data: bytes.toString("base64")}});
        return flags.map(({reason}) => ({field, reason, mediaUrl: url}));
      } catch (error) {
        if (error instanceof ApiError && error.code === "CONTENT_SAFETY_BLOCK") return [{field, reason: "unsafe", mediaUrl: url}];
        throw error;
      }
    }));
    flagged.push(...issues.flat());
  }
  rejectIssues(flagged);
}

