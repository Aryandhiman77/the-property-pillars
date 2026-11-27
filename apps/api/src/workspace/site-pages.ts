import {Router, type Router as ExpressRouter} from "express";
import {z} from "zod";
import {sitePageTitles, isSitePageSlug, type SitePage} from "@the-property-pillar/contracts";
import {env} from "../config/env.js";
import {sendSuccess} from "../helpers/api-response.js";
import {parseInput} from "../helpers/parse-input.js";
import {requireRole} from "../middleware/session.middleware.js";
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";
import {workspacePrisma as db} from "./db.js";
import {sanitizePropertyHtml} from "./property-content.js";
import {pageBodies} from "./site-page-content.js";

export const sitePagesRouter: ExpressRouter = Router();
function slugFor(value: string) {
  if (!isSitePageSlug(value)) throw new ApiError(404, "NOT_FOUND", "Page not found.");
  return value;
}
const editor = z.object({
  title: z.string().trim().min(1).max(150),
  body: z.string().max(20_000).transform(sanitizePropertyHtml).refine(html => html.replace(/<[^>]*>|&nbsp;/g, "").trim().length > 0, "Enter page content."),
  revision: z.number().int().nonnegative(),
}).strict();

async function page(tenantId: string, key: string) {
  const slug = slugFor(key);
  const [saved] = await db.$queryRaw<SitePage[]>`SELECT slug,title,body,revision FROM "SitePage" WHERE "tenantId"=${tenantId} AND slug=${slug}`;
  return saved ?? {slug, title: sitePageTitles[slug], body: pageBodies[slug], revision: 0};
}

sitePagesRouter.get("/public/site-pages/:slug", asyncHandler(async (req,res) => {
  res.set("Cache-Control", "no-store");
  sendSuccess(res, await page(env.PUBLIC_TENANT_ID, String(req.params.slug)));
}));
sitePagesRouter.get("/workspace/site-pages/:slug", requireRole("ADMIN"), asyncHandler(async (req,res) => {
  res.set("Cache-Control", "private, no-store");
  sendSuccess(res, await page(req.session!.tenantId, String(req.params.slug)));
}));
sitePagesRouter.put("/workspace/site-pages/:slug", requireRole("ADMIN"), asyncHandler(async (req,res) => {
  const tenantId = req.session!.tenantId;
  const slug = slugFor(String(req.params.slug));
  const {title,body,revision} = parseInput(editor, req.body);
  const rows = revision === 0
    ? await db.$queryRaw<SitePage[]>`INSERT INTO "SitePage" ("tenantId",slug,title,body) VALUES (${tenantId},${slug},${title},${body}) ON CONFLICT DO NOTHING RETURNING slug,title,body,revision`
    : await db.$queryRaw<SitePage[]>`UPDATE "SitePage" SET title=${title},body=${body},revision=revision+1 WHERE "tenantId"=${tenantId} AND slug=${slug} AND revision=${revision} RETURNING slug,title,body,revision`;
  if (!rows.length) throw new ApiError(409, "PAGE_CHANGED", "Another editor saved this page. Reload the saved version before editing again.");
  sendSuccess(res, rows[0]);
}));
