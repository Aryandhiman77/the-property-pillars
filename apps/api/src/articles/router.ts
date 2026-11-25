import {readLeadIdentity} from "../services/lead-identity.js";
import {createHmac} from "node:crypto";
import {Prisma, type Article} from "@prisma/client";
import {articleTopics, propertyTypeKey, siteLocales} from "@the-property-pillar/contracts";
import {Router, type Request, type Router as ExpressRouter} from "express";
import {z} from "zod";
import {env} from "../config/env.js";
import {prisma} from "../database/prisma.js";
import {sendSuccess} from "../helpers/api-response.js";
import {parseInput} from "../helpers/parse-input.js";
import {requireRole} from "../middleware/session.middleware.js";
import {canAttachImage} from "../uploads/images.js";
import {moderatePublicContent} from "../workspace/listing-moderation.js";
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";
import {articleSchema} from "./schema.js";
import {localizeArticle} from "./translation.js";

const cards = {
  id: true, slug: true, title: true, summary: true, imageAlt: true, coverImage: true,
  tags: true, topic: true, readMinutes: true, publishedAt: true, updatedAt: true,
} as const;
const published = {tenantId: env.PUBLIC_TENANT_ID, status: "PUBLISHED", publishedAt: {not: null}, tenant: {isDemo: false}} as const;
const order: Prisma.ArticleOrderByWithRelationInput[] = [{publishedAt: "desc"}, {id: "desc"}];
const querySchema = z.object({
  locale: z.enum(siteLocales).default("en"),
  city: z.string().trim().max(100).optional(),
  country: z.string().regex(/^[A-Z]{2}$/).optional(),
  type: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(24).default(12),
  tag: z.string().trim().max(45).optional(),
  topic: z.enum(articleTopics).optional(),
});

function slugFromTitle(title: string) {
  return title.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100).replace(/-$/, "") || "article";
}

export const articlesRouter: ExpressRouter = Router();
articlesRouter.use("/workspace/articles", requireRole("ADMIN"));
articlesRouter.get("/workspace/articles", asyncHandler(async (req, res) => {
  const {page, limit} = parseInput(querySchema, req.query);
  const where = {tenantId: req.session!.tenantId};
  const [items, total] = await prisma.$transaction([
    prisma.article.findMany({where, select: {...cards, status: true}, orderBy: [{updatedAt: "desc"}, {id: "desc"}], take: limit, skip: (page - 1) * limit}),
    prisma.article.count({where}),
  ]);
  sendSuccess(res, {items, total});
}));

async function adminArticle(req: Request) {
  const article = await prisma.article.findFirst({where: {id: String(req.params.id), tenantId: req.session!.tenantId}});
  if (!article) throw new ApiError(404, "ARTICLE_NOT_FOUND", "Article not found.");
  return article;
}
articlesRouter.get("/workspace/articles/:id", asyncHandler(async (req, res) => sendSuccess(res, await adminArticle(req))));

const saveArticle = asyncHandler(async (req, res) => {
  const session = req.session!;
  const previous = req.params.id ? await adminArticle(req) : null;
  const edited = previous ? parseInput(articleSchema.partial(), req.body) : req.body;
  const baseline = previous && {
    title: previous.title, summary: previous.summary, bodyHtml: previous.bodyHtml, tags: previous.tags, coverImage: previous.coverImage,
    imageAlt: previous.imageAlt, city: previous.city, countryCode: previous.countryCode, propertyType: previous.propertyType,
    socialLinks: previous.socialLinks, status: previous.status, topic: previous.topic,
  };
  const info = parseInput(articleSchema, previous ? {...baseline, ...edited} : edited);
  if (info.coverImage !== previous?.coverImage && !await canAttachImage(info.coverImage, session, "articles:coverImage")) {
    throw new ApiError(422, "INVALID_MEDIA", "Upload an article cover image.", {coverImage: ["Upload the image using this field."]});
  }
  const {bodyHtml} = info;
  if (info.status === "PUBLISHED") {
    await moderatePublicContent("property marketplace editorial article about real estate, construction or related services", {
      title: info.title, summary: info.summary, bodyHtml: bodyHtml.replace(/<[^>]+>/g, " "), tags: info.tags.join(", "), imageAlt: info.imageAlt,
    }, [{field: "coverImage", url: info.coverImage}]);
  }
  const words = bodyHtml.replace(/<[^>]+>/g, " ").trim().split(/\s+/).length;
  const data = {...info, readMinutes: Math.max(1, Math.ceil(words / 220)),
    publishedAt: previous?.publishedAt ?? (info.status === "PUBLISHED" ? new Date() : null)};
  const result = await prisma.$transaction(async (tx) => {
    if (previous) {
      const updated = await tx.article.updateMany({where: {id: previous.id, updatedAt: previous.updatedAt}, data});
      if (!updated.count) throw new ApiError(409, "ARTICLE_CHANGED", "This article has changed. Reopen it before saving.");
      await tx.articleTranslation.deleteMany({where: {articleId: previous.id}});
      return tx.article.findUniqueOrThrow({where: {id: previous.id}});
    }
    await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${session.tenantId} FOR NO KEY UPDATE`;
    const base = slugFromTitle(data.title);
    const matches = await tx.article.findMany({where: {tenantId: session.tenantId, OR: [{slug: base}, {slug: {startsWith: base + "-"}}]}, select: {slug: true}});
    const taken = new Set(matches.map(({slug}) => slug));
    let slug = base;
    for (let suffix = 2; taken.has(slug); suffix++) slug = base + "-" + suffix;
    return tx.article.create({data: {...data, tenantId: session.tenantId, slug}});
  });
  sendSuccess(res, result, previous ? 200 : 201);
});
articlesRouter.post("/workspace/articles", saveArticle);
articlesRouter.patch("/workspace/articles/:id", saveArticle);

articlesRouter.get("/public/articles", asyncHandler(async (req, res) => {
  const {city, country, type, tag, topic, locale, page, limit} = parseInput(querySchema, req.query);
  const where = {...published, ...(tag ? {tags: {has: tag}} : {}), ...(topic ? {topic} : {})};
  const matches: Prisma.ArticleWhereInput[] = [];
  if (city) matches.push({city: {equals: city, mode: "insensitive"}, ...(country ? {countryCode: country} : {})});
  if (type) matches.push({propertyType: propertyTypeKey(type)});
  const picked = matches.length ? await prisma.article.findMany({where: {...where, OR: matches}, orderBy: order, select: cards, take: limit}) : [];
  const [recent, total] = await prisma.$transaction([
    prisma.article.findMany({where: {...where, id: {notIn: picked.map(({id}) => id)}}, select: cards, orderBy: order,
      skip: matches.length ? 0 : (page - 1) * limit, take: limit - picked.length}),
    prisma.article.count({where}),
  ]);
  sendSuccess(res, {items: await Promise.all([...picked, ...recent].map((article) => localizeArticle(article, locale))), total});
}));

async function counts(articleId: string, userId?: string) {
  const [groups, mine] = await Promise.all([
    prisma.articleInteraction.groupBy({by: ["kind"], where: {articleId}, _count: true}),
    userId ? prisma.articleInteraction.findUnique({where: {articleId_kind_key: {articleId, kind: "like", key: userId}}}) : null,
  ]);
  const totals = Object.fromEntries(groups.map((row) => [row.kind, row._count]));
  return {views: totals.view ?? 0, likes: totals.like ?? 0, shares: totals.share ?? 0, liked: Boolean(mine)};
}

async function bySlug(slug: string) {
  const article = await prisma.article.findFirst({where: {...published, slug}});
  if (!article) throw new ApiError(404, "ARTICLE_NOT_FOUND", "Article not found.");
  return article;
}

function after(article: Article): Prisma.ArticleWhereInput[] {
  return [{publishedAt: {lt: article.publishedAt!}}, {publishedAt: article.publishedAt, id: {lt: article.id}}];
}

articlesRouter.get("/public/articles/:slug/next", asyncHandler(async (req, res) => {
  const anchor = await prisma.article.findFirst({where: {tenantId: published.tenantId, slug: String(req.params.slug), publishedAt: {not: null}}});
  const next = anchor && await prisma.article.findFirst({where: {...published, OR: after(anchor)}, orderBy: order, select: {slug: true}});
  sendSuccess(res, {slug: next?.slug ?? null});
}));

articlesRouter.get("/public/articles/:slug", asyncHandler(async (req, res) => {
  const {locale} = parseInput(querySchema, req.query);
  const article = await bySlug(String(req.params.slug));
  const where = {...published, id: {not: article.id}};
  const shared: Prisma.ArticleWhereInput[] = [];
  if (article.tags.length) shared.push({tags: {hasSome: article.tags}});
  if (article.city) shared.push({city: {equals: article.city, mode: "insensitive"}, ...(article.countryCode ? {countryCode: article.countryCode} : {})});
  const related = shared.length ? await prisma.article.findMany({where: {...where, OR: shared}, select: cards, orderBy: order, take: 4}) : [];
  const [localized, stats, more, next] = await Promise.all([
    localizeArticle(article, locale), counts(article.id, req.session?.userId),
    prisma.article.findMany({where: {...where, id: {notIn: [article.id, ...related.map(({id}) => id)]}}, select: cards, orderBy: order, take: 4 - related.length}),
    prisma.article.findFirst({where: {...published, OR: after(article)}, select: {slug: true}, orderBy: order}),
  ]);
  const {tenantId: _tenant, ...publicArticle} = localized;
  sendSuccess(res, {article: publicArticle, stats, next: next?.slug ?? null,
    related: await Promise.all([...related, ...more].map((item) => localizeArticle(item, locale)))});
}));

async function record(req: Request, kind: "view" | "like" | "share") {
  const id = String(req.params.id);
  const article = await prisma.article.findFirst({where: {...published, id}, select: {id: true}});
  if (!article) throw new ApiError(404, "ARTICLE_NOT_FOUND", "Article not found.");
  const guest = !req.session && await readLeadIdentity(req, "like:" + id);
  const userId = req.session?.userId ?? (guest && guest.tenantId === published.tenantId ? guest.userId : undefined);
  const ipHash = createHmac("sha256", env.JWT_SECRET).update("article-ip:" + published.tenantId + ":" + (req.ip ?? "unknown").replace(/^::ffff:/i, "")).digest("hex");
  if (kind === "like" && (!userId || (req.session && req.session.tenantId !== published.tenantId))) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Sign in to like this article.");
  const key = kind === "like" ? userId! : kind === "view" ? ipHash : ipHash + ":" + parseInput(z.object({eventId: z.string().uuid()}), req.body).eventId;
  if (req.method === "DELETE") await prisma.articleInteraction.deleteMany({where: {articleId: id, kind, key}});
  else await prisma.articleInteraction.createMany({data: {articleId: id, kind, key}, skipDuplicates: true});
  return counts(id, userId);
}

articlesRouter.post("/public/articles/:id/views", asyncHandler(async (req, res) => sendSuccess(res, await record(req, "view"))));
articlesRouter.put("/public/articles/:id/like", asyncHandler(async (req, res) => sendSuccess(res, await record(req, "like"))));
articlesRouter.delete("/public/articles/:id/like", asyncHandler(async (req, res) => sendSuccess(res, await record(req, "like"))));
articlesRouter.post("/public/articles/:id/shares", asyncHandler(async (req, res) => sendSuccess(res, await record(req, "share"))));
