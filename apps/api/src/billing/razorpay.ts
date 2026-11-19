import { z } from "zod";

import { ApiError } from "../utils/api-error.js";
import { verifyHmacSha256 } from "./utils.js";

const orderResponseSchema = z.object({
  id: z.string().min(1),
  entity: z.literal("order").optional(),
  amount: z.number().int().positive(),
  amount_paid: z.number().int().nonnegative().optional(),
  amount_due: z.number().int().nonnegative().optional(),
  currency: z.string().min(3),
  receipt: z.string().nullable().optional(),
  status: z.enum(["created", "attempted", "paid"]),
});

const paymentResponseSchema = z.object({
  id: z.string().min(1),
  entity: z.literal("payment").optional(),
  amount: z.number().int().positive(),
  currency: z.string().min(3),
  status: z.enum(["created", "authorized", "captured", "refunded", "failed"]),
  order_id: z.string().min(1).nullable(),
  captured: z.boolean().optional(),
  amount_refunded: z.number().int().nonnegative().optional().default(0),
  method: z.string().min(1).max(40).nullish(),
  error_code: z.string().nullable().optional(),
  error_description: z.string().nullable().optional(),
});

const refundResponseSchema = z.object({
  id: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.string().min(3),
  payment_id: z.string().min(1),
  status: z.enum(["pending", "processed", "failed"]),
});

export type RazorpayOrder = z.infer<typeof orderResponseSchema>;
export type RazorpayPayment = z.infer<typeof paymentResponseSchema>;
type RazorpayRefund = z.infer<typeof refundResponseSchema>;

export function verifyCheckoutSignature(input: {
  secret: string;
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  return verifyHmacSha256(
    input.secret,
    `${input.orderId}|${input.paymentId}`,
    input.signature,
  );
}

export function verifyWebhookSignature(input: {
  secret: string;
  rawBody: Buffer;
  signature: string;
}): boolean {
  return verifyHmacSha256(input.secret, input.rawBody, input.signature);
}

export interface RazorpayProvider {
  createOrder(input: {
    amount: number;
    currency: "INR";
    receipt: string;
    notes: Record<string, string>;
  }): Promise<RazorpayOrder>;
  findOrderByReceipt(
    receipt: string,
    createdAt: Date,
  ): Promise<RazorpayOrder | null>;
  getPayment(paymentId: string): Promise<RazorpayPayment>;
  getOrderPayments(orderId: string): Promise<RazorpayPayment[]>;
  getPaymentRefunds(paymentId: string): Promise<RazorpayRefund[]>;
}

export class RazorpayClient implements RazorpayProvider {
  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
    private readonly apiBase = "https://api.razorpay.com/v1",
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async createOrder(input: {
    amount: number;
    currency: "INR";
    receipt: string;
    notes: Record<string, string>;
  }): Promise<RazorpayOrder> {
    return orderResponseSchema.parse(
      await this.request("/orders", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  }

  async getPayment(paymentId: string): Promise<RazorpayPayment> {
    return paymentResponseSchema.parse(
      await this.request(`/payments/${encodeURIComponent(paymentId)}`, {
        method: "GET",
      }),
    );
  }

  async getOrderPayments(orderId: string): Promise<RazorpayPayment[]> {
    const path = `/orders/${encodeURIComponent(orderId)}/payments`;
    const response = z.object({ items: z.array(paymentResponseSchema) }).parse(
      await this.request(path, { method: "GET" }),
    );
    return response.items;
  }

  async getPaymentRefunds(paymentId: string): Promise<RazorpayRefund[]> {
    const path = `/payments/${encodeURIComponent(paymentId)}/refunds`;
    const schema = z.object({ items: z.array(refundResponseSchema) });
    const refunds: RazorpayRefund[] = [];
    const pageSize = 100;
    let page: RazorpayRefund[];
    do {
      const query = `count=${pageSize}&skip=${refunds.length}`;
      page = schema.parse(await this.request(`${path}?${query}`, { method: "GET" })).items;
      refunds.push(...page);
    } while (page.length === pageSize);
    return [...new Map(refunds.map((refund) => [refund.id, refund])).values()];
  }

  async findOrderByReceipt(
    receipt: string,
    createdAt: Date,
  ): Promise<RazorpayOrder | null> {
    // Fetch All Orders documents time-window pagination but no receipt filter.
    // Scan the narrow creation window; receipt is unique at Razorpay.
    const from = Math.floor(createdAt.getTime() / 1000) - 60;
    const to = Math.floor(createdAt.getTime() / 1000) + 10 * 60;
    for (let skip = 0; skip < 2_000; skip += 100) {
      const query = new URLSearchParams({
        from: String(from),
        to: String(to),
        count: "100",
        skip: String(skip),
      });
      const response = z
        .object({ items: z.array(orderResponseSchema) })
        .parse(
          await this.request(`/orders?${query.toString()}`, { method: "GET" }),
        );
      const match = response.items.find((order) => order.receipt === receipt);
      if (match) return match;
      if (response.items.length < 100) return null;
    }
    return null;
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    let response: globalThis.Response;
    try {
      response = await this.fetchImplementation(`${this.apiBase}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ApiError(
        502,
        "PAYMENT_PROVIDER_UNAVAILABLE",
        "The payment provider could not be reached. Please try again.",
      );
    }

    const body = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      throw new ApiError(
        502,
        "PAYMENT_PROVIDER_ERROR",
        "The payment provider rejected the request. Please try again.",
        { providerStatus: response.status },
      );
    }
    return body;
  }
}
