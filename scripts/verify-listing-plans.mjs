import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";

export async function verifyListingPlans({
  request,
  buyer,
  builder,
  admin,
  prisma,
  razorpay,
  pass,
}) {
  const catalog = async (client) =>
    (await request(client, "/catalog/plans")).data;
  const fresh = await catalog(buyer);
  assert.equal(
    fresh.balance.freeRemaining,
    2,
    "Use a fresh isolated billing verification schema for this scenario.",
  );
  const planBody = {
    name: "Portfolio Five",
    description: "Five additional listings for property owners and dealers.",
    aboutHtml: "<p>Portfolio coverage</p>",
    highlights: ["Five submissions"],
    audience: "LISTER",
    purpose: "PROPERTY_POSTS",
    basePaise: 49900,
    taxRateBps: 0,
    serviceCode: "998599",
    entitlementDays: 30,
    postingCredits: 5,
    active: true,
  };
  await request(buyer, "/admin/listing-plans", {
    method: "POST",
    body: planBody,
    expected: 403,
  });
  const createPlan = async (changes) =>
    (
      await request(admin, "/admin/listing-plans", {
        method: "POST",
        body: { ...planBody, ...changes },
        expected: 201,
      })
    ).data;
  const plan = await createPlan({});
  const builderPlan = await createPlan({
    name: "Builder launch",
    audience: "BUILDER",
  });
  assert.ok(
    (await catalog(builder)).plans.some((p) => p.priceId === builderPlan.id),
  );
  assert.ok(
    !(await catalog(buyer)).plans.some((p) => p.priceId === builderPlan.id),
  );
  await request(buyer, "/catalog/plans/" + builderPlan.id, { expected: 404 });
  await request(admin, "/admin/listing-plans/" + builderPlan.id, {
    method: "DELETE",
  });
  await request(admin, "/catalog/plans/" + builderPlan.id, { expected: 404 });
  pass("Admin plan CRUD and role-scoped catalog and details");

  const body = {
    listingIntent: "SALE",
    propertyType: "TOWNHOUSE",
    propertyCategory: "RESIDENTIAL",
    price: 450000,
    currency: "GBP",
    areaValue: 1150,
    areaUnit: "SQFT",
    bedrooms: 2,
    halls: 1,
    bathrooms: 2,
    balconies: 1,
    constructionStatus: "READY_TO_MOVE",
    countryCode: "GB",
    city: "London",
    locality: "Richmond",
    postalCode: "TW9 1TP",
    highlights: ["Bright south-facing rooms"],
    projectOrSociety: "Richmond Mews",
    floorNumber: 1,
    totalFloors: 2,
    facing: "SOUTH",
    aboutPropertyHtml: "<p>A garden home.</p>",
    consentAccepted: true,
  };
  async function post(title, requestId, status, expected = 201) {
    const media = (
      await request(buyer, "/uploads", {
        method: "POST",
        headers: {
          "Content-Type": "image/webp",
          "X-Upload-Purpose": "properties:mediaUrls",
        },
        body: await readFile(
          new URL(
            "../apps/web/public/images/daylight/architecture-hero.webp",
            import.meta.url,
          ),
        ),
        expected: 201,
      })
    ).data.url;
    return request(buyer, "/workspace/properties", {
      method: "POST",
      expected,
      body: {
        title,
        description:
          "A bright home on a quiet street within walking distance of Richmond station.",
        status,
        requestId,
        data: { ...body, mediaUrls: [media] },
      },
    });
  }
  const firstId = randomUUID();
  const draft = (await post("Garden Mews", firstId, undefined)).data;
  assert.equal((await catalog(buyer)).balance.remaining, 2);
  await request(buyer, "/workspace/properties/" + draft.id, {
    method: "PATCH",
    body: { status: "PENDING_REVIEW" },
  });
  assert.equal((await catalog(buyer)).balance.remaining, 1);
  const attempts = await Promise.all([
    post("River Cottage", randomUUID(), "PENDING_REVIEW", [201, 402]),
    post("Parkside Lodge", randomUUID(), "PENDING_REVIEW", [201, 402]),
  ]);
  assert.deepEqual(attempts.map((result) => result.status).sort(), [201, 402]);
  assert.equal((await catalog(buyer)).balance.posted, 2);
  pass(
    "Draft is free, first submission charges once, concurrent posts cannot overspend the second free credit",
  );

  async function capture(priceId, targetId, edit) {
    const checkout = (
      await request(buyer, "/checkouts", {
        method: "POST",
        expected: 201,
        headers: { "Idempotency-Key": randomUUID() },
        body: {
          priceId,
          targetId,
          termsAccepted: true,
          billing: {
            legalName: "Portfolio Account",
            billingEmail: "billing@example.invalid",
            billingMobile: "+919876543210",
            addressLine1: "12, City Centre",
            city: "Chandigarh",
            stateCode: "04",
            postalCode: "160017",
          },
        },
      })
    ).data;
    if (edit) await edit();
    const paymentId = "pay_" + randomUUID().replaceAll("-", "").slice(0, 18);
    const order = checkout.order;
    razorpay.payments.set(paymentId, {
      id: paymentId,
      entity: "payment",
      amount: order.totalPaise,
      currency: "INR",
      status: "captured",
      order_id: order.providerOrderId,
      captured: true,
      amount_refunded: 0,
    });
    const payload = {
      razorpay_order_id: order.providerOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(order.providerOrderId + "|" + paymentId)
        .digest("hex"),
    };
    const verify = () =>
      request(buyer, "/orders/" + order.id + "/verify", {
        method: "POST",
        body: payload,
      });
    const result = (await verify()).data;
    assert.equal((await verify()).data.invoice.id, result.invoice.id);
    for (const client of [admin, buyer]) {
      const pdf = await request(
        client,
        "/invoices/" + result.invoice.id + "/download",
        { binary: true },
      );
      assert.equal(pdf.bytes.subarray(0, 5).toString(), "%PDF-");
    }
    return result;
  }
  const paid = await capture(plan.id, undefined, async () => {
    assert.equal((await catalog(buyer)).balance.remaining, 0);
    await request(admin, "/admin/listing-plans/" + plan.id, {
      method: "PUT",
      body: { ...planBody, postingCredits: 8, entitlementDays: 60 },
    });
  });
  assert.equal((await catalog(buyer)).balance.remaining, 5);
  const grant = paid.entitlement;
  assert.equal(
    (Date.parse(grant.endsAt) - Date.parse(grant.startsAt)) / 86400000,
    30,
  );
  const submitId = randomUUID();
  const third = (await post("Orchard Court", submitId, "PENDING_REVIEW")).data;
  assert.equal(
    (await post("Orchard Court", submitId, "PENDING_REVIEW")).data.id,
    third.id,
  );
  const workspace = (await request(buyer, "/workspace")).data;
  assert.equal(workspace.role, "DEALER");
  assert.equal(
    workspace.collections.find((c) => c.key === "dealerProfiles").items.length,
    1,
  );
  assert.equal((await catalog(buyer)).balance.remaining, 4);
  assert.equal(third.data.projectOrSociety, body.projectOrSociety);
  await request(admin, "/admin/listing-plans/" + plan.id, { method: "DELETE" });
  assert.equal((await catalog(buyer)).balance.remaining, 4);
  pass(
    "Captured checkout grants the original five credits and thirty days, receipt downloads for buyer and admin, third submission promotes the same session and retries do not charge twice",
  );

  for (const purpose of ["PROFILE_FEATURE", "PROPERTY_FEATURE"]) {
    const feature = await createPlan({
      name:
        purpose === "PROFILE_FEATURE"
          ? "Dealer Spotlight"
          : "Property Spotlight",
      purpose,
      postingCredits: 0,
      entitlementDays: 14,
    });
    const featureOrder = await capture(
      feature.id,
      purpose === "PROPERTY_FEATURE" ? third.id : undefined,
    );
    assert.equal(
      featureOrder.entitlement.type,
      purpose === "PROFILE_FEATURE" ? "PROFILE_FEATURE" : "LISTING_FEATURE",
    );
    assert.equal(
      (Date.parse(featureOrder.entitlement.endsAt) -
        Date.parse(featureOrder.entitlement.startsAt)) /
        86400000,
      14,
    );
    if (purpose === "PROPERTY_FEATURE") {
      assert.equal(
        (await request(buyer, "/feature-payments/" + third.id)).data.active,
        true,
      );
      await prisma.billingEntitlement.update({
        where: { id: featureOrder.entitlement.id },
        data: { endsAt: new Date(Date.now() - 1000) },
      });
      assert.equal(
        (await request(buyer, "/feature-payments/" + third.id)).data.canPay,
        true,
      );
    }
  }
  await prisma.billingEntitlement.update({
    where: { id: grant.id },
    data: { endsAt: new Date(Date.now() - 1000) },
  });
  assert.equal((await catalog(buyer)).balance.remaining, 0);
  await post("Expired credit attempt", randomUUID(), "PENDING_REVIEW", 402);
  pass(
    "Expiring property and profile featuring, renewable property placement and expired posting credits",
  );
}
