// Explicit opt-in development fixtures. Never imported by application read paths.
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import fixture from "../../../prisma/fixtures/cpe-demo.json";
import {
  DEFAULT_MASTER,
  DOCUMENTS,
  OPPORTUNITY_STATUS as OS,
  PROJECT_STATUS as PS,
  RFQ_STATUS as RS,
  STAGES,
} from "../config";
import {
  D,
  bidPrice,
  boqCost,
  money,
  sum,
  weightedVendorScore,
} from "../calculations";

export const DEMO_NAMESPACE = "cpe-demo-v1";
export const DEMO_LABEL =
  "ข้อมูลตัวอย่างจากต้นแบบ CPE — ไม่ใช่รายการธุรกิจจริง";
export const demoId = (namespace: string, kind: string, key: string) =>
  "cpe_demo_" +
  createHash("sha256")
    .update(`${namespace}:${kind}:${key}`)
    .digest("hex")
    .slice(0, 28);
export type DemoBindings = {
  organizationId: string;
  salesId: string;
  estimatorId: string;
  pmId: string;
  executiveId: string;
  actorId: string;
};
type SourceOpp = {
  id: string;
  name: string;
  cust: string;
  sector: string;
  wt: string;
  bid: number;
  cost: number;
  stage: string;
  status: string;
  prob: number;
  owner: string;
  est: string;
  due: string;
  area: string;
  dur: number;
  note: string;
  winner: string;
  gap: number;
};
type SourceBoq = {
  cat: string;
  code: string;
  d: string;
  u: string;
  q: number;
  mat: number;
  lab: number;
  src: string;
  vol: string;
};
type SourceCatalog = {
  code: string;
  n: string;
  u: string;
  cur: number;
  prev: number;
  y: number[];
  fc: number;
  vola: string;
  src: string;
  upd: string;
  cat: string;
};
type SourceVendor = {
  code: string;
  n: string;
  type: string;
  grade: string;
  jobs: number;
  val: number;
  s: { q: number; t: number; sf: number; pr: number; dc: number };
  status: string;
  last: string;
};
type SourceRfq = {
  id: string;
  prj: string;
  prjn: string;
  pkg: string;
  budget: number;
  need: string;
  status: string;
  buyer: string;
  docs: Record<string, number>;
  quotes: {
    v: string;
    n: string;
    p: number;
    days: number;
    term: string;
    valid: string;
    score: number;
    note: string;
  }[];
};
type SourceProject = {
  code: string;
  name: string;
  cust: string;
  wt: string;
  sector: string;
  value: number;
  budget: number;
  actual: number;
  commit: number;
  pm: string;
  start: string;
  end: string;
  plan: number[];
  act: number[];
  cursor: number;
  cin: number[];
  cout: number[];
  risks: { r: string; i: string; a: string }[];
};
type SourceRef = {
  code: string;
  n: string;
  yr: number;
  size: number;
  est: number;
  act: number;
  cats: Record<string, number>;
};
type History = [
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  number,
  number,
  number,
  number,
];
const source = fixture as unknown as {
  OPPS: SourceOpp[];
  BOQ: Record<string, SourceBoq[]>;
  CATALOG: SourceCatalog[];
  VENDORS: SourceVendor[];
  RFQS: SourceRfq[];
  PROJECTS: SourceProject[];
  SIZE: Record<string, { u: string; q: number }>;
  HB_RAW: History[];
  REFPRJ: Record<string, { u: string; prj: SourceRef[] }>;
  CASH: {
    open: number;
    credit: { limit: number };
    ar: { b: string; v: number }[];
    ap: { b: string; v: number }[];
  };
  LOSS: { r: string; n: number; pct: number }[];
  IMPROVE: { t: string; why: string; impact: string; st: string }[];
};
const catalogLinks: Record<string, string> = {
  "ST-002": "MAT-STL-010",
  "PV-001": "MAT-PV-006",
  "PV-002": "MAT-PV-012",
  "EE-001": "MAT-ELE-024",
  "FD-002": "MAT-CON-001",
  "SR-001": "MAT-STL-002",
  "SR-002": "MAT-STL-010",
  "AR-002": "MAT-ARC-018",
};
const days = (date: Date, delta: number) =>
  new Date(date.getTime() + delta * 86400000);
export function demoMonth(asOf: Date, delta: number) {
  return new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + delta, 1),
  );
}
export function allocateDemo(
  total: Prisma.Decimal.Value,
  weights: Prisma.Decimal.Value[],
) {
  if (!weights.length) return [];
  const denominator = sum(weights);
  if (denominator.lte(0))
    throw new Error("Allocation requires positive weights");
  let allocated = D(0);
  return weights.map((w, i) => {
    const value =
      i === weights.length - 1
        ? D(total).sub(allocated)
        : money(D(total).mul(w).div(denominator));
    allocated = allocated.add(value);
    return value;
  });
}
export function buildDemoData(
  bindings: DemoBindings,
  asOfInput: string,
  namespace = DEMO_NAMESPACE,
) {
  if (!/^cpe-demo-[a-zA-Z0-9-]{1,60}$/.test(namespace))
    throw new Error("Invalid demo namespace");
  const asOf = new Date(asOfInput + "T00:00:00Z");
  if (
    !Number.isFinite(asOf.getTime()) ||
    asOf.toISOString().slice(0, 10) !== asOfInput
  )
    throw new Error("Invalid demo date");
  const id = (kind: string, key: string) => demoId(namespace, kind, key);
  const prefix =
    namespace === DEMO_NAMESPACE
      ? "DEMO-"
      : `DEMO-${createHash("sha256").update(namespace).digest("hex").slice(0, 6)}-`;
  const code = (value: string) => prefix + value;
  const master = structuredClone(DEFAULT_MASTER);
  master.workTypes.find((w) => w.name === "งานโยธา")!.risk = 8;
  master.units = [
    ...new Set([
      ...master.units,
      ...Object.values(source.SIZE).map((s) => s.u),
      ...source.HB_RAW.map((h) => h[5]),
    ]),
  ];
  master.finance = {
    openingCash: D(source.CASH.open).mul(1e6).toFixed(4),
    creditLimit: D(source.CASH.credit.limit).mul(1e6).toFixed(4),
  };
  const opportunities: Prisma.CpeOpportunityCreateManyInput[] = [];
  const boqItems: Prisma.CpeBoqItemCreateManyInput[] = [];
  const catalogItems: Prisma.CpeCatalogItemCreateManyInput[] = [];
  const prices: Prisma.CpePriceHistoryCreateManyInput[] = [];
  const vendors: Prisma.CpeVendorCreateManyInput[] = [];
  const rfqs: Prisma.CpeRfqCreateManyInput[] = [];
  const quotes: Prisma.CpeVendorQuoteCreateManyInput[] = [];
  const projects: Prisma.CpeProjectCreateManyInput[] = [];
  const months: Prisma.CpeProjectMonthCreateManyInput[] = [];
  const finance: Prisma.CpeFinanceEntryCreateManyInput[] = [];
  const improvements: Prisma.CpeImprovementCreateManyInput[] = [];
  const oppFor = (key: string) =>
    opportunities.find((o) => o.id === id("opportunity", key))!;
  function addOpportunity(
    key: string,
    name: string,
    customer: string,
    workType: string,
    sector: string,
    unit: string,
    quantity: Prisma.Decimal.Value,
    cost: Prisma.Decimal.Value,
    bid: Prisma.Decimal.Value,
    status: string,
    stage: string,
    due: Date,
    notes = "",
  ) {
    const row: Prisma.CpeOpportunityCreateManyInput = {
      id: id("opportunity", key),
      code: code(key),
      name,
      customer,
      workType,
      sector,
      organizationUnitId: bindings.organizationId,
      ownerId: bindings.salesId,
      estimatorId: bindings.estimatorId,
      location: "ข้อมูลสถานที่ตัวอย่าง",
      unit,
      quantity: D(quantity),
      cost: D(cost),
      bid: D(bid),
      margin: money(D(bid).sub(cost).div(bid).mul(100)),
      status,
      stage: STAGES.some((s) => s === stage) ? stage : STAGES[2],
      dueAt: due,
      technicalNotes: `${DEMO_LABEL}\n${notes}`,
      contractNotes: "เงื่อนไขประกอบการทดสอบเท่านั้น",
      createdAt: days(asOf, -30),
      updatedAt: asOf,
      version: 1,
    };
    opportunities.push(row);
    return row;
  }
  for (const v of source.VENDORS) {
    const scores = {
      quality: v.s.q,
      time: v.s.t,
      safety: v.s.sf,
      price: v.s.pr,
      documents: v.s.dc,
    };
    const graded = weightedVendorScore(scores, master);
    const workType = v.type.includes("พลังงาน")
      ? "งานพลังงานทดแทน"
      : v.type.includes("เครื่องจักร")
        ? "งานเครื่องจักรอุตสาหกรรม"
        : v.type.includes("MEP")
          ? "งาน MEP"
          : v.type.includes("โยธา")
            ? "งานโยธา"
            : "งานก่อสร้าง";
    vendors.push({
      id: id("vendor", v.code),
      code: code(v.code),
      name: v.n,
      workType,
      organizationUnitId: bindings.organizationId,
      scores,
      score: graded.score,
      grade: graded.grade,
      suspended: v.status.includes("ระงับ"),
      updatedAt: asOf,
      version: 1,
    });
  }
  for (const c of source.CATALOG) {
    catalogItems.push({
      id: id("catalog", c.code),
      code: code(c.code),
      name: c.n,
      category: c.cat,
      unit: c.u,
      price: D(c.cur),
      forecastPercent: D(c.fc),
      volatility: c.vola,
      source: c.src,
      organizationUnitId: bindings.organizationId,
      updatedAt: asOf,
      version: 1,
    });
    c.y.forEach((price, i) =>
      prices.push({
        id: id("price", `${c.code}:${i}`),
        catalogId: id("catalog", c.code),
        price: D(price),
        source: `${DEMO_LABEL} · ${c.src}`,
        actorId: bindings.actorId,
        recordedAt: demoMonth(asOf, i - 5),
      }),
    );
    const sellerCodes =
      c.cat === "พลังงาน"
        ? ["V-008", "V-045", "V-027"]
        : c.cat === "คอนกรีต"
          ? ["V-003", "V-019", "V-066"]
          : ["V-014", "V-031", "V-052"];
    sellerCodes.forEach((v, i) =>
      prices.push({
        id: id("price", `${c.code}:vendor:${v}`),
        catalogId: id("catalog", c.code),
        price: money(D(c.cur).mul(["0.98", "1", "1.03"][i])),
        source: `ใบเสนอราคาตัวอย่าง ${v}`,
        vendorId: id("vendor", v),
        actorId: bindings.actorId,
        recordedAt: days(asOf, i - 2),
      }),
    );
  }
  source.OPPS.forEach((o, index) => {
    const size = source.SIZE[o.id];
    const row = addOpportunity(
      o.id,
      o.name,
      o.cust,
      o.wt,
      o.sector,
      size.u,
      size.q,
      o.cost,
      o.bid,
      o.status,
      o.stage,
      days(asOf, [-70, 16, 25, -95, -80, 35, 20, -110, 50, 30][index]),
      `ต้นฉบับ: ${o.owner} / ${o.est}\n${o.note}`,
    );
    row.location = o.area;
    if (o.status === OS.lost) {
      row.winner = o.winner;
      row.lossReason = o.note;
      row.winnerPrice = money(D(o.bid).mul(D(1).add(D(o.gap).div(100))));
      row.resultNotes = DEMO_LABEL;
    }
    if (o.status === OS.won) row.winner = "เรา";
    for (const item of source.BOQ[o.id] ?? []) {
      const linked = catalogLinks[item.code];
      const material = source.CATALOG.find((c) => c.code === linked);
      const convert = item.u === "ตัน" && material?.u === "กก.";
      boqItems.push({
        id: id("boq", `${o.id}:${item.code}`),
        opportunityId: row.id!,
        category: item.cat,
        code: item.code,
        description: item.d,
        unit: convert ? "กก." : item.u,
        quantity: D(item.q).mul(convert ? 1000 : 1),
        material: D(item.mat).div(convert ? 1000 : 1),
        labor: D(item.lab).div(convert ? 1000 : 1),
        source: item.src,
        ...(material && (convert || material.u === item.u)
          ? { catalogId: id("catalog", material.code) }
          : {}),
      });
    }
    const items = boqItems.filter((i) => i.opportunityId === row.id);
    if (items.length && row.status === OS.active) {
      row.cost = boqCost(
        items as {
          quantity: Prisma.Decimal;
          material: Prisma.Decimal;
          labor: Prisma.Decimal;
        }[],
        master.workTypes.find((w) => w.name === o.wt)!,
      );
      row.margin = money(D(o.bid).sub(String(row.cost)).div(o.bid).mul(100));
      row.reviewedById = bindings.estimatorId;
      row.reviewedAt = days(asOf, -2);
    }
  });
  source.HB_RAW.forEach((h, index) => {
    const cost = D(h[6]).mul(h[7]);
    const bid = bidPrice(cost, h[8]);
    const row = addOpportunity(
      h[0],
      h[1],
      `ลูกค้าตัวอย่างงานย้อนหลัง ${h[0]}`,
      h[2],
      h[3],
      h[5],
      h[6],
      cost,
      bid,
      h[9] ? OS.won : OS.lost,
      h[9] ? STAGES.at(-1)! : STAGES[2],
      demoMonth(asOf, -12 - (index % 24)),
      `ประวัติประมูลตัวอย่างปี ${h[4]} · ราคาเทียบคู่แข่ง ${h[10]}%`,
    );
    row.updatedAt = demoMonth(asOf, -12 - (index % 24));
    row.createdAt = days(row.updatedAt, -5);
    row.winner = h[9] ? "เรา" : "ผู้ชนะประมูลตัวอย่าง";
    if (!h[9]) {
      row.lossReason = source.LOSS[index % source.LOSS.length].r;
      row.winnerPrice = money(bid.mul(D(1).sub(D(h[10]).div(100))));
    }
  });
  const refMap = new Map<
    string,
    { workType: string; unit: string; ref: SourceRef }
  >();
  for (const [workType, group] of Object.entries(source.REFPRJ))
    for (const ref of group.prj)
      refMap.set(ref.code, { workType, unit: group.u, ref });
  const award = (
    key: string,
    opp: Prisma.CpeOpportunityCreateManyInput,
    name: string,
    category: string,
    amount: Prisma.Decimal.Value,
    vendorCode: string,
    awarded: boolean,
    documents: readonly string[] = DOCUMENTS,
  ) => {
    const rid = id("rfq", key),
      qid = id("quote", `${key}:${vendorCode}`);
    rfqs.push({
      id: rid,
      code: code(key),
      opportunityId: opp.id!,
      name,
      category,
      budget: D(amount),
      needAt: days(asOf, 14),
      documents: [...documents],
      status: awarded ? RS.awarded : RS.comparing,
      ...(awarded ? { awardedQuoteId: qid, poNumber: code("PO-" + key) } : {}),
      createdAt: days(asOf, -5),
      version: 1,
    });
    quotes.push({
      id: qid,
      rfqId: rid,
      vendorId: id("vendor", vendorCode),
      price: D(amount),
      days: 30,
      paymentTerms: "เครดิต 30 วัน (ตัวอย่าง)",
      validityDays: 30,
      notes: DEMO_LABEL,
      createdAt: days(asOf, -2),
    });
    return rid;
  };
  for (const r of source.RFQS) {
    const o = oppFor(r.prj);
    const rid = id("rfq", r.id);
    const docs = DOCUMENTS.filter(
      (_, i) => r.docs[["boq", "tor", "dwg", "spec", "safety"][i]] === 1,
    );
    const awarded = r.status === RS.awarded;
    rfqs.push({
      id: rid,
      code: code(r.id),
      opportunityId: o.id!,
      name: r.pkg,
      category: `แพ็กเกจ ${r.id}`,
      budget: D(r.budget),
      needAt: days(asOf, Number(r.need.slice(-2))),
      documents: docs,
      status: Object.values(RS).some((s) => s === r.status)
        ? r.status
        : RS.quoting,
      ...(awarded
        ? {
            awardedQuoteId: id("quote", `${r.id}:${r.quotes[0].v}`),
            poNumber: code("PO-" + r.id),
          }
        : {}),
      createdAt: days(asOf, -10),
      version: 1,
    });
    r.quotes.forEach((q, index) =>
      quotes.push({
        id: id("quote", `${r.id}:${q.v}`),
        rfqId: rid,
        vendorId: id("vendor", q.v),
        price: D(q.p),
        days: q.days,
        paymentTerms: q.term,
        validityDays: Number.parseInt(q.valid, 10),
        notes: q.note,
        createdAt: days(asOf, -(index + 1)),
      }),
    );
  }
  function addProject(
    key: string,
    opp: Prisma.CpeOpportunityCreateManyInput,
    value: Prisma.Decimal.Value,
    budget: Prisma.Decimal.Value,
    actual: Prisma.Decimal.Value,
    plans: number[],
    actuals: number[],
    cursor: number,
    cashIns: Prisma.Decimal.Value[],
    cashOuts: Prisma.Decimal.Value[],
    closed: boolean,
    categories?: Record<string, Prisma.Decimal.Value>,
    risks = "",
  ) {
    const pid = id("project", key);
    const duration = plans.length;
    const start = demoMonth(asOf, closed ? -duration : -cursor);
    opp.createdAt = days(start, -30);
    if (closed) opp.updatedAt = days(demoMonth(asOf, 0), -1);
    const paid = allocateDemo(actual, cashOuts.slice(0, cursor + 1));
    const actualCategories = closed
      ? Object.fromEntries(
          (() => {
            const entries = Object.entries(categories ?? { งานรวม: actual });
            const allocated = allocateDemo(
              actual,
              entries.map(([, v]) => v),
            );
            return entries.map(([k], i) => [k, allocated[i].toFixed(4)]);
          })(),
        )
      : undefined;
    projects.push({
      id: pid,
      code: code(key),
      opportunityId: opp.id!,
      contractNumber: code("CT-" + key),
      contractValue: D(value),
      budget: D(budget),
      pmId: bindings.pmId,
      startAt: start,
      durationMonths: duration,
      status: closed ? PS.closed : PS.active,
      risks: risks || DEMO_LABEL,
      ...(closed
        ? { closedAt: days(demoMonth(asOf, 0), -1), actualCategories }
        : {}),
      version: 1,
    });
    for (let i = 0; i < duration; i++)
      months.push({
        id: id("month", `${key}:${i + 1}`),
        projectId: pid,
        month: i + 1,
        plannedPercent: D(plans[i]),
        actualPercent: i <= cursor ? D(actuals[i]) : null,
        cashIn: i <= cursor ? D(cashIns[i] ?? 0) : D(0),
        cashOut: i <= cursor ? paid[i] : D(0),
        forecastIn: i > cursor ? D(cashIns[i] ?? 0) : D(0),
        forecastOut: i > cursor ? D(cashOuts[i] ?? 0) : D(0),
        poPayments: {},
        paidPo: D(0),
      });
    return pid;
  }
  source.PROJECTS.forEach((p) => {
    const key =
      p.code === "PRJ-2601"
        ? "OPP-68-014"
        : p.code === "PRJ-2602"
          ? "OPP-68-033"
          : `OPP-${p.code}`;
    const ref = refMap.get(p.code);
    const size = ref
      ? { q: ref.ref.size, u: ref.unit }
      : p.code === "PRJ-2595"
        ? { q: 5400, u: "ตร.ม." }
        : source.SIZE[key];
    const opp =
      opportunities.find((o) => o.id === id("opportunity", key)) ??
      addOpportunity(
        key,
        p.name,
        p.cust,
        p.wt,
        p.sector,
        size.u,
        size.q,
        p.budget,
        p.value,
        OS.won,
        STAGES.at(-1)!,
        days(asOf, -120),
      );
    opp.cost = D(p.budget);
    opp.bid = D(p.value);
    opp.margin = money(D(p.value).sub(p.budget).div(p.value).mul(100));
    opp.winner = "เรา";
    const closed = p.act[p.cursor] === 100;
    addProject(
      p.code,
      opp,
      p.value,
      p.budget,
      p.actual,
      p.plan,
      p.act,
      p.cursor,
      p.cin.map((v) => D(v).mul(1000)),
      p.cout.map((v) => D(v).mul(1000)),
      closed,
      ref?.ref.cats,
      p.risks.map((r) => `${r.r} (${r.i}) — ${r.a}`).join("\n"),
    );
    if (p.commit > 0) {
      const existing = sum(
        rfqs
          .filter((r) => r.opportunityId === opp.id && r.awardedQuoteId)
          .map((r) => quotes.find((q) => q.id === r.awardedQuoteId)!.price)
          .map(String),
      );
      const remainder = D(p.commit).sub(existing);
      if (remainder.gt(0))
        award(
          `RFQ-COMMIT-${p.code}`,
          opp,
          "งานจัดซื้อที่ผูกพันเพิ่มเติม (ตัวอย่าง)",
          `ภาระผูกพัน ${p.code}`,
          remainder,
          p.wt.includes("เครื่องจักร")
            ? "V-027"
            : p.wt.includes("MEP")
              ? "V-088"
              : "V-014",
          true,
        );
    }
  });
  for (const [refCode, { workType, unit, ref }] of refMap) {
    if (projects.some((p) => p.id === id("project", refCode))) continue;
    const estimated = D(ref.est).mul(ref.size),
      actual = D(ref.act).mul(ref.size);
    const margin = master.workTypes.find((w) => w.name === workType)!.target;
    const bid = bidPrice(estimated, margin);
    const opp = addOpportunity(
      `OPP-${refCode}`,
      ref.n,
      "ลูกค้าตัวอย่างงานอ้างอิง",
      workType,
      master.sectors[0].name,
      unit,
      ref.size,
      estimated,
      bid,
      OS.won,
      STAGES.at(-1)!,
      demoMonth(asOf, -8),
      "โครงการปิดงานสำหรับตรวจต้นทุนจากต้นแบบ",
    );
    opp.winner = "เรา";
    opp.updatedAt = demoMonth(asOf, -1);
    const pid = addProject(
      refCode,
      opp,
      bid,
      estimated,
      actual,
      [10, 25, 45, 65, 82, 95, 100],
      [10, 24, 43, 66, 84, 96, 100],
      6,
      allocateDemo(bid, [1, 1, 1, 1, 1, 1, 1]),
      allocateDemo(actual, [1, 1, 1, 1, 1, 1, 1]),
      true,
      ref.cats,
    );
    const rid = award(
      `RFQ-CLOSED-${refCode}`,
      opp,
      "ผลงานจัดซื้อโครงการอ้างอิง",
      "งานรวมตามสัญญา",
      actual,
      workType.includes("พลังงาน") ? "V-008" : "V-014",
      true,
    );
    const referenceProject = projects.find((p) => p.id === pid)!;
    rfqs.find((r) => r.id === rid)!.createdAt = days(
      referenceProject.startAt as Date,
      -20,
    );
    rfqs.find((r) => r.id === rid)!.needAt = referenceProject.startAt;
    quotes.find((q) => q.rfqId === rid)!.createdAt = days(
      referenceProject.startAt as Date,
      -15,
    );
    for (const month of months.filter((m) => m.projectId === pid)) {
      month.poPayments = { [rid]: D(String(month.cashOut!)).toFixed(4) };
      month.paidPo = month.cashOut;
    }
  }
  for (const [kind, entries, offsets] of [
    ["ลูกหนี้", source.CASH.ar, [14, -15, -45, -100]],
    ["เจ้าหนี้", source.CASH.ap, [5, 21, 45]],
  ] as const)
    entries.forEach((e, i) =>
      finance.push({
        id: id("finance", `${kind}:${i}`),
        organizationUnitId: bindings.organizationId,
        createdById: bindings.salesId,
        kind,
        name: `${e.b} · ข้อมูลตัวอย่าง`,
        amount: D(e.v).mul(1e6),
        dueAt: days(asOf, offsets[i]),
        version: 1,
      }),
    );
  source.IMPROVE.forEach((p, index) => {
    if (index !== 0 && index !== 3) return;
    const configuration = structuredClone(master);
    if (index === 0)
      configuration.workTypes.find((w) => w.name === "งานโยธา")!.risk = 5;
    else if (index === 3) configuration.purchasing.lowScore = 80;
    else configuration.tolerance.category = 7;
    improvements.push({
      id: id("improvement", String(index)),
      organizationUnitId: bindings.organizationId,
      title: p.t,
      reason: `${DEMO_LABEL}\n${p.why}`,
      expectedEffect: p.impact,
      proposedConfiguration: configuration as Prisma.InputJsonValue,
      masterVersion: 1,
      createdById: bindings.salesId,
      status: "รอพิจารณา",
      version: 1,
      createdAt: days(asOf, -index - 1),
    });
  });
  return {
    namespace,
    asOf: asOfInput,
    master,
    opportunities,
    boqItems,
    catalogItems,
    prices,
    vendors,
    rfqs,
    quotes,
    projects,
    months,
    finance,
    improvements,
  };
}
export type DemoData = ReturnType<typeof buildDemoData>;
