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

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). `render.yaml` defines a web service and private PostgreSQL database in Virginia. These use paid plans. Review the generated Render plan and current prices before applying. Creating a Blueprint plan does not deploy it.

## Access and data

- **Administrator**: all workflows, account management, settings, sample data, record backups, and payment reversals.
- **Manager**: read/export data and create/edit/archive records.
- **Viewer**: read data and export CSV. Server-side checks reject writes.
- Passwords use salted scrypt. Sessions use hashed random tokens in the database, HttpOnly/SameSite cookies, and eight-hour expiration. Production cookies require HTTPS.
- Mutations require a custom header and same-origin requests. Login/setup are rate limited. A setup token protects first-owner creation.
- Changes and audit entries are transactional. Record versions prevent stale overwrites. PostgreSQL advisory locking serializes mutations to preserve linked financial/occupancy rules.
- PostgreSQL persists data across web service restarts. SQLite files are for local use only.
- Sample records are opt-in, fictional, and available only in an empty workspace via Settings.

## Financial and operational boundaries

This release is a management ledger, not a payment processor or certified accounting system. Posting an external payment recalculates its invoice balance and rejects overpayment. Administrators can reverse posted payments with a recorded reason. Paid invoices and posted payment details are locked. Lease activation rejects conflicting active leases and updates unit occupancy.

Notices are prepared and delivery is recorded manually; no emails/SMS are sent. Documents are secure HTTPS links; uploads and virus scanning are not included. There is no public resident portal, e-signature provider, bank feed, payment gateway, tax filing, or automated screening. Accounts share a single company workspace. SSO, MFA, automatic password reset email, fine-grained property permissions, and multi-company tenancy are not included.

Calendar dates are stored as entered; appointment times use the configured company timezone. CSV values that can trigger spreadsheet formulas are prefixed to make exported text safe. JSON record exports exclude passwords/sessions but contain private business data and should be protected. They are not a database disaster-recovery system; configure provider backups separately.

## Verification

```sh
npm test
npm run build
```

The API suite exercises all 20 modules, authentication, roles, stale edits, financial rules, reference validation, persistence, and audit records. Browser checks cover the desktop/mobile UI and common record workflows. See [docs/VALIDATION.md](docs/VALIDATION.md) for the recorded verification scope.
