import { z } from "zod";
import { DOCUMENTS, STAGES, masterSchema } from "./config";
const id = z.string().min(1).max(191);
const text = z.string().trim().min(1).max(255);
const amount = z
  .string()
  .regex(/^\d{1,14}(\.\d{1,4})?$/, "จำนวนเงินไม่ถูกต้อง");
const positive = amount.refine((v) => Number(v) > 0, "ต้องมากกว่า 0");
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      Number.isFinite(Date.parse(v + "T00:00:00Z")) &&
      new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v,
    "วันที่ไม่ถูกต้อง",
  );
const base = { requestId: z.string().uuid(), organizationId: id };
const edit = { id, version: z.coerce.number().int().positive() };
const boqRow = z.object({
  category: text.max(100),
  code: text.max(64),
  description: text.max(500),
  unit: text.max(40),
  quantity: positive,
  material: amount,
  labor: amount,
  source: text,
  catalogId: id.optional(),
});
export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("opportunity.create"),
    name: text,
    customer: text,
    sector: text,
    workType: text,
    location: text,
    unit: text,
    quantity: positive,
    cost: positive,
    margin: z.coerce.number().min(0).lt(100),
    ownerId: id,
    estimatorId: id.optional(),
    dueAt: date,
    technicalNotes: z.string().max(10000).optional(),
    contractNotes: z.string().max(10000).optional(),
  }),
  z.object({
    ...base,
    ...edit,
    type: z.literal("opportunity.stage"),
    stage: z.enum(STAGES),
  }),
  z.object({
    ...base,
    ...edit,
    type: z.literal("opportunity.lost"),
    winner: text,
    winnerPrice: positive.optional(),
    lossReason: text,
    notes: z.string().max(10000).optional(),
  }),
  z.object({
    ...base,
    ...edit,
    type: z.literal("opportunity.won"),
    contractNumber: text.max(100),
    contractValue: positive,
    budget: positive,
    durationMonths: z.coerce.number().int().min(1).max(120),
    startAt: date,
    pmId: id,
    generateRfqs: z.boolean(),
  }),
  z.object({
    ...base,
    ...edit,
    type: z.literal("boq.save"),
    items: z
      .array(boqRow)
      .min(1)
      .max(300)
      .refine(
        (rows) => new Set(rows.map((r) => r.category)).size <= 40,
        "BOQ รองรับไม่เกิน 40 หมวดต่อโครงการ",
      ),
  }),
  z.object({
    ...base,
    ...edit,
    type: z.literal("boq.copy"),
    sourceId: id,
    scale: z.boolean(),
  }),
  z.object({ ...base, ...edit, type: z.literal("cost.approve") }),
  z.object({
    ...base,
    ...edit,
    type: z.literal("cost.reference"),
    category: text.max(100),
  }),
  z.object({
    ...base,
    ...edit,
    type: z.literal("bid.save"),
    margin: z.coerce.number().min(0).lt(100),
  }),
  z.object({
    ...base,
    type: z.literal("catalog.create"),
    code: text.max(64),
    name: text,
    category: text.max(100),
    unit: text.max(40),
    price: positive,
    forecastPercent: z.coerce.number().min(-99).max(1000),
    volatility: z.enum(["ต่ำ", "กลาง", "สูง", "สูงมาก"]),
    source: text,
  }),
  z.object({
    ...base,
    ...edit,
    type: z.literal("catalog.price"),
    price: positive,
    source: text,
    forecastPercent: z.coerce.number().min(-99).max(1000),
    vendorId: id.optional(),
  }),
  z.object({
    ...base,
    type: z.literal("vendor.create"),
    code: text.max(40),
    name: text,
    workType: text.max(100),
  }),
  z.object({
    ...base,
    ...edit,
    type: z.literal("vendor.evaluate"),
    scores: z.record(z.string(), z.coerce.number().min(0).max(100)),
    suspended: z.boolean(),
  }),
  z.object({ ...base, ...edit, type: z.literal("rfq.generate"), needAt: date }),
  z.object({
    ...base,
    ...edit,
    type: z.literal("rfq.documents"),
    documents: z
      .array(z.enum(DOCUMENTS))
      .max(5)
      .refine(
        (values) => new Set(values).size === values.length,
        "รายการเอกสารซ้ำ",
      ),
  }),
  z.object({
    ...base,
    ...edit,
    type: z.literal("rfq.quote"),
    vendorId: id,
    price: positive,
    days: z.coerce.number().int().min(1).max(3650),
    paymentTerms: text,
    validityDays: z.coerce.number().int().min(1).max(3650),
    notes: z.string().max(1000).optional(),
  }),
  z.object({ ...base, ...edit, type: z.literal("rfq.award"), quoteId: id }),
  z.object({
    ...base,
    ...edit,
    type: z.literal("project.month"),
    month: z.coerce.number().int().min(1).max(120),
    actualPercent: z.coerce.number().min(0).max(100),
    cashIn: amount,
    cashOut: amount,
    forecastIn: amount,
    forecastOut: amount,
    poPayments: z.record(z.string().max(191), amount).default({}),
    risks: z.string().max(10000).optional(),
  }),
  z.object({
    ...base,
    ...edit,
    type: z.literal("project.close"),
    actualCategories: z.record(z.string(), amount),
  }),
  z.object({
    ...base,
    type: z.literal("finance.create"),
    kind: z.enum(["ลูกหนี้", "เจ้าหนี้"]),
    name: text,
    amount: positive,
    dueAt: date,
    projectId: id.optional(),
  }),
  z.object({ ...base, ...edit, type: z.literal("finance.settle") }),
  z.object({
    ...base,
    type: z.literal("master.save"),
    version: z.coerce.number().int().min(0),
    configuration: masterSchema,
  }),
  z.object({
    ...base,
    type: z.literal("improvement.propose"),
    title: text,
    reason: text.max(1000),
    expectedEffect: text.max(1000),
    masterVersion: z.coerce.number().int().min(0),
    configuration: masterSchema,
  }),
  z.object({
    ...base,
    ...edit,
    type: z.literal("improvement.decide"),
    approve: z.boolean(),
    reason: text.max(1000),
  }),
]);
export type Command = z.infer<typeof commandSchema>;
export const COMMAND_PERMISSIONS: Record<Command["type"], string> = {
  "opportunity.create": "cpe.sales.manage",
  "opportunity.stage": "cpe.sales.manage",
  "opportunity.won": "cpe.sales.manage",
  "opportunity.lost": "cpe.sales.manage",
  "boq.save": "cpe.estimate.manage",
  "boq.copy": "cpe.estimate.manage",
  "cost.approve": "cpe.costcheck.approve",
  "cost.reference": "cpe.estimate.manage",
  "bid.save": "cpe.bidsim.manage",
  "catalog.create": "cpe.catalog.manage",
  "catalog.price": "cpe.catalog.manage",
  "vendor.create": "cpe.vendors.manage",
  "vendor.evaluate": "cpe.vendors.manage",
  "rfq.generate": "cpe.procurement.manage",
  "rfq.documents": "cpe.procurement.manage",
  "rfq.quote": "cpe.procurement.manage",
  "rfq.award": "cpe.procurement.award",
  "project.month": "cpe.projects.manage",
  "project.close": "cpe.projects.manage",
  "finance.create": "cpe.cash.manage",
  "finance.settle": "cpe.cash.manage",
  "master.save": "cpe.master.manage",
  "improvement.propose": "cpe.improvement.propose",
  "improvement.decide": "cpe.improvement.decide",
};
