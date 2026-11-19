# Current verification

19 November 2026 · `C:\Users\HP\Desktop\aryan\the-property-pillers`

The pasted request takes precedence where it differs from older requirements. The checkout has no `PROJECT_CONTEXT.md`, applicable `AGENTS.md`, Git metadata or previous audit reports under `docs/`. The supplied [V2 blueprint](<../ThePropertyPillar_Master_Blueprint_v2_Updated (1) (1).md>), [project explanation](../PROJECT_EXPLANATION_HINGLISH.txt), [UI/UX specification](../UI_UX_PRODUCT_SPECIFICATION.md), and the root and API READMEs were used alongside the actual code. Without Git metadata, branch, uncommitted work and earlier diffs could not be independently established. The existing source and five migrations were preserved. The older wording about two gateways does not apply to the latest Razorpay-only requirement.

The active architecture is Next.js App Router 15, Express 5, Prisma 6 and PostgreSQL. Browser calls use the same-origin `/api/v1` proxy, with a streaming résumé POST handler. The data model uses tenant-scoped workspace records and events, persisted JWT sessions, separate notification reads and Razorpay billing tables. See the [complete data flow and field inventory](DATA_FLOW_MAP.md).

## Baseline before changes

- **DEFECT** · The original localhost site exposed zero of the fourteen task forms. Open the requested URLs as a guest and check for the expected input. Three returned 404 (`post-property`, `finance-services/apply`, `support/report`), while eleven resolved to a generic detail shell without the task form. The home/header list action linked to dashboard create mode. The primary property, professional and job contact flow partially existed in secondary detail actions, with inconsistent auth entry. The dynamic route passed task segments to the directory resolver.
- **DEFECT** · Property enquiry could only bind a property. The project page had no enquiry action, and the API relation handled properties only. New submissions now accept exactly one typed parent and resolve its owner in the session tenant.
- **DEFECT** · Image GET sent files by basename directly and used a long-lived cache. The attach path checked URL syntax without checking who uploaded it or where it could be used. Revised image routes use upload purpose, owner and tenant at write/attachment time and check published references before public reads. Legacy references were preserved. Focused smoke covered owner preview, anonymous denial before publication, wrong account/purpose rejection and public access after publication.
- **DEFECT** · Immediate enquiry, service and application API schemas allowed omission of the consent accepted by the UI. The authenticated API now requires it and records a server timestamp. Consent transmission remains visible and unchecked before action.
- **DEFECT** · Admin could mark a newly submitted loan `ROUTED` even though no partner or delivery system existed. The status path now permits real internal contact and rejects new manual routing. The enquiry asks for contact permission. Amount cannot exceed a supplied property value. Historical `ROUTED` records still load.
- **DEFECT** · The API took a limited result set before applying some user search filters, and the browser keyword searched only its already-returned page. Search criteria now enter the Prisma query before the result limit. Property keyword, material city and category use the relevant public fields. This does not introduce pagination or maps.
- **DEFECT** · The browser independently generated country and currency names via its ICU version. A real guest page produced a hydration mismatch at `FK` and replaced the typed value. The frontend now uses deterministic option labels and shares the accepted currency codes with the backend. The initial axe scan also reproduced an accessible-name mismatch for the language menu and the label now includes the visible locale code.
- **Harness findings** · The first isolated baseline process could not relocate pnpm’s relative package links. The database migration succeeded and the working verification API was started from the existing package layout with its own schema and upload root. A Playwright response-body cache eviction occurred after a successful upload and was handled by checking HTTP status and following persistence. The automatic review blocked loose `next start` launch commands without a more specific reason. The built output was served by a loopback-only, contained local Next handler.

## Requirement-to-evidence matrix

| Requirement | Current result | Evidence and remaining action |
| --- | --- | --- |
| Local migrations and role sign-in | **VERIFIED** | All five existing migrations applied to clean public, core and billing audit schemas. API smoke exercised nine provisioned synthetic roles, checked scopes and revocation, rejected public admin registration, and handled missing and invalid sessions. Existing user database was untouched. Historical migration upgrade from a populated pre-profile schema was not run. |
| Email verification | **VERIFIED** locally. **BLOCKED BY CONFIGURATION** for live delivery | An isolated capture-only SMTP session exercised registration, blocked unverified login, confirmation, successful login, session and logout. Real SMTP sender acceptance and delivery were not exercised. |
| Property, enquiry, professional and job recipients | **VERIFIED** by isolated workflow checks | Core verified property moderation, review notes, correction, public projection, and application shortlisting. Public forms resolve recipients from the actual property, project, professional or job. See the public task results below for browser evidence. |
| Image and résumé authorization | **VERIFIED** locally for tested cases | Real image upload with purpose checked, same-account wrong purpose and wrong-owner rejected, guest sees published image only. A legacy attached photo survived a draft edit and publication. PDF résumé byte comparison, authorized employer retrieval, unrelated account denial and over-limit rejection in API smoke. Certificate, BOQ and controlled brochure routes are **MISSING IMPLEMENTATION**. |
| In-app notification visibility | **VERIFIED** | Core smoke confirmed shortlisted seeker notification, ten-unread cap, scoped mark-read and presence in history after read. Email, WhatsApp and SMS business notifications, outbox retries, leases, acknowledgement and scheduler are **MISSING IMPLEMENTATION**. |
| Saved search | **MISSING IMPLEMENTATION** for delivery | Criteria and status persist. No publication matcher, digest scheduler or delivery receipts were found. No artificial delivery is reported. |
| Dealer | **VERIFIED** for moderation/contact. **MISSING IMPLEMENTATION** for certificate and owned inventory | Core verified separate moderation and consent-gated contact. API validates social HTTP(S) links and public details render stored links. The profile form does not expose social inputs. Slug canonicalization/uniqueness, controlled certification evidence and dealer-only inventory need implementation. |
| Builder ads | **VERIFIED** for entitlement gate | Core and controlled billing verify unentitled denial, paid activation and refund revocation. Source filters public ads by campaign date and parent eligibility. Actual homepage, feed, city and calculator placement, valid interaction/lead tracking, CTR and CPL are **MISSING IMPLEMENTATION**. |
| Materials | **VERIFIED** for catalogue, vendor matching and quote acceptance | Core verifies fixed category/unit, catalog city filtering, compatible vendor projection, quote and acceptance. Concurrency across separate vendors, notification fan-out and BOQ access were not exercised or lack implementation. |
| Professional general request and verification | **VERIFIED** for selected recipient. **MISSING IMPLEMENTATION** for unassigned routing | Published profile required. Professional moderation changes publication state. No general routing or independent verification artifact system was found. |
| Jobs and worker availability | **VERIFIED** for workflow core. **MISSING IMPLEMENTATION** for phone verification | Job moderation, PDF upload and shortlisting, worker moderation and owner availability toggles passed. Worker registration uses the email-based account and has no OTP, verified-phone flag or voice input. |
| Loans | **VERIFIED** for internal lifecycle. **MISSING IMPLEMENTATION** for partner delivery | API smoke verifies rejection of new manual `ROUTED` and internal contact. No partner eligibility database, separate partner consent, signed delivery, receipts, scheduler or retry. Calculator-to-form amount carry-forward was not implemented. |
| Grievance and compliance privacy | **VERIFIED** for grievance status. **MISSING IMPLEMENTATION** for privacy operations | Core verifies case transitions and administration scope. No subject export, deletion request queue or configurable legal/operator policy workflow was found. |
| Razorpay payment, entitlement and invoice | **VERIFIED** with controlled provider. **BLOCKED BY CONFIGURATION** for merchant acceptance | Dedicated billing smoke checks provider binding and targeted plan, idempotency, verified capture, PDF, unrelated-account denial, activation and refund/replay. Razorpay is INR-only in this repo. Actual merchant credentials, webhook deployment and reconciliation remain live dependencies. No independent live renewal/expiry run occurred. |
| Referrals and administrator platform settings | **MISSING IMPLEMENTATION** | No referral attribution or credit ledger, redemption, promotion expiry, audited/versioned city and social settings, or public settings consumer found. |
| Search, GPS and geography | **VERIFIED** for the tested PIN and material city path. **IMPLEMENTED BUT NOT EXERCISED** for live GPS | Actual Chandigarh PIN returned canonical location. Unit tests distinguish invalid PIN from provider error. Public keyword/location filters are applied before limiting. The existing global geolocation calls the browser once per tab session and uses reverse geocoding. Trusted IP location, map, radius, area converter and currency conversion were not found. |
| SEO and translations | **IMPLEMENTED BUT NOT EXERCISED** for SEO beyond route checks. **MISSING IMPLEMENTATION** for full coverage | Sitemap and page shell exist and locales resolve. Public record details fetch on the client. No dynamic record sitemap, canonical/hreflang for these record pages, rich record markup/posters/QR. Message bundles exist for en, hi, pa, gu and ta. Other configured locales fall back to English, and many forms, validation messages and dashboards are English in all locales. |
| PWA, analytics and accessibility | **MISSING IMPLEMENTATION** for PWA and consent-aware analytics. **MANUAL REVIEW REQUIRED** for accessibility | No service worker or configured analytics pipeline detected. Axe scans are evidence for the scanned states only. Keyboard and screen-reader interaction, permissions on real devices and editorial localization remain manual checks. |

## Executed results

| Command or check | Current outcome |
| --- | --- |
| `pnpm.cmd typecheck` | Exit 0. Five workspace tasks completed. |
| `pnpm.cmd lint` | Exit 0. Five workspace tasks completed. The first run included generated alternate-build files and was corrected by excluding only the generated directory. Standard source rules remained enabled. |
| `pnpm.cmd test` | Exit 0. 21 API tests passed, zero failed or skipped. The other packages reported zero tests. |
| `pnpm.cmd build` and isolated Next production build | Both compiled, type-checked and generated 236 static pages. Both builds succeeded. |
| `pnpm.cmd smoke:local` | Exit 0. Fourteen workflow groups passed, including nine authenticated roles, image access, private résumés and notifications. [Core report](../tmp/audit-core-result.json). |
| `pnpm.cmd --filter @the-property-pillar/api smoke:billing` | Exit 0. Ten workflow groups passed with a controlled Razorpay provider. Two order calls and six payment lookups were intercepted locally. [Billing report](../tmp/audit-billing-result.json). |
| `node scripts/verify-public-forms.mjs` against the production build | Exit 0. Fourteen distinct form routes, sixteen persisted submissions including the extra property draft and project enquiry. Fourteen axe scans across seven desktop and seven mobile routes. Zero reported violations, horizontal overflow, page exceptions or HTTP 5xx responses during that run. [Browser report](../tmp/audit-public-build-result.json). |
| Development public route and axe scan | Exit 0. Fourteen guest form routes and fourteen scans with zero reported violations, horizontal overflow, page exceptions or HTTP 5xx responses. [Dev report](../tmp/audit-public-dev-scan.json). |
| Independent Prisma readback | Sixteen submitted IDs reconciled with their owner roles, initial status from `CREATED` events, current workflow state and per-tenant linked parents and recipients. |
| Focused browser checks | Wrong-role switch retained input. Invalid phone stayed under its field. A server 422 for an amount above property value bound to its own input. Correcting the amount and double-clicking saved one enquiry. |
| Tenant and search checks | A separate synthetic tenant could neither read through the public authenticated listing query, mutate nor enquire about the other tenant’s record. The guest query found an older matching published record with `limit=1`, proving the filter runs before the limit. |
| Locale and mail checks | Ten localized route HTML responses were HTTP 200 with the actual public form. Arabic rendered with RTL direction. One complete registration and session lifecycle was exercised over capture-only SMTP. |
| EMI and previous-format media | The built calculator verified 59 payments of INR 1,666.67 plus INR 1,666.47 total INR 1,00,000.00 at 0% over five years. A prior-format attached photo was private until publication and continued to work for the owner. |

Every mutation row in the following table began from a guest public form. The test typed into it, opened the embedded sign-in, verified that sign-in by itself sent zero workspace POSTs, and explicitly submitted. Each POST returned HTTP 201, the page displayed its reference, and the submitting account's workspace contained the persisted record. A separate Prisma query reconciled these references. The examples contain no personal, account or payment details.

| Task and collection | Status on response | Reference suffix and downstream check |
| --- | --- | --- |
| Post property · `properties` | `PENDING_REVIEW` | `1o232xilo5`. Started on Hindi route, used `OTHER` with a custom type and local photo. Admin published it. |
| Save property draft · `properties` | `DRAFT` | `1o3i7ii456`. Title-only draft appeared in the linked dashboard. |
| Property enquiry · `propertyInquiries` | `NEW` | `1oyutl5hc6`. Property-detail CTA preserved its ID. Owner had the same enquiry in their workspace. |
| Save search · `buyerAlerts` | `ACTIVE` | `1o7668sbp7`. Buyer criteria persisted. |
| Request quotes · `materialRfqs` | `OPEN` | `1o6su5woos`. Two typed items and a catalog delivery city submitted. Core smoke verified eligible vendor scope and quote acceptance. |
| Add product · `materialProducts` | `PENDING_REVIEW` | `1ozfk467et`. Vendor selected a catalog city and uploaded a product image. |
| Register professional · `serviceProfiles` | `PENDING_REVIEW` | `1o9klapoqx`. Admin published the profile with its uploaded portfolio photo. |
| Request service · `serviceInquiries` | `NEW` | `1oq5gabb29`. Professional-detail CTA retained the profile ID and the professional saw the same request. |
| Post job · `jobs` | `PENDING_REVIEW` | `1ot3yxjpmo`. Job data persisted and admin published it. |
| Apply for job · `jobApplications` | `SUBMITTED` | `1oa3ujkxh5`. Uploaded a synthetic PDF through the website and linked the selected job. The builder saw the application. |
| Register worker · `workerProfiles` | `PENDING_REVIEW` | `1orjh0v501`. Created with the existing role, trade and wage, without a résumé. |
| Register dealer · `dealerProfiles` | `PENDING_VERIFICATION` | `1ou4l8sdpi`. The role saved agency details, slug and local cover photo. |
| Submit project · `builderProjects` | `PENDING_REVIEW` | `1ofd1vjwky`. Admin published the record with its attached photo. |
| Project enquiry · `propertyInquiries` | `NEW` | `1ok97vosld`. Project-detail CTA preserved the ID. Prisma confirmed a `BUILDER_PROJECTS` parent and the builder received the record. |
| Loan enquiry · `loanInquiries` | `NEW` | `1o53920ihw`. Applicant-owned, GBP data retained and no partner was assigned. |
| Report a problem · `grievances` | `OPEN` | `1ov0hh3jgo`. Private report and reference saved. Core smoke exercised administrator progression and requester closure. |

## Reproduce safely

Run day-to-day development from the root with the example environment files and a PostgreSQL database named `the-property-pillar`. The standard defaults are web port 3000 and API port 4000.

```powershell
pnpm.cmd install
pnpm.cmd db:local
pnpm.cmd --filter @the-property-pillar/api exec prisma migrate deploy
pnpm.cmd --filter @the-property-pillar/api prisma:generate
pnpm.cmd dev
```

For verification, point `DATABASE_URL` at a new disposable PostgreSQL schema on loopback before applying the same migration command. Create fixtures with `pnpm.cmd --filter @the-property-pillar/api accounts:create-local <filename>`. Keep upload files isolated through an absolute `UPLOAD_ROOT`. Start Express on a distinct loopback port and set `API_PROXY_TARGET` to it in the Next process and at build time. Configure CORS for the exact loopback origins. Use capture-only SMTP and controlled billing settings. Keep generated credential files in the ignored `tmp/` folder.

```powershell
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd test
pnpm.cmd build
$env:SMOKE_ALLOW_MUTATIONS = 'true'
pnpm.cmd smoke:local http://127.0.0.1:4012 tmp/panel-credentials.audit-core.json tmp/audit-core-result.json
$env:BILLING_SMOKE_SCHEMA = 'audit_billing_20261119'
pnpm.cmd --filter @the-property-pillar/api smoke:billing tmp/panel-credentials.audit-billing.json tmp/audit-billing-result.json
npm.cmd install --prefix tmp/audit-tools --no-save playwright-core axe-core
node scripts/verify-public-forms.mjs http://127.0.0.1:3012 tmp/panel-credentials.audit.json tmp/audit-public-build-result.json
node scripts/verify-public-forms.mjs http://127.0.0.1:3011 tmp/panel-credentials.audit.json tmp/audit-public-dev-scan.json --scan-only
```

The repository did not define `smoke:platform`, `smoke:browser` or `test:a11y`. The browser verifier is the current executable replacement for task submissions and unrestricted axe scans. It uses installed Chrome via `AUDIT_CHROME` if it differs from the default Windows path. Recreate isolated schema and fixtures before repeating the mutation browser run because non-archived professional, dealer and worker profiles are intentionally singletons.
