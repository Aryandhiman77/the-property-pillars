const {spawnSync} = require("node:child_process");
const {createHmac, randomBytes} = require("node:crypto");
const {existsSync, readFileSync} = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const {parseEnv} = require("node:util");

const root = path.resolve(__dirname, "..");
const api = path.join(root, "apps", "api");
const host = "127.0.0.1";
const webPort = process.env.UAT_WEB_PORT || "3000";
const apiPort = 4021;
const webOrigins = [host, "localhost"].map((hostname) => `http://${hostname}:${webPort}`);
const schema = "manual_uat_workspace";
const accountFile = "panel-credentials.manual-uat.json";
const cookieName = "tpp_manual_uat_session";
const modeCookie = "tpp_uat_mode";
const cookieOptions = "; Path=/; HttpOnly; SameSite=Lax";
const panels = [
  ["ADMIN", "Admin", "Review, return for changes, and publish records."],
  ["BUYER", "Buyer", "Browse homes, list property and handle enquiries."],
  ["DEALER", "Dealer", "Submit an agency profile and manage property listings."],
  ["BUILDER", "Builder", "Submit projects and jobs and review applications."],
  ["VENDOR", "Material Vendor", "Publish products and answer matched requests."],
  ["PROFESSIONAL", "Professional", "Submit a profile and respond to enquiries."],
  ["WHITE_COLLAR_SEEKER", "Job seeker / skilled worker", "Apply to jobs, manage your trade profile and update availability."],
];

function readEnv(filename) {
  return existsSync(filename) ? parseEnv(readFileSync(filename, "utf8")) : {};
}

function prepare() {
  if (process.env.NODE_ENV === "production") throw new Error("Manual UAT requires development.");
  const databaseUrl = readEnv(path.join(root, ".env")).DATABASE_URL || readEnv(path.join(api, ".env")).DATABASE_URL;
  const database = new URL(databaseUrl);
  if (database.hostname !== host || database.pathname !== "/the-property-pillar") {
    throw new Error("Manual UAT requires the local the-property-pillar PostgreSQL database.");
  }
  database.searchParams.set("schema", schema);
  const settings = {...readEnv(path.join(api, ".env")), ...readEnv(path.join(root, ".env"))};
  const mapKey = settings.MAP_LEAD_DATA_KEY || settings.JWT_SECRET;
  Object.assign(process.env, {
    NODE_ENV: "development", DATABASE_URL: database.href, API_HOST: host, API_PORT: String(apiPort),
    PUBLIC_TENANT_ID: "manual-uat-marketplace", CORS_ORIGINS: webOrigins.join(","), TRUST_PROXY: "false",
    JWT_SECRET: randomBytes(48).toString("hex"), SESSION_COOKIE_NAME: cookieName,
    ...(mapKey ? {MAP_LEAD_DATA_KEY: createHmac("sha256", mapKey).update("manual-uat-map-leads").digest("hex")} : {}),
    AUTH_RATE_LIMIT_MAX: "60", RATE_LIMIT_MAX: "600",
    UPLOAD_ROOT: path.join(root, "tmp", "manual-uat-uploads"),
    RAZORPAY_KEY_ID: "", RAZORPAY_KEY_SECRET: "", RAZORPAY_WEBHOOK_SECRET: "", BILLING_CONFIG_FILE: "",
    SMTP_HOST: "", SMTP_USER: "", SMTP_PASSWORD: "", SMTP_FROM: "",
    GOOGLE_OAUTH_CLIENT_ID: "", GOOGLE_OAUTH_CLIENT_SECRET: "", GOOGLE_OAUTH_REDIRECT_URI: "",
  });
  for (const args of [
    [path.join(api, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"],
    [path.join(api, "node_modules", "tsx", "dist", "cli.mjs"), path.join(api, "src", "scripts", "create-panel-accounts.ts"), accountFile],
    ...(process.argv.includes("--seed-plans") ? [[path.join(api, "node_modules", "tsx", "dist", "cli.mjs"), path.join(api, "src", "scripts", "seed-listing-plans.ts")]] : []),
  ]) {
    const result = spawnSync(process.execPath, args, {cwd: api, stdio: "inherit"});
    if (result.status !== 0) throw new Error("Manual UAT database setup failed.");
  }
  return new Map(JSON.parse(readFileSync(path.join(root, "tmp", accountFile), "utf8")).accounts.map((account) => [account.role, account]));
}

function send(res, status, body = "", headers = {}) {
  res.writeHead(status, {"Cache-Control": "no-store", ...headers});
  res.end(body);
}

function picker() {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Switch account | Property Pillar UAT</title>
    <style>
      body{margin:0;background:#f3f7f4;color:#18382f;font:16px/1.5 system-ui,sans-serif}
      main{max-width:900px;margin:auto;padding:clamp(22px,5vw,60px)}h1{margin:.8rem 0 .35rem;font-size:2rem}
      p{margin:0;color:#456259}a{color:#206352}ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,215px),1fr));gap:12px;padding:0;margin:24px 0;list-style:none}
      button{width:100%;min-height:100px;text-align:left;padding:15px;border:1px solid #cadbd2;border-radius:12px;background:#fff;color:inherit;font:inherit;cursor:pointer}
      button:hover,button:focus-visible{outline:2px solid #206352;outline-offset:2px}small{display:block;margin-top:4px;color:#456259}
      .exit{width:auto;min-height:0;padding:9px 13px}
    </style>
    <main><a href="/en">Property Pillar</a><h1>Switch account</h1>
    <p>Choose a local test account. Records are shared between these panels in the isolated UAT database.</p>
    <ul>${panels.map(([role, label, detail]) => `<li><form method="post" action="/__uat/access"><button type="submit" name="role" value="${role}"><strong>${label}</strong><small>${detail}</small></button></form></li>`).join("")}</ul>
    <form method="post" action="/__uat/exit"><button class="exit" type="submit">Return to regular site</button></form></main></html>`;
}

async function openPanel(req, res, accounts, origin) {
  if (req.method !== "POST" || req.headers.origin !== origin) return send(res, 403, "Open the local account picker first.");
  let body = "";
  for await (const part of req) {
    body += part;
    if (body.length > 256) return send(res, 413, "Invalid account selection.");
  }
  const role = new URLSearchParams(body).get("role");
  const account = panels.some(([key]) => key === role) ? accounts.get(role) : undefined;
  if (!account) return send(res, 400, "Choose a test account from the picker.");
  const login = await fetch(`http://${host}:${apiPort}/api/v1/auth/sign-in`, {
    method: "POST", headers: {Origin: origin, "Content-Type": "application/json", "X-Forwarded-Host": new URL(origin).host},
    body: JSON.stringify({email: account.email, password: account.password, rememberMe: false}),
    signal: AbortSignal.timeout(5000),
  });
  const cookie = login.headers.getSetCookie().find((header) => header.startsWith(cookieName + "="));
  if (!login.ok || !cookie) return send(res, 502, "Could not open the selected test account.");
  send(res, 303, "", {"Set-Cookie": [cookie, modeCookie + "=1" + cookieOptions], Location: "/en/dashboard"});
}

async function start() {
  const accounts = prepare();
  const {app} = await import("../apps/api/dist/app.js");
  const server = http.createServer((req, res) => {
    const origin = `http://${req.headers["x-forwarded-host"]}`;
    if (!webOrigins.includes(origin) || !req.url?.startsWith("/") || req.url.startsWith("//")) return send(res, 403);
    const pathname = new URL(req.url, origin).pathname;
    if (pathname === "/__uat" && req.method === "GET") {
      return send(res, 200, picker(), {"Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"});
    }
    if (pathname === "/__uat/access") return void openPanel(req, res, accounts, origin).catch(() => send(res, 502, "The test sign-in could not be completed."));
    if (pathname === "/__uat/exit") {
      if (req.method !== "POST" || req.headers.origin !== origin) return send(res, 403);
      return send(res, 303, "", {"Set-Cookie": [modeCookie, cookieName].map((name) => `${name}=; Max-Age=0${cookieOptions}`), Location: "/en"});
    }
    if (pathname === "/api/v1" || pathname.startsWith("/api/v1/")) return app(req, res);
    send(res, 404);
  });
  server.once("error", () => {
    console.error("The internal UAT service port could not be bound.");
    process.exitCode = 1;
  });
  server.listen(apiPort, host, () => console.log(`Manual UAT is ready at ${webOrigins[0]}/__uat`));
}

void start().catch((error) => {
  console.error(error instanceof Error ? error.message : "Could not start manual UAT.");
  process.exitCode = 1;
});
