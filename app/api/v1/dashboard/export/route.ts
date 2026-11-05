import { COMPANY } from "@/lib/company-profile";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext, loadGrantedPermissions } from "@/lib/authorization/authorization-context";
import { createDashboardAuditWriter } from "@/lib/dashboard/dashboard-audit";
import { DashboardAccessError, loadDashboardData, type DashboardData } from "@/lib/dashboard/dashboard-query";
import { DashboardFilterError, parseDashboardFilters } from "@/lib/dashboard/dashboard-filters";
import { DASHBOARD_PERMISSIONS } from "@/lib/dashboard/dashboard-permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ExportRow = { category: string; metric: string; count: number | string; value: string; source: string };

function rows(data: DashboardData): ExportRow[] {
  return [
    ...data.kpis.map((item) => ({ category: "KPI", metric: item.label, count: item.kind === "count" ? item.value : "", value: item.value, source: item.href })),
    ...Object.entries(data.charts).flatMap(([category, points]) => points.map((item) => ({ category: `Chart:${category}`, metric: item.label, count: item.count, value: item.value, source: item.href }))),
    ...data.funnel.map((item) => ({ category: "Funnel", metric: item.label, count: item.count, value: item.value, source: item.href })),
  ];
}

function csv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHENTICATED", correlationId } }, { status: 401 });
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
    const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    const grantedPermissions = await loadGrantedPermissions(authorization);
    if (!grantedPermissions.includes(DASHBOARD_PERMISSIONS.export)) throw new DashboardAccessError();
    const filters = parseDashboardFilters(url.searchParams);
    const data = await loadDashboardData({ id: session.id, authorization, grantedPermissions }, filters);
    const exportRows = rows(data);
    await prisma.$transaction(async (transaction) => {
      await createDashboardAuditWriter().append({
        actorId: session.id,
        action: "dashboard.export",
        targetType: "DashboardExport",
        targetId: correlationId,
        outcome: "SUCCESS",
        correlationId,
        data: { format, rowCount: exportRows.length, filters },
      }, { transaction });
    });

    if (format === "csv") {
      const header = ["category", "metric", "count", "value", "source"];
      const body = exportRows.map((item) => [item.category, item.metric, item.count, item.value, item.source].map(csv).join(","));
      return new NextResponse(`\uFEFF${[header.join(","), ...body].join("\r\n")}`, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": "attachment; filename=nt-dashboard.csv",
          "Cache-Control": "no-store",
          "x-correlation-id": correlationId,
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = COMPANY.englishName;
    workbook.created = new Date(data.updatedAt);
    const sheet = workbook.addWorksheet("Dashboard");
    sheet.columns = [
      { header: "Category", key: "category", width: 20 },
      { header: "Metric", key: "metric", width: 34 },
      { header: "Count", key: "count", width: 14 },
      { header: "Value", key: "value", width: 22 },
      { header: "Source", key: "source", width: 38 },
    ];
    sheet.addRows(exportRows);
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = "A1:E1";
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": "attachment; filename=nt-dashboard.xlsx",
        "Cache-Control": "no-store",
        "x-correlation-id": correlationId,
      },
    });
  } catch (error) {
    const status = error instanceof DashboardAccessError ? 403 : error instanceof DashboardFilterError ? 400 : 500;
    return NextResponse.json(
      { error: { code: status === 403 ? "FORBIDDEN" : status === 400 ? "INVALID_FILTER" : "EXPORT_FAILED", correlationId } },
      { status, headers: { "Cache-Control": "no-store", "x-correlation-id": correlationId } },
    );
  }
}
