# Dashboard CRUD aur manual testing

Use the [local UAT launcher](http://127.0.0.1:3021/__uat) in Incognito for realistic synthetic records. The launcher signs in with provisioned test accounts and opens the actual dashboard. Registration and login were already checked by the project owner. Keep one record title handy when switching accounts.

## Chrome results and saved test records

Representative flows were exercised across all nine panels. The following rows were entered through Chrome and read back from the isolated PostgreSQL schema together with their activity events.

| Record | Reference | Result |
| --- | --- | --- |
| 2 BHK with covered parking, Sector 20, Panchkula | `cmwng3a0u004jwelwc75qwshz` | Owner created and edited a draft with INR 82,50,000 and one photo. Admin published it with a review note. The Buyer saw the listing and price on the public directory. [Open the listing](http://127.0.0.1:3021/en/properties/cmwng3a0u004jwelwc75qwshz). |
| Callback enquiry for the same property | `cmwngasbn004twelwixy1tpnj` | Empty phone and consent showed inline errors. The Buyer submitted the corrected form. The Owner saw the same reference, saved Contacted and the Buyer saw the updated status. |
| Northline OPC 53 Cement, 50 kg bags | `cmwnge9er004zwelw7iq158bp` | Vendor draft. Chandigarh selected from the catalogue. Reopening after editing confirmed INR 410 per bag and a 25-bag minimum. |
| Courtyard Greens Phase 1, Aerocity, Mohali | `cmwngg4mr0055welw5dfp54yv` | Builder draft with INR 1,12,00,000 starting price. |
| Ground-floor retail unit, Sector 35, Chandigarh | `cmwngj70f005fwelw84tu532i` | Dealer inventory draft with Rent, Commercial and Shop selected. |

The Professional changed a synthetic enquiry to Qualified, the Skilled Worker switched an existing card to Busy, and the Job Seeker withdrew a previously shortlisted synthetic application. All three states were visible in the respective Chrome panels and confirmed in PostgreSQL.

Builder billing and Admin billing showed the same two existing refunded INR 295 test orders and invoice download links. The same invoice returned HTTP 200 with PDF content to both authorized roles. These records came from controlled Razorpay verification. Live checkout remains dependent on merchant Test Mode keys and webhook configuration.

## Panels kholne ka order

| Step | Panel and screen | What to create or update | What to compare next |
| --- | --- | --- | --- |
| 1 | Property Owner → Properties | Create a property draft. Edit title, description or asking price. Add required details and photos before submitting for review. | Confirm the same reference and previous draft history. |
| 2 | Admin → Review Queue | Open the owner's property and request a correction with a note, or publish after review. | Owner sees the same note and next status. A published record appears under Find a property. |
| 3 | Buyer → Property Inquiries and Buyer Alerts | Start an enquiry from the published property, save and pause a search, then check the owner's enquiry list. | Owner sees the same enquiry and can mark it Contacted. |
| 4 | Dealer → Dealer Profile and Properties | Review the agency profile, contact privacy and associated listing workflow. A dealer with a current profile edits or manages that profile. | Admin verification and public dealer page agree. |
| 5 | Builder → Builder Projects, Jobs and Ad Campaigns | Save project and job drafts, submit for review, and create a campaign against the builder's eligible project. | Public detail appears after publication. The approved campaign needs the related billing entitlement to activate. |
| 6 | Material Vendor → Material Products, Material RFQs and Material Quotes | Add a product with fixed category, unit and delivery city. Create and submit a quote against a matching open RFQ. | Buyer sees the quote and can accept it. |
| 7 | Professional → Professional Profile and Service Inquiries | Manage the existing profile and move a received enquiry to Contacted. | Requester sees that status on the same enquiry. |
| 8 | White-Collar Job Seeker → Job Applications | Apply on a published job with a synthetic résumé. Check the reference and applicant status. | Employer sees the application and can shortlist. |
| 9 | Skilled Worker → Worker Profile | Manage the existing trade card. Switch Available to Busy and restore after testing. | Compare the public record's availability. |
| 10 | Admin and Builder → Payments & invoices | Compare the same order, PDF invoice and status across both panels. | Use the UAT billing fixtures for history. An actual checkout requires the merchant's Razorpay Test Mode settings. |

## Core dashboard endpoints

The authenticated browser calls the same-origin `/api/v1` API. The two workspace write routes are shared by the 17 collections listed below. Replace `:collection` with the exact key and `:id` with that record's reference. Authentication, tenant, role, ownership and current workflow status are checked on the server.

| Method and path | What it does |
| --- | --- |
| `GET /api/v1/workspace` | Loads the authenticated role's collections, records and allowed next states. The dashboard uses this data to render create, edit, review and workflow controls. |
| `POST /api/v1/workspace/:collection` | Creates a record with `title`, optional `description`, collection-specific `data`, and an optional permitted initial `status`. Success returns HTTP 201 with the saved ID and status. |
| `PATCH /api/v1/workspace/:collection/:id` | Saves permitted content, a status change, or both. Accepts optional `title`, `description`, `data`, `status` and an admin-only `reviewNote` for a decision. A stale update or unavailable transition may return 409. |
| `GET /api/v1/workspace/:collection/:id/history` | Shows permitted record activity and decisions to the scoped workspace. |

The workspace has no generic hard-delete route. Collection-specific Archive, Cancel, Withdraw, Close or Pause actions are status updates through PATCH when the current role and record allow them.

| Collection key | Create and initial status | Main update behavior |
| --- | --- | --- |
| `properties` | Owner, Dealer or Builder. `DRAFT` or `PENDING_REVIEW`. | Edit drafts and corrections. Admin reviews and publishes. The owner can pause, close as sold/rented, or archive when the workflow permits. |
| `dealerProfiles` | Dealer. `DRAFT` or `PENDING_VERIFICATION`. | Update permitted details and contact visibility. Admin handles verification, correction and suspension. |
| `savedProperties` | Buyer. `ACTIVE`. | Archive or restore a bookmark. Property ID is fixed. |
| `buyerAlerts` | Buyer. `ACTIVE`. | Save criteria, pause, resume or archive using available states. Matching and delivery automation remain outstanding. |
| `propertyInquiries` | Buyer. `NEW`. | Assigned owner manages contact, visit and outcome. Buyer can archive a new request. Property/project linkage is fixed. |
| `materialProducts` | Vendor. `DRAFT` or `PENDING_REVIEW`. | Edit allowed catalogue details. Admin reviews publication. Vendor can manage available statuses, including out of stock. |
| `materialRfqs` | Buyer, Owner, Dealer, Builder or Professional. `DRAFT` or `OPEN`. | Requester opens a validated draft and manages the request. Quote submission and acceptance can update the RFQ automatically. |
| `materialQuotes` | Vendor. `DRAFT`. | Eligible vendor submits against a linked RFQ. Requester can view, shortlist, accept or reject using available statuses. Acceptance updates related records transactionally. |
| `serviceProfiles` | Professional. `DRAFT` or `PENDING_REVIEW`. | Update profile content when editable, handle review corrections, and manage public contact consent. |
| `serviceInquiries` | Buyer, Owner, Dealer, Builder, Vendor or White-Collar Job Seeker. `NEW`. | Linked professional records contact, qualification and outcome. Requester can close a new enquiry. |
| `jobs` | Dealer, Builder, Professional or White-Collar Job Seeker. `DRAFT` or `PENDING_REVIEW`. | Employer edits allowed fields and submits for review. Admin handles publication/suspension. Owner can pause an eligible job. |
| `jobApplications` | White-Collar Job Seeker. `SUBMITTED`. | Employer manages review and later hiring stages. Applicant can withdraw from eligible states. Linked job is fixed. |
| `workerProfiles` | Skilled Worker. `DRAFT` or `PENDING_REVIEW`. | Admin reviews the card. Worker updates Available/Busy when the card is public, or changes contact consent. |
| `builderProjects` | Builder. `DRAFT` or `PENDING_REVIEW`. | Edit draft/corrections, submit for review, and manage the project's allowed availability states after publication. |
| `adCampaigns` | Builder. `DRAFT`. | Builder submits the eligible owned project campaign for review. Admin approves/rejects and activation requires an active paid entitlement. |
| `loanInquiries` | Buyer, Owner, Dealer or Builder. `NEW`. | Admin logs internal follow-up and outcome. Applicant can close a new enquiry. Partner delivery remains outstanding. |
| `grievances` | Any member role. `OPEN`. | Admin acknowledges, investigates and resolves. Requester can respond or close through authorized workflow states. |

The full form field keys, statuses and relationships are in the [data-flow map](DATA_FLOW_MAP.md). [Workspace handler](../apps/api/src/workspace/router.ts) · [Schemas and permission rules](../apps/api/src/workspace/config.ts).

## Account, uploads, notifications and payment writes

| Method and path | What it does |
| --- | --- |
| `PATCH /api/v1/account/profile` | Saves allowed profile fields for the active account, including display name, about, location and owned logo. |
| `POST /api/v1/account/password` | Verifies the current password, saves the new hash and revokes the account's other sessions. |
| `POST /api/v1/uploads` | Accepts JPEG, PNG or WebP up to 8 MB. Uses `X-Upload-Purpose` for account/record-field scope and returns an image URL for the subsequent record save. |
| `POST /api/v1/uploads/resumes` | Uploads a private PDF, DOC or DOCX up to 10 MB for the authenticated job seeker. Returns a résumé URL for the application record. |
| `PATCH /api/v1/workspace/notifications/:id/read` | Marks the selected notification read for the signed-in account. It drops out of the unread dropdown and is still in history. |
| `POST /api/v1/checkouts` | Creates a priced Razorpay order for an eligible plan and target. Requires an `Idempotency-Key`. |
| `POST /api/v1/orders/:id/verify` | Verifies the checkout result against the Razorpay order and stores the captured payment, entitlement and invoice when confirmed. |
| `POST /api/v1/webhooks/razorpay` | Receives signed provider events and reconciles capture, failed payment or refund. This endpoint is called by Razorpay. |
| `GET /api/v1/catalog/plans`, `GET /api/v1/orders`, `GET /api/v1/orders/:id` | Loads available plans and scoped payment history for Payments & invoices. |
| `GET /api/v1/invoices`, `GET /api/v1/invoices/:id/download` | Lists invoices and downloads the scoped PDF. Members see their own invoices; admins see their tenant's records. |
