# CPE prototype sample data

The owner requested sample data similar to `requirements/cpe-project-bid-excellence.html` on 2026-11-05.
This is an explicit, development-only import into **CPE — ข้อมูลตัวอย่างสำหรับทดสอบ**, organization code `CPE-DEMO-V1`.
It never runs on application startup, normal `db:seed`, reads, migrations or deployment startup.

## Included data

| Records | Count |
|---|---:|
| Opportunities, including historical bids/reference jobs | 44 |
| BOQ items from the two detailed prototype estimates | 20 |
| Material/labor/equipment catalog entries | 14 |
| Price observations (six monthly observations plus three named-vendor examples per catalog item) | 126 |
| Vendors | 12 |
| RFQs, including supplemental commitments and closed-project procurement | 15 |
| Vendor quotes | 19 |
| Projects: three active, seven closed/reference | 10 |
| Monthly plan/actual/cash records | 72 |
| Receivables and payables | 7 |
| Pending master-policy proposals | 2 |
| Scoped test accounts | 6 |

Examples include ABC Logistics warehouse, Solar Rooftop 2.4 MWp, the packaging production line, and the MEP renovation; the catalog includes steel, concrete, PV panels, wiring and labor rates from the supplied prototype.
The fixture was extracted from whitelisted static literals with a TypeScript AST parser; no prototype JavaScript is executed during seeding or application operation.

## Consistency decisions

- Prototype labels such as “แพ้ประมูล” and “ส่งขอราคา” are mapped to the application’s canonical stage/status values, so filters and workflow controls remain usable.
- `DEMO-` codes and the separate organization identify synthetic records. Source names are the prototype's fictional examples, not copied production customer data.
- The ten current opportunities, 26 historical bids, two additional project opportunities and six additional reference-project opportunities are stored in the existing CPE domain. The archive and win model therefore use the same source records. Search `OPP-68` to view the ten current prototype opportunities.
- BOQ totals use the application's Decimal formula and configured overhead/risk, rather than the prototype's separate per-opportunity multipliers. BOQ catalog links require matching units. Steel ton quantities/prices are converted to kg without changing their financial value.
- Project actual cash-out is allocated across the prototype's monthly pattern so the sum exactly equals the prototype's project actual expense. The final allocation absorbs decimal rounding.
- Active project outstanding PO commitments match the prototype: ABC Logistics **8.9M**, packaging line **4.3M**, MEP renovation **0.6M**. Supplemental RFQs/POs represent the commitment portions that were present only in prototype summaries.
- Closed reference projects have actual category amounts totaling actual expense. Their closed procurement is fully paid, so commitments are zero. The repeated `PRJ-2588` source project is retained once; its category weights are normalized to the actual expense in its project record.
- Company cash is calculated from the imported project monthly ledger and configured opening cash; the prototype's independent company aggregate is not pasted into report output. Opening cash is 12.6M and credit limit 60M. Receivable/payable examples follow the prototype buckets and amounts.
- Historical vendor job/value summaries are not inserted as fake report totals. Vendor statistics derive from the actual sample awarded quotes in the database.
- Sample dates are anchored to `--as-of` (default: today's Bangkok date). Current project cursor months align with the anchor; history is placed before it; six-month prices and live sample quote validity are usable when the seed is first run. Re-running does not move dates or extend quote validity.
- Only the two master-policy proposals that were pending in the prototype are imported. The demo civil-risk policy starts at 8%, with a pending proposal to change to 5%; the other proposal raises the vendor warning threshold. No executive approval is invented or performed by the seed.

## Accounts and ownership

| Login | Role(s) |
|---|---|
| `cpe.demo.tester@ntop.test` | All five CPE business roles; browse all twelve screens and create a fresh end-to-end case |
| `cpe.demo.executive@ntop.test` | Executive |
| `cpe.demo.sales@ntop.test` | Sales (KAM); owns the sample opportunities |
| `cpe.demo.estimator@ntop.test` | Estimator; assigned to the sample technical work |
| `cpe.demo.procurement@ntop.test` | Procurement |
| `cpe.demo.pm@ntop.test` | PM; owns the sample projects |

Each account has a different generated password, stored with bcrypt. No fixed default password or administrator account is added. Assignments use ORG_UNIT scope in the demo organization; no existing user/password is reset. Existing business data is untouched. The multi-role tester still respects ownership and maker/checker rules: use the corresponding role account to edit preloaded assignments, or create a new case owned by the tester.

The administrative operator must already exist and be active. User and organization creation use the retained administration application interfaces and append-only audit. CPE records, role assignments, audit and a seed receipt commit in one transaction.

## Run locally

After the existing schema migrations have been applied to an isolated MySQL-compatible development/test database:

```sh
CPE_DEMO_SEED=1 npm run db:seed:cpe-demo -- \
  --target local \
  --actor-email YOUR_EXISTING_TEST_ADMIN_EMAIL \
  --credentials-out /tmp/cpe-demo-accounts.json
```

Set `DATABASE_URL` using the normal protected environment mechanism. The local target requires localhost/127.0.0.1 and an explicitly named `dev`, `test`, `uat` or `demo` database, and rejects production names. Use `--as-of YYYY-MM-DD` for a reproducible screenshot date.

The credential output path must be absolute and resolve outside the repository. The file is created exclusively with mode **0600**; credentials are not printed to stdout, application logs or audit. An existing credential file is never overwritten. If its destination fails, the database transaction rolls back. If a commit itself fails after credentials were persisted, inspect the protected file and database before retrying; do not delete users or reset passwords automatically.

## NTOP development server

Follow `docs/server-deployment.md`: commit/push the reviewed revision, `ssh ntop`, `/opt/apps/ntop-dev`, then `./deploy.sh`, including the explicit CPE migration. Verify the actual development database before running:

```sh
CPE_DEMO_SEED=1 npm run db:seed:cpe-demo -- \
  --target ntop-dev \
  --actor-email YOUR_EXISTING_DEV_ADMIN_EMAIL \
  --credentials-out /tmp/cpe-demo-accounts.json
```

The `ntop-dev` guard requires the exact deployment path and an explicitly named development/test database. Read the protected credential file only for delivery to the owner, then use the new role accounts to verify the deployed site. Do not run a general production seed or change deployment secrets.

As of this change, SSH access and the earlier requested default-branch push confirmation are still outstanding. Sample data and accounts have been exercised on the local isolated test database; this document does not claim that the public server has been updated.

## Replay and verification

The completed seed receipt prevents a second import, even if a different date/operator is supplied. A replay does not recreate users, replace passwords, reset master values or overwrite user edits. A changed fixture requires an explicit dataset-version change and review; it does not update an already seeded organization automatically.

- `tests/unit/cpe/cpe-demo.test.ts`: counts, linkage, Decimal totals/rounding, source commitments, price dates, reference closure, units, deterministic IDs, target guards and unprivileged account roles.
- `npm run test:cpe:db`: existing CPE workflow plus seed integration, role visibility across all twelve screens, password hashing, replay preserving changes and rollback on credential failure.
- `CPE_DEMO_E2E=1 CPE_DEMO_CREDENTIALS_FILE=/tmp/cpe-demo-accounts.json npx playwright test tests/e2e/cpe-demo.spec.ts`: populated-page previews and PM denial. Configure the normal Playwright URL/server variables for the local test environment.

Changed files: `prisma/fixtures/cpe-demo.json`, `lib/cpe/demo/data.ts`, `lib/cpe/demo/seed.ts`, `scripts/seed-cpe-demo.ts`, `package.json`, the three demo test files, this guide and a small shared-style adjustment to truncate long multi-role account labels. No schema change or new migration is required.

## Verification evidence — 2026-11-05

- `npm run lint`: passed with seven existing warnings in the retained prospect code; no new errors.
- `npm run typecheck`: passed.
- `npm test`: 810 passed, 34 skipped by opt-in requirements.
- `npm run test:cpe:db` on the isolated local `cpe_bidex_test_final20261105`: 14 passed (nine workflow tests plus five seed integration tests).
- `npm run build`: production build passed.
- `CPE_DEMO_E2E=1 ... npx playwright test tests/e2e/cpe-demo.spec.ts --workers=1`: passed; populated twelve-page preview, mobile overflow, real login and PM access denial. Desktop dashboard, sales, catalog, finance and mobile screenshots were visually reviewed.
- The actual seed command returned `created`; a second run returned `already-seeded`. The protected local account file was verified as mode 0600 without printing passwords. Temporary app/database processes were stopped after validation.
- No remote push, deployment, server-side account creation or production data write was performed. SSH/default-branch authorization blockers from the deployment request remain unresolved.
