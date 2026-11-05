# CPE Project Bid Excellence

The active application is the CPE construction sales, estimating, procurement, project and cash workspace at `/cpe`. See [the requirement trace, setup and migration guide](docs/cpe/implementation.md). Existing NTOP routes and data are retained; unused menus are hidden. Optional [prototype-style sample data and scoped test accounts](docs/cpe/demo-data.md) use a separate explicit development seed.

CPE requires MySQL 8-compatible JSON and analytical SQL. The MariaDB 5.5 bootstrap below applies to retained legacy NTOP tables and does not provision the new CPE workspace.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

## NTOP database setup

1. Copy `.env.example` to `.env` and provide a **test** MySQL connection plus a 32+ character `AUTH_SECRET`.
2. Run `npm run db:generate`.
3. Run `npm run db:migrate` only against the test database; do not use a production connection for initial validation.
4. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, then run `npm run db:seed` to create the first administrator.

The provided database currently runs MariaDB 5.5, which Prisma Migrate cannot manage. Apply `prisma/legacy-mariadb-5.5.sql` with the MySQL CLI for that server, then use Prisma only as the application client.

Never commit `.env` or database credentials.

## Quality checks

Run the local quality gate before submitting a change:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Use `npm run test:watch` while developing unit tests. Tests run in a Node environment and are discovered from `tests/**/*.test.ts`.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deployment

The active development environment is deployed directly on the NTOP server
without Docker or Cloud Run:

- Application path: `/opt/apps/ntop-dev`
- Public URL: `https://ntop-dev.rattanan.dev`

See [Self-hosted server deployment](docs/server-deployment.md) for the current
deployment decision and acceptance criteria. The former Cloud Run deployment is
retained only as historical documentation and is not an active target.
