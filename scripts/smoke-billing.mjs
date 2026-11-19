import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const credentialsPath = resolve(
  repoRoot,
  process.argv[2] ?? "tmp/panel-credentials.verify.json",
);
const resultPath = resolve(repoRoot, process.argv[3] ?? "tmp/smoke-billing-result.json");
const verificationSchema = process.env.BILLING_SMOKE_SCHEMA ?? "delivery_verification";
const keysOnly = process.argv.includes("--keys-only");
assert.match(verificationSchema, /^(delivery_verification|audit_billing_[a-z0-9_]+)$/, "Use a dedicated billing verification schema.");
const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const checks = [];

const roles = [
  "BUYER",
  "OWNER",
  "DEALER",
  "BUILDER",
  "VENDOR",
  "PROFESSIONAL",
  "WHITE_COLLAR_SEEKER",
  "BLUE_COLLAR_WORKER",
  "ADMIN",
];

function pass(label) {
  checks.push(label);
  console.log("[pass] " + label);
}

function requireVerificationDatabase() {
  process.loadEnvFile(join(repoRoot, "apps/api/.env"));
  const override = process.env.BILLING_SMOKE_DATABASE_URL;
  const source = override ?? process.env.DATABASE_URL;
  assert.ok(source, "DATABASE_URL is missing from apps/api/.env.");

  const databaseUrl = new URL(source);
  assert.ok(
    ["127.0.0.1", "localhost", "::1", "[::1]"].includes(databaseUrl.hostname),
    "Billing smoke accepts only a loopback PostgreSQL host.",
  );
  assert.equal(
    databaseUrl.pathname,
    "/the-property-pillar",
    "Billing smoke accepts only the local the-property-pillar database.",
  );
  if (override) {
    assert.equal(
      databaseUrl.searchParams.get("schema"),
      verificationSchema,
      "BILLING_SMOKE_DATABASE_URL must select the dedicated billing verification schema.",
    );
  }
  databaseUrl.searchParams.set("schema", verificationSchema);
  process.env.DATABASE_URL = databaseUrl.toString();
}

async function configureIsolatedApi() {
  requireVerificationDatabase();
  process.env.NODE_ENV = "test";
  process.env.API_HOST = "127.0.0.1";
  process.env.CORS_ORIGINS = "http://127.0.0.1";
  process.env.RATE_LIMIT_MAX = "10000";
  process.env.AUTH_RATE_LIMIT_MAX = "500";
  process.env.UPLOAD_ROOT = join(repoRoot, "tmp", verificationSchema + "-uploads");
  process.env.RAZORPAY_KEY_ID = "rzp_test_smoke_only";
  process.env.RAZORPAY_KEY_SECRET = "smoke-key-secret-not-live";
  process.env.RAZORPAY_WEBHOOK_SECRET = keysOnly ? "" : "smoke-webhook-secret-not-live";
  const supplier = {
    legalName: "ThePropertyPillar Verification",
    gstin: "04ABCDE1234F1Z5",
    addressLine1: "Verification workspace",
    city: "Chandigarh",
    stateCode: "04",
    postalCode: "160017",
    billingEmail: "billing-verification@example.invalid",
    billingMobile: "+910000000000",
  };
  const plans = [
    {
      priceId: "DEALER_PRO_30D",
      name: "Dealer Pro 30 days",
      description:
        "Verification-only dealer profile entitlement for thirty days.",
      basePaise: 10_000,
      taxRateBps: 1_800,
      serviceCode: "998313",
      currency: "INR",
      entitlementDays: 30,
      active: true,
    },
    {
      priceId: "BUILDER_AD_PACKAGE_30D",
      name: "Builder ad package 30 days",
      description:
        "Verification-only advertising entitlement for one campaign.",
      basePaise: 25_000,
      taxRateBps: 1_800,
      serviceCode: "998313",
      currency: "INR",
      entitlementDays: 30,
      active: true,
    },
    {
      priceId: "FEATURED_JOB_BOOST_30D",
      name: "Featured job boost 30 days",
      description:
        "Verification-only featured placement entitlement for one job.",
      basePaise: 5_000,
      taxRateBps: 1_800,
      serviceCode: "998313",
      currency: "INR",
      entitlementDays: 30,
      active: true,
    },
  ];
  const settingsFile = join(repoRoot, "tmp", `${verificationSchema}-billing-${runId}.json`);
  await mkdir(dirname(settingsFile), { recursive: true });
  await writeFile(settingsFile, JSON.stringify({ supplier, plans }), "utf8");
  process.env.BILLING_CONFIG_FILE = settingsFile;
}

function validateCredentials(document) {
  assert.ok(
    document && Array.isArray(document.accounts),
    "Credential document must contain accounts.",
  );
  const accounts = new Map();
  for (const account of document.accounts) {
    assert.ok(
      roles.includes(account?.role),
      "Credential document contains an unsupported role.",
    );
    assert.equal(
      typeof account.email,
      "string",
      `Missing email for ${account.role}.`,
    );
    assert.equal(
      typeof account.password,
      "string",
      `Missing password for ${account.role}.`,
    );
    assert.ok(
      !accounts.has(account.role),
      `Duplicate credential for ${account.role}.`,
    );
    accounts.set(account.role, {
      email: account.email,
      password: account.password,
    });
  }
  for (const role of roles)
    assert.ok(accounts.has(role), `Missing credential for ${role}.`);
  return accounts;
}

function installRazorpayIntercept() {
  const nativeFetch = globalThis.fetch;
  const orders = new Map();
  const payments = new Map();
  const refunds = new Map();
  let orderRequests = 0;
  let paymentRequests = 0;

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.origin !== "https://api.razorpay.com") {
      if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname)) {
        throw new Error(
          `Smoke blocked unexpected external request to ${url.origin}.`,
        );
      }
      return nativeFetch(input, init);
    }

    const expectedAuth =
      "Basic " +
      Buffer.from(
        `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
      ).toString("base64");
    const headers = new Headers(init.headers);
    assert.equal(
      headers.get("authorization"),
      expectedAuth,
      "Razorpay request used unexpected credentials.",
    );

    if (url.pathname === "/v1/orders" && (init.method ?? "GET") === "POST") {
      orderRequests += 1;
      const request = JSON.parse(String(init.body));
      const id = `order_smoke_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
      const order = {
        id,
        entity: "order",
        amount: request.amount,
        amount_paid: 0,
        amount_due: request.amount,
        currency: request.currency,
        receipt: request.receipt,
        status: "created",
      };
      orders.set(id, order);
      return Response.json(order);
    }

    const orderPaymentsMatch = url.pathname.match(/^\/v1\/orders\/([^/]+)\/payments$/);
    if (orderPaymentsMatch && (init.method ?? "GET") === "GET") {
      return Response.json({
        items: [...payments.values()].filter(({ order_id }) => order_id === orderPaymentsMatch[1]),
      });
    }

    const refundsMatch = url.pathname.match(/^\/v1\/payments\/([^/]+)\/refunds$/);
    if (refundsMatch && (init.method ?? "GET") === "GET") {
      return Response.json({ items: refunds.get(refundsMatch[1]) ?? [] });
    }

    const paymentMatch = url.pathname.match(/^\/v1\/payments\/([^/]+)$/);
    if (paymentMatch && (init.method ?? "GET") === "GET") {
      paymentRequests += 1;
      const payment = payments.get(decodeURIComponent(paymentMatch[1]));
      return payment
        ? Response.json(payment)
        : Response.json(
            { error: { description: "Unknown smoke payment" } },
            { status: 404 },
          );
    }

    throw new Error(
      `Smoke blocked unexpected Razorpay request ${init.method ?? "GET"} ${url.pathname}.`,
    );
  };

  return {
    orders,
    payments,
    refunds,
    counts: () => ({ orderRequests, paymentRequests }),
    restore: () => {
      globalThis.fetch = nativeFetch;
    },
  };
}

function cookieFrom(response) {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  return values.length ? values[0].split(";", 1)[0] : undefined;
}

async function startApi() {
  const appUrl = pathToFileURL(join(repoRoot, "apps/api/src/app.ts")).href;
  const prismaUrl = pathToFileURL(
    join(repoRoot, "apps/api/src/database/prisma.ts"),
  ).href;
  const [{ app }, { prisma }] = await Promise.all([
    import(appUrl),
    import(prismaUrl),
  ]);
  const server = await new Promise((resolveServer, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolveServer(instance));
    instance.once("error", reject);
  });
  const address = server.address();
  assert.ok(
    address && typeof address === "object",
    "Verification API did not bind a TCP port.",
  );
  return {
    origin: `http://127.0.0.1:${address.port}`,
    prisma,
    close: () =>
      new Promise((resolveClose, reject) => {
        server.close((error) => (error ? reject(error) : resolveClose()));
      }),
  };
}

function browser() {
  return { cookie: "" };
}

async function writeReport(startedAt, razorpay) {
  const completedAt = new Date();
  const result = {
    ok: true,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    schema: verificationSchema,
    keysOnly,
    checks,
    providerRequests: razorpay.counts(),
  };
  await mkdir(dirname(resultPath), { recursive: true });
  await writeFile(resultPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  console.log(`Billing smoke passed ${checks.length} checks. Result: ${resultPath}`);
}

async function run() {
  const startedAt = new Date();
  await configureIsolatedApi();
  const credentials = validateCredentials(
    JSON.parse(await readFile(credentialsPath, "utf8")),
  );
  const razorpay = installRazorpayIntercept();
  let apiRuntime;

  try {
    apiRuntime = await startApi();
    const origin = apiRuntime.origin;

    async function request(
      client,
      path,
      {
        method = "GET",
        body,
        headers = {},
        expected = 200,
        binary = false,
      } = {},
    ) {
      const expectedStatuses = Array.isArray(expected) ? expected : [expected];
      const response = await fetch(origin + "/api/v1" + path, {
        method,
        headers: {
          ...(client?.cookie ? { Cookie: client.cookie } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...headers,
        },
        body: body === undefined || Buffer.isBuffer(body) ? body : JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
      const nextCookie = cookieFrom(response);
      if (client && nextCookie) client.cookie = nextCookie;

      if (binary) {
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.ok(
          expectedStatuses.includes(response.status),
          `${method} ${path} returned HTTP ${response.status}.`,
        );
        return { response, bytes };
      }

      const raw = await response.text();
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new Error(
          `${method} ${path} returned non-JSON HTTP ${response.status}.`,
        );
      }
      if (!expectedStatuses.includes(response.status)) {
        throw new Error(
          `${method} ${path} expected ${expectedStatuses.join("/")} but received ${response.status}` +
            (payload?.error?.code ? ` ${payload.error.code}` : ""),
        );
      }
      return {
        status: response.status,
        data: payload.data,
        error: payload.error,
        meta: payload.meta,
      };
    }

    async function signIn(role) {
      const client = browser();
      const account = credentials.get(role);
      const { data } = await request(client, "/auth/sign-in", {
        method: "POST",
        body: account,
      });
      assert.equal(data.role, role);
      assert.ok(client.cookie, `${role} sign-in did not issue a cookie.`);
      return client;
    }

    async function create(client, collection, title, data, description) {
      return (
        await request(client, `/workspace/${collection}`, {
          method: "POST",
          expected: 201,
          body: { title, data, description },
        })
      ).data;
    }

    async function transition(
      client,
      collection,
      item,
      status,
      extra = {},
      expected = 200,
    ) {
      return (
        await request(client, `/workspace/${collection}/${item.id}`, {
          method: "PATCH",
          expected,
          body: { status, ...extra },
        })
      ).data;
    }

    async function findItem(client, collection, id) {
      const workspace = (await request(client, "/workspace")).data;
      const items =
        workspace.collections.find(({ key }) => key === collection)?.items ??
        [];
      const item = items.find((candidate) => candidate.id === id);
      assert.ok(
        item,
        `${collection}/${id} is missing from expected workspace scope.`,
      );
      return item;
    }

    await request(null, "/orders", { expected: 401 });
    await request(null, "/invoices", { expected: 401 });
    pass("billing orders and invoices require authentication");

    const [buyer, builder, dealer, admin] = await Promise.all([
      signIn("BUYER"),
      signIn("BUILDER"),
      signIn("DEALER"),
      signIn("ADMIN"),
    ]);

    const buyerCatalog = (await request(buyer, "/catalog/plans")).data;
    const builderCatalog = (await request(builder, "/catalog/plans")).data;
    const dealerCatalog = (await request(dealer, "/catalog/plans")).data;
    assert.deepEqual(buyerCatalog.plans, []);
    assert.deepEqual(
      builderCatalog.plans.map(({ priceId }) => priceId).sort(),
      ["BUILDER_AD_PACKAGE_30D", "FEATURED_JOB_BOOST_30D"],
    );
    assert.deepEqual(dealerCatalog.plans.map(({ priceId }) => priceId).sort(), [
      "DEALER_PRO_30D",
      "FEATURED_JOB_BOOST_30D",
    ]);
    assert.equal(builderCatalog.checkoutAvailable, true);
    pass("catalog exposes only role-eligible server-priced plans");

    const imageUrl = (await request(builder, "/uploads", {
      method: "POST",
      body: await readFile(join(repoRoot, "apps/web/public/images/daylight/architecture-hero.webp")),
      headers: {"Content-Type": "image/webp", "X-Upload-Purpose": "builderProjects:mediaUrls"},
      expected: 201,
    })).data.url;
    const startsAt = new Date(Date.now() + 3_600_000).toISOString();
    const endsAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
    let project = await create(
      builder,
      "builderProjects",
      `Billing smoke project ${runId}`,
      {
        projectName: `Billing Smoke Project ${runId}`,
        projectType: "RESIDENTIAL",
        city: "Mohali",
        locality: "Airport Road",
        reraNumber: `BILLING-SMOKE-${runId}`.slice(0, 120),
        startingPrice: 8_500_000,
        currency: "INR",
        mediaUrls: [imageUrl],
      },
      "Disposable verification project used only by the isolated billing smoke workflow.",
    );
    project = await transition(
      builder,
      "builderProjects",
      project,
      "PENDING_REVIEW",
    );
    project = await findItem(admin, "builderProjects", project.id);
    project = await transition(admin, "builderProjects", project, "APPROVED", {
      reviewNote: `Billing smoke ${runId}: verification project reviewed.`,
    });
    project = await transition(admin, "builderProjects", project, "PUBLISHED");

    let campaign = await create(
      builder,
      "adCampaigns",
      `Billing smoke campaign ${runId}`,
      {
        projectId: project.id,
        placement: "SEARCH_FEED",
        targetCities: ["Mohali", "Chandigarh"],
        budgetMin: 7_000_000,
        budgetMax: 14_000_000,
        startsAt,
        endsAt,
        destinationUrl: `${origin}/en/projects`,
      },
      "Disposable advertising campaign used to verify the paid-package activation gate.",
    );
    campaign = await transition(
      builder,
      "adCampaigns",
      campaign,
      "PENDING_REVIEW",
    );
    campaign = await findItem(admin, "adCampaigns", campaign.id);
    campaign = await transition(admin, "adCampaigns", campaign, "APPROVED");
    const missingPackage = await request(
      admin,
      `/workspace/adCampaigns/${campaign.id}`,
      {
        method: "PATCH",
        expected: 409,
        body: { status: "ACTIVE" },
      },
    );
    assert.match(missingPackage.error?.message ?? "", /paid ad package/i);
    pass(
      "approved advertising campaign cannot activate without paid entitlement",
    );

    const billing = {
      legalName: "Billing Verification Customer",
      billingEmail: "customer-verification@example.invalid",
      locality: "Airport Road",
      billingMobile: "+910000000001",
      gstin: "03ABCDE1234F1Z5",
      addressLine1: "Verification address",
      city: "Mohali",
      stateCode: "03",
      postalCode: "160055",
    };
    const checkoutBody = {
      priceId: "BUILDER_AD_PACKAGE_30D",
      targetId: campaign.id,
      billing,
      termsAccepted: true,
    };

    const forbidden = await request(buyer, "/checkouts", {
      method: "POST",
      expected: 403,
      headers: { "Idempotency-Key": `buyer-${runId}` },
      body: checkoutBody,
    });
    assert.equal(forbidden.error?.code, "PLAN_NOT_AVAILABLE_FOR_ROLE");

    const idempotencyKey = `billing-${runId}`;
    const checkout = (
      await request(builder, "/checkouts", {
        method: "POST",
        expected: 201,
        headers: { "Idempotency-Key": idempotencyKey },
        body: checkoutBody,
      })
    ).data;
    assert.equal(checkout.order.status, "PAYMENT_PENDING");
    assert.equal(checkout.order.priceId, "BUILDER_AD_PACKAGE_30D");
    assert.equal(checkout.order.targetId, campaign.id);
    assert.equal(checkout.checkout.orderId, checkout.order.providerOrderId);
    assert.equal(checkout.checkout.amount, checkout.order.totalPaise);
    assert.equal(razorpay.counts().orderRequests, 1);

    const replay = (
      await request(builder, "/checkouts", {
        method: "POST",
        expected: 201,
        headers: { "Idempotency-Key": idempotencyKey },
        body: checkoutBody,
      })
    ).data;
    assert.equal(replay.order.id, checkout.order.id);
    assert.equal(razorpay.counts().orderRequests, 1);
    await request(builder, "/checkouts", {
      method: "POST",
      expected: 409,
      headers: { "Idempotency-Key": idempotencyKey },
      body: {
        ...checkoutBody,
        billing: { ...billing, legalName: "Changed retry body" },
      },
    });
    pass("checkout is role-scoped, server-priced and idempotent");

    const paymentId = `pay_smoke_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
    razorpay.payments.set(paymentId, {
      id: paymentId,
      entity: "payment",
      amount: checkout.order.totalPaise,
      currency: "INR",
      status: "captured",
      order_id: checkout.order.providerOrderId,
      captured: true,
      amount_refunded: 0,
      error_code: null,
      error_description: null,
    });
    const invalidVerification = {
      razorpay_order_id: checkout.order.providerOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: "0".repeat(64),
    };
    await request(builder, `/orders/${checkout.order.id}/verify`, {
      method: "POST",
      expected: 400,
      body: invalidVerification,
    });
    assert.equal(razorpay.counts().paymentRequests, 0);

    const signature = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${checkout.order.providerOrderId}|${paymentId}`)
      .digest("hex");
    const verify = () => request(builder, `/orders/${checkout.order.id}/verify`, {
      method: "POST",
      body: { ...invalidVerification, razorpay_signature: signature },
    });
    const [firstVerification, concurrentReplay] = await Promise.all([verify(), verify()]);
    const verified = firstVerification.data;
    assert.equal(verified.order.status, "CAPTURED");
    assert.equal(verified.invoice?.id.length > 0, true);
    assert.equal(verified.entitlement?.type, "BUILDER_AD_CAMPAIGN");
    assert.equal(verified.entitlement?.targetId, campaign.id);
    assert.equal(verified.entitlement?.status, "ACTIVE");
    assert.equal(concurrentReplay.data.invoice.id, verified.invoice.id);
    assert.equal(concurrentReplay.data.entitlement.id, verified.entitlement.id);
    assert.ok(razorpay.counts().paymentRequests >= 1 && razorpay.counts().paymentRequests <= 2);

    const verifyReplay = (
      await request(builder, `/orders/${checkout.order.id}/verify`, {
        method: "POST",
        body: { ...invalidVerification, razorpay_signature: signature },
      })
    ).data;
    assert.equal(verifyReplay.invoice.id, verified.invoice.id);
    assert.equal(verifyReplay.entitlement.id, verified.entitlement.id);
    pass(
      "concurrent server verification creates one captured order, invoice and targeted entitlement",
    );

    const ownerOrders = (await request(builder, "/orders?limit=50")).data;
    assert.ok(ownerOrders.items.some(({ id }) => id === checkout.order.id));
    const adminOrders = (await request(admin, "/orders?limit=50")).data;
    assert.ok(adminOrders.items.some(({ id }) => id === checkout.order.id));
    const buyerOrders = (await request(buyer, "/orders?limit=50")).data;
    assert.ok(!buyerOrders.items.some(({ id }) => id === checkout.order.id));
    await request(buyer, `/orders/${checkout.order.id}`, { expected: 404 });
    const ownerOrder = (await request(builder, `/orders/${checkout.order.id}`)).data;
    assert.equal(ownerOrder.billing.locality, "Airport Road");

    const ownerInvoices = (await request(builder, "/invoices?limit=50")).data;
    assert.ok(ownerInvoices.items.some(({ id }) => id === verified.invoice.id));
    const adminInvoices = (await request(admin, "/invoices?limit=50")).data;
    assert.ok(adminInvoices.items.some(({ id }) => id === verified.invoice.id));
    const buyerInvoices = (await request(buyer, "/invoices?limit=50")).data;
    assert.ok(
      !buyerInvoices.items.some(({ id }) => id === verified.invoice.id),
    );
    await request(buyer, `/invoices/${verified.invoice.id}/download`, {
      expected: 404,
    });
    pass("order and invoice owner/admin scopes exclude unrelated accounts");

    const pdf = await request(
      builder,
      `/invoices/${verified.invoice.id}/download`,
      { binary: true },
    );
    assert.match(
      pdf.response.headers.get("content-type") ?? "",
      /^application\/pdf/i,
    );
    assert.match(
      pdf.response.headers.get("content-disposition") ?? "",
      /attachment/i,
    );
    assert.equal(pdf.bytes.subarray(0, 5).toString("ascii"), "%PDF-");
    assert.ok(
      pdf.bytes.length > 1_000,
      "Generated invoice PDF is unexpectedly small.",
    );
    const previewPath = join(repoRoot, "tmp/pdfs/delivery-test-invoice.pdf");
    await mkdir(dirname(previewPath), { recursive: true });
    await writeFile(previewPath, pdf.bytes);
    const adminPdf = await request(
      admin,
      `/invoices/${verified.invoice.id}/download`,
      { binary: true },
    );
    assert.equal(adminPdf.bytes.subarray(0, 5).toString("ascii"), "%PDF-");
    pass(
      "captured order produces owner/admin-authorized downloadable PDF invoice",
    );

    campaign = await findItem(admin, "adCampaigns", campaign.id);
    campaign = await transition(admin, "adCampaigns", campaign, "ACTIVE");
    assert.equal(campaign.status, "ACTIVE");
    pass(
      "paid targeted entitlement unlocks approved advertising campaign activation",
    );

    if (keysOnly) {
      const secondCheckout = (await request(builder, "/checkouts", {
        method: "POST",
        expected: 201,
        headers: { "Idempotency-Key": `billing-keys-only-${runId}` },
        body: checkoutBody,
      })).data;
      const secondOrder = secondCheckout.order;
      const secondPaymentId = `pay_refresh_${randomUUID().replaceAll("-", "").slice(0, 14)}`;
      const refreshPath = `/orders/${secondOrder.id}/reconcile`;
      const refresh = () => request(builder, refreshPath, { method: "POST" });
      const providerPayment = {
        id: secondPaymentId,
        order_id: secondOrder.providerOrderId,
        amount: secondOrder.totalPaise,
        currency: "INR",
        amount_refunded: 0,
      };
      await request(browser(), refreshPath, { method: "POST", expected: 401 });
      await request(buyer, refreshPath, { method: "POST", expected: 404 });
      razorpay.payments.set(secondPaymentId, { ...providerPayment, status: "authorized", captured: false });
      assert.equal((await refresh()).data.status, "PAYMENT_PENDING");
      razorpay.payments.set(secondPaymentId, { ...providerPayment, status: "failed", captured: false });
      assert.equal((await refresh()).data.status, "FAILED");
      razorpay.payments.set(secondPaymentId, {
        ...providerPayment, amount: secondOrder.totalPaise + 1, status: "captured", captured: true,
      });
      assert.equal((await refresh()).data.invoice, null);
      razorpay.payments.set(secondPaymentId, { ...providerPayment, status: "captured", captured: true });
      const [ownerRefresh, adminRefresh] = await Promise.all([
        refresh(), request(admin, refreshPath, { method: "POST" }),
      ]);
      assert.equal(ownerRefresh.data.status, "CAPTURED");
      assert.ok(ownerRefresh.data.invoice?.id);
      assert.equal(ownerRefresh.data.invoice.id, adminRefresh.data.invoice.id);
      assert.equal(ownerRefresh.data.entitlement.id, adminRefresh.data.entitlement.id);
      pass("key-only Refresh verifies capture after a missed callback and issues one invoice");

      const refund = {
        id: `rfnd_refresh_${runId}`,
        payment_id: secondPaymentId,
        amount: Math.floor(secondOrder.totalPaise / 2),
        currency: "INR",
      };
      const balanceRefund = {
        ...refund,
        id: `${refund.id}_balance`,
        amount: secondOrder.totalPaise - refund.amount,
      };
      razorpay.payments.set(secondPaymentId, {
        ...providerPayment, status: "refunded", captured: true, amount_refunded: secondOrder.totalPaise,
      });
      const processedRefund = { ...refund, status: "processed" };
      razorpay.refunds.set(secondPaymentId, [processedRefund, { ...balanceRefund, status: "pending" }]);
      const partiallyRefunded = (await refresh()).data;
      assert.equal(partiallyRefunded.status, "CAPTURED");
      assert.equal(partiallyRefunded.entitlement.status, "ACTIVE");
      razorpay.refunds.set(secondPaymentId, [processedRefund, { ...balanceRefund, status: "processed" }]);
      await Promise.all([refresh(), refresh()]);
      const refunded = (await refresh()).data;
      assert.equal(refunded.status, "REFUNDED");
      assert.equal(refunded.entitlement.status, "REVOKED");
      assert.equal(refunded.invoice.id, ownerRefresh.data.invoice.id);
      assert.equal(refunded.statusEvents.filter(({ eventType }) => eventType === "refund.processed").length, 2);
      await request(browser(), "/webhooks/razorpay", { method: "POST", body: {}, expected: 503 });
      pass("key-only Refresh reconciles refunds without a webhook or duplicate history");
      await writeReport(startedAt, razorpay);
      return;
    }

    const refundEvent = {
      event: "refund.processed",
      payload: {
        refund: {
          entity: {
            id: `rfnd_smoke_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
            payment_id: paymentId,
            amount: checkout.order.totalPaise,
          },
        },
      },
    };
    const refundBody = JSON.stringify(refundEvent);
    const webhookEventId = `billing-smoke-refund-${runId}`;
    const webhookSignature = createHmac(
      "sha256",
      process.env.RAZORPAY_WEBHOOK_SECRET,
    )
      .update(refundBody)
      .digest("hex");
    razorpay.payments.set(paymentId, {
      ...razorpay.payments.get(paymentId),
      status: "refunded",
      amount_refunded: checkout.order.totalPaise,
    });

    async function webhook(body, eventId, signatureValue, expected) {
      const response = await fetch(origin + "/api/v1/webhooks/razorpay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Razorpay-Signature": signatureValue,
          "X-Razorpay-Event-Id": eventId,
        },
        body,
        signal: AbortSignal.timeout(20_000),
      });
      const payload = JSON.parse(await response.text());
      assert.equal(
        response.status,
        expected,
        `Webhook returned HTTP ${response.status}.`,
      );
      return payload;
    }

    const invalidWebhook = await webhook(
      refundBody,
      webhookEventId,
      "0".repeat(64),
      400,
    );
    assert.equal(invalidWebhook.error?.code, "INVALID_WEBHOOK_SIGNATURE");
    assert.equal(
      (await request(builder, `/orders/${checkout.order.id}`)).data.status,
      "CAPTURED",
    );

    const paymentReadsBeforeRefund = razorpay.counts().paymentRequests;
    const refundResult = await webhook(
      refundBody,
      webhookEventId,
      webhookSignature,
      200,
    );
    assert.equal(refundResult.data.received, true);
    assert.equal(refundResult.data.fullyRefunded, true);
    const duplicateRefund = await webhook(
      refundBody,
      webhookEventId,
      webhookSignature,
      200,
    );
    assert.equal(duplicateRefund.data.duplicate, true);

    const refundedOrder = (
      await request(builder, `/orders/${checkout.order.id}`)
    ).data;
    assert.equal(refundedOrder.status, "REFUNDED");
    assert.equal(refundedOrder.entitlement.status, "REVOKED");
    assert.ok(refundedOrder.refundedAt);
    assert.equal(razorpay.counts().paymentRequests, paymentReadsBeforeRefund + 1);
    pass(
      "signed refund webhook is idempotent and revokes the paid entitlement",
    );

    const outOfOrderCheckout = (
      await request(builder, "/checkouts", {
        method: "POST",
        expected: 201,
        headers: { "Idempotency-Key": `billing-refund-first-${runId}` },
        body: checkoutBody,
      })
    ).data;
    const outOfOrderPaymentId = `pay_refund_first_${randomUUID().replaceAll("-", "").slice(0, 14)}`;
    razorpay.payments.set(outOfOrderPaymentId, {
      id: outOfOrderPaymentId,
      entity: "payment",
      amount: outOfOrderCheckout.order.totalPaise,
      currency: "INR",
      status: "refunded",
      order_id: outOfOrderCheckout.order.providerOrderId,
      captured: true,
      amount_refunded: outOfOrderCheckout.order.totalPaise,
      error_code: null,
      error_description: null,
    });

    const refundFirstEventId = `billing-smoke-refund-first-${runId}`;
    const refundFirstBody = JSON.stringify({
      event: "refund.processed",
      payload: {
        refund: {
          entity: {
            id: `rfnd_first_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
            payment_id: outOfOrderPaymentId,
            amount: outOfOrderCheckout.order.totalPaise,
          },
        },
      },
    });
    const refundFirstSignature = createHmac(
      "sha256",
      process.env.RAZORPAY_WEBHOOK_SECRET,
    )
      .update(refundFirstBody)
      .digest("hex");
    const refundFirstResult = await webhook(
      refundFirstBody,
      refundFirstEventId,
      refundFirstSignature,
      200,
    );
    assert.equal(refundFirstResult.data.fullyRefunded, true);
    const refundFirstDuplicate = await webhook(
      refundFirstBody,
      refundFirstEventId,
      refundFirstSignature,
      200,
    );
    assert.equal(refundFirstDuplicate.data.duplicate, true);

    const delayedCaptureEventId = `billing-smoke-capture-after-refund-${runId}`;
    const delayedCaptureBody = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: outOfOrderPaymentId,
            order_id: outOfOrderCheckout.order.providerOrderId,
          },
        },
      },
    });
    const delayedCaptureSignature = createHmac(
      "sha256",
      process.env.RAZORPAY_WEBHOOK_SECRET,
    )
      .update(delayedCaptureBody)
      .digest("hex");
    const delayedCapture = await webhook(
      delayedCaptureBody,
      delayedCaptureEventId,
      delayedCaptureSignature,
      200,
    );
    assert.equal(delayedCapture.data.received, true);

    const refundFirstOrder = (
      await request(builder, `/orders/${outOfOrderCheckout.order.id}`)
    ).data;
    assert.equal(refundFirstOrder.status, "REFUNDED");
    assert.ok(refundFirstOrder.invoice?.id);
    assert.equal(refundFirstOrder.entitlement?.status, "REVOKED");
    assert.ok(
      refundFirstOrder.statusEvents.some(
        ({ eventType }) => eventType === "payment.captured.reconciled",
      ),
    );
    const refundFirstInvoices = (
      await request(builder, "/invoices?limit=50")
    ).data.items.filter(
      ({ orderId }) => orderId === outOfOrderCheckout.order.id,
    );
    assert.equal(refundFirstInvoices.length, 1);
    assert.equal(refundFirstInvoices[0].id, refundFirstOrder.invoice.id);
    pass(
      "refund-before-capture preserves exactly one invoice and a revoked entitlement",
    );

    await writeReport(startedAt, razorpay);
  } finally {
    if (apiRuntime) {
      await apiRuntime.close();
      await apiRuntime.prisma.$disconnect();
    }
    razorpay.restore();
  }
}

run().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  await mkdir(dirname(resultPath), { recursive: true });
  await writeFile(
    resultPath,
    JSON.stringify(
      { ok: false, schema: verificationSchema, checks, error: message },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  console.error("Billing smoke failed: " + message);
  process.exitCode = 1;
});
