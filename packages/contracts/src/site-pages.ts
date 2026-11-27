export const sitePageTitles = {
  about: "About The Property Pillar",
  contact: "Contact us",
  "posting-disclaimer": "Property posting guidelines",
  grievances: "Grievance redressal",
  copyright: "Copyright & image policy",
  approvals: "RERA & local approvals guide",
  terms: "Terms of use",
  cookies: "Cookie policy",
  safety: "Transaction safety guide",
  disclaimer: "Marketplace disclaimer",
  listings: "Content & listing policy",
  reviews: "Ratings & reviews policy",
} as const;

export type SitePageSlug = keyof typeof sitePageTitles;
export type SitePage = {slug: SitePageSlug; title: string; body: string; revision: number};
export function isSitePageSlug(value: string): value is SitePageSlug {
  return Object.hasOwn(sitePageTitles, value);
}
