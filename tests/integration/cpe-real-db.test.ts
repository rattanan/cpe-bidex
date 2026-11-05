import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { hash } from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { executeCpeCommand } from "../../lib/cpe/service";
import { loadCpePage, parseCpeFilters } from "../../lib/cpe/query";
import {
  CPE_ROLE_GRANTS,
  DEFAULT_MASTER,
  DOCUMENTS,
  SCREENS,
} from "../../lib/cpe/config";
import type { CpeActor } from "../../lib/cpe/access";
const enabled = process.env.RUN_CPE_DB_INTEGRATION === "1";
const suite = enabled ? describe : describe.skip;
suite("CPE real database workflow", () => {
  let actor: CpeActor;
  let other: CpeActor;
  let org: string;
  let opportunityId: string;
  let materialId: string;
  let vendorId: string;
  let projectId: string;
  let rfqId: string;
  const execute = (data: Record<string, unknown>, who = actor) =>
    executeCpeCommand(who, {
      requestId: randomUUID(),
      organizationId: org,
      ...data,
    });
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !/^cpe_.*test/.test(url.pathname.slice(1)) ||
      !["127.0.0.1", "localhost"].includes(url.hostname)
    )
      throw new Error(
        "CPE integration requires an explicitly named local test database",
      );
    org = (
      await prisma.organizationUnit.create({
        data: { code: `CPE-TEST-${randomUUID()}`, name: "หน่วยงานทดสอบ CPE" },
      })
    ).id;
    const passwordHash = await hash("Cpe-Test-Only-2026!", 4);
    const user = await prisma.user.create({
      data: {
        email: `cpe-${randomUUID()}@example.test`,
        name: "ผู้ทดสอบ CPE",
        passwordHash,
        role: "ADMIN",
      },
    });
    await prisma.userRoleAssignment.create({
      data: {
        userId: user.id,
        organizationUnitId: org,
        roleCode: "ADMIN",
        scopeCode: "ORG_UNIT",
        effectiveFrom: new Date("2020-01-01T00:00:00Z"),
      },
    });
    await prisma.auditLedger.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default", lastHash: "0".repeat(64) },
    });
    actor = {
      id: user.id,
      name: user.name,
      organizationIds: [org],
      permissions: CPE_ROLE_GRANTS.ADMIN,
    };
    other = { ...actor, id: "not-the-owner", organizationIds: ["foreign-org"] };
  });
  it("creates a real opportunity idempotently and denies other organizations", async () => {
    const command = {
      requestId: randomUUID(),
      organizationId: org,
      type: "opportunity.create",
      name: "ทดสอบอาคาร",
      customer: "ลูกค้าทดสอบ",
      sector: DEFAULT_MASTER.sectors[0].name,
      workType: DEFAULT_MASTER.workTypes[0].name,
      location: "กรุงเทพฯ",
      unit: "ตร.ม.",
      quantity: "100",
      cost: "100000",
      margin: 15,
      ownerId: actor.id,
      estimatorId: actor.id,
      dueAt: "2027-01-01",
    };
    opportunityId = await executeCpeCommand(actor, command);
    expect(await executeCpeCommand(actor, command)).toBe(opportunityId);
    expect(
      await prisma.cpeOpportunity.count({ where: { organizationUnitId: org } }),
    ).toBe(1);
    await expect(
      execute(
        {
          type: "opportunity.stage",
          id: opportunityId,
          version: 1,
          stage: "ประมาณราคา",
        },
        other,
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      executeCpeCommand(actor, { ...command, name: "Changed" }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("persists catalog, BOQ and review with exact totals, rejects stale edits", async () => {
    materialId = await execute({
      type: "catalog.create",
      code: `MAT-${randomUUID()}`,
      name: "วัสดุทดสอบ",
      category: "งานโครงสร้าง",
      unit: "กก.",
      price: "100",
      forecastPercent: 5,
      volatility: "สูง",
      source: "ใบเสนอราคาทดสอบ",
    });
    const item = {
      category: "งานโครงสร้าง",
      code: "ST-1",
      description: "โครงสร้าง",
      unit: "กก.",
      quantity: "1000",
      material: "100",
      labor: "10",
      source: "ใบเสนอราคา",
      catalogId: materialId,
    };
    await execute({
      type: "boq.save",
      id: opportunityId,
      version: 1,
      items: [item],
    });
    const o = await prisma.cpeOpportunity.findUniqueOrThrow({
      where: { id: opportunityId },
    });
    expect(o.cost.toString()).toBe("119900");
    await expect(
      execute({ type: "boq.save", id: o.id, version: 1, items: [item] }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      execute({ type: "bid.save", id: o.id, version: 2, margin: 18 }),
    ).rejects.toThrow("ต้องยืนยัน");
    await execute({ type: "cost.approve", id: o.id, version: 2 });
    await execute({ type: "bid.save", id: o.id, version: 3, margin: 18 });
  });
  it("won outcome creates project, S-Curve and exactly one RFQ package", async () => {
    projectId = await execute({
      type: "opportunity.won",
      id: opportunityId,
      version: 4,
      contractNumber: "CT-TEST",
      contractValue: "150000",
      budget: "119900",
      durationMonths: 2,
      startAt: "2026-11-01",
      pmId: actor.id,
      generateRfqs: true,
    });
    const p = await prisma.cpeProject.findUniqueOrThrow({
      where: { id: projectId },
      include: { months: true },
    });
    expect(p.months).toHaveLength(2);
    expect(p.months.at(-1)?.plannedPercent.toString()).toBe("100");
    const rfqs = await prisma.cpeRfq.findMany({ where: { opportunityId } });
    expect(rfqs).toHaveLength(1);
    rfqId = rfqs[0].id;
    await execute({
      type: "rfq.generate",
      id: opportunityId,
      version: 5,
      needAt: "2026-12-01",
    });
    expect(await prisma.cpeRfq.count({ where: { opportunityId } })).toBe(1);
  });
  it("rejects duplicate vendor quotes, incomplete documents and duplicate PO", async () => {
    vendorId = await execute({
      type: "vendor.create",
      code: `VEN-${randomUUID()}`,
      name: "ผู้รับเหมาทดสอบ",
      workType: DEFAULT_MASTER.workTypes[0].name,
    });
    await execute({
      type: "vendor.evaluate",
      id: vendorId,
      version: 1,
      scores: { quality: 90, time: 90, safety: 90, price: 90, documents: 90 },
      suspended: false,
    });
    const quote = {
      type: "rfq.quote",
      id: rfqId,
      version: 1,
      vendorId,
      price: "100000",
      days: 30,
      paymentTerms: "เครดิต 30 วัน",
      validityDays: 30,
    };
    await execute(quote);
    await expect(execute({ ...quote, version: 2 })).rejects.toMatchObject({
      code: "P2002",
    });
    const q = await prisma.cpeVendorQuote.findFirstOrThrow({
      where: { rfqId },
    });
    await expect(
      execute({ type: "rfq.award", id: rfqId, version: 2, quoteId: q.id }),
    ).rejects.toThrow("เอกสาร");
    await execute({
      type: "rfq.documents",
      id: rfqId,
      version: 2,
      documents: DOCUMENTS,
    });
    await execute({ type: "rfq.award", id: rfqId, version: 3, quoteId: q.id });
    await expect(
      execute({ type: "rfq.award", id: rfqId, version: 4, quoteId: q.id }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("records actuals, PO payments and immutable reference costs on closing", async () => {
    await expect(
      execute({
        type: "project.month",
        id: projectId,
        version: 1,
        month: 1,
        actualPercent: 50,
        cashIn: "50000",
        cashOut: "60000",
        forecastIn: "0",
        forecastOut: "0",
        poPayments: { [rfqId]: "60001" },
      }),
    ).rejects.toThrow("ต้องไม่เกิน");
    await execute({
      type: "project.month",
      id: projectId,
      version: 1,
      month: 1,
      actualPercent: 50,
      cashIn: "50000",
      cashOut: "60000",
      forecastIn: "0",
      forecastOut: "0",
      poPayments: { [rfqId]: "60000" },
    });
    await execute({
      type: "project.month",
      id: projectId,
      version: 2,
      month: 2,
      actualPercent: 100,
      cashIn: "100000",
      cashOut: "50000",
      forecastIn: "0",
      forecastOut: "0",
      poPayments: { [rfqId]: "40000" },
    });
    await expect(
      execute({
        type: "project.close",
        id: projectId,
        version: 3,
        actualCategories: { งานโครงสร้าง: "100000" },
      }),
    ).rejects.toThrow("รวมเท่า");
    await execute({
      type: "project.close",
      id: projectId,
      version: 3,
      actualCategories: { งานโครงสร้าง: "110000" },
    });
    await expect(
      execute({
        type: "project.month",
        id: projectId,
        version: 4,
        month: 2,
        actualPercent: 100,
        cashIn: "0",
        cashOut: "0",
        forecastIn: "0",
        forecastOut: "0",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("every screen queries the shared database; preserves filters and rejects foreign IDs", async () => {
    for (const screen of SCREENS) {
      const data = await loadCpePage(
        actor,
        screen.id,
        parseCpeFilters({ org }),
      );
      expect(data.screen).toBe(screen.id);
      expect(data.currentCash).toBe("40000");
    }
    const data = await loadCpePage(
      actor,
      "sales",
      parseCpeFilters({
        org,
        q: "ทดสอบ",
        sort: "amount",
        order: "desc",
        page: "999",
      }),
    );
    expect(data.filters.page).toBe(1);
    expect(data.rows).toHaveLength(1);
    await expect(
      loadCpePage(
        { ...actor, permissions: [] },
        "sales",
        parseCpeFilters({ org }),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      loadCpePage(actor, "sales", parseCpeFilters({ org, id: "foreign" })),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("audit and idempotency receipts commit with business effects", async () => {
    const receipts = await prisma.cpeCommandReceipt.count({
      where: { actorId: actor.id },
    });
    const events = await prisma.auditEvent.count({
      where: { actorId: actor.id, action: { startsWith: "cpe." } },
    });
    expect(receipts).toBeGreaterThan(10);
    expect(events).toBe(receipts);
  });
  it("does not borrow a capability from another organization or expose another owner's aggregates", async () => {
    const mixed: CpeActor = {
      ...actor,
      organizationIds: [org, "foreign-org"],
      permissions: ["cpe.sales.view", "cpe.sales.manage"],
      permissionsByOrganization: {
        [org]: ["cpe.sales.view"],
        "foreign-org": ["cpe.sales.manage"],
      },
    };
    await expect(
      execute(
        {
          type: "opportunity.stage",
          id: opportunityId,
          version: 6,
          stage: "ประมาณราคา",
        },
        mixed,
      ),
    ).rejects.toMatchObject({ status: 403 });
    const self: CpeActor = {
      ...actor,
      id: "another-actor",
      permissionsByOrganization: { [org]: actor.permissions },
      broadOrganizationsByPermission: {},
    };
    const data = await loadCpePage(self, "sales", parseCpeFilters({ org }));
    expect(data.rows).toEqual([]);
    expect(data.totals).toEqual([]);
    expect(data.weighted).toBeNull();
    expect(data.history).toEqual([]);
    const dashboard = await loadCpePage(self, "exec", parseCpeFilters({ org }));
    expect(dashboard.projectSummary).toEqual([]);
    expect(dashboard.monthly).toEqual([]);
  });
  it("propagates versioned master policy and rejects self-approval of an improvement", async () => {
    const configuration = structuredClone(DEFAULT_MASTER);
    configuration.workTypes[0].target = 25;
    configuration.workTypes[0].minimum = 20;
    await execute({ type: "master.save", version: 0, configuration });
    const page = await loadCpePage(
      actor,
      "knowledge",
      parseCpeFilters({ org }),
    );
    expect(page.masterVersion).toBe(1);
    expect(page.master.workTypes[0].minimum).toBe(20);
    await expect(
      execute({ type: "master.save", version: 0, configuration }),
    ).rejects.toMatchObject({ code: "P2002" });
    configuration.workTypes[0].minimum = 18;
    const id = await execute({
      type: "improvement.propose",
      title: "ทบทวนนโยบาย",
      reason: "ข้อมูลจริง",
      expectedEffect: "ปรับปรุงต้นทุน",
      masterVersion: 1,
      configuration,
    });
    await expect(
      execute({
        type: "improvement.decide",
        id,
        version: 1,
        approve: true,
        reason: "อนุมัติ",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (await prisma.cpeImprovement.findUniqueOrThrow({ where: { id } })).status,
    ).toBe("รอพิจารณา");
    const reviewerUser = await prisma.user.create({
      data: {
        email: `cpe-reviewer-${randomUUID()}@example.test`,
        name: "ผู้อนุมัติทดสอบ",
        passwordHash: await hash("Cpe-Test-Only-2026!", 4),
        role: "VIEWER",
      },
    });
    await prisma.userRoleAssignment.create({
      data: {
        userId: reviewerUser.id,
        organizationUnitId: org,
        roleCode: "EXECUTIVE",
        scopeCode: "ORG_UNIT",
        effectiveFrom: new Date("2020-01-01T00:00:00Z"),
      },
    });
    await execute(
      {
        type: "improvement.decide",
        id,
        version: 1,
        approve: true,
        reason: "เห็นชอบจากข้อมูลจริง",
      },
      { ...actor, id: reviewerUser.id, permissions: CPE_ROLE_GRANTS.EXECUTIVE },
    );
    const revised = await loadCpePage(
      actor,
      "knowledge",
      parseCpeFilters({ org }),
    );
    expect(revised.masterVersion).toBe(2);
    expect(revised.master.workTypes[0].minimum).toBe(18);
    const financeId = await execute({
      type: "finance.create",
      kind: "ลูกหนี้",
      name: "กำหนดชำระทดสอบ",
      amount: "1000",
      dueAt: "2026-10-01",
      projectId,
    });
    const cash = await loadCpePage(actor, "cash", parseCpeFilters({ org }));
    expect(
      cash.aging.some((a) => a.kind === "ลูกหนี้" && a.amount === "1000"),
    ).toBe(true);
    const ownCash = await loadCpePage(
      {
        ...actor,
        id: "another-actor",
        permissionsByOrganization: { [org]: actor.permissions },
        broadOrganizationsByPermission: {},
      },
      "cash",
      parseCpeFilters({ org }),
    );
    expect(ownCash.total).toBe(0);
    expect(ownCash.aging).toEqual([]);
    await execute({ type: "finance.settle", id: financeId, version: 1 });
    const settled = await loadCpePage(actor, "cash", parseCpeFilters({ org }));
    expect(settled.currentCash).toBe(cash.currentCash);
    expect(settled.aging).toEqual([]);
  });
});
