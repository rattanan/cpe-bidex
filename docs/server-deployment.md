# CPE server deployment — confirmed target

The owner explicitly confirmed this target on 2026-11-05:

- SSH: `ntop`
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
