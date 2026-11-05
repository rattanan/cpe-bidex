import { describe, expect, it } from "vitest";
import {
  bidPrice,
  boqCost,
  costBand,
  D,
  sCurve,
  scaleQuantity,
  weightedVendorScore,
  winProbability,
} from "../../../lib/cpe/calculations";
import {
  DEFAULT_MASTER,
  CPE_ROLE_GRANTS,
  DOCUMENTS,
  PROCESS,
  SCREENS,
  masterSchema,
} from "../../../lib/cpe/config";
import { commandSchema } from "../../../lib/cpe/commands";
import { parseCpeFilters } from "../../../lib/cpe/query";
import { visibleCpeNavigation } from "../../../components/cpe/navigation";
import {
  assertCpeOrganization,
  assertCpePermission,
} from "../../../lib/cpe/access";

describe("CPE construction domain", () => {
  it("uses Decimal for money, gross margin and quantity totals", () => {
    expect(bidPrice("100", "20").toString()).toBe("125");
    expect(
      boqCost([{ quantity: "3", material: "0.1", labor: "0.2" }], {
        overhead: 0,
        risk: 0,
      }).toString(),
    ).toBe("0.9");
    expect(
      boqCost(
        [{ quantity: "10", material: "100", labor: "10" }],
        DEFAULT_MASTER.workTypes[0],
      ).toString(),
    ).toBe("1199");
    expect(() => bidPrice("100", 100)).toThrow();
    expect(() => bidPrice("0", 15)).toThrow();
  });
  it("copies quantities only when project size units match", () => {
    expect(scaleQuantity("20", "100", "250", "ตร.ม.", "ตร.ม.").toString()).toBe(
      "50",
    );
    expect(() => scaleQuantity("20", "100", "250", "ตร.ม.", "Wp")).toThrow();
    expect(() => scaleQuantity("20", "0", "250", "Wp", "Wp")).toThrow();
  });
  it("evaluates five dimensions with configured weights and grade thresholds", () => {
    expect(
      weightedVendorScore(
        { quality: 100, time: 80, safety: 90, price: 70, documents: 100 },
        DEFAULT_MASTER,
      ),
    ).toEqual({ score: D(87), grade: "A" });
    expect(() =>
      weightedVendorScore({ quality: 101 }, DEFAULT_MASTER),
    ).toThrow();
    const invalid = structuredClone(DEFAULT_MASTER);
    invalid.dimensions[0].weight = 50;
    expect(masterSchema.safeParse(invalid).success).toBe(false);
    const duplicate = structuredClone(DEFAULT_MASTER);
    duplicate.units.push(duplicate.units[0]);
    expect(masterSchema.safeParse(duplicate).success).toBe(false);
  });
  it("classifies cost using configured tolerances and requires reference values", () => {
    expect(costBand("100", "0", 8).label).toBe("ไม่มีค่าอ้างอิง");
    expect(costBand("109", "100", 8).label).toBe("สูงกว่าอ้างอิง");
    expect(costBand("91", "100", 8).label).toBe("ต่ำผิดปกติ");
    expect(costBand("108", "100", 8).label).toBe("อยู่ในกรอบ");
  });
  it("does not invent probability without observed outcomes and returns a monotonic model", () => {
    expect(winProbability(15, [], 0)).toBeNull();
    const history = [
      { margin: "15", won: true },
      { margin: "20", won: false },
    ];
    expect(winProbability(12, history, 0)!).toBeGreaterThan(
      winProbability(22, history, 0)!,
    );
    expect(winProbability(15, history, 0)).toBe(
      winProbability(
        15,
        { count: 2, wins: 1, winningAverage: 15, losingAverage: 20 },
        0,
      ),
    );
  });
  it("builds a bounded monotonic S-Curve ending at 100%", () => {
    const curve = sCurve(12).map(Number);
    expect(curve).toHaveLength(12);
    expect(curve.at(-1)).toBe(100);
    expect(curve.every((v, i) => i === 0 || v >= curve[i - 1])).toBe(true);
    expect(() => sCurve(121)).toThrow();
  });
  it("validates dates, positive prices and scoring before mutation", () => {
    const base = {
      requestId: crypto.randomUUID(),
      organizationId: "org",
      type: "catalog.price",
      id: "material",
      version: 1,
      price: "10.25",
      source: "ผู้ขาย",
      forecastPercent: 3,
    };
    expect(commandSchema.safeParse(base).success).toBe(true);
    expect(commandSchema.safeParse({ ...base, price: "-1" }).success).toBe(
      false,
    );
    expect(commandSchema.safeParse({ ...base, price: "NaN" }).success).toBe(
      false,
    );
    expect(
      commandSchema.safeParse({
        requestId: crypto.randomUUID(),
        organizationId: "org",
        type: "finance.create",
        kind: "ลูกหนี้",
        name: "งาน",
        amount: "100",
        dueAt: "2026-02-30",
      }).success,
    ).toBe(false);
  });
  it("enforces screen grants and organization scope independently of menu hiding", () => {
    const actor = {
      id: "one",
      name: "ทดสอบ",
      organizationIds: ["org-one"],
      permissions: ["cpe.sales.view"],
    };
    expect(() => assertCpePermission(actor, "cpe.procurement.award")).toThrow();
    expect(() => assertCpeOrganization(actor, "org-two")).toThrow();
    expect(() => assertCpeOrganization(actor, "org-one")).not.toThrow();
    expect(visibleCpeNavigation([])).toEqual([]);
    const routes = visibleCpeNavigation(
      CPE_ROLE_GRANTS.PROJECT_MANAGER,
    ).flatMap((g) => g.items.map((i) => i.href));
    expect(routes).toEqual(["/cpe/vendors", "/cpe/projects", "/cpe/cash"]);
    expect(
      visibleCpeNavigation(CPE_ROLE_GRANTS.ADMIN)
        .flatMap((g) => g.items)
        .filter((i) => i.href.startsWith("/cpe/")),
    ).toHaveLength(12);
    expect(routes).not.toContain("/prospects");
  });
  it("has twelve screens, nine process stations and five document requirements", () => {
    expect(SCREENS).toHaveLength(12);
    expect(PROCESS).toHaveLength(9);
    expect(DOCUMENTS).toHaveLength(5);
    expect(CPE_ROLE_GRANTS.KAM).not.toContain("cpe.procurement.award");
    expect(CPE_ROLE_GRANTS.PROCUREMENT).not.toContain("cpe.improvement.decide");
  });
  it("bounds list input and allowlists sort and direction", () => {
    const f = parseCpeFilters({
      q: "x".repeat(300),
      page: "-10",
      sort: "DROP TABLE",
      order: "invalid",
    });
    expect(f.q).toHaveLength(100);
    expect(f.page).toBe(1);
    expect(f.sort).toBe("code");
    expect(f.order).toBe("asc");
    expect(parseCpeFilters({ page: "Infinity" }).page).toBe(1);
    expect(parseCpeFilters({ page: "10000000" }).page).toBe(10000);
  });
});
