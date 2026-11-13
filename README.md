# Arcland Properties Inc

A full-stack property management workspace built with React, Vite, Node.js, and PostgreSQL. Local development uses SQLite; production refuses to start without PostgreSQL.

## What is included

20 modules cover properties, units, owners, residents, leases, applications, invoices, payments, expenses, budgets, work orders, vendors, inspections, assets, document links, notices, tasks, appointments, insurance, and key custody.

Each module has nine record capabilities (create, details, edit, archive, restore, search, status filtering, sorting, CSV export) and one domain action. These are the **200 documented module capabilities**, listed in [docs/FEATURES.md](docs/FEATURES.md). Shared dashboards, reports, calendar, roles, team management, audit history, and account security are additional features. This count describes module-level workflows, not 200 unrelated integrations.

## Run locally

Requires Node.js 22.13 or newer (24 recommended).

```sh
npm ci
npm run build
export SETUP_TOKEN="$(openssl rand -hex 32)"
npm start
```

Visit http://localhost:3000. Use the value of your `SETUP_TOKEN` to create the first administrator account. No credentials or sample data are preinstalled. The token is only useful until the first account exists. Record your credentials securely.

For development, run `npm start` for the API and `npm run dev` in a second terminal for the Vite UI. Vite proxies `/api` to port 3000.

## Render deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). `render.yaml` defines a web service and private PostgreSQL database in Virginia. This is a free evaluation preview: the database expires after 30 days and the web service can spin down when idle. Do not store live tenant records until durable hosting and backups are configured. Creating a Blueprint plan does not deploy it.

## Additional 300 module workflows

The app now adds 15 shared workflows independently to each of the 20 staff modules: configurable columns, table density, page size, field filters, creation-date range, numeric range, multi-selection, bulk archive, bulk restore, bulk status changes, duplication, named saved views, bookmarks, internal comments, and record history. This is **300 additional module-level capabilities**, not 300 unrelated products or integrations. See [docs/ADDITIONAL-FEATURES.md](docs/ADDITIONAL-FEATURES.md). The feature directory lists the original 200 plus these 300, for 500 total. Permissions and financial/relationship locks still apply.

Saved views and bookmarks are private per account and stored on the server. Bulk operations handle up to 100 records atomically and require confirmation. Internal comments are for company staff; they are not sent to residents or delivered as notifications.

## Public applications and rentals

`/apply` is the prospective-tenant Applications page, with no sign-in required. It collects contact details, household size, preferred move-in date, rental preference, and consent. The form creates a New application and returns a confirmation reference; it does not create a tenant account, reserve a unit, or run automatic eligibility decisions. Confirmation emails are not sent automatically. Public submissions are rate limited and validate a honeypot field.

Only units explicitly set to **Website listing: Public**, in Vacant status, under an active property are published. Existing units stay private unless an administrator or authorized agent publishes them. Published data excludes internal notes and ownership records. Applicants may submit a general application without choosing a unit; administrators assign general applications to units before agents can see them under their property scopes.

The homepage includes rental search and bedroom filters, application steps, FAQs, and the shared sign-in link. Branding uses navy, slate, white, and champagne gold; the logo matches the palette.

## Homepage and sign-in

`/` is the public company homepage. `/signin` is the one sign-in page for all roles. `/dashboard` renders the authenticated account’s administrator, agent, or tenant dashboard; users cannot select or override their role during sign-in. Activation links still use the private `/#activate=...` flow.

In **Admin dashboard → Team & access**, create an agent and assign properties, or create a tenant account linked to an existing resident record. Accounts are not created from public sign-up. Each resident can have one tenant account. An unassigned agent has no property access. Documents need an explicit Resident access selection and Reviewed status; notices must be Delivered before tenant visibility. Appointment sharing requires explicit Resident access.

## Access and data

- **Administrator**: all workflows, account management, settings, sample data, record backups, and payment reversals.
- **Agent**: an assigned-property dashboard, leasing and operational workflows scoped to assigned properties, and no company financial/account access.
- **Tenant**: a personal dashboard for leases, invoices, recorded payments, explicitly shared documents/notices/appointments, and their own maintenance requests. Tenant ownership and unit links are assigned server-side.
- **Manager (legacy)**: existing manager accounts retain their previous company-wide editing rights. Administrators should change them to Agent with explicit property assignments when appropriate.
- **Viewer**: read data and export CSV. Server-side checks reject writes.
- Passwords use salted scrypt. Sessions use hashed random tokens in the database, HttpOnly/SameSite cookies, and eight-hour expiration. Production cookies require HTTPS.
- An owner can also be prepared through the setup-secret-protected activation endpoint. Its one-time activation link expires after 24 hours, stores only a token hash, and lets the owner choose a password privately. Pending accounts cannot sign in.
- Mutations require a custom header and same-origin requests. Login/setup are rate limited. A setup token protects first-owner creation.
- Changes and audit entries are transactional. Record versions prevent stale overwrites. PostgreSQL advisory locking serializes mutations to preserve linked financial/occupancy rules.
- PostgreSQL persists data across web service restarts. SQLite files are for local use only.
- Sample records are opt-in, fictional, and available only in an empty workspace via Settings.

## Financial and operational boundaries

This release is a management ledger, not a payment processor or certified accounting system. Posting an external payment recalculates its invoice balance and rejects overpayment. Administrators can reverse posted payments with a recorded reason. Paid invoices and posted payment details are locked. Lease activation rejects conflicting active leases and updates unit occupancy.

Notices are prepared and delivery is recorded manually; no emails/SMS are sent. Documents are secure HTTPS links; uploads and virus scanning are not included. There is no public self-registration, e-signature provider, bank feed, payment gateway, tax filing, or automated screening. Accounts share a single company workspace. SSO, MFA, automatic password reset email, multi-company tenancy, and field-by-field permission configuration are not included.

Calendar dates are stored as entered; appointment times use the configured company timezone. CSV values that can trigger spreadsheet formulas are prefixed to make exported text safe. JSON record exports include internal comments and exclude passwords/sessions but contain private business data and should be protected. They are not a database disaster-recovery system; configure provider backups separately.

## Verification

```sh
npm test
npm run build
```

The API suite exercises all 20 modules, authentication, roles, stale edits, financial rules, reference validation, persistence, and audit records. Browser checks cover the desktop/mobile UI and common record workflows. See [docs/VALIDATION.md](docs/VALIDATION.md) for the recorded verification scope.
