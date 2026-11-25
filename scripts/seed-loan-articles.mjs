import {readFile} from "node:fs/promises";
import {setTimeout as wait} from "node:timers/promises";

// Use the same local administrator, upload route and publishing checks as the editor.
const root = new URL("../", import.meta.url);
const origin = "http://127.0.0.1:3000";
const api = "http://127.0.0.1:4000/api/v1";
const {accounts} = JSON.parse(await readFile(new URL("tmp/panel-credentials.json", root), "utf8"));
const admin = accounts.find(account => account.role === "ADMIN");
if (!admin) throw new Error("Local panel administrator is missing.");
const articles = JSON.parse(await readFile(new URL("apps/api/data/loan-articles.json", root), "utf8"));
let cookie = "";

async function request(path, options = {}) {
  const response = await fetch(api + path, {...options, redirect: "error",
    headers: {Origin: origin, ...(cookie && {Cookie: cookie}), ...options.headers}});
  const result = await response.json();
  if (!response.ok) {
    const {code, message, details} = result.error;
    const reason = details?.reason ? " (" + details.reason + ")" : "";
    throw Object.assign(new Error(path + " — " + message + reason), {code, reason: details?.reason});
  }
  if (path === "/auth/sign-in") cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  return result.data;
}

function sendJson(path, body, method = "POST") {
  return request(path, {method, headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});
}

await sendJson("/auth/sign-in", {email: admin.email, password: admin.password});
try {
  const existing = new Map();
  const drafts = [];
  for (let page = 1; ; page++) {
    const {items, total} = await request("/workspace/articles?limit=24&page=" + page);
    for (const item of items) existing.set(item.slug, item);
    if (page * 24 >= total) break;
  }
  for (const {image, ...article} of articles) {
    const slug = article.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const previous = existing.get(slug);
    if (previous) {
      if (process.argv.includes("--publish-drafts") && previous.status === "DRAFT" && previous.topic === "LOANS") {
        const draft = await request("/workspace/articles/" + previous.id);
        if (draft.title === article.title && draft.bodyHtml === article.bodyHtml && draft.summary === article.summary) drafts.push(draft);
      }
      continue;
    }
    const cover = await readFile(new URL("apps/web/public/images/" + image, root));
    const {url} = await request("/uploads", {method: "POST", body: cover,
      headers: {"Content-Type": "image/webp", "X-Upload-Purpose": "articles:coverImage", "X-Staged-Upload": "1"}});
    const saved = await sendJson("/workspace/articles", {...article, coverImage: url, countryCode: "IN", topic: "LOANS", status: "DRAFT"});
    drafts.push(saved);
  }
  for (const draft of drafts) {
    for (let attempt = 1; ; attempt++) {
      try {
        await sendJson("/workspace/articles/" + draft.id, {status: "PUBLISHED"}, "PATCH");
        console.log("Published", draft.slug);
        break;
      } catch (error) {
        if (error.code === "CONTENT_CHECK_UNAVAILABLE" &&
            ["RATE_LIMITED", "TIMEOUT", "SERVICE_UNAVAILABLE", "NETWORK_ERROR"].includes(error.reason) && attempt < 3) {
          await wait(60_000);
          continue;
        }
        console.error("Saved as draft:", draft.slug, error.message);
        process.exitCode = 1;
        break;
      }
    }
  }
} finally {
  await sendJson("/auth/logout", {});
}
