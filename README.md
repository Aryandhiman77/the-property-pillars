# ThePropertyPillar.com

Local application for the property, construction materials, finance,
professional services and workforce marketplace.

## Source of truth

Implementation decisions must follow, in this order:

1. `ThePropertyPillar_Master_Blueprint_v2_Updated (1) (1).md`
2. `PROJECT_EXPLANATION_HINGLISH.txt`
3. `UI_UX_PRODUCT_SPECIFICATION.md`, which expands the two source documents
   into forms, API contracts, statuses and panel behaviour.

## Architecture

- `apps/web` uses Next.js 15, TypeScript, Tailwind, next-intl and Lucide. Routes live in `src/app` and features in `src/features`. Layout components and UI primitives are under `src/components`. The browser uses the Next.js `/api/v1` proxy so sessions stay on the same origin.
- `apps/api` uses Express 5, TypeScript, Zod and Prisma. Shared API infrastructure lives in `src/routes`, `controllers`, `services`, `schemas`, `middleware`, `helpers` and `utils`. Workspace policy, validation and transitions live in `src/workspace`.
- `packages/contracts` — shared roles, units, statuses and API types.
- `packages/config` — shared product and TypeScript configuration.
- PostgreSQL database name: `the-property-pillar`.

## Local setup

Use Node.js 22.13 or later, pnpm 11, and PostgreSQL. On this Windows machine the
installed PostgreSQL binaries can start a project-local cluster on port 55432.
Set `TPP_POSTGRES_BIN` if your PostgreSQL binaries are in a different directory.

```powershell
pnpm install
pnpm db:local
pnpm --filter @the-property-pillar/api exec prisma migrate deploy
pnpm --filter @the-property-pillar/api prisma:generate
pnpm dev
```

Use the root `.env` for API, database, website, Google OAuth, Razorpay and
SMTP settings. Copy `.env.example` if the root file is missing. The PostgreSQL
helper initializes data under `tmp/local-postgres` and creates `apps/api/.env`
if absent. Keep the root `DATABASE_URL` and `JWT_SECRET` blank to use those
generated local values. For Docker or an existing PostgreSQL server, set
`DATABASE_URL` for database `the-property-pillar` and a unique `JWT_SECRET`
of at least 32 characters. The included Docker database uses port 5432.
Stop the native cluster with `pnpm db:local:stop`.

- [Homepage](http://localhost:3000/en)
- [Role workspaces](http://localhost:3000/en/dashboard)
- [API liveness](http://127.0.0.1:4000/api/v1/health)
- [PostgreSQL readiness](http://127.0.0.1:4000/api/v1/health/ready)

Sign in with an email and password. Each account opens its assigned role
workspace. To provision one real account per role in the local PostgreSQL
database, run:

```powershell
pnpm --filter @the-property-pillar/api accounts:create-local
```

The command saves the credentials to `tmp/panel-credentials.json`, which is
excluded from version control. It verifies existing accounts on repeat runs
and preserves their passwords. Public registration supports eight member
roles. Provision production administrators separately with the API's
`admin:create` command.

## Current features

The nine panels include listing review and publishing, saved properties and
inquiries, dealer profiles, material RFQs and quotes, professional profiles
and requests, job posting and applications, worker availability, builder
projects and campaign records, loan inquiries and grievances. Public search
reads published records and the loan page calculates estimated EMI.

Visitors can start marketplace tasks directly on the public site, including
[listing a property](http://localhost:3000/en/post-property),
[requesting material quotes](http://localhost:3000/en/materials/request-quote)
and [posting a job](http://localhost:3000/en/jobs/post). The [sign-in page](http://localhost:3000/en/login)
returns visitors to the same public form. Entered details are restored in the same browser tab.
The dashboard handles saved requests, reviews, status changes
and billing. See the [data-flow map](docs/DATA_FLOW_MAP.md) and
[verification report](docs/CURRENT_VERIFICATION.md) for the complete route list
and test results.

Google sign-in uses the same account and dashboard permissions as email sign-in.
See [Google sign-in setup](apps/api/README.md#google-sign-in) for the OAuth
credentials and the callback URI.

Plans & billing is available from each workspace. Admins manage role-specific property posting, featured property and featured profile plans there. The first two property submissions are free. Further submissions spend one unexpired credit, and a buyer becomes a dealer on the third submission. Saving drafts and updating a submitted property do not consume credits. Razorpay also handles INR checkout for legacy Dealer Pro, builder ad packages and featured jobs.
Captured payments issue downloadable GST invoice PDFs. Members see their
own payments and administrators see the records within their tenant.
Set the two Razorpay keys in the root `.env` and configure the GST issuer in `apps/api/data/billing.local.json`. Run `pnpm --filter @the-property-pillar/api plans:seed-local` to install sample plans in a local marketplace. In manual UAT, `node scripts/manual-uat.cjs --seed-plans` installs the same examples in its isolated database.
[Razorpay setup](apps/api/README.md#razorpay-billing)

The broader blueprint also covers external OTP and message delivery, private
document storage, map providers and launch compliance. Those integrations have separate
configuration and implementation requirements.

Property and project photos, product images and dealer logos are uploaded as
WebP files with ownership and purpose metadata. `UPLOAD_ROOT` can override the
default root `uploads/` directory. Keep the files and metadata together on
persistent storage. The site asks the browser for location once
per session, resolves the area using BigDataCloud, and prioritizes public
results by area, city and state. Job addresses are resolved separately by PIN.

The material catalogue, RFQs and quotes share category and unit codes. Delivery
city options come from the bundled [GeoNames catalogue](apps/api/data/README.md).
Vendors see open requests that match the delivery city and category of an available
published product. On an existing database, run `pnpm --filter @the-property-pillar/api materials:backfill`
to normalize known legacy values. Records with ambiguous cities can be updated in
their dashboard by selecting the correct city.

The [Lovable redesign prompt](LOVABLE_UI_PROMPT.txt) describes the public site,
all nine role workspaces, and the checkout and invoice screens.

## Production staging

See the [blueprint launch audit](docs/BLUEPRINT_LAUNCH_AUDIT.md) for verified
flows, launch blockers, and merchant/operator settings. The included
[Nginx site configuration](deploy/nginx/tpp.itsoftexpert.net.conf) forwards
web traffic to the PM2 Next server on 3000 and `/api/v1/` to Express on 4000.
For that topology, set `TRUST_PROXY=true` in production, set `CORS_ORIGINS`
and `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS origin, and retain uploads
in a persistent absolute `UPLOAD_ROOT`. Verify `/api/v1/health/ready`,
sign-in, an upload and one protected form through the HTTPS origin before
opening public traffic.

Property **Places nearby** uses the bundled GeoNames catalog and either the
listing's approximate map area or its city centre. To use an OpenStreetMap
Overpass provider, set `NEARBY_PLACES_OVERPASS_URL` in the API environment.
The GeoNames catalog supplies results when that provider is unavailable.

For Articles, run the Prisma migrations and set `GOOGLE_TRANSLATION_API_KEY`
to a server-side key restricted to the Cloud Translation API. Admins publish
the English source under **Dashboard → Website → Articles**. Translations use
the public language menu and are cached by article revision.

For live mobile verification, set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
and `TWILIO_MESSAGING_SERVICE_SID`. Configure the service sender and complete
any destination-country registration, including India DLT requirements for
domestic SMS. Local development on loopback displays the generated code in
the verification dialog. Test the live sender and the existing SMTP enquiry
outbox before launch.

## Validation

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The smoke test creates and moderates records. Run it against a separate
verification schema with its own account file to keep the handover workspace
clean. If you use a different port, include the smoke test origin in
`CORS_ORIGINS`. See [API setup](apps/api/README.md).

```powershell
$env:SMOKE_ALLOW_MUTATIONS = 'true'
pnpm smoke:local http://127.0.0.1:4001 tmp/panel-credentials.verify.json
```

The free [shadcn/ui dashboard-01](https://ui.shadcn.com/blocks) starter was
downloaded and adapted for the workspace UI. Its [MIT license](apps/web/SHADCN_LICENSE.md)
is included. Icons use [Lucide React](https://lucide.dev/guide/react).
The homepage photograph is by [Kayven on Unsplash](https://unsplash.com/photos/modern-white-building-with-tropical-plants-euISNpRMVT4).
