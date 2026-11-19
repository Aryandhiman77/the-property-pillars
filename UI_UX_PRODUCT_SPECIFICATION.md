# ThePropertyPillar.com — UI/UX and Functional Product Specification

**Document status:** Phase 0 product contract  
**Version:** 1.0-draft  
**Prepared:** 18 November 2026  
**Database name:** `the-property-pillar`  
**Frontend:** Next.js 15 App Router + TypeScript  
**Backend:** Node.js + Express 5 + TypeScript  
**Primary database:** PostgreSQL + Prisma  

---

## 1. Document authority and source of truth

This specification converts the following two approved root documents into an implementation-ready UI/UX and API contract:

1. `ThePropertyPillar_Master_Blueprint_v2_Updated (1) (1).md`
2. `PROJECT_EXPLANATION_HINGLISH.txt`

If this document conflicts with either source, the two source documents win until the owner explicitly approves a change. This document may add implementation detail needed to make a feature buildable, but it must not remove or silently change a source requirement.

### 1.1 Fixed product facts

- Product name: **ThePropertyPillar.com**
- Launch market: India, with global-ready architecture.
- Core pillars: Property; Materials/RFQ; Finance/Legal/Vastu; Construction/Professional Services; Jobs/Skilled Manpower.
- Supported roles: `BUYER`, `OWNER`, `DEALER`, `BUILDER`, `VENDOR`, `PROFESSIONAL`, `WHITE_COLLAR_SEEKER`, `BLUE_COLLAR_WORKER` and `ADMIN`.
- Supported locales: `en`, `hi`, `pa`, `gu`, `ta`, `mr`, `te`, `kn`, `bn` and `ar`. Arabic uses RTL layout.
- Supported display currencies: INR, USD, AED and GBP.
- Supported area units: GAJ/Square Yard, MARLA, KANAL, BIGHA, BISWA, MURABBA, ACRE, HECTARE, SQFT and SQM.
- Every primary pillar and important form must include a contextual **How to use** guide.
- Mobile is the primary interaction target; desktop remains fully supported.

### 1.2 Necessary implementation decisions

These decisions resolve gaps without changing the product vision:

- Use a pnpm monorepo with `apps/web` for Next.js and `apps/api` for Express.
- All business APIs live in the Node.js backend under `/api/v1`. Next.js route handlers are limited to frontend-native concerns such as dynamic OpenGraph image rendering.
- PostgreSQL must be created with the quoted name `"the-property-pillar"` because the identifier contains hyphens.
- `WHITE_COLLAR_SEEKER` covers both candidates and employers from the blueprint. A `jobAccountMode` value of `SEEKER`, `EMPLOYER` or `BOTH` controls the dashboard experience.
- `ADMIN` covers moderators and super-admins. `adminLevel` is `MODERATOR`, `OPERATIONS_ADMIN` or `SUPER_ADMIN`.
- The first selected role is `primaryRole`. Architecture should permit later multi-role expansion without duplicating phone numbers or accounts.
- All identifiers are UUIDs. All stored timestamps are UTC ISO-8601; UI renders them in the user’s selected timezone.
- Human-facing reference numbers are separate from UUIDs, for example `TPP-PROP-2026-000123`.
- Currency conversion and region-dependent land-unit conversion require dated rates/rules and must show the applied rate or regional assumption.
- AI crawler access, schema and `llms.txt` improve discoverability; the UI must never promise guaranteed citation or ranking.

---

## 2. Product experience in one flow

1. A visitor lands on a localized homepage.
2. The platform estimates city/state/country from edge headers without a permission popup.
3. The visitor may confirm/change the city or request exact GPS detection.
4. The visitor selects one of the five pillars; the hero search and quick actions change context.
5. Public search/results pages work without login.
6. Login is requested only for saving, posting, applying, quoting, contacting protected leads or paying.
7. Mobile OTP verifies the phone number.
8. Role-based onboarding collects only the minimum information needed for the selected task.
9. Submissions are validated, consented, persisted and assigned a visible status/reference number.
10. Where verification is required, admins review the submission before public visibility.
11. Notifications are sent through in-app plus configured WhatsApp, SMS or email channels.
12. The role dashboard always shows the next useful action, pending work and status explanation.

---

## 3. Technical product boundary

### 3.1 Proposed repository shape

```text
apps/
  web/                  # Next.js 15 public site, dashboards, PWA and SSR
  api/                  # Express REST API, workers, webhooks and OpenAPI
packages/
  ui/                   # Shared design-system components
  contracts/            # Shared Zod schemas/types generated from API contracts
  config/               # ESLint, TypeScript and Tailwind presets
apps/api/prisma/
  schema.prisma
  seed.ts
docs/
  # Future architecture and operating documents
```

### 3.2 Supporting services

| Concern | Planned provider/technology | Product behaviour |
|---|---|---|
| Database | PostgreSQL/Prisma | System of record; database name is `the-property-pillar` |
| Cache/queues | Redis/BullMQ or equivalent | OTP expiry, rate limits and asynchronous notifications; never the only business-data copy |
| Media | Local uploads folder | Authenticated image upload, image decoding and WebP optimization. Private RERA documents use a separate workflow. |
| Maps | Mapbox or Google Maps | Search pins, geocoding, reverse geocoding and radius filters |
| India payments | Razorpay | UPI, cards and NetBanking |
| OTP/WhatsApp | MSG91, Interakt or Twilio adapter | Provider-neutral notification interface |
| Email | SMTP/Resend adapter | Transactional alerts and receipts |
| Bot protection | Cloudflare Turnstile/reCAPTCHA | Required on exposed forms and OTP issuance |
| Analytics | GA4, GTM and Meta adapters | Consent-aware conversion events |

---

## 4. Information architecture and route map

All localized public routes use `/{locale}/...`. English is the default locale, but canonical URLs must have one consistent policy.

### 4.1 Public routes

| Route | Screen purpose | Primary CTA |
|---|---|---|
| `/{locale}` | Five-pillar homepage command centre | Search or choose a pillar |
| `/{locale}/properties` | Property list/map search | View property / Save search |
| `/{locale}/properties/{propertySlug}` | Property detail and inquiry | Call, WhatsApp, Request site visit |
| `/{locale}/buy/{city}/{locality?}` | Programmatic buy landing page | Explore listings |
| `/{locale}/rent/{city}/{locality?}` | Programmatic rent landing page | Explore rentals |
| `/{locale}/dealers/{city?}` | Dealer directory | View dealer profile |
| `/{locale}/dealer/{agencySlug}` | Dealer automated micro-site | WhatsApp / Share visiting card |
| `/{locale}/materials` | Material catalogue and RFQ entry | Request bulk quotes |
| `/{locale}/materials/{categorySlug}` | Material category results | Add item to RFQ |
| `/{locale}/finance-services` | EMI/eligibility and directories | Calculate / Request callback |
| `/{locale}/professionals` | Professional directory | Request service |
| `/{locale}/professionals/{profileSlug}` | Professional public profile | Call / Request quote |
| `/{locale}/jobs` | White- and blue-collar tabs | Find jobs / Find workers |
| `/{locale}/jobs/{jobSlug}` | White-collar job detail | Apply now |
| `/{locale}/workers/{city}/{trade?}` | Local worker results | Call / WhatsApp |
| `/{locale}/for-dealers` | Dealer acquisition funnel | Create free dealer website |
| `/{locale}/for-builders` | Builder acquisition funnel | Register project |
| `/{locale}/for-vendors` | Vendor acquisition funnel | Start receiving RFQs |
| `/{locale}/for-workers` | Worker acquisition funnel | Create worker profile |
| `/{locale}/guides/{guideSlug}` | RERA/loan/property guides | Related task CTA |
| `/{locale}/legal/privacy-policy` | Privacy policy and data rights | Export/delete request |
| `/{locale}/legal/terms-of-service` | Terms | — |
| `/{locale}/legal/rera-compliance` | RERA charter and report flow | Report listing |
| `/{locale}/legal/cookie-policy` | Cookie policy | Manage preferences |
| `/{locale}/legal/grievance-redressal` | Grievance process | Submit grievance |

### 4.2 Authenticated dashboard routes

| Route | Audience |
|---|---|
| `/{locale}/dashboard` | Role-aware overview router |
| `/{locale}/dashboard/profile` | All authenticated users |
| `/{locale}/dashboard/notifications` | All authenticated users |
| `/{locale}/dashboard/buyer/*` | Buyer |
| `/{locale}/dashboard/owner/*` | Owner |
| `/{locale}/dashboard/dealer/*` | Dealer |
| `/{locale}/dashboard/builder/*` | Builder |
| `/{locale}/dashboard/vendor/*` | Vendor |
| `/{locale}/dashboard/professional/*` | Professional |
| `/{locale}/dashboard/jobs/*` | White-collar seeker/employer |
| `/{locale}/dashboard/worker/*` | Blue-collar worker |
| `/{locale}/admin/*` | Authorized admin levels only |

---

## 5. Navigation model

### 5.1 Desktop header

- Logo
- Buy
- Rent
- Dealers
- Materials
- Loans & Services
- Jobs & Workers
- City selector
- Language selector
- **Post / Hire** primary CTA
- Sign in or avatar/dashboard menu

### 5.2 Mobile bottom navigation

| Label | Internal destination | Behaviour |
|---|---|---|
| Home | `nav.home` | Returns to localized homepage |
| Search | `nav.search` | Opens last-used pillar search; defaults to Property |
| Post / Hire | `nav.create` | Opens role/task chooser bottom sheet |
| Alerts | `nav.alerts` | Logged-out user sees sign-in sheet; logged-in user sees alerts/notifications |
| Dashboard | `nav.dashboard` | Logged-out user sees OTP login; logged-in user sees role panel |

### 5.3 Post / Hire task chooser

Options: Post property, Request material quotes, Request a loan callback, Hire a professional, Post a white-collar job, Register as a worker, Find workers. Options unsupported by the current role start an onboarding/role-capability flow instead of failing.

---

## 6. Design system

### 6.1 Visual direction

The interface should feel trustworthy, architectural and useful in the field—not luxury-only and not a generic admin template.

| Token | Value | Use |
|---|---|---|
| `surface.page` | `#F8FAFC` | Main off-white page |
| `text.primary` | `#0F172A` | Headings and high-emphasis text |
| `action.primary` | `#D97706` | Main CTA; use carefully, one dominant action per area |
| `status.verified` | `#059669` | Verified/success states |
| `status.info` | accessible blue | Informational state |
| `status.warning` | accessible amber | Pending/action required |
| `status.danger` | accessible red | Failed/rejected/destructive |
| `border.default` | slate neutral | Cards, fields and divisions |

Font stack: Inter or a clean Latin UI font, then Noto Sans Devanagari, Gurmukhi, Gujarati and Tamil. Arabic uses a compatible Noto Arabic face and mirrored layout primitives.

### 6.2 Layout rules

- Mobile baseline: 360 px; also test 320 px.
- Breakpoints: mobile, tablet, desktop and wide desktop.
- Content width: approximately 1280 px, except map/result split view.
- Touch targets: minimum 44 × 44 px.
- Form fields: one column on mobile; related pairs may use two columns on desktop.
- Sticky mobile primary action is allowed only when it does not cover consent/errors.
- Property photography uses consistent aspect ratios and responsive `next/image`.
- Status is always communicated with text/icon as well as colour.

### 6.3 Core reusable components

- `GlobalHeader` and `MobileBottomNav`
- `PillarCard` and context-aware `HeroSearch`
- `HowToUseGuide` with collapsed summary and 3-step modal
- `LocationSelector` and `ExactLocationButton`
- `LanguageSuggestionBanner`
- `AreaCurrencyConverter`
- `PropertyCard`, `ProjectCard`, `DealerCard`, `ProviderCard`, `WorkerCard` and `JobCard`
- `ListMapToggle`, `RadiusFilter` and `FilterDrawer`
- `VerifiedBadge` with accessible explanation
- `StatusBadge` and `StatusTimeline`
- `MandatoryConsentCheckbox`
- `PhoneOtpField`
- `MediaUploader` with progress/retry/reorder
- `EmptyState`, `ErrorState`, `Skeleton` and `OfflineBanner`
- `CallButton`, `WhatsAppButton` and `SharePosterDialog`
- `DataTable` for dashboards/admin
- `ConfirmActionDialog` for state-changing actions
- `ReraDisclaimerFooter` and `CookieAndGeoConsentBanner`

---

## 7. Global UX rules

### 7.1 Every form

1. Show a plain-language title, purpose and expected completion time.
2. Mark required fields with text, not colour alone.
3. Use inline validation after blur and a top error summary after submit.
4. Preserve valid entered data after errors.
5. Multi-step forms auto-save authenticated drafts.
6. Show upload size/type rules before file selection.
7. Require the relevant consent checkbox before submission.
8. Disable only the submit action while processing; navigation remains understandable.
9. On success show reference number, current status, what happens next and a dashboard link.
10. Prevent duplicate submissions using an idempotency key.

### 7.2 Standard interface states

| State | Required UI |
|---|---|
| Initial loading | Layout-matched skeleton; never a blank page |
| Background refresh | Small non-blocking indicator; keep existing data |
| Empty | Explain why empty and show one useful CTA |
| Validation error | Field message plus focusable error summary |
| API/network error | Human message, retry action and request ID for support |
| Offline | Offline banner; cache safe public content; queue no financial submission silently |
| Unauthorized | Sign-in prompt preserving intended return URL |
| Forbidden | Explain missing permission and link to correct dashboard |
| Not found | Contextual alternatives and search |
| Rate limited | Countdown based on `Retry-After`; do not keep resending |
| Success | Toast for small actions; dedicated confirmation for major submissions |
| Destructive action | Consequence, affected item and explicit confirmation |

### 7.3 Privacy and sensitive data

- RERA certificates, resumes, phone numbers and financial inputs are not public by default.
- Public phone display requires explicit profile/contact preference.
- Never expose private media storage URLs directly.
- Do not ask for Aadhaar/PAN in an MVP form unless a verified legal/business need is approved.
- Exact worker/home location must not be public; show city/locality or approximate radius only.
- Analytics and marketing pixels obey cookie consent.

---

## 8. API contract conventions

### 8.1 Base rules

- Base path: `/api/v1`
- Content type: JSON, except signed uploads/downloads and provider webhooks.
- Authentication: secure HttpOnly session/refresh cookie; CSRF protection for browser mutations.
- Authorization: backend role/capability check on every protected endpoint.
- Validation: shared schemas; server remains authoritative.
- Lists: cursor pagination by default with `limit` capped by the API.
- Filtering: query parameters; sorting allowlist only.
- Idempotency: `Idempotency-Key` header required for major create/payment endpoints.
- Request tracing: return `requestId` in every response.
- API documentation: generated OpenAPI at a protected non-production route and exported artifact.

### 8.2 Response envelopes

Success:

```json
{
  "data": {},
  "meta": {
    "requestId": "uuid",
    "nextCursor": null
  }
}
```

Error:

```json
{
  "error": {
    "code": "PROPERTY_VALIDATION_FAILED",
    "message": "Please correct the highlighted fields.",
    "fieldErrors": {
      "priceAmount": "Enter an amount greater than zero."
    },
    "requestId": "uuid"
  }
}
```

### 8.3 Common HTTP behaviour

| Code | Use |
|---|---|
| 200 | Read/update/action completed |
| 201 | Resource created |
| 202 | Accepted for asynchronous processing |
| 204 | Successful delete with no body |
| 400 | Invalid request shape/business rule |
| 401 | Not authenticated |
| 403 | Authenticated but not allowed |
| 404 | Resource unavailable to caller |
| 409 | Duplicate or invalid state transition |
| 422 | Field validation errors |
| 429 | Rate limit exceeded |
| 500 | Unexpected server failure with request ID |

### 8.4 Upload pattern

1. Client requests signed upload intent.
2. Backend checks role, purpose, MIME type and quota.
3. Client uploads directly to storage.
4. Client confirms upload token.
5. Backend performs/awaits virus and media validation.
6. Resource changes from `SCANNING` to `READY` or `REJECTED`.

Endpoints:

- `POST /api/v1/uploads/intents`
- `POST /api/v1/uploads/{uploadId}/complete`
- `GET /api/v1/uploads/{uploadId}`
- `DELETE /api/v1/uploads/{uploadId}`

---

## 9. Cross-platform status dictionary

Status values are API constants. UI labels are localized and may be friendlier, but the internal value never changes by language.

### 9.1 Account status

| Internal status | UI label | When set | UI/system effect |
|---|---|---|---|
| `PENDING_VERIFICATION` | Verify phone | Registration started but OTP not verified | No protected publishing/contact actions |
| `ACTIVE` | Active | OTP verified and account enabled | Normal role access |
| `SUSPENDED` | Suspended | Admin/security action | Sessions revoked; read-only appeal/grievance access |
| `DEACTIVATED` | Deactivated | User temporarily deactivates account | Public profiles hidden; reversible after login verification |
| `DELETION_SCHEDULED` | Deletion requested | Verified deletion request accepted | Show effective date; restrict new activity |
| `DELETED` | Deleted | Retention/legal workflow completed | Personal data deleted/anonymized as policy permits |

### 9.2 Verification status

| Status | UI label | Update trigger | Result |
|---|---|---|---|
| `NOT_SUBMITTED` | Not submitted | No documents received | No verified badge |
| `PENDING` | Under review | Valid submission received | Private review queue entry |
| `CHANGES_REQUESTED` | Action required | Admin asks for corrected evidence | Owner can replace documents and resubmit |
| `VERIFIED` | Verified | Authorized admin approves | Green badge and verification timestamp visible |
| `REJECTED` | Not verified | Evidence invalid/ineligible | No badge; reason and appeal/resubmit path shown |
| `EXPIRED` | Verification expired | Expiry date/rule reached | Badge removed until renewal |
| `REVOKED` | Verification revoked | Fraud/regulatory/admin action | Badge removed, audit event and notice generated |

### 9.3 Media status

| Status | Meaning |
|---|---|
| `PENDING_UPLOAD` | Upload intent created |
| `UPLOADING` | Bytes are being transferred |
| `SCANNING` | Uploaded; checks in progress |
| `READY` | Safe and usable |
| `FAILED` | Transfer/processing failed; retry allowed |
| `REJECTED` | Type/content/security rules failed |
| `DELETED` | Removed from active use and queued for storage cleanup |

Detailed module statuses are defined inside each functionality section below.

---

## 10. Authentication, referral and onboarding

### 10.1 Screens

- Phone sign-in sheet/page
- OTP verification
- Primary role selection
- Minimal identity form
- Role-specific onboarding
- Referral attribution confirmation (non-blocking)
- Consent and notification preferences

### 10.2 Sign-in / registration form

| UI label | Internal key | Type | Required | Validation/behaviour |
|---|---|---|---|---|
| Country code | `phoneCountryCode` | select | Yes | Default from country; user can change |
| Mobile number | `phoneNumber` | tel | Yes | E.164 validation after combining country code |
| I agree to Terms and Privacy Policy | `legalConsentAccepted` | checkbox | Yes | Store policy versions and `consentAcceptedAt` |
| Send me useful updates on WhatsApp | `whatsappMarketingConsent` | checkbox | No | Separate from transactional messages |
| Security check | `turnstileToken` | hidden/widget | Yes when challenged | Server verifies token |
| Referral code | `referralCode` | hidden/text | No | Prefilled from `?ref=CODE`; user may remove before signup |

Submit label: **Continue with mobile OTP**.

On submission:

1. Normalize phone, validate consent and bot token.
2. Apply phone/IP/device rate limits.
3. Create a short-lived OTP challenge; do not reveal whether an account exists.
4. Send OTP using configured adapter.
5. Route to verification with masked number and resend countdown.

### 10.3 OTP form

| Label | Key | Type | Required | Rule |
|---|---|---|---|---|
| 6-digit OTP | `otpCode` | numeric OTP | Yes | Exactly configured length; paste supported |
| Trust this device | `rememberDevice` | checkbox | No | Creates rotating longer session only on success |

Actions: **Verify and continue**, **Resend OTP**, **Change number**.

Successful new user: create user with `ACTIVE` account status, preserve referral attribution, then open role selection. Successful returning user: restore intended route.

### 10.4 Role selection form

Cards use plain labels:

| Internal role | Card label |
|---|---|
| `BUYER` | Buy, rent or invest |
| `OWNER` | List my own property |
| `DEALER` | I am a property dealer / broker |
| `BUILDER` | I am a builder / developer |
| `VENDOR` | I sell construction materials |
| `PROFESSIONAL` | I provide property/construction services |
| `WHITE_COLLAR_SEEKER` | Find talent or a professional job |
| `BLUE_COLLAR_WORKER` | Find construction work |

`ADMIN` is never self-selected. It is assigned through a secure admin process.

Common onboarding fields:

| Label | Key | Type | Required | Rule |
|---|---|---|---|---|
| Full name | `fullName` | text | Yes | 2–100 characters |
| Email address | `email` | email | No initially | Verification required before email alerts |
| City | `cityId` | searchable select | Yes | Must use city master |
| Preferred language | `preferredLocale` | select | Yes | Defaults from locale/detection |
| Profile photo | `avatarUploadId` | image upload | No | READY upload only |
| Notification preference | `notificationChannels` | multi-select | Yes | At least in-app; transactional consent rules apply |

### 10.5 API routes

- `POST /api/v1/auth/otp/request`
- `POST /api/v1/auth/otp/verify`
- `POST /api/v1/auth/otp/resend`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/session`
- `POST /api/v1/onboarding/role`
- `PATCH /api/v1/users/me`
- `GET /api/v1/referrals/{code}/preview`
- `PATCH /api/v1/users/me/notification-preferences`

---

## 11. Homepage, global search and utility experiences

### 11.1 Homepage order

1. Location/language suggestion strip
2. Header
3. Hero value proposition
4. Five pillar cards
5. Context-aware hero search
6. Relevant quick actions
7. Optional builder hero spotlight clearly labelled **Featured Project**
8. Trust/verification explanation
9. Featured/local content by pillar
10. How-to-use section
11. Dealer/vendor/worker acquisition CTA
12. Local market fact table and FAQs
13. Legal/RERA footer and social channels

### 11.2 Context-aware hero search

| Pillar | Search label/placeholder | Fields | Submit destination |
|---|---|---|---|
| Property | Search properties | Intent, city/locality, property type, budget | `/properties` |
| Materials | Find materials or request bulk quotes | Category/product, city | `/materials` |
| Loan/Legal/Vastu | Calculate or find a verified expert | Service type, city | `/finance-services` |
| Construction services | Find architects and contractors | Profession, city | `/professionals` |
| Jobs/Workers | Find jobs or available workers | Mode, keyword/trade, city | `/jobs` or `/workers/...` |

Voice button label: **Search by voice**. Before microphone permission, explain why it is needed. Always show transcribed text for confirmation.

### 11.3 Location selector fields

| Label | Key | Type | Behaviour |
|---|---|---|---|
| Country | `countryCode` | select | Filters states and currency suggestion |
| State / Emirate / Region | `stateId` | searchable select | Dynamic label by country |
| City | `cityId` | searchable select | Persist to cookie/localStorage/account |
| Locality | `localityId` | searchable select | Optional global preference |

Actions: **Use selected location**, **Detect my exact location**, **Use estimated city**.

Location source values: `EDGE_IP`, `GPS`, `USER_SELECTED`, `ACCOUNT_PROFILE`. User-selected/account values take precedence. Exact coordinates are stored only when required and consented.

### 11.4 Area/currency converter

Fields:

- **Area value** — `areaValue`, positive decimal.
- **From unit** — `fromAreaUnit`.
- **To unit** — `toAreaUnit`.
- **Region** — `conversionRegionId`, required for region-dependent units.
- **Amount** — `currencyAmount`.
- **From currency** — `fromCurrency`.
- **To currency** — `toCurrency`.

Display the conversion timestamp, rate source and a disclaimer for indicative results.

### 11.5 API routes

- `GET /api/v1/location/detect`
- `POST /api/v1/location/reverse-geocode`
- `GET /api/v1/locations/countries`
- `GET /api/v1/locations/states?countryCode=`
- `GET /api/v1/locations/cities?stateId=&query=`
- `GET /api/v1/locations/localities?cityId=&query=`
- `PATCH /api/v1/users/me/location`
- `GET /api/v1/conversions/area?value=&from=&to=&regionId=`
- `GET /api/v1/conversions/currency?amount=&from=&to=`
- `GET /api/v1/search/suggestions?context=&query=&cityId=`

---

## 12. Property marketplace

### 12.1 Screens and behaviour

| Screen | Frontend route | Behaviour |
|---|---|---|
| Search | `/{locale}/properties` | Shareable filters, list/map toggle, mobile filter drawer, radius search |
| Detail | `/{locale}/properties/{propertySlug}` | Gallery, facts, price/area conversion, map, RERA state, seller card, inquiry |
| Create | `/{locale}/dashboard/{owner|dealer|builder}/properties/new` | Multi-step wizard with draft autosave |
| Edit | `/{locale}/dashboard/{role}/properties/{id}/edit` | Status-aware editing and approved revision handling |
| My listings | `/{locale}/dashboard/{role}/properties` | Status tabs, next action, leads and performance |
| Listing leads | `/{locale}/dashboard/{role}/properties/{id}/leads` | Lead pipeline and site visits |
| Admin queue | `/{locale}/admin/listings` | Review, approve, request changes, reject or suspend |

### 12.2 Search fields

| UI label | Internal key | Control | Validation/behaviour |
|---|---|---|---|
| Looking to | `listingIntent` | Buy / Rent segmented control | Required |
| Property category | `propertyCategory` | Residential / Commercial / Plot & Land | Optional for broad search |
| Property type | `propertyTypes` | dependent multi-select | Values depend on category |
| City | `cityId` | searchable select | Defaults to confirmed location |
| Locality | `localityIds` | multi-select | Optional |
| Minimum budget | `minPrice` | money | Zero or greater |
| Maximum budget | `maxPrice` | money | Must be at least minimum |
| Currency | `currency` | enum | Default by country |
| Bedrooms | `bedrooms` | multi-select | Residential only |
| Minimum area | `minArea` | decimal | Positive |
| Maximum area | `maxArea` | decimal | At least minimum |
| Area unit | `areaUnit` | enum | Required when area is entered |
| Verified listings only | `verifiedOnly` | switch | Default off |
| Search radius | `radiusKm` | Any / 5 km / 10 km | Requires search coordinates |
| Ready to move only | `readyToMoveOnly` | switch | Optional |
| Sort by | `sort` | Relevance / Newest / Price / Area | Default Relevance |

Submitting updates URL query parameters and fetches results. The list/map choice is kept for the device. **Save search & get alerts** opens the buyer-alert form with the exact current filters.

### 12.3 Create/edit property form

Use six clear steps. Buttons are **Save draft**, **Back**, **Continue**, **Preview listing** and **Submit for review**.

#### Step 1 — Purpose and identity

| Label | Key | Type | Required/rule |
|---|---|---|---|
| I want to | `listingIntent` | `SALE` / `RENT` | Yes |
| Property category | `propertyCategory` | enum | Yes |
| Property type | `propertyType` | dependent enum | Yes |
| Property title | `title` | text | 10–120 characters |
| Property description | `description` | textarea | 50–5,000 characters |
| Project / society name | `projectName` | text | Optional |
| My reference ID | `externalReference` | text | Optional; unique per owner account |

Initial property types:

- Residential: Apartment, Independent House, Villa, Builder Floor, Farm House.
- Commercial: Office, Shop, Showroom, Warehouse, Industrial.
- Plot/Land: Residential Plot, Commercial Plot, Agricultural Land, Industrial Plot.

#### Step 2 — Price and area

| Label | Key | Type | Required/rule |
|---|---|---|---|
| Expected price / monthly rent | `priceAmount` | decimal | Positive |
| Currency | `currency` | enum | Yes |
| Price negotiable | `isNegotiable` | checkbox | Default false |
| Maintenance charges | `maintenanceAmount` | decimal | Optional |
| Maintenance frequency | `maintenanceFrequency` | monthly/quarterly/yearly | Required when charges entered |
| Primary area | `areaValue` | decimal | Positive |
| Area unit | `areaUnit` | enum | Yes |
| Conversion region | `areaConversionRegionId` | select | Required for regional units |
| Carpet area | `carpetAreaValue` | decimal | Optional |
| Built-up area | `builtUpAreaValue` | decimal | Optional |
| Plot area | `plotAreaValue` | decimal | Plot/land; optional if primary area represents it |

Server stores the submitted value/unit plus a canonical square-metre value. It must not silently apply a generic Bigha/Marla rule.

#### Step 3 — Property facts

| Label | Key | Type | Rule |
|---|---|---|---|
| Bedrooms | `bedrooms` | integer | Residential |
| Bathrooms | `bathrooms` | integer | Residential |
| Balconies | `balconies` | integer | Optional |
| Furnishing | `furnishingStatus` | unfurnished/semi-furnished/furnished | Optional |
| Floor number | `floorNumber` | number/ground | Optional |
| Total floors | `totalFloors` | integer | Not below floor number |
| Facing | `facing` | direction enum | Optional |
| Possession status | `possessionStatus` | ready/under construction | Where applicable |
| Available from | `availableFrom` | date | Required for future availability/rent policy |
| Property age in years | `propertyAgeYears` | integer | Zero or greater |
| Parking spaces | `parkingSpaces` | integer | Optional |
| Amenities | `amenityIds` | multi-select | Master-data values |

#### Step 4 — Location

| Label | Key | Type | Rule |
|---|---|---|---|
| Country | `countryCode` | select | Required |
| State / Emirate / Region | `stateId` | select | Required |
| City | `cityId` | select | Required |
| Locality / sector | `localityId` | select | Required |
| Full address | `addressLine` | text | Required privately |
| Landmark | `landmark` | text | Optional |
| PIN / postal code | `postalCode` | text | Jurisdiction validation |
| Map location | `latitude`, `longitude` | pin/GPS | Required for radius search |
| Hide exact address publicly | `hideExactAddress` | switch | Default true |

Public map payload uses an approximate pin when exact address is hidden.

#### Step 5 — RERA and authority

| Label | Key | Type | Rule |
|---|---|---|---|
| Is RERA applicable? | `reraApplicability` | applicable/not applicable/not sure | Required |
| RERA registration number | `reraNumber` | text | Required when applicable |
| RERA authority | `reraAuthorityId` | select | Required with number |
| RERA certificate | `reraDocumentUploadId` | private upload | Required by verification policy |
| Ownership type | `ownershipType` | enum | Optional |
| I am authorised to list this property | `authorizationConfirmed` | checkbox | Required |

#### Step 6 — Media, contact and consent

| Label | Key | Type | Rule |
|---|---|---|---|
| Property photos | `mediaUploadIds` | multi-upload | At least one READY image |
| Cover photo | `coverMediaUploadId` | image choice | Required |
| Video URL | `videoUrl` | URL | Optional; approved providers |
| Brochure | `brochureUploadId` | PDF | Optional |
| Contact name | `contactName` | text | Required |
| Contact mobile | `contactPhone` | phone | Required and verified |
| WhatsApp number | `whatsappPhone` | phone | Optional |
| Contact email | `contactEmail` | email | Optional |
| Preferred contact methods | `preferredContactMethods` | call/WhatsApp/email | At least one |
| I accept Terms, Privacy and the RERA disclaimer | `consentAccepted` | checkbox | Required |
| Send me promotional listing tips | `marketingOptIn` | checkbox | Optional, separate |

### 12.4 Submission behaviour

1. **Save draft** accepts incomplete data and sets `DRAFT`.
2. **Preview listing** renders a private device preview.
3. **Submit for review** performs full field, upload, OTP, bot, duplicate and consent validation.
4. The API sanitizes content, stores canonical units and creates an audit event.
5. Status becomes `PENDING_REVIEW`; the page is not publicly indexable.
6. Admin receives a queue item; submitter receives a reference number and notification.
7. Admin approves, requests changes or rejects with a mandatory reason.
8. Approval publishes immediately or at `publishAt`.
9. Publication triggers cache/sitemap refresh, structured data and buyer-alert matching.
10. A material edit to a live listing creates a review revision; the last approved revision stays public unless a safety issue requires suspension.

### 12.5 Property statuses

| Internal status | UI label | When updated and effect |
|---|---|---|
| `DRAFT` | Draft | First save/incomplete; private and editable |
| `PENDING_REVIEW` | Under review | Submitted; private and review-locked |
| `CHANGES_REQUESTED` | Action required | Admin returns field notes; editable and resubmittable |
| `APPROVED` | Approved | Review passed but publication condition/schedule pending |
| `PUBLISHED` | Live | Public, searchable, indexable and alert-matchable |
| `PAUSED` | Paused | Owner temporarily hides; can resume while valid |
| `REJECTED` | Rejected | Policy/compliance failure; private with reason |
| `EXPIRED` | Expired | Validity ended; excluded from results until renewal |
| `SOLD_RENTED` | Sold / Rented | Owner records outcome; contact CTAs removed |
| `ARCHIVED` | Archived | Soft-removed historical record |
| `SUSPENDED` | Suspended by admin | Emergency fraud/legal hold; admin controls restoration |

### 12.6 Property API routes

- `GET /api/v1/properties` — public approved search with filters, radius/bounds, cursor and sort.
- `POST /api/v1/properties` — create role-owned draft.
- `GET /api/v1/properties/{idOrSlug}` — public approved version or authorized private version.
- `PATCH /api/v1/properties/{id}` — allowed fields for current state.
- `DELETE /api/v1/properties/{id}` — soft archive.
- `POST /api/v1/properties/{id}/submit`
- `POST /api/v1/properties/{id}/pause`
- `POST /api/v1/properties/{id}/resume`
- `POST /api/v1/properties/{id}/mark-outcome`
- `POST /api/v1/properties/{id}/renew`
- `POST /api/v1/properties/{id}/media`
- `GET /api/v1/dashboard/properties`
- `GET /api/v1/dashboard/properties/{id}/analytics`
- `GET /api/v1/admin/listings`
- `POST /api/v1/admin/listings/{id}/approve`
- `POST /api/v1/admin/listings/{id}/request-changes`
- `POST /api/v1/admin/listings/{id}/reject`
- `POST /api/v1/admin/listings/{id}/suspend`
- `POST /api/v1/admin/listings/{id}/restore`

### 12.7 Property inquiry form and lead pipeline

| Label | Key | Type | Rule |
|---|---|---|---|
| Your name | `fullName` | text | Required |
| Mobile number | `phone` | phone | Required and OTP verified |
| Email address | `email` | email | Optional |
| I am interested in | `inquiryType` | callback/WhatsApp/site visit/price details | Required |
| Preferred visit date | `preferredVisitAt` | date-time | Site visit only |
| Message | `message` | textarea | Maximum 1,000 characters |
| I accept the Privacy Policy | `consentAccepted` | checkbox | Required |

Endpoint: `POST /api/v1/properties/{id}/inquiries`.

Lead statuses:

| Status | Trigger/effect |
|---|---|
| `NEW` | Verified inquiry received; seller alerted |
| `CONTACTED` | Seller records contact attempt/success |
| `SITE_VISIT_SCHEDULED` | Visit time confirmed |
| `NEGOTIATING` | Seller marks qualified negotiation |
| `WON` | Conversion recorded |
| `LOST` | Closed with mandatory reason |
| `SPAM` | Flagged and removed from active pipeline |

Lead APIs:

- `GET /api/v1/dashboard/leads`
- `GET /api/v1/dashboard/leads/{id}`
- `PATCH /api/v1/dashboard/leads/{id}/status`
- `POST /api/v1/dashboard/leads/{id}/notes`
- `POST /api/v1/dashboard/leads/{id}/schedule-visit`
- `POST /api/v1/properties/{id}/reports`

Call/WhatsApp clicks create attributed interaction events. They do not prove that a conversation occurred.

---

## 13. Dealer profile and automated micro-site

### 13.1 Public micro-site

Route: `/{locale}/dealer/{agencySlug}`.

Show agency logo/name, verification state, RERA number/authority, about text, office and cities served, active inventory, social links, Call/WhatsApp, share visiting card and a mandatory **Powered by ThePropertyPillar.com — Create Your Free Dealer Website** badge.

### 13.2 Dealer profile form

| Label | Internal key | Type | Rule |
|---|---|---|---|
| Agency / business name | `agencyName` | text | 2–120, required |
| Public website address | `slug` | slug | Unique; reserved words blocked |
| Owner / contact person | `contactPersonName` | text | Required |
| Mobile number | `phone` | phone | Required and verified |
| WhatsApp number | `whatsappPhone` | phone | Optional |
| Business email | `email` | email | Optional |
| About your agency | `description` | textarea | 50–2,000 |
| RERA registration number | `reraNumber` | text | Required where applicable |
| RERA state / authority | `reraAuthorityId` | select | Conditional |
| RERA certificate | `reraDocumentUploadId` | upload | Private; badge verification |
| Office address | `officeAddress` | text | Required |
| Country | `countryCode` | select | Required |
| State | `stateId` | select | Required |
| City | `cityId` | select | Required |
| Cities / areas served | `serviceAreaIds` | multi-select | At least one |
| Logo | `logoUploadId` | image | Optional |
| Cover image | `coverUploadId` | image | Optional |
| Instagram | `socialLinks.instagramUrl` | URL | Optional |
| Facebook | `socialLinks.facebookUrl` | URL | Optional |
| YouTube | `socialLinks.youtubeUrl` | URL | Optional |
| LinkedIn | `socialLinks.linkedinUrl` | URL | Optional |
| WhatsApp Channel | `socialLinks.whatsappChannelUrl` | URL | Optional |
| Accept Terms, RERA charter and Privacy Policy | `consentAccepted` | checkbox | Required |

Profile publication and RERA verification are separate. A policy-approved unverified page may be public, but only `VERIFIED` shows the green badge.

Dealer profile statuses: `DRAFT`, `PENDING_VERIFICATION`, `CHANGES_REQUESTED`, `VERIFIED`, `REJECTED` and `SUSPENDED`, using the shared verification meanings.

### 13.3 Dealer APIs

- `POST /api/v1/dealers/profile`
- `GET /api/v1/dealers/{slug}`
- `GET /api/v1/dashboard/dealer/profile`
- `PATCH /api/v1/dashboard/dealer/profile`
- `POST /api/v1/dashboard/dealer/profile/submit-verification`
- `POST /api/v1/dashboard/dealer/profile/publish`
- `POST /api/v1/dashboard/dealer/profile/unpublish`
- `GET /api/v1/dealers/{slug}/properties`
- `GET /api/v1/dealers/{slug}/share-card`
- `GET /api/v1/admin/dealer-verifications`
- `POST /api/v1/admin/dealer-verifications/{dealerId}/approve`
- `POST /api/v1/admin/dealer-verifications/{dealerId}/request-changes`
- `POST /api/v1/admin/dealer-verifications/{dealerId}/reject`
- `POST /api/v1/admin/dealers/{dealerId}/suspend`

Approval updates the linked JSON-LD `RealEstateAgent` graph, invalidates the public cache and notifies the dealer.

---

## 14. Smart buyer alerts

### 14.1 Alert form

| Label | Key | Rule |
|---|---|---|
| Alert name | `name` | Required; suggested from filters |
| Looking to | `listingIntent` | Buy or Rent |
| Property categories | `propertyCategories` | At least one |
| Property types | `propertyTypes` | Optional |
| City | `cityId` | Required |
| Localities | `localityIds` | Optional |
| Minimum budget | `minPrice` | Optional |
| Maximum budget | `maxPrice` | At least minimum |
| Currency | `currency` | Required |
| Minimum / maximum area | `minArea` / `maxArea` | Optional valid range |
| Area unit | `areaUnit` | Required with area |
| Bedrooms | `bedrooms` | Optional |
| Verified only | `verifiedOnly` | Switch |
| Notify me on | `channels` | WhatsApp and/or Email |
| How often | `frequency` | Instant or Daily Digest |
| Mobile number | `phone` | Required/verified for WhatsApp |
| Email address | `email` | Required/verified for email |
| Notification consent | `notificationConsent` | Required |

### 14.2 Alert lifecycle

| Status | Effect |
|---|---|
| `PENDING_VERIFICATION` | Required channel verification incomplete; no sends |
| `ACTIVE` | New approved listings are evaluated |
| `PAUSED` | Criteria retained; matching/sends stopped |
| `DISABLED` | System disabled after delivery abuse/failure |
| `ARCHIVED` | User soft-deleted |

Delivery has a separate lifecycle: `QUEUED`, `SENT`, `DELIVERED`, `FAILED` and `SKIPPED_DUPLICATE`.

### 14.3 Alert APIs

- `POST /api/v1/buyer-alerts`
- `GET /api/v1/buyer-alerts`
- `GET /api/v1/buyer-alerts/{id}`
- `PATCH /api/v1/buyer-alerts/{id}`
- `POST /api/v1/buyer-alerts/{id}/verify`
- `POST /api/v1/buyer-alerts/{id}/pause`
- `POST /api/v1/buyer-alerts/{id}/resume`
- `DELETE /api/v1/buyer-alerts/{id}`
- `GET /api/v1/buyer-alerts/{id}/matches`

Publishing a property queues matching. Deduplicate by alert, property and approved revision.

---

## 15. Construction materials, vendor catalogue, RFQs and quotes

### 15.1 Initial catalogue categories

Cement, TMT Steel, Bricks/Blocks, Tiles, Paints, Electricals, Plumbing and Sanitaryware. Categories, units, brands and specifications are admin-managed master data.

Public list filters:

| Label | Key |
|---|---|
| Material category | `categoryId` |
| Delivery city | `cityId` |
| Brand | `brandIds` |
| Available now | `availability` |
| Verified vendors only | `verifiedVendorOnly` |
| Maximum minimum order | `minOrderQuantity` |
| Sort by | `sort` |

Public price is optional because the core conversion is RFQ. When absent, show **Request quote**, never a zero price.

### 15.2 Vendor product form

| Label | Key | Type | Rule |
|---|---|---|---|
| Material category | `categoryId` | select | Required |
| Product name | `name` | text | Required |
| Brand | `brandName` | text/master select | Category policy |
| Grade / variant | `variant` | text | Optional |
| Technical specification | `specification` | textarea | 10–2,000 characters |
| Selling unit | `unit` | unit enum | Required |
| Indicative price | `indicativePrice` | decimal | Optional, positive |
| Currency | `currency` | enum | Required with price |
| Price includes GST / tax | `priceIncludesTax` | switch | Required with price |
| Minimum order quantity | `minimumOrderQuantity` | decimal | Positive |
| Available quantity | `availableQuantity` | decimal | Optional |
| Delivery cities | `deliveryCityIds` | multi-select | At least one |
| Typical delivery time | `deliveryLeadTimeDays` | integer | Optional |
| Product photos | `mediaUploadIds` | images | At least one |
| Data sheet | `dataSheetUploadId` | PDF | Optional |
| Availability | `availabilityStatus` | in stock/made to order/out of stock | Required |
| Accept marketplace terms | `consentAccepted` | checkbox | Required on submission |

Product statuses:

| Status | Effect |
|---|---|
| `DRAFT` | Private and editable |
| `PENDING_REVIEW` | In moderation queue |
| `CHANGES_REQUESTED` | Named corrections required |
| `PUBLISHED` | Public and RFQ-selectable |
| `OUT_OF_STOCK` | Clearly unavailable; filtered from available results |
| `PAUSED` | Vendor-hidden |
| `REJECTED` | Private with moderation reason |
| `SUSPENDED` | Admin compliance hold |
| `ARCHIVED` | Soft removed |

Product APIs:

- `GET /api/v1/materials/categories`
- `GET /api/v1/materials/products`
- `GET /api/v1/materials/products/{idOrSlug}`
- `POST /api/v1/vendor/products`
- `GET /api/v1/vendor/products`
- `PATCH /api/v1/vendor/products/{id}`
- `DELETE /api/v1/vendor/products/{id}`
- `POST /api/v1/vendor/products/{id}/submit`
- `POST /api/v1/vendor/products/{id}/pause`
- `POST /api/v1/vendor/products/{id}/restock`
- `GET /api/v1/admin/material-products`
- `POST /api/v1/admin/material-products/{id}/approve`
- `POST /api/v1/admin/material-products/{id}/request-changes`
- `POST /api/v1/admin/material-products/{id}/reject`

### 15.3 Bulk RFQ form

The form supports manual items and optional BOQ upload.

#### Project and delivery

| Label | Key | Type | Rule |
|---|---|---|---|
| RFQ title | `title` | text | 10–120, required |
| Buyer type | `requesterType` | homeowner/contractor/builder/other | Required |
| Project / site name | `projectName` | text | Optional |
| Delivery country | `countryCode` | select | Required |
| Delivery state | `stateId` | select | Required |
| Delivery city | `cityId` | select | Required |
| Delivery locality | `localityId` | select | Required |
| Delivery address | `deliveryAddress` | private text | Required |
| Required by | `requiredByDate` | date | Future date |
| BOQ document | `boqUploadId` | PDF/XLSX/CSV | Optional |
| Additional requirements | `notes` | textarea | Maximum 2,000 |

#### Repeatable RFQ item

| Label | Key | Rule |
|---|---|---|
| Material category | `items[].categoryId` | Required |
| Material / product | `items[].productId` | Optional catalogue value |
| Item name | `items[].itemName` | Required when no product selected |
| Grade / specification | `items[].specification` | Required |
| Preferred brand | `items[].preferredBrand` | Optional |
| Quantity | `items[].quantity` | Positive |
| Unit | `items[].unit` | Required |
| Alternatives accepted | `items[].allowAlternatives` | Default true |

At least one valid item is required.

#### Contact and consent

| Label | Key | Rule |
|---|---|---|
| Contact name | `contactName` | Required |
| Mobile number | `phone` | Required and OTP verified |
| WhatsApp number | `whatsappPhone` | Optional |
| Email address | `email` | Optional |
| Preferred contact methods | `preferredContactMethods` | At least one |
| Share contact only with quoting/selected vendors | `contactSharingConsent` | Required |
| Accept Privacy Policy and RFQ terms | `consentAccepted` | Required |

### 15.4 RFQ submission behaviour

1. Incomplete authenticated work can be saved as `DRAFT`.
2. **Request quotes** validates delivery, future need date, items, uploads, consent and bot token.
3. If phone verification is incomplete, status becomes `OTP_PENDING` and no vendor is notified.
4. Successful OTP sets `OPEN` and creates an RFQ reference.
5. Matching uses verified/active vendors, categories and delivery coverage.
6. Vendor notifications redact requester contact until the allowed privacy threshold.
7. The first submitted quote moves the RFQ to `QUOTING`.
8. The requester compares normalized totals, tax, freight, validity and original vendor units.
9. Accepting a quote stores an immutable quote-version snapshot and sets `VENDOR_SELECTED`.
10. Because the blueprint defines RFQ rather than full commerce fulfillment, the next state is `ORDER_DISCUSSION`; UI must not claim that materials were purchased on-platform.
11. Closing/cancelling/expiry stops new quotes and notifies participants.

### 15.5 RFQ statuses

| Status | UI label | Trigger/effect |
|---|---|---|
| `DRAFT` | Draft | Requester has not dispatched |
| `OTP_PENDING` | Verify mobile | Valid form but OTP incomplete |
| `OPEN` | Open for quotes | Verified and sent to matched vendors |
| `QUOTING` | Quotes coming in | At least one submitted quote |
| `QUOTES_RECEIVED` | Compare quotes | Configured quote threshold met |
| `VENDOR_SELECTED` | Vendor selected | Accepted quote snapshot |
| `ORDER_DISCUSSION` | Finalising with vendor | Contact released per consent |
| `CLOSED` | Closed | Completed/manually closed |
| `CANCELLED` | Cancelled | Reason stored; no new quotes |
| `EXPIRED` | Expired | Deadline passed |
| `FLAGGED` | Under review | Admin abuse/safety hold |

RFQ APIs:

- `POST /api/v1/material-rfqs`
- `GET /api/v1/material-rfqs`
- `GET /api/v1/material-rfqs/{id}`
- `PATCH /api/v1/material-rfqs/{id}`
- `DELETE /api/v1/material-rfqs/{id}`
- `POST /api/v1/material-rfqs/{id}/request-otp`
- `POST /api/v1/material-rfqs/{id}/verify-and-submit`
- `POST /api/v1/material-rfqs/{id}/cancel`
- `POST /api/v1/material-rfqs/{id}/close`
- `GET /api/v1/vendor/rfqs`
- `POST /api/v1/material-rfqs/{id}/report`
- `GET /api/v1/admin/material-rfqs`
- `POST /api/v1/admin/material-rfqs/{id}/flag`
- `POST /api/v1/admin/material-rfqs/{id}/restore`

### 15.6 Vendor quotation form

| Label | Key | Rule |
|---|---|---|
| Quote reference | `vendorReference` | Optional |
| Item unit price | `items[].unitPrice` | Required for each offered item |
| Offered brand | `items[].brand` | Optional |
| Offered specification | `items[].specification` | Required for an alternative |
| Available quantity | `items[].availableQuantity` | Required |
| Item notes | `items[].notes` | Optional |
| GST / tax rate | `taxRate` | Required or server-derived |
| Prices include tax | `pricesIncludeTax` | Required |
| Delivery / freight charge | `deliveryCharge` | Zero allowed |
| Other charges | `otherCharges` | Optional |
| Estimated delivery | `deliveryLeadTimeDays` | Required |
| Quote valid until | `validUntil` | Future date |
| Payment terms | `paymentTerms` | Required |
| Quote notes | `notes` | Optional |
| Attachment | `attachmentUploadId` | PDF; optional |
| Confirm price and availability | `accuracyConfirmed` | Required |

The server calculates subtotal, tax and total; client totals are never trusted.

Quote statuses:

| Status | Effect |
|---|---|
| `DRAFT` | Vendor-only incomplete quote |
| `SUBMITTED` | Version visible to requester |
| `VIEWED` | Requester opened it |
| `SHORTLISTED` | Requester marked it for comparison |
| `ACCEPTED` | Selected immutable version |
| `REJECTED` | Requester declined |
| `WITHDRAWN` | Vendor withdrew before acceptance with reason |
| `EXPIRED` | Valid-until time passed |
| `SUPERSEDED` | A newer quote version replaced it |

Quote APIs:

- `POST /api/v1/material-rfqs/{rfqId}/quotes`
- `GET /api/v1/material-rfqs/{rfqId}/quotes`
- `GET /api/v1/material-quotes/{id}`
- `PATCH /api/v1/material-quotes/{id}`
- `POST /api/v1/material-quotes/{id}/submit`
- `POST /api/v1/material-quotes/{id}/revise`
- `POST /api/v1/material-quotes/{id}/withdraw`
- `POST /api/v1/material-quotes/{id}/shortlist`
- `POST /api/v1/material-quotes/{id}/accept`
- `POST /api/v1/material-quotes/{id}/reject`

Accepting a quote transactionally verifies current RFQ/quote state, stores the accepted version, reveals only authorized contact data, notifies both parties and writes audit/analytics events.

---

## 16. EMI, borrowing eligibility and loan inquiries

### 16.1 EMI calculator

| Label | Key | Rule |
|---|---|---|
| Loan amount | `principalAmount` | Positive money |
| Interest rate (% per year) | `annualInterestRate` | Greater than 0 and sensible upper bound |
| Loan tenure | `tenureValue` | Positive integer |
| Tenure unit | `tenureUnit` | Years or Months |
| Currency | `currency` | Supported currency |

Output: monthly EMI, total interest, total repayment, principal/interest chart and amortisation table. Calculate client-side for speed and validate using `POST /api/v1/calculators/emi`. Calculator use alone never creates a lead.

### 16.2 Eligibility calculator

| Label | Key | Rule |
|---|---|---|
| Your age | `ageYears` | Lender-supported range |
| Employment type | `employmentType` | salaried/self-employed/business/other |
| Net monthly income | `monthlyNetIncome` | Positive |
| Co-applicant monthly income | `coApplicantMonthlyIncome` | Optional |
| Existing monthly EMIs | `existingMonthlyEmis` | Zero or greater |
| Expected interest rate | `annualInterestRate` | Positive |
| Preferred tenure | `tenureYears` | Positive |
| Currency | `currency` | Required |

Output: indicative eligible amount, assumed FOIR and estimated EMI with an explicit lender-approval disclaimer. Endpoint: `POST /api/v1/calculators/loan-eligibility`.

### 16.3 Loan inquiry form

| Label | Internal key | Rule |
|---|---|---|
| Full name | `fullName` | Required |
| Mobile number | `phone` | Required and OTP verified |
| Email address | `email` | Optional |
| City | `cityId` | Required |
| Loan purpose | `loanPurpose` | home/plot/construction/balance transfer/LAP/other |
| Property value | `propertyValue` | Required when known/policy demands |
| Required loan amount | `requestedLoanAmount` | Positive |
| Employment type | `employmentType` | Required |
| Net monthly income | `monthlyNetIncome` | Positive |
| Preferred banks | `preferredBankIds` | Optional |
| Best time to call | `preferredContactWindow` | Optional |
| Additional details | `notes` | Maximum 1,000 |
| Consent to share with suitable lending partners | `consentAccepted` | Required |

Submission validates, consumes a one-time OTP proof, creates `SUBMITTED`, matches eligible partners, shows a reference and states that this is not loan approval.

Loan statuses:

| Status | Trigger/effect |
|---|---|
| `SUBMITTED` | Inquiry stored |
| `ROUTED` | Suitable DSA/bank partner assigned and notified |
| `PARTNER_CONTACTED` | Partner records contact |
| `DOCUMENTS_REQUESTED` | Secure document instructions issued |
| `IN_REVIEW` | Partner assessment underway |
| `APPROVED` | Partner-reported approval, never a platform guarantee |
| `DISBURSED` | Partner confirms disbursal |
| `REJECTED` | Partner declines |
| `WITHDRAWN` | User withdraws; future routing stops where possible |
| `CLOSED` | Duplicate/unresponsive/completed closure with reason |

APIs:

- `POST /api/v1/loan-inquiries`
- `GET /api/v1/loan-inquiries/me`
- `GET /api/v1/loan-inquiries/{id}`
- `PATCH /api/v1/loan-inquiries/{id}/withdraw`
- `GET /api/v1/admin/loan-inquiries`
- `PATCH /api/v1/admin/loan-inquiries/{id}/status`
- `POST /api/v1/admin/loan-inquiries/{id}/assign`

---

## 17. Professional services directory and leads

Initial service categories:

`RERA_PROPERTY_LAWYER`, `VASTU_CONSULTANT`, `DOCUMENT_WRITER`, `ARCHITECT`, `CIVIL_CONTRACTOR`, `STRUCTURAL_ENGINEER`, `INTERIOR_DESIGNER`, `FABRICATION_SPECIALIST` and `PEST_CONTROL`.

### 17.1 Directory filters

Service category, city, locality, 5/10 km radius, verified only, minimum experience, indicative price range and sort by relevance/distance/experience/price.

### 17.2 Professional profile form

| Label | Key | Type/rule |
|---|---|---|
| Professional / business name | `businessName` | Required |
| Primary service | `primaryCategory` | Required enum |
| Other services | `secondaryCategories` | Optional multi-select |
| About your work | `description` | 80–2,000 characters |
| Years of experience | `experienceYears` | Zero or greater |
| Registration / licence number | `licenseNumber` | Conditional by category/jurisdiction |
| RERA registration number | `reraNumber` | Conditional |
| Verification document | `verificationDocumentUploadId` | Private PDF/image |
| Portfolio photos | `portfolioUploadIds` | Optional |
| Cities served | `serviceCityIds` | At least one |
| Office address | `officeAddress` | Required if displayed |
| Locality | `localityId` | Optional |
| Service radius | `serviceRadiusKm` | 1–100 |
| Starting fee | `startingPrice` | Optional money |
| Pricing model | `pricingModel` | fixed/hourly/per sq.ft/daily/on request |
| Call number | `phone` | Required and verified |
| WhatsApp number | `whatsappPhone` | Optional |
| Public email | `publicEmail` | Optional |
| Website | `websiteUrl` | Optional URL |
| Social links | `socialLinks.*` | Optional approved URLs |
| I confirm these details are accurate | `declarationAccepted` | Required |
| Accept Terms and Privacy Policy | `consentAccepted` | Required |

Profile lifecycle uses `DRAFT`, `PENDING_VERIFICATION`, `VERIFIED`, `CHANGES_REQUESTED`, `REJECTED`, `SUSPENDED` and `ARCHIVED`. Material identity/licence edits to a verified profile are staged for review instead of silently replacing public verified values.

Profile APIs:

- `GET /api/v1/service-providers`
- `GET /api/v1/service-providers/{slug}`
- `POST /api/v1/service-providers`
- `GET /api/v1/service-providers/me`
- `PATCH /api/v1/service-providers/me`
- `POST /api/v1/service-providers/me/submit-verification`
- `GET /api/v1/admin/service-providers/verifications`
- `PATCH /api/v1/admin/service-providers/{id}/verification`

### 17.3 Service inquiry form

| Label | Key | Rule |
|---|---|---|
| Service required | `serviceCategory` | Required |
| Selected professional | `providerId` | Optional when requesting matches |
| Your name | `requesterName` | Required |
| Mobile number | `phone` | Required and OTP verified |
| City | `cityId` | Required |
| Locality / site address | `siteLocality` | Optional/private |
| Requirement details | `requirementDescription` | Required |
| Expected start date | `expectedStartDate` | Optional |
| Approximate budget | `budgetAmount` | Optional |
| Preferred contact method | `preferredContactMethod` | Call/WhatsApp/Email |
| Consent to share with selected/matching professionals | `consentAccepted` | Required |

Service-lead statuses:

| Status | Trigger |
|---|---|
| `SUBMITTED` | Verified inquiry stored |
| `ASSIGNED` | Selected/matched verified provider notified |
| `CONTACTED` | Provider records contact |
| `QUOTE_SENT` | Provider records quotation |
| `HIRED` | Engagement confirmed |
| `COMPLETED` | Service completion confirmed |
| `CANCELLED` | Requester cancels |
| `SPAM` | Invalid lead flagged for review |

Inquiry APIs:

- `POST /api/v1/service-inquiries`
- `GET /api/v1/service-inquiries/me`
- `GET /api/v1/professional/inquiries`
- `PATCH /api/v1/professional/inquiries/{id}/status`

---

## 18. White-collar jobs

### 18.1 Public experience

Initial categories include Real Estate Sales Manager, Civil Engineer, Architect, AutoCAD Draftsman and Legal Advisor. The taxonomy remains admin-extensible.

Search keys: `q`, `categoryId`, `cityId`, `employmentType`, `workMode`, `experienceMin`, `experienceMax`, `salaryMin`, `salaryMax`, `currency`, `postedWithinDays`, `featuredOnly` and `sort`.

Public APIs:

- `GET /api/v1/jobs`
- `GET /api/v1/jobs/{slug}`
- `GET /api/v1/job-categories`

### 18.2 Post job form

| Label | Internal key | Rule |
|---|---|---|
| Job title | `title` | 5–120 characters |
| Job category | `categoryId` | Required |
| Company name | `companyName` | Required |
| Employment type | `employmentType` | full-time/part-time/contract/temporary/internship |
| Work mode | `workMode` | on-site/hybrid/remote |
| City | `cityId` | Required for on-site/hybrid |
| Locality / office address | `localityId` / `workAddress` | Optional/public policy |
| Minimum experience | `minimumExperienceYears` | Zero or greater |
| Maximum experience | `maximumExperienceYears` | At least minimum |
| Minimum salary | `salaryMin` | Optional |
| Maximum salary | `salaryMax` | At least minimum |
| Salary period | `salaryPeriod` | monthly/annual/daily/hourly |
| Currency | `currency` | Required with salary |
| Show salary publicly | `salaryVisible` | Checkbox |
| Number of openings | `vacancyCount` | One or greater |
| Job description | `description` | Required sanitized rich text |
| Key responsibilities | `responsibilities[]` | At least one |
| Required qualifications | `requirements[]` | At least one |
| Skills | `skills[]` | Optional tags |
| Application deadline | `applicationDeadline` | Future date |
| Application method | `applicationMethod` | platform/email/external URL |
| Application email | `applicationEmail` | Conditional |
| External application link | `externalApplicationUrl` | Conditional |
| Recruiter contact number | `contactPhone` | Optional/public choice |
| Feature this job | `featuredRequested` | Opens boost/payment flow |
| I confirm this is a genuine opening | `declarationAccepted` | Required |
| Accept Terms and Privacy Policy | `consentAccepted` | Required |

Job statuses:

| Status | Effect |
|---|---|
| `DRAFT` | Employer-only draft |
| `PENDING_REVIEW` | Moderation queue |
| `PUBLISHED` | Searchable/indexable, applications open |
| `PAUSED` | Hidden; existing applications retained |
| `EXPIRED` | Deadline passed |
| `REJECTED` | Private with correction/reason |
| `CLOSED` | Role filled or employer-closed |
| `ARCHIVED` | Read-only history |

Featured/payment status is separate: `NOT_REQUESTED`, `PENDING_PAYMENT`, `ACTIVE`, `EXPIRED` and `REFUNDED`.

Job APIs:

- `POST /api/v1/jobs`
- `PATCH /api/v1/jobs/{id}`
- `POST /api/v1/jobs/{id}/submit`
- `POST /api/v1/jobs/{id}/pause`
- `POST /api/v1/jobs/{id}/close`
- `GET /api/v1/employer/jobs`
- `GET /api/v1/employer/jobs/{id}/applications`
- `POST /api/v1/jobs/{id}/featured-checkout`
- `PATCH /api/v1/admin/jobs/{id}/moderation`

### 18.3 Job application form

| Label | Key | Rule |
|---|---|---|
| Full name | `fullName` | Required |
| Email address | `email` | Required |
| Mobile number | `phone` | Required |
| Current city | `currentCityId` | Required |
| Current job title | `currentJobTitle` | Optional |
| Total experience | `experienceYears` | Zero or greater |
| Resume | `resumeUploadId` | Private PDF/DOC/DOCX, required |
| Cover note | `coverNote` | Maximum 2,000 |
| Expected salary | `expectedSalary` | Optional |
| Notice period in days | `noticePeriodDays` | Optional |
| Consent to share with this employer | `consentAccepted` | Required |

Submission requires authenticated/OTP-verified candidate, prevents duplicate active applications, keeps resumes private and notifies both sides.

Application statuses:

| Status | Candidate-facing behaviour |
|---|---|
| `SUBMITTED` | Confirmation and tracking |
| `VIEWED` | Employer opened application |
| `SHORTLISTED` | Candidate is shortlisted |
| `INTERVIEW_SCHEDULED` | Time/mode details displayed securely |
| `OFFERED` | Offer recorded; secure follow-up |
| `HIRED` | Completed |
| `REJECTED` | Neutral decline notification |
| `WITHDRAWN` | Candidate ends application |

Application APIs:

- `POST /api/v1/jobs/{id}/applications`
- `GET /api/v1/job-applications/me`
- `GET /api/v1/job-applications/{id}`
- `POST /api/v1/job-applications/{id}/withdraw`
- `PATCH /api/v1/employer/applications/{id}/status`

---

## 19. Blue-collar worker registration and hiring

### 19.1 One-minute registration

The first screen keeps only the source-required minimum.

| Label | Internal key | Rule |
|---|---|---|
| Your name | `fullName` | Required; text or voice |
| Mobile number | `phone` | Required and OTP verified |
| Your main work / trade | `primaryTrade` | Required |
| Daily wage | `dailyRate` | Positive money |
| Currency | `currency` | Default from country |
| City | `cityId` | Required; select or voice |
| Available for work now | `availableNow` | Default true |
| Let employers contact me by phone/WhatsApp | `directContactConsent` | Required for direct contact |
| Accept worker-profile and Privacy terms | `consentAccepted` | Required |

Initial trades: `MASON`, `PLUMBER`, `ELECTRICIAN`, `CARPENTER`, `PAINTER`, `WELDER` and `HELPER`.

After registration, an optional **Improve your profile** step offers `secondaryTrades`, `experienceYears`, `localityId`, `serviceRadiusKm`, `profilePhotoUploadId`, `spokenLocales`, `workDescription`, `whatsappPhone` and `preferredContactMethod`.

### 19.2 Submission behaviour

1. Validate OTP proof, consent, trade, rate and city.
2. Create/update the user and worker profile.
3. Profile becomes `ACTIVE` after safety checks or `PENDING_REVIEW` when flagged.
4. Show **Your worker profile is ready**, public preview, share CTA and large availability control.
5. Never publish contact information without direct-contact consent.

### 19.3 Worker search/card

Filters: trade, city/locality, 5/10 km radius, available now, daily-rate range, currency, verified only and sort by nearest/available/rate/experience.

Card shows display name, main trade, city/locality (not exact home), daily rate, Available/Busy, last availability update, language and clearly distinct phone/identity verification badges.

### 19.4 Worker states

Profile moderation:

| Status | Effect |
|---|---|
| `PENDING_REVIEW` | Safety review; limited/hidden |
| `ACTIVE` | Searchable according to availability |
| `CHANGES_REQUESTED` | Exact correction requested |
| `REJECTED` | Hidden with reason/appeal |
| `SUSPENDED` | Contact disabled |
| `ARCHIVED` | Worker closed profile |

Availability is separate:

| Status | Effect |
|---|---|
| `AVAILABLE_NOW` | Prioritized and filterable |
| `BUSY` | Clearly busy but optionally searchable |
| `OFFLINE` | Excluded from available results |

Verification is separate: `PHONE_VERIFIED`, `IDENTITY_PENDING`, `IDENTITY_VERIFIED` and `IDENTITY_REJECTED`. Phone verification must never display as identity verification.

### 19.5 Worker APIs

- `POST /api/v1/workers`
- `GET /api/v1/workers`
- `GET /api/v1/workers/{id}`
- `GET /api/v1/workers/me`
- `PATCH /api/v1/workers/me`
- `PATCH /api/v1/workers/me/availability`
- `POST /api/v1/workers/{id}/contact-events`
- `GET /api/v1/admin/workers`
- `PATCH /api/v1/admin/workers/{id}/moderation`

Contact-event creation may return an authorized call/WhatsApp URI. It measures a click, not a completed conversation.

---

## 20. Builder advertising engine

### 20.1 Supported placements

| Internal placement | UI name | Behaviour |
|---|---|---|
| `HOMEPAGE_HERO` | Homepage Hero Spotlight | Responsive flagship project creative |
| `SEARCH_FEED` | Search Results Featured Project | Eligible cards at positions 1 and 4, always labelled |
| `CITY_TAKEOVER` | City / Locality Banner | Only on explicitly targeted location pages |
| `EMI_SIDEBAR` | EMI Calculator Featured Project | Relevant project beside calculator |

### 20.2 Campaign form

| Label | Internal key | Rule |
|---|---|---|
| Campaign name | `name` | Required; internal dashboard name |
| Promote project | `projectId` | Builder-owned and approved |
| Ad placements | `placements` | At least one |
| Headline | `headline` | Placement-specific limit |
| Supporting text | `description` | Required |
| CTA label | `ctaLabel` | controlled values |
| Destination type | `destinationType` | internal project preferred |
| Destination URL | `destinationUrl` | External URLs require admin review |
| Desktop creative | `desktopMediaUploadId` | Required for banner placements |
| Mobile creative | `mobileMediaUploadId` | Required |
| Starting price | `startingPrice` | Zero or greater |
| Currency | `currency` | Required |
| RERA number | `reraNumber` | Required where applicable |
| Brochure | `brochureUploadId` | Optional PDF |
| Target cities | `targetCityIds` | At least one |
| Target localities | `targetLocalityIds` | Optional; must belong to cities |
| Minimum buyer budget | `targetBudgetMin` | Optional |
| Maximum buyer budget | `targetBudgetMax` | At least minimum |
| Start date and time | `startsAt` | Required |
| End date and time | `endsAt` | After start |
| Package / pricing model | `packageId` | Admin catalogue |
| Total budget | `budgetAmount` | Package-controlled |
| Lead credit limit | `leadCreditLimit` | CPL package-controlled |
| Billing profile | `billingProfileId` | Required for paid campaign |
| I confirm project/creative details are accurate | `declarationAccepted` | Required |

### 20.3 Campaign lifecycle

| Status | Trigger and effect |
|---|---|
| `DRAFT` | Builder is editing |
| `PENDING_PAYMENT` | Submitted but payment/credit incomplete |
| `PENDING_REVIEW` | Payment valid; admin reviews project, RERA, creative and destination |
| `CHANGES_REQUESTED` | Builder may edit requested fields and resubmit |
| `SCHEDULED` | Approved/paid; future start |
| `ACTIVE` | In schedule with eligible inventory and budget |
| `PAUSED` | No serving; history retained |
| `BUDGET_EXHAUSTED` | Budget/lead credit used |
| `COMPLETED` | End date or delivery goal reached |
| `REJECTED` | No serving; reason shown |
| `CANCELLED` | Cancelled under policy |

Serving eligibility checks status, approval, schedule, target, budget, creative and linked project/RERA in real time.

### 20.4 Ad lead lifecycle

`OTP_PENDING → VERIFIED → ASSIGNED → CONTACTED → QUALIFIED → WON` or `LOST`. `INVALID` is terminal.

- CPL counts only at `VERIFIED`.
- Duplicate verified leads for the same campaign/phone within the attribution window are not billed twice.
- Builder may update contact/qualification/outcome; only system/admin sets `VERIFIED` or `INVALID`.

### 20.5 Advertising APIs

- `GET /api/v1/ad-packages`
- `POST /api/v1/ad-campaigns`
- `GET /api/v1/ad-campaigns`
- `GET /api/v1/ad-campaigns/{id}`
- `PATCH /api/v1/ad-campaigns/{id}`
- `POST /api/v1/ad-campaigns/{id}/submit`
- `POST /api/v1/ad-campaigns/{id}/pause`
- `POST /api/v1/ad-campaigns/{id}/resume`
- `POST /api/v1/ad-campaigns/{id}/cancel`
- `GET /api/v1/ad-campaigns/{id}/analytics`
- `GET /api/v1/admin/ad-campaigns`
- `POST /api/v1/admin/ad-campaigns/{id}/decision`
- `GET /api/v1/ads/serve?placement=&cityId=&localityId=&budget=&currency=`
- `POST /api/v1/ads/events/impression`
- `POST /api/v1/ads/events/click`
- `POST /api/v1/ads/{campaignId}/leads/otp/request`
- `POST /api/v1/ads/{campaignId}/leads/otp/verify`
- `POST /api/v1/ad-leads/{id}/status`

Impression/click events use event ID, campaign, creative, placement, session, timestamp and attribution metadata. Server deduplicates and filters known bot/internal traffic.

---

## 21. Payments, subscriptions, credits and GST invoices

### 21.1 Checkout form

| Label | Key | Rule |
|---|---|---|
| Product / plan | `priceId` | Server catalogue value |
| Billing cycle | `billingCycle` | Product-supported |
| Country | `billingCountry` | Required |
| Currency | `currency` | Server-controlled by price |
| Customer / business name | `legalName` | Required |
| Email for invoice | `billingEmail` | Required |
| Mobile number | `billingMobile` | Required |
| GSTIN | `gstin` | Optional/validated when supplied |
| Address line 1 | `addressLine1` | Required |
| Address line 2 | `addressLine2` | Optional |
| City | `city` | Required |
| State | `stateCode` | Required by jurisdiction |
| Postal code | `postalCode` | Required |
| Payment method | `gateway` | Razorpay, server-controlled |
| Accept pricing and cancellation terms | `termsAccepted` | Required |

### 21.2 Order lifecycle

| Status | Set by/effect |
|---|---|
| `CREATED` | Server-created order before gateway attempt |
| `PENDING` | Gateway attempt/session active |
| `PAID` | Verified webhook; entitlement activates and invoice issues |
| `FAILED` | Verified failure or expired attempt |
| `EXPIRED` | Checkout validity elapsed |
| `CANCELLED` | Cancelled before payment |
| `PARTIALLY_REFUNDED` | Verified refund webhook/admin workflow |
| `REFUNDED` | Full verified refund |
| `DISPUTED` | Gateway dispute/chargeback |

Browser redirects never set paid state.

Subscription statuses: `FREE`, `ACTIVE`, `PAST_DUE`, `CANCEL_AT_PERIOD_END`, `CANCELLED`, `EXPIRED` and `SUSPENDED`. Normal cancellation retains paid access until period end.

### 21.3 Billing APIs

- `GET /api/v1/catalog/plans`
- `GET /api/v1/billing-profile`
- `POST /api/v1/billing-profile`
- `PATCH /api/v1/billing-profile`
- `POST /api/v1/checkouts`
- `GET /api/v1/orders/{id}`
- `POST /api/v1/webhooks/razorpay`
- `GET /api/v1/subscriptions/current`
- `POST /api/v1/subscriptions/{id}/cancel`
- `POST /api/v1/subscriptions/{id}/resume`
- `GET /api/v1/invoices`
- `GET /api/v1/invoices/{id}/download`
- `POST /api/v1/admin/orders/{id}/refund`

Server recalculates all prices. Webhooks are signature-verified and idempotent. Failed/abandoned attempts remain visible and retry creates a new payment attempt. GST rules and invoice wording require tax-professional approval before launch.

---

## 22. RERA verification, moderation and reporting

### 22.1 RERA submission form

| Label | Key | Rule |
|---|---|---|
| Profile / listing to verify | `entityId` | Owned eligible entity |
| Verification type | `entityType` | dealer/builder/property/project |
| RERA registration number | `reraNumber` | Required, normalized |
| RERA authority | `reraAuthorityId` | Required master value |
| State / jurisdiction | `jurisdictionCode` | Required |
| Registration holder name | `registeredName` | Required |
| Valid from | `validFrom` | Optional/derived |
| Valid until | `validUntil` | Optional |
| Official registry URL | `registryUrl` | Optional/admin-validated |
| RERA certificate | `certificateMediaUploadId` | Required private file |
| Additional note | `submissionNote` | Optional |
| I confirm the information is accurate | `consentAccepted` | Required |

Submission snapshots values and document evidence, sets `PENDING`, creates an admin queue/audit record and returns a reference. Re-verification creates a new version rather than overwriting history.

APIs:

- `POST /api/v1/verifications`
- `GET /api/v1/verifications/{id}`
- `POST /api/v1/verifications/{id}/withdraw`
- `GET /api/v1/admin/verifications`
- `GET /api/v1/admin/verifications/{id}`
- `POST /api/v1/admin/verifications/{id}/decision`

Admin decision fields: `decision`, `reasonCode`, `reviewNote`, `fieldIssues[]` and `verifiedUntil`.

### 22.2 Report form

| Label | Key | Rule |
|---|---|---|
| What are you reporting? | `entityType` | Required |
| Reason | `reasonCode` | fraud/duplicate/wrong details/unavailable/RERA/abuse/privacy/other |
| Explain the issue | `description` | Required |
| Evidence | `attachmentUploadIds` | Optional private files |
| Mobile number | `mobile` | Required and OTP verified |
| I confirm this report is genuine | `declarationAccepted` | Required |

A report is an allegation, not proof. Severe safety/legal reports may trigger a temporary hold; ordinary reports remain under review.

Report lifecycle: `OPEN → TRIAGED → IN_REVIEW → ACTION_TAKEN` or `DISMISSED → CLOSED`.

APIs:

- `POST /api/v1/reports/otp/request`
- `POST /api/v1/reports`
- `GET /api/v1/admin/reports`
- `GET /api/v1/admin/reports/{id}`
- `POST /api/v1/admin/reports/{id}/triage`
- `POST /api/v1/admin/reports/{id}/decision`
- `POST /api/v1/admin/entities/{entityType}/{entityId}/suspend`
- `POST /api/v1/admin/entities/{entityType}/{entityId}/restore`

All admin decisions require a reason and record actor, old/new value, time and request/session context.

---

## 23. Grievance redressal and privacy rights

### 23.1 Grievance form

| Label | Key |
|---|---|
| Full name | `name` |
| Email address | `email` |
| Mobile number | `mobile` |
| Complaint category | `category` |
| Subject | `subject` |
| Describe your complaint | `description` |
| Related listing / order / profile ID | `relatedEntityReference` |
| Attach evidence | `attachmentUploadIds` |
| Preferred reply method | `preferredContactChannel` |
| I confirm the information is accurate | `declarationAccepted` |
| Privacy consent | `consentAccepted` |

Categories: listing, payment, privacy, RERA, job, worker, RFQ, professional, advertising, account and other.

Lifecycle: `OPEN → ACKNOWLEDGED → IN_REVIEW → AWAITING_USER → RESOLVED → CLOSED`. `REOPENED` is permitted with new evidence. Resolution requires a note; every transition notifies the complainant.

APIs:

- `POST /api/v1/grievances/otp/request`
- `POST /api/v1/grievances`
- `GET /api/v1/grievances/{reference}` with auth/OTP
- `POST /api/v1/grievances/{id}/messages`
- `GET /api/v1/admin/grievances`
- `POST /api/v1/admin/grievances/{id}/assign`
- `POST /api/v1/admin/grievances/{id}/status`
- `POST /api/v1/admin/grievances/{id}/messages`

Do not publish a statutory SLA until qualified legal review sets it.

### 23.2 Data export/deletion request

| Label | Key | Rule |
|---|---|---|
| Request type | `requestType` | Export or Delete |
| Registered mobile / email | `accountIdentifier` | Identity verification |
| Reason | `reason` | Optional |
| Data categories | `dataCategories` | Export; defaults to all |
| I understand deletion may be irreversible | `deletionAcknowledged` | Required for Delete |
| Privacy declaration | `declarationAccepted` | Required |

Lifecycle:

`OTP_PENDING → IDENTITY_VERIFIED → IN_REVIEW → PROCESSING → READY_FOR_DOWNLOAD` or `DELETION_SCHEDULED → COMPLETED`. Alternate terminal states: `REJECTED`, `CANCELLED`, `FAILED`.

Export links are signed, user-bound and short-lived. Deletion removes/anonymizes eligible data while retaining only legally required financial/security/fraud/audit records, with a clear user explanation.

APIs:

- `POST /api/v1/privacy-requests/otp/request`
- `POST /api/v1/privacy-requests`
- `GET /api/v1/privacy-requests/{reference}`
- `POST /api/v1/privacy-requests/{id}/cancel`
- `GET /api/v1/privacy-requests/{id}/download`
- `GET /api/v1/admin/privacy-requests`
- `POST /api/v1/admin/privacy-requests/{id}/status`

---

## 24. Referrals, share posters and notifications

### 24.1 Referral experience

Dashboard shows referral code, shareable URL, WhatsApp share, attributed/qualified invites, pending/available/used/reversed credits and plain-language qualification rules.

Referral lifecycle:

| Status | Meaning |
|---|---|
| `ATTRIBUTED` | Signed referral cookie/code connected to signup |
| `QUALIFIED` | Configured verified activity completed |
| `REWARDED` | Idempotent credit-ledger entry posted |
| `REJECTED` | Self-referral/duplicate/fraud/policy failure |
| `REVERSED` | Previous reward reversed with reason |
| `EXPIRED` | Qualification window ended |

APIs:

- `GET /api/v1/referrals/me`
- `POST /api/v1/referrals/attributions`
- `GET /api/v1/referrals`
- `GET /api/v1/credit-ledger`
- `GET /api/v1/admin/referral-rules`
- `PATCH /api/v1/admin/referral-rules`
- `POST /api/v1/admin/referrals/{id}/decision`

Credits use an append-only ledger rather than only a mutable balance.

### 24.2 Social poster form

| Label | Key | Rule |
|---|---|---|
| What do you want to share? | `entityType` | Property/project/dealer/worker etc. |
| Select item | `entityId` | Owned/public eligible entity |
| Language | `locale` | Supported locale |
| Poster style | `templateVariant` | Approved template |
| Show price / rate | `showPrice` | Optional |
| Show RERA badge | `showReraBadge` | Server allows only when verified |
| Caption | `caption` | Editable generated text |
| Destination | `destinationUrl` | Generated internal canonical URL |

Next.js owns `GET /api/og?entityType=&entityId=&locale=&variant=` for image generation. Business APIs:

- `POST /api/v1/share-events`
- `GET /api/v1/share-captions?entityType=&entityId=&locale=`

WhatsApp, Facebook and LinkedIn use supported web-share links. Instagram flow downloads/copies the poster and caption with instructions; do not claim universal direct publishing.

### 24.3 Notification preferences

| Label | Key |
|---|---|
| WhatsApp alerts | `channels.whatsapp` |
| SMS alerts | `channels.sms` |
| Email alerts | `channels.email` |
| In-app alerts | `channels.inApp` |
| Property matches | `topics.propertyMatches` |
| New leads | `topics.leads` |
| RFQ updates | `topics.rfq` |
| Job updates | `topics.jobs` |
| Payment updates | `topics.payments` |
| Marketing offers | `topics.marketing` |
| Quiet hours | `quietHours.start`, `quietHours.end`, `timezone` |
| Preferred language | `locale` |

Delivery lifecycle: `QUEUED → SENT → DELIVERED → READ`, with `FAILED`, `RETRYING`, `SUPPRESSED` and `BOUNCED`. A sent message must not be labelled delivered.

APIs:

- `GET /api/v1/notification-preferences`
- `PATCH /api/v1/notification-preferences`
- `GET /api/v1/notifications`
- `POST /api/v1/notifications/{id}/read`
- `POST /api/v1/notifications/read-all`
- `POST /api/v1/webhooks/notifications/{provider}`
- `GET /api/v1/admin/notification-deliveries`
- `POST /api/v1/admin/notification-deliveries/{id}/retry`

Transactional security, payment, grievance, privacy and legal messages remain enabled through at least one required channel.

---

## 25. Consent, cookies and legal UI

### 25.1 Consent rules

- Never pre-check a consent.
- Mandatory service consent and optional marketing consent are separate.
- Store `consentType`, `version`, `acceptedAt`, `withdrawnAt`, `locale`, `sourceForm`, `userId/sessionId` and referenced policy versions.
- Exact GPS requires purpose-specific opt-in.
- Approximate IP-derived city use is disclosed in cookie/privacy UI and can be overridden.

Baseline checkbox copy:

| Context | English baseline label |
|---|---|
| Signup | I agree to the Terms of Service and acknowledge the Privacy Policy. |
| Property | I confirm that I am authorised to publish this information and that the details are accurate. |
| Loan | I consent to ThePropertyPillar sharing my inquiry with selected bank/DSA partners so they may contact me. |
| RFQ | I consent to sharing this requirement and my contact details with matching verified vendors. |
| Worker | I consent to publishing my selected worker-profile details and enabling contact actions for employers. |

Consent APIs:

- `POST /api/v1/consents`
- `GET /api/v1/consents/me`
- `POST /api/v1/consents/{type}/withdraw`
- `GET /api/v1/admin/consents`

### 25.2 Cookie banner

First layer buttons: **Accept optional cookies**, **Reject optional cookies**, **Manage choices**. Essential cookies are explained but not switchable. Categories: Essential, Preferences, Analytics and Marketing. The banner must not block legal/privacy pages.

### 25.3 Required legal review

Privacy, DPDP/GDPR wording, Section 79 marketplace terms, RERA charter, grievance process, GST invoice text, retention periods and cancellation/refund rules require qualified legal/tax review before production. This product specification defines the UX/flow, not final legal advice.

---

## 26. Admin master data and settings

### 26.1 City/locality form

| Label | Key |
|---|---|
| Country | `countryCode` |
| State | `stateCode` |
| City name | `cityName` |
| City slug | `slug` |
| Locality name | `localityName` |
| Locality slug | `localitySlug` |
| Coordinates | `latitude` / `longitude` |
| Default currency | `defaultCurrency` |
| Timezone | `timezone` |
| Area conversion profile | `areaConversionProfileId` |
| Active | `isActive` |
| Allow SEO indexing | `isIndexable` |

APIs:

- `GET /api/v1/admin/cities`
- `POST /api/v1/admin/cities`
- `PATCH /api/v1/admin/cities/{id}`
- `GET /api/v1/admin/localities`
- `POST /api/v1/admin/localities`
- `PATCH /api/v1/admin/localities/{id}`

No locality publishes without valid parent, slug, coordinates and canonical relationship.

### 26.2 Platform social links

Keys: `instagramUrl`, `facebookUrl`, `youtubeUrl`, `linkedinUrl`, `whatsappChannelUrl` and optional `xUrl`.

- `GET /api/v1/platform-settings/public`
- `GET /api/v1/admin/platform-settings/social-links`
- `PATCH /api/v1/admin/platform-settings/social-links`

### 26.3 Other admin-managed masters

Property types/amenities, material categories/units/brands, service categories, worker trades, job categories/skills, RERA authorities, report/grievance reasons, plans/prices/credits, notification templates, approved poster variants and area-conversion profiles.

---

## 27. SEO, AEO and GEO behaviour

Frontend-owned outputs:

- `/robots.txt` generated by `src/app/robots.ts` with required AI/search crawler rules.
- `/sitemap.xml` plus split city, locality, property, dealer and job sitemaps.
- `/llms.txt` and `/llms-full.txt`.
- Linked JSON-LD graphs for Organization/WebSite globally and the correct entity schemas per route.
- Localized SSR pages and canonical/hreflang metadata.
- 40–60 word direct-answer capsules and valid FAQ/HowTo markup.

### 27.1 Locality content form

| Label | Key | Rule |
|---|---|---|
| Intent | `intent` | Buy/rent/dealers/materials/workers etc. |
| Locale | `locale` | Required |
| City / locality | `cityId` / `localityId` | Required |
| Page title | `seoTitle` | Required |
| Meta description | `seoDescription` | Required |
| Direct answer | `directAnswer` | Target 40–60 useful words |
| Introduction | `introduction` | Unique substantive copy |
| FAQs | `faqs[]` | Valid questions/answers |
| Market-rate rows | `marketRates[]` | Numeric facts with provenance |
| Rate source and date | `sourceUrl` / `observedAt` | Required for each factual table set |
| Canonical override | `canonicalUrl` | Admin-only, normally generated |
| Indexing | `indexingStatus` | draft/index/noindex/archived |

APIs:

- `GET /api/v1/admin/locality-content`
- `POST /api/v1/admin/locality-content`
- `PATCH /api/v1/admin/locality-content/{id}`
- `POST /api/v1/admin/locality-content/{id}/publish`

Never publish fabricated market-rate tables. Technical machine readability is not a promise of Google rank or AI citation.

---

## 28. Analytics event contract

Analytics must be consent-aware, avoid unnecessary PII and send the same stable semantic event names to configured adapters.

Initial events:

| Event | Trigger |
|---|---|
| `pillar_selected` | User selects a homepage pillar |
| `search_submitted` | Context search runs |
| `property_viewed` | Approved detail becomes visible |
| `property_saved` | Authenticated save succeeds |
| `property_inquiry_submitted` | Verified inquiry stored |
| `property_call_clicked` / `property_whatsapp_clicked` | Contact URI requested |
| `listing_created` / `listing_submitted` / `listing_published` | Lifecycle milestones |
| `buyer_alert_created` | Active/pending alert stored |
| `rfq_submitted` | OTP-verified RFQ opens |
| `quote_submitted` / `quote_accepted` | Quote milestones |
| `loan_inquiry_submitted` | Consented loan lead stored |
| `service_inquiry_submitted` | Consented professional lead stored |
| `job_posted` / `job_application_submitted` | Job milestones |
| `worker_registered` / `worker_contact_clicked` | Worker conversion |
| `ad_impression` / `ad_click` / `ad_lead_verified` | Ad attribution |
| `checkout_started` / `payment_confirmed` | Billing milestones |
| `referral_attributed` / `referral_qualified` | Viral loop |

Backend business events are authoritative for submitted/paid/verified conversions; browser pixels alone are not.

---

## 29. The nine role panels

Every dashboard uses one shared responsive shell with role-specific navigation and permissions. Desktop uses a collapsible sidebar; mobile uses cards plus the global bottom navigation. The top bar contains city, language, search, notifications and profile.

### 29.1 Buyer panel

Route root: `/{locale}/dashboard/buyer`.

Navigation:

- Overview
- Saved Properties
- Saved Searches & Alerts
- Property Inquiries
- Site Visit Requests
- Material RFQs
- Loan Inquiries
- Service Requests
- Notifications
- Profile & Privacy

Overview shows new matching properties, active/paused alerts, saved property changes, open inquiries/RFQs/loan/service requests and a recent notification timeline. Buyer cannot publish a property without adding/switching to Owner capability and never sees seller/vendor internal notes.

### 29.2 Owner panel

Route root: `/{locale}/dashboard/owner`.

Navigation:

- Overview
- My Properties
- Add Property
- Leads & Site Visits
- Promotions
- Material RFQs
- Services & Loan Inquiries
- Payments & Invoices
- Reports
- Notifications
- Profile & Privacy

Overview shows draft/pending/live/paused properties, new leads, views/saves/contact clicks, listings expiring and changes requested. Owner sees only owned listings/leads and cannot use a builder campaign without Builder approval.

### 29.3 Dealer panel

Route root: `/{locale}/dashboard/dealer`.

Navigation:

- Overview
- Listings
- Leads
- Dealer Micro-Site
- RERA Verification
- Social Poster & Share
- Referral Rewards
- Subscription
- Payments & Invoices
- Notifications
- Agency Profile

Overview shows inventory by status, lead pipeline, micro-site views/share clicks, verification, plan limits/credits and referrals. The micro-site screen shows URL, desktop/mobile preview, profile completeness, active inventory, social links, QR/copy/share and the mandatory powered-by badge.

### 29.4 Builder panel

Route root: `/{locale}/dashboard/builder`.

Navigation:

- Overview
- Projects & Properties
- Leads & Site Visits
- RERA Documents
- Brochures
- Material RFQs
- Professional Services
- Jobs & Workers
- Ad Campaigns
- Campaign Analytics
- Social Poster & Share
- Referral Rewards
- Payments & GST Invoices
- Notifications
- Company Profile

Overview shows project/listing status, campaign status, impressions/clicks/CTR, verified CPL, new leads, upcoming schedules/budget warnings and verification issues. Builder can submit but cannot self-approve campaigns or RERA.

### 29.5 Vendor panel

Route root: `/{locale}/dashboard/vendor`.

Navigation:

- Overview
- Product Catalogue
- Matching RFQs
- My Quotations
- Won / Closed RFQs
- Verification
- Social Share
- Referral Rewards
- Subscription & Payments
- Notifications
- Business Profile

Overview shows new matched RFQs, quotes awaiting buyer action, shortlisted/accepted/expired quotes, published/out-of-stock products, response time and conversion. Do not show warehouse/order-fulfilment features that are outside the blueprint.

### 29.6 Professional panel

Route root: `/{locale}/dashboard/professional`.

Navigation:

- Overview
- Public Profile
- Services & Service Areas
- Leads
- Availability
- Verification Documents
- Portfolio
- Subscription & Payments
- Notifications
- Profile & Privacy

Overview shows new/in-progress/closed leads, profile views/contact clicks, verification, service-area/profile completeness and availability. It never exposes another professional’s leads.

### 29.7 White-collar seeker/employer panel

Route root: `/{locale}/dashboard/jobs`.

`jobAccountMode` is required:

- `SEEKER`: Recommended Jobs, Saved Jobs, Applications, Resume & Profile, Job Alerts, Notifications.
- `EMPLOYER`: Posted Jobs, Post a Job, Applications, Featured Boosts, Payments & Invoices, Company Profile.
- `BOTH`: a visible **Candidate view / Employer view** switch; permission boundaries remain enforced server-side.

### 29.8 Blue-collar worker panel

Route root: `/{locale}/dashboard/worker`.

Navigation:

- Overview
- My Worker Card
- Availability
- Contact Activity
- Service Area & Rate
- Verification
- Referral Rewards
- Notifications
- Privacy

The large **Available Now / Busy** toggle appears above the fold. Overview includes public-card preview, current trade/city/rate, verification state and measured Call/WhatsApp clicks. It must not describe click counts as completed calls or jobs.

### 29.9 Admin panel

Route root: `/{locale}/admin`.

Navigation:

- Command Centre
- Users & Roles
- RERA Verification
- Listing Moderation
- Reported Content
- Vendors & Products
- Professionals & Workers
- Jobs
- Builder Ads
- Leads & CPL
- Payments & Refunds
- Plans & Credits
- Cities & Localities
- Taxonomy Masters
- Grievances
- Data Export / Deletion
- Consent Records
- Notification Delivery
- Platform Social Links
- SEO / Locality Content
- Audit Logs
- Settings

Command Centre shows actionable counts and ageing: RERA/listing/campaign queues, severe reports, overdue grievances/privacy requests, payment/webhook failures, notification failure rate and new verified CPL leads.

Admin levels:

| Level | Scope |
|---|---|
| `MODERATOR` | Assigned content/report queues; no billing/settings/role escalation |
| `OPERATIONS_ADMIN` | Verification, grievances, ads operations and master data by granted capability |
| `SUPER_ADMIN` | Role grants, billing/refunds, critical settings and full audit access |

Sensitive actions require re-authentication where appropriate, a reason and an append-only audit record.

### 29.10 Cross-panel visibility matrix

| Functionality | Buyer | Owner | Dealer | Builder | Vendor | Professional | White-collar | Worker | Admin |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Browse public property/material/service/job data | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Publish own property | No* | Yes | Yes | Yes | No* | No* | No* | No* | Review |
| Dealer micro-site | No | No | Manage | No | No | No | No | No | Review |
| Create buyer alert | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Limited | Audit |
| Submit material RFQ | Yes | Yes | Yes | Yes | Yes** | Yes | Yes | Limited | Monitor |
| Quote an RFQ | No | No | No | No | Yes | No | No | No | Monitor |
| Loan/service inquiry | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Limited | Route/audit |
| Professional leads | No | No | No | No | No | Manage own | No | No | Review |
| Post white-collar job | No* | No* | Capability | Yes | Capability | Capability | Employer mode | No | Review |
| Apply to white-collar job | Capability | Capability | Capability | Capability | Capability | Capability | Seeker mode | No | Review |
| Worker availability | No | No | No | No | No | No | No | Own only | Moderate |
| Builder ad campaign | No | No | No | Own only | No | No | No | No | Approve/manage |
| Refund/verification decision | No | No | No | No | No | No | No | No | Capability only |

*Requires an explicit added role/capability; it is never silently granted.  
**Vendor may submit its own procurement RFQ but cannot quote its own RFQ.

---

## 30. Admin action and audit requirements

For every sensitive state change record:

- Actor user ID and admin level/capability.
- Target entity type and ID.
- Action and reason code.
- Human review note where required.
- Previous and next status/value snapshots with sensitive-field redaction.
- UTC timestamp.
- Request ID, session ID and privacy-safe IP/device context.
- Related queue/report/payment/reference ID.

Audit records are append-only from the application UI. Admins cannot edit or delete them.

---

## 31. Security and abuse-control behaviours

- OTP requests are limited by phone, IP, session/device and purpose.
- OTP error text does not disclose whether a phone number already has an account.
- Public writes use bot challenge and idempotency.
- Role/capability checks occur in the API, not only the UI.
- Signed upload intent restricts MIME, size, purpose and owner.
- Private documents use time-limited authorized download URLs.
- All provider webhooks verify signatures and deduplicate event IDs.
- Rich text is sanitized; URLs use an allowlist/protocol validation.
- Exact location/contact/financial fields are excluded from public/search/JSON-LD payloads.
- Suspensions revoke sessions/serving/contact as appropriate.
- Repeated reports do not automatically establish guilt.
- Admin impersonation, if ever added, must be read-only by default and unmistakably bannered/audited.

---

## 32. UI template research and recommendation

Research checked on **18 November 2026**. No template should be purchased or copied into the repository without owner approval and license review. No single template covers this product’s five pillars and nine panels, so the recommended approach is to combine interaction references with a custom source-owned design system.

### 32.1 Best overall product reference — Velra

Link: [Velra — Next.js real-estate template with agency dashboard and NestJS API](https://www.aniq-ui.com/en/templates/next-js-real-estate-template)

Why it aligns:

- Public buy/rent search plus property pages.
- Agency property, inquiry and viewing dashboards.
- Separate backend, useful as an architectural reference for the Express API.
- Next.js/TypeScript/Tailwind direction.
- English/Arabic and RTL provide a useful localization reference.

Limitations:

- It is designed primarily for one real-estate agency, not a five-pillar marketplace.
- The current product page describes a newer Next.js stack and its own data approach; this project remains on the approved Next.js 15 + Prisma contract.
- It does not provide Materials RFQ, professional directory, dual jobs, nine panels, custom ads or the full compliance suite.
- It is paid; license/current compatibility must be verified before any purchase.

Decision: use its demo as the closest end-to-end UX reference, not as the source of truth.

### 32.2 Best public marketplace page reference — Homez

Link: [Homez — Real Estate React Next.js Template](https://themeforest.net/item/homez-real-estate-react-nextjs-template/47704622)

Why it aligns:

- Many property list/grid/map layouts.
- Agent/agency pages, multiple property-detail approaches and dashboard screens.
- Useful reference for filters, listing cards, property details and agent discovery.

Limitations:

- It uses Bootstrap/SCSS while this product mandates Tailwind + shadcn/ui.
- It is not a functional multi-pillar backend.
- Envato license depends on the monetized end product; verify the appropriate license before code reuse.

Decision: visual/information-architecture reference only unless separately approved.

### 32.3 Best implementation foundation — official shadcn/ui Blocks

Link: [Official shadcn/ui Blocks](https://ui.shadcn.com/blocks)

Why it aligns:

- The approved blueprint already mandates shadcn/ui.
- Source-owned, composable React code rather than a rigid theme.
- Dashboard, sidebar, auth, table, dialog and responsive patterns can be consistently adapted across nine panels.
- Easier to enforce accessibility, Tailwind tokens and Arabic RTL than mixing an unrelated theme.

Decision: primary component/design-system foundation.

### 32.4 Best admin-shell reference — Vercel Admin Dashboard

Link: [Vercel Next.js Admin Dashboard template](https://vercel.com/templates/next.js/admin-dashboard)

Why it aligns:

- Official listing identifies Next.js 15 App Router, TypeScript, Tailwind, Auth.js/NextAuth, PostgreSQL and shadcn/ui.
- Good reference for authenticated shell, tables and account flows.

Use its interface patterns alongside the project's separate Express API.

### 32.5 Best mobile Figma-flow reference — Craftwork Real Estate App UI Kit

Link: [Craftwork Real Estate App UI Kit](https://craftwork.design/product/real-estate-home-for-sale-app-ui-kit)

Why it aligns:

- Mobile flows for onboarding, login, search, property detail, add property, agent profiles, notifications and account management.
- Useful for testing the field-broker/mobile-worker experience before implementation.

Limitations: paid/licensed design asset; it covers real estate rather than the broader platform. Review license before download/reuse.

### 32.6 Best free accessibility reference — Freeframe Estate

Link: [Freeframe Estate template](https://freeframe.dev/templates/estate)

Why it aligns:

- Searchable listings, shareable filters, gallery, mortgage calculator and viewing forms.
- The official page documents keyboard-friendly and accessible patterns.
- HTML/Tailwind version is listed as free under MIT; the Next.js version has separate commercial availability.

Decision: study accessibility and public listing interactions, not use as the project base.

### 32.7 Recommended visual strategy

- Build a custom architectural identity with the approved off-white/slate/amber/emerald palette.
- Use official shadcn blocks as code primitives.
- Use Velra/Homez only to compare property information architecture.
- Use Craftwork/Freeframe to validate mobile and accessibility patterns.
- Do not inherit template branding, sample content, images or incompatible Bootstrap styles.
- Before reusing any paid/free asset, record source URL, version, license and copied component provenance.

---

## 33. MVP and implementation order

### Phase 0 — Product contract (this document)

Complete screen, form, key, API, status and panel contract before domain code.

### Phase 1 — Foundation

- pnpm monorepo.
- `apps/web` Next.js 15 + TypeScript + Tailwind + shadcn/ui + next-intl.
- `apps/api` Node.js/Express + Prisma + PostgreSQL.
- Database `the-property-pillar`.
- Shared contracts, lint/type/test configuration.
- Auth/OTP adapter interfaces, consent, role/capability authorization.
- Locale routing, RTL, PWA shell and design tokens.
- Base User/Role/Location/Consent/Audit/Upload/Notification models.

### Phase 2 — First sellable MVP

- Five-pillar homepage, with non-MVP cards visibly marked **Coming soon** only if necessary.
- Property search/detail/create/edit.
- Dealer profiles and automated micro-sites.
- Buyer alerts.
- Admin listing/RERA verification and reports.
- Core analytics and notifications.

### Phase 3 — Materials and service marketplace

- Vendor/product profile.
- Bulk RFQ and quote comparison.
- Professional directory and service leads.
- EMI/eligibility and loan inquiry routing.

### Phase 4 — Jobs and workforce

- White-collar job posting/application pipeline.
- One-minute worker registration.
- Worker search and availability/contact actions.

### Phase 5 — Monetization and growth

- Plans, checkout, webhooks and invoices.
- Builder campaigns and verified CPL.
- Referrals, credits, social posters.
- Seller acquisition funnels.

### Phase 6 — Search growth and compliance hardening

- Full programmatic locality content workflow.
- Split sitemaps, linked JSON-LD, AEO answers, `llms.txt`.
- Legal counsel-approved copy.
- Privacy export/deletion and grievance operations.
- Performance, accessibility, security and load validation.

---

## 34. Mandatory 24-rule traceability

| Blueprint rule | Contract location / implementation |
|---|---|
| How-to guides | Sections 2, 6 and 7; reusable `HowToUseGuide` |
| Auto location | Sections 2 and 11 |
| Ten languages + Arabic RTL | Sections 1, 6 and 11 |
| Area/currency conversion | Sections 1, 11 and property forms |
| Ad tracking/admin | Section 20 and Admin panel |
| Legal/RERA/privacy | Sections 22, 23 and 25 |
| Environment/media | Sections 3 and 8 upload contract |
| Role dashboards | Section 29 |
| Super-admin verification | Sections 22, 29 and 30 |
| Map/radius search | Sections 6, 12, 17 and 19 |
| Programmatic SEO/sitemaps | Section 27 |
| Mobile field UX | Sections 5–7 and all dashboard shells |
| PWA | Section 3/6/7 and Phase 1 |
| Low-bandwidth media | Sections 6–8 |
| Payments/GST | Section 21 |
| Voice search/form assist | Sections 11 and 19 |
| Anti-spam/OTP/rate limit | Sections 7, 10 and 31 |
| Notification hooks | Section 24 |
| WCAG accessibility | Sections 6–7 and acceptance criteria |
| GEO AI-search readiness | Section 27 |
| AEO schemas/direct answers | Section 27 |
| Seller funnels/referrals | Public routes and Section 24 |
| Social poster/share | Section 24 |
| Conversion analytics | Section 28 |

---

## 35. Configurable decisions to finalize before production

These do not block the initial scaffold but must not be silently hard-coded:

- Mapbox vs Google Maps and geocoding quotas.
- Private document storage strategy.
- OTP/WhatsApp provider and India DLT/template approvals.
- Currency-rate source and cache/update interval.
- Exact regional definitions for Bigha, Marla and other non-uniform units.
- Whether an unverified dealer/professional profile can be public and with what label.
- Listing validity/renewal windows.
- Plan names, limits, pricing, GST/tax treatment and refund rules.
- Referral qualification window and reward credits.
- CPL attribution/duplicate window.
- Admin/grievance/privacy operational SLAs after legal review.
- Exact notification defaults and quiet-hour exceptions.
- Retention/anonymization schedule by data category and jurisdiction.

Configuration belongs in database-backed admin settings or environment configuration, not scattered literals.

---

## 36. UI status presentation

| Semantic meaning | Badge treatment | Examples |
|---|---|---|
| Neutral/incomplete | Slate outline | Draft, archived |
| Information/in progress | Blue | Viewed, contacted, in review |
| Pending/action needed | Amber | Pending review, changes requested, OTP pending |
| Successful/live | Emerald | Published, verified, paid, accepted |
| Scheduled | Purple | Scheduled campaign/site visit |
| Unavailable/paused | Gray | Paused, busy, offline |
| Failure/rejection | Red | Rejected, failed, suspended |

Every badge includes readable text and, where useful, a tooltip/drawer explaining what it means and the next action. Never communicate status only with colour.

---

## 37. Definition of done for a functionality

A feature is not complete until:

1. Public/dashboard/admin screens required by its contract exist.
2. Form labels and internal keys match this document or an approved revision.
3. Client and server validation agree.
4. All status transitions are server-authorized, tested and audited.
5. Unauthorized roles cannot read or mutate protected data.
6. Loading, empty, error, offline, permission and success states are implemented.
7. Mobile 320/360 px, desktop and Arabic RTL layouts are tested.
8. Keyboard, focus, label, contrast and screen-reader basics pass.
9. Sensitive fields/files are excluded from public responses and structured data.
10. APIs have integration tests, idempotency where required and OpenAPI definitions.
11. Notifications and analytics fire from the authoritative event without duplicate conversion.
12. SEO metadata/schema exist for public indexable entities.
13. Performance is acceptable on a throttled mobile connection.
14. User-facing copy is localized or has an explicit translation fallback.
15. Product owner accepts the end-to-end behaviour against this document.

---

## 38. Final product summary

ThePropertyPillar.com is a mobile-first, multilingual real-estate lifecycle platform. Its five pillars connect property discovery and dealer sites, construction-material RFQs, finance and Vastu, professional services, and white- and blue-collar hiring. Nine panels serve distinct roles. Express owns business rules and PostgreSQL data in `the-property-pillar`. Next.js owns the localized web interface and public search presentation. The product roadmap includes subscriptions, featured boosts, builder advertising, referrals and SEO/AEO/GEO.








