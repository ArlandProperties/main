# Verification scope

## Local checks

- Production Vite build passes.
- 35 API tests pass using a temporary SQLite database.
- All 20 modules: create, read, edit, archive, restore, domain action, and persistence through authenticated requests.
- One-time and expired activation links, disabled pending accounts, owner setup, secret validation, session authentication, CSRF header/origin checks, viewer permissions, account disablement, administrator password reset, password rotation, logout, and duplicate account checks.
- Reference validation, linked-record archive guards, HTTPS-only document links, date validation, and optimistic concurrency.
- Lease conflict prevention and unit occupancy updates.
- Payment settlement, overpayment rejection, immutable posted records, derived paid status, and audited reversal with invoice recalculation.
- Record backup excludes password/session storage and records survive reopening the database.
- Dependency audit: no known production dependency vulnerabilities reported at implementation time.

## Browser checks

Desktop Chromium at 1440×1100 and mobile viewport at 390×844:

- First administrator setup screen, private one-time activation, prefilled owner email, fragment removal, and authenticated navigation.
- Loading the optional sample portfolio.
- All 20 module screens, empty search, status filter, sorting, CSV downloads, archived view.
- Task creation, details, domain action, editing, archive confirmation, and restore.
- Exactly 200 feature catalog entries.
- Calendar rendering and month selection.
- Mobile navigation and absence of horizontal page overflow.
- No uncaught browser JavaScript errors in the tested flows.

Run with `npm run test:browser` after `npx playwright install chromium`. To use an installed browser, set `BROWSER_PATH=/usr/bin/chromium`.

## CI and deployment checks

GitHub Actions runs the API suite against both SQLite and PostgreSQL 16, builds the application, and runs browser checks. The PostgreSQL 16 CI job passed for application commit `0f81cd5`. Render deployment and live HTTPS checks must be verified after its reviewed infrastructure plan is approved and applied.

The checks cover implemented behavior; they are not an independent security audit, accessibility certification, financial compliance review, or load test.
