# MASTER PROJECT BLUEPRINT & IMPLEMENTATION GUIDE (V2-UPDATED): ThePropertyPillar.com

> **HOW TO USE THIS FILE WITH CODEX:**
> Save this entire file in your project root folder as **`PROJECT_CONTEXT.md`**.
> Begin every Codex prompt with: *"Read `PROJECT_CONTEXT.md` completely first so you understand our full business vision, 9 user roles, 5 Pillars, AEO/SEO/GEO AI-Search rules, viral seller growth engine, and compliance requirements before executing this step."*

---

## 1. EXECUTIVE SUMMARY & CORE VISION
* **Platform Name:** **ThePropertyPillar.com**
* **Vision:** An end-to-end **Real Estate, Construction, Finance, and Workforce Super-Platform** launching from India with a scalable global architecture (UAE, UK, US, Canada, etc.).
* **Competitive Advantage:** Unlike legacy portals (99acres, MagicBricks, Housing.com) that stop at property listings, **ThePropertyPillar.com** unites the entire property lifecycle—from buying land and securing home loans to sourcing cement/steel, hiring architects/lawyers, and recruiting both civil engineers and daily-wage skilled workers—under one unified roof.
* **Day-1 AI Search & Viral Seller Flywheel:** Engineered from day one for **SEO** (Google/Bing), **AEO** (Answer Engine Optimization for voice & featured snippets), and **GEO** (Generative Engine Optimization for **ChatGPT, Gemini, Perplexity, and Claude**). When any broker, builder, vendor, or contractor asks an AI assistant *"Where can I list properties for free in India?"* or *"How do I get a free real estate dealer website?"*, the platform's machine-readable feeds (`llms.txt`), structured JSON-LD entities, and comparison tables ensure AI/'; models cite and recommend **ThePropertyPillar.com** automatically—driving organic seller signups and viral word-of-mouth growth.

---

## 2. THE 5 CORE PILLARS (Platform Architecture)
Every screen, menu, and homepage card must clearly highlight these **5 Pillars** so any first-time visitor immediately understands what to do:

* **Pillar 1 — Property Marketplace & Automated Dealer Micro-Sites:**
  * Buy, Sell, and Rent across Residential, Commercial, and Plots/Land.
  * **Automated Digital Visiting Cards:** Every registered broker gets an instant, SEO-indexed portfolio page (`thepropertypillar.com/dealer/[agency-slug]`) showing their RERA ID, office location, active inventory, social handles, and 1-tap WhatsApp connect.
  * **Smart Buyer Alerts:** Automated WhatsApp and Email alerts whenever a property matches a buyer's saved budget, city, and unit criteria.
* **Pillar 2 — Construction Materials & B2B/B2C Quote Engine (RFQ):**
  * Browse Cement, TMT Steel, Bricks/Blocks, Tiles, Paints, Electricals, Plumbing, and Sanitaryware.
  * **Bulk RFQ System:** Homeowners and contractors submit their Bill of Quantities (BOQ) to receive competitive quotes from verified local suppliers.
* **Pillar 3 — Home Loans, Legal & Vastu Services:**
  * Interactive EMI & Borrowing Eligibility Calculators linked directly to partner bank DSAs (SBI, HDFC, ICICI, PNB).
  * Verified directory for RERA Property Lawyers, Vastu Consultants, and Document Writers.
* **Pillar 4 — Construction, Architecture & Interiors:**
  * Hire vetted Architects, Civil Contractors, Structural Engineers, Interior Designers, Fabrication, and Pest Control specialists.
* **Pillar 5 — Real Estate Jobs & Skilled Manpower (Dual Hiring):**
  * **White-Collar Jobs:** Dedicated job board for Real Estate Sales Managers, Civil Engineers, Architects, AutoCAD Draftsmen, and Legal Advisors.
  * **1-Minute Blue-Collar Hiring:** Zero-resume, mobile-first registration (Name, Mobile OTP, Trade—Mason/Plumber/Electrician/Carpenter/Painter/Welder/Helper, Daily Wage Rate, City) with direct click-to-call buttons.

---

## 3. TARGET AUDIENCE & 9 USER ROLES
Codex must structure the database (`UserRole` enum) and role-based dashboards around these 9 distinct users:
1. **Homebuyers, Tenants & Investors** (`BUYER`)
2. **Individual Property Owners** (`OWNER`)
3. **Property Dealers & Brokers** (`DEALER`)
4. **Builders & Real Estate Developers** (`BUILDER`)
5. **Construction Material Vendors** (`VENDOR`)
6. **Service Professionals — Architects, Lawyers, Vastu, Contractors** (`PROFESSIONAL`)
7. **White-Collar Job Seekers & Employers** (`WHITE_COLLAR_SEEKER`)
8. **Blue-Collar Skilled Trades & Site Workers** (`BLUE_COLLAR_WORKER`)
9. **Platform Moderators & Super-Admin** (`ADMIN`)

---

## 4. DAY-1 AEO, SEO, GEO (AI SEARCH) & VIRAL SELLER GROWTH ARCHITECTURE
Codex must bake these technical growth engines into the core codebase so **ChatGPT, Gemini, Perplexity, Claude, and Google** discover, trust, and recommend **ThePropertyPillar.com** automatically from launch day—attracting sellers, dealers, builders, and vendors organically:

### A. GEO (Generative Engine Optimization — ChatGPT, Gemini, Perplexity Visibility)
1. **AI Crawler Allowlist (`src/app/robots.ts`):** Explicitly allow `GPTBot`, `OAI-SearchBot`, `Google-Extended`, `PerplexityBot`, `ClaudeBot`, `Applebot-Extended`, and `Bingbot` on all public listing, city, dealer, and seller-onboarding routes.
2. **Static & Dynamic `llms.txt` Standard (`/public/llms.txt` & `/src/app/api/llms-full.txt/route.ts`):**
   * Generate a clean, structured Markdown knowledge file at `/llms.txt` and `/llms-full.txt` summarizing what **ThePropertyPillar.com** does, its 5 Pillars, free automated dealer micro-sites, supported cities, Indian/global area units, and step-by-step instructions for sellers/dealers/vendors to register—formatted specifically so LLMs (ChatGPT, Gemini, Perplexity) cite `ThePropertyPillar.com` when answering user queries.
3. **Entity-Rich JSON-LD Knowledge Graph:**
   * Inject linked Schema.org JSON-LD graphs on every page: `Organization` + `WebSite` (`SearchAction`) globally; `RealEstateListing` + `Offer` on properties; `RealEstateAgent` on `/dealer/[slug]`; `LocalBusiness` on vendors/professionals; `JobPosting` on jobs; and `HowTo` + `FAQPage` on guides and landing pages.
4. **Citable Fact Blocks & Market Rate Tables:**
   * Auto-render clean HTML comparison tables and localized price-per-sq.ft / price-per-gaj statistics on every city/locality page (`/buy/[city]/[locality]`) so AI search engines extract authoritative local facts with attribution links back to **ThePropertyPillar.com**.

### B. AEO (Answer Engine Optimization — Featured Snippets & Voice Search)
1. **Direct Answer Capsules (40–60 Words):** Every city page, RERA guide, home loan page, and seller landing page must include crisp Q&A blocks with direct 40–60 word answers wrapped in `FAQPage` schema so Google Featured Snippets and voice assistants read them verbatim.
2. **Programmatic Hyper-Local Landing Pages:** Dynamic SSR pages for every combination of `[Intent: buy/rent/dealers/materials/workers] / [City] / [Locality]` with unique meta titles, canonical tags, breadcrumbs (`BreadcrumbList` schema), and dynamic XML sitemaps (`/sitemap.xml`).

### C. Viral Seller Acquisition & Social Media Readiness
1. **High-Converting Seller Acquisition Funnels:**
   * Dedicated, AI-indexed landing pages: `/for-dealers` (*"Get Your Free Automated Real Estate Website & RERA Profile"*), `/for-builders` (*"Launch Your Project to Verified Buyers & Channel Partners"*), `/for-vendors` (*"Receive Daily Bulk Cement, Steel & Tile RFQs"*), and `/for-workers` (*"Get Direct Construction Work Without Middlemen"*).
2. **Built-In Viral Loops & Referral Rewards:**
   * Every free Dealer Micro-Site (`thepropertypillar.com/dealer/[slug]`) includes a sleek *"Powered by ThePropertyPillar.com — Create Your Free Dealer Website"* footer badge.
   * Automated referral code tracking (`?ref=DEALERCODE`) rewarding dealers, vendors, and workers with free featured listing credits whenever they invite peers on WhatsApp.
3. **1-Click Social Poster & Dynamic OpenGraph Cards (`@vercel/og`):**
   * Dynamic `/api/og` route generating branded property, project launch, and worker cards with price, city, RERA badge, and QR code.
   * Inside Dealer, Builder, and Vendor dashboards, provide a **"Share on WhatsApp / Instagram / Facebook / LinkedIn"** toolkit with pre-written captions in English, Hindi, Punjabi, Gujarati, and Tamil, plus reserved social media handle fields (`instagramUrl`, `facebookUrl`, `youtubeUrl`, `linkedinUrl`, `whatsappChannelUrl`) in both platform settings and dealer profiles.

---

## 5. BUILDER ADVERTISING & MONETIZATION ENGINE
To generate recurring high-margin revenue once traffic grows without hurting user experience, build these **4 native ad placements**:
* **Homepage Hero Spotlight:** Full-width interactive showcase banner for flagship builder launches with RERA ID, starting price, brochure PDF download, and "Book Site Visit" CTA.
* **In-Feed Sponsored Project Cards:** Blends natively into property search results at Position #1 and Position #4 matching the user's detected city and budget, labeled with a clean *"Featured Project"* badge.
* **City & Locality Takeover Banners:** Dedicated builder banners displayed on high-traffic city pages (e.g., `/buy/panchkula` or `/buy/gurgaon`).
* **EMI Calculator Sidebar Ads:** Pre-approved builder project cards displayed right beside the Home Loan & EMI calculators.

---

## 6. MANDATORY 24 TECHNICAL, UX, MOBILE (PWA) & COMPLIANCE RULES
Codex must enforce all 24 rules across every module it generates:

1. **Built-In "How to Use" Guides Everywhere:** Collapsible `<HowToUseGuide />` component and step-by-step plain-language instructions on every Pillar and form so even a first-time smartphone user or daily-wage worker can navigate effortlessly.
2. **Zero-Click Auto-Detect Geolocation:** Automatically detect visitor city, state, and country on arrival using Edge IP headers (plus an optional GPS *"Detect My Exact Location"* button) so listings, vendors, workers, and ads auto-filter to their city.
3. **True Multi-Language Accessibility:** Support **English (`en`), Hindi (`hi`), Punjabi (`pa`), Gujarati (`gu`), Tamil (`ta`), Marathi (`mr`), Telugu (`te`), Kannada (`kn`), Bengali (`bn`), and Arabic (`ar` RTL)** via `next-intl`, with automatic regional language suggestions based on detected state/country.
4. **Indian & Global Land Area Converter:** Real-time conversion across `Square Yards (Gaj)`, `Marla`, `Kanal`, `Bigha`, `Biswa`, `Murabba`, `Acre`, `Hectare`, `Sq.Ft`, and `Sq.M`, alongside global currency toggles (`INR ₹`, `USD $`, `AED`, `GBP £`).
5. **Builder Ad Tracking & Admin Manager:** Track real-time impressions, clicks, CTR, and OTP-verified Cost-Per-Lead (CPL) inquiries inside `/admin/ads`.
6. **Mandatory Legal, RERA & Data Privacy Compliance:** Dedicated pages for **Privacy Policy** (compliant with India's **DPDP Act 2023** & **GDPR** including a self-service Data Deletion/Export form), **Terms of Service** (IT Act Section 79 intermediary rules), **RERA Compliance Charter** (with state-wise HRERA, MahaRERA, UPRERA, RERA Punjab, GujRERA, TNRERA, and Dubai DLD verification links), **Cookie Policy**, and **Grievance Officer Redressal**, plus `<MandatoryConsentCheckbox />` storing `consentAcceptedAt` timestamps in PostgreSQL.
7. **Environment & Media Uploads (`.env.example`):** Wire up real file upload endpoints for property photos, RERA certificates, and builder brochures.
8. **Role-Based Dashboards (`/dashboard/...`):** Private logged-in dashboards for Buyers, Dealers/Builders, Vendors/Professionals, and Workers (with 1-tap *"Available Now / Busy"* toggle).
9. **Super-Admin Verification Console (`/admin`):** Approval queue to verify RERA certificates before granting the green **Verified Badge**, moderate reported listings, and manage Grievance Officer tickets.
10. **Interactive Map & Radius Search:** Toggleable List/Map view on property and service search pages with locality pins and 5 km / 10 km radius filters.
11. **Programmatic SEO & Dynamic Sitemaps:** Auto-generate dynamic `sitemap.xml` (split index for cities, properties, dealers, jobs) and canonical metadata across all SSR pages.
12. **Mobile-First Field UX:** Sticky mobile bottom navigation bar (`Home`, `Search`, `Post/Hire`, `Alerts`, `Profile`) and 1-tap floating Call/WhatsApp buttons tailored for field brokers and daily-wage workers.
13. **Progressive Web App (PWA):** Configure `manifest.json`, service worker offline caching, and an *"Add to Home Screen / होम स्क्रीन पर जोड़ें"* banner so mobile users can install ThePropertyPillar.com like a native app.
14. **Low-Bandwidth & Media Optimization:** Enforce `next/image` with automatic WebP/AVIF compression, lazy loading, and skeleton loaders for fast performance on weak 4G networks at construction sites.
15. **Payment Gateway & GST Invoicing:** Integrate **Razorpay** (UPI, Cards, NetBanking for India) and **Stripe** (for international users) to process Builder Ad packages, Dealer Pro subscriptions, and Featured Job boosts with downloadable PDF GST invoices.
16. **Voice Search & Audio Form Assist:** Add a microphone voice-input option (Web Speech API supporting `en-IN`, `hi-IN`, `pa-IN`, `gu-IN`, `ta-IN`) on the main search bar and 1-minute Blue-Collar Worker registration form.
17. **Anti-Spam, OTP & Rate Limiting:** Protect all public forms and OTP APIs with rate limiting, bot protection (Cloudflare Turnstile / reCAPTCHA), and mobile OTP verification.
18. **Automated Notification Hooks:** Modular notification services (WhatsApp Business API / SMS / SMTP) for instant lead alerts, RFQ notifications, and Smart Buyer Alert matches.
19. **WCAG Accessibility Compliance:** Proper ARIA labels, keyboard focus states, high contrast ratios, and scalable typography for global accessibility standards.
20. **GEO AI-Search Readiness (`llms.txt` & AI Bot Allowlist):** Maintain `/public/llms.txt`, dynamic `/api/llms-full.txt`, and explicit `robots.ts` permissions for `GPTBot`, `OAI-SearchBot`, `Google-Extended`, `PerplexityBot`, and `ClaudeBot`.
21. **AEO Rich Schema & Direct Answer Snippets:** Inject `FAQPage`, `HowTo`, `RealEstateListing`, `RealEstateAgent`, `LocalBusiness`, and `JobPosting` JSON-LD schemas with 40–60 word voice-ready answers on all key pages.
22. **Viral Seller Onboarding Funnels & Referral Engine:** Build `/for-dealers`, `/for-builders`, `/for-vendors`, and `/for-workers` landing pages with referral code tracking (`?ref=CODE`) and viral *"Powered by ThePropertyPillar.com"* micro-site badges.
23. **Social Media Architecture & 1-Click Poster Generator:** Provide reserved social handle slots (`socialLinks` JSON) on platform and dealer profiles, plus an `@vercel/og` social poster generator with WhatsApp/Instagram/Facebook/LinkedIn share triggers.
24. **Conversion & Analytics Tracking:** Wire modular event tracking (GA4, GTM, Meta Pixel + Conversions API) for seller signups, listing creations, RFQ submissions, and ad clicks.

---

## 7. ENVIRONMENT VARIABLES TEMPLATE (`.env.example`)
Save this as `.env.example` in your root directory before running Codex:

```env
# Database (PostgreSQL on Hostinger VPS / Managed DB)
DATABASE_URL="postgresql://postgres:password@localhost:5432/thepropertypillar?schema=public"

# Authentication (NextAuth.js)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-strong-32-char-random-secret"

# Site & AI Search Metadata
NEXT_PUBLIC_SITE_URL="https://thepropertypillar.com"
NEXT_PUBLIC_SITE_NAME="ThePropertyPillar"

# Geolocation & Interactive Maps
NEXT_PUBLIC_MAPS_PROVIDER="mapbox"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-google-maps-key"
NEXT_PUBLIC_MAPBOX_TOKEN="your-mapbox-token"

# Media & PDF Storage (Cloudinary / AWS S3 for Property Photos, Brochures, RERA Docs)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# Payment Gateways (Razorpay for India UPI/Cards + Stripe for Global)
RAZORPAY_KEY_ID="rzp_test_xxxxxxxxxxxx"
RAZORPAY_KEY_SECRET="your-razorpay-secret"
STRIPE_SECRET_KEY="sk_test_xxxxxxxxxxxx"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_xxxxxxxxxxxx"

# SMS / WhatsApp OTP & Smart Buyer Alerts (MSG91 / Interakt / Twilio)
WHATSAPP_API_PROVIDER="msg91"
WHATSAPP_API_KEY="your-whatsapp-api-key"
SMS_OTP_TEMPLATE_ID="your-dlt-template-id"

# Transactional Emails (Resend / Hostinger SMTP)
SMTP_HOST="smtp.hostinger.com"
SMTP_PORT="465"
SMTP_USER="alerts@thepropertypillar.com"
SMTP_PASSWORD="your-email-password"

# Security & Bot Protection (Cloudflare Turnstile)
NEXT_PUBLIC_TURNSTILE_SITE_KEY="your-turnstile-site-key"
TURNSTILE_SECRET_KEY="your-turnstile-secret-key"

# Analytics & Ad Attribution (Optional)
NEXT_PUBLIC_GA_ID="G-XXXXXXXXXX"
NEXT_PUBLIC_GTM_ID="GTM-XXXXXXX"
NEXT_PUBLIC_META_PIXEL_ID="your-meta-pixel-id"
```

---

## 8. STEP-BY-STEP CODEX EXECUTION PROMPTS
Run these **7 prompts in exact order** inside Codex after saving this file as `PROJECT_CONTEXT.md` in your root folder.

### Prompt 1 — Project Setup, Prisma Schema & Multi-Language Foundation
```text
Read PROJECT_CONTEXT.md completely first so you understand our full business vision, 9 user roles, 5 Pillars, AEO/SEO/GEO rules, viral seller growth engine, and all 24 mandatory rules before writing any code.

Step 1: Initialize a production-grade Next.js 15 (App Router) + TypeScript + Tailwind CSS + Shadcn/UI + Prisma + PostgreSQL project for "ThePropertyPillar.com" configured as a Progressive Web App (PWA).
1. Configure `next-intl` with `/src/app/[locale]/...` supporting English (`en`), Hindi (`hi`), Punjabi (`pa`), Gujarati (`gu`), Tamil (`ta`), Marathi (`mr`), Telugu (`te`), Kannada (`kn`), Bengali (`bn`), and Arabic (`ar` with RTL layout support).
2. Create `prisma/schema.prisma` with complete relational models, indexes, and enums for `User` (including `referralCode`, `referredBy`, `socialLinks` Json), `DealerProfile` (with unique `slug` for `/dealer/[slug]`, `reraNumber`, `socialLinks` Json), `Property` (supporting `GAJ`, `MARLA`, `KANAL`, `BIGHA`, `BISWA`, `MURABBA`, `ACRE`, `HECTARE`, `SQFT`, `SQM`), `BuyerAlert`, `ServiceProvider`, `MaterialProduct`, `MaterialRFQ`, `MaterialQuote`, `JobPosting` (white-collar), `BlueCollarWorker` (1-minute profile with `availableNow` toggle), `LoanInquiry`, `BuilderAdCampaign`, `SubscriptionOrder` (Razorpay/Stripe + GST invoice metadata), `GrievanceTicket`, and `AuditLog`.
3. Create `prisma/seed.ts` with realistic Indian & global sample data (Panchkula, Chandigarh, Delhi NCR, Mumbai, Bengaluru, Dubai) and generate initial translation JSON files for `en`, `hi`, `pa`, `gu`, and `ta`.
```

### Prompt 2 — Market-Leading Homepage UI, Clear 5-Pillar Hub, Voice Search & "How to Use" Guides
```text
Read PROJECT_CONTEXT.md first.

Step 2: Build the Homepage, Global Header, Sticky Mobile Bottom Navigation, PWA Install Prompt, Voice Search, and Reusable "How to Use" Guide System for "ThePropertyPillar.com".
1. Design System: Crisp architectural off-white (`#F8FAFC`), deep slate navy (`#0F172A`), warm amber/terracotta (`#D97706`) for primary CTAs, emerald (`#059669`) for RERA-verified badges, and regional font fallbacks (`Noto Sans Devanagari / Gurmukhi / Gujarati / Tamil`).
2. 5-Pillar Command Center: Directly in the Hero section, display 5 clear, high-contrast interactive Pillar Cards (1. Buy/Sell/Rent & Dealers, 2. Construction Materials & RFQs, 3. Home Loans, Legal & Vastu, 4. Architects, Contractors & Interiors, 5. White & Blue-Collar Jobs) that dynamically switch the Hero Search Bar (with built-in Web Speech API microphone voice search) and quick actions.
3. Built-in `<HowToUseGuide />` component: Create a collapsible banner + interactive 3-step visual modal in simple everyday language (translated across all active languages) embedded at the top of every Pillar section so first-time users and daily-wage workers know exactly how to use each feature.
4. Mobile-First UX & Social Footer: Add a sticky mobile bottom navigation bar (`Home`, `Search`, `Post/Hire`, `Alerts`, `Dashboard`), PWA "Add to Home Screen" banner, and global footer with social media channel slots and RERA disclaimer.
```

### Prompt 3 — Zero-Click Geolocation, Language Auto-Suggest & Area/Currency Converter
```text
Read PROJECT_CONTEXT.md first.

Step 3: Build the Auto-Detect Geolocation Engine, Regional Language Switcher, and Land Area / Currency Converter.
1. Geolocation System (`/src/components/location/LocationDetector.tsx` & `/src/lib/geo.ts`):
   - Automatically detect the visitor's city, state, and country on first load via Edge IP geolocation headers (`x-vercel-ip-city`, `cf-ipcity`, or IP fallback API) without blocking popups.
   - Include an optional "Detect My Exact GPS Location" button inside the City Selector modal using browser `navigator.geolocation` + reverse geocoding for sector-level precision.
   - Persist selected city in cookies + `localStorage` so all listings, vendors, workers, and builder ads auto-filter to the user's city.
2. Regional Language Auto-Suggest: Suggest the local language banner based on detected state (e.g., Punjabi in Punjab, Gujarati in Gujarat, Tamil in Tamil Nadu, Hindi in Haryana/Delhi/UP) with a 1-click switch.
3. Real-Time Area & Currency Converter (`/src/lib/converters.ts`): Support instant conversion between `Gaj (Sq.Yd)`, `Marla`, `Kanal`, `Bigha`, `Biswa`, `Murabba`, `Acre`, `Hectare`, `Sq.Ft`, and `Sq.M`, plus currency switching (`INR ₹`, `USD $`, `AED`, `GBP £`).
```

### Prompt 4 — All 5 Pillar Workflows, Map View, Payments & Role-Based Dashboards
```text
Read PROJECT_CONTEXT.md first.

Step 4: Build the functional pages, interactive Map/List toggle, API routes (with OTP & rate limiting), Razorpay/Stripe checkout, and Role-Based Dashboards (`/dashboard/...`) for all 5 Pillars, ensuring every page includes its own `<HowToUseGuide />`:
1. Automated Dealer Micro-Sites (`/src/app/[locale]/dealer/[slug]/page.tsx`): Public SEO/GEO-indexed portfolio page auto-generated on dealer signup with RERA badge, cities served, social links, active listings, viral *"Powered by ThePropertyPillar.com"* badge, and 1-tap Share Digital Visiting Card & WhatsApp CTAs.
2. Property Search + Map View + Smart Buyer Alerts (`/src/app/[locale]/properties/page.tsx`): Toggleable List/Map view with radius filter, local area units, RERA-verified filter, and "Save Search & Get Instant WhatsApp/Email Alerts".
3. Construction Materials & Bulk RFQ Engine (`/src/app/[locale]/materials/page.tsx`): Category catalog + multi-item RFQ submission form for homeowners/contractors and quote comparison dashboard for vendors.
4. Home Loans & Legal/Vastu Directory (`/src/app/[locale]/finance-services/page.tsx`): Interactive EMI & Borrowing Eligibility Calculators with partner bank lead routing + filterable RERA Lawyers, Vastu Consultants, Architects, and Contractors directory.
5. Dual Jobs & 1-Minute Blue-Collar Hiring (`/src/app/[locale]/jobs/page.tsx`): Tab A for White-Collar Jobs (resume upload & filters); Tab B for 60-second Blue-Collar Worker registration (Name, Phone OTP, voice-assisted Trade/City input, Daily Rate) with direct Call/WhatsApp worker cards.
6. Role-Based Dashboards (`/src/app/[locale]/dashboard/...`): Tailored dashboards for Buyers, Dealers/Builders, Vendors/Professionals, and Workers (with 1-tap "Available Now / Busy" toggle), plus Razorpay/Stripe checkout for Pro plans and Featured boosts.
```

### Prompt 5 — Day-1 AEO, SEO, GEO (AI Search Engine) & Viral Seller Acquisition System
```text
Read PROJECT_CONTEXT.md first.

Step 5: Implement the complete Day-1 AEO, SEO, GEO (ChatGPT, Gemini, Perplexity visibility) and Viral Seller Growth Engine so sellers, dealers, builders, and vendors discover and join ThePropertyPillar.com automatically.
1. GEO & AI Crawler Architecture:
   - Create `src/app/robots.ts` explicitly allowing `GPTBot`, `OAI-SearchBot`, `Google-Extended`, `PerplexityBot`, `ClaudeBot`, `Applebot-Extended`, and `Bingbot` across all public pages.
   - Create `/public/llms.txt` and dynamic `/src/app/api/llms-full.txt/route.ts` outputting a structured Markdown knowledge base of ThePropertyPillar.com's 5 Pillars, free automated dealer micro-sites, supported cities, area units, and seller registration instructions so AI assistants cite and recommend the platform on day one.
2. AEO & Rich JSON-LD Knowledge Graph (`/src/components/seo/JsonLd.tsx`):
   - Inject valid Schema.org JSON-LD (`Organization`, `WebSite` with `SearchAction`, `RealEstateListing`, `RealEstateAgent`, `LocalBusiness`, `JobPosting`, `HowTo`, `BreadcrumbList`, and `FAQPage` with 40–60 word voice-ready answers) across all routes.
   - Create dynamic `/src/app/sitemap.ts` generating indexable XML sitemaps for cities, localities, properties, dealers, and seller landing pages.
3. Viral Seller Onboarding & Social Poster Engine:
   - Build dedicated high-converting landing pages: `/for-dealers`, `/for-builders`, `/for-vendors`, and `/for-workers` with clear benefit comparison tables, `FAQPage` schema, and referral code tracking (`?ref=CODE`).
   - Build `/src/app/api/og/route.tsx` (`@vercel/og`) to auto-generate branded social sharing posters (with price, city, RERA badge, and QR code) plus a 1-click "Share on WhatsApp / Instagram / Facebook / LinkedIn" modal inside seller dashboards.
   - Add modular GA4, GTM, and Meta Pixel event hooks for conversion tracking.
```

### Prompt 6 — Builder Advertising Engine & Super-Admin Verification Console
```text
Read PROJECT_CONTEXT.md first.

Step 6: Build the Builder Advertising Monetization Engine and Super-Admin Moderation Console.
1. Native Builder Ad Components (`/src/components/ads/`):
   - `<HomepageHeroSpotlight />`, `<SponsoredProjectCard />` (injected cleanly at Positions #1 and #4 in matching city/budget search results), `<CityTakeoverBanner />`, and `<EmiSidebarAd />`.
   - API routes (`/api/ads/impression` and `/api/ads/click`) tracking live impressions, clicks, CTR, and verified Cost-Per-Lead (CPL) inquiries.
2. Super-Admin Verification & Moderation Console (`/src/app/[locale]/admin/...`):
   - RERA Certificate & Listing Approval Queue (granting the green Verified Badge).
   - Builder Ad Campaign Manager (create, schedule, target by city/budget, and view analytics).
   - Platform Social Links Manager, City/Locality Master Manager, and Grievance Redressal Ticket Inbox.
```

### Prompt 7 — Mandatory Legal, RERA, DPDP/GDPR & Cookie Compliance Suite
```text
Read PROJECT_CONTEXT.md first.

Step 7: Build the complete Legal, RERA, and Data Privacy Compliance Suite for "ThePropertyPillar.com".
1. Dedicated Policy Pages (`/src/app/[locale]/legal/...`):
   - `/legal/privacy-policy`: Compliant with India's Digital Personal Data Protection (DPDP) Act 2023 and GDPR—detailing collection/encryption of phone numbers, geolocation, RERA docs, and worker profiles, plus a working self-service "Request Data Export / Deletion" form.
   - `/legal/terms-of-service`: Full marketplace intermediary terms (IT Act Section 79), dealer verification rules, RFQ rules, job board disclaimers, and builder ad terms.
   - `/legal/rera-compliance`: Mandatory RERA disclosure guidelines with direct verification links to Indian state RERA portals (HRERA, MahaRERA, UPRERA, RERA Punjab, GujRERA, TNRERA) and global registries (Dubai DLD), plus a "Report Unverified Listing" workflow.
   - `/legal/cookie-policy` & `/legal/grievance-redressal` (with Grievance Officer details and ticket submission form).
2. Enforced Consent Components (`/src/components/compliance/`):
   - `<CookieAndGeoConsentBanner />` on first visit.
   - `<MandatoryConsentCheckbox />` enforced on all Sign-Up, Property Listing, Loan Inquiry, Material RFQ, and Blue-Collar Worker forms, saving `consentAcceptedAt` timestamps in PostgreSQL.
   - `<ReraDisclaimerFooter />` in the global footer.
```
