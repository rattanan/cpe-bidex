import { describe, expect, it } from "vitest";
import {
  buildDemoData,
  allocateDemo,
  DEMO_NAMESPACE,
} from "../../../lib/cpe/demo/data";
import {
  assertDemoSeedTarget,
  DEMO_ACCOUNTS,
} from "../../../lib/cpe/demo/seed";
import { D, sum, boqCost } from "../../../lib/cpe/calculations";
import {
  OPPORTUNITY_STATUS as OS,
  PROJECT_STATUS as PS,
  RFQ_STATUS as RS,
  STAGES,
} from "../../../lib/cpe/config";
const bindings = {
  organizationId: "demo-org",
  actorId: "actor",
  salesId: "sales",
  estimatorId: "estimator",
  pmId: "pm",
  executiveId: "executive",
};
const data = buildDemoData(bindings, "2026-11-05");
const n = (v: unknown) => String(v);
describe("explicit CPE prototype sample data", () => {
  it("covers every screen with relationally connected records and separate role accounts", () => {
    expect(data.opportunities).toHaveLength(44);
    expect(data.catalogItems).toHaveLength(14);
    expect(data.vendors).toHaveLength(12);
    expect(data.projects).toHaveLength(10);
    expect(data.projects.filter((p) => p.status === PS.active)).toHaveLength(3);
    expect(data.projects.filter((p) => p.status === PS.closed)).toHaveLength(7);
    expect(data.improvements).toHaveLength(2);
    expect(
      data.opportunities.every((o) => STAGES.some((s) => s === o.stage)),
    ).toBe(true);
    expect(
      data.rfqs.every((r) => Object.values(RS).some((s) => s === r.status)),
    ).toBe(true);
    expect(DEMO_ACCOUNTS).toHaveLength(6);
    expect(DEMO_ACCOUNTS.some((a) => a.roles.includes("ADMIN" as never))).toBe(
      false,
    );
    const opps = new Set(data.opportunities.map((o) => o.id)),
      vendors = new Set(data.vendors.map((v) => v.id)),
      catalog = new Set(data.catalogItems.map((c) => c.id)),
      projects = new Set(data.projects.map((p) => p.id)),
      rfqs = new Set(data.rfqs.map((r) => r.id));
    expect(
      data.opportunities.every(
        (o) =>
          o.organizationUnitId === bindings.organizationId &&
          o.code.startsWith("DEMO-"),
      ),
    ).toBe(true);
    expect(
      data.boqItems.every(
        (i) =>
          opps.has(i.opportunityId) &&
          (!i.catalogId || catalog.has(i.catalogId)),
      ),
    ).toBe(true);
    expect(data.projects.every((p) => opps.has(p.opportunityId))).toBe(true);
    expect(data.rfqs.every((r) => opps.has(r.opportunityId))).toBe(true);
    expect(
      data.quotes.every((q) => rfqs.has(q.rfqId) && vendors.has(q.vendorId)),
    ).toBe(true);
    expect(data.months.every((m) => projects.has(m.projectId))).toBe(true);
    expect(new Set(data.opportunities.map((o) => o.code)).size).toBe(
      data.opportunities.length,
    );
  });
  it("allocates source project actual costs exactly and never double counts PO commitments", () => {
    const expected = new Map([
      ["DEMO-PRJ-2601", ["19450000", "8900000"]],
      ["DEMO-PRJ-2602", ["14820000", "4300000"]],
      ["DEMO-PRJ-2595", ["8890000", "600000"]],
    ]);
    for (const p of data.projects) {
      const months = data.months.filter((m) => m.projectId === p.id);
      const paid = sum(months.map((m) => n(m.cashOut)));
      const awarded = data.rfqs.filter(
        (r) => r.opportunityId === p.opportunityId && r.awardedQuoteId,
      );
      const committed = sum(
        awarded.map((r) =>
          n(data.quotes.find((q) => q.id === r.awardedQuoteId)!.price),
        ),
      ).sub(sum(months.map((m) => n(m.paidPo))));
      expect(committed.gte(0)).toBe(true);
      expect(months).toHaveLength(p.durationMonths);
      expect(
        months.every((m) =>
          sum(Object.values(m.poPayments as Record<string, string>)).lte(
            n(m.cashOut),
          ),
        ),
      ).toBe(true);
      if (expected.has(p.code)) {
        const [actual, remaining] = expected.get(p.code)!;
        expect(paid.toString()).toBe(actual);
        expect(committed.toString()).toBe(remaining);
      }
      if (p.status === PS.closed) {
        expect(
          sum(Object.values(p.actualCategories as Record<string, string>)).eq(
            paid,
          ),
        ).toBe(true);
        expect(n(months.at(-1)!.actualPercent)).toBe("100");
        expect(committed.toString()).toBe("0");
      }
    }
  });
  it("uses the configured Decimal estimate formula and compatible catalog units", () => {
    const solar = data.opportunities.find((o) => o.code === "DEMO-OPP-68-027")!;
    expect(solar.status).toBe(OS.active);
    const policy = data.master.workTypes.find(
      (p) => p.name === solar.workType,
    )!;
    expect(
      boqCost(
        data.boqItems
          .filter((i) => i.opportunityId === solar.id)
          .map((i) => ({
            quantity: n(i.quantity),
            material: n(i.material),
            labor: n(i.labor),
          })),
        policy,
      ).eq(n(solar.cost)),
    ).toBe(true);
    for (const row of data.boqItems.filter((i) => i.catalogId)) {
      expect(row.unit).toBe(
        data.catalogItems.find((c) => c.id === row.catalogId)!.unit,
      );
    }
    expect(allocateDemo("1", [1, 1, 1]).map(String)).toEqual([
      "0.3333",
      "0.3333",
      "0.3334",
    ]);
    expect(() => allocateDemo("1", [0, 0])).toThrow();
  });
  it("keeps price history dated, proposals pending, and balances in database-compatible decimals", () => {
    for (const c of data.catalogItems) {
      const history = data.prices.filter((p) => p.catalogId === c.id);
      expect(history).toHaveLength(9);
      expect(history.filter((h) => !h.vendorId)).toHaveLength(6);
      expect(
        history.every(
          (h) =>
            h.recordedAt instanceof Date &&
            h.recordedAt <= new Date("2026-11-05T00:00:00Z"),
        ),
      ).toBe(true);
      expect(D(n(c.price)).gt(0)).toBe(true);
    }
    expect(
      data.improvements.every(
        (p) => p.status === "รอพิจารณา" && !p.decidedById,
      ),
    ).toBe(true);
    const proposal = data.improvements[0]
      .proposedConfiguration as unknown as typeof data.master;
    expect(data.master.workTypes.find((w) => w.name === "งานโยธา")!.risk).toBe(
      8,
    );
    expect(proposal.workTypes.find((w) => w.name === "งานโยธา")!.risk).toBe(5);
    expect(data.master.finance.creditLimit).toBe("60000000.0000");
  });
  it("generates deterministic IDs without overwriting another dataset namespace", () => {
    expect(
      buildDemoData(bindings, "2026-11-05").opportunities.map((o) => o.id),
    ).toEqual(data.opportunities.map((o) => o.id));
    expect(
      buildDemoData(bindings, "2026-12-05").opportunities.map((o) => o.id),
    ).toEqual(data.opportunities.map((o) => o.id));
    const other = buildDemoData(
      bindings,
      "2026-11-05",
      DEMO_NAMESPACE + "-other",
    );
    expect(other.opportunities[0].id).not.toBe(data.opportunities[0].id);
    expect(other.opportunities[0].code).not.toBe(data.opportunities[0].code);
    expect(() => buildDemoData(bindings, "2026-02-30")).toThrow();
    expect(() => buildDemoData(bindings, "2026-11-05", "production")).toThrow();
  });
  it("requires explicit opt-in and rejects production or an unrelated host", () => {
    const safe = {
      url: "mysql://user:synthetic@127.0.0.1:33316/cpe_bidex_test_demo",
      target: "local",
      cwd: "/tmp/demo",
      optIn: "1",
    };
    expect(assertDemoSeedTarget(safe).database).toBe("cpe_bidex_test_demo");
    for (const input of [
      { ...safe, optIn: undefined },
      { ...safe, url: "mysql://user:synthetic@127.0.0.1/production_dev" },
      { ...safe, url: "mysql://user:synthetic@remote.example/cpe_dev" },
      { ...safe, target: "production" },
      { ...safe, target: "ntop-dev" },
    ])
      expect(() => assertDemoSeedTarget(input)).toThrow();
  });
  it("allows the owner-confirmed CPE target only with its exact path and local database", () => {
    const approved = {
      url: "mysql://user:synthetic@localhost/cpe_bidex",
      target: "cpe-bidex",
      cwd: "/opt/apps/cpe-bidex",
      optIn: "1",
    };
    expect(assertDemoSeedTarget(approved).database).toBe("cpe_bidex");
    for (const input of [
      { ...approved, cwd: "/opt/apps/ntop-dev" },
      { ...approved, url: "mysql://user:synthetic@localhost/ntop" },
      { ...approved, url: "mysql://user:synthetic@remote.example/cpe_bidex" },
      { ...approved, target: "local" },
      { ...approved, optIn: undefined },
    ])
      expect(() => assertDemoSeedTarget(input)).toThrow();
  });
});
