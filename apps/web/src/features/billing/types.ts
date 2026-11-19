export type BillingPlan = {
  priceId: string;
  name: string;
  description: string;
  basePaise: number;
  taxPaise: number;
  totalPaise: number;
  currency: "INR";
  entitlementDays: number;
  requiresTarget: boolean;
  targetKind: null | "AD_CAMPAIGN" | "JOB";
};

export type BillingCatalog = {
  checkoutAvailable: boolean;
  plans: BillingPlan[];
};

export type BillingSnapshot = {
  legalName: string;
  billingEmail: string;
  billingMobile: string;
  gstin?: string;
  addressLine1: string;
  addressLine2?: string;
  locality?: string;
  city: string;
  stateCode: string;
  postalCode: string;
};

export type OrderStatus = "CREATING" | "PAYMENT_PENDING" | "CAPTURED" | "FAILED" | "REFUNDED";

export type OrderSummary = {
  id: string;
  status: OrderStatus;
  priceId: string;
  planName: string;
  targetId?: string | null;
  currency: string;
  basePaise: number;
  taxPaise: number;
  totalPaise: number;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  createdAt: string;
  capturedAt?: string | null;
  refundedAt?: string | null;
  invoiceId?: string | null;
};

export type BillingInvoice = {
  id: string;
  invoiceNumber: string;
  issuedAt: string;
  currency: string;
  totalPaise: number;
  downloadUrl: string;
};

export type BillingEntitlement = {
  id: string;
  type: string;
  status: string;
  targetId?: string | null;
  startsAt: string;
  endsAt: string;
  revokedAt: string | null;
};

export type BillingStatusEvent = {
  eventType: string;
  providerPaymentId: string | null;
  paymentMethod: string | null;
  refundAmount: number | null;
  fullyRefunded: boolean | null;
  processedAt: string;
};

export type OrderDetail = OrderSummary & {
  billing: BillingSnapshot;
  paymentMethod: string | null;
  statusEvents: BillingStatusEvent[];
  failure: {code: string | null; description: string | null} | null;
  invoice?: BillingInvoice | null;
  entitlement?: BillingEntitlement | null;
};

export type OrdersPage = {
  items: OrderSummary[];
  nextCursor: string | null;
};

export type CheckoutResponse = {
  order: OrderSummary;
  checkout: {
    keyId: string;
    orderId: string;
    amount: number;
    currency: string;
  } | null;
};

export type VerifyResponse = {
  order: OrderSummary;
  invoice: BillingInvoice;
  entitlement: BillingEntitlement;
};

export type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
