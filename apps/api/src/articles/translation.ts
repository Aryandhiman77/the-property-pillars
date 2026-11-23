import type {Article, Prisma} from "@prisma/client";
import {env} from "../config/env.js";
import {prisma} from "../database/prisma.js";
import {sanitizePropertyHtml} from "../workspace/property-content.js";

type Metadata = Pick<Article, "title" | "summary" | "imageAlt" | "tags">;
type Translatable = Metadata & Pick<Article, "id" | "updatedAt"> & {bodyHtml?: string};
const pending = new Map<string, Promise<unknown>>();

async function translate(text: string[], locale: string, format: "text" | "html") {
  if (!env.GOOGLE_TRANSLATION_API_KEY) throw new Error("Translation is not configured");
  const response = await fetch("https://translation.googleapis.com/language/translate/v2", {
    method: "POST",
    headers: {"Content-Type": "application/json", "X-Goog-Api-Key": env.GOOGLE_TRANSLATION_API_KEY},
    body: JSON.stringify({q: text, source: "en", target: locale === "zh" ? "zh-CN" : locale, format}),
    signal: AbortSignal.timeout(4500),
  });
  if (!response.ok) throw new Error("Translation is unavailable");
  const result = await response.json() as {data?: {translations?: {translatedText?: string}[]}};
  const values = result.data?.translations?.map(({translatedText}) => translatedText);
  if (!values || values.length !== text.length || values.some((part) => typeof part !== "string")) throw new Error("Incomplete translation");
  return values as string[];
}

async function reuse<T>(key: string, task: () => Promise<T>): Promise<T> {
  const existing = pending.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const job = task();
  pending.set(key, job);
  try {return await job;} finally {pending.delete(key);}
}

function displayText(text: string) {
  return text.replace(/&#39;|&apos;|&quot;|&amp;|&lt;|&gt;/g, (entity) => ({"&#39;": "'", "&apos;": "'", "&quot;": "\"", "&amp;": "&", "&lt;": "<", "&gt;": ">"}[entity] ?? entity));
}

export async function localizeArticle<T extends Translatable>(article: T, locale: string) {
  if (locale === "en" || !env.GOOGLE_TRANSLATION_API_KEY) return {...article, contentLocale: "en"};
  const key = {articleId: article.id, locale, version: article.updatedAt.toISOString()};
  const saved = await prisma.articleTranslation.findUnique({where: {articleId_locale_version: key}});
  const prefix = JSON.stringify(key);
  const write = (change: {metadata?: Prisma.InputJsonValue; bodyHtml?: string}) => prisma.articleTranslation.upsert({
    where: {articleId_locale_version: key}, create: {...key, ...change}, update: change,
  });

  try {
    const [metadata, bodyHtml] = await Promise.all([
      saved?.metadata as Metadata | null ?? reuse(prefix + "meta", async () => {
        const [title, summary, imageAlt, ...tags] = (await translate([article.title, article.summary || article.title, article.imageAlt, ...article.tags], locale, "text")).map(displayText);
        const metadata = {title: title!, summary: article.summary ? summary! : "", imageAlt: imageAlt!, tags};
        await write({metadata});
        return metadata;
      }),
      article.bodyHtml === undefined ? undefined : saved?.bodyHtml ?? reuse(prefix + "body", async () => {
        const [translation] = await translate([article.bodyHtml!], locale, "html");
        const bodyHtml = sanitizePropertyHtml(translation!);
        await write({bodyHtml});
        return bodyHtml;
      }),
    ]);
    return {...article, ...metadata, ...(bodyHtml === undefined ? {} : {bodyHtml}), contentLocale: locale};
  } catch {
    return {...article, contentLocale: "en"};
  }
}
