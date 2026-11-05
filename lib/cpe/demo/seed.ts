import { createHash, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { IdentityAdminService } from "../../administration/identity-admin-service";
import { OrganizationAdminService } from "../../administration/organization-admin-service";
import { AppendOnlyAuditWriter } from "../../audit/audit-writer";
import { HashChainedAuditStore } from "../../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../../audit/prisma-audit-ledger-repository";
import { CPE_ROLE_GRANTS } from "../config";
import { buildDemoData, demoId, DEMO_NAMESPACE, DEMO_LABEL } from "./data";
import fixture from "../../../prisma/fixtures/cpe-demo.json";

export const DEMO_ACCOUNTS = [
  {
    key: "tester",
    name: "ผู้ทดสอบ CPE ทุกสายงาน",
    roles: ["EXECUTIVE", "KAM", "ESTIMATOR", "PROCUREMENT", "PROJECT_MANAGER"],
  },
  { key: "executive", name: "ผู้บริหารตัวอย่าง CPE", roles: ["EXECUTIVE"] },
  { key: "sales", name: "ฝ่ายขายตัวอย่าง CPE", roles: ["KAM"] },
  {
    key: "estimator",
    name: "วิศวกรประมาณราคาตัวอย่าง CPE",
    roles: ["ESTIMATOR"],
  },
  {
    key: "procurement",
    name: "ฝ่ายจัดซื้อตัวอย่าง CPE",
    roles: ["PROCUREMENT"],
  },
  {
    key: "pm",
    name: "ผู้จัดการโครงการตัวอย่าง CPE",
    roles: ["PROJECT_MANAGER"],
  },
] as const;
export function assertDemoSeedTarget(input: {
  url: string;
  target: string;
  cwd: string;
  optIn: string | undefined;
}) {
  if (input.optIn !== "1")
    throw new Error(
      "Set CPE_DEMO_SEED=1 to explicitly request synthetic development data",
    );
  const url = new URL(input.url);
  const database = decodeURIComponent(url.pathname.slice(1));
  const approvedCpe =
    input.target === "cpe-bidex" &&
    path.resolve(input.cwd) === "/opt/apps/cpe-bidex" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    database === "cpe_bidex";
  if (
    !/^(mysql):$/.test(url.protocol) ||
    (!/(^|[_-])(dev|test|uat|demo)([_-]|$)/i.test(database) && !approvedCpe) ||
    /prod(uction)?/i.test(database)
  )
    throw new Error(
      "Demo data requires an explicitly named development/test database",
    );
  if (input.target === "local") {
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
      throw new Error("Local demo seeding requires a local database host");
  } else if (input.target === "ntop-dev") {
    if (path.resolve(input.cwd) !== "/opt/apps/ntop-dev")
      throw new Error("ntop-dev must run from /opt/apps/ntop-dev");
  } else if (input.target === "cpe-bidex") {
    if (!approvedCpe)
      throw new Error(
        "CPE requires /opt/apps/cpe-bidex and the local cpe_bidex database",
      );
  } else
    throw new Error(
      "Only local, ntop-dev or the confirmed cpe-bidex target is supported",
    );
  return { database, host: url.hostname };
}
export type DemoCredentials = {
  key: string;
  email: string;
  password: string;
  name: string;
  roles: readonly string[];
  id: string;
};
export async function seedCpeDemo(
  db: PrismaClient,
  input: {
    actorId: string;
    asOf: string;
    namespace?: string;
    target?: string;
    persistCredentials: (credentials: DemoCredentials[]) => void;
  },
) {
  const database = await db.$queryRaw<
    Array<{ name: string }>
  >`SELECT DATABASE() AS name`;
  if (
    !database[0]?.name ||
    (!/(^|[_-])(dev|test|uat|demo)([_-]|$)/i.test(database[0].name) &&
      !(
        database[0].name === "cpe_bidex" &&
        input.target === "cpe-bidex" &&
        path.resolve(process.cwd()) === "/opt/apps/cpe-bidex"
      )) ||
    /prod(uction)?/i.test(database[0].name)
  )
    throw new Error(
      "Refusing demo data outside a named development/test database",
    );
  const namespace = input.namespace ?? DEMO_NAMESPACE;
  if (!/^cpe-demo-[a-zA-Z0-9-]{1,60}$/.test(namespace))
    throw new Error("Invalid demo namespace");
  const markerId = demoId(namespace, "manifest", "complete");
  const fingerprint = createHash("sha256")
    .update(namespace + JSON.stringify(fixture))
    .digest("hex");
  const actor = await db.user.findFirst({
    where: { id: input.actorId, active: true, role: "ADMIN" },
    select: { id: true, role: true },
  });
  if (!actor) throw new Error("An active administrative actor is required");
  const existing = await db.cpeCommandReceipt.findUnique({
    where: { id: markerId },
  });
  if (existing) {
    if (existing.fingerprint !== fingerprint)
      throw new Error(
        "Fixture changed; use a new dataset version without overwriting existing data",
      );
    return {
      status: "already-seeded" as const,
      organizationId: existing.resultId,
    };
  }
  const audit = new AppendOnlyAuditWriter<Prisma.TransactionClient>({
    store: new HashChainedAuditStore({
      repository: new PrismaAuditLedgerRepository(),
      maxAttempts: 3,
    }),
  });
  return db.$transaction(
    async (tx) => {
      const repository = {
        transaction: <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
          work(tx),
      };
      const identity = new IdentityAdminService(repository, audit);
      const organization = new OrganizationAdminService(repository, audit);
      const org = await organization.createOrganizationUnit(
        actor,
        {
          code: namespace.toUpperCase(),
          name: "CPE — ข้อมูลตัวอย่างสำหรับทดสอบ",
          parentId: null,
        },
        randomUUID(),
      );
      const credentials: DemoCredentials[] = [];
      for (const plan of DEMO_ACCOUNTS) {
        const email = `${namespace === DEMO_NAMESPACE ? "cpe.demo" : namespace}.${plan.key}@ntop.test`;
        const password = randomBytes(24).toString("base64url") + "!aA9";
        const user = await identity.createUser(
          actor,
          { name: plan.name, email, password, role: "VIEWER" },
          randomUUID(),
        );
        for (const roleCode of plan.roles) {
          for (const permissionCode of CPE_ROLE_GRANTS[roleCode])
            await tx.rolePermissionGrant.upsert({
              where: { roleCode_permissionCode: { roleCode, permissionCode } },
              create: { roleCode, permissionCode },
              update: {},
            });
          await identity.createRoleAssignment(
            actor,
            {
              userId: user.id,
              roleCode,
              scopeCode: "ORG_UNIT",
              organizationUnitId: org.id,
              effectiveFrom: new Date(),
              effectiveTo: null,
            },
            randomUUID(),
          );
        }
        credentials.push({
          key: plan.key,
          id: user.id,
          email,
          password,
          name: plan.name,
          roles: plan.roles,
        });
      }
      const user = (key: string) => credentials.find((c) => c.key === key)!.id;
      const data = buildDemoData(
        {
          organizationId: org.id,
          actorId: actor.id,
          salesId: user("sales"),
          estimatorId: user("estimator"),
          pmId: user("pm"),
          executiveId: user("executive"),
        },
        input.asOf,
        namespace,
      );
      await tx.cpeMasterData.create({
        data: {
          organizationUnitId: org.id,
          configuration: data.master as Prisma.InputJsonValue,
        },
      });
      await tx.cpeVendor.createMany({ data: data.vendors });
      await tx.cpeCatalogItem.createMany({ data: data.catalogItems });
      await tx.cpePriceHistory.createMany({ data: data.prices });
      await tx.cpeOpportunity.createMany({ data: data.opportunities });
      await tx.cpeBoqItem.createMany({ data: data.boqItems });
      await tx.cpeProject.createMany({ data: data.projects });
      await tx.cpeRfq.createMany({ data: data.rfqs });
      await tx.cpeVendorQuote.createMany({ data: data.quotes });
      await tx.cpeProjectMonth.createMany({ data: data.months });
      await tx.cpeFinanceEntry.createMany({ data: data.finance });
      await tx.cpeImprovement.createMany({ data: data.improvements });
      const counts = {
        opportunities: data.opportunities.length,
        boqItems: data.boqItems.length,
        catalog: data.catalogItems.length,
        vendors: data.vendors.length,
        rfqs: data.rfqs.length,
        quotes: data.quotes.length,
        projects: data.projects.length,
        months: data.months.length,
        finance: data.finance.length,
        improvements: data.improvements.length,
        accounts: credentials.length,
      };
      await audit.append(
        {
          actorId: actor.id,
          action: "cpe.demo.seed",
          targetType: "CpeDemoDataset",
          targetId: org.id,
          outcome: "SUCCESS",
          correlationId: namespace,
          reason: DEMO_LABEL,
          data: { namespace, asOf: data.asOf, ...counts },
        },
        { transaction: tx },
      );
      await tx.cpeCommandReceipt.create({
        data: {
          id: markerId,
          actorId: actor.id,
          requestId: markerId,
          fingerprint,
          resultId: org.id,
        },
      });
      input.persistCredentials(credentials);
      return { status: "created" as const, organizationId: org.id, counts };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 120000,
    },
  );
}
