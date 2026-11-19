export const productConfig = {
  name: "ThePropertyPillar",
  databaseName: "the-property-pillar",
  defaultLocale: "en",
  supportedLocales: [
    "en",
    "hi",
    "pa",
    "gu",
    "ta",
    "mr",
    "te",
    "kn",
    "bn",
    "ar",
  ],
  rtlLocales: ["ar"],
  theme: {
    background: "#F8FAFC",
    foreground: "#0F172A",
    primary: "#D97706",
    verified: "#059669",
  },
} as const;

export type SupportedLocale = (typeof productConfig.supportedLocales)[number];

