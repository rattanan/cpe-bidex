import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { assertDemoSeedTarget, seedCpeDemo } from "../lib/cpe/demo/seed";
import type { PrismaClient } from "@prisma/client";
let database: PrismaClient | undefined;
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
async function main() {
  loadEnvConfig(process.cwd());
  const target = arg("--target") ?? "";
  assertDemoSeedTarget({
    url: process.env.DATABASE_URL ?? "",
    target,
    cwd: fs.realpathSync(process.cwd()),
    optIn: process.env.CPE_DEMO_SEED,
  });
  const { prisma } = await import("../lib/prisma");
  database = prisma;
  const email = arg("--actor-email");
  if (!email)
    throw new Error("Provide --actor-email for an active administrator");
  const actor = await prisma.user.findUnique({
    where: { email },
    select: { id: true, active: true, role: true },
  });
  if (!actor?.active || actor.role !== "ADMIN")
    throw new Error("Administrator not found");
  const output = arg("--credentials-out");
  if (
    !output ||
    !path.isAbsolute(output) ||
    path.resolve(output).startsWith(process.cwd() + path.sep)
  )
    throw new Error(
      "Provide --credentials-out as an absolute path outside the repository",
    );
  const protectedOutput = path.join(
    fs.realpathSync(path.dirname(output)),
    path.basename(output),
  );
  if (protectedOutput.startsWith(fs.realpathSync(process.cwd()) + path.sep))
    throw new Error("Credential destination resolves inside the repository");
  const asOf =
    arg("--as-of") ??
    new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const result = await seedCpeDemo(prisma, {
    actorId: actor.id,
    asOf,
    target,
    persistCredentials: (credentials) => {
      const fd = fs.openSync(protectedOutput, "wx", 0o600);
      try {
        fs.writeFileSync(
          fd,
          JSON.stringify({ target, asOf, accounts: credentials }, null, 2),
        );
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    },
  });
  console.log(
    JSON.stringify({
      ...result,
      credentialsFile:
        result.status === "created" ? protectedOutput : undefined,
    }),
  );
}
main()
  .catch(() => {
    console.error(
      "CPE demo seed did not complete. Verify target, administrator, migration, namespace conflicts and the protected credentials path. Existing data and passwords are not reset.",
    );
    process.exitCode = 1;
  })
  .finally(() => database?.$disconnect());
