import {env} from "../config/env.js";
import {leadVisitorLabels, type LeadVisitorType} from "@the-property-pillar/contracts";
import {configuredSmtp} from "../services/registration-email.service.js";
import {logger} from "../utils/logger.js";
import {workspacePrisma} from "./db.js";

const retryMinutes = [1, 5, 30, 120, 720];

export async function deliverPropertyEnquiryEmails() {
  const smtp = configuredSmtp();
  if (!smtp) return;
  const origin = new URL(env.NEXT_PUBLIC_SITE_URL ?? env.allowedOrigins[0] ?? "http://localhost:3000");
  const jobs = await workspacePrisma.$queryRaw<{enquiryId: string; attempts: number; locale: string}[]>`
    UPDATE "PropertyEnquiryEmail" AS job
    SET "nextAttempt" = (now() AT TIME ZONE 'UTC') + interval '5 minutes', attempts = attempts + 1
    WHERE job."enquiryId" IN (
      SELECT "enquiryId" FROM "PropertyEnquiryEmail"
      WHERE "sentAt" IS NULL AND "failedAt" IS NULL AND "nextAttempt" <= (now() AT TIME ZONE 'UTC')
      ORDER BY "nextAttempt" LIMIT 8 FOR UPDATE SKIP LOCKED
    )
    RETURNING job."enquiryId", job.attempts, job.locale
  `;
  await Promise.all(jobs.map(async ({enquiryId, attempts, locale}) => {
    const where = {enquiryId, attempts, sentAt: null, failedAt: null};
    try {
      const enquiry = await workspacePrisma.workspaceItem.findUnique({where: {id: enquiryId},
        select: {collection: true, title: true, status: true, data: true, targetUser: {select: {email: true, status: true}}}});
      if (!enquiry || ["SPAM", "ARCHIVED"].includes(enquiry.status)) {
        await workspacePrisma.propertyEnquiryEmail.updateMany({where, data: {failedAt: new Date()}});
        return;
      }
      if (!enquiry.targetUser?.email || enquiry.targetUser.status !== "ACTIVE") throw new Error("Recipient unavailable");
      const {fullName, phone, isDealer, visitorType, projectId, message} = enquiry.data as {fullName?: string; phone?: string; isDealer?: boolean; visitorType?: LeadVisitorType; projectId?: string; message?: string};
      const visitor = (visitorType && leadVisitorLabels[visitorType]) || (isDealer ? leadVisitorLabels.DEALER : "Unspecified");
      const lead = new URL(`/${locale}/dashboard`, origin);
      const service = enquiry.collection === "SERVICE_INQUIRIES";
      const photos = service && (message === "Please share portfolio photos." || message === "Please share product photos.");
      lead.searchParams.set("view", service ? "serviceInquiries" : "propertyInquiries");
      lead.searchParams.set("lead", enquiryId);
      await smtp.transport.sendMail({
        from: smtp.from, to: enquiry.targetUser.email, messageId: `<property-enquiry-${enquiryId}@${origin.hostname}>`,
        subject: photos ? "New photo request" : service ? "New professional enquiry" : projectId ? "New project enquiry" : "New property enquiry",
        text: `You received an enquiry about ${enquiry.title}.\n\nName: ${fullName ?? "Not provided"}\nCallback number: ${phone ?? "Not provided"}\nVisitor: ${visitor}${message ? "\nMessage: " + message : ""}\n\nOpen this lead in your workspace: ${lead.href}`,
      });
      await workspacePrisma.propertyEnquiryEmail.updateMany({where, data: {sentAt: new Date()}});
    } catch {
      const retry = retryMinutes[attempts - 1];
      await workspacePrisma.propertyEnquiryEmail.updateMany({where,
        data: retry ? {nextAttempt: new Date(Date.now() + retry * 60_000)} : {failedAt: new Date()}});
      logger.warn("Property enquiry email could not be delivered", {enquiryId, attempts, willRetry: Boolean(retry)});
    }
  }));
}
