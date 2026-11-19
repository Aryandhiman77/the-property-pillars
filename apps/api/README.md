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
| GET | `/api/v1/auth/session` | Return the authenticated account's name and role |
| POST | `/api/v1/auth/logout` | Revoke the session and clear the cookie |

The JWT is sent in an HttpOnly, SameSite cookie. Production requires HTTPS
for the Secure cookie. The API verifies signature, expiry, issuer and audience,
then checks the session, active account, role and tenant in PostgreSQL.
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
draft. Property listings support up to 15 photos, including images uploaded
through `/api/v1/uploads`. An administrator reviews the listing before it
appears in public results.

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

First-time Google users choose a member role. Verified existing member
accounts can sign in with a matching Gmail or Google Workspace address.
Administrator accounts and other email addresses use the email sign-in flow.
After verification the API issues the application's normal session cookie.
Keep the OAuth secret in the API environment. [Google OpenID Connect setup](https://developers.google.com/identity/openid-connect/openid-connect).

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

The supported price IDs are `DEALER_PRO_30D`, `BUILDER_AD_PACKAGE_30D` and
`FEATURED_JOB_BOOST_30D`. The dealer needs a verified profile. Ad packages and
job boosts apply to a specified campaign or published job owned by the account.
Each charge purchases a fixed term. The captured order, invoice and entitlement
record the commercial terms at checkout.

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
