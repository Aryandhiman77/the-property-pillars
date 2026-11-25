import {requireConfirmedListingRole} from "../workspace/role-reviews.js";
import { randomUUID } from "node:crypto";

import {
  BillingOrderStatus,
  EntitlementStatus,
  EntitlementType,
  Prisma,
  WorkspaceCollection,
  type BillingOrder,
} from "@prisma/client";
import { canPayToFeature, listingFeaturePriceId, paidFeatureCollections } from "@the-property-pillar/contracts";

import {catalogPlan, postingBalance} from "./listing-plans.js";
import { prisma } from "../database/prisma.js";
import { collectionConfigs } from "../workspace/config.js";
import { jobAcceptsApplications } from "../workspace/validation.js";
import type { AuthSessionContext } from "../types/auth.js";
import { ApiError } from "../utils/api-error.js";
import {
  billingConfiguration,
  calculatePlanAmounts,
  findConfiguredPlan,
  type ConfiguredPlan,
} from "./config.js";
import {
  RazorpayClient,
  type RazorpayOrder,
  type RazorpayPayment,
  type RazorpayProvider,
} from "./razorpay.js";
import { gstStateNames } from "./gst-states.js";
import type {
  BillingAddressInput,
  CreateCheckoutInput,
  VerifyCheckoutInput,
} from "./schemas.js";
import {
  addUtcDays,
  compactFinancialYear,
  financialYearFor,
  sha256,
  splitIndianGst,
  stableJson,
} from "./utils.js";

const orderRelations = {
  invoice: true,
  entitlement: true,
} satisfies Prisma.BillingOrderInclude;

type OrderWithRelations = Prisma.BillingOrderGetPayload<{
  include: typeof orderRelations;
}>;

type BillingEventInput = {
  providerEventId: string;
  eventType: string;
  payloadHash: string;
  metadata?: Prisma.InputJsonObject;
};

type CaptureInput = {
  localOrderId: string;
  providerPayment: RazorpayPayment;
  event: BillingEventInput;
};

const provider: RazorpayProvider | null =
  billingConfiguration.keyId && billingConfiguration.keySecret
    ? new RazorpayClient(
        billingConfiguration.keyId,
        billingConfiguration.keySecret,
      )
    : null;

function providerOrThrow(requireOpenCheckout = false): RazorpayProvider {
  if (
    !provider ||
    (requireOpenCheckout && !billingConfiguration.checkoutAvailable)
  ) {
    throw new ApiError(
      503,
      "CHECKOUT_UNAVAILABLE",
      "Online checkout is not configured for this environment.",
    );
  }
  return provider;
}

function jsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function planDto(plan: ConfiguredPlan) {
  return {
    priceId: plan.priceId,
    name: plan.name,
    description: plan.description,
    ...calculatePlanAmounts(plan),
    currency: plan.currency,
    entitlementDays: plan.entitlementDays,
    postingCredits: plan.postingCredits ?? 0,
    purpose: plan.purpose, aboutHtml: plan.aboutHtml, highlights: plan.highlights,
    requiresTarget: plan.targetKind !== null,
    targetKind: plan.targetKind,
  };
}

function invoiceSummary(invoice: OrderWithRelations["invoice"]) {
  if (!invoice) return null;
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.issuedAt.toISOString(),
    currency: invoice.currency,
    totalPaise: invoice.totalPaise,
    downloadUrl: `/api/v1/invoices/${invoice.id}/download`,
  };
}

function entitlementSummary(entitlement: OrderWithRelations["entitlement"]) {
  if (!entitlement) return null;
  return {
    id: entitlement.id,
    type: entitlement.type,
    status: entitlement.status,
    targetId: entitlement.targetId,
    startsAt: entitlement.startsAt.toISOString(),
    endsAt: entitlement.endsAt.toISOString(),
    revokedAt: entitlement.revokedAt?.toISOString() ?? null,
  };
}

export function orderSummary(order: OrderWithRelations) {
  return {
    id: order.id,
    status: order.status,
    priceId: order.priceId,
    planName: order.planName,
    targetId: order.targetId,
    currency: order.currency,
    basePaise: order.basePaise,
    taxPaise: order.taxPaise,
    totalPaise: order.totalPaise,
    providerOrderId: order.providerOrderId,
    providerPaymentId: order.providerPaymentId,
    createdAt: order.createdAt.toISOString(),
    capturedAt: order.capturedAt?.toISOString() ?? null,
    refundedAt: order.refundedAt?.toISOString() ?? null,
    invoiceId: order.invoice?.id ?? null,
  };
}

function orderDetail(order: OrderWithRelations) {
  return {
    ...orderSummary(order),
    billing: jsonObject(order.billingSnapshot),
    invoice: invoiceSummary(order.invoice),
    entitlement: entitlementSummary(order.entitlement),
    failure:
      order.failureCode || order.failureDescription
        ? {
            code: order.failureCode,
            description: order.failureDescription,
          }
        : null,
  };
}

function checkoutFor(order: BillingOrder) {
  if (
    (order.status !== BillingOrderStatus.PAYMENT_PENDING && !(order.entitlementType === "LISTING_FEATURE" && order.status === BillingOrderStatus.FAILED)) ||
    !order.providerOrderId ||
    !billingConfiguration.keyId
  ) {
    return null;
  }
  return {
    keyId: billingConfiguration.keyId!,
    orderId: order.providerOrderId,
    amount: order.totalPaise,
    currency: order.currency,
  };
}

const listingCollections = paidFeatureCollections.map((key) => collectionConfigs[key].dbCollection as WorkspaceCollection);

async function featureListing(client: Prisma.TransactionClient, session: AuthSessionContext, targetId: string) {
  const item = await client.workspaceItem.findFirst({
    where: {id: targetId, tenantId: session.tenantId, collection: {in: listingCollections},
      ...(session.role === "ADMIN" ? {} : {ownerId: session.userId})},
    select: {status: true, collection: true, data: true},
  });
  if (!item) throw new ApiError(404, "ELIGIBLE_TARGET_NOT_FOUND", "Listing was not found.");
  const key = paidFeatureCollections.find((key) => collectionConfigs[key].dbCollection === item.collection)!;
  return {key, eligible: canPayToFeature(key, item.status) && (key !== "jobs" || jobAcceptsApplications(jsonObject(item.data)))};
}

function listingOrders(tenantId: string, targetId: string) {
  return {tenantId, targetId, entitlementType: EntitlementType.LISTING_FEATURE};
}

async function featurePayment(session: AuthSessionContext, targetId: string) {
  const {key, eligible} = await featureListing(prisma, session, targetId);
  const now = new Date();
  const current = await prisma.billingOrder.findFirst({where: {...listingOrders(session.tenantId, targetId), status: "CAPTURED", entitlement: {status: "ACTIVE", startsAt: {lte: now}, endsAt: {gt: now}, revokedAt: null}}, include: orderRelations});
  const order = current ?? await prisma.billingOrder.findFirst({
    where: listingOrders(session.tenantId, targetId), include: orderRelations,
    orderBy: [{createdAt: "desc"}, {id: "desc"}],
  });
  const managed = key === "properties" ? await prisma.listingPlan.findFirst({
    where: {tenantId: session.tenantId, purpose: "PROPERTY_FEATURE", audience: session.role === "BUILDER" ? "BUILDER" : "LISTER"},
    orderBy: [{active: "desc"}, {basePaise: "asc"}, {id: "asc"}],
  }) : null;
  const plan = managed ? (managed.active ? catalogPlan(managed) : undefined) : findConfiguredPlan(listingFeaturePriceId);
  const entitlement = order?.entitlement;
  const active = Boolean(entitlement && order?.status === "CAPTURED" && entitlement.status === "ACTIVE" && entitlement.startsAt <= now && entitlement.endsAt > now);
  const amount = order && (active || ["PAYMENT_PENDING","CREATING","FAILED"].includes(order.status))
    ? {basePaise: order.basePaise, taxPaise: order.taxPaise, totalPaise: order.totalPaise, currency: order.currency}
    : plan ? {...calculatePlanAmounts(plan), currency: plan.currency} : {};
  return {
    status: order?.status ?? "UNPAID",
    orderId: order?.id ?? null,
    invoice: invoiceSummary(order?.invoice ?? null),
    active, endsAt: entitlement?.endsAt, priceId: plan?.priceId,
    canPay: Boolean(plan) && eligible && session.role !== "ADMIN" && !active,
    checkoutAvailable: Boolean(plan && billingConfiguration.checkoutAvailable),
    ...amount,
  };
}

async function assertTargetEligibility(
  session: AuthSessionContext,
  plan: ConfiguredPlan,
  targetId: string | undefined,
): Promise<void> {
  if (!plan.allowedRoles.includes(session.role)) {
    throw new ApiError(
      403,
      "PLAN_NOT_AVAILABLE_FOR_ROLE",
      "This plan is not available for your active role.",
    );
  }

  if (plan.targetKind === null) {
    if (targetId) {
      throw new ApiError(
        400,
        "TARGET_NOT_ALLOWED",
        "This plan does not accept a targetId.",
      );
    }
    if (plan.entitlementType !== "DEALER_PRO") return;
    const dealerProfile = await prisma.workspaceItem.findFirst({
      where: {
        tenantId: session.tenantId,
        ownerId: session.userId,
        collection: WorkspaceCollection.DEALER_PROFILES,
        status: "VERIFIED",
      },
      select: { id: true },
    });
    if (!dealerProfile) {
      throw new ApiError(
        409,
        "VERIFIED_DEALER_PROFILE_REQUIRED",
        "A verified dealer profile is required before purchasing this plan.",
      );
    }
    return;
  }

  if (!targetId) {
    throw new ApiError(
      400,
      "TARGET_REQUIRED",
      `A ${plan.targetKind.toLowerCase()} targetId is required for this plan.`,
    );
  }

  if (plan.targetKind === "LISTING") return;

  const target = await prisma.workspaceItem.findFirst({
    where:
      plan.targetKind === "JOB"
        ? {
            id: targetId,
            tenantId: session.tenantId,
            ownerId: session.userId,
            collection: WorkspaceCollection.JOBS,
            status: "PUBLISHED",
          }
        : {
            id: targetId,
            tenantId: session.tenantId,
            ownerId: session.userId,
            collection: WorkspaceCollection.AD_CAMPAIGNS,
            status: {
              in: [
                "DRAFT",
                "PENDING_REVIEW",
                "CHANGES_REQUESTED",
                "APPROVED",
                "ACTIVE",
                "PAUSED",
              ],
            },
          },
    select: { id: true },
  });
  if (!target) {
    throw new ApiError(
      404,
      "ELIGIBLE_TARGET_NOT_FOUND",
      `The owned eligible ${plan.targetKind.toLowerCase()} was not found.`,
    );
  }
}

function stateName(stateCode: string): string | undefined {
  return gstStateNames[stateCode];
}

function customerSnapshot(
  billing: BillingAddressInput,
): Prisma.InputJsonObject {
  return {
    ...billing,
    ...(stateName(billing.stateCode)
      ? { stateName: stateName(billing.stateCode) }
      : {}),
  };
}

function supplierSnapshot(plan: ConfiguredPlan): Prisma.InputJsonObject {
  const supplier = billingConfiguration.supplier;
  if (!supplier)
    throw new ApiError(
      503,
      "CHECKOUT_UNAVAILABLE",
      "Billing supplier details are not configured.",
    );
  return {
    ...supplier,
    ...(stateName(supplier.stateCode)
      ? { stateName: stateName(supplier.stateCode) }
      : {}),
    serviceCode: plan.serviceCode,
    taxRateBps: plan.taxRateBps,
    testMode: billingConfiguration.keyId?.startsWith("rzp_test_") ?? false,
  };
}

function requestHash(input: CreateCheckoutInput): string {
  return sha256(stableJson(input));
}

function assertProviderOrder(
  order: BillingOrder,
  remoteOrder: {
    amount: number;
    currency: string;
    receipt?: string | null;
  },
): void {
  if (
    remoteOrder.amount !== order.totalPaise ||
    remoteOrder.currency.toUpperCase() !== order.currency ||
    remoteOrder.receipt !== order.receipt
  ) {
    throw new ApiError(
      502,
      "PAYMENT_PROVIDER_MISMATCH",
      "The provider order did not match the requested checkout.",
    );
  }
}

async function attachProviderOrder(order: BillingOrder, remoteOrder: RazorpayOrder) {
  assertProviderOrder(order, remoteOrder);
  await prisma.billingOrder.updateMany({
    where: {id: order.id, status: BillingOrderStatus.CREATING, providerOrderId: null},
    data: {status: BillingOrderStatus.PAYMENT_PENDING, providerOrderId: remoteOrder.id, failureCode: null, failureDescription: null},
  });
  const updated = await getOrderWithRelations(order.id);
  if (updated.providerOrderId !== remoteOrder.id) throw new ApiError(409, "PAYMENT_ORDER_MISMATCH", "The Razorpay order does not match.");
  return updated;
}

async function reconcileCreatingOrder(
  order: BillingOrder,
  configuredProvider: RazorpayProvider,
): Promise<BillingOrder> {
  if (order.status !== BillingOrderStatus.CREATING) return order;
  const remoteOrder = await configuredProvider.findOrderByReceipt(
    order.receipt,
    order.createdAt,
  );
  if (!remoteOrder) return order;
  return attachProviderOrder(order, remoteOrder);
}

async function getOrderWithRelations(id: string): Promise<OrderWithRelations> {
  const order = await prisma.billingOrder.findUnique({
    where: { id },
    include: orderRelations,
  });
  if (!order)
    throw new ApiError(404, "ORDER_NOT_FOUND", "Billing order was not found.");
  return order;
}

async function existingCheckout(order: OrderWithRelations) {
  if (order.status === BillingOrderStatus.CREATING && provider) {
    try {
      order = await getOrderWithRelations((await reconcileCreatingOrder(order, provider)).id);
    } catch {
      // Keep the original order available for reconciliation.
    }
  }
  return {order: orderSummary(order), checkout: checkoutFor(order)};
}

async function createCheckout(
  session: AuthSessionContext,
  input: CreateCheckoutInput,
  idempotencyKey: string,
) {
  const hash = requestHash(input);
  const existing = await prisma.billingOrder.findUnique({
    where: {
      tenantId_userId_idempotencyKey: {
        tenantId: session.tenantId,
        userId: session.userId,
        idempotencyKey,
      },
    },
    include: orderRelations,
  });
  if (existing) {
    if (existing.requestHash !== hash) {
      throw new ApiError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "This Idempotency-Key was already used with a different checkout request.",
      );
    }
    return existingCheckout(existing);
  }

  const configuredProvider = providerOrThrow(true);
  const managed = await prisma.listingPlan.findFirst({where: {tenantId: session.tenantId, id: input.priceId, active: true}});
  const plan = managed ? catalogPlan(managed) : findConfiguredPlan(input.priceId);
  if (!plan) {
    throw new ApiError(
      404,
      "PLAN_NOT_FOUND",
      "The selected billing plan is not available.",
    );
  }
  if (managed) await requireConfirmedListingRole(session.tenantId,session.userId);
  await assertTargetEligibility(session, plan, input.targetId);

  const amounts = calculatePlanAmounts(plan);
  const receipt = `tpp_${randomUUID().replaceAll("-", "").slice(0, 28)}`;
  let localOrder: BillingOrder;
  try {
    const data = {
        tenantId: session.tenantId,
        userId: session.userId,
        priceId: plan.priceId,
        planName: plan.name,
        entitlementType: plan.entitlementType,
        postingCredits: plan.postingCredits ?? 0,
        entitlementDays: plan.entitlementDays,
        targetId: input.targetId,
        idempotencyKey,
        requestHash: hash,
        receipt,
        currency: plan.currency,
        ...amounts,
        taxRateBps: plan.taxRateBps,
        billingSnapshot: customerSnapshot(input.billing),
        supplierSnapshot: supplierSnapshot(plan),
        termsAcceptedAt: new Date(),
    };
    if (plan.targetKind === "LISTING" && input.targetId) {
      const targetId = input.targetId;
      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "WorkspaceItem" WHERE "id" = ${targetId} AND "tenantId" = ${session.tenantId} AND "ownerId" = ${session.userId} FOR NO KEY UPDATE`;
        if (plan.purpose === "PROPERTY_FEATURE" && !await tx.workspaceItem.findFirst({where: {id: targetId, tenantId: session.tenantId, ownerId: session.userId, collection: "PROPERTIES"}})) throw new ApiError(422, "ELIGIBLE_TARGET_NOT_FOUND", "Choose one of your properties.");
        const target = await featureListing(tx, session, targetId);
        if (target.key === "properties" && plan.priceId === listingFeaturePriceId && await tx.listingPlan.count({where: {
          tenantId: session.tenantId, purpose: "PROPERTY_FEATURE", audience: session.role === "BUILDER" ? "BUILDER" : "LISTER",
        }})) throw new ApiError(409, "PROPERTY_FEATURE_PLAN_REQUIRED", "Select a property featuring plan for this listing.");
        if (!target.eligible) throw new ApiError(409, "ELIGIBLE_TARGET_NOT_FOUND", "Only an eligible submitted listing can be featured. Submit the listing or check its status before paying.");
        const existing = await tx.billingOrder.findFirst({
          where: {...listingOrders(session.tenantId, targetId), userId: session.userId, OR: [{priceId: plan.priceId, status: {in: ["CREATING","PAYMENT_PENDING","FAILED"]}}, {status: "CAPTURED", entitlement: {status: "ACTIVE", endsAt: {gt: new Date()}}}]},
          include: orderRelations,
        });
        if (existing) return {existing};
        return {created: await tx.billingOrder.create({data})};
      });
      if (result.existing) return existingCheckout(result.existing);
      localOrder = result.created;
    } else {
      localOrder = await prisma.billingOrder.create({data});
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await prisma.billingOrder.findUnique({
        where: {
          tenantId_userId_idempotencyKey: {
            tenantId: session.tenantId,
            userId: session.userId,
            idempotencyKey,
          },
        },
        include: orderRelations,
      });
      if (raced) {
        if (raced.requestHash !== hash) {
          throw new ApiError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "This Idempotency-Key was already used with a different checkout request.",
          );
        }
        return { order: orderSummary(raced), checkout: checkoutFor(raced) };
      }
    }
    throw error;
  }

  try {
    const remoteOrder = await configuredProvider.createOrder({
      amount: localOrder.totalPaise,
      currency: "INR",
      receipt: localOrder.receipt,
      notes: {
        localOrderId: localOrder.id,
        priceId: localOrder.priceId,
      },
    });
    localOrder = await attachProviderOrder(localOrder, remoteOrder);
  } catch (error) {
    // A timeout can occur after Razorpay created the order. Reconcile by the
    // immutable receipt and never issue a second remote order for this key.
    try {
      localOrder = await reconcileCreatingOrder(localOrder, configuredProvider);
      if (localOrder.status !== BillingOrderStatus.CREATING) {
        const recovered = await getOrderWithRelations(localOrder.id);
        return {
          order: orderSummary(recovered),
          checkout: checkoutFor(recovered),
        };
      }
    } catch {
      // Preserve CREATING: a retry with the same key performs reconciliation only.
    }
    await prisma.billingOrder.updateMany({
      where: { id: localOrder.id, status: BillingOrderStatus.CREATING },
      data: {
        failureCode: "PROVIDER_RESULT_UNKNOWN",
        failureDescription:
          "Provider order creation is awaiting reconciliation.",
      },
    });
    throw error;
  }

  const completed = await getOrderWithRelations(localOrder.id);
  return { order: orderSummary(completed), checkout: checkoutFor(completed) };
}

function assertCapturedPayment(
  order: BillingOrder,
  payment: RazorpayPayment,
): void {
  if (
    payment.id.length === 0 ||
    payment.order_id !== order.providerOrderId ||
    payment.amount !== order.totalPaise ||
    payment.currency.toUpperCase() !== order.currency ||
    payment.status !== "captured" ||
    payment.captured === false
  ) {
    throw new ApiError(
      409,
      "PAYMENT_VERIFICATION_FAILED",
      "The captured payment did not match this billing order.",
    );
  }
}

async function finalizeCapturedOrder(
  input: CaptureInput,
): Promise<OrderWithRelations> {
  await prisma.$transaction(async (transaction) => {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "BillingOrder"
        WHERE "id" = ${input.localOrderId}
        FOR UPDATE
      `;
    if (locked.length === 0) {
      throw new ApiError(
        404,
        "ORDER_NOT_FOUND",
        "Billing order was not found.",
      );
    }
    const alreadyProcessed = await transaction.billingEvent.findUnique({
      where: { providerEventId: input.event.providerEventId },
      select: { id: true },
    });
    if (alreadyProcessed) return;

    const order = await transaction.billingOrder.findUnique({
      where: { id: input.localOrderId },
      include: orderRelations,
    });
    if (!order)
      throw new ApiError(
        404,
        "ORDER_NOT_FOUND",
        "Billing order was not found.",
      );
    assertCapturedPayment(order, input.providerPayment);

    if (
      order.providerPaymentId &&
      order.providerPaymentId !== input.providerPayment.id
    ) {
      throw new ApiError(
        409,
        "ORDER_ALREADY_PAID",
        "This billing order is already linked to a different payment.",
      );
    }

    if (
      order.status !== BillingOrderStatus.CAPTURED &&
      order.status !== BillingOrderStatus.REFUNDED
    ) {
      const claimed = await transaction.billingOrder.updateMany({
        where: {
          id: order.id,
          status: {
            in: [BillingOrderStatus.PAYMENT_PENDING, BillingOrderStatus.FAILED],
          },
          providerPaymentId: null,
        },
        data: {
          status: BillingOrderStatus.CAPTURED,
          providerPaymentId: input.providerPayment.id,
          capturedAt: new Date(),
          failedAt: null,
          failureCode: null,
          failureDescription: null,
        },
      });
      if (claimed.count !== 1) {
        throw new ApiError(
          409,
          "ORDER_STATE_CONFLICT",
          "The billing order changed while payment was being verified.",
        );
      }
    }

    const capturedAt = order.capturedAt ?? new Date();
    if (!order.invoice) {
      const financialYear = financialYearFor(capturedAt);
      const sequence = await transaction.billingInvoiceSequence.upsert({
        where: { financialYear },
        create: { financialYear, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      if (sequence.lastNumber > 999_999) {
        throw new ApiError(
          503,
          "INVOICE_SEQUENCE_EXHAUSTED",
          "The current financial-year invoice series is exhausted.",
        );
      }
      const supplier = jsonObject(order.supplierSnapshot);
      const customer = jsonObject(order.billingSnapshot);
      const invoicePrefix = supplier.testMode === true ? "TST" : "TPP";
      const gst = splitIndianGst(
        order.taxPaise,
        String(supplier.stateCode ?? ""),
        String(customer.stateCode ?? ""),
      );
      await transaction.billingInvoice.create({
        data: {
          tenantId: order.tenantId,
          orderId: order.id,
          invoiceNumber: `${invoicePrefix}/${compactFinancialYear(financialYear)}/${String(sequence.lastNumber).padStart(6, "0")}`,
          financialYear,
          sequenceNumber: sequence.lastNumber,
          issuedAt: capturedAt,
          currency: order.currency,
          basePaise: order.basePaise,
          ...gst,
          taxPaise: order.taxPaise,
          totalPaise: order.totalPaise,
          supplierSnapshot: supplier as Prisma.InputJsonObject,
          customerSnapshot: customer as Prisma.InputJsonObject,
        },
      });
    }

    if (!order.entitlement) {
      await transaction.$queryRaw`SELECT id FROM "User" WHERE id = ${order.userId} FOR UPDATE`;
      const previous = await transaction.billingEntitlement.findFirst({
        where: {
          tenantId: order.tenantId,
          userId: order.userId,
          type: order.entitlementType,
          targetId: order.targetId,
          status: EntitlementStatus.ACTIVE,
          endsAt: { gt: capturedAt },
        },
        orderBy: { endsAt: "desc" },
        select: { endsAt: true },
      });
      const startsAt = order.entitlementType === "POSTING_CREDITS" ? capturedAt : previous?.endsAt ?? capturedAt;
      await transaction.billingEntitlement.create({
        data: {
          tenantId: order.tenantId,
          userId: order.userId,
          type: order.entitlementType,
          targetId: order.targetId,
          sourceOrderId: order.id,
          startsAt,
          endsAt: addUtcDays(startsAt, order.entitlementDays),
          ...(order.status === BillingOrderStatus.REFUNDED
            ? {
                status: EntitlementStatus.REVOKED,
                revokedAt: capturedAt,
              }
            : {}),
        },
      });
    }

    await transaction.billingEvent.create({
      data: {
        tenantId: order.tenantId,
        orderId: order.id,
        providerEventId: input.event.providerEventId,
        eventType: input.event.eventType,
        providerPaymentId: input.providerPayment.id,
        payloadHash: input.event.payloadHash,
        metadata: {
          ...(input.event.metadata ?? {}),
          paymentMethod: input.providerPayment.method ?? "unknown",
        },
      },
    });
  });

  return getOrderWithRelations(input.localOrderId);
}

async function verifyCheckout(
  session: AuthSessionContext,
  orderId: string,
  input: VerifyCheckoutInput,
) {
  const configuredProvider = providerOrThrow();
  const order = await prisma.billingOrder.findFirst({
    where: {
      id: orderId,
      tenantId: session.tenantId,
      userId: session.userId,
    },
  });
  if (!order)
    throw new ApiError(404, "ORDER_NOT_FOUND", "Billing order was not found.");
  if (
    !order.providerOrderId ||
    input.razorpay_order_id !== order.providerOrderId
  ) {
    throw new ApiError(
      409,
      "PAYMENT_ORDER_MISMATCH",
      "The Razorpay order does not match.",
    );
  }

  const { verifyCheckoutSignature } = await import("./razorpay.js");
  if (
    !billingConfiguration.keySecret ||
    !verifyCheckoutSignature({
      secret: billingConfiguration.keySecret,
      orderId: input.razorpay_order_id,
      paymentId: input.razorpay_payment_id,
      signature: input.razorpay_signature,
    })
  ) {
    throw new ApiError(
      400,
      "INVALID_PAYMENT_SIGNATURE",
      "The checkout signature is invalid.",
    );
  }

  const payment = await configuredProvider.getPayment(
    input.razorpay_payment_id,
  );
  const finalized = await finalizeCapturedOrder({
    localOrderId: order.id,
    providerPayment: payment,
    event: {
      providerEventId: `verify:${order.id}:${payment.id}`,
      eventType: "checkout.verified",
      payloadHash: sha256(
        stableJson({
          orderId: input.razorpay_order_id,
          paymentId: input.razorpay_payment_id,
        }),
      ),
      metadata: { source: "checkout_return" },
    },
  });
  return {
    order: orderSummary(finalized),
    invoice: invoiceSummary(finalized.invoice),
    entitlement: entitlementSummary(finalized.entitlement),
  };
}

async function isProviderEventProcessed(
  providerEventId: string,
): Promise<boolean> {
  return Boolean(
    await prisma.billingEvent.findUnique({
      where: { providerEventId },
      select: { id: true },
    }),
  );
}

async function processCapturedWebhook(input: {
  providerOrderId: string;
  providerPaymentId: string;
  event: BillingEventInput;
}): Promise<boolean> {
  const order = await prisma.billingOrder.findUnique({
    where: { providerOrderId: input.providerOrderId },
    select: { id: true },
  });
  if (!order) return false;

  const payment = await providerOrThrow().getPayment(input.providerPaymentId);
  const captureProof =
    payment.status === "refunded" && payment.amount_refunded > 0
      ? ({ ...payment, status: "captured", captured: true } as RazorpayPayment)
      : payment;
  await finalizeCapturedOrder({
    localOrderId: order.id,
    providerPayment: captureProof,
    event: input.event,
  });
  return true;
}

async function processFailedWebhook(input: {
  providerOrderId: string;
  providerPaymentId: string;
  errorCode?: string;
  errorDescription?: string;
  event: BillingEventInput;
}): Promise<boolean> {
  const order = await prisma.billingOrder.findUnique({
    where: { providerOrderId: input.providerOrderId },
  });
  if (!order) return false;

  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT "id" FROM "BillingOrder" WHERE "id" = ${order.id} FOR UPDATE
    `;
    if (
      await transaction.billingEvent.findFirst({
        where: {
          orderId: order.id,
          providerPaymentId: input.providerPaymentId,
          eventType: "payment.failed",
        },
        select: { id: true },
      })
    )
      return;

    await transaction.billingOrder.updateMany({
      where: { id: order.id, status: BillingOrderStatus.PAYMENT_PENDING },
      data: {
        status: BillingOrderStatus.FAILED,
        failedAt: new Date(),
        failureCode: input.errorCode?.slice(0, 120) ?? "PAYMENT_FAILED",
        failureDescription:
          input.errorDescription?.slice(0, 500) ??
          "The payment attempt failed.",
      },
    });
    await transaction.billingEvent.create({
      data: {
        tenantId: order.tenantId,
        orderId: order.id,
        providerEventId: input.event.providerEventId,
        eventType: input.event.eventType,
        providerPaymentId: input.providerPaymentId,
        payloadHash: input.event.payloadHash,
        metadata: input.event.metadata ?? {},
      },
    });
  });
  return true;
}

async function processRefundWebhook(input: {
  providerPaymentId: string;
  refundId: string;
  refundAmount: number;
  event: BillingEventInput;
}): Promise<{ found: boolean; fullyRefunded: boolean; duplicate?: boolean }> {
  const payment = await providerOrThrow().getPayment(input.providerPaymentId);
  return recordRefund(payment, input);
}

async function recordRefund(payment: RazorpayPayment, input: {
  providerPaymentId: string;
  refundId: string;
  refundAmount: number;
  event: BillingEventInput;
}): Promise<{ found: boolean; fullyRefunded: boolean; duplicate?: boolean }> {
  let order = await prisma.billingOrder.findUnique({
    where: { providerPaymentId: input.providerPaymentId },
  });
  if (!order && payment.order_id) {
    order = await prisma.billingOrder.findUnique({
      where: { providerOrderId: payment.order_id },
    });
  }
  if (!order) return { found: false, fullyRefunded: false };

  if (
    payment.id !== input.providerPaymentId ||
    payment.order_id !== order.providerOrderId ||
    (order.providerPaymentId !== null && order.providerPaymentId !== payment.id) ||
    payment.amount !== order.totalPaise ||
    payment.currency.toUpperCase() !== order.currency ||
    payment.amount_refunded < input.refundAmount
  ) {
    throw new ApiError(
      409,
      "REFUND_VERIFICATION_FAILED",
      "The refunded provider payment did not match this billing order.",
    );
  }
  const fullyRefunded = payment.amount_refunded >= order.totalPaise;

  if (
    order.status !== BillingOrderStatus.CAPTURED &&
    order.status !== BillingOrderStatus.REFUNDED
  ) {
    if (
      (payment.status !== "captured" && payment.status !== "refunded") ||
      payment.captured === false ||
      payment.amount_refunded <= 0
    ) {
      throw new ApiError(
        409,
        "REFUND_VERIFICATION_FAILED",
        "The provider payment does not prove a prior capture.",
      );
    }
    // Webhook delivery order is not guaranteed. Preserve the immutable paid
    // invoice first, then apply the refund and revoke its entitlement below.
    await finalizeCapturedOrder({
      localOrderId: order.id,
      providerPayment: {
        ...payment,
        status: "captured",
        captured: true,
      },
      event: {
        providerEventId: `${input.event.providerEventId}:capture-reconciled`,
        eventType: "payment.captured.reconciled",
        payloadHash: input.event.payloadHash,
        metadata: {
          source: "refund_before_capture",
          originalEventType: input.event.eventType,
        },
      },
    });
  }

  const duplicate = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT "id" FROM "BillingOrder"
      WHERE "id" = ${order.id}
      FOR UPDATE
    `;
    const existingRefund = await transaction.billingEvent.findFirst({
      where: {
        orderId: order.id,
        eventType: "refund.processed",
        metadata: { path: ["refundId"], equals: input.refundId },
      },
      select: { id: true },
    });

    if (fullyRefunded) {
      await transaction.billingOrder.updateMany({
        where: {
          id: order.id,
          status: BillingOrderStatus.CAPTURED,
        },
        data: {
          status: BillingOrderStatus.REFUNDED,
          providerPaymentId: input.providerPaymentId,
          refundedAt: new Date(),
        },
      });
      await transaction.billingEntitlement.updateMany({
        where: {
          sourceOrderId: order.id,
          status: EntitlementStatus.ACTIVE,
        },
        data: {
          status: EntitlementStatus.REVOKED,
          revokedAt: new Date(),
        },
      });
    }
    if (existingRefund) return true;

    await transaction.billingEvent.create({
      data: {
        tenantId: order.tenantId,
        orderId: order.id,
        providerEventId: input.event.providerEventId,
        eventType: input.event.eventType,
        providerPaymentId: input.providerPaymentId,
        payloadHash: input.event.payloadHash,
        metadata: {
          ...(input.event.metadata ?? {}),
          refundId: input.refundId,
          refundAmount: input.refundAmount,
          fullyRefunded,
        },
      },
    });
    return false;
  });
  return { found: true, fullyRefunded, duplicate };
}

function visibleOrderWhere(
  session: AuthSessionContext,
): Prisma.BillingOrderWhereInput {
  return {
    tenantId: session.tenantId,
    ...(session.role === "ADMIN" ? {} : { userId: session.userId }),
  };
}

type DecodedCursor = { at: Date; id: string };

function encodeCursor(at: Date, id: string): string {
  return Buffer.from(`${at.toISOString()}|${id}`).toString("base64url");
}

function decodeCursor(value: string | undefined): DecodedCursor | null {
  if (!value) return null;
  try {
    const [at, id, extra] = Buffer.from(value, "base64url")
      .toString("utf8")
      .split("|");
    const date = new Date(at ?? "");
    if (!id || extra !== undefined || Number.isNaN(date.getTime()))
      throw new Error();
    return { at: date, id };
  } catch {
    throw new ApiError(
      400,
      "INVALID_CURSOR",
      "The pagination cursor is invalid.",
    );
  }
}

function beforeCursor(
  cursor: DecodedCursor | null,
  dateField: "createdAt" | "issuedAt",
) {
  if (!cursor) return {};
  return {
    OR: [
      { [dateField]: { lt: cursor.at } },
      { [dateField]: cursor.at, id: { lt: cursor.id } },
    ],
  };
}

async function listOrders(
  session: AuthSessionContext,
  query: { status?: BillingOrderStatus; cursor?: string; limit: number },
) {
  const cursor = decodeCursor(query.cursor);
  const rows = await prisma.billingOrder.findMany({
    where: {
      ...visibleOrderWhere(session),
      ...(query.status ? { status: query.status } : {}),
      ...beforeCursor(cursor, "createdAt"),
    },
    include: orderRelations,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
  });
  const hasMore = rows.length > query.limit;
  const items = rows.slice(0, query.limit);
  const last = items.at(-1);
  return {
    items: items.map(orderSummary),
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
  };
}

async function getVisibleOrder(session: AuthSessionContext, orderId: string) {
  const order = await prisma.billingOrder.findFirst({
    where: { id: orderId, ...visibleOrderWhere(session) },
    include: orderRelations,
  });
  if (!order)
    throw new ApiError(404, "ORDER_NOT_FOUND", "Billing order was not found.");
  return order;
}

async function getOrder(session: AuthSessionContext, orderId: string) {
  const order = await getVisibleOrder(session, orderId);
  const events = await prisma.billingEvent.findMany({
    where: { tenantId: session.tenantId, orderId: order.id },
    orderBy: [{ processedAt: "desc" }, { id: "desc" }],
    take: 20,
    select: {
      eventType: true,
      providerPaymentId: true,
      metadata: true,
      processedAt: true,
    },
  });
  const safeEvents = events.map((event) => {
    const metadata = jsonObject(event.metadata);
    return {
      eventType: event.eventType,
      providerPaymentId: event.providerPaymentId,
      paymentMethod:
        typeof metadata.paymentMethod === "string"
          ? metadata.paymentMethod
          : null,
      refundAmount:
        typeof metadata.refundAmount === "number"
          ? metadata.refundAmount
          : null,
      fullyRefunded:
        typeof metadata.fullyRefunded === "boolean"
          ? metadata.fullyRefunded
          : null,
      processedAt: event.processedAt.toISOString(),
    };
  });
  return {
    ...orderDetail(order),
    paymentMethod:
      safeEvents.find((event) => event.paymentMethod)?.paymentMethod ?? null,
    statusEvents: safeEvents,
  };
}

async function reconcileOrder(session: AuthSessionContext, orderId: string) {
  const order = await getVisibleOrder(session, orderId);
  const client = provider;
  if (!order.providerOrderId || !client) {
    return getOrder(session, orderId);
  }

  const payments = order.providerPaymentId
    ? [await client.getPayment(order.providerPaymentId)]
    : await client.getOrderPayments(order.providerOrderId);
  const matching = payments.filter((payment) =>
    payment.order_id === order.providerOrderId &&
    payment.amount === order.totalPaise &&
    payment.currency.toUpperCase() === order.currency &&
    (!order.providerPaymentId || payment.id === order.providerPaymentId),
  );
  const captured = matching.find((payment) =>
    payment.captured !== false &&
    (payment.status === "captured" || payment.status === "refunded"),
  );
  const metadata = { source: "razorpay_refresh" };

  if (captured) {
    if (captured.status === "captured" && !order.providerPaymentId) {
      await finalizeCapturedOrder({
        localOrderId: order.id,
        providerPayment: captured,
        event: {
          providerEventId: `refresh:capture:${order.id}:${captured.id}`,
          eventType: "payment.captured.reconciled",
          payloadHash: sha256(stableJson(captured)),
          metadata,
        },
      });
    }
    if (captured.amount_refunded > 0) {
      const refunds = (await client.getPaymentRefunds(captured.id)).filter((refund) =>
        refund.status === "processed" &&
        refund.payment_id === captured.id &&
        refund.currency.toUpperCase() === order.currency,
      );
      const settledRefunds = {
        ...captured,
        amount_refunded: Math.min(
          captured.amount_refunded,
          refunds.reduce((total, refund) => total + refund.amount, 0),
        ),
      };
      for (const refund of refunds) {
        await recordRefund(settledRefunds, {
          providerPaymentId: captured.id,
          refundId: refund.id,
          refundAmount: refund.amount,
          event: {
            providerEventId: `refresh:refund:${refund.id}`,
            eventType: "refund.processed",
            payloadHash: sha256(stableJson(refund)),
            metadata,
          },
        });
      }
    }
  } else if (
    order.status === BillingOrderStatus.PAYMENT_PENDING &&
    matching[0] &&
    matching.every((payment) => payment.status === "failed")
  ) {
    const failed = matching[0];
    await processFailedWebhook({
      providerOrderId: order.providerOrderId,
      providerPaymentId: failed.id,
      errorCode: failed.error_code ?? undefined,
      errorDescription: failed.error_description ?? undefined,
      event: {
        providerEventId: `refresh:failure:${order.id}:${failed.id}`,
        eventType: "payment.failed",
        payloadHash: sha256(stableJson(failed)),
        metadata,
      },
    });
  }
  return getOrder(session, orderId);
}

async function listInvoices(
  session: AuthSessionContext,
  query: { cursor?: string; limit: number },
) {
  const cursor = decodeCursor(query.cursor);
  const rows = await prisma.billingInvoice.findMany({
    where: {
      tenantId: session.tenantId,
      ...(session.role === "ADMIN"
        ? {}
        : { order: { userId: session.userId } }),
      ...beforeCursor(cursor, "issuedAt"),
    },
    include: { order: { select: { planName: true, userId: true } } },
    orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
  });
  const hasMore = rows.length > query.limit;
  const items = rows.slice(0, query.limit);
  const last = items.at(-1);
  return {
    items: items.map((invoice) => ({
      id: invoice.id,
      orderId: invoice.orderId,
      invoiceNumber: invoice.invoiceNumber,
      planName: invoice.order.planName,
      issuedAt: invoice.issuedAt.toISOString(),
      currency: invoice.currency,
      basePaise: invoice.basePaise,
      taxPaise: invoice.taxPaise,
      totalPaise: invoice.totalPaise,
      downloadUrl: `/api/v1/invoices/${invoice.id}/download`,
    })),
    nextCursor: hasMore && last ? encodeCursor(last.issuedAt, last.id) : null,
  };
}

async function getInvoiceForDownload(
  session: AuthSessionContext,
  invoiceId: string,
) {
  const invoice = await prisma.billingInvoice.findFirst({
    where: {
      id: invoiceId,
      tenantId: session.tenantId,
      ...(session.role === "ADMIN"
        ? {}
        : { order: { userId: session.userId } }),
    },
    include: { order: true },
  });
  if (!invoice)
    throw new ApiError(404, "INVOICE_NOT_FOUND", "Invoice was not found.");
  return invoice;
}

export type ActiveEntitlementQuery = {
  tenantId: string;
  userId?: string;
  type: EntitlementType;
  targetId?: string | null;
  at?: Date;
};

async function hasActiveEntitlement(
  input: ActiveEntitlementQuery,
): Promise<boolean> {
  const at = input.at ?? new Date();
  return (
    (await prisma.billingEntitlement.count({
      where: {
        tenantId: input.tenantId,
        ...(input.userId ? { userId: input.userId } : {}),
        type: input.type,
        ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
        status: EntitlementStatus.ACTIVE,
        startsAt: { lte: at },
        endsAt: { gt: at },
        revokedAt: null,
      },
    })) > 0
  );
}

export const billingService = {
  async catalogForRole(session: AuthSessionContext) {
    const {role,tenantId,userId} = session;
    const managed = await prisma.listingPlan.findMany({where: {tenantId}, orderBy: [{createdAt: "asc"}, {id: "asc"}]});
    const plans = [...managed.map(catalogPlan), ...billingConfiguration.plans]
      .filter((plan) => plan.active && plan.allowedRoles.includes(role))
      .map(plan => ({...planDto(plan), excludeProperties: plan.priceId === listingFeaturePriceId && managed.some(row =>
        row.purpose === "PROPERTY_FEATURE" && row.audience === (role === "BUILDER" ? "BUILDER" : "LISTER"))}));
    return {
      checkoutAvailable:
        billingConfiguration.checkoutAvailable && plans.length > 0,
      balance: await postingBalance(tenantId,userId),
      plans,
    };
  },
  async managedPlan(session: AuthSessionContext, id: string) {
    const row = await prisma.listingPlan.findFirst({where: {id, tenantId: session.tenantId}});
    if (row && (session.role === "ADMIN" || (row.active && catalogPlan(row).allowedRoles.includes(session.role)))) {
      return {...planDto(catalogPlan(row)), preview: session.role === "ADMIN", active: row.active};
    }
    throw new ApiError(404, "PLAN_NOT_FOUND", "This plan is unavailable for this account.");
  },
  createCheckout,
  featurePayment,
  verifyCheckout,
  listOrders,
  getOrder,
  reconcileOrder,
  listInvoices,
  getInvoiceForDownload,
  finalizeCapturedOrder,
  isProviderEventProcessed,
  processCapturedWebhook,
  processFailedWebhook,
  processRefundWebhook,
  hasActiveEntitlement,
};
