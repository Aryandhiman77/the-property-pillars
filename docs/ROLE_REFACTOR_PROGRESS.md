# Role and domain refactor progress

## M0 · Local restore rehearsal

On 24 November 2026 the local PostgreSQL backup was restored to a separate database, tpp_rehearsal_20261124112118. Before migration, all 24 public table row counts and row-content checksums matched. The 311 workspace records included 54 properties, 30 jobs and 6 applications. All 36 files in the root upload directory matched the copied files byte for byte. The workspace JSON scan found zero missing local WebP/MP4 references. These checks cover the local public schema and root upload directory. They do not establish production parity.

The dump, upload copy, workspace change inventory and media exception list are under the ignored tmp/rehearsal-20261124112118 directory. The database contains personal data and must stay out of version control. Baseline typecheck, lint and 41 API tests passed.

## M1 · Roles and hiring permissions

Email, Google and mobile signup now retain the selected eligible role. The new additive migration records ambiguous historical account roles for administrator review. The migration ran on the restored database, the local application database and the local UAT schema. It does not rewrite user roles or job creators. Admin decisions record the approver, date, original role, decision and reason. Actual role changes invalidate existing sessions.

The role rehearsal uses a dedicated tenant on a restored loopback database. Checks passed for all nine workspace sessions, denied non-admin job writes, denied ineligible property creates, admin draft creation and editing, role-review decisions, duplicate decision rejection and third-post credit accounting. The paid-credit test uses a persisted historical captured-order fixture and does not perform a Razorpay charge. Browser checks opened all nine UAT dashboards and the admin job form. Repo typecheck, lint, Prisma validation and the default API suite passed.

### Job publication acceptance - passed 24 November 2026

The original publish path was synchronous. The workspace PATCH checked session, tenant, role, transition and submission fields, then called Gemini before opening the transaction that updated the job and recorded its workspace event. Local word checks and explicit provider flags returned 422. Missing credentials, timeout, network failure and malformed provider output all returned the same 503. The provider had a 25-second timeout and no retry. Failed checks produced no job audit event. Closing used the existing status transition and removed the job from the public directory.

| Outcome | Job and audit behavior |
| --- | --- |
| Invalid submission | Field or transition errors reach the editor before moderation. |
| Automated pass | Publication and the automated approval event commit together. |
| Content flagged | The attempted changes stay unpublished. Admin receives the policy or field error. A later provider outage cannot authorize the same flagged content. |
| Provider unavailable | The job retains its previous state. The audit log records the cause. The editor offers retry and manual review. |
| Confirmed manual review | The same authenticated administrator must confirm the same job, revision and proposed content. Publication records the original provider state, cause, confirmation, attempt ID, timestamp, job and actor. |
| Closed | The job leaves the public directory. Its record, creator and moderation history remain available. |

The manual action uses the existing job PATCH with a server-issued attempt ID and explicit confirmation. A competing moderation decision or a saved edit invalidates the previous confirmation. Both publication paths use the same validation, role and transition checks. The existing WorkspaceEvent audit log holds the evidence. This follow-up required no schema change. Local Prisma migration status reported all 19 migrations applied.

Gemini uses the server-only GEMINI_API_KEY and GEMINI_MODERATION_MODEL settings in .env.example. Text checks have an eight-second deadline per attempt. Media checks retain their 25-second deadline. Transient network failures, timeouts and selected server errors receive at most one retry. Quota, credential, policy and malformed-response outcomes return immediately. Failure logs contain record identifiers and a normalized reason.

Chrome UAT verified live Gemini approval, publication and closing. A second run disabled the provider credential for the isolated UAT process, verified that manual publication required the checkbox, published the reviewed job and closed it. UAT was restarted with its ordinary environment. Both test jobs ended closed.

The default API suite passed 42 tests. Its opt-in PostgreSQL rehearsal also passed when run separately against the restored database. The rehearsal covered all nine roles, public visibility, unchanged flagged content during an outage, stale and concurrent confirmations, audit history, historical role review and third-property credit accounting. Repository typecheck, lint, API build and Prisma validation passed. Verification was local.

## M2 - Role profiles and master data

**Passed local acceptance on 24 November 2026.** A member can save individual sections, return to their saved answers, see what is missing, submit for verification and read the administrator's decision. The home dashboard reads its percentage from the same server calculation as the editor and review screen.

### Audit and implementation

| Area | Finding and change |
| --- | --- |
| Account | JWT sessions, account contact details, avatar, account settings, password changes and the existing mobile signup path remain the account layer. Role-specific information now belongs to a profile. Admin uses account settings and review tools. |
| Business profiles | Earlier Dealer, Professional and Worker listings used workspace JSON with their own publication status. Those listing IDs, submissions, public routes and histories survive. The typed profiles supply verified business details on existing directory pages. |
| Catalog | Previously the app combined role form constants with a bundled GeoNames city index. M2 supplies tenant-scoped database IDs for 17 catalog types. Established property, material and unit identifiers seed the applicable catalogs. Admin can add, rename, sort, deactivate and reactivate entries. Existing references survive deactivation. |
| Locations | Country, state, city and locality have internal IDs and validated parent relationships. Local city matching uses the bundled 70,092-city catalog. The optional server-side Mapbox integration accepts autocomplete or coordinates, signs the proposed result for the member and resolves it to a canonical city before saving. Manual choices and local text search work without a provider. |
| Files | Public listing uploads and existing application resume access retain their normal routes. New profile files store metadata in PostgreSQL and bytes outside the public upload directory. Upload checks include role, field purpose, extension, detected content and size. Public images are decoded and re-encoded. Protected downloads check the owner or reviewing Admin within the tenant. |
| Verification | Submission requires 100% completion. Admin can approve, request changes, reject or suspend under the allowed transitions. Decisions store actor, revision, reason, previous state and timestamp. A material profile edit invalidates the previous approval. Stale reviews fail. Suspension persists through edits until Admin acts. |
| Navigation | Each marketplace role has its own primary menu, progress card and section editor. Site visits filter real property enquiries. Builder inventory links to existing property records. Saved jobs use a database relation with the published vacancy and can be saved or removed from job detail and the seeker's dashboard. Billing, notifications and legacy workspace records remain accessible. |

### Completion rules

The Account section requires a name and phone. Email is required for all roles except Skilled Worker. An entered contact number and a verified phone credential are tracked independently. Each required section has equal weight within its role. Optional answers can be saved without moving the percentage.

| Role | Required sections in addition to Account | Other profile data supported |
| --- | --- | --- |
| Buyer | Property preferences, budget and preferred location | Current city, configuration, possession, loan preference and alerts |
| Owner | Ownership type and location | Contact preferences, address, coordinates and private ownership or authorization proof |
| Dealer | Contact person, agency, office, registration and specializations | Service areas, agency images, RERA proof, languages, working hours and social links |
| Builder | Company, representative, registered office, registration and markets | Company identifiers, business proof, track record, specializations and media |
| Material Vendor | Business, address, material categories and delivery availability | Brands, delivery cities, radius, minimum order, lead time and private business proof |
| Professional | Practice and category, experience and service area | Subcategory, qualifications, licenses, supporting documents, portfolio and contact channels |
| White-collar Job Seeker | Career, employment preferences, skills and current resume | Salary, work modes, cities, education, history, certifications and privacy preferences |
| Skilled Worker | Trade, city, rate, availability and skill level | Additional trades, tools, vehicle, travel radius, portfolio and contact preferences |

For Dealer and Builder, answering Yes to RERA registration adds the authority, registration number and certificate to the registration check. Reviewers can inspect private documents even though the marketplace cannot download them.

### Schema, migration and backfill report

Two additive PostgreSQL migrations were applied to the restored rehearsal database, local working database and isolated UAT schema. The application database has 21 applied migrations.

- `20261124080100_domain_profiles` adds the profile hub, eight role detail tables, master hierarchy, profile choices, file metadata, decision history and per-source migration notes.
- `20261124080200_saved_jobs` adds a user/job composite key and foreign keys. Repeated saves produce a single bookmark.
- The local public schema gained **169 domain profiles** across 189 existing users. Every non-Admin user had a profile matching their stored role. The 75 historical Dealer, Professional and Worker source cards produced 73 reconciliation records and two older-card records.
- The backfill copies compatible fields and links unambiguous catalog references. Unresolved city names, service labels, public listing identifiers, consents and media references remain on their original records. `ProfileMigrationNote` records source ID, destination, mapped keys and retained keys. The backfill skips edited profiles and can run again using `pnpm --filter @the-property-pillar/api profiles:backfill`.
- Row counts and row-content digests matched before and after migration for all 189 users, 311 workspace items, 295 workspace events and 10 historical role reviews. Billing orders and entitlements were both empty in this local baseline. M1 separately exercised a captured-order fixture on the restored database.
- Browser testing exposed a UAT Owner credential that belonged to a historically converted Dealer. The isolated picker now provisions a separate Owner test identity and preserves the original account and listings.

### Main implementation files

| Responsibility | Paths |
| --- | --- |
| Schema and forward migrations | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20261124080100_domain_profiles/`, `apps/api/prisma/migrations/20261124080200_saved_jobs/` |
| Shared role fields and catalog dependencies | `packages/contracts/src/role-profiles.ts`, `packages/contracts/src/index.ts` |
| Profiles, completion, decisions and saved jobs | `apps/api/src/profiles/profile.ts`, `details.ts`, `router.ts`, `apps/api/src/app.ts` |
| Catalog, addresses, private files and public projection | `apps/api/src/profiles/masters.ts`, `places.ts`, `files.ts`, `public.ts`, `apps/api/src/locations/delivery-cities.ts`, `apps/api/src/uploads/resumes.ts`, `apps/api/src/workspace/router.ts` |
| Legacy reconciliation and configuration | `apps/api/src/profiles/legacy.ts`, `apps/api/src/scripts/backfill-role-profiles.ts`, `apps/api/package.json`, `apps/api/src/config/env.ts`, `.env.example`, `.gitignore` |
| Member and Admin UI | `apps/web/src/features/profiles/`, `apps/web/src/features/dashboard/dashboard-app.tsx`, `apps/web/src/features/marketplace/directory.tsx`, `listing-actions.tsx` |
| Regression and UAT | `apps/api/tests/profile-rehearsal.test.ts`, `apps/api/tests/role-rehearsal.test.ts`, `scripts/manual-uat.cjs`, `apps/api/src/scripts/create-panel-accounts.ts` |

### Acceptance evidence

| Gate | Result |
| --- | --- |
| Toolchain | Prisma validation and migration status, repository typecheck, lint, API build and Next.js production build passed. |
| Default test suite | 42 passed. The two opt-in database suites ran separately. |
| Restored PostgreSQL | 18 tests passed across the two opt-in suites, including the M2 parent test. Covered all eight roles, invalid fields and IDs, percentages, preferences, verification decisions, stale revisions, protected files, cross-tenant denial, approved public images, bookmarks, provider failure, city-state selection, mapping a newly submitted agency card and publication of verified profile details. |
| M1 regression | The nine-role rehearsal passed Admin-only job writes, non-Admin denials, controlled Gemini outcomes, manual moderation, close and public visibility, audit history, Owner preservation and idempotent credits. |
| Chrome role UAT | Opened all eight role dashboards, compared the overview percentage with the completion API, saved a section, refreshed and recovered the saved answer. Checked narrow layouts at 360 px, dependent dropdowns and upload controls. |
| Chrome Admin UAT | Created, edited and deactivated a catalog entry. An Owner selected a canonical address, uploaded a private PDF and submitted a complete profile. Admin opened the PDF, approved the profile and saw the recorded decision. |
| External services | Local GeoNames and the provider-outage path passed. Live Mapbox requests require a server-side `MAPBOX_GEOCODING_TOKEN` configured for stored geocoding results. This run did not use a live Mapbox credential. |

Production rollout still requires applying the reviewed migrations and backfill to the deployment database and provisioning persistent private-file storage alongside the configured upload directory. Existing lookup constants used by vertical forms remain compatible during their later transition. The M3 results follow.

## M3 · Property listing domain

### Historical data and migration

The existing listing was a `WorkspaceItem` containing property JSON. Credits, enquiries, comments, bookmarks, moderation history, feature placement and public URLs referenced its ID. The new `Property` uses that same ID. Ordinary writes update the workspace record and the relational property in one transaction. Existing API clients can continue sending the workspace payload.

The three additive Prisma migrations are `20261124133000_property_domain`, `20261124133200_property_details` and `20261124133400_property_measurements`. They introduce typed property ownership, location, category and type, status, pricing, area and layout. Child tables store area measurements, charges, specifications, ordered gallery media, videos, floor plans, documents, amenities, nearby landmarks and migration notes. Tenant, publication, location, source, normalized area and price indexes support the read paths.

| Local inventory | Verified result |
| --- | --- |
| Historical properties | 54 before and 54 after, with all original IDs. 32 Dealer and 22 Owner. |
| Historical visibility | 31 published, 20 pending review, 2 archived and 1 returned for changes. |
| Backfill | 54 relational properties, 54 migration notes, 54 area measurements and 33 gallery references. 53 listings used square feet and 1 used square metres. Repeating the command migrated 0 records. |
| Mapping limits | All 54 mapped their primary category, type and area unit. All 54 retain some legacy attributes in the original JSON. Zero listings were skipped. A missing historic field, coordinate or precise canonical locality stays unknown. Inspect `PropertyMigrationNote.retainedKeys` and `issues` before enriching a historic record. |
| Preservation | The pre-change dump was restored into a separate database before applying the migrations locally. Counts and row-content checksums matched for all 16 protected original tables, including users, workspace records, credit and billing history. Browser test listings were created in the isolated UAT schema. |

### Listing, moderation and publication

- **Permissions.** Every signed-in role can submit a property for review. Dealer and Builder listings keep their respective sources. Other accounts list as owners while retaining their account roles. Admin reviews listings. Tenant and ownership checks apply to updates, histories and files. Draft creation and repeated submission retain the existing posting-credit rules.
- **Wizard.** The public posting route and dashboard editor share 18 steps. In order they are listing intent, property type, location, basic details, area and layout, interior, exterior and building, amenities, pricing, images, videos, floor plans, documents, nearby places, description, contact and lead routing, preview and submit. Save and continue persists the active step. Drafts can be reopened. Missing required fields link back to their sections, stale edits return a conflict and leaving an edited form prompts for confirmation.
- **Fields and price.** Category and type control the available fields. Apartments and houses expose rooms and furnishing. Plots expose use, access and dimensions. Offices expose cabins, workstations and fit-out. Shops and warehouses expose their relevant frontage, loading and access details. Amenity and unit selectors use the master catalog. Pricing supports sale, rent and lease, exact/range/on-request values, deposit, recurring amounts and itemized charges. Area measurements retain the selected unit. Cross-unit comparisons use defined conversions. Region-dependent units retain their original values.
- **Media.** The gallery stages files until save, reports progress, preserves order and cover, and records photo classification, caption and alt text. Uploaded walkthroughs are processed MP4s. External tours support validated YouTube and Vimeo URLs, titles, thumbnails, captions and order. Floor plans are a separate collection with titles, categories, area, configuration, optional image or PDF, ordering, a primary plan and a public viewer. Each plan needs at least one file. Ownership and regulatory proofs are private. Published brochures and marketing plans can be explicitly public.
- **Moderation.** Admin can filter the property review queue by source, location, category, date, status and reports, inspect files and history, request changes, approve, publish, reject or suspend. Returning or rejecting a listing requires a reason. Material edits to a published property return it to review and remove it from public results. Moderation state, publication state and availability are separate. The first confirmed submission records a freshness date. Existing featured entitlements and ranking are retained.
- **Public discovery.** Existing property URLs serve the gallery, type-specific facts, floor plans, public documents, tours, listing contact, saved action and enquiry/site-visit flow. Published property metadata and JSON-LD use listing data. List and map results share filters, sorting and 20-item pages. Filters include source, type, place, price, size, amenity and possession. Exact map access follows listing privacy. A site visit creates a dated enquiry linked to the property and its lister, with normal dashboard notification and email handling.

### Changed modules

| Concern | Main files |
| --- | --- |
| Schema and catalog | `apps/api/prisma/schema.prisma`, the three migration directories above, `apps/api/src/profiles/masters.ts` |
| Validation, persistence and files | `packages/contracts/src/property-listing.ts`, `apps/api/src/properties/domain.ts`, `apps/api/src/properties/assets.ts`, `apps/api/src/scripts/backfill-properties.ts`, `apps/api/src/app.ts` |
| Existing APIs | `apps/api/src/workspace/{router,config,validation,search-filters,property-engagement,property-map,property-nearby,featured-order}.ts` |
| Posting and moderation UI | `apps/web/src/features/dashboard/{workspace-form,property-wizard,collection-config,media-drafts}.*`, `apps/web/src/features/marketplace/public-task.tsx`, `apps/web/src/features/admin/{admin-operations,admin-record-review}.tsx` |
| Discovery and details | `apps/web/src/features/marketplace/{directory,result-filters,property-assets,property-gallery,property-contact,property-map}.*`, `apps/web/src/features/home/property-search-params.ts`, the locale section and item routes under `apps/web/src/app` |
| Verification and storage | `apps/api/tests/property-rehearsal.test.ts`, `scripts/manual-uat.cjs`, `.gitignore`, `apps/api/package.json` |

### Verification and delivery

| Check | Result |
| --- | --- |
| Prisma | Validation passed. Local migration status shows all 24 repository migrations applied. |
| Repository commands | `pnpm build` passed all 4 tasks. `pnpm typecheck` and `pnpm lint` passed all 5 tasks each. Default API suite passed 43 tests with 3 opt-in suites skipped in that invocation. |
| Restored PostgreSQL | With all three opt-in suites enabled, 26 passed, 0 failed, 0 skipped. M1/M2 contributed 18 and M3 contributed 8 including its parent. Assertions cover all nine roles, draft conflicts, property type constraints, area's unit conversion, video validation/order/deletion, private proofs, published brochure access, image-only/PDF-only/combined floor plans, file ownership, public suppression, revision checking, lead routing and credit idempotency. |
| Chrome seller UAT | Owner saved a 1,500 sq ft apartment draft, added the “3 BHK Type A” image and PDF, selected a canonical London address, reloaded, previewed and submitted. Dealer submitted a 2,100 sq ft resale plot. An account with exhausted credits saw the upgrade prompt. Builder submitted a 3,500 sq ft office. A separate real MP4 played before save, uploaded through the normal form and played again after reloading the saved draft. |
| Chrome Admin and Buyer UAT | Admin returned the resale listing with a reason and approved the correction in the review queue. Buyer searched, saved, opened a listing and submitted a future site visit from the public form (HTTP 201). The Buyer could zoom the published floor plan and open its PDF. Apartment, plot and office cards rendered the applicable facts. The floor-plan wizard fit a 360 px viewport. |
| Query inspection | The local four-card public results page issued 13 SQL statements including transaction control. The filtered page also issued 13. One detail lookup issued 7. These calls made zero reads of the floor-plan, document or video tables. Files are loaded separately when needed. This measures the UAT dataset only. |
| Local evidence | The ignored `tmp/` directory contains `m3-chrome-publish.log`, `m3-chrome-admin3.log`, `m3-chrome-cards.log`, `m3-video-browser.log`, `m3-query-review.log`, `m3-public-detail.png` and the `m3-release-*` validation logs. Open `/__uat` on the normal local web port to reproduce the role flows. |

**Rollout.** The local M3 implementation and the role-based acceptance flows passed. The VPS has not been migrated or deployed in this run. Before rollout, take a new database dump and copy both the public upload directory and its sibling private property-file directory to persistent storage. Run `pnpm --filter @the-property-pillar/api exec prisma migrate deploy`, then `pnpm --filter @the-property-pillar/api properties:backfill`. Compare ID, credit and invoice counts and inspect migration notes before enabling traffic. A rollback can restore the prior application while retaining the additive tables. Restore a tested database and file backup together if data recovery is required.

Live Mapbox geocoding, delivery to a real SMTP inbox, and production-scale performance were outside the local evidence. The site-visit request records a preferred time; the lister still needs to confirm the appointment. M4 Builder Project inventory remains pending.

### M3 recheck on the current working tree · 24 November 2026

The working tree already contains an additional, in-progress M4 migration. Prisma validated the schema and reported all 25 local migrations applied. No migration or backfill was reapplied during this recheck. The original 16 protected table checksums still matched the M3 baseline. All 54 historical workspace properties matched a relational property and migration note, with 54 area measurements and 33 gallery references.

The default API run passed 44 tests and skipped four opt-in suites. The separate M1, M2 and M3 run against the restored PostgreSQL database with the current migration applied passed 26 tests with zero skips or failures. Typecheck and lint each passed all five tasks. A forced production build passed all four tasks. All three commands ran with zero Turbo cache hits. The command logs are in `tmp/m3-current-*.log`.

Chrome reopened the previously published Owner apartment from the Buyer session on the normal UAT port. Its dedicated **3 BHK Type A** viewer opened and closed, the PDF download returned HTTP 200 with a PDF signature, and the document width matched the 360 px viewport. The seller submissions, Admin review, video playback and Buyer site-visit evidence are recorded above. M3 passed local acceptance. The UAT Builder reached the expected posting-credit prompt during the subsequent M4 work. A fresh Builder completed the linked-property publication scenario, documented below. Production rollout remains pending.

## M4 · Builder projects and inventory

### Existing data and additive migration

Builder projects previously lived in workspace JSON. Campaigns and public routes referenced the workspace ID. The new project relation shares that primary key. The migration `20261124153000_builder_project_inventory` adds project, phase, tower, configuration, inventory, amenity, specification, nearby place, payment schedule, milestone, photo, video, drawing, document, construction update and migration-note records. It links the existing M2 Builder profile and M3 property. Composite foreign keys constrain hierarchy links to a single project. Unique constraints protect project slugs, inventory codes, scoped unit numbers and the unit-to-property link.

The pre-migration dump was restored separately. Original column values and row counts matched the baseline for all 50 pre-existing tables after migration and backfill. A second local comparison following browser testing found the same 50 matches. The working database retained all 54 historical M3 properties and both linked campaigns. The backfill mapped all 24 historical projects, including 22 published and two archived. Repeating it added zero. Five image references and all original IDs survived. Historical inventory, videos and plan drawings had no reliable source records.

All 24 historical projects have migration notes. Four city values and all 24 localities had no unambiguous canonical match. Four projects had unclassified historical photos. All 24 had registration numbers without verification evidence. The original display values remain accessible and verification requires Admin review. The original JSON retains the legacy sample marker.

### Posting, review and public discovery

Builder and tenant Admin use a 20-step project editor. It saves project details independently of the existing Builder profile and uses the master catalog for addresses, property types, areas and amenities. A Builder manages their own projects. Admin can select a tenant Builder, review that Builder's regulatory evidence, request changes and approve publication. Material changes return approved projects to review. Construction status, moderation, publication, profile verification and paid sponsorship are tracked separately.

Phases, towers and configurations group private unit inventory. Single-unit creation, duplication, patterned bulk entry and paginated filters use the same inventory service. A project revision guards competing writes. Duplicate units or capacity errors roll back the whole batch. Public configuration counts use tracked active inventory and can show availability on request. The public page includes project gallery classifications, videos, master/site plans, configuration drawings, payment milestones, amenities, dated construction updates, public documents and linked published properties where present. Private evidence remains behind an authenticated download. Replacing a current public price list retires the old listing from public downloads.

Search supports name, city, locality, Builder, project category, configuration, property type, currency, price, possession, construction status, amenity and verified registration. Project IDs and canonical slug URLs resolve to the same project. The SSR detail page supplies metadata, breadcrumbs and structured data. Enquiries and site visits record the project, optional configuration, contact, consent, preferred time and Builder recipient. The existing workflow supplies inbox events, queued mail and grievances. A preferred visit time requires confirmation by the Builder. The project's contact preference selects the initial enquiry type. WhatsApp requires the Builder to opt in with a valid profile number. The Buyer receives that link after the enquiry and consent have been recorded.

### Unit and property ownership

Creating a property from a unit makes one M3 draft. Concurrent clicks return the same draft. The project supplies location, common amenities and the Builder. The configuration supplies type, layout and default size/price. The unit supplies its number, floor, availability and overrides. The property editor links back to inventory for inherited values. The lister can edit marketing text, gallery and contact details independently. Project drawings are linked with the appropriate phase, tower and configuration scope. M3 posting credits and Admin moderation apply before a property goes public.

Unit availability and the linked property's public state change transactionally. Selling a published unit removes the available listing. Marking a published property sold in M3 updates the unit, inventory counts, project revision and history. A price or other material inventory change to an approved listing requires a new review. Operational notes, discounts and booking details stay private.

### Acceptance evidence

| Gate | Local evidence |
| --- | --- |
| Migration | All 25 migrations applied. Historical counts, uncertainties and checksum comparisons appear above. |
| Automated tests | The default API suite passed 44 tests, with four opt-in entries skipped. On the restored database, the separate M1–M3 suite passed 26 tests and the M4 suite passed 11, with zero failures or skips in either rehearsal. Coverage includes all nine roles, competing edits, transactional rollback, reserved-to-sold tower counts, publication, private files and both directions of the unit/property link. |
| Build | Prisma validated the schema, migration status was current, typecheck and lint each passed all five Turbo tasks, and the forced production build passed all four tasks with 424 Next.js pages generated. All three Turbo checks ran without cache hits. |
| Browser workflow | On the normal UAT port, a fresh M2-verified Builder created **M4 UAT Residency** at a canonical city and locality, Phase 1, Tower A, two housing configurations and units A-101, A-102 and A-201. The Builder added the cover, site photo, render, master drawing, 2 BHK image/PDF, brochure, amenity, payment schedule, nearby place and construction update. Admin requested a correction and published the revised project. |
| Buyer and lister | Buyer searched for the project, opened the drawing, sent an enquiry for 3 BHK Type B and requested a site visit. Builder saw the lead and created the A-101 property. Buyer found the published property in search and followed its link to the project. Reopening a published unit from inventory now opens its authorized M3 dashboard editor. Chrome verified a marketing edit to A-101, approval in the Admin review dialog and the Buyer search-to-project round trip. The first edit attempt encountered a transient content-moderation service outage and preserved the published version. The retry succeeded through the normal review path (`tmp/m4-a101-retry.log`). A-102 independently passed the M3 submission and the Admin dashboard's property review form. The earlier exhausted-credit Builder correctly saw the plan prompt. |
| Buyer navigation and media | Chrome followed the directory enquiry link, the configuration-specific floor-plan link and the verified Builder's public profile with its own project listings. Buyer played the uploaded MP4 after the Admin reviewed the new media. A Buyer who consented to a WhatsApp enquiry received the opted-in Builder's contact link after submission. The browser test kept all messages local. |
| Mobile | At 360 CSS pixels the configuration editor, inventory, media upload, public project, both drawing viewers and enquiry form fit without horizontal page overflow. Evidence is under `tmp/m4-fresh-*.log`, `tmp/m4-builder-mobile.png`, `tmp/m4-public-mobile.png` and `tmp/m4-enquiry-360.png`. |
| Query review | On the two-project UAT dataset the directory used 12 SQL statements, ranked search used 14, detail used 26 with WhatsApp enabled (24 using the standard enquiry preference), including one grouped inventory query, and filtered private inventory used 14 including pagination and its count. Directory requests read zero units. These four paths read zero document or drawing tables. Downloads and drawing metadata use separate endpoints. Counts include transaction control and do not predict production latency. |

M4 passed local acceptance on 24 November 2026. The final suite outputs are in `tmp/m4-integration.log`, `tmp/m4-regressions.log`, `tmp/m4-final-default.log`, `tmp/m4-final-types.log`, `tmp/m4-final-lint.log` and `tmp/m4-final-build.log`.

### Changed modules and rollout

The main backend files are `apps/api/prisma/schema.prisma`, the migration named above, `apps/api/src/projects/`, `src/uploads/project-files.ts`, `src/scripts/backfill-projects.ts`, the workspace router and validation, and M3 property asset and inventory synchronization. The main frontend files are `apps/web/src/features/projects/`, the existing locale section and detail routes, the dashboard and property form, and the shared floor-plan viewer. The restored-database regression suite is `apps/api/tests/project-rehearsal.test.ts`. The existing same-port manual UAT launcher applies the local migrations and backfill.

For deployment, back up PostgreSQL and both media directories, then rehearse against that backup. Run `pnpm --filter @the-property-pillar/api exec prisma migrate deploy` and `pnpm --filter @the-property-pillar/api projects:backfill`. Compare original project IDs, publication states, campaign links, property and credit records before enabling traffic. Public uploads and the sibling private file directory both need persistent storage. Preserve the additive tables during an application rollback. Recovery from a destructive database incident requires restoring the matching database and file backups together. No additional third-party credentials are required for M4 itself. Production delivery of queued mail uses the deployment's existing SMTP configuration. Linked M3 listing submissions continue to require the existing content-moderation provider configuration. Verification here used local PostgreSQL and Chrome. VPS deployment, delivery to an external email inbox and production-volume load testing remain outside this run.
## M5 · Materials, Services and Workforce Marketplace

**In progress.** The initial local public-schema inventory contained 27 material products, 15 RFQs, 10 quotes, 22 professional profile cards, 21 worker cards and two service enquiries. These records use workspace IDs shared by the dashboard, public routes, events and promotions. Professional cards are identities and cannot reliably be converted into individual service offers without more information.

The M5 implementation reuses the M2 role profiles, catalog hierarchy, protected profile files, job permissions and existing promotion checks. The workspace quote path already calculates totals and serializes acceptance on the RFQ; product-specific fields, specifications, lines, attachments, rate changes and public discovery need dedicated relational handling. The legacy RFQ matching predicate previously exposed requests with a missing city to otherwise unmatched vendors. That broad fallback has been removed.

The initial PostgreSQL restore matched counts and row-content checksums for all 66 original application tables, including 54 properties and 24 builder projects. The additive material catalogue migration was applied to that fresh restore. The same 66 checksums matched immediately after migration, before backfill. Local evidence is under the ignored `tmp/m5-*` paths.

The shared profile/project master picker now uses one editable Headless UI combobox with debounced database lookup, keyboard selection and removable selections for multi-value fields. The Worker Service area section groups Country, State, City and Localities. Previously saved canonical cities supply missing ancestors. Desktop typecheck and lint passed; the default API suite passed 44 tests with four opt-in suites skipped. In Chrome at 360px the Worker editor disabled child controls until a parent was present and supported typing, keyboard selection, and Escape through India → Punjab → Ludhiana without horizontal overflow. Wider M5 UI acceptance, protected files, restored regression suites and full release verification remain open.


**Material catalogue checkpoint.** The additive catalogue migration, transactional product writes, admin specification editor, vendor catalogue picker and public specification facts are connected. The restore backfill imported 27 products, 8 media links and 10 delivery-area links. A second pass imported zero. Original workspace IDs and JSON remain intact, with per-record mapping notes. Restored PostgreSQL tests exercised admin/vendor/buyer permissions, all eight specification types, invalid-edit rollback and referenced definition protection. Workspace typecheck and lint passed 5/5. Remaining M5 release gates are open.
