import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import {
  assertCpeOrganization,
  assertCpePermission,
  cpeOpportunityScope,
  cpeFinanceScope,
  CpeError,
  type CpeActor,
} from "./access";
import {
  DEFAULT_MASTER,
  OPPORTUNITY_STATUS as OS,
  PROJECT_STATUS as PS,
  SCREENS,
  type Screen,
} from "./config";
import { D } from "./calculations";
import { loadMaster } from "./service";
export const PAGE_SIZE = 20;
export const SORT_KEYS = ["code", "name", "amount", "status"] as const;
export function parseCpeFilters(
  raw: Record<string, string | string[] | undefined>,
) {
  const get = (key: string) =>
    typeof raw[key] === "string" ? (raw[key] as string) : "";
  const requested = Number(get("page"));
  return {
    create: get("create") === "1" ? "1" : "",
    q: get("q").trim().slice(0, 100),
    sort: SORT_KEYS.includes(get("sort") as (typeof SORT_KEYS)[number])
      ? (get("sort") as (typeof SORT_KEYS)[number])
      : ("code" as const),
    order: get("order") === "desc" ? ("desc" as const) : ("asc" as const),
    page:
      Number.isSafeInteger(requested) && requested > 0
        ? Math.min(requested, 10000)
        : 1,
    sector: get("sector").slice(0, 100),
    workType: get("workType").slice(0, 100),
    status: get("status").slice(0, 64),
    category: get("category").slice(0, 100),
    volatility: get("volatility").slice(0, 40),
    grade: get("grade").slice(0, 40),
    tab: get("tab").slice(0, 30),
    id: get("id").slice(0, 191),
    organizationId: get("org").slice(0, 191),
  };
}
export type CpeFilters = ReturnType<typeof parseCpeFilters>;
export type TableRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  amount: string;
  status: string;
  detail?: string;
};
const json = <T>(value: T): Serialized<T> => JSON.parse(JSON.stringify(value));
export type Serialized<T> = T extends Prisma.Decimal
  ? string
  : T extends Date
    ? string
    : T extends (infer U)[]
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;
export async function loadCpePage(
  actor: CpeActor,
  screen: Screen,
  filters: CpeFilters,
) {
  const definition = SCREENS.find((s) => s.id === screen)!;
  assertCpePermission(actor, definition.permission);
  const org =
    filters.organizationId ||
    actor.organizationIds.find(
      (id) =>
        !actor.permissionsByOrganization ||
        actor.permissionsByOrganization[id]?.includes(definition.permission),
    ) ||
    "";
  if (org) {
    assertCpeOrganization(actor, org);
    assertCpePermission(actor, definition.permission, org);
  }
  const organizationIds = org ? [org] : [];
  const { configuration: master, version: masterVersion } = org
    ? await loadMaster(prisma, org)
    : { configuration: structuredClone(DEFAULT_MASTER), version: 0 };
  const organizationOptions = await prisma.organizationUnit.findMany({
    where: { id: { in: actor.organizationIds }, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 200,
  });
  const people = org
    ? await prisma.userRoleAssignment.findMany({
        where: {
          organizationUnitId: org,
          active: true,
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
          user: { active: true },
        },
        select: { userId: true, user: { select: { name: true } } },
        distinct: ["userId"],
        take: 200,
      })
    : [];
  const scoped: Prisma.CpeOpportunityWhereInput = cpeOpportunityScope(
    actor,
    definition.permission,
    organizationIds,
  );
  const sqlScope = (alias: "o" | "ho") => {
    const a = Prisma.raw(alias);
    const organizations = organizationIds.length
      ? organizationIds
      : ["__none__"];
    const orgClause = Prisma.sql`${a}.organizationUnitId IN (${Prisma.join(organizations)})`;
    if (!actor.broadOrganizationsByPermission) return orgClause;
    const broad =
      actor.broadOrganizationsByPermission[definition.permission] ?? [];
    return Prisma.sql`${orgClause} AND (${a}.organizationUnitId IN (${Prisma.join(broad.length ? broad : ["__none__"])}) OR ${a}.ownerId=${actor.id} OR ${a}.estimatorId=${actor.id} OR EXISTS (SELECT 1 FROM CpeProject own_project WHERE own_project.opportunityId=${a}.id AND own_project.pmId=${actor.id}))`;
  };
  const financeWhere = cpeFinanceScope(
    actor,
    definition.permission,
    organizationIds,
  );
  const broadFinance =
    actor.broadOrganizationsByPermission?.[definition.permission] ?? [];
  const financeSql = actor.broadOrganizationsByPermission
    ? Prisma.sql`f.organizationUnitId IN (${Prisma.join(organizationIds.length ? organizationIds : ["__none__"])}) AND (f.organizationUnitId IN (${Prisma.join(broadFinance.length ? broadFinance : ["__none__"])}) OR f.createdById=${actor.id} OR EXISTS (SELECT 1 FROM CpeProject fp JOIN CpeOpportunity fo ON fo.id=fp.opportunityId WHERE fp.id=f.projectId AND (fo.ownerId=${actor.id} OR fo.estimatorId=${actor.id} OR fp.pmId=${actor.id})))`
    : Prisma.sql`f.organizationUnitId IN (${Prisma.join(organizationIds.length ? organizationIds : ["__none__"])})`;
  const q = filters.q ? { contains: filters.q } : undefined;
  const oppWhere: Prisma.CpeOpportunityWhereInput = {
    ...scoped,
    ...(filters.workType ? { workType: filters.workType } : {}),
    ...(filters.sector ? { sector: filters.sector } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(q ? { OR: [{ code: q }, { name: q }, { customer: q }] } : {}),
  };
  const pageCount = (total: number) =>
    Math.max(1, Math.ceil(total / PAGE_SIZE));
  let total = 0;
  let page = 1;
  let rows: TableRow[] = [];
  const direction = filters.order;
  const sortField = {
    code: "code",
    name: "name",
    amount: "bid",
    status: "status",
  }[filters.sort];
  if (
    ["sales", "estimate", "costcheck", "bidsim", "knowledge"].includes(screen)
  ) {
    if (screen === "knowledge")
      oppWhere.status = filters.status || { in: [OS.won, OS.lost] };
    total = await prisma.cpeOpportunity.count({ where: oppWhere });
    page = Math.min(filters.page, pageCount(total));
    rows = (
      await prisma.cpeOpportunity.findMany({
        where: oppWhere,
        orderBy: [{ [sortField]: direction }, { id: "asc" }],
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      })
    ).map((o) => ({
      id: o.id,
      code: o.code,
      name: o.name,
      description: `${o.customer} · ${o.workType} · ${o.sector}`,
      amount: o.bid.toString(),
      status: o.status,
      detail: o.stage,
    }));
  }
  if (screen === "catalog" || screen === "forecast") {
    const where: Prisma.CpeCatalogItemWhereInput = {
      organizationUnitId: { in: organizationIds },
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.volatility ? { volatility: filters.volatility } : {}),
      ...(q ? { OR: [{ code: q }, { name: q }, { category: q }] } : {}),
    };
    const field = {
      code: "code",
      name: "name",
      amount: "price",
      status: "volatility",
    }[filters.sort];
    total = await prisma.cpeCatalogItem.count({ where });
    page = Math.min(filters.page, pageCount(total));
    rows = (
      await prisma.cpeCatalogItem.findMany({
        where,
        orderBy: [{ [field]: direction }, { id: "asc" }],
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      })
    ).map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: `${r.category} · บาท/${r.unit} · ${r.source}`,
      amount: r.price.toString(),
      status: r.volatility,
      detail: `พยากรณ์ 90 วัน ${r.forecastPercent.toFixed(2)}%`,
    }));
  }
  if (screen === "vendors") {
    const where: Prisma.CpeVendorWhereInput = {
      organizationUnitId: { in: organizationIds },
      ...(filters.workType ? { workType: filters.workType } : {}),
      ...(filters.grade ? { grade: filters.grade } : {}),
      ...(q ? { OR: [{ code: q }, { name: q }, { workType: q }] } : {}),
    };
    total = await prisma.cpeVendor.count({ where });
    page = Math.min(filters.page, pageCount(total));
    const field = {
      code: "code",
      name: "name",
      amount: "score",
      status: "grade",
    }[filters.sort];
    rows = (
      await prisma.cpeVendor.findMany({
        where,
        orderBy: [{ [field]: direction }, { id: "asc" }],
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      })
    ).map((v) => ({
      id: v.id,
      code: v.code,
      name: v.name,
      description: v.workType,
      amount: v.score?.toString() ?? "",
      status: v.suspended
        ? "ระงับ"
        : v.grade
          ? `เกรด ${v.grade}`
          : "ยังไม่ประเมิน",
    }));
  }
  if (screen === "procurement") {
    const where: Prisma.CpeRfqWhereInput = {
      opportunity: scoped,
      ...(filters.status ? { status: filters.status } : {}),
      ...(q
        ? { OR: [{ code: q }, { name: q }, { opportunity: { name: q } }] }
        : {}),
    };
    total = await prisma.cpeRfq.count({ where });
    page = Math.min(filters.page, pageCount(total));
    const field = {
      code: "code",
      name: "name",
      amount: "budget",
      status: "status",
    }[filters.sort];
    rows = (
      await prisma.cpeRfq.findMany({
        where,
        include: {
          opportunity: { select: { name: true } },
          quotes: {
            select: { price: true },
            orderBy: { price: "asc" },
            take: 1,
          },
          _count: { select: { quotes: true } },
        },
        orderBy: [{ [field]: direction }, { id: "asc" }],
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      })
    ).map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.opportunity.name,
      amount: r.budget.toString(),
      status: r.status,
      detail: `เอกสาร ${(r.documents as string[]).length}/5 · ผู้เสนอ ${r._count.quotes} ราย · ต่ำสุด ${r.quotes[0]?.price.toFixed(2) ?? "—"}`,
    }));
  }
  if (screen === "projects") {
    const where: Prisma.CpeProjectWhereInput = {
      opportunity: scoped,
      ...(filters.status ? { status: filters.status } : {}),
      ...(q ? { OR: [{ code: q }, { opportunity: { name: q } }] } : {}),
    };
    total = await prisma.cpeProject.count({ where });
    page = Math.min(filters.page, pageCount(total));
    const field = {
      code: "code",
      name: "code",
      amount: "contractValue",
      status: "status",
    }[filters.sort];
    rows = (
      await prisma.cpeProject.findMany({
        where,
        include: { opportunity: { select: { name: true, customer: true } } },
        orderBy:
          filters.sort === "name"
            ? [{ opportunity: { name: direction } }, { id: "asc" }]
            : [{ [field]: direction }, { id: "asc" }],
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      })
    ).map((p) => ({
      id: p.id,
      code: p.code,
      name: p.opportunity.name,
      description: p.opportunity.customer,
      amount: p.contractValue.toString(),
      status: p.status,
    }));
  }
  if (screen === "cash") {
    const where: Prisma.CpeFinanceEntryWhereInput = {
      ...financeWhere,
      ...(q ? { name: q } : {}),
      ...(filters.status === "ชำระแล้ว"
        ? { settledAt: { not: null } }
        : filters.status === "ค้างชำระ"
          ? { settledAt: null }
          : {}),
    };
    total = await prisma.cpeFinanceEntry.count({ where });
    page = Math.min(filters.page, pageCount(total));
    const field = {
      code: "dueAt",
      name: "name",
      amount: "amount",
      status: "settledAt",
    }[filters.sort];
    rows = (
      await prisma.cpeFinanceEntry.findMany({
        where,
        orderBy: [{ [field]: direction }, { id: "asc" }],
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      })
    ).map((e) => ({
      id: e.id,
      code: e.dueAt.toISOString().slice(0, 10),
      name: e.name,
      description: e.kind,
      amount: e.amount.toString(),
      status: e.settledAt ? "ชำระแล้ว" : "ค้างชำระ",
      detail: String(e.version),
    }));
  }
  const selectedId = filters.id || rows[0]?.id;
  const opportunityDetail =
    ["sales", "estimate", "costcheck", "bidsim", "knowledge"].includes(
      screen,
    ) && selectedId
      ? await prisma.cpeOpportunity.findFirst({
          where: { id: selectedId, ...scoped },
          include: {
            items: {
              orderBy: [{ category: "asc" }, { id: "asc" }],
              take: 300,
              include: {
                catalog: {
                  select: {
                    name: true,
                    price: true,
                    forecastPercent: true,
                    volatility: true,
                  },
                },
              },
            },
            project: { select: { id: true, code: true } },
            rfqs: {
              select: { id: true, code: true, category: true },
              take: 40,
            },
          },
        })
      : null;
  const opportunityHistory = opportunityDetail
    ? await prisma.auditEvent.findMany({
        where: {
          targetType: "CPE",
          targetId: {
            in: [
              opportunityDetail.id,
              ...(opportunityDetail.project
                ? [opportunityDetail.project.id]
                : []),
            ],
          },
        },
        select: {
          id: true,
          actorId: true,
          action: true,
          recordedAt: true,
          targetVersion: true,
        },
        orderBy: { sequence: "desc" },
        take: 30,
      })
    : [];
  const catalogDetail =
    ["catalog", "forecast"].includes(screen) && selectedId
      ? await prisma.cpeCatalogItem.findFirst({
          where: {
            id: selectedId,
            organizationUnitId: { in: organizationIds },
          },
          include: {
            prices: {
              where: {
                recordedAt: { gte: new Date(Date.now() - 183 * 86400000) },
              },
              orderBy: { recordedAt: "desc" },
              take: 180,
            },
            boqItems: {
              where: { opportunity: { ...scoped, status: OS.active } },
              include: {
                opportunity: {
                  select: { code: true, name: true, margin: true, bid: true },
                },
              },
              take: 100,
            },
            _count: { select: { boqItems: true } },
          },
        })
      : null;
  const vendorDetail =
    screen === "vendors" && selectedId
      ? await prisma.cpeVendor.findFirst({
          where: {
            id: selectedId,
            organizationUnitId: { in: organizationIds },
          },
          include: {
            quotes: {
              where: { rfq: { awardedQuoteId: { not: null } } },
              include: {
                rfq: {
                  select: {
                    code: true,
                    awardedQuoteId: true,
                    opportunity: { select: { name: true } },
                  },
                },
              },
              take: 100,
            },
          },
        })
      : null;
  const rfqDetail =
    screen === "procurement" && selectedId
      ? await prisma.cpeRfq.findFirst({
          where: { id: selectedId, opportunity: scoped },
          include: {
            opportunity: { select: { name: true, code: true } },
            quotes: {
              include: {
                vendor: {
                  select: {
                    name: true,
                    code: true,
                    score: true,
                    suspended: true,
                  },
                },
              },
              orderBy: { price: "asc" },
              take: 100,
            },
          },
        })
      : null;
  const vendorStats = vendorDetail
    ? await prisma.$queryRaw<
        Array<{
          count: bigint;
          total: Prisma.Decimal | null;
          lastAward: Date | null;
        }>
      >(Prisma.sql`
    SELECT COUNT(*) AS count, SUM(q.price) AS total, MAX(q.createdAt) AS lastAward
    FROM CpeVendorQuote q JOIN CpeRfq r ON r.awardedQuoteId=q.id WHERE q.vendorId=${vendorDetail.id}`)
    : [];
  const catalogAffected = catalogDetail
    ? await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT COUNT(DISTINCT b.opportunityId) AS count FROM CpeBoqItem b JOIN CpeOpportunity o ON o.id=b.opportunityId
    WHERE ${sqlScope("o")} AND o.status=${OS.active} AND b.catalogId=${catalogDetail.id} AND b.material <> ${catalogDetail.price}`)
    : [];
  const projectDetail =
    screen === "projects" && selectedId
      ? await prisma.cpeProject.findFirst({
          where: { id: selectedId, opportunity: scoped },
          include: {
            opportunity: {
              select: {
                id: true,
                name: true,
                workType: true,
                unit: true,
                quantity: true,
                items: { select: { category: true }, take: 300 },
                rfqs: {
                  include: {
                    quotes: {
                      include: { vendor: { select: { name: true } } },
                      take: 100,
                    },
                  },
                  take: 40,
                },
              },
            },
            months: { orderBy: { month: "asc" }, take: 120 },
          },
        })
      : null;
  if (
    filters.id &&
    !opportunityDetail &&
    !catalogDetail &&
    !vendorDetail &&
    !rfqDetail &&
    !projectDetail &&
    screen !== "cash"
  )
    throw new CpeError("ไม่พบข้อมูล", 404);
  const pickerOpps = ["estimate", "procurement"].includes(screen)
    ? await prisma.cpeOpportunity.findMany({
        where: scoped,
        select: {
          id: true,
          code: true,
          name: true,
          version: true,
          unit: true,
          quantity: true,
          status: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      })
    : [];
  const pickerCatalog =
    screen === "estimate"
      ? await prisma.cpeCatalogItem.findMany({
          where: { organizationUnitId: { in: organizationIds } },
          orderBy: { code: "asc" },
          take: 100,
        })
      : [];
  const pickerVendors = ["procurement", "catalog"].includes(screen)
    ? await prisma.cpeVendor.findMany({
        where: {
          organizationUnitId: { in: organizationIds },
          suspended: false,
        },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
        take: 100,
      })
    : [];
  const history = ["exec", "sales", "bidsim", "knowledge"].includes(screen)
    ? await prisma.cpeOpportunity.findMany({
        where: {
          ...scoped,
          status: { in: [OS.won, OS.lost] },
          ...(opportunityDetail
            ? { workType: opportunityDetail.workType }
            : {}),
        },
        select: {
          id: true,
          code: true,
          name: true,
          workType: true,
          sector: true,
          margin: true,
          status: true,
          bid: true,
          cost: true,
          lossReason: true,
          quantity: true,
          unit: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      })
    : [];
  const references = ["costcheck", "estimate", "knowledge"].includes(screen)
    ? await prisma.cpeProject.findMany({
        where: {
          status: PS.closed,
          opportunity: {
            ...scoped,
            ...(opportunityDetail
              ? {
                  workType: opportunityDetail.workType,
                  unit: opportunityDetail.unit,
                }
              : {}),
          },
        },
        include: {
          opportunity: {
            select: { name: true, workType: true, unit: true, quantity: true },
          },
          months: { select: { cashOut: true }, take: 120 },
        },
        orderBy: { closedAt: "desc" },
        take: 100,
      })
    : [];
  const improvements =
    screen === "knowledge"
      ? await prisma.cpeImprovement.findMany({
          where: { organizationUnitId: { in: organizationIds } },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [];
  const totals = await prisma.cpeOpportunity.groupBy({
    by: ["status"],
    where: scoped,
    _sum: { bid: true, cost: true },
    _count: true,
  });
  const stages = await prisma.cpeOpportunity.groupBy({
    by: ["stage"],
    where: { ...scoped, status: OS.active },
    _sum: { bid: true },
    _count: true,
  });
  const projectTotals = await prisma.cpeProject.aggregate({
    where: { opportunity: scoped, status: PS.active },
    _sum: { contractValue: true, budget: true },
    _count: true,
  });
  const cashTotals = await prisma.cpeProjectMonth.aggregate({
    where: { project: { opportunity: scoped } },
    _sum: { cashIn: true, cashOut: true, forecastIn: true, forecastOut: true },
  });
  const receivables =
    screen === "cash" || screen === "exec"
      ? await prisma.cpeFinanceEntry.groupBy({
          by: ["kind"],
          where: {
            ...financeWhere,
            settledAt: null,
          },
          _sum: { amount: true },
          _count: true,
        })
      : [];
  // Aggregation remains in MySQL; all record lists and related projections are bounded.
  const monthly =
    screen === "cash" || screen === "exec"
      ? await prisma.$queryRaw<
          Array<{
            month: string;
            cashIn: Prisma.Decimal;
            cashOut: Prisma.Decimal;
            forecastIn: Prisma.Decimal;
            forecastOut: Prisma.Decimal;
          }>
        >(Prisma.sql`
    SELECT DATE_FORMAT(DATE_ADD(p.startAt, INTERVAL (m.month - 1) MONTH), '%Y-%m') AS month,
      SUM(m.cashIn) AS cashIn, SUM(m.cashOut) AS cashOut, SUM(m.forecastIn) AS forecastIn, SUM(m.forecastOut) AS forecastOut
    FROM CpeProjectMonth m JOIN CpeProject p ON p.id=m.projectId JOIN CpeOpportunity o ON o.id=p.opportunityId
    WHERE ${sqlScope("o")}
    GROUP BY month ORDER BY month DESC LIMIT 24`)
      : [];
  const aging = ["cash", "exec"].includes(screen)
    ? await prisma.$queryRaw<
        Array<{ kind: string; bucket: string; amount: Prisma.Decimal }>
      >(Prisma.sql`
    SELECT kind, CASE WHEN dueAt >= DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR) THEN 'ยังไม่ถึงกำหนด' WHEN DATEDIFF(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR),dueAt)<=30 THEN 'เกินกำหนด 1–30 วัน' WHEN DATEDIFF(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR),dueAt)<=60 THEN 'เกินกำหนด 31–60 วัน' WHEN DATEDIFF(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR),dueAt)<=90 THEN 'เกินกำหนด 61–90 วัน' ELSE 'เกินกำหนด 90 วัน' END AS bucket, SUM(amount) AS amount
    FROM CpeFinanceEntry f WHERE ${financeSql} AND settledAt IS NULL GROUP BY kind,bucket`)
    : [];
  const projectSummary = ["cash", "exec", "projects"].includes(screen)
    ? await prisma.$queryRaw<
        Array<{
          id: string;
          code: string;
          name: string;
          budget: Prisma.Decimal;
          contractValue: Prisma.Decimal;
          paid: Prisma.Decimal;
          received: Prisma.Decimal;
          paidPo: Prisma.Decimal;
          committed: Prisma.Decimal;
          funding: Prisma.Decimal;
          actual: Prisma.Decimal | null;
          planned: Prisma.Decimal | null;
          forecastIn: Prisma.Decimal;
          forecastOut: Prisma.Decimal;
        }>
      >(Prisma.sql`
    SELECT p.id,p.code,o.name,p.budget,p.contractValue,COALESCE(m.paid,0) AS paid,COALESCE(m.received,0) AS received,COALESCE(m.paidPo,0) AS paidPo,COALESCE(r.committed,0) AS committed,COALESCE(f.funding,0) AS funding,m.actual,m.planned,COALESCE(m.forecastIn,0) AS forecastIn,COALESCE(m.forecastOut,0) AS forecastOut
    FROM CpeProject p JOIN CpeOpportunity o ON o.id=p.opportunityId
    LEFT JOIN (SELECT pm.projectId,SUM(pm.cashOut) AS paid,SUM(pm.cashIn) AS received,SUM(pm.paidPo) AS paidPo,SUM(pm.forecastIn) AS forecastIn,SUM(pm.forecastOut) AS forecastOut,MAX(pm.actualPercent) AS actual,MAX(CASE WHEN pm.month<=GREATEST(1,TIMESTAMPDIFF(MONTH,pr.startAt,DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR))+1) THEN pm.plannedPercent END) AS planned FROM CpeProjectMonth pm JOIN CpeProject pr ON pr.id=pm.projectId GROUP BY pm.projectId) m ON m.projectId=p.id
    LEFT JOIN (SELECT rf.opportunityId,SUM(q.price) AS committed FROM CpeRfq rf JOIN CpeVendorQuote q ON q.id=rf.awardedQuoteId GROUP BY rf.opportunityId) r ON r.opportunityId=o.id
    LEFT JOIN (SELECT projectId,MAX(GREATEST(0,-balance)) AS funding FROM (SELECT projectId,SUM(cashIn + forecastIn - cashOut - forecastOut) OVER (PARTITION BY projectId ORDER BY month) AS balance FROM CpeProjectMonth) balances GROUP BY projectId) f ON f.projectId=p.id
    WHERE ${sqlScope("o")} AND p.status=${PS.active}
    ORDER BY p.code LIMIT 100`)
    : [];
  const currentCash = D(master.finance.openingCash)
    .add(cashTotals._sum.cashIn ?? 0)
    .sub(cashTotals._sum.cashOut ?? 0);
  const modelStats = opportunityDetail
    ? await prisma.$queryRaw<
        Array<{
          count: bigint;
          wins: Prisma.Decimal;
          winningAverage: Prisma.Decimal | null;
          losingAverage: Prisma.Decimal | null;
        }>
      >(Prisma.sql`
    SELECT COUNT(*) AS count, COALESCE(SUM(status=${OS.won}),0) AS wins, AVG(CASE WHEN status=${OS.won} THEN margin END) AS winningAverage, AVG(CASE WHEN status=${OS.lost} THEN margin END) AS losingAverage
    FROM CpeOpportunity o WHERE ${sqlScope("o")} AND workType=${opportunityDetail.workType} AND status IN (${OS.won},${OS.lost})`)
    : [];
  const adjustments = Prisma.sql`CASE o.sector ${Prisma.join(
    master.sectors.map((s) => Prisma.sql`WHEN ${s.name} THEN ${s.adjustment}`),
    " ",
  )} ELSE 0 END`;
  const pivot = Prisma.sql`(COALESCE((h.winningAverage+h.losingAverage)/2,${master.bidding.defaultPivot}) + (${adjustments}))`;
  const chance = Prisma.sql`CASE WHEN h.n IS NULL THEN NULL ELSE ${master.bidding.probabilityCap}/(1+EXP(LEAST(700,GREATEST(-700,(o.margin-${pivot})/${master.bidding.slope})))) END`;
  const weighted = ["exec", "sales"].includes(screen)
    ? await prisma.$queryRaw<
        Array<{ value: Prisma.Decimal | null; modeled: bigint }>
      >(Prisma.sql`
    SELECT SUM(o.bid * CAST((${chance}) AS DECIMAL(9,4))/100) AS value, COUNT(CASE WHEN h.n IS NOT NULL THEN 1 END) AS modeled
    FROM CpeOpportunity o LEFT JOIN (SELECT workType,COUNT(*) AS n,SUM(status=${OS.won}) AS wins,AVG(CASE WHEN status=${OS.won} THEN margin END) AS winningAverage,AVG(CASE WHEN status=${OS.lost} THEN margin END) AS losingAverage FROM CpeOpportunity ho WHERE ${sqlScope("ho")} AND status IN (${OS.won},${OS.lost}) GROUP BY workType) h ON h.workType=o.workType
    WHERE ${sqlScope("o")} AND o.status=${OS.active}`)
    : [];
  const model = modelStats[0]
    ? {
        count: Number(modelStats[0].count),
        wins: Number(modelStats[0].wins),
        winningAverage:
          modelStats[0].winningAverage === null
            ? null
            : Number(modelStats[0].winningAverage),
        losingAverage:
          modelStats[0].losingAverage === null
            ? null
            : Number(modelStats[0].losingAverage),
      }
    : { count: 0, wins: 0, winningAverage: null, losingAverage: null };
  const distributions =
    screen === "exec"
      ? await prisma.cpeOpportunity.groupBy({
          by: ["sector", "workType"],
          where: scoped,
          _sum: { bid: true },
          _count: true,
        })
      : [];
  const decisionQueue =
    screen === "exec"
      ? await prisma.cpeOpportunity.findMany({
          where: { ...scoped, status: OS.active, reviewedAt: null },
          select: { id: true, code: true, name: true },
          orderBy: { dueAt: "asc" },
          take: 5,
        })
      : [];
  const priceRisks =
    screen === "exec"
      ? await prisma.cpeCatalogItem.findMany({
          where: {
            organizationUnitId: { in: organizationIds },
            forecastPercent: { gt: 0 },
          },
          select: { id: true, name: true, forecastPercent: true },
          orderBy: { forecastPercent: "desc" },
          take: 5,
        })
      : [];
  return json({
    screen,
    filters: { ...filters, page, organizationId: org },
    master,
    masterVersion,
    organizationOptions,
    people: people.map((p) => ({ id: p.userId, name: p.user.name })),
    rows,
    total,
    totalPages: pageCount(total),
    opportunityDetail,
    opportunityHistory,
    catalogDetail,
    vendorDetail,
    rfqDetail,
    projectDetail,
    pickerOpps,
    pickerCatalog,
    pickerVendors,
    history,
    references,
    improvements,
    totals,
    stages,
    projectTotals,
    cashTotals,
    receivables,
    aging,
    projectSummary,
    monthly: monthly.reverse(),
    model,
    currentCash: currentCash.toString(),
    weighted: weighted[0]?.value?.toString() ?? null,
    modeledCount: Number(weighted[0]?.modeled ?? 0),
    distributions,
    decisionQueue,
    priceRisks,
    permissions:
      org && actor.permissionsByOrganization
        ? (actor.permissionsByOrganization[org] ?? [])
        : actor.permissions,
    actorId: actor.id,
    asOfBangkok: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(),
    vendorStats: {
      count: Number(vendorStats[0]?.count ?? 0),
      total: vendorStats[0]?.total?.toString() ?? "0",
      lastAward: vendorStats[0]?.lastAward?.toISOString() ?? null,
    },
    catalogAffected: Number(catalogAffected[0]?.count ?? 0),
  });
}
export type CpePageData = Awaited<ReturnType<typeof loadCpePage>>;
