import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import {
  CpeError,
  assertCpeOrganization,
  assertCpePermission,
  cpeOpportunityScope,
  cpeFinanceScope,
  type CpeActor,
} from "./access";
import { COMMAND_PERMISSIONS, commandSchema, type Command } from "./commands";
import {
  DEFAULT_MASTER,
  OPPORTUNITY_STATUS as OS,
  PROJECT_STATUS as PS,
  RFQ_STATUS as RS,
  STAGES,
  DOCUMENTS,
  masterSchema,
  type Master,
} from "./config";
import {
  D,
  bidPrice,
  boqCost,
  money,
  sCurve,
  scaleQuantity,
  sum,
  weightedVendorScore,
} from "./calculations";
type Tx = Prisma.TransactionClient;
const audit = new AppendOnlyAuditWriter<Tx>({
  store: new HashChainedAuditStore({
    repository: new PrismaAuditLedgerRepository(),
    maxAttempts: 3,
  }),
});
const code = (prefix: string) =>
  `${prefix}-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
const utc = (value: string) => new Date(value + "T00:00:00Z");
export async function loadMaster(
  tx: Pick<Tx, "cpeMasterData">,
  organizationUnitId: string,
) {
  const row = await tx.cpeMasterData.findUnique({
    where: { organizationUnitId },
  });
  return {
    configuration: row
      ? masterSchema.parse(row.configuration)
      : structuredClone(DEFAULT_MASTER),
    version: row?.version ?? 0,
  };
}
function stale(count: number) {
  if (count !== 1) throw new CpeError("ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดใหม่", 409);
}
async function opportunity(
  tx: Tx,
  actor: CpeActor,
  id: string,
  organizationUnitId: string,
  permission: string,
) {
  const row = await tx.cpeOpportunity.findFirst({
    where: {
      id,
      ...cpeOpportunityScope(actor, permission, [organizationUnitId]),
    },
  });
  if (!row || row.organizationUnitId !== organizationUnitId)
    throw new CpeError("ไม่พบงาน", 404);
  return row;
}
async function assignedUser(
  tx: Tx,
  userId: string,
  organizationUnitId: string,
  capability: string,
) {
  const roles = await tx.rolePermissionGrant.findMany({
    where: { permissionCode: capability },
    select: { roleCode: true },
  });
  const user = await tx.userRoleAssignment.findFirst({
    where: {
      userId,
      organizationUnitId,
      roleCode: { in: roles.map((r) => r.roleCode) },
      active: true,
      effectiveFrom: { lte: new Date() },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
      user: { active: true },
      organizationUnit: { active: true },
    },
  });
  if (!user)
    throw new CpeError("ผู้รับผิดชอบต้องได้รับมอบหมายในหน่วยงานของงาน");
}
function policy(master: Master, workType: string) {
  const p = master.workTypes.find((x) => x.name === workType);
  if (!p) throw new CpeError("ไม่พบประเภทงานใน Data Master");
  return p;
}
async function reviseOpportunity(
  tx: Tx,
  id: string,
  version: number,
  data: Prisma.CpeOpportunityUpdateManyMutationInput,
) {
  stale(
    (
      await tx.cpeOpportunity.updateMany({
        where: { id, version, status: OS.active },
        data: { ...data, version: { increment: 1 } },
      })
    ).count,
  );
}
async function recalc(tx: Tx, id: string, master: Master) {
  const o = await tx.cpeOpportunity.findUniqueOrThrow({ where: { id } });
  const items = await tx.cpeBoqItem.findMany({
    where: { opportunityId: id },
    take: 301,
  });
  if (items.length > 300) throw new CpeError("BOQ เกินขนาดที่รองรับ");
  const cost = boqCost(items, policy(master, o.workType));
  if (cost.lte(0)) throw new CpeError("BOQ ต้องมีต้นทุนรวมมากกว่า 0");
  await tx.cpeOpportunity.update({
    where: { id },
    data: {
      cost,
      bid: bidPrice(cost, o.margin),
      reviewedAt: null,
      reviewedById: null,
    },
  });
}
async function generateRfqs(tx: Tx, id: string, needAt: Date) {
  const o = await tx.cpeOpportunity.findUniqueOrThrow({ where: { id } });
  const items = await tx.cpeBoqItem.findMany({
    where: { opportunityId: id },
    orderBy: { category: "asc" },
    take: 301,
  });
  if (!items.length || items.length > 300)
    throw new CpeError("ต้องมี BOQ ที่ถูกต้องก่อนสร้างชุดขอราคา");
  const groups = [...new Set(items.map((i) => i.category))].map((category) => ({
    category,
  }));
  if (groups.length > 40) throw new CpeError("BOQ รองรับไม่เกิน 40 หมวด");
  const direct = sum(items.map((i) => i.quantity.mul(i.material.add(i.labor))));
  if (direct.lte(0)) throw new CpeError("ต้นทุน BOQ ต้องมากกว่า 0");
  let allocated = D(0);
  for (const [index, g] of groups.entries()) {
    const categoryCost = sum(
      items
        .filter((i) => i.category === g.category)
        .map((i) => i.quantity.mul(i.material.add(i.labor))),
    );
    const budget =
      index === groups.length - 1
        ? o.cost.sub(allocated)
        : money(categoryCost.div(direct).mul(o.cost));
    allocated = allocated.add(budget);
    await tx.cpeRfq.upsert({
      where: {
        opportunityId_category: { opportunityId: id, category: g.category },
      },
      update: {},
      create: {
        code: code("RFQ"),
        opportunityId: id,
        name: g.category,
        category: g.category,
        budget,
        needAt,
        documents: [],
        status: RS.draft,
      },
    });
  }
}
export async function executeCpeCommand(actor: CpeActor, raw: unknown) {
  const c = commandSchema.parse(raw);
  assertCpePermission(actor, COMMAND_PERMISSIONS[c.type], c.organizationId);
  assertCpeOrganization(actor, c.organizationId);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(c))
    .digest("hex");
  return prisma.$transaction(
    async (tx) => {
      const previous = await tx.cpeCommandReceipt.findUnique({
        where: {
          actorId_requestId: { actorId: actor.id, requestId: c.requestId },
        },
      });
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new CpeError("requestId ถูกใช้กับคำสั่งอื่นแล้ว", 409);
        return previous.resultId;
      }
      const { configuration: master } = await loadMaster(tx, c.organizationId);
      const result = await apply(tx, actor, c, master);
      await audit.append(
        {
          actorId: actor.id,
          action: `cpe.${c.type}`,
          targetType: "CPE",
          targetId: result,
          outcome: "SUCCESS",
          correlationId: c.requestId,
          reason: "reason" in c ? c.reason : undefined,
          targetVersion: "version" in c ? String(c.version) : undefined,
          data: { organizationUnitId: c.organizationId },
        },
        { transaction: tx },
      );
      await tx.cpeCommandReceipt.create({
        data: {
          actorId: actor.id,
          requestId: c.requestId,
          fingerprint,
          resultId: result,
        },
      });
      return result;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15000,
    },
  );
}
async function apply(
  tx: Tx,
  actor: CpeActor,
  c: Command,
  master: Master,
): Promise<string> {
  const org = c.organizationId;
  if (c.type === "opportunity.create") {
    policy(master, c.workType);
    if (
      !master.sectors.some((s) => s.name === c.sector) ||
      !master.units.includes(c.unit)
    )
      throw new CpeError("ประเภทลูกค้าหรือหน่วยไม่อยู่ใน Data Master");
    await assignedUser(tx, c.ownerId, org, "cpe.sales.manage");
    if (c.estimatorId)
      await assignedUser(tx, c.estimatorId, org, "cpe.estimate.manage");
    const row = await tx.cpeOpportunity.create({
      data: {
        code: code("OPP"),
        name: c.name,
        customer: c.customer,
        sector: c.sector,
        workType: c.workType,
        organizationUnitId: org,
        ownerId: c.ownerId,
        estimatorId: c.estimatorId,
        location: c.location,
        unit: c.unit,
        quantity: c.quantity,
        cost: c.cost,
        bid: bidPrice(c.cost, c.margin),
        margin: c.margin,
        stage: STAGES[0],
        status: OS.active,
        dueAt: utc(c.dueAt),
        technicalNotes: c.technicalNotes,
        contractNotes: c.contractNotes,
      },
    });
    return row.id;
  }
  if (
    c.type.startsWith("opportunity.") ||
    c.type.startsWith("boq.") ||
    c.type.startsWith("cost.") ||
    c.type === "bid.save" ||
    c.type === "rfq.generate"
  ) {
    if (!("id" in c)) throw new CpeError("ไม่มีรหัสงาน");
    const o = await opportunity(
      tx,
      actor,
      c.id,
      org,
      COMMAND_PERMISSIONS[c.type],
    );
    if (
      o.version !== c.version ||
      (o.status !== OS.active && c.type !== "rfq.generate")
    )
      throw new CpeError("สถานะหรือรุ่นข้อมูลเปลี่ยนแล้ว", 409);
    if (
      (c.type.startsWith("opportunity.") || c.type === "bid.save") &&
      o.ownerId !== actor.id &&
      !actor.permissions.includes("cpe.sales.manage-all")
    )
      throw new CpeError("งานนี้มอบหมายให้ฝ่ายขายคนอื่น", 403);
    if (
      ["boq.save", "boq.copy", "cost.approve", "cost.reference"].includes(
        c.type,
      ) &&
      o.estimatorId &&
      o.estimatorId !== actor.id &&
      !actor.permissions.includes("cpe.estimate.manage-all")
    )
      throw new CpeError("งานนี้มอบหมายให้วิศวกรประมาณราคาคนอื่น", 403);
    if (c.type === "opportunity.stage")
      await reviseOpportunity(tx, o.id, c.version, { stage: c.stage });
    if (c.type === "opportunity.lost")
      await reviseOpportunity(tx, o.id, c.version, {
        status: OS.lost,
        winner: c.winner,
        winnerPrice: c.winnerPrice,
        lossReason: c.lossReason,
        resultNotes: c.notes,
      });
    if (c.type === "opportunity.won") {
      await assignedUser(tx, c.pmId, org, "cpe.projects.manage");
      await reviseOpportunity(tx, o.id, c.version, {
        status: OS.won,
        stage: STAGES.at(-1),
        bid: c.contractValue,
        cost: c.budget,
        margin: D(c.contractValue)
          .sub(c.budget)
          .div(c.contractValue)
          .mul(100)
          .toDecimalPlaces(4),
        winner: "เรา",
      });
      const p = await tx.cpeProject.create({
        data: {
          code: code("PRJ"),
          opportunityId: o.id,
          contractNumber: c.contractNumber,
          contractValue: c.contractValue,
          budget: c.budget,
          pmId: c.pmId,
          startAt: utc(c.startAt),
          durationMonths: c.durationMonths,
          status: PS.active,
          months: {
            create: sCurve(c.durationMonths).map((plannedPercent, i) => ({
              month: i + 1,
              plannedPercent,
              poPayments: {},
            })),
          },
        },
      });
      if (c.generateRfqs) {
        assertCpePermission(actor, "cpe.sales.manage");
        await generateRfqs(tx, o.id, utc(c.startAt));
      }
      return p.id;
    }
    if (c.type === "boq.save") {
      for (const row of c.items) {
        if (!master.units.includes(row.unit))
          throw new CpeError("หน่วยไม่อยู่ใน Data Master");
        if (row.catalogId) {
          const material = await tx.cpeCatalogItem.findFirst({
            where: { id: row.catalogId, organizationUnitId: org },
          });
          if (!material || material.unit !== row.unit)
            throw new CpeError("วัสดุหรือหน่วยไม่ตรงกัน");
        }
      }
      await reviseOpportunity(tx, o.id, c.version, { stage: STAGES[1] });
      await tx.cpeBoqItem.deleteMany({ where: { opportunityId: o.id } });
      await tx.cpeBoqItem.createMany({
        data: c.items.map((row) => ({ ...row, opportunityId: o.id })),
      });
      await recalc(tx, o.id, master);
    }
    if (c.type === "boq.copy") {
      const source = await opportunity(
        tx,
        actor,
        c.sourceId,
        org,
        COMMAND_PERMISSIONS[c.type],
      );
      if (source.id === o.id) throw new CpeError("ต้องเลือกงานอื่น");
      const items = await tx.cpeBoqItem.findMany({
        where: { opportunityId: source.id },
        take: 301,
      });
      if (!items.length || items.length > 300)
        throw new CpeError("ไม่มี BOQ ที่คัดลอกได้");
      await reviseOpportunity(tx, o.id, c.version, { stage: STAGES[1] });
      await tx.cpeBoqItem.deleteMany({ where: { opportunityId: o.id } });
      await tx.cpeBoqItem.createMany({
        data: items.map((row) => ({
          category: row.category,
          code: row.code,
          description: row.description,
          unit: row.unit,
          material: row.material,
          labor: row.labor,
          source: row.source,
          catalogId: row.catalogId,
          quantity: c.scale
            ? scaleQuantity(
                row.quantity,
                source.quantity,
                o.quantity,
                source.unit,
                o.unit,
              )
            : row.quantity,
          opportunityId: o.id,
        })),
      });
      await recalc(tx, o.id, master);
    }
    if (c.type === "cost.approve") {
      const count = await tx.cpeBoqItem.count({
        where: { opportunityId: o.id },
      });
      if (!count) throw new CpeError("ยังไม่มี BOQ ให้ตรวจ");
      await reviseOpportunity(tx, o.id, c.version, {
        reviewedById: actor.id,
        reviewedAt: new Date(),
        stage: STAGES[2],
      });
    }
    if (c.type === "cost.reference") {
      const references = await tx.cpeProject.findMany({
        where: {
          status: PS.closed,
          opportunity: {
            organizationUnitId: org,
            workType: o.workType,
            unit: o.unit,
          },
        },
        include: { opportunity: { select: { quantity: true } } },
        take: 100,
      });
      const values = references.flatMap((p) => {
        const cats = p.actualCategories as Record<string, string> | null;
        return cats?.[c.category]
          ? [D(cats[c.category]).div(p.opportunity.quantity)]
          : [];
      });
      if (!values.length)
        throw new CpeError("ไม่มีต้นทุนจริงจากงานปิดที่หน่วยตรงกัน");
      const items = await tx.cpeBoqItem.findMany({
        where: { opportunityId: o.id, category: c.category },
        take: 301,
      });
      const current = sum(
        items.map((i) => i.quantity.mul(i.material.add(i.labor))),
      );
      if (current.lte(0)) throw new CpeError("หมวดนี้ไม่มีต้นทุนให้ปรับ");
      const p = policy(master, o.workType);
      const factor = sum(values)
        .div(values.length)
        .mul(o.quantity)
        .div(D(1).add(D(p.overhead).add(p.risk).div(100)))
        .div(current);
      await reviseOpportunity(tx, o.id, c.version, {});
      for (const item of items)
        await tx.cpeBoqItem.update({
          where: { id: item.id },
          data: {
            material: money(item.material.mul(factor)),
            labor: money(item.labor.mul(factor)),
          },
        });
      await recalc(tx, o.id, master);
    }
    if (c.type === "bid.save") {
      if (!o.reviewedAt)
        throw new CpeError("ต้องยืนยันผลตรวจต้นทุนก่อนบันทึกราคาเสนอ");
      if (c.margin < policy(master, o.workType).minimum)
        throw new CpeError("กำไรต่ำกว่านโยบายขั้นต่ำ");
      await reviseOpportunity(tx, o.id, c.version, {
        margin: c.margin,
        bid: bidPrice(o.cost, c.margin),
      });
    }
    if (c.type === "rfq.generate") {
      if (o.status !== OS.won) throw new CpeError("ต้องเป็นงานที่ได้งานแล้ว");
      stale(
        (
          await tx.cpeOpportunity.updateMany({
            where: { id: o.id, version: c.version },
            data: { version: { increment: 1 } },
          })
        ).count,
      );
      await generateRfqs(tx, o.id, utc(c.needAt));
    }
    return o.id;
  }
  if (c.type === "catalog.create") {
    if (!master.units.includes(c.unit))
      throw new CpeError("หน่วยไม่อยู่ใน Data Master");
    const row = await tx.cpeCatalogItem.create({
      data: {
        code: c.code,
        name: c.name,
        category: c.category,
        unit: c.unit,
        price: c.price,
        forecastPercent: c.forecastPercent,
        volatility: c.volatility,
        source: c.source,
        organizationUnitId: org,
        prices: {
          create: { price: c.price, source: c.source, actorId: actor.id },
        },
      },
    });
    return row.id;
  }
  if (c.type === "catalog.price") {
    if (
      c.vendorId &&
      !(await tx.cpeVendor.findFirst({
        where: { id: c.vendorId, organizationUnitId: org },
      }))
    )
      throw new CpeError("ไม่พบผู้รับเหมา", 404);
    stale(
      (
        await tx.cpeCatalogItem.updateMany({
          where: { id: c.id, organizationUnitId: org, version: c.version },
          data: {
            price: c.price,
            source: c.source,
            forecastPercent: c.forecastPercent,
            version: { increment: 1 },
          },
        })
      ).count,
    );
    await tx.cpePriceHistory.create({
      data: {
        catalogId: c.id,
        price: c.price,
        source: c.source,
        actorId: actor.id,
        vendorId: c.vendorId,
      },
    });
    return c.id;
  }
  if (c.type === "vendor.create") {
    policy(master, c.workType);
    return (
      await tx.cpeVendor.create({
        data: {
          code: c.code,
          name: c.name,
          workType: c.workType,
          organizationUnitId: org,
          scores: {},
        },
      })
    ).id;
  }
  if (c.type === "vendor.evaluate") {
    const { score, grade } = weightedVendorScore(c.scores, master);
    stale(
      (
        await tx.cpeVendor.updateMany({
          where: { id: c.id, organizationUnitId: org, version: c.version },
          data: {
            scores: c.scores,
            score,
            grade,
            suspended: c.suspended,
            version: { increment: 1 },
          },
        })
      ).count,
    );
    return c.id;
  }
  if (
    c.type === "rfq.quote" ||
    c.type === "rfq.documents" ||
    c.type === "rfq.award"
  ) {
    const r = await tx.cpeRfq.findFirst({
      where: {
        id: c.id,
        opportunity: cpeOpportunityScope(actor, COMMAND_PERMISSIONS[c.type], [
          org,
        ]),
      },
      include: {
        opportunity: {
          select: { project: { select: { id: true, status: true } } },
        },
      },
    });
    if (!r) throw new CpeError("ไม่พบ RFQ", 404);
    if (r.awardedQuoteId || r.version !== c.version)
      throw new CpeError("RFQ ออก PO หรือเปลี่ยนรุ่นแล้ว", 409);
    if (r.opportunity.project?.status === PS.closed)
      throw new CpeError("โครงการปิดแล้ว", 409);
    stale(
      (
        await tx.cpeRfq.updateMany({
          where: { id: r.id, version: c.version },
          data: { version: { increment: 1 } },
        })
      ).count,
    );
    if (c.type === "rfq.documents")
      await tx.cpeRfq.update({
        where: { id: r.id },
        data: {
          documents: [...new Set(c.documents)],
          status:
            c.documents.length === DOCUMENTS.length ? RS.quoting : RS.draft,
        },
      });
    if (c.type === "rfq.quote") {
      const vendor = await tx.cpeVendor.findFirst({
        where: { id: c.vendorId, organizationUnitId: org, suspended: false },
      });
      if (!vendor)
        throw new CpeError("ผู้รับเหมาถูกระงับหรือไม่มีสิทธิ์เข้าถึง");
      await tx.cpeVendorQuote.create({
        data: {
          rfqId: r.id,
          vendorId: vendor.id,
          price: c.price,
          days: c.days,
          paymentTerms: c.paymentTerms,
          validityDays: c.validityDays,
          notes: c.notes,
        },
      });
      await tx.cpeRfq.update({
        where: { id: r.id },
        data: { status: RS.comparing },
      });
    }
    if (c.type === "rfq.award") {
      if ((r.documents as string[]).length !== DOCUMENTS.length)
        throw new CpeError("เอกสารขอราคาต้องครบ 5 รายการ");
      const q = await tx.cpeVendorQuote.findFirst({
        where: {
          id: c.quoteId,
          rfqId: r.id,
          vendor: { organizationUnitId: org, suspended: false },
        },
      });
      if (!q) throw new CpeError("ไม่พบใบเสนอราคาที่ใช้ได้");
      if (
        new Date(q.createdAt.getTime() + q.validityDays * 86400000) < new Date()
      )
        throw new CpeError("ใบเสนอราคาหมดอายุแล้ว");
      if (!r.opportunity.project)
        throw new CpeError("ยังไม่มีโครงการรับภาระผูกพัน");
      await tx.cpeRfq.update({
        where: { id: r.id },
        data: {
          status: RS.awarded,
          awardedQuoteId: q.id,
          poNumber: code("PO"),
        },
      });
    }
    return r.id;
  }
  if (c.type === "project.month" || c.type === "project.close") {
    const p = await tx.cpeProject.findFirst({
      where: { id: c.id, opportunity: { organizationUnitId: org } },
      include: { months: { orderBy: { month: "asc" }, take: 120 } },
    });
    if (!p) throw new CpeError("ไม่พบโครงการ", 404);
    if (p.pmId !== actor.id)
      throw new CpeError("เฉพาะ PM ที่รับผิดชอบโครงการเท่านั้น", 403);
    if (p.status === PS.closed) throw new CpeError("โครงการปิดแล้ว", 409);
    stale(
      (
        await tx.cpeProject.updateMany({
          where: { id: p.id, version: c.version },
          data: { version: { increment: 1 } },
        })
      ).count,
    );
    if (c.type === "project.month") {
      if (c.month > p.durationMonths)
        throw new CpeError("เดือนเกินระยะเวลาโครงการ");
      const previous = p.months.find(
        (m) => m.month === c.month - 1,
      )?.actualPercent;
      const next = p.months.find((m) => m.month === c.month + 1)?.actualPercent;
      if (
        (previous && previous.gt(c.actualPercent)) ||
        (next && next.lt(c.actualPercent))
      )
        throw new CpeError("ความคืบหน้าสะสมต้องไม่ลดลง");
      const awarded = await tx.cpeRfq.findMany({
        where: {
          opportunityId: p.opportunityId,
          awardedQuoteId: { not: null },
        },
        include: { quotes: { take: 100 } },
        take: 40,
      });
      if (sum(Object.values(c.poPayments)).gt(c.cashOut))
        throw new CpeError("ยอดจ่ายตาม PO ต้องไม่เกินเงินจ่ายจริงของเดือน");
      for (const [rfqId, value] of Object.entries(c.poPayments)) {
        const rfq = awarded.find((r) => r.id === rfqId);
        const quote = rfq?.quotes.find((q) => q.id === rfq.awardedQuoteId);
        if (!quote) throw new CpeError("PO ไม่ได้อยู่ในโครงการนี้");
        const prior = sum(
          p.months
            .filter((m) => m.month !== c.month)
            .map((m) => (m.poPayments as Record<string, string>)[rfqId] ?? "0"),
        );
        if (prior.add(value).gt(quote.price))
          throw new CpeError("ยอดจ่ายรวมเกินมูลค่า PO");
      }
      await tx.cpeProjectMonth.update({
        where: { projectId_month: { projectId: p.id, month: c.month } },
        data: {
          actualPercent: c.actualPercent,
          cashIn: c.cashIn,
          cashOut: c.cashOut,
          forecastIn: c.forecastIn,
          forecastOut: c.forecastOut,
          poPayments: c.poPayments,
          paidPo: sum(Object.values(c.poPayments)),
        },
      });
      await tx.cpeProject.update({
        where: { id: p.id },
        data: { risks: c.risks },
      });
    } else {
      if (!p.months.at(-1)?.actualPercent?.eq(100))
        throw new CpeError(
          "ต้องบันทึกความคืบหน้าเดือนสุดท้ายครบ 100% ก่อนปิดงาน",
        );
      const actual = sum(p.months.map((m) => m.cashOut));
      const categories = sum(Object.values(c.actualCategories));
      if (actual.lte(0) || !actual.eq(categories))
        throw new CpeError(
          "ต้นทุนจริงรายหมวดต้องรวมเท่ากับจ่ายจริงและมากกว่า 0",
        );
      await tx.cpeProject.update({
        where: { id: p.id },
        data: {
          status: PS.closed,
          closedAt: new Date(),
          actualCategories: c.actualCategories,
        },
      });
    }
    return p.id;
  }
  if (c.type === "finance.create") {
    if (
      c.projectId &&
      !(await tx.cpeProject.findFirst({
        where: {
          id: c.projectId,
          opportunity: cpeOpportunityScope(actor, "cpe.cash.manage", [org]),
        },
      }))
    )
      throw new CpeError("ไม่พบโครงการ", 404);
    return (
      await tx.cpeFinanceEntry.create({
        data: {
          organizationUnitId: org,
          createdById: actor.id,
          projectId: c.projectId,
          kind: c.kind,
          name: c.name,
          amount: c.amount,
          dueAt: utc(c.dueAt),
        },
      })
    ).id;
  }
  if (c.type === "finance.settle") {
    stale(
      (
        await tx.cpeFinanceEntry.updateMany({
          where: {
            id: c.id,
            ...cpeFinanceScope(actor, "cpe.cash.manage", [org]),
            version: c.version,
            settledAt: null,
          },
          data: { settledAt: new Date(), version: { increment: 1 } },
        })
      ).count,
    );
    return c.id;
  }
  if (c.type === "master.save") {
    if (c.version === 0)
      return (
        await tx.cpeMasterData.create({
          data: {
            organizationUnitId: org,
            configuration: c.configuration as Prisma.InputJsonValue,
          },
        })
      ).id;
    stale(
      (
        await tx.cpeMasterData.updateMany({
          where: { organizationUnitId: org, version: c.version },
          data: {
            configuration: c.configuration as Prisma.InputJsonValue,
            version: { increment: 1 },
          },
        })
      ).count,
    );
    return org;
  }
  if (c.type === "improvement.propose") {
    const current = await loadMaster(tx, org);
    if (current.version !== c.masterVersion)
      throw new CpeError("Data Master เปลี่ยนแล้ว", 409);
    return (
      await tx.cpeImprovement.create({
        data: {
          organizationUnitId: org,
          title: c.title,
          reason: c.reason,
          expectedEffect: c.expectedEffect,
          proposedConfiguration: c.configuration as Prisma.InputJsonValue,
          masterVersion: c.masterVersion,
          createdById: actor.id,
          status: "รอพิจารณา",
        },
      })
    ).id;
  }
  if (c.type === "improvement.decide") {
    const row = await tx.cpeImprovement.findFirst({
      where: { id: c.id, organizationUnitId: org },
    });
    if (!row) throw new CpeError("ไม่พบข้อเสนอ", 404);
    if (row.createdById === actor.id)
      throw new CpeError("ผู้เสนอห้ามอนุมัติข้อเสนอของตนเอง", 403);
    stale(
      (
        await tx.cpeImprovement.updateMany({
          where: { id: row.id, version: c.version, status: "รอพิจารณา" },
          data: {
            status: c.approve ? "อนุมัติ" : "ไม่อนุมัติ",
            decidedById: actor.id,
            version: { increment: 1 },
          },
        })
      ).count,
    );
    if (c.approve) {
      const conf = masterSchema.parse(row.proposedConfiguration);
      if (row.masterVersion === 0)
        await tx.cpeMasterData.create({
          data: {
            organizationUnitId: org,
            configuration: conf as Prisma.InputJsonValue,
          },
        });
      else
        stale(
          (
            await tx.cpeMasterData.updateMany({
              where: { organizationUnitId: org, version: row.masterVersion },
              data: {
                configuration: conf as Prisma.InputJsonValue,
                version: { increment: 1 },
              },
            })
          ).count,
        );
    }
    return row.id;
  }
  throw new CpeError("ไม่รองรับคำสั่ง");
}
