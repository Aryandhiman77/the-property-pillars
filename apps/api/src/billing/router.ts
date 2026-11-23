import { Router, type Request } from "express";
import type { z } from "zod";

import { sendSuccess } from "../helpers/api-response.js";
import { requireSession } from "../middleware/session.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { streamInvoicePdf } from "./invoice-pdf.js";
import {
  createCheckoutSchema,
  idempotencyKeySchema,
  invoiceListQuerySchema,
  orderListQuerySchema,
  verifyCheckoutSchema,
} from "./schemas.js";
import { billingService } from "./service.js";

function sessionOrThrow(request: Request) {
  if (!request.session) {
    throw new ApiError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Please sign in to continue.",
    );
  }
  return request.session;
}

function pathParam(
  value: string | string[] | undefined,
  label: string,
): string {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized)
    throw new ApiError(400, "INVALID_PATH_PARAMETER", `${label} is required.`);
  return normalized;
}

function parseQuery<S extends z.ZodTypeAny>(
  schema: S,
  value: unknown,
): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "One or more query fields are invalid.",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  return result.data as z.output<S>;
}

import {planAdminRouter} from "./plan-router.js";

export const billingRouter: Router = Router();

billingRouter.use("/admin/listing-plans", planAdminRouter);

billingRouter.get(
  "/catalog/plans",
  requireSession,
  asyncHandler(async (request, response) => {
    const session = sessionOrThrow(request);
    sendSuccess(response, await billingService.catalogForRole(session));
  }),
);

billingRouter.get("/catalog/plans/:id", requireSession, asyncHandler(async (request, response) => {
  sendSuccess(response, await billingService.managedPlan(sessionOrThrow(request), pathParam(request.params.id, "Plan id")));
}));

billingRouter.get("/feature-payments/:id", requireSession, asyncHandler(async (request, response) => {
  sendSuccess(response, await billingService.featurePayment(sessionOrThrow(request), pathParam(request.params.id, "Listing id")));
}));

billingRouter.post(
  "/checkouts",
  requireSession,
  validateBody(createCheckoutSchema),
  asyncHandler(async (request, response) => {
    const idempotency = idempotencyKeySchema.safeParse(
      request.header("idempotency-key"),
    );
    if (!idempotency.success) {
      throw new ApiError(
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "A valid Idempotency-Key header is required.",
      );
    }
    const result = await billingService.createCheckout(
      sessionOrThrow(request),
      request.body,
      idempotency.data,
    );
    sendSuccess(response, result, 201);
  }),
);

billingRouter.get(
  "/orders",
  requireSession,
  asyncHandler(async (request, response) => {
    const query = parseQuery(orderListQuerySchema, request.query);
    sendSuccess(
      response,
      await billingService.listOrders(sessionOrThrow(request), query),
    );
  }),
);

billingRouter.get(
  "/orders/:id",
  requireSession,
  asyncHandler(async (request, response) => {
    sendSuccess(
      response,
      await billingService.getOrder(
        sessionOrThrow(request),
        pathParam(request.params.id, "Order id"),
      ),
    );
  }),
);

billingRouter.post(
  "/orders/:id/reconcile",
  requireSession,
  asyncHandler(async (request, response) => {
    sendSuccess(
      response,
      await billingService.reconcileOrder(
        sessionOrThrow(request),
        pathParam(request.params.id, "Order id"),
      ),
    );
  }),
);

billingRouter.post(
  "/orders/:id/verify",
  requireSession,
  validateBody(verifyCheckoutSchema),
  asyncHandler(async (request, response) => {
    sendSuccess(
      response,
      await billingService.verifyCheckout(
        sessionOrThrow(request),
        pathParam(request.params.id, "Order id"),
        request.body,
      ),
    );
  }),
);

billingRouter.get(
  "/invoices",
  requireSession,
  asyncHandler(async (request, response) => {
    const query = parseQuery(invoiceListQuerySchema, request.query);
    sendSuccess(
      response,
      await billingService.listInvoices(sessionOrThrow(request), query),
    );
  }),
);

billingRouter.get(
  "/invoices/:id/download",
  requireSession,
  asyncHandler(async (request, response) => {
    const invoice = await billingService.getInvoiceForDownload(
      sessionOrThrow(request),
      pathParam(request.params.id, "Invoice id"),
    );
    await streamInvoicePdf(response, invoice);
  }),
);
