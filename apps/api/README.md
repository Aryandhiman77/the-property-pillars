# ThePropertyPillar API

Express, TypeScript and Prisma with PostgreSQL database `the-property-pillar`.
Follow the [local setup](../../README.md) from the repository root.

## Authentication

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Create a pending member account and email a verification code |
| POST | `/api/v1/auth/verify-email` | Verify the one-time code and activate the member account |
| POST | `/api/v1/auth/resend-verification` | Send a new code for a pending member account |
| POST | `/api/v1/auth/sign-in` | Validate email and password, then issue a JWT cookie |
| POST | `/api/v1/auth/password/reset/request` | Send a recovery code to an eligible, verified email |
| POST | `/api/v1/auth/password/reset/complete` | Consume the code, replace the password and revoke active sessions |
| GET | `/api/v1/auth/session` | Return the authenticated account's name and role |
| POST | `/api/v1/auth/logout` | Revoke the session and clear the cookie |

The JWT is sent in an HttpOnly, SameSite cookie. Production requires HTTPS
for the Secure cookie. The API verifies signature, expiry, issuer and audience,
then checks the session, active account, role and tenant in PostgreSQL.
Send `rememberMe: false` on email sign-in to issue a browser-session cookie.
Password recovery uses the same SMTP setup as registration. The code expires
after 15 minutes and can be used once.
Set `JWT_SECRET` to a unique random value for each environment and set
`CORS_ORIGINS` to the actual frontend origins. `SESSION_TTL_DAYS` controls the
session lifetime. Configure these settings in `apps/api/.env` or the host's
environment.

To generate a signing secret, run this in a private terminal and save it in
the deployment's secret store or the ignored local `.env` file.

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Self-registration requires email verification. A mobile number is optional.
When supplied with an ISO country code, the number is stored in international
E.164 format when the email is verified.
Codes expire after 15 minutes and may be resent once per minute. To deliver
verification mail, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` and `SMTP_PASSWORD`
in the root `.env`, `apps/api/.env` or the deployment's environment. `SMTP_FROM` defaults to
`SMTP_USER`. For an unauthenticated local SMTP mailbox, set `SMTP_HOST`,
`SMTP_PORT` and `SMTP_FROM`. Apply the Prisma migration before deploying.

## Account profile

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/account/profile` | Read the signed-in user's account details |
| PATCH | `/api/v1/account/profile` | Save full name, bio, location, or an uploaded logo |
| POST | `/api/v1/account/password` | Verify the current password and set a new password |

Upload the logo through `/api/v1/uploads` and save the returned URL as `logoUrl`.
Changing a password requires `currentPassword`, `newPassword`, and
`confirmNewPassword`. It revokes the account's other sessions and keeps the
session used to make the change active.

## Administrator setup

Run `pnpm --filter @the-property-pillar/api admin:create` with
`ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD` supplied through the process
environment or API environment file. For production, set
`ALLOW_ADMIN_BOOTSTRAP=true` for this command only. Re-running it for an
existing administrator rotates the password and revokes that account's
active sessions.

Local handover accounts can be created with
`pnpm --filter @the-property-pillar/api accounts:create-local`. This command
writes credentials to the ignored `tmp/panel-credentials.json` file and is
limited to the local project database.

Liveness is at `GET /api/v1/health` and database readiness is at
`GET /api/v1/health/ready`.

## Indian PIN code lookup

`GET /api/v1/locations/pincode/{pincode}` returns a suggested state, city and
area with the GST state code and matching post-office areas.
[Postal PIN Code API](https://api.postalpincode.in/pincode/110001)

India property and job listings require a six-digit PIN. The listing form fills
State, City and Area after a successful lookup. For other countries, the form
accepts a city, region and area manually, with an optional postal or ZIP code.
Public property, job and dealer results accept a `country` filter with an ISO
country code. Listings without a saved country are treated as Indian records.

Property creation accepts `status: "PENDING_REVIEW"` to submit a complete
listing for review in the same request. A request without that status saves a
draft. The property gallery accepts up to 40 photos and videos combined in
`data.mediaUrls`. Upload both using `/api/v1/uploads` with purpose
`properties:mediaUrls`. An administrator reviews the listing before it appears
in public results. A listing owner can reorder existing media while the listing
is published. The property remains published during that update.

The web forms upload selected media when saving records. Uploads tagged with
`X-Staged-Upload: 1` expire for new attachments after 24 hours. The API checks
references before removing unclaimed staged files after 48 hours.

## Google sign-in

Apply the Prisma migrations and regenerate the client. Create an OAuth client
of type **Web application** in Google Cloud and register the exact callback on
the public website origin, such as
`http://localhost:3000/api/v1/auth/google/callback` in development.
Use the public HTTPS website origin in production. Set the web client's
`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` and
`GOOGLE_OAUTH_REDIRECT_URI` in the API environment. The website sends requests
to the API through the existing same-origin proxy. Add authorized test users
in Google Cloud if the consent screen is in testing mode.

First-time Google users confirm their prefilled name and Google email, add
a mobile number if needed, and choose a member role. To fill a number from
Google when the account shares one, enable the People API and approve
`https://www.googleapis.com/auth/user.phonenumbers.read`, then set
`GOOGLE_OAUTH_READ_PHONE=true`. Numbers collected during Google onboarding
remain pending until the member verifies them in their profile. Verified
existing member accounts can sign in with a matching Gmail or Google Workspace address.
Administrator accounts and other email addresses use the email sign-in flow.
After verification the API issues the application's normal session cookie.
Keep the OAuth secret in the API environment. [Google OpenID Connect setup](https://developers.google.com/identity/openid-connect/openid-connect).

Mobile sign-in starts with an SMS code. Members with an incomplete sign-up
finish their account details and verify their email before receiving a session.
Configure SMS delivery using the existing Twilio messaging settings and email
delivery using the registration SMTP settings above.

## Razorpay billing

Apply the billing migration with `pnpm --filter @the-property-pillar/api exec prisma migrate deploy`
and regenerate the Prisma client. Set the two Razorpay API credentials in the
root `.env` or the API host's secret configuration. Restart the API after
changing either the keys or the billing settings file.

| Setting | Value |
| --- | --- |
| `RAZORPAY_KEY_ID` | Key ID for the merchant's test or live account |
| `RAZORPAY_KEY_SECRET` | Matching API key secret |

Use `apps/api/data/billing.local.json` for the business settings. Copy
[`billing.example.json`](data/billing.example.json) if the local file is missing.
Checkout opens when there is a valid supplier profile and at least one active plan.
The blank example keeps checkout closed until the merchant supplies approved data.

| Field | Contents |
| --- | --- |
| `supplier` | GST invoice issuer. Fill `legalName`, `gstin`, `addressLine1`, `city`, two-digit `stateCode`, six-digit `postalCode`, and `billingEmail`. Optionally add `addressLine2` and `billingMobile`. |
| `plans` | Entries use `priceId`, `name`, `description`, `basePaise` (price in paise before GST), `taxRateBps` (GST as basis points), `serviceCode` (SAC), `currency` (`INR`), `entitlementDays` and `active` (boolean). |

The billing file belongs on the API host. Deployments that mount it elsewhere
can set `BILLING_CONFIG_FILE` to its absolute path.

The supported price IDs are `DEALER_PRO_30D`, `BUILDER_AD_PACKAGE_30D`,
`FEATURED_JOB_BOOST_30D` and `LISTING_FEATURE`. The dealer needs a verified profile. Ad packages and
job boosts apply to a specified campaign or published job owned by the account.
Each charge purchases a fixed term. The captured order, invoice and entitlement
record the commercial terms at checkout.

Add an active `LISTING_FEATURE` plan with the approved price, tax, SAC and term to enable **Pay for featuring** on submitted properties, material products, jobs and directory profiles. Each listing has one payable Razorpay order at a time. The term starts at payment confirmation and the listing appears in featured results while it is public. A fully refunded payment ends the placement. The listing owner and the workspace admin can download the captured payment invoice from the listing or Payments & invoices.

Enable automatic capture in the Razorpay Dashboard. The API verifies the
signed Checkout return and fetches the payment before issuing a GST invoice.
If the return is missed or a refund is processed separately, open the order
under **Payments & invoices** and select **Refresh**. The API checks Razorpay
using the same two keys. Use a separate database or schema for Razorpay Test
Mode to keep test and live invoice series separate.
[Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/)

For optional updates while the customer is offline, configure
`RAZORPAY_WEBHOOK_SECRET` on the API host and register
`POST /api/v1/webhooks/razorpay` for `payment.captured`, `payment.failed`
and `refund.processed`.
[Webhook validation](https://razorpay.com/docs/webhooks/validate-test/)

Capture must match the stored order, INR currency and total paise before the
API issues an invoice. The invoice records the supplier, customer, serial
number, place of supply, service code and tax components. For go-live,
validate the merchant's GST rate, SAC, invoice wording, and any e-invoicing
or credit-note obligations with its tax adviser.
[CBIC invoice rules](https://cbic-gst.gov.in/gst-invoice-rules.html)

For local smoke verification, apply migrations to the `delivery_verification`
schema, provision its nine panel accounts and build the API. Run
`pnpm --filter @the-property-pillar/api smoke:billing` from the repo root.
Append `--keys-only` after the credential and result file arguments to exercise
checkout and order refresh with the webhook disabled. The harness uses the
local verification schema and intercepts Razorpay calls.

## Marketplace media and map leads

`MEDIA_IMAGE_MAX_MB` and `MEDIA_VIDEO_MAX_MB` set the saved file limits in
MiB (8 and 100 by default). `MEDIA_IMAGE_INPUT_MAX_MB` and
`MEDIA_VIDEO_INPUT_MAX_MB` set the larger limits for originals (32 and 250
by default). The upload service streams to a temporary file and stores only
the compressed WebP or MP4 in `UPLOAD_ROOT`. Keep that directory persistent
and backed up separately from build output.

Install FFmpeg and FFprobe before enabling video upload in production. Both
can be discovered on PATH, or set `FFMPEG_PATH` and `FFPROBE_PATH` to their
executable paths. The Nginx template gives only the upload route a larger
streamed request limit and longer processing timeout.

Set a stable, dedicated `MAP_LEAD_DATA_KEY` of at least 32 characters before
accepting production map leads. Keep it with the database backup secrets so
the saved lead contacts can be recovered. Development uses a key derived
from the JWT secret if a dedicated key is absent.

Admin carousel slides and seller map leads use separate workspace APIs. Public
property search uses `GET /api/v1/public/properties/search` for 20-item pages.
The existing public property list continues to support homepage cards and
property details.
