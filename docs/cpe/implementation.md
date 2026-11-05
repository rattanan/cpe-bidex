# CPE Project Bid Excellence — implementation and acceptance

Status: active application baseline, approved by the owner in chat on 2026-11-05.
Sources: `requirements/SRS.pdf` (2026-11-04) and `requirements/cpe-project-bid-excellence.html`.
The owner explicitly chose: use the CPE SRS as the new baseline; retain NTOP functionality/data and hide unused menus.

## Scope and reuse

CPE is the default landing workspace at `/cpe`, with twelve screens under `/cpe/[screen]`.
NTOP routes, business records, `/api/v1` contracts and historical migrations are retained.
The active sidebar, command palette and quick-create surface CPE plus the existing user, organization and audit administration pages.
The existing read-only CPE AI Assistant is available throughout the authenticated portal, including all twelve CPE workspaces and the company page. It uses visible page text and current CPE Help Center guides; business authorization, provider configuration and read-only limits remain unchanged. Legacy automatic field-assistance behavior stays on legacy routes and does not decorate CPE forms. The launcher remains available in short landscape viewports; only its open-panel duplicate is hidden there, with the panel close button retained.

Record details now open consistently in a centered native dialog, including Estimate/BOQ, Cost Check, Bid Simulation and Knowledge archive entries that formerly rendered below the list. The URL `id` identifies the record and `create=1` is the sole create-dialog state, so same-page quick-create, direct links and browser back/forward work consistently. Search, sort, organization and numbered-page parameters are preserved when opening/closing. Stage labels such as “ทำสัญญา” are displayed as record information; a separate “เปิดรายละเอียด” action clearly opens the dialog. Cash register names are plain text, retaining the existing explicit settlement action.

Dialogs have a dimmed backdrop, descriptive record heading, internal scrolling, visible header/footer close buttons, heading focus on open and main-content focus on close. Closed historical estimates explicitly explain their read-only BOQ behavior. Loading feedback is shown while record navigation is pending. E2E covers repeated opening, same-page quick-create, direct links, history navigation, desktop/mobile bounds and the full local BOQ → review → bid → won/project workflow. No business transitions, permissions or schema change.

Reuse: authentication/session/login controls; users and effective role assignments; organization hierarchy; database-backed permission grants; append-only hash-chained audit; Next/React/Prisma/Vitest/Playwright; `PageNumberNavigation`, `SortableTableHeader`, table and shell primitives.
Construction aggregates own their new `Cpe*` tables. They do not rewrite telecom Opportunity, Solution Design, BOQ, Quote or Contract records. The old telecom BOQ contains recurring service charges and cannot safely be relabelled as a construction estimate.

## Screen and requirement trace

| Route | Requirement | Delivered behavior |
|---|---|---|
| `/cpe/exec` | FR-01–02 | Five KPIs, actual/forecast cash SVG chart, sector/work-type distribution, project health, loss reasons, material price risks, outstanding cost reviews |
| `/cpe/sales` | FR-03–07 | Five-stage totals, server filters/search/sort, new OPP, technical/contract notes, BOQ breakdown, audit history, won/lost recording; won creates PRJ, monthly S-Curve and optional category RFQs in one transaction |
| `/cpe/estimate` | FR-08–10 | Standard work categories; copy from historical BOQ with optional same-unit proportional quantity scaling; material/labor/quantity editing, catalog item selection, new categories, removal, immediate Decimal calculation; missing categories and price review signals |
| `/cpe/costcheck` | FR-11–12 | Same-type/same-unit closed-project actual category references, configured tolerance, proportional adjustment, reviewer/time and handoff |
| `/cpe/bidsim` | FR-13–14 | Margin slider, minimum/best/target/current shortcuts, price/profit/probability/expected profit, SVG curves/scatter, historical comparison, server-side minimum margin and cost-review gate |
| `/cpe/catalog` | FR-15–16 | Bounded search/category/volatility list, create and update price with provenance; six-month price history, 90-day forecast, named-vendor price range, affected BOQ entries |
| `/cpe/forecast` | FR-17 | Material forecast, current/forecast price, buy/wait indication, impact on margin for linked BOQ entries |
| `/cpe/procurement` | FR-18–20 | RFQ budgets, five document flags, quote count/lowest/difference, vendor quote entry, duplicate/suspended-vendor rejection, validity/score warnings, PO award and derived project commitments |
| `/cpe/vendors` | FR-21 | Search/type/grade filters, vendor registry, five weighted scores, configured grade, suspension, awarded work history |
| `/cpe/projects` | FR-22–23 | Contract/budget, actual and outstanding PO commitments, backlog and delays, S-Curve, cumulative costs/cash, awarded vendors, risks, PM monthly updates and immutable closed reference costs |
| `/cpe/cash` | FR-24 | Opening/current/forecast low cash, credit line, receivable/payable aging, due-date registry/settlement and funding needed per project |
| `/cpe/knowledge` | FR-25–27 | Win/loss analysis, archive server filters, estimated/actual costs, proposed master changes, maker/checker approval/rejection, seven master groups plus financial/purchasing/model settings |
| Shared workspace | FR-28, NFR-01–07 | Permission-restricted role perspective, nine linked process stations, toast, accessible native dialog with Escape/backdrop closing, Thai UI, explicit Bangkok display time, responsive layouts, horizontal mobile navigation, SVG-only graphs, reduced motion |

## Data and calculation contract

- `CpeOpportunity` is the construction anchor; its organization, sales owner and estimator are explicit.
- `CpeBoqItem` separates per-unit material/labor costs. Estimate = sum(quantity × (material + labor)) × (1 + configured overhead + risk).
- Bid = cost / (1 − gross margin / 100). Monetary storage/calculation uses Prisma Decimal and DECIMAL(19,4); numeric conversion is for display/graph coordinates only.
- Win model follows the prototype logistic form: midpoint of average won/lost margin by work type plus sector adjustment; configurable cap 85%, slope 2.2 and default midpoint 15. With no actual outcomes, probability remains unavailable. Model aggregates use all authorized real outcomes; historical display is separately bounded.
- Weighted pipeline excludes opportunities without a model and displays the modeled count. No sample history or demo financial values are inserted.
- Master values start from the prototype's reference policies. Company opening cash and credit limit start at zero until configured. Reference defaults are configuration, not demo transactions.
- RFQ generation is unique per opportunity/category. Category RFQ budgets are allocated proportionally from the approved opportunity cost and sum to the approved budget after rounding. Vendor quote uniqueness is enforced in the database per RFQ/vendor. Award is immutable and requires a complete five-document checklist, an active vendor, a valid quote and a project.
- Project S-Curve uses the prototype cubic progression, with at most 120 months. Monthly actual progress cannot decrease. PO payments are allocated by RFQ; monthly allocations cannot exceed actual cash out or the PO amount cumulatively.
- Outstanding commitment = awarded PO total − allocated PO payments. Actual expense plus outstanding commitments does not double count paid PO values.
- Closing requires 100% final-month progress and actual category amounts summing exactly to positive actual cash out. Closed projects reject subsequent writes and become cost references.
- Receivable/payable settlement updates the due-date register. Actual cash is recorded in project months; settlement does not book duplicate cash. Forecast inputs represent additional expected cash, not a second copy of actual cash.
- Dates are validated as calendar dates; date-only values use explicit UTC storage. Display uses Asia/Bangkok; SQL business-day comparisons explicitly apply Bangkok's +07:00 offset.

## Authorization and integrity

New role codes: `ESTIMATOR`, `PROCUREMENT`, `PROJECT_MANAGER`.
Existing `PRESALES` maps to estimator grants; `KAM`, `SALES_DIRECTOR`, `TEAM_MANAGER` receive sales capability defaults. `EXECUTIVE` receives the SRS executive view and improvement-decision grants. `ADMIN`/`SYSTEM_ADMIN` receive CPE administration capabilities without bypassing organization scope.

The forward migration and normal development seed provision explicit `RolePermissionGrant` entries from the same policy catalog. Administrators assign actual roles and active organization units through the retained administration UI. No session role switch or demo perspective creates permissions.

The server resolves grants per organization, expands active descendant organization IDs and applies SELF/ASSIGNED_TASK ownership/assignment predicates to construction queries. An administrator capability from one organization does not authorize another organization. Sales writes check owner (or an explicit manage-all grant), technical writes check estimator and project writes check assigned PM. Foreign selected IDs return 404; denied capability returns 403.

Mutations validate Zod input, calendar dates, positive quantities/prices and score bounds. All business writes, required audit and idempotency receipt share a serializable transaction. Request IDs replay the existing result; reuse with different input is rejected. Expected versions prevent lost updates; stale and duplicate conflicts map to HTTP 409. Master proposals are versioned, and a proposer cannot approve their own proposal.

List pages reuse semantic tables, allowlisted server sorts, bounded query/search, reset and fixed 20-row numbered pagination. Related projections are bounded: BOQ 300 items; project 120 months; option selectors and historical/reference projections 100 entries; audit timeline 30 events; improvement list 50 entries; monthly company chart 24 months. Large datasets need a later indexed selector/keyset-anchor enhancement; no full business dataset is downloaded for client filtering.

## Setup, migration and rollback

1. Back up the target database and follow the normal release review process. No production migration is run by this change.
2. Regenerate Prisma Client: `npm run db:generate`.
3. Apply `prisma/migrations/20261105180000_add_cpe_bid_excellence/migration.sql` through the existing deployment migration process. It creates new CPE tables and grants; it does not modify or delete existing NTOP business records.
4. Assign CPE roles with appropriate active organization units. For departmental shared work use ORG_UNIT or a reviewed broader scope. SELF/ASSIGNED_TASK scopes restrict records to owner/estimator/PM responsibilities. A legacy ADMIN with no assigned organization cannot create business data until an organization is assigned.
5. Configure company opening cash/credit and review Data Master policies before entering operational data. Add real costs and vendors; the workspace starts with honest empty states.
6. Roll back the application release to return to the old navigation; retain CPE tables and audit evidence. Do not drop CPE tables once data has been entered. No destructive rollback or production seed is included.

## Verification

- `tests/unit/cpe/cpe-domain.test.ts`: Decimal totals, gross margin, copy-unit validation, configurable scores/tolerances, probability behavior, S-Curve, invalid input, permission/navigation and bounded list filters.
- `tests/integration/cpe-real-db.test.ts`: opt-in local test database only; real transactions through OPP → BOQ → review → won → RFQ → PO → monthly actuals → close, replay, duplicate, stale, cross-organization/permission failures and audit receipt consistency; query all twelve screens.
- `tests/e2e/cpe.spec.ts`: opt-in isolated local test database only; real login, all twelve screens, form/BOQ/review/bid/won/project flow, Escape and responsive drawer, no browser runtime errors.

Commands for the added suites:

```sh
npm test
RUN_CPE_DB_INTEGRATION=1 npx vitest run tests/integration/cpe-real-db.test.ts --no-file-parallelism
CPE_E2E=1 npx playwright test tests/e2e/cpe.spec.ts --workers=1
```

Both opt-in suites reject a non-local database or a database name outside the explicit `cpe_*test*` convention. The run used a separate temporary MariaDB 12.3 server under `/tmp`, port 33316, and disposable `cpe_bidex_test_20261105` / `cpe_bidex_test_final20261105` databases. This verifies MySQL-compatible execution, not MySQL 8 InnoDB Cluster production readiness.

## Operational limits

- Google Fonts are not required for operation; Thai system font fallbacks keep the app usable offline. SVG charts require no chart service.
- Prices, forecasts, source references and documentary readiness are entered by humans. No market-price feed, document upload/scanning, accounting integration, vendor payment execution, email, AI-driven prediction or automated external procurement is implied.
- The win curve is the prototype's transparent heuristic, not a statistically calibrated prediction service. Review its policy and sample sufficiency before commercial use.
- Reporting and related-history views disclose their row/time limits. Options beyond the first 100 require narrowing or a future searchable selector; the core main lists retain server pagination.
- A company chart displays the latest 24 project calendar months. Long-horizon treasury planning needs a separate time-range query before using this for larger portfolios.

## Change inventory

- Routes and entry points: `app/(portal)/cpe/page.tsx`, `app/(portal)/cpe/[screen]/page.tsx`, `app/api/cpe/commands/route.ts`, `app/page.tsx`, `app/layout.tsx`, `app/login/page.tsx`, `app/actions.ts`.
- CPE domain: `lib/cpe/config.ts`, `lib/cpe/access.ts`, `lib/cpe/commands.ts`, `lib/cpe/calculations.ts`, `lib/cpe/service.ts`, `lib/cpe/query.ts`.
- CPE UI: `components/cpe/workspace.tsx`, `components/cpe/forms.tsx`, `components/cpe/charts.tsx`, `components/cpe/navigation.ts`, `components/cpe/cpe.css`.
- Retained shared UI: `components/app-shell.tsx`, `components/enterprise-command-palette.tsx`, `components/form-field-assistance.tsx`, `components/expandable-text-assistance.tsx`, `components/province-input-assistance.tsx`, `components/page-number-navigation.tsx` (optional Thai labels; old defaults preserved).
- Database and policy: `prisma/schema.prisma`, `prisma/migrations/20261105180000_add_cpe_bid_excellence/migration.sql`, `prisma/seed.ts`, `lib/authorization/enterprise-role-policy.ts`.
- Tests: `tests/unit/cpe/cpe-domain.test.ts`, `tests/integration/cpe-real-db.test.ts`, `tests/e2e/cpe.spec.ts`; adapted legacy branding/navigation expectations in `tests/unit/login-page-branding.test.ts`, `tests/unit/app-shell-help-contract.test.ts`, `tests/unit/page-number-navigation.test.ts`.
- Documentation: `README.md`, `docs/product-requirements.md`, `docs/system-architecture.md`, `docs/testing-strategy.md`, this implementation guide. Supplied `requirements/` files are untouched.

## Final validation evidence — 2026-11-05

- `npm run lint`: passed, zero errors; seven pre-existing warnings in the retained prospect module.
- `npm run typecheck`: passed.
- `npm test`: 176 files / 804 tests passed; seven files / 29 tests skipped by their opt-in requirements.
- `npm run build`: passed, including production compilation, TypeScript and route generation. The sandboxed Turbopack retry stalled at compilation; the completed run used the permitted build process without deploying.
- `RUN_CPE_DB_INTEGRATION=1 npx vitest run tests/integration/cpe-real-db.test.ts --no-file-parallelism`: nine passed against fresh `cpe_bidex_test_final20261105`, bootstrapped with the retained schema plus the final forward migration. Includes approval by a second actor, master propagation and finance ownership/aging/settlement checks.
- `CPE_E2E=1 ... npm run test:e2e -- --workers=1`: three passed (CPE full workflow and two existing unauthenticated API checks); thirteen legacy authenticated E2E scenarios skipped because their `E2E_PASSWORD` fixture was not configured. The CPE scenario checks all twelve screens, mobile overflow and native dialog behavior.
- `git diff --check`: passed.
- The separate legacy `npm run test:db` suite was not run; its NTOP fixture setup is outside this CPE test environment. No claim is made about legacy database integration or MySQL 8 cluster/load/security acceptance.
- Screenshots of desktop dashboard/project and mobile drawer were visually reviewed. No production data, migration, seed, deployment or external purchasing/payment action was executed.

## Optional prototype dataset

The owner subsequently requested realistic prototype-style sample data. See [CPE sample data and accounts](demo-data.md) for the opt-in development seed, six scoped accounts, data normalization and replay/target protections. The application still never substitutes mock data for empty production records.
