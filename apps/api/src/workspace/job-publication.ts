import {createHash} from "node:crypto";
import type {WorkspaceItem} from "@prisma/client";
import {z} from "zod";
import {ApiError} from "../utils/api-error.js";
import {logger} from "../utils/logger.js";
import {workspacePrisma} from "./db.js";
import {moderateListing} from "./listing-moderation.js";
import {ModerationUnavailable} from "./moderation-provider.js";
import type {WorkspaceSession} from "./types.js";

export const manualJobReview = z.object({attemptId: z.string().cuid(), confirmed: z.literal(true)}).strict();
const outcomeSchema = z.object({revision: z.string(), digest: z.string(), reason: z.string()});
const changed = () => new ApiError(409, "JOB_REVIEW_STALE", "The job or its review has changed. Check the current content again before publishing.");

export async function reviewJobPublication(session: WorkspaceSession, item: WorkspaceItem, title: string,
  description: string | null, data: Record<string, unknown>, manual?: z.infer<typeof manualJobReview>) {
  if (session.role !== "ADMIN" || item.collection !== "JOBS" || item.tenantId !== session.tenantId) {
    throw new ApiError(403, "FORBIDDEN", "Only a account administrator can publish this job.");
  }
  const scope = {tenantId: session.tenantId, itemId: item.id};
  const digest = createHash("sha256").update(JSON.stringify([title, description, Object.entries(data).sort(([a],[b]) => a.localeCompare(b))])).digest("hex");
  if (manual) {
    const event = await workspacePrisma.workspaceEvent.findFirst({where: {...scope, id: manual.attemptId,
      actorId: session.userId, action: "JOB_MODERATION_UNAVAILABLE"}});
    const details = outcomeSchema.safeParse(event?.metadata);
    if (!details.success || details.data.revision !== item.updatedAt.toISOString() || details.data.digest !== digest) throw changed();
    return {state: "MANUALLY_APPROVED", originalState: "PROVIDER_UNAVAILABLE", reason: details.data.reason,
      confirmed: true, attemptId: manual.attemptId, digest};
  }
  try {
    await moderateListing("jobs", "PUBLISHED", title, description, data);
    return {state: "PASSED", digest};
  } catch (error) {
    const unavailable = error instanceof ModerationUnavailable;
    if (!unavailable && !(error instanceof ApiError && ["LISTING_CONTENT_REJECTED", "CONTENT_SAFETY_BLOCK"].includes(error.code))) throw error;
    const reason = unavailable ? error.reason : error.code;
    const state = unavailable ? "PROVIDER_UNAVAILABLE" : "FLAGGED";
    const outcome = await workspacePrisma.$transaction(async tx => {
      // Invalidate outstanding confirmations even if a retry checks the same revision.
      const revision = new Date(Math.max(Date.now(), item.updatedAt.getTime() + 1));
      const updated = await tx.workspaceItem.updateMany({where: {id: item.id, tenantId: session.tenantId,
        status: item.status, updatedAt: item.updatedAt}, data: {updatedAt: revision}});
      if (!updated.count) throw changed();
      const priorFlag = unavailable && await tx.workspaceEvent.findFirst({where: {...scope, action: "JOB_MODERATION_FLAGGED",
        metadata: {path: ["digest"], equals: digest}}, select: {id: true}});
      const event = await tx.workspaceEvent.create({data: {...scope, actorId: session.userId,
        fromStatus: item.status, toStatus: item.status,
        action: unavailable && !priorFlag ? "JOB_MODERATION_UNAVAILABLE" : unavailable ? "JOB_CHECK_FAILED_AFTER_FLAG" : "JOB_MODERATION_FLAGGED",
        metadata: {state, reason, digest, revision: revision.toISOString(), reviewNote: unavailable
          ? "Automated content check unavailable (" + reason + ")." : error.message}}});
      return {id: event.id, priorFlag};
    });
    if (!unavailable) throw error;
    logger.warn("Job moderation provider unavailable", {...scope, reason});
    if (outcome.priorFlag) throw new ApiError(422, "JOB_PREVIOUSLY_FLAGGED", "This content was previously flagged. Correct the job before publishing.");
    throw new ApiError(503, "JOB_MANUAL_REVIEW_REQUIRED",
      "Automated content check is temporarily unavailable. Review the content manually before publishing.",
      {state: "MANUAL_REVIEW_REQUIRED", reason, attemptId: outcome.id, fieldErrors: {}});
  }
}
