import {articleSocialPlatforms, articleTopics, propertyTypeKey, type ArticleSocialPlatform} from "@the-property-pillar/contracts";
import {z} from "zod";
import {sanitizePropertyHtml} from "../workspace/property-content.js";

const socialDomains: Record<ArticleSocialPlatform, string[]> = {
  whatsapp: ["whatsapp.com", "wa.me"],
  facebook: ["facebook.com", "fb.com"],
  instagram: ["instagram.com"],
  linkedin: ["linkedin.com"],
  youtube: ["youtube.com", "youtu.be"],
  x: ["x.com", "twitter.com"],
};

const socialLink = z.object({platform: z.enum(articleSocialPlatforms), url: z.string().trim().max(2048)}).superRefine(({platform, url}, context) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.port &&
      socialDomains[platform].some((domain) => parsed.hostname === domain || parsed.hostname.endsWith("." + domain))) return;
  } catch {}
  context.addIssue({code: "custom", path: ["url"], message: "Enter an HTTPS link for the selected platform."});
});

export const articleSchema = z.object({
  title: z.string().trim().min(4, "Enter an article title.").max(160),
  summary: z.string().trim().max(350).default(""),
  coverImage: z.string().regex(/^\/api\/v1\/uploads\/[a-f0-9]{64}\.webp$/, "Upload a cover image."),
  imageAlt: z.string().trim().min(2, "Describe the cover image.").max(160),
  bodyHtml: z.string().max(20_000).transform(sanitizePropertyHtml).refine((body) => /[^\s]/.test(body.replace(/<[^>]*>|&nbsp;|&#160;/gi, "")), "Enter the article body."),
  tags: z.array(z.string().trim().min(1).max(45)).max(12).transform((tags) => [...new Map(tags.map((tag) => [tag.toLowerCase(), tag])).values()]).default([]),
  topic: z.enum(articleTopics).default("NEWS"),
  city: z.string().trim().max(100).nullable().optional(),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Enter a two-letter country code.").nullable().optional(),
  propertyType: z.string().trim().max(80).transform(propertyTypeKey).nullable().optional(),
  socialLinks: z.array(socialLink).max(articleSocialPlatforms.length).superRefine((links, context) => {
    const used = new Set<string>();
    links.forEach(({platform}, index) => {
      if (used.has(platform)) context.addIssue({code: "custom", path: [index, "platform"], message: "Choose a platform that has not been added yet."});
      used.add(platform);
    });
  }).default([]),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
}).strict();
