import { z } from "zod";

import { PRICE_IDS } from "./config.js";
import { gstStateCodes } from "./gst-states.js";

export const billingAddressSchema = z
  .object({
    legalName: z.string().trim().min(2).max(160),
    billingEmail: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    billingMobile: z.string().trim().min(7).max(20),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^\d{2}[A-Z0-9]{13}$/)
      .optional(),
    addressLine1: z.string().trim().min(3).max(240),
    addressLine2: z.string().trim().max(240).optional(),
    locality: z.string().trim().min(1).max(160).optional(),
    city: z.string().trim().min(2).max(120),
    stateCode: z
      .string()
      .regex(/^\d{2}$/)
      .refine((value) => gstStateCodes.has(value), {
        message: "Unknown GST state code",
      }),
    postalCode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid six-digit Indian PIN code"),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.gstin && value.gstin.slice(0, 2) !== value.stateCode) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gstin"],
        message: "GSTIN state code must match billing stateCode",
      });
    }
  });

export const createCheckoutSchema = z
  .object({
    priceId: z.union([z.enum(PRICE_IDS), z.string().uuid()]),
    targetId: z.string().trim().min(1).max(100).optional(),
    billing: billingAddressSchema,
    termsAccepted: z.literal(true),
  })
  .strict();

export const verifyCheckoutSchema = z
  .object({
    razorpay_order_id: z.string().trim().min(1).max(100),
    razorpay_payment_id: z.string().trim().min(1).max(100),
    razorpay_signature: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{64}$/i),
  })
  .strict();

export const orderListQuerySchema = z.object({
  status: z
    .enum(["CREATING", "PAYMENT_PENDING", "CAPTURED", "FAILED", "REFUNDED"])
    .optional(),
  cursor: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const invoiceListQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_.:-]+$/);

export type BillingAddressInput = z.infer<typeof billingAddressSchema>;
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type VerifyCheckoutInput = z.infer<typeof verifyCheckoutSchema>;
