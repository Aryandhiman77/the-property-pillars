import type {MetadataRoute} from "next";
import {locales} from "@/i18n/config";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://thepropertypillar.com"
).replace(/\/+$/, "");

const privatePaths = [
  "/api/",
  "/dashboard",
  "/auth",
  "/onboarding",
  "/admin",
  ...locales.flatMap((locale) => [
    `/${locale}/dashboard`,
    `/${locale}/auth`,
    `/${locale}/onboarding`,
    `/${locale}/admin`
  ])
];

const supportedSearchBots = [
  "GPTBot",
  "OAI-SearchBot",
  "Google-Extended",
  "PerplexityBot",
  "ClaudeBot",
  "Applebot-Extended",
  "Bingbot"
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {userAgent: "*", allow: "/", disallow: privatePaths},
      {
        userAgent: supportedSearchBots,
        allow: "/",
        disallow: privatePaths
      }
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl
  };
}
