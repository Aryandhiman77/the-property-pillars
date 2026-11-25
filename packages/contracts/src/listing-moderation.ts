/** Match complete words, including Hindi combining marks. Keep ambiguous terms out of this list. */
const groups = {
  profanity: ["fuck(?:ing|er|ed|s)?", "motherfucker", "bullshit", "shit", "asshole", "bitch", "madarchod", "bhenchod", "behenchod", "chutiya", "मादरचोद", "बहनचोद", "चूतिया"],
  adult: ["porn(?:ography|ographic)?", "xxx videos?", "sex cam", "एडल्ट वीडियो", "पोर्न"],
  unrelated: ["online casino bonus", "buy casino chips", "betting promo code", "सट्टा लगाओ"],
} as const;

export type ListingIssue = {field: string; reason: "profanity" | "adult" | "unrelated" | "unreadable" | "unsafe"; excerpt?: string; mediaUrl?: string};
export const listingContexts: Record<string, string> = {
  properties: "real estate property for sale or rent", materialProducts: "construction material or home improvement product",
  builderProjects: "real estate development project", dealerProfiles: "real estate agency profile",
  serviceProfiles: "property, design, construction, legal or home service professional", jobs: "marketplace employment opportunity",
  workerProfiles: "skilled worker profile", adCampaigns: "real estate project advertisement",
};
const patterns = Object.entries(groups).map(([reason, words]) => ({
  reason: reason as ListingIssue["reason"],
  pattern: new RegExp("(?<![\\p{L}\\p{N}\\p{M}])(?:" + words.join("|") + ")(?![\\p{L}\\p{N}\\p{M}])", "giu"),
}));

export function blockedListingWords(field: string, value: string): ListingIssue[] {
  return patterns.flatMap(({pattern, reason}) =>
    [...new Set(Array.from(value.matchAll(pattern), match => match[0]))].map(excerpt => ({field, reason, excerpt})));
}

export const listingIssueMessages: Record<ListingIssue["reason"], string> = {
  profanity: "Remove abusive language from this field.",
  adult: "Replace the adult content before posting.",
  unrelated: "Use content relevant to this listing.",
  unreadable: "Upload a new copy of this file so it can be checked.",
  unsafe: "The safety check flagged this file. Choose a different one.",
};

