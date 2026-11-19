import type { RequestHandler } from "express";
import { z } from "zod";

import { sendSuccess } from "../helpers/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { billingConfiguration } from "./config.js";
import { verifyWebhookSignature } from "./razorpay.js";
import { billingService } from "./service.js";
import { sha256 } from "./utils.js";

const paymentEntitySchema = z
  .object({
    id: z.string().min(1),
    order_id: z.string().min(1),
    error_code: z.string().nullable().optional(),
    error_description: z.string().nullable().optional(),
  })
  .passthrough();

const refundEntitySchema = z
  .object({
    id: z.string().min(1),
    payment_id: z.string().min(1),
    amount: z.number().int().positive(),
  })
  .passthrough();

const webhookSchema = z
  .object({
    event: z.string().min(1),
    payload: z.record(z.unknown()),
  })
  .passthrough();

function nestedEntity(
  payload: Record<string, unknown>,
  key: "payment" | "refund",
) {
  const container = payload[key];
  if (!container || typeof container !== "object" || Array.isArray(container))
    return null;
  return (container as Record<string, unknown>).entity;
}

export const razorpayWebhookHandler: RequestHandler = asyncHandler(
  async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (!billingConfiguration.webhookSecret) {
      throw new ApiError(
        503,
        "WEBHOOK_UNAVAILABLE",
        "The Razorpay webhook is not configured.",
      );
    }
    if (!Buffer.isBuffer(request.body)) {
      throw new ApiError(
        400,
        "RAW_BODY_REQUIRED",
        "A raw webhook body is required.",
      );
    }
    const signature = request.header("x-razorpay-signature");
    if (
      !signature ||
      !verifyWebhookSignature({
        secret: billingConfiguration.webhookSecret,
        rawBody: request.body,
        signature,
      })
    ) {
      throw new ApiError(
        400,
        "INVALID_WEBHOOK_SIGNATURE",
        "The webhook signature is invalid.",
      );
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(request.body.toString("utf8"));
    } catch {
      throw new ApiError(
        400,
        "INVALID_WEBHOOK_JSON",
        "The webhook body is not valid JSON.",
      );
    }
    const parsed = webhookSchema.safeParse(decoded);
    if (!parsed.success) {
      throw new ApiError(
        400,
        "INVALID_WEBHOOK_EVENT",
        "The webhook event is invalid.",
      );
    }

    const payloadHash = sha256(request.body);
    const headerEventId = request.header("x-razorpay-event-id")?.trim();
    const accountScope = sha256(
      billingConfiguration.keyId ?? "unconfigured",
    ).slice(0, 12);
    const providerEventId = `webhook:${accountScope}:${headerEventId || payloadHash}`;
    if (await billingService.isProviderEventProcessed(providerEventId)) {
      sendSuccess(response, { received: true, duplicate: true });
      return;
    }
    const event = {
      providerEventId,
      eventType: parsed.data.event,
      payloadHash,
      metadata: { source: "razorpay_webhook" },
    } as const;

    if (parsed.data.event === "payment.captured") {
      const payment = paymentEntitySchema.safeParse(
        nestedEntity(parsed.data.payload, "payment"),
      );
      if (!payment.success) {
        throw new ApiError(
          400,
          "INVALID_WEBHOOK_EVENT",
          "Captured payment data is invalid.",
        );
      }
      const found = await billingService.processCapturedWebhook({
        providerOrderId: payment.data.order_id,
        providerPaymentId: payment.data.id,
        event,
      });
      sendSuccess(response, { received: true, ignored: !found });
      return;
    }

    if (parsed.data.event === "payment.failed") {
      const payment = paymentEntitySchema.safeParse(
        nestedEntity(parsed.data.payload, "payment"),
      );
      if (!payment.success) {
        throw new ApiError(
          400,
          "INVALID_WEBHOOK_EVENT",
          "Failed payment data is invalid.",
        );
      }
      const found = await billingService.processFailedWebhook({
        providerOrderId: payment.data.order_id,
        providerPaymentId: payment.data.id,
        errorCode: payment.data.error_code ?? undefined,
        errorDescription: payment.data.error_description ?? undefined,
        event,
      });
      sendSuccess(response, { received: true, ignored: !found });
      return;
    }

    if (parsed.data.event === "refund.processed") {
      const refund = refundEntitySchema.safeParse(
        nestedEntity(parsed.data.payload, "refund"),
      );
      if (!refund.success) {
        throw new ApiError(
          400,
          "INVALID_WEBHOOK_EVENT",
          "Refund data is invalid.",
        );
      }
      const result = await billingService.processRefundWebhook({
        providerPaymentId: refund.data.payment_id,
        refundId: refund.data.id,
        refundAmount: refund.data.amount,
        event,
      });
      sendSuccess(response, {
        received: true,
        ignored: !result.found,
        fullyRefunded: result.fullyRefunded,
        ...(result.duplicate ? { duplicate: true } : {}),
      });
      return;
    }

    sendSuccess(response, { received: true, ignored: true });
  },
);
