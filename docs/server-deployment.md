# CPE server deployment — confirmed target

The owner explicitly confirmed this target on 2026-11-05:

- SSH: `ntop`
- Repository: `https://github.com/rattanan/cpe-bidex` (`origin`, `main`); do not push CPE changes to the former NTOP repository.
- Public URL: `https://cpe-bidex.rattanan.dev`
- Application: `/opt/apps/cpe-bidex`
- PM2 process: `cpe-bidex`, bound to `127.0.0.1:3015`
- MySQL: local `cpe_bidex` (MySQL 8.4 verified)
- Source delivery: reviewed Git archive; the deployed CPE directory has no Git checkout.

The retained NTOP runbook below is not the deployment procedure for this CPE copy.
Server preflight found that `/opt/apps/ntop` and `/opt/apps/ntop-dev` share the
`ntop` database. CPE deployment and demo seeding must use the separate CPE target.

Before activation, back up the CPE database and preserve the current application
release. Build a separate staging directory using the existing protected CPE
environment, run lint/typecheck/tests/build, apply migrations explicitly to
`cpe_bidex`, initialize the first admin only if the database has no users, and
activate the release while restarting only PM2 `cpe-bidex`. Keep CPE document
storage under `/opt/apps/cpe-bidex-private/documents`. Retain the previous release
and database backup for rollback; do not delete audit or existing records.

After activation, run the opt-in demo command from `/opt/apps/cpe-bidex` with
`--target cpe-bidex`; it checks the exact application path and local database.
Deliver generated credentials from a protected file, verify real login and all
twelve CPE screens, and record the release hash and checks. Do not reuse or modify
NTOP production configuration or restart its processes.

## Deployment evidence — 2026-11-05

- Active application revision: `1fe8332a5949917077b2a6ea5a096ca46c8ab809`, also pushed to CPE `origin/main`. The deployed `.cpe-release.json` records this revision and repository. Later documentation-only commits do not change the application revision.
- All 51 forward migrations applied successfully to the initially empty `cpe_bidex` database; `prisma migrate status` confirms it is up to date.
- Initialized one administrator and explicitly imported the prototype dataset into `CPE-DEMO-V1`: 44 opportunities, 20 BOQ items, 14 catalog items, 12 vendors, 15 RFQs, 19 quotes, 10 projects, 72 project-month records, 7 finance entries, 2 improvement proposals and 6 scoped test accounts. Initialization/import audit evidence is present.
- Server gates passed: `npm run lint` (0 errors, 7 existing prospect warnings), `npm run typecheck`, `npm test` (811 passed, 34 opt-in tests skipped), `npm run build`.
- Local isolated database suites: `npm run test:cpe:db` (14 passed). The final workflow assertions include chronological monthly cash amounts. A first strict-MariaDB experiment exposed Prisma aggregate behavior on empty scoped relations; the normal MariaDB suite passed and all twelve patched page queries were separately checked read-only on actual MySQL 8.4 with `ONLY_FULL_GROUP_BY` enabled. An attempted additional MySQL test database was denied by the application account; no privileges were expanded.
- Live HTTPS Playwright acceptance passed: tester login, all twelve populated screens, prototype opportunity search, catalog and receivable aging, mobile overflow check, logout, restricted PM login/access denial and no browser runtime errors. Local port 3015 and public HTTPS login both return 200.
- Live verification found a `GROUP BY month` collision with `CpeProjectMonth.month`; revision `1fe8332` groups by the full calendar expression, preserving strict SQL mode.
- Credentials are generated separately for each account. Server files `/opt/apps/cpe-bidex-private/demo-accounts.json` and `/opt/apps/cpe-bidex-private/bootstrap-admin.json` are mode 0600, outside the web root; deliver only through a protected owner file. No credentials belong in Git or this record.
- Document storage is isolated at `/opt/apps/cpe-bidex-private/documents`. Only PM2 `cpe-bidex` was restarted; NTOP process IDs and uptime remained unchanged.

Rollback material is under `/opt/apps/cpe-bidex-private/backups`: original database dump `db-before-7673526.sql`, original application `app-before-7673526`, and pre-patch CPE application `app-before-1fe8332`. For a code rollback, stop only `cpe-bidex`, move the failed application aside, restore the chosen application directory at `/opt/apps/cpe-bidex`, then restart only that process. Keep the database and audit evidence; do not restore the empty database dump over populated CPE data without a separately approved recovery decision.

---

# Self-hosted NTOP server deployment

## Decision status

- Status: Active development deployment target
- Effective date: 2026-08-18
- Supersedes: Google Cloud Run deployment

NTOP is deployed directly on the NTOP server. Docker, containers and Cloud Run
are not part of the active deployment path.

## Development environment

| Setting | Value |
|---|---|
| Server | NTOP server |
| Application path | `/opt/apps/ntop-dev` |
| Public URL | `https://ntop-dev.rattanan.dev` |
| Runtime | Node.js process running directly on the server |
| Deployment model | Build and run from the server application path without Docker |

The development database, runtime environment variables, credentials and AI
master key must be isolated from every future production environment. Secrets
must not be committed to the repository.

## Production environment

Production deployment is outside the scope of this decision. Do not infer a
production URL, enable production traffic or reuse development secrets until the
production target and readiness approval are confirmed separately.

## Acceptance criteria

1. The checked-out application is located at `/opt/apps/ntop-dev`.
2. The application is built and run as a direct Node.js process; Docker and
   Cloud Run are not used by the deployment procedure.
3. `https://ntop-dev.rattanan.dev` resolves to the NTOP server, has a valid TLS
   certificate and routes requests to the application through the approved
   reverse proxy.
4. Runtime secrets are stored outside Git with server-side file permissions and
   are distinct from production secrets.
5. Database migrations are executed as an explicit release step with
   `npx prisma migrate deploy`; migrations are not run implicitly at process
   startup.
6. `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass for
   the exact revision before it receives development traffic.
7. An unauthenticated request is redirected to `/login`, and no runtime secret
   value is exposed in the response or logs.

## Development deployment runbook

When the user asks to deploy NTOP development, use this sequence:

1. Commit the approved local changes to Git.
2. Push the commit to `origin`.
3. Connect to the development server with `ssh ntop`.
4. Change to the deployed application directory with `cd /opt/apps/ntop-dev`.
5. Run `./deploy.sh` and wait for it to finish successfully.
6. Verify `https://ntop-dev.rattanan.dev` after the script completes.

Do not substitute Docker, Cloud Run or another deployment path for this
environment unless the user explicitly changes the deployment procedure.

## Retained files

The repository may still contain a `Dockerfile` and historical Cloud Run notes.
They are retained for backward compatibility and history but must not be used by
the active server deployment.
