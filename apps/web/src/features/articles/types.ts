import type {ArticleSocialPlatform, ArticleTopic} from "@the-property-pillar/contracts";

export type ArticleCardData = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverImage: string;
  imageAlt: string;
  tags: string[];
  topic: ArticleTopic;
  contentLocale: string;
  readMinutes: number;
  publishedAt: string;
};
export type ArticleSocialLink = {platform: ArticleSocialPlatform; url: string};
export type ArticleDetails = {
  article: ArticleCardData & {bodyHtml: string; socialLinks: ArticleSocialLink[]};
  stats: {views: number; likes: number; shares: number; liked: boolean};
  related: ArticleCardData[];
  next: string | null;
};
