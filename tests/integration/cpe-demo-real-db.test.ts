import { randomUUID } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { seedCpeDemo, type DemoCredentials } from "../../lib/cpe/demo/seed";
import { DEMO_NAMESPACE, demoId } from "../../lib/cpe/demo/data";
import {
  loadAuthorizationContext,
  loadGrantedPermissions,
} from "../../lib/authorization/authorization-context";
import { loadCpePage, parseCpeFilters } from "../../lib/cpe/query";
import { SCREENS, STAGES } from "../../lib/cpe/config";
import { executeCpeCommand } from "../../lib/cpe/service";
import type { CpeActor } from "../../lib/cpe/access";
const suite =
  process.env.RUN_CPE_DB_INTEGRATION === "1" ? describe : describe.skip;
suite("CPE prototype seed on a real isolated database", () => {
  const namespace = DEMO_NAMESPACE + "-" + randomUUID();
  let administratorId: string;
  let organizationId: string;
  let credentials: DemoCredentials[] = [];
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !/^cpe_.*test/.test(url.pathname.slice(1)) ||
      url.hostname !== "127.0.0.1"
    )
      throw new Error("Use an isolated local CPE test database");
    const admin = await prisma.user.create({
      data: {
        email: `seed-admin-${randomUUID()}@example.test`,
        name: "ผู้ดูแล seed ทดสอบ",
        role: "ADMIN",
        passwordHash: await hash(randomUUID(), 4),
      },
    });
    administratorId = admin.id;
    await prisma.auditLedger.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default", lastHash: "0".repeat(64) },
    });
  });
  async function actorFor(key: string): Promise<CpeActor> {
    const user = credentials.find((c) => c.key === key)!;
    const context = await loadAuthorizationContext({
      actorId: user.id,
      legacyRole: "VIEWER",
    });
    return {
      id: user.id,
      name: user.name,
      organizationIds: [...(context.organizationUnitIds ?? [])],
      permissions: await loadGrantedPermissions(context),
    };
  }
  it("creates the full source-linked dataset and role accounts in one audited transaction", async () => {
    const result = await seedCpeDemo(prisma, {
      actorId: administratorId,
      asOf: "2026-11-05",
      namespace,
      persistCredentials: (rows) => {
        credentials = rows;
      },
    });
    expect(result.status).toBe("created");
    if (result.status !== "created") throw new Error("Expected fresh dataset");
    organizationId = result.organizationId;
    expect(result.counts).toMatchObject({
      opportunities: 44,
      boqItems: 20,
      catalog: 14,
      vendors: 12,
      projects: 10,
      months: 72,
      finance: 7,
      improvements: 2,
      accounts: 6,
    });
    expect(
      await prisma.cpeOpportunity.count({
        where: { organizationUnitId: organizationId },
      }),
    ).toBe(44);
    expect(
      await prisma.cpeRfq.count({
        where: { opportunity: { organizationUnitId: organizationId } },
      }),
    ).toBe(15);
    expect(
      await prisma.auditEvent.count({
        where: {
          actorId: administratorId,
          action: "cpe.demo.seed",
          correlationId: namespace,
        },
      }),
    ).toBe(1);
    expect(
      await prisma.auditEvent.count({
        where: {
          actorId: administratorId,
          action: "identity.user.create",
          targetId: { in: credentials.map((c) => c.id) },
        },
      }),
    ).toBe(6);
    for (const user of credentials) {
      expect(user.password.length).toBeGreaterThan(24);
      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(stored.role).toBe("VIEWER");
      expect(stored.passwordHash).not.toBe(user.password);
      expect(await compare(user.password, stored.passwordHash)).toBe(true);
    }
  });
  it("loads real, non-empty data for every screen while respecting role-specific access", async () => {
    const tester = await actorFor("tester");
    for (const screen of SCREENS) {
      const data = await loadCpePage(
        tester,
        screen.id,
        parseCpeFilters({ org: organizationId }),
      );
      if (screen.id !== "exec") expect(data.total).toBeGreaterThan(0);
      else {
        expect(data.projectTotals._count).toBe(3);
        expect(data.monthly.length).toBeGreaterThan(0);
        expect(data.weighted).not.toBeNull();
      }
    }
    await expect(
      loadCpePage(
        await actorFor("pm"),
        "sales",
        parseCpeFilters({ org: organizationId }),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      loadCpePage(
        await actorFor("sales"),
        "procurement",
        parseCpeFilters({ org: organizationId }),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("replays without duplicating rows, replacing passwords or overwriting user edits", async () => {
    const sales = await actorFor("sales");
    const id = demoId(namespace, "opportunity", "OPP-68-027");
    await executeCpeCommand(sales, {
      requestId: randomUUID(),
      organizationId,
      type: "opportunity.stage",
      id,
      version: 1,
      stage: STAGES[1],
    });
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: sales.id },
      select: { passwordHash: true },
    });
    const result = await seedCpeDemo(prisma, {
      actorId: administratorId,
      asOf: "2026-12-05",
      namespace,
      persistCredentials: () => {
        throw new Error("Must not rewrite credentials on replay");
      },
    });
    expect(result.status).toBe("already-seeded");
    expect(result.organizationId).toBe(organizationId);
    expect(
      await prisma.cpeOpportunity.count({
        where: { organizationUnitId: organizationId },
      }),
    ).toBe(44);
    const updated = await prisma.cpeOpportunity.findUniqueOrThrow({
      where: { id },
    });
    expect(updated.stage).toBe(STAGES[1]);
    expect(updated.version).toBe(2);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: sales.id } }))
        .passwordHash,
    ).toBe(before.passwordHash);
    expect(
      await prisma.auditEvent.count({
        where: { action: "cpe.demo.seed", correlationId: namespace },
      }),
    ).toBe(1);
  });
  it("rolls back users, organization, business rows and audit if protected credential persistence fails", async () => {
    const failedNamespace = DEMO_NAMESPACE + "-" + randomUUID();
    await expect(
      seedCpeDemo(prisma, {
        actorId: administratorId,
        asOf: "2026-11-05",
        namespace: failedNamespace,
        persistCredentials: () => {
          throw new Error("Credential destination unavailable");
        },
      }),
    ).rejects.toThrow("Credential destination unavailable");
    expect(
      await prisma.organizationUnit.count({
        where: { code: failedNamespace.toUpperCase() },
      }),
    ).toBe(0);
    expect(
      await prisma.user.count({
        where: { email: { startsWith: failedNamespace + "." } },
      }),
    ).toBe(0);
    expect(
      await prisma.cpeCommandReceipt.findUnique({
        where: { id: demoId(failedNamespace, "manifest", "complete") },
      }),
    ).toBeNull();
    expect(
      await prisma.auditEvent.count({
        where: { correlationId: failedNamespace },
      }),
    ).toBe(0);
  });
  it("rejects a non-admin actor without modifying the dataset", async () => {
    const sales = credentials.find((c) => c.key === "sales")!;
    await expect(
      seedCpeDemo(prisma, {
        actorId: sales.id,
        asOf: "2026-11-05",
        namespace,
        persistCredentials: () => undefined,
      }),
    ).rejects.toThrow("administrative actor");
  });
});
