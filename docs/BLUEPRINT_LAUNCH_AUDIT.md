# The Property Pillar launch audit

20 November 2026. Scope is the current checkout against the [V2 blueprint](<../ThePropertyPillar_Master_Blueprint_v2_Updated (1) (1).md>). The current product decisions retain Express JWT sessions, local uploads, email verification with optional mobile at general signup, and Razorpay for paid INR plans.

## Release decision

The core marketplace can move to a private staging environment. The full blueprint still has launch blockers. Keep paid builder campaigns disabled until their placements and measurement are in production. Keep provider-dependent features unavailable until the integrations and real accounts have been checked.

## Core workflow and status review

| Flow | Role and status evidence | Remaining work for the full blueprint |
| --- | --- | --- |
| Property | Owners, dealers and builders submit. Admin can request changes and publish. Listing owners receive property or project enquiries, and buyers can save properties and criteria. Private address fields stay out of public results. | Map and radius filters, granular property health checks, match delivery for saved criteria. |
| Dealers | Agency profile goes from `PENDING_VERIFICATION` to `VERIFIED` through admin review. Public contact follows the dealer's consent. | Certificate-backed verification, edit controls for all social handles, reliable slug uniqueness, owned inventory on each microsite. |
| Materials | Requester submits an `OPEN` RFQ. Eligible vendors are matched using active products, shared categories, and catalog delivery city IDs. A vendor submits a quote, the requester selects a vendor, and the parent and competing quote statuses are recorded in the same transaction. | BOQ upload, delivery confirmations and external notifications. |
| Finance and services | The borrower submits `NEW` and the admin records contact and qualification. A professional service request reaches the selected published profile's owner. | Lender or DSA onboarding and routing, partner consent, borrowing eligibility, and unassigned professional requests. |
| Jobs and workers | Admin reviews jobs. An applicant submits a private résumé, and the employer progresses the application. Closed deadlines reject new applications. Worker public availability follows the authorized `AVAILABLE` or `BUSY` status. | Worker mobile OTP, voice assistance and compact public hire flow. |
| Billing | Local Razorpay test double verifies role-eligible plans, idempotent capture, one PDF invoice and entitlement, scoped downloads, and key-only reconciliation of missed callbacks and refunds. | Merchant acceptance, operator-approved supplier data and prices, and meaningful delivery of builder ad benefits. |
| Grievances | The reporter and admin see the case. Admin can acknowledge, investigate and resolve under existing transition rules. | Formal operator disclosures and dedicated privacy export and erasure requests. |

All nine roles have scoped workspace access. The current role model uses a single `ADMIN` role.

## Verification evidence

The seven migrations applied to fresh PostgreSQL schemas. The API unit suite passed 24 tests and the final isolated workspace smoke passed 15 groups. The run covered all nine role logins, private record boundaries, concurrent saves, publication, quote state history, employer-only résumé access and worker status. Separate probes checked expiry rejection against the job field and capture-only SMTP registration and password recovery. Expired jobs remain readable as listings while new applications are closed.

Chrome covered 14 public task routes and persisted 16 submissions, including a property draft and both property and project enquiries. A follow-up accessibility scan reported zero axe findings on the 14 scanned routes. TypeScript and web lint passed. The Express and Next production builds passed, with Next generating 392 static pages. The Razorpay test double passed 10 checkout, invoice and refund checks without a live charge.

Every supported language is listed with a flag and its native name. Chrome checked the 16 options and their local image assets, route-preserving switching, mobile Arabic direction, and translated property-form labels in Arabic, Bengali, French, Hindi and Japanese. Shared form labels and controls are available across the 16 locales. Specialized labels and server validation messages still have English fallbacks.

## Blueprint rules

| # | Requirement | Audit result |
| --- | --- | --- |
| 1 | How-to instructions | Implemented on the 14 public task forms. Landing-page guides and guide translations are still partial. |
| 2 | Location | Browser permission and reverse geocoding are implemented with nearby sorting. Header-based IP location and regional coverage need work. |
| 3 | Languages | Sixteen locale routes including the ten in the blueprint. The shared switcher uses flags and native names. Arabic RTL, locale switching and core field labels work. Deep form, admin and regional suggestion coverage is partial. |
| 4 | Area and currency | Shared area units and per-listing currencies are stored and shown. No live area conversion, FX conversion or data source for regional land-unit rules. |
| 5 | Builder ad metrics | Approval, scheduling fields and entitlement checks exist. Placement impressions, clicks, CTR and verified lead counts are missing. |
| 6 | Legal, privacy and RERA | Report form and per-flow consent exist. Approved policy pages, privacy requests, verified registry information and operator contact details are missing. |
| 7 | Uploads | Local images and private résumés work. Controlled uploads for certificates, BOQs and brochures are missing. Existing brochure links can be displayed. |
| 8 | Role dashboards | Nine role scopes verified. Workers can change availability through their profile's allowed status actions. |
| 9 | Admin console | Moderation and grievances are implemented. Certificate evidence and separate moderator permissions need work. |
| 10 | Maps | Interactive maps and radius search are missing. |
| 11 | Sitemaps and canonicals | Directory and supported city/locality entries and locale alternates exist. Dynamic per-record sitemap indexes and other intent families are missing. |
| 12 | Mobile field UX | Sticky navigation, galleries and consent-gated direct contact exist. Floating field actions are partial. |
| 13 | PWA | Install prompt and offline cache are missing. |
| 14 | Low-bandwidth UX | Optimized image formats, lazy loading and skeleton states are implemented. Field-network performance still needs measured verification. |
| 15 | Razorpay and invoices | Local key-only flows and PDFs verified. Production merchant and GST issuer settings need validation before taking real payments. |
| 16 | Voice | Voice search and assisted form entry are missing. |
| 17 | Abuse prevention | Server-side rate limits, authenticated private mutations and registration email verification exist. Bot challenge and mobile OTP are missing. |
| 18 | Notifications | In-app unread/read state and history exist. Outbound SMS/WhatsApp/SMTP lead messaging and saved-search delivery are missing. |
| 19 | Accessibility | Keyboard, RTL and reduced-motion checks cover tested paths. The repository does not establish site-wide WCAG conformance. |
| 20 | Crawler resources | Crawler rules, `/llms.txt`, `/llms-full.txt` and its API alias are implemented. |
| 21 | Structured answers and entities | City breadcrumbs are implemented. Full entity JSON-LD, fact blocks, guide FAQs and market-rate sources are missing. |
| 22 | Seller referrals | Direct onboarding forms and the dealer microsite attribution link exist. Dedicated funnels and referral credits are missing. |
| 23 | Sharing | Public copy-link and consented WhatsApp contact exist. Branded social posters and platform social management are missing. |
| 24 | Analytics | Provider analytics and privacy-aware conversion tracking are missing. |

## Staging-to-live requirements

1. Build and apply Prisma migrations on the VPS, check the approved canonical site URL, and validate the same-origin API and web routes behind TLS. The supplied Nginx configuration targets PM2 web port 3000 and Express port 4000. Express can trust one proxy in this topology.
2. Use persistent upload storage, verify database and upload backups, and restore one isolated copy before launch. Create the real admin on the target tenant and verify access with each applicable operator role.
3. Supply the approved operator identity, privacy and grievance contact and policy content. Implement and review the missing privacy request workflow before a full public launch.
4. Verify production SMTP delivery and password recovery. Configure the exact Google callback only if Google sign-in is offered. Supply the merchant's GST invoice profile and approved Razorpay INR prices, then verify a controlled payment and refund on the target deployment.
5. Review real published inventory and disable unimplemented paid packages and integration-dependent claims. Keep built-in QA accounts, samples and test objects in isolated databases.
