import assert from "node:assert/strict";
import {readFile, writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {resolve} from "node:path";
import {randomUUID} from "node:crypto";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3012");
assert.ok(["127.0.0.1", "localhost"].includes(origin.hostname), "Use a loopback verification website.");
const scanOnly = process.argv.includes("--scan-only");
assert.ok(scanOnly || process.env.SMOKE_ALLOW_MUTATIONS === "true", "Mutation checks require an isolated API and SMOKE_ALLOW_MUTATIONS=true.");
const require = createRequire(resolve(process.env.AUDIT_TOOL_DIR ?? "tmp/audit-tools", "package.json"));
const {chromium} = require("playwright-core");
const axe = require.resolve("axe-core/axe.min.js");
const PDFDocument = createRequire(new URL("../apps/api/package.json", import.meta.url))("pdfkit");
const {accounts} = JSON.parse(await readFile(process.argv[3] ?? "tmp/panel-credentials.audit.json", "utf8"));
const output = process.argv[4] ?? "tmp/public-form-verification.json";
const token = randomUUID().slice(0, 8);
const long = "Synthetic verification details for the isolated Property Pillar workspace and website.";
const phone = "+442079460900";
const future = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
const picture = resolve("apps/web/public/images/daylight/architecture-hero.webp");
const role = (value) => accounts.find((account) => account.role === value);
const report = {origin: origin.origin, run: token, submissions: [], scans: [], auxiliary: [], errors: [], serverFailures: []};
const expectedRoutes = [
  "post-property", "properties/enquire", "properties/save-search", "materials/request-quote", "materials/add-product",
  "professionals/request", "professionals/register", "jobs/post", "jobs/apply", "workers/register", "dealers/register",
  "projects/new", "finance-services/apply", "support/report",
];

const browser = await chromium.launch({executablePath: process.env.AUDIT_CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true});
const form = (page) => page.locator("form[data-public-task]");
const control = (page, name) => form(page).locator(`[name="${name}"]`);

function observe(page) {
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) report.serverFailures.push({path: new URL(response.url()).pathname, status: response.status()});
  });
}

async function signedIn(page, account) {
  await page.waitForURL((url) => url.pathname.endsWith("/login"));
  const next = new URL(page.url()).searchParams.get("next");
  assert.ok(next);
  await page.locator('input[name="email"]').last().fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/api/v1/auth/sign-in") && response.status() === 200),
    page.getByRole("button", {name: "Sign in to workspace", exact: true}).click(),
  ]);
  await page.waitForURL((url) => url.pathname + url.search === next);
  await page.getByText("Your form has been restored. Review your information and submit when ready.").waitFor();
}

async function api(context, path, {method = "GET", data, expected = 200} = {}) {
  const response = await context.request.fetch(new URL("/api/v1" + path, origin).href, {method, data, headers: {Origin: origin.origin}});
  const body = await response.json().catch(() => null);
  assert.equal(response.status(), expected, `${method} ${path} returned ${response.status()} ${JSON.stringify(body?.error)}`);
  return body?.data;
}

async function accountContext(kind) {
  const context = await browser.newContext();
  const {email, password} = role(kind);
  await api(context, "/auth/sign-in", {method: "POST", data: {email, password}});
  return context;
}

async function find(context, collection, id) {
  const workspace = await api(context, "/workspace");
  return workspace.collections.find(({key}) => key === collection)?.items.find(({id: current}) => current === id);
}

async function publish(collection, record, status) {
  const context = await accountContext("ADMIN");
  try {
    assert.equal((await find(context, collection, record.id))?.status, record.status);
    return await api(context, `/workspace/${collection}/${record.id}`, {method: "PATCH", data: {status}});
  } finally {
    await context.close();
  }
}

async function fields(page, values) {
  for (const [name, value] of Object.entries(values)) {
    const field = control(page, name);
    if (typeof value === "boolean") await field.setChecked(value);
    else if (await field.evaluate((element) => element.tagName === "SELECT")) await field.selectOption(String(value));
    else await field.fill(String(value));
  }
}

async function upload(page, key, file, endpoint = "/api/v1/uploads") {
  const [response] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith(endpoint) && response.request().method() === "POST"),
    control(page, key).setInputFiles(file),
  ]);
  assert.equal(response.status(), 201, response.status() === 201 ? undefined : await response.text().catch(() => "Upload failed"));
}

async function city(page, key) {
  await control(page, key).fill("Chandigarh");
  await form(page).getByRole("button", {name: /Chandigarh.*IN/}).first().click();
  await form(page).getByRole("list", {name: /selected/i}).waitFor();
}

async function scanRoutes() {
  for (const [index, path] of expectedRoutes.entries()) {
    const viewport = index % 2 ? {width: 390, height: 844} : {width: 1440, height: 900};
    const page = await browser.newPage({viewport});
    observe(page);
    try {
      const response = await page.goto(new URL("/en/" + path, origin).href);
      assert.equal(response.status(), 200);
      await page.getByRole("button", {name: "Sign in or register", exact: true}).waitFor();
      assert.equal(await form(page).count(), 1);
      assert.equal(await form(page).locator('input[name="title"]').isEditable(), true);
      if (await control(page, "consentAccepted").count()) assert.equal(await control(page, "consentAccepted").isChecked(), false);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      await page.addScriptTag({path: axe});
      const accessibility = await page.evaluate(async () => (await window.axe.run()).violations.map(({id, impact, nodes}) => ({
        rule: id, impact, nodes: nodes.map(({target}) => target),
      })));
      report.scans.push({path, width: viewport.width, overflow, accessibility});
      console.log(`[route] ${path} ${viewport.width}px, ${accessibility.length} axe rule(s)${overflow ? ", overflow" : ""}`);
    } finally {
      await page.close();
    }
  }
}

async function submit({path, locale = "en", collection, account, status: expectedStatus, values, extra, recipient, draft = false, details, label}) {
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  observe(page);
  try {
    if (details) {
      await page.goto(new URL(`/${locale}/${details.route}/${details.id}`, origin).href);
      await page.getByRole("link", {name: details.action, exact: true}).click();
      await page.waitForURL((url) => url.pathname === `/${locale}/${path}`);
    } else {
      await page.goto(new URL(`/${locale}/${path}`, origin).href);
    }
    const actualPath = new URL(page.url()).pathname;
    assert.equal(actualPath, `/${locale}/${path}`);
    await page.getByRole("button", {name: "Sign in or register", exact: true}).waitFor();
    const title = `Audit ${label ?? collection} ${token}`;
    await control(page, "title").fill(title);
    const data = typeof values === "function" ? await values(page) : values;
    const submitButton = draft ? form(page).getByRole("button", {name: "Save draft", exact: true}) : form(page).locator('button[type="submit"]').first();
    let calls = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith("/api/v1/workspace/" + collection)) calls++;
    });
    await submitButton.click();
    await signedIn(page, role(account));
    assert.equal(calls, 0, "Guest click and sign-in must not submit");
    assert.equal(page.url().startsWith(new URL(`/${locale}/${path}`, origin).href), true);
    assert.equal(await control(page, "title").inputValue(), title);
    for (const [name, value] of Object.entries(data?.kept ?? {})) assert.equal(await control(page, name).inputValue(), value);
    await fields(page, data?.fields ?? data ?? {});
    if (extra) await extra(page);
    const [response] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/api/v1/workspace/" + collection)),
      submitButton.click(),
    ]);
    const body = await response.json().catch(() => null);
    assert.equal(response.status(), 201, JSON.stringify(body?.error));
    assert.equal(calls, 1);
    const record = body?.data ?? (await api(context, "/workspace")).collections.find(({key}) => key === collection)?.items.find((item) => item.title === title);
    assert.ok(record, "A successful submission must be persisted");
    assert.equal(record.title, title);
    assert.equal(record.status, expectedStatus);
    await page.getByText(record.id, {exact: true}).waitFor();
    assert.equal((await find(context, collection, record.id))?.title, title);
    if (recipient) {
      const target = await accountContext(recipient);
      try {
        assert.equal((await find(target, collection, record.id))?.status, expectedStatus);
      } finally {
        await target.close();
      }
    }
    if (draft) {
      await page.getByRole("link", {name: "Manage in dashboard"}).click();
      await page.getByText(title, {exact: true}).first().waitFor();
      report.auxiliary.push("Dashboard restored persisted title-only draft");
    }
    report.submissions.push({path: actualPath, collection, account, status: record.status, reference: record.id, recipient, draft});
    console.log(`[submitted] ${actualPath} ${collection} ${record.status}`);
    return record;
  } finally {
    await context.close();
  }
}

async function smoke() {
  const property = await submit({path: "post-property", locale: "hi", collection: "properties", account: "OWNER", status: "PENDING_REVIEW",
    values: {description: long, listingIntent: "SALE", propertyCategory: "RESIDENTIAL", propertyType: "OTHER", propertyTypeOther: "Courtyard residence", countryCode: "GB",
      postalCode: "SW1A 1AA", state: "Greater London", city: "London", locality: "Westminster", price: 250000, currency: "GBP", areaValue: 1200, areaUnit: "SQFT", consentAccepted: true},
    extra: (page) => upload(page, "mediaUrls", picture)});
  await publish("properties", property, "PUBLISHED");
  await submit({path: "post-property", collection: "properties", account: "OWNER", status: "DRAFT", draft: true, label: "draft"});
  await submit({path: "properties/enquire", collection: "propertyInquiries", account: "BUYER", recipient: "OWNER", status: "NEW",
    details: {route: "properties", id: property.id, action: "Enquire about this property"},
    values: async (page) => {assert.equal(await control(page, "propertyId").inputValue(), property.id); return {kept: {propertyId: property.id}, fields: {phone, consentAccepted: true}};}});
  await submit({path: "properties/save-search", collection: "buyerAlerts", account: "BUYER", status: "ACTIVE",
    values: {listingIntent: "SALE", city: "London", localities: "Westminster", minPrice: 100000, maxPrice: 300000, currency: "GBP", frequency: "INSTANT"}});
  await submit({path: "materials/request-quote", collection: "materialRfqs", account: "BUYER", status: "OPEN",
    values: {requesterType: "HOMEOWNER", countryCode: "IN", deliveryAddress: "Synthetic collection point", requiredByDate: future, consentAccepted: true},
    extra: async (page) => {
      await city(page, "cityId");
      await form(page).getByRole("button", {name: "Add material"}).click();
      await form(page).getByRole("button", {name: "Add material"}).click();
      await fields(page, {"items.0.itemName": "Cement", "items.0.category": "CEMENT", "items.0.quantity": 8, "items.0.unit": "BAG",
        "items.1.itemName": "Cement blend", "items.1.category": "CEMENT", "items.1.quantity": 2, "items.1.unit": "BAG"});
    }});
  await submit({path: "materials/add-product", collection: "materialProducts", account: "VENDOR", status: "PENDING_REVIEW",
    values: {description: long, category: "CEMENT", unit: "BAG", specification: "Synthetic catalogue cement", minimumOrderQuantity: 1, availabilityStatus: "IN_STOCK"},
    extra: async (page) => {await city(page, "deliveryCityIds"); await upload(page, "mediaUrls", picture);}});
  const professional = await submit({path: "professionals/register", collection: "serviceProfiles", account: "PROFESSIONAL", status: "PENDING_REVIEW",
    values: {description: long, serviceType: "Architect", city: "London", serviceAreas: "London, Westminster", yearsExperience: 3, phone, consentAccepted: true},
    extra: (page) => upload(page, "portfolioUrls", picture)});
  await publish("serviceProfiles", professional, "PUBLISHED");
  await submit({path: "professionals/request", collection: "serviceInquiries", account: "BUYER", recipient: "PROFESSIONAL", status: "NEW",
    details: {route: "professionals", id: professional.id, action: "Request a service"},
    values: {kept: {serviceProfileId: professional.id}, fields: {phone, message: "Synthetic architecture request", consentAccepted: true}}});
  const job = await submit({path: "jobs/post", collection: "jobs", account: "BUILDER", status: "PENDING_REVIEW",
    values: {description: long, employerName: "Audit Construction", jobType: "Civil engineer", employmentType: "FULL_TIME", workMode: "ON_SITE",
      countryCode: "GB", postalCode: "SW1A 1AA", city: "London", salaryMin: 30000, salaryMax: 45000, currency: "GBP", experienceYears: 3,
      skills: "Drawing, Site supervision", applicationDeadline: future}});
  await publish("jobs", job, "PUBLISHED");
  await submit({path: "jobs/apply", collection: "jobApplications", account: "WHITE_COLLAR_SEEKER", recipient: "BUILDER", status: "SUBMITTED",
    details: {route: "jobs", id: job.id, action: "Apply for this job"},
    values: {kept: {jobId: job.id}, fields: {coverNote: "Synthetic application", consentAccepted: true}},
    extra: async (page) => {
      const document = new PDFDocument();
      const chunks = [];
      document.on("data", (chunk) => chunks.push(chunk));
      const pdf = new Promise((resolvePdf) => document.on("end", () => resolvePdf(Buffer.concat(chunks))));
      document.text("Synthetic resume for verification");
      document.end();
      await upload(page, "resumeUrl", {name: "audit.pdf", mimeType: "application/pdf", buffer: await pdf}, "/api/v1/uploads/resumes");
    }});
  await submit({path: "workers/register", collection: "workerProfiles", account: "BLUE_COLLAR_WORKER", status: "PENDING_REVIEW",
    values: {trade: "MASON", city: "London", dailyRate: 120, currency: "GBP", phone, consentAccepted: true}});
  await submit({path: "dealers/register", collection: "dealerProfiles", account: "DEALER", status: "PENDING_VERIFICATION",
    values: {description: long, agencyName: "Audit Realty", slug: `audit-realty-${token}`, officeAddress: "Synthetic office, Westminster", countryCode: "GB",
      city: "London", citiesServed: "London", phone, consentAccepted: true},
    extra: (page) => upload(page, "coverUrl", picture)});
  const project = await submit({path: "projects/new", collection: "builderProjects", account: "BUILDER", status: "PENDING_REVIEW",
    values: {description: long, projectName: "Audit Courtyard", projectType: "Apartments", city: "London", locality: "Westminster", reraNumber: "AUDIT-001", startingPrice: 250000, currency: "GBP"},
    extra: (page) => upload(page, "mediaUrls", picture)});
  await publish("builderProjects", project, "PUBLISHED");
  await submit({path: "properties/enquire", collection: "propertyInquiries", account: "BUYER", recipient: "BUILDER", status: "NEW", label: "project enquiry",
    details: {route: "projects", id: project.id, action: "Enquire about this project"},
    values: {kept: {projectId: project.id}, fields: {phone, consentAccepted: true}}});
  await submit({path: "finance-services/apply", collection: "loanInquiries", account: "BUYER", status: "NEW",
    values: {loanType: "HOME_LOAN", city: "London", propertyValue: 250000, loanAmount: 200000, monthlyIncome: 4500, currency: "GBP", phone, consentAccepted: true}});
  await submit({path: "support/report", collection: "grievances", account: "BUYER", status: "OPEN",
    values: {category: "LISTING", details: "Synthetic grievance for flow verification."}});
}

try {
  if (!scanOnly) await smoke();
  await scanRoutes();
} catch (error) {
  report.failure = error.message;
  throw error;
} finally {
  await browser.close();
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
}
