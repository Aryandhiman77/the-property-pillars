import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { renderInvoicePdf } from "../src/billing/invoice-pdf.js";
import {
  RazorpayClient,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "../src/billing/razorpay.js";
import { billingAddressSchema } from "../src/billing/schemas.js";
import {
  financialYearFor,
  secureHexEqual,
  splitIndianGst,
  stableJson,
} from "../src/billing/utils.js";

test("Razorpay checkout and raw webhook signatures use timing-safe HMAC verification", () => {
  const secret = "test-razorpay-secret-at-least-16";
  const orderId = "order_123";
  const paymentId = "pay_456";
  const checkoutSignature = createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  assert.equal(
    verifyCheckoutSignature({
      secret,
      orderId,
      paymentId,
      signature: checkoutSignature,
    }),
    true,
  );
  assert.equal(
    verifyCheckoutSignature({
      secret,
      orderId,
      paymentId,
      signature: "00".repeat(32),
    }),
    false,
  );
  assert.equal(secureHexEqual("0a", "0"), false);

  const rawBody = Buffer.from('{"event":"payment.captured"}', "utf8");
  const webhookSignature = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  assert.equal(
    verifyWebhookSignature({ secret, rawBody, signature: webhookSignature }),
    true,
  );
  assert.equal(
    verifyWebhookSignature({
      secret,
      rawBody: Buffer.from('{"event":"payment.failed"}', "utf8"),
      signature: webhookSignature,
    }),
    false,
  );
});

test("Razorpay client validates order lookup responses without exposing credentials", async () => {
  const seen: Array<{ url: string; authorization: string | null }> = [];
  const mockFetch: typeof fetch = async (input, init) => {
    seen.push({
      url: String(input),
      authorization: new Headers(init?.headers).get("authorization"),
    });
    return new Response(
      JSON.stringify({
        items: [
          {
            id: "order_remote",
            entity: "order",
            amount: 11800,
            currency: "INR",
            receipt: "tpp_receipt",
            status: "created",
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const client = new RazorpayClient(
    "rzp_test_key",
    "secret-value",
    "https://example.test/v1",
    mockFetch,
  );
  const order = await client.findOrderByReceipt(
    "tpp_receipt",
    new Date("2026-11-18T08:30:00.000Z"),
  );
  assert.equal(order?.id, "order_remote");
  assert.match(seen[0]?.url ?? "", /count=100/);
  assert.match(seen[0]?.url ?? "", /from=/);
  assert.match(seen[0]?.authorization ?? "", /^Basic /);
});

test("GST split, financial year and canonical request hashing inputs are deterministic", () => {
  assert.deepEqual(splitIndianGst(1801, "03", "03"), {
    cgstPaise: 900,
    sgstPaise: 901,
    igstPaise: 0,
  });
  assert.deepEqual(splitIndianGst(1801, "03", "27"), {
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 1801,
  });
  assert.equal(
    financialYearFor(new Date("2026-03-31T18:29:59.999Z")),
    "2025-26",
  );
  assert.equal(
    financialYearFor(new Date("2026-03-31T18:30:00.000Z")),
    "2026-27",
  );
  assert.equal(
    stableJson({ b: 2, a: { d: 4, c: 3 } }),
    '{"a":{"c":3,"d":4},"b":2}',
  );
});

test("billing address validates GST state codes and GSTIN relationship", () => {
  const valid = {
    legalName: "Example Builders Private Limited",
    billingEmail: "BILLING@example.com",
    billingMobile: "+919999999999",
    gstin: "03ABCDE1234F1Z5",
    addressLine1: "Sector 17",
    city: "Chandigarh",
    stateCode: "03",
    postalCode: "160017",
  };
  assert.equal(billingAddressSchema.safeParse(valid).success, true);
  assert.equal(
    billingAddressSchema.safeParse({ ...valid, stateCode: "99" }).success,
    false,
  );
  assert.equal(
    billingAddressSchema.safeParse({ ...valid, stateCode: "04" }).success,
    false,
  );
});

test("tax invoice renderer emits a PDF from immutable order snapshots", async () => {
  const pdf = await renderInvoicePdf({
    invoiceNumber: "TST/2627/000001",
    issuedAt: new Date("2026-11-18T08:30:00.000Z"),
    currency: "INR",
    basePaise: 10000,
    cgstPaise: 900,
    sgstPaise: 900,
    igstPaise: 0,
    taxPaise: 1800,
    totalPaise: 11800,
    supplierSnapshot: {
      legalName: "The Property Pillar Private Limited",
      addressLine1: "Example business address",
      city: "Chandigarh",
      stateCode: "04",
      stateName: "Chandigarh",
      postalCode: "160017",
      gstin: "04ABCDE1234F1Z5",
      serviceCode: "998399",
      taxRateBps: 1800,
    },
    customerSnapshot: {
      legalName: "Customer Private Limited",
      addressLine1: "Example customer address",
      city: "Chandigarh",
      stateCode: "04",
      stateName: "Chandigarh",
      postalCode: "160017",
    },
    order: {
      priceId: "DEALER_PRO_30D",
      planName: "Dealer Pro 30 days",
      providerOrderId: "order_123",
      providerPaymentId: "pay_456",
      targetId: null,
    },
  });
  assert.equal(pdf.subarray(0, 4).toString("ascii"), "%PDF");
  assert.ok(pdf.length > 1_000);
});
