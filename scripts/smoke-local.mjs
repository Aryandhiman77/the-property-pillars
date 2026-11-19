import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";

const ROLES = [
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

const EXPECTED_COLLECTIONS = {
  BUYER: ["savedProperties", "buyerAlerts", "propertyInquiries", "materialRfqs", "serviceInquiries", "grievances"],
  OWNER: ["properties", "propertyInquiries", "materialRfqs", "serviceInquiries", "grievances"],
  DEALER: ["properties", "dealerProfiles", "jobs", "grievances"],
  BUILDER: ["properties", "builderProjects", "adCampaigns", "jobs", "jobApplications", "grievances"],
  VENDOR: ["materialProducts", "materialRfqs", "materialQuotes", "grievances"],
  PROFESSIONAL: ["serviceProfiles", "serviceInquiries", "jobs", "grievances"],
  WHITE_COLLAR_SEEKER: ["jobs", "jobApplications", "serviceInquiries", "grievances"],
  BLUE_COLLAR_WORKER: ["workerProfiles", "grievances"],
  ADMIN: [
    "properties", "dealerProfiles", "savedProperties", "buyerAlerts", "propertyInquiries",
    "materialProducts", "materialRfqs", "materialQuotes", "serviceProfiles", "serviceInquiries",
    "jobs", "jobApplications", "workerProfiles", "builderProjects", "adCampaigns",
    "loanInquiries", "grievances",
  ],
};

function validateCredentialDocument(document) {
  if (!document || typeof document !== "object" || !Array.isArray(document.accounts)) {
    throw new Error("Credential document must contain an accounts array.");
  }

  const accounts = document.accounts.map((account, index) => {
    if (!account || typeof account !== "object") throw new Error(`accounts[${index}] must be an object.`);
    for (const field of ["role", "email", "password", "name"]) {
      if (typeof account[field] !== "string" || !account[field].trim()) {
        throw new Error(`accounts[${index}].${field} must be a non-empty string.`);
      }
    }
    if (!ROLES.includes(account.role)) throw new Error(`accounts[${index}].role is not supported.`);
    return {
      role: account.role,
      email: account.email.trim().toLowerCase(),
      password: account.password,
      name: account.name.trim(),
    };
  });

  const roleSet = new Set(accounts.map(({role}) => role));
  const emailSet = new Set(accounts.map(({email}) => email));
  assert.equal(accounts.length, ROLES.length, "Credential document must contain exactly nine accounts.");
  assert.equal(roleSet.size, ROLES.length, "Credential document must contain each role exactly once.");
  assert.equal(emailSet.size, accounts.length, "Credential account emails must be unique.");
  for (const role of ROLES) assert.ok(roleSet.has(role), "Missing credential for role " + role);

  return {
    accounts,
    origin: typeof document.origin === "string" ? document.origin : undefined,
  };
}

function normalizeOrigin(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Smoke origin must use HTTP or HTTPS.");
  const loopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
  if (!loopback) throw new Error("Smoke runner only accepts a loopback verification API.");
  return url.origin;
}

function createBrowser(cookie = "") {
  return {cookie};
}

function cookieFromResponse(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  return values.length ? values[0].split(";", 1)[0] : undefined;
}

function tamperCookie(cookie) {
  const separator = cookie.indexOf("=");
  assert.ok(separator > 0 && separator < cookie.length - 1, "Authentication cookie is malformed.");
  const name = cookie.slice(0, separator);
  const value = cookie.slice(separator + 1);
  const last = value.at(-1);
  return `${name}=${value.slice(0, -1)}${last === "a" ? "b" : "a"}`;
}

function cookieName(cookie) {
  const separator = cookie.indexOf("=");
  assert.ok(separator > 0, "Authentication cookie name is unavailable.");
  return cookie.slice(0, separator);
}

const requestedOrigin = process.argv[2];
const credentialsPath = resolve(process.argv[3] ?? "tmp/panel-credentials.verify.json");
const outputPath = resolve(process.argv[4] ?? "tmp/smoke-local-result.json");
const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const startedAt = new Date();
const checks = [];

async function writeResult(result) {
  await mkdir(dirname(outputPath), {recursive: true});
  await writeFile(outputPath, JSON.stringify(result, null, 2) + "\n", "utf8");
}

function passed(label) {
  checks.push(label);
  console.log("[pass] " + label);
}

let origin;
let accountsByRole;

async function api(browser, path, {method = "GET", body, expected = 200, contentType, headers} = {}) {
  const expectedStatuses = Array.isArray(expected) ? expected : [expected];
  const binary = Buffer.isBuffer(body);
  const response = await fetch(origin + "/api/v1" + path, {
    method,
    headers: {
      Origin: origin,
      ...(browser?.cookie ? {Cookie: browser.cookie} : {}),
      ...(body === undefined ? {} : {"Content-Type": contentType ?? (binary ? "application/octet-stream" : "application/json")}),
      ...headers,
    },
    body: body === undefined || binary ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const raw = await response.text();
  let payload;

  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error(`${method} ${path} returned non-JSON HTTP ${response.status}.`);
  }

  if (!expectedStatuses.includes(response.status)) {
    const code = payload?.error?.code ? ` ${payload.error.code}` : "";
    throw new Error(`${method} ${path} expected ${expectedStatuses.join("/")} but received ${response.status}${code}.`);
  }

  const responseCookie = cookieFromResponse(response);
  if (browser && responseCookie !== undefined) browser.cookie = responseCookie;
  return {status: response.status, data: payload.data, error: payload.error, meta: payload.meta};
}

async function signIn(role, browser = createBrowser()) {
  const account = accountsByRole.get(role);
  const {data} = await api(browser, "/auth/sign-in", {
    method: "POST",
    body: {email: account.email, password: account.password},
  });
  assert.equal(data.role, role, "Sign-in returned the wrong active role.");
  assert.notEqual(data.demo, true, "Real credential sign-in must never return a demo session.");
  assert.ok(browser.cookie, "Sign-in did not issue an authentication cookie.");
  return browser;
}

async function workspace(browser) {
  return (await api(browser, "/workspace")).data;
}

async function list(browser, collection) {
  const result = await workspace(browser);
  const resource = result.collections.find((candidate) => candidate.key === collection);
  assert.ok(resource, `${result.role} cannot see required collection ${collection}.`);
  return resource.items;
}

async function findItem(browser, collection, id) {
  const item = (await list(browser, collection)).find((candidate) => candidate.id === id);
  assert.ok(item, `${collection}/${id} was not visible in the expected private scope.`);
  return item;
}

async function create(browser, collection, title, data = {}, description) {
  return (await api(browser, "/workspace/" + collection, {
    method: "POST",
    body: {title, data, ...(description === undefined ? {} : {description})},
    expected: 201,
  })).data;
}

async function patch(browser, collection, id, body, expected = 200) {
  return (await api(browser, `/workspace/${collection}/${id}`, {
    method: "PATCH",
    body,
    expected,
  })).data;
}

async function transition(browser, collection, item, status, extra = {}, expected = 200) {
  return patch(browser, collection, item.id, {status, ...extra}, expected);
}

async function publicList(alias, browser) {
  return (await api(browser, "/public/" + alias)).data;
}

async function ensureReviewedProfile({
  owner,
  admin,
  collection,
  publicAlias,
  title,
  description,
  data,
  submitStatus,
  publishedStatus,
}) {
  let item = (await list(owner, collection)).find(({status}) => status !== "ARCHIVED");
  if (!item) item = await create(owner, collection, title, data, description);

  if (item.status === publishedStatus) {
    assert.ok((await publicList(publicAlias)).some(({id}) => id === item.id), `${collection} was not publicly projected.`);
    return item;
  }

  if (item.canEditContent) {
    item = await patch(owner, collection, item.id, {title, description, data});
  }
  if (item.allowedNextStatuses?.includes(publishedStatus)) {
    item = await transition(owner, collection, item, publishedStatus);
  } else if (item.allowedNextStatuses?.includes(submitStatus)) {
    item = await transition(owner, collection, item, submitStatus);
  }

  if (item.status !== publishedStatus) {
    item = await findItem(admin, collection, item.id);
    assert.ok(item.allowedNextStatuses?.includes(publishedStatus), `${collection} cannot reach ${publishedStatus} from ${item.status}.`);
    item = await transition(admin, collection, item, publishedStatus, {
      reviewNote: `Smoke verification ${runId}: required profile fields reviewed.`,
    });
  }

  assert.ok((await publicList(publicAlias)).some(({id}) => id === item.id), `${collection} was not publicly projected.`);
  return item;
}

async function main() {
  const credentialDocument = validateCredentialDocument(JSON.parse(await readFile(credentialsPath, "utf8")));
  origin = normalizeOrigin(requestedOrigin ?? credentialDocument.origin ?? "http://127.0.0.1:4001");
  accountsByRole = new Map(credentialDocument.accounts.map((account) => [account.role, account]));

  console.log("[smoke] target=" + origin);
  console.log("[smoke] roles=" + ROLES.length);
  console.log("[smoke] result=" + outputPath);

  if (process.env.SMOKE_ALLOW_MUTATIONS !== "true") {
    throw new Error("Mutation smoke is locked. Set SMOKE_ALLOW_MUTATIONS=true only after selecting a disposable verification database.");
  }

  await api(undefined, "/health");
  await api(undefined, "/health/ready");
  await api(undefined, "/workspace", {expected: 401});
  await api(undefined, "/auth/session", {expected: 401});

  const buyerAccount = accountsByRole.get("BUYER");
  const incorrectPassword = "incorrect-smoke-" + randomUUID();
  assert.notEqual(incorrectPassword, buyerAccount.password);
  const wrongCredentials = await api(createBrowser(), "/auth/sign-in", {
    method: "POST",
    body: {email: buyerAccount.email, password: incorrectPassword},
    expected: 401,
  });
  assert.equal(wrongCredentials.error?.code, "INVALID_CREDENTIALS");

  const cookieProbe = await signIn("BUYER");
  const validCookie = cookieProbe.cookie;
  const sessionCookieName = cookieName(validCookie);
  await api(createBrowser(`${sessionCookieName}=not-a-valid-token-${runId}`), "/auth/session", {expected: 401});
  await api(createBrowser(tamperCookie(validCookie)), "/auth/session", {expected: 401});

  const rejectedAdminSignup = await api(createBrowser(), "/auth/register", {
    method: "POST",
    body: {
      fullName: "Rejected Smoke Admin",
      email: `rejected-admin-${runId}@example.invalid`,
      password: `Smoke-only-${runId}-password`,
      role: "ADMIN",
    },
    expected: 400,
  });
  assert.equal(rejectedAdminSignup.error?.code, "VALIDATION_ERROR");

  const oldCookie = cookieProbe.cookie;
  const loggedOut = await api(cookieProbe, "/auth/logout", {method: "POST", body: {}});
  assert.equal(loggedOut.data.loggedOut, true);
  await api(cookieProbe, "/auth/session", {expected: 401});
  await api(createBrowser(oldCookie), "/auth/session", {expected: 401});
  passed("credential rejection, missing/fake/tampered cookies, admin signup rejection and logout revocation");

  const actors = new Map();
  for (const role of ROLES) {
    const browser = await signIn(role);
    const session = (await api(browser, "/auth/session")).data;
    assert.equal(session.role, role);
    assert.notEqual(session.demo, true);
    const privateWorkspace = await workspace(browser);
    assert.equal(privateWorkspace.role, role);
    const visibleKeys = new Set(privateWorkspace.collections.map(({key}) => key));
    for (const required of EXPECTED_COLLECTIONS[role]) {
      assert.ok(visibleKeys.has(required), `${role} is missing private collection ${required}.`);
    }
    actors.set(role, browser);
  }
  assert.ok(!(await workspace(actors.get("BUYER"))).collections.some(({key}) => key === "properties"));
  passed("all nine real accounts authenticated with their private role scopes");

  const buyer = actors.get("BUYER");
  const owner = actors.get("OWNER");
  const dealer = actors.get("DEALER");
  const builder = actors.get("BUILDER");
  const vendor = actors.get("VENDOR");
  const professional = actors.get("PROFESSIONAL");
  const seeker = actors.get("WHITE_COLLAR_SEEKER");
  const workerAccount = actors.get("BLUE_COLLAR_WORKER");
  const admin = actors.get("ADMIN");
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000).toISOString().slice(0, 10);
  const campaignStart = new Date(Date.now() + 10 * 60 * 1_000).toISOString();
  const campaignEnd = new Date(Date.now() + 8 * 24 * 60 * 60 * 1_000).toISOString();
  async function uploadPhoto(actor, name, purpose) {
    const body = await readFile(new URL(`../apps/web/public/images/daylight/${name}`, import.meta.url));
    const {data} = await api(actor, "/uploads", {method: "POST", body, contentType: "image/webp", headers: {"X-Upload-Purpose": purpose}, expected: 201});
    const photo = await fetch(origin + data.url, {headers: {Cookie: actor.cookie}, signal: AbortSignal.timeout(20_000)});
    assert.equal(photo.status, 200);
    assert.equal(photo.headers.get("content-type"), "image/webp");
    await photo.arrayBuffer();
    return data.url;
  }
  const imageUrl = await uploadPhoto(owner, "architecture-hero.webp", "properties:mediaUrls");
  const projectImageUrl = await uploadPhoto(builder, "banners/projects.webp", "builderProjects:mediaUrls");
  const productImageUrl = await uploadPhoto(vendor, "banners/materials.webp", "materialProducts:mediaUrls");
  const dealerImageUrl = await uploadPhoto(dealer, "banners/dealers.webp", "dealerProfiles:coverUrl");
  const portfolioImageUrl = await uploadPhoto(professional, "banners/professionals.webp", "serviceProfiles:portfolioUrls");
  await api(undefined, imageUrl.slice("/api/v1".length), {expected: 404});
  const wrongOwner = await api(builder, "/workspace/properties", {method: "POST", body: {title: "Scope verification", data: {mediaUrls: [imageUrl]}}, expected: 422});
  assert.ok(wrongOwner.error.details.mediaUrls);
  const wrongPurpose = await api(builder, "/workspace/properties", {method: "POST", body: {title: "Purpose verification", data: {mediaUrls: [projectImageUrl]}}, expected: 422});
  assert.ok(wrongPurpose.error.details.mediaUrls);

  const draft = await create(owner, "properties", `Smoke title-only draft ${runId}`, {price: 5_000_000, areaValue: 750});
  const clearedDraft = (await api(owner, `/workspace/properties/${draft.id}`, {method: "PATCH", body: {data: {price: null, areaValue: null}}})).data;
  assert.equal(clearedDraft.data.price, undefined);
  assert.equal(clearedDraft.data.areaValue, undefined);
  const incompleteListing = await api(owner, `/workspace/properties/${draft.id}`, {method: "PATCH", body: {status: "PENDING_REVIEW"}, expected: 422});
  assert.ok(incompleteListing.error?.details?.postalCode?.length);
  const missingRequest = await api(buyer, "/workspace/loanInquiries", {method: "POST", body: {title: "Incomplete inquiry", data: {}}, expected: 422});
  assert.ok(missingRequest.error?.details?.phone?.length && missingRequest.error.details.loanAmount?.length);
  passed("incomplete property drafts save, cleared values stay cleared, and review and immediate submissions return field-level issues");

  const property = await create(owner, "properties", `Smoke apartment ${runId}`, {
    city: "Panchkula",
    state: "Haryana",
    postalCode: "134109",
    addressLine: "Private verification address",
    locality: "Sector 20",
    listingIntent: "SALE",
    propertyCategory: "RESIDENTIAL",
    propertyType: "APARTMENT",
    price: 9_000_000,
    currency: "INR",
    areaValue: 1_300,
    areaUnit: "SQFT",
    mediaUrls: [imageUrl],
    consentAccepted: true,
    reraApplicable: "NO",
  }, "Disposable verification listing used to test submission, correction, moderation and publication workflows.");
  await transition(owner, "properties", property, "PUBLISHED", {}, 409);
  let ownerProperty = await transition(owner, "properties", property, "PENDING_REVIEW");
  await patch(owner, "properties", property.id, {status: "PENDING_REVIEW", reviewNote: "Owner cannot moderate."}, 403);
  assert.ok(!(await publicList("properties")).some(({id}) => id === property.id));

  let adminProperty = await findItem(admin, "properties", property.id);
  await transition(admin, "properties", adminProperty, "CHANGES_REQUESTED", {}, 422);
  const correctionNote = `Smoke ${runId}: replace the unclear verification image before approval.`;
  await transition(admin, "properties", adminProperty, "CHANGES_REQUESTED", {reviewNote: correctionNote});
  const history = (await api(admin, `/workspace/properties/${property.id}/history`)).data;
  assert.equal(history.events[0].note, correctionNote);
  await api(owner, `/workspace/properties/${property.id}/history`, {expected: 403});

  ownerProperty = await findItem(owner, "properties", property.id);
  assert.equal(ownerProperty.latestReview?.note, correctionNote);
  assert.equal(ownerProperty.data.postalCode, "134109");
  assert.equal(ownerProperty.data.state, "Haryana");
  ownerProperty = await patch(owner, "properties", property.id, {
    status: "PENDING_REVIEW",
    description: "Corrected disposable verification listing with a clear image and complete ownership review details.",
  });
  adminProperty = await findItem(admin, "properties", ownerProperty.id);
  await transition(admin, "properties", adminProperty, "PUBLISHED", {
    reviewNote: `Smoke ${runId}: correction verified and listing approved.`,
  });
  const publishedProperty = (await publicList("properties")).find(({id}) => id === property.id);
  assert.ok(publishedProperty);
  assert.equal(publishedProperty.data.postalCode, undefined);
  assert.equal(publishedProperty.data.addressLine, undefined);
  const publicPhoto = await fetch(origin + imageUrl, {signal: AbortSignal.timeout(20_000)});
  assert.equal(publicPhoto.status, 200);
  assert.equal(publicPhoto.headers.get("cache-control"), "no-store");
  await publicPhoto.arrayBuffer();
  passed("image preview, ownership, purpose and publication access");

  const savedProperty = await create(buyer, "savedProperties", `Saved smoke property ${runId}`, {propertyId: property.id});
  await patch(buyer, "savedProperties", savedProperty.id, {data: {propertyId: "different-parent"}}, 409);
  const inquiry = await create(buyer, "propertyInquiries", `Smoke property inquiry ${runId}`, {
    propertyId: property.id,
    inquiryType: "CALLBACK",
    phone: "+919000000001",
    consentAccepted: true,
  });
  const ownerInquiry = await findItem(owner, "propertyInquiries", inquiry.id);
  await transition(owner, "propertyInquiries", ownerInquiry, "CONTACTED");
  const alert = await create(buyer, "buyerAlerts", `Smoke buyer alert ${runId}`, {
    listingIntent: "SALE", city: "Panchkula", localities: ["Sector 20"], minPrice: 8_000_000, maxPrice: 10_000_000,
    currency: "INR", frequency: "DAILY_DIGEST",
  });
  await transition(buyer, "buyerAlerts", alert, "PAUSED");
  await transition(buyer, "buyerAlerts", await findItem(buyer, "buyerAlerts", alert.id), "ACTIVE");
  const loan = await create(buyer, "loanInquiries", `Smoke home loan ${runId}`, {
    loanType: "HOME_LOAN", city: "Panchkula", propertyValue: 9_000_000, loanAmount: 6_000_000, monthlyIncome: 110_000, currency: "INR", phone: "+919000000001", consentAccepted: true,
  });
  await patch(admin, "loanInquiries", loan.id, {status: "ROUTED"}, 409);
  await transition(admin, "loanInquiries", await findItem(admin, "loanInquiries", loan.id), "CONTACTED");
  passed("owner moderation note, correction/resubmission/publication and buyer saved/inquiry workflow");

  const dealerProfile = await ensureReviewedProfile({
    owner: dealer,
    admin,
    collection: "dealerProfiles",
    publicAlias: "dealers",
    title: `Smoke dealer ${runId}`,
    description: "Disposable dealer verification profile containing the required office, service area and consent fields.",
    data: {
      agencyName: `Smoke Realty ${runId}`,
      slug: `smoke-realty-${runId.toLowerCase()}`.slice(0, 100),
      reraNumber: `SMOKE-DEALER-${runId}`.slice(0, 120),
      officeAddress: "Verification office, Chandigarh",
      city: "Chandigarh",
      state: "Chandigarh",
      postalCode: "160017",
      citiesServed: ["Chandigarh", "Panchkula"],
      coverUrl: dealerImageUrl,
      phone: "+919000000002",
      consentAccepted: true,
      publicContactConsent: false,
    },
    submitStatus: "PENDING_VERIFICATION",
    publishedStatus: "VERIFIED",
  });
  assert.equal(dealerProfile.status, "VERIFIED");
  await patch(dealer, "dealerProfiles", dealerProfile.id, {data: {publicContactConsent: true}});
  assert.ok((await publicList("dealers")).find(({id}) => id === dealerProfile.id)?.data.phone);
  await patch(dealer, "dealerProfiles", dealerProfile.id, {data: {publicContactConsent: false}});
  assert.equal((await publicList("dealers")).find(({id}) => id === dealerProfile.id)?.data.phone, undefined);
  passed("dealer verification and contact visibility changes after verification");

  const project = await create(builder, "builderProjects", `Smoke builder project ${runId}`, {
    projectName: `Smoke Project ${runId}`,
    projectType: "RESIDENTIAL",
    city: "Mohali",
    locality: "Airport Road",
    reraNumber: `SMOKE-PROJECT-${runId}`.slice(0, 120),
    startingPrice: 8_900_000,
    currency: "INR",
    mediaUrls: [projectImageUrl],
  }, "Disposable builder project used to verify project review, publication and advertising campaign permissions.");
  await transition(builder, "builderProjects", project, "PENDING_REVIEW");
  let adminProject = await findItem(admin, "builderProjects", project.id);
  adminProject = await transition(admin, "builderProjects", adminProject, "APPROVED", {
    reviewNote: `Smoke ${runId}: project fields reviewed.`,
  });
  assert.equal((await findItem(builder, "builderProjects", project.id)).status, "APPROVED");

  const campaign = await create(builder, "adCampaigns", `Smoke ad campaign ${runId}`, {
    projectId: project.id,
    placement: "SEARCH_FEED",
    targetCities: ["Mohali", "Chandigarh"],
    budgetMin: 7_000_000,
    budgetMax: 14_000_000,
    startsAt: campaignStart,
    endsAt: campaignEnd,
    destinationUrl: origin + "/en/projects",
  }, "Disposable campaign used to verify project ownership, review and activation requirements.");
  await transition(builder, "adCampaigns", campaign, "PENDING_REVIEW");
  let adminCampaign = await findItem(admin, "adCampaigns", campaign.id);
  adminCampaign = await transition(admin, "adCampaigns", adminCampaign, "APPROVED");
  await transition(admin, "adCampaigns", adminCampaign, "ACTIVE", {}, 409);
  await transition(admin, "builderProjects", adminProject, "PUBLISHED");
  const unpaidCampaignActivation = await api(admin, `/workspace/adCampaigns/${adminCampaign.id}`, {
    method: "PATCH",
    body: {status: "ACTIVE"},
    expected: 409,
  });
  assert.match(unpaidCampaignActivation.error?.message ?? "", /active paid ad package/i);
  assert.ok((await publicList("projects")).some(({id}) => id === project.id));
  assert.ok(!(await publicList("ads")).some(({id}) => id === campaign.id));
  passed("builder project publication and rejection of ad activation without a paid package");

  const {data: cityMatches} = await api(null, "/locations/delivery-cities?country=IN&q=Chandigarh");
  const deliveryCity = cityMatches.find(({name}) => name === "Chandigarh");
  assert.ok(deliveryCity);
  const {data: otherCities} = await api(null, "/locations/delivery-cities?country=IN&q=Panchkula");
  const otherCity = otherCities.find(({name}) => name === "Panchkula");
  assert.ok(otherCity);
  const product = await create(vendor, "materialProducts", `Smoke Portland cement ${runId}`, {
    category: "Cement", brand: "Sample building materials", variant: "OPC 53", specification: "General purpose 50 kg bags",
    unit: "bags", indicativePrice: 374, currency: "INR", minimumOrderQuantity: 10, priceIncludesTax: true,
    availabilityStatus: "IN_STOCK", deliveryCityIds: [deliveryCity.id, deliveryCity.id], mediaUrls: [productImageUrl],
  }, "Disposable cement product used to verify local photo upload, publication and supplier matching.");
  await patch(vendor, "materialProducts", product.id, {data: {unit: "Unknown unit"}}, 422);
  await patch(vendor, "materialProducts", product.id, {data: {deliveryCityIds: ["999999999999"]}}, 422);
  await transition(vendor, "materialProducts", product, "PENDING_REVIEW");
  await transition(admin, "materialProducts", await findItem(admin, "materialProducts", product.id), "PUBLISHED");
  const {data: materials} = await api(null, `/public/materials?category=cement&cityId=${deliveryCity.id}&limit=100`);
  const publishedMaterial = materials.find(({id}) => id === product.id);
  assert.equal(publishedMaterial?.data.unit, "BAG");
  assert.deepEqual(publishedMaterial.data.deliveryCityIds, [deliveryCity.id]);
  assert.deepEqual(publishedMaterial.data.mediaUrls, [productImageUrl]);
  const {data: wrongCityProducts} = await api(null, `/public/materials?category=cement&cityId=${otherCity.id}`);
  assert.ok(!wrongCityProducts.some(({id}) => id === product.id));

  const rfqDetails = {
    requesterType: "HOMEOWNER",
    countryCode: "IN",
    cityId: deliveryCity.id,
    postalCode: "160017",
    deliveryAddress: "Disposable verification delivery location",
    requiredByDate: nextWeek,
    items: [{category: "Cement", itemName: "Verification cement", quantity: 25, unit: "BAG"}],
    consentAccepted: true,
  };
  const rfq = await create(buyer, "materialRfqs", `Smoke material RFQ ${runId}`, rfqDetails);
  const nonMatching = await create(buyer, "materialRfqs", `Smoke nonmatching RFQ ${runId}`, {...rfqDetails, cityId: otherCity.id,
    items: [{category: "Tiles", itemName: "Verification tiling", quantity: 15, unit: "SQFT"}],
  });
  await transition(buyer, "materialRfqs", nonMatching, "OPEN");
  assert.ok(!(await list(vendor, "materialRfqs")).some(({id}) => id === nonMatching.id));
  await api(vendor, "/workspace/materialQuotes", {method: "POST", body: {title: "Unmatched quote", data: {rfqId: nonMatching.id}}, expected: 409});
  await transition(buyer, "materialRfqs", rfq, "OPEN");
  const vendorRfq = await findItem(vendor, "materialRfqs", rfq.id);
  assert.equal(vendorRfq.data.postalCode, undefined);
  assert.equal(vendorRfq.data.deliveryAddress, undefined);
  const quote = await create(vendor, "materialQuotes", `Smoke material quote ${runId}`, {
    rfqId: rfq.id,
    currency: "INR",
    items: [{itemName: "Verification cement", quantity: 25, unit: "BAG", unitPrice: 374}],
    pricesIncludeTax: true,
    taxRate: 18,
    deliveryCharge: 0,
    deliveryLeadTimeDays: 3,
    validUntil: nextWeek,
    paymentTerms: "Payment on delivery",
  });
  await transition(vendor, "materialQuotes", quote, "SUBMITTED");
  const buyerQuote = await findItem(buyer, "materialQuotes", quote.id);
  await transition(buyer, "materialQuotes", buyerQuote, "ACCEPTED");
  assert.equal((await findItem(buyer, "materialRfqs", rfq.id)).status, "VENDOR_SELECTED");
  passed("local product photos, fixed categories and units, city filter, matched RFQ and quote acceptance");

  const professionalProfile = await ensureReviewedProfile({
    owner: professional,
    admin,
    collection: "serviceProfiles",
    publicAlias: "professionals",
    title: `Smoke architect ${runId}`,
    description: "Disposable professional profile used to verify required service fields, moderation and inquiry routing.",
    data: {
      serviceType: "ARCHITECT",
      city: "Chandigarh",
      serviceAreas: ["Chandigarh", "Mohali"],
      portfolioUrls: [portfolioImageUrl],
      yearsExperience: 8,
      phone: "+919000000003",
      consentAccepted: true,
      publicContactConsent: false,
    },
    submitStatus: "PENDING_REVIEW",
    publishedStatus: "PUBLISHED",
  });
  const serviceInquiry = await create(buyer, "serviceInquiries", `Smoke service inquiry ${runId}`, {
    serviceProfileId: professionalProfile.id,
    serviceType: "ARCHITECT",
    city: "Chandigarh",
    phone: "+919000000001",
    message: "Disposable verification inquiry.",
    consentAccepted: true,
  });
  await transition(professional, "serviceInquiries", await findItem(professional, "serviceInquiries", serviceInquiry.id), "CONTACTED");
  passed("professional profile publication and routed service inquiry");

  const job = await create(builder, "jobs", `Smoke site engineer ${runId}`, {
    employerName: `Smoke Builder ${runId}`,
    jobType: "Civil site engineer",
    employmentType: "FULL_TIME",
    workMode: "ON_SITE",
    postalCode: "160017",
    salaryMin: 40_000,
    salaryMax: 60_000,
    currency: "INR",
    experienceYears: 2,
    skills: ["Site coordination"],
    responsibilities: ["Coordinate daily site activity"],
    qualifications: ["Degree or diploma in civil engineering"],
    benefits: ["Travel allowance"],
    applicationDeadline: nextWeek,
  }, "Disposable site-engineer opening used to verify review, publication, application and shortlisting workflows.");
  await transition(builder, "jobs", job, "PENDING_REVIEW");
  await transition(admin, "jobs", await findItem(admin, "jobs", job.id), "PUBLISHED", {
    reviewNote: `Smoke ${runId}: job reviewed.`,
  });
  await api(seeker, "/uploads/resumes", {method: "POST", body: Buffer.alloc(10 * 1024 * 1024 + 1), expected: 413});
  const PDFDocument = createRequire(new URL("../apps/api/package.json", import.meta.url))("pdfkit");
  const résumé = new PDFDocument();
  const chunks = [];
  résumé.on("data", (chunk) => chunks.push(chunk));
  const pdf = new Promise((resolve, reject) => {
    résumé.on("end", () => resolve(Buffer.concat(chunks)));
    résumé.on("error", reject);
  });
  résumé.text("Disposable verification resume.");
  résumé.end();
  const {data: upload} = await api(seeker, "/uploads/resumes", {method: "POST", body: await pdf, expected: 201});
  const application = await create(seeker, "jobApplications", `Smoke job application ${runId}`, {
    jobId: job.id,
    resumeUrl: upload.url,
    coverNote: "Disposable verification application.",
    consentAccepted: true,
  });
  await transition(builder, "jobApplications", await findItem(builder, "jobApplications", application.id), "SHORTLISTED");
  const download = await fetch(origin + upload.url, {headers: {Cookie: builder.cookie}, signal: AbortSignal.timeout(20_000)});
  assert.equal(download.status, 200);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), await pdf);
  await api(buyer, upload.url.slice("/api/v1".length), {expected: 404});
  passed("private résumé upload limit and employer download scope");
  const {data: inbox} = await api(seeker, "/workspace/notifications?unread=1");
  assert.ok(inbox.entries.length <= 10);
  const shortlist = inbox.entries.find((entry) => entry.itemId === application.id && entry.status === "SHORTLISTED");
  assert.ok(shortlist, "Candidate sees the employer's shortlisting notification.");
  await api(buyer, "/workspace/notifications/" + shortlist.id + "/read", {method: "PATCH", expected: 404});
  const {data: read} = await api(seeker, "/workspace/notifications/" + shortlist.id + "/read", {method: "PATCH"});
  const {data: unreadAfter} = await api(seeker, "/workspace/notifications?unread=1");
  assert.ok(unreadAfter.entries.every(({id}) => id !== shortlist.id));
  const {data: notificationHistory} = await api(seeker, "/workspace/notifications");
  assert.equal(notificationHistory.entries.find(({id}) => id === shortlist.id)?.readAt, read.readAt);
  passed("notification read state, unread cap and cross-account protection");
  passed("builder job publication and white-collar application shortlisting");

  let worker = (await list(workerAccount, "workerProfiles")).find(({status}) => status !== "ARCHIVED");
  if (!worker) {
    worker = await create(workerAccount, "workerProfiles", `Smoke electrician ${runId}`, {
      trade: "ELECTRICIAN",
      city: "Panchkula",
      dailyRate: 1_200,
      currency: "INR",
      phone: "+919000000004",
      consentAccepted: true,
      publicContactConsent: false,
      availableNow: true,
      yearsExperience: 6,
    });
  }
  if (worker.canEditContent) {
    worker = await patch(workerAccount, "workerProfiles", worker.id, {
      title: `Smoke electrician ${runId}`,
      data: {
        trade: "ELECTRICIAN",
        city: "Panchkula",
        dailyRate: 1_200,
        currency: "INR",
        phone: "+919000000004",
        consentAccepted: true,
        publicContactConsent: false,
        availableNow: true,
        yearsExperience: 6,
      },
    });
  }
  if (worker.allowedNextStatuses?.includes("PENDING_REVIEW")) {
    worker = await transition(workerAccount, "workerProfiles", worker, "PENDING_REVIEW");
  }
  if (worker.status === "PENDING_REVIEW") {
    worker = await transition(admin, "workerProfiles", await findItem(admin, "workerProfiles", worker.id), "AVAILABLE");
  } else if (worker.status === "BUSY") {
    worker = await transition(workerAccount, "workerProfiles", worker, "AVAILABLE");
  }
  assert.equal(worker.status, "AVAILABLE");
  worker = await transition(workerAccount, "workerProfiles", worker, "BUSY");
  assert.equal((await publicList("workers")).find(({id}) => id === worker.id)?.data.availableNow, false);
  await transition(workerAccount, "workerProfiles", worker, "AVAILABLE");
  passed("worker profile review and availability toggling");

  const grievance = await create(buyer, "grievances", `Smoke grievance ${runId}`, {
    category: "LISTING",
    relatedItemId: property.id,
    details: "Disposable grievance used to verify administrator and requester state transitions.",
    email: buyerAccount.email,
  });
  let adminGrievance = await findItem(admin, "grievances", grievance.id);
  adminGrievance = await transition(admin, "grievances", adminGrievance, "ACKNOWLEDGED");
  adminGrievance = await transition(admin, "grievances", adminGrievance, "IN_PROGRESS");
  await transition(admin, "grievances", adminGrievance, "WAITING_USER");
  let buyerGrievance = await findItem(buyer, "grievances", grievance.id);
  buyerGrievance = await transition(buyer, "grievances", buyerGrievance, "IN_PROGRESS");
  adminGrievance = await transition(admin, "grievances", await findItem(admin, "grievances", grievance.id), "RESOLVED");
  await transition(buyer, "grievances", await findItem(buyer, "grievances", grievance.id), "CLOSED");
  await api(admin, "/workspace/properties", {method: "POST", body: {title: "Admin cannot create a property"}, expected: 403});
  passed("grievance resolution and administrator permission boundaries");

  return {
    created: {
      propertyId: property.id,
      projectId: project.id,
      campaignId: campaign.id,
      materialProductId: product.id,
      savedPropertyId: savedProperty.id,
      propertyInquiryId: inquiry.id,
      buyerAlertId: alert.id,
      loanInquiryId: loan.id,
      dealerProfileId: dealerProfile.id,
      serviceInquiryId: serviceInquiry.id,
      jobApplicationId: application.id,
      rfqId: rfq.id,
      quoteId: quote.id,
      professionalProfileId: professionalProfile.id,
      jobId: job.id,
      workerProfileId: worker.id,
      grievanceId: grievance.id,
    },
  };
}

try {
  const result = await main();
  const finishedAt = new Date();
  await writeResult({
    ok: true,
    runId,
    origin,
    roles: ROLES,
    checks,
    created: result.created ?? {},
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  });
  console.log(`[smoke] PASS run=${runId} checks=${checks.length}`);
} catch (error) {
  const finishedAt = new Date();
  const message = error instanceof Error ? error.message : "Unknown smoke failure";
  try {
    await writeResult({
      ok: false,
      runId,
      origin,
      roles: ROLES,
      checks,
      error: {message},
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    });
  } catch (writeError) {
    console.error("[smoke] could not write result: " + (writeError instanceof Error ? writeError.message : "unknown error"));
  }
  console.error("[smoke] FAIL " + message);
  process.exitCode = 1;
}
