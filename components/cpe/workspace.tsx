"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type MouseEvent, type ReactNode } from "react";
import { Plus, FolderOpen, Search, PanelRightOpen, LoaderCircle } from "lucide-react";
import { PageNumberNavigation } from "@/components/page-number-navigation";
import { SortableTableHeader } from "@/components/sortable-table-header";
import {
  PROCESS,
  SCREENS,
  STAGES,
  OPPORTUNITY_STATUS as OS,
  PROJECT_STATUS as PS,
  RFQ_STATUS as RS,
  DOCUMENTS,
  type Master,
} from "@/lib/cpe/config";
import type { CpePageData } from "@/lib/cpe/query";
import {
  D,
  bidPrice,
  boqCost,
  costBand,
  sum,
  winProbability,
} from "@/lib/cpe/calculations";
import {
  CommandForm,
  Drawer,
  Toast,
  options,
  sendCommand,
  type Field,
} from "./forms";
import { BarList, LineChart, Scatter } from "./charts";
import { CompanyIntro } from "../company-profile";
const CPE_ACTION_LABELS: Record<string, string> = {
  "cpe.opportunity.create": "รับงานใหม่",
  "cpe.opportunity.stage": "เปลี่ยนขั้นตอนงาน",
  "cpe.opportunity.won": "บันทึกได้งานและเปิดโครงการ",
  "cpe.opportunity.lost": "บันทึกไม่ได้งาน",
  "cpe.boq.save": "ปรับปรุง BOQ และต้นทุน",
  "cpe.boq.copy": "คัดลอก BOQ จากงานเดิม",
  "cpe.cost.approve": "ยืนยันผลตรวจต้นทุน",
  "cpe.cost.reference": "ปรับต้นทุนตามงานอ้างอิง",
  "cpe.bid.save": "บันทึกราคาเสนอ",
  "cpe.rfq.generate": "สร้างชุดขอราคาจาก BOQ",
  "cpe.project.month": "บันทึกความคืบหน้าโครงการ",
  "cpe.project.close": "ปิดโครงการ",
};
const fmt = (v: string | number | null | undefined, digits = 2) =>
  v == null || v === ""
    ? "—"
    : new Intl.NumberFormat("th-TH", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(Number(v));
const million = (v: string | number | null | undefined) =>
  v == null ? "—" : fmt(Number(v) / 1e6);
const field = (
  name: string,
  label: string,
  value?: string | number,
  type: Field["type"] = "text",
  required = true,
): Field => ({ name, label, value, type, required });
const select = (
  name: string,
  label: string,
  values: { value: string; label: string }[],
  value?: string,
): Field => ({ name, label, options: values, value, required: true });
const Card = ({
  title,
  children,
  sub,
}: {
  title: string;
  children: ReactNode;
  sub?: string;
}) => (
  <section className="cpe-card">
    <h2>{title}</h2>
    {sub && <p className="cpe-sub">{sub}</p>}
    {children}
  </section>
);
const Kpi = ({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) => (
  <div className="cpe-card cpe-kpi">
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{detail ?? "ข้อมูลในหน่วยงานที่เลือก"}</small>
  </div>
);
const Note = ({ children }: { children: ReactNode }) => (
  <div className="cpe-note">{children}</div>
);
function permission(data: CpePageData, p: string) {
  return data.permissions.includes(p);
}
function url(data: CpePageData, overrides: Record<string, string> = {}) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(data.filters)) {
    if (v && !["organizationId", "id"].includes(k)) query.set(k, String(v));
  }
  if (data.filters.organizationId)
    query.set("org", data.filters.organizationId);
  for (const [k, v] of Object.entries(overrides)) {
    if (v) query.set(k, v);
    else query.delete(k);
  }
  return `/cpe/${data.screen}?${query}`;
}
export function CpeWorkspace({ data }: { data: CpePageData }) {
  const router = useRouter();
  const [isOpening, startNavigation] = useTransition();
  const definition = SCREENS.find((s) => s.id === data.screen)!;
  const { filters: f, screen } = data;
  const create = f.create === "1";
  const navigate = (href: string, replace = false) => startNavigation(() => {
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  });
  const openRecord = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!isOpening) navigate(url(data, { id, create: "" }));
  };
  const createPermission = (
    {
      sales: "cpe.sales.manage",
      catalog: "cpe.catalog.manage",
      vendors: "cpe.vendors.manage",
      cash: "cpe.cash.manage",
    } as Record<string, string>
  )[screen];
  const params = Object.fromEntries(
    Object.entries({
      q: f.q,
      sort: f.sort,
      order: f.order,
      sector: f.sector,
      workType: f.workType,
      status: f.status,
      category: f.category,
      volatility: f.volatility,
      grade: f.grade,
      tab: f.tab,
      org: f.organizationId,
    }).filter(([, v]) => v),
  );
  const won = data.totals.find((t) => t.status === OS.won);
  const lost = data.totals.find((t) => t.status === OS.lost);
  const active = data.totals.find((t) => t.status === OS.active);
  return (
    <div className="cpe-workspace" aria-busy={isOpening}>
      <Toast />
      {isOpening && <div className="cpe-opening" role="status"><LoaderCircle aria-hidden="true" />กำลังโหลดข้อมูล…</div>}
      <nav className="cpe-process" aria-label="กระบวนการทำงาน 9 ขั้น">
        {PROCESS.map(([label, target], i) => {
          const allowed = data.permissions.includes(
            SCREENS.find((s) => s.id === target)!.permission,
          );
          return allowed ? (
            <Link
              key={i}
              className={target === screen ? "active" : ""}
              href={`/cpe/${target}?org=${encodeURIComponent(f.organizationId)}`}
            >
              <small>{String(i + 1).padStart(2, "0")}</small>
              <span>{label}</span>
            </Link>
          ) : (
            <span key={i} className="unavailable">
              <small>{String(i + 1).padStart(2, "0")}</small>
              <span>{label}</span>
            </span>
          );
        })}
      </nav>
      <div className="cpe-page-head">
        <div>
          <p className="eyebrow">
            CPE PROJECT BID EXCELLENCE / {definition.group}
          </p>
          <h1>{definition.label}</h1>
          <p>
            เชื่อมงานขาย ประมาณราคา จัดซื้อ และต้นทุนจริงบนข้อมูลชุดเดียวกัน
          </p>
        </div>
        <div className="cpe-head-actions">
          <label>
            หน่วยงาน
            <select
              aria-label="เลือกหน่วยงาน"
              value={f.organizationId}
              onChange={(e) =>
                router.push(
                  url(data, { org: e.target.value, page: "", id: "" }),
                )
              }
            >
              {data.organizationOptions.length === 0 && (
                <option value="">ยังไม่มีหน่วยงาน</option>
              )}
              {data.organizationOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          {createPermission && permission(data, createPermission) && (
            <button
              className="primary"
              onClick={() => navigate(url(data, { create: "1" }))}
              disabled={!f.organizationId || isOpening}
            >
              <Plus size={16} />{" "}
              {screen === "sales"
                ? "รับงานใหม่"
                : screen === "catalog"
                  ? "เพิ่มรายการต้นทุน"
                  : screen === "vendors"
                    ? "เพิ่มผู้รับเหมา"
                    : "เพิ่มลูกหนี้ / เจ้าหนี้"}
            </button>
          )}
        </div>
      </div>
      {!f.organizationId && (
        <Note>
          ยังไม่มีหน่วยงานในสิทธิ์ของคุณ
          กรุณาให้ผู้ดูแลกำหนดบทบาทพร้อมหน่วยงานก่อนใช้งาน
        </Note>
      )}
      {screen === "exec" && (
        <>
          <CompanyIntro />
          <div className="cpe-grid five">
            <Kpi
              label="มูลค่างานที่กำลังเสนอ"
              value={`${million(active?._sum.bid ?? 0)} ลบ.`}
            />
            <Kpi
              label="มูลค่าถ่วงน้ำหนักโอกาส"
              value={data.weighted ? `${million(data.weighted)} ลบ.` : "—"}
              detail={`มีข้อมูลคำนวณ ${data.modeledCount} งานจาก ${active?._count ?? 0} งานที่กำลังเสนอ`}
            />
            <Kpi
              label="อัตราชนะ"
              value={
                won || lost
                  ? `${fmt(((won?._count ?? 0) / ((won?._count ?? 0) + (lost?._count ?? 0))) * 100, 1)}%`
                  : "—"
              }
            />
            <Kpi
              label="กำไรขั้นต้นงานที่ได้"
              value={`${million(
                D(won?._sum.bid ?? 0)
                  .sub(won?._sum.cost ?? 0)
                  .toString(),
              )} ลบ.`}
            />
            <Kpi
              label="เงินสดคงเหลือ"
              value={`${million(data.currentCash)} ลบ.`}
            />
          </div>
          <div className="cpe-grid two">
            <Card title="กระแสเงินสดจริงและประมาณการ">
              <CashChart data={data} />
            </Card>
            <Card title="มูลค่างานตามประเภทลูกค้าและประเภทงาน">
              <BarList
                rows={data.distributions.map((r) => ({
                  label: `${r.sector} / ${r.workType}`,
                  value: Number(r._sum.bid ?? 0),
                  detail: `${million(r._sum.bid)} ลบ.`,
                }))}
              />
            </Card>
            <Card title="สุขภาพโครงการ">
              <p className="cpe-danger">
                ล่าช้ากว่าแผน{" "}
                {
                  data.projectSummary.filter(
                    (p) => Number(p.actual ?? 0) < Number(p.planned ?? 0),
                  ).length
                }{" "}
                จากโครงการที่แสดง {data.projectSummary.length} โครงการ
              </p>
              <Kpi
                label="โครงการกำลังดำเนินการ"
                value={data.projectTotals._count}
              />
              <p>
                มูลค่าสัญญารวม {million(data.projectTotals._sum.contractValue)}{" "}
                ลบ. · งบต้นทุน {million(data.projectTotals._sum.budget)} ลบ.
              </p>
              <Link
                href={`/cpe/projects?org=${f.organizationId}`}
                className="link"
              >
                ดู S-Curve และความเสี่ยงรายโครงการ →
              </Link>
            </Card>
            <Card title="สาเหตุแพ้ประมูล">
              <BarList
                rows={Object.entries(
                  data.history
                    .filter((h) => h.status === OS.lost)
                    .reduce<Record<string, number>>((r, h) => {
                      const key = h.lossReason || "ไม่ระบุ";
                      r[key] = (r[key] ?? 0) + 1;
                      return r;
                    }, {}),
                ).map(([label, value]) => ({ label, value }))}
              />
              <small>จากประวัติล่าสุดไม่เกิน 100 งาน</small>
            </Card>
            <Card title="วัสดุเสี่ยงราคา">
              {data.priceRisks.map((r) => (
                <p key={r.id}>
                  {r.name}
                  <strong className="cpe-danger">
                    {" "}
                    +{fmt(r.forecastPercent)}%
                  </strong>
                </p>
              ))}
              {!data.priceRisks.length && <Empty />}
            </Card>
            <Card title="รายการรอตัดสินใจ">
              {data.decisionQueue.map((r) => (
                <p key={r.id}>
                  <Link
                    className="link"
                    href={`/cpe/costcheck?org=${f.organizationId}&id=${r.id}`}
                  >
                    {r.code} · {r.name} →
                  </Link>
                </p>
              ))}
              {!data.decisionQueue.length && <Empty />}
            </Card>
          </div>
        </>
      )}
      {screen === "sales" && (
        <div className="cpe-stage-summary">
          {STAGES.map((s) => {
            const row = data.stages.find((r) => r.stage === s);
            return (
              <div key={s}>
                <small>{s}</small>
                <strong>
                  {million(row?._sum.bid ?? 0)} <small>ลบ.</small>
                </strong>
                <span>{row?._count ?? 0} งาน</span>
              </div>
            );
          })}
        </div>
      )}
      {screen === "cash" && <FinanceOverview data={data} />}
      {screen === "projects" && <ProjectSummary data={data} />}
      {screen !== "exec" && (
        <section className="cpe-card cpe-list">
          <form className="table-tools cpe-filter" action={`/cpe/${screen}`}>
            <input type="hidden" name="org" value={f.organizationId} />
            <input type="hidden" name="sort" value={f.sort} />
            <input type="hidden" name="order" value={f.order} />
            {f.tab && <input type="hidden" name="tab" value={f.tab} />}
            <label>
              <Search size={16} />
              <span className="sr-only">ค้นหา</span>
              <input
                name="q"
                defaultValue={f.q}
                maxLength={100}
                placeholder="ค้นหารหัส ชื่องาน หรือลูกค้า…"
              />
            </label>
            {["sales", "estimate", "knowledge", "vendors"].includes(screen) && (
              <select
                aria-label="ประเภทงาน"
                name="workType"
                defaultValue={f.workType}
              >
                <option value="">ประเภทงานทั้งหมด</option>
                {data.master.workTypes.map((w) => (
                  <option key={w.name}>{w.name}</option>
                ))}
              </select>
            )}
            {screen === "sales" && (
              <select
                aria-label="ประเภทลูกค้า"
                name="sector"
                defaultValue={f.sector}
              >
                <option value="">ประเภทลูกค้าทั้งหมด</option>
                {data.master.sectors.map((s) => (
                  <option key={s.name}>{s.name}</option>
                ))}
              </select>
            )}
            {["sales", "knowledge", "projects", "cash", "procurement"].includes(
              screen,
            ) && (
              <select aria-label="สถานะ" name="status" defaultValue={f.status}>
                <option value="">สถานะทั้งหมด</option>
                {(screen === "cash"
                  ? ["ค้างชำระ", "ชำระแล้ว"]
                  : screen === "projects"
                    ? Object.values(PS)
                    : screen === "procurement"
                      ? Object.values(RS)
                      : Object.values(OS)
                ).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            )}
            {["catalog", "forecast"].includes(screen) && (
              <>
                <input
                  aria-label="หมวดต้นทุน"
                  name="category"
                  placeholder="หมวดต้นทุน"
                  defaultValue={f.category}
                  maxLength={100}
                />
                <select
                  aria-label="ความผันผวน"
                  name="volatility"
                  defaultValue={f.volatility}
                >
                  <option value="">ความผันผวนทั้งหมด</option>
                  {["ต่ำ", "กลาง", "สูง", "สูงมาก"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </>
            )}
            {screen === "vendors" && (
              <select aria-label="เกรด" name="grade" defaultValue={f.grade}>
                <option value="">เกรดทั้งหมด</option>
                {data.master.grades.map((g) => (
                  <option key={g.name}>{g.name}</option>
                ))}
              </select>
            )}
            <button className="primary" type="submit">
              ค้นหา
            </button>
            <Link
              className="secondary"
              href={`/cpe/${screen}?org=${f.organizationId}`}
            >
              ล้างตัวกรอง
            </Link>
          </form>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {[
                    ["code", screen === "cash" ? "กำหนดชำระ" : "รหัส"],
                    ["name", "รายการ / โครงการ"],
                    ["amount", screen === "vendors" ? "คะแนน" : "มูลค่า (บาท)"],
                    ["status", "สถานะ"],
                  ].map(([column, label]) => (
                    <SortableTableHeader
                      key={column}
                      basePath={`/cpe/${screen}`}
                      column={column}
                      currentSort={f.sort}
                      currentOrder={f.order}
                      params={params}
                      label={label}
                    />
                  ))}
                  <th scope="col">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="cpe-code">{row.code}</td>
                    <td>
                      {screen === "cash" ? <strong>{row.name}</strong> : <Link className="link" href={url(data, { id: row.id, create: "" })} scroll={false} onClick={(event) => openRecord(event, row.id)} aria-haspopup="dialog">{row.name}</Link>}
                      <small className="cpe-sub block">{row.description}</small>
                    </td>
                    <td className="cpe-number">{fmt(row.amount)}</td>
                    <td>
                      <span className="cpe-chip">{row.status}</span>
                      {screen !== "cash" && row.detail && <small className="cpe-sub block">{row.detail}</small>}
                    </td>
                    <td>
                      {screen === "cash" ? (
                        row.status === "ค้างชำระ" &&
                        permission(data, "cpe.cash.manage") ? (
                          <CommandForm
                            type="finance.settle"
                            organizationId={f.organizationId}
                            id={row.id}
                            version={Number(row.detail)}
                            label="บันทึกชำระแล้ว"
                          />
                        ) : null
                      ) : (
                        <Link
                          href={url(data, { id: row.id, create: "" })}
                          className="cpe-detail-link"
                          scroll={false}
                          onClick={(event) => openRecord(event, row.id)}
                          aria-haspopup="dialog"
                          aria-label={`เปิดรายละเอียด ${row.code} ${row.name}`}
                        >
                          <PanelRightOpen size={18} aria-hidden="true" /> เปิดรายละเอียด
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
                {!data.rows.length && (
                  <tr>
                    <td colSpan={5}>
                      <Empty
                        text={
                          f.q
                            ? "ไม่พบข้อมูลตามคำค้น ลองล้างตัวกรอง"
                            : "ยังไม่มีข้อมูล เริ่มเพิ่มรายการเพื่อใช้งาน"
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PageNumberNavigation
            ariaLabel="เปลี่ยนหน้ารายการ CPE"
            previousLabel="ก่อนหน้า"
            nextLabel="ถัดไป"
            basePath={`/cpe/${screen}`}
            itemCount={data.rows.length}
            page={f.page}
            params={params}
            total={data.total}
            totalPages={data.totalPages}
            unit="รายการ"
          />
        </section>
      )}
      {screen === "forecast" && <ForecastSummary data={data} />}
      {screen === "knowledge" && (
        <Knowledge data={data} key={data.masterVersion} />
      )}
      {screen === "procurement" &&
        permission(data, "cpe.procurement.manage") && (
          <Card title="สร้างชุดขอราคาจาก BOQ ของงานที่ได้">
            <RfqGenerator data={data} />
          </Card>
        )}
      {f.id && !create && screen !== "cash" && (
          <Drawer
            key={`detail:${screen}:${f.id}`}
            title={definition.label + " · " + (data.opportunityDetail?.code ?? data.catalogDetail?.code ?? data.vendorDetail?.code ?? data.rfqDetail?.code ?? data.projectDetail?.code ?? "รายละเอียด")}
            onClose={() => navigate(url(data, { id: "" }), true)}
          >
            {["sales", "estimate", "costcheck", "bidsim", "knowledge"].includes(screen) && (
              <OpportunityPanel
                key={data.opportunityDetail?.version}
                data={data}
              />
            )}
            <EntityDetail
              key={`${f.id}:${data.catalogDetail?.version ?? data.vendorDetail?.version ?? data.rfqDetail?.version ?? data.projectDetail?.version}`}
              data={data}
            />
          </Drawer>
        )}
      {create && (
        <Drawer
          key={`create:${screen}`}
          title={
            screen === "sales"
              ? "รับงานใหม่"
              : screen === "catalog"
                ? "เพิ่มฐานต้นทุนกลาง"
                : screen === "vendors"
                  ? "เพิ่มผู้รับเหมา"
                  : "เพิ่มลูกหนี้ / เจ้าหนี้"
          }
          onClose={() => {
            navigate(url(data, { create: "" }), true);
          }}
        >
          <CreateForm
            data={data}
            onSaved={() => {
              navigate(url(data, { create: "" }), true);
            }}
          />
        </Drawer>
      )}
    </div>
  );
}
function Empty({ text = "ยังไม่มีข้อมูล" }: { text?: string }) {
  return (
    <div className="cpe-empty">
      <FolderOpen size={25} />
      <p>{text}</p>
    </div>
  );
}
function CreateForm({
  data,
  onSaved,
}: {
  data: CpePageData;
  onSaved: () => void;
}) {
  const org = data.filters.organizationId,
    master = data.master;
  const common = { organizationId: org, onSaved };
  const people = data.people.map((p) => ({ value: p.id, label: p.name }));
  if (data.screen === "sales")
    return (
      <CommandForm
        {...common}
        type="opportunity.create"
        fields={[
          field("name", "ชื่องาน"),
          field("customer", "ลูกค้า"),
          select(
            "sector",
            "ประเภทลูกค้า",
            options(master.sectors.map((s) => s.name)),
          ),
          select(
            "workType",
            "ประเภทงาน",
            options(master.workTypes.map((w) => w.name)),
          ),
          field("location", "สถานที่"),
          select("unit", "หน่วยขนาดงาน", options(master.units)),
          field("quantity", "ขนาดงาน", undefined, "number"),
          field("cost", "ต้นทุนเบื้องต้น (บาท)", undefined, "number"),
          field("margin", "กำไรที่ต้องการ (%)", undefined, "number"),
          select("ownerId", "ผู้รับผิดชอบฝ่ายขาย", people, data.actorId),
          {
            ...select("estimatorId", "ผู้ประมาณราคา", people),
            required: false,
          },
          field("dueAt", "กำหนดยื่นราคา", undefined, "date"),
          field("technicalNotes", "ข้อมูลเทคนิค", undefined, "textarea", false),
          field("contractNotes", "เงื่อนไขสัญญา", undefined, "textarea", false),
        ]}
      >
        <Note>
          ราคาเสนอ = ต้นทุน ÷ (1 − % กำไร) ·
          โอกาสชนะจะแสดงเมื่อมีประวัติผลประมูลจริง
        </Note>
      </CommandForm>
    );
  if (data.screen === "catalog")
    return (
      <CommandForm
        {...common}
        type="catalog.create"
        fields={[
          field("code", "รหัสวัสดุ"),
          field("name", "ชื่อรายการ"),
          field("category", "หมวดต้นทุน"),
          select("unit", "หน่วยนับ", options(master.units)),
          field("price", "ราคาปัจจุบัน (บาท)", undefined, "number"),
          field("forecastPercent", "คาดการณ์ราคา 90 วัน (%)", 0, "number"),
          select(
            "volatility",
            "ความผันผวน",
            options(["ต่ำ", "กลาง", "สูง", "สูงมาก"]),
          ),
          field("source", "แหล่งที่มาราคา"),
        ]}
      />
    );
  if (data.screen === "vendors")
    return (
      <CommandForm
        {...common}
        type="vendor.create"
        fields={[
          field("code", "รหัสผู้รับเหมา"),
          field("name", "ชื่อผู้รับเหมา"),
          select(
            "workType",
            "ประเภทงาน",
            options(master.workTypes.map((w) => w.name)),
          ),
        ]}
      />
    );
  return (
    <CommandForm
      {...common}
      type="finance.create"
      fields={[
        select("kind", "ประเภท", options(["ลูกหนี้", "เจ้าหนี้"])),
        field("name", "รายละเอียด / คู่ค้า"),
        field("amount", "จำนวนเงิน (บาท)", undefined, "number"),
        field("dueAt", "กำหนดชำระ", undefined, "date"),
      ]}
    />
  );
}
function OpportunityPanel({ data }: { data: CpePageData }) {
  const o = data.opportunityDetail;
  if (!o) return null;
  const org = data.filters.organizationId;
  const common = { organizationId: org, id: o.id, version: o.version };
  const closed = o.status !== OS.active;
  const costGroups = Object.entries(
    o.items.reduce<Record<string, string>>((r, i) => {
      r[i.category] = D(r[i.category] ?? 0)
        .add(D(i.quantity).mul(D(i.material).add(i.labor)))
        .toString();
      return r;
    }, {}),
  );
  return (
    <div className="cpe-detail-stack">
      <Card
        title={`${o.code} · ${o.name}`}
        sub={`${o.customer} · ${o.workType} · ${o.sector} · รุ่น ${o.version}`}
      >
        <div className="cpe-grid three">
          <Kpi label="ราคาเสนอ" value={`${million(o.bid)} ลบ.`} />
          <Kpi label="ต้นทุนรวม" value={`${million(o.cost)} ลบ.`} />
          <Kpi label="ขนาดงาน" value={`${fmt(o.quantity)} ${o.unit}`} />
        </div>
        <p>
          <span className="cpe-chip">{o.status}</span> {o.stage} · {o.location}{" "}
          · กำหนดยื่น {o.dueAt?.slice(0, 10) ?? "—"}
        </p>
        <p>ข้อมูลเทคนิค: {o.technicalNotes || "—"}</p>
        <p>เงื่อนไขสัญญา: {o.contractNotes || "—"}</p>
        {o.reviewedAt ? (
          <p className="cpe-success">
            ยืนยันต้นทุนแล้วเมื่อ{" "}
            {new Date(o.reviewedAt).toLocaleString("th-TH", {
              timeZone: "Asia/Bangkok",
            })}{" "}
            · ผู้ตรวจ{" "}
            {data.people.find((p) => p.id === o.reviewedById)?.name ??
              o.reviewedById}
          </p>
        ) : (
          <Note>ยังไม่ได้ยืนยันผลตรวจต้นทุน</Note>
        )}
        {o.project && (
          <p>
            เปิดโครงการแล้ว:{" "}
            {permission(data, "cpe.projects.view") ? (
              <Link
                className="link"
                href={`/cpe/projects?org=${org}&id=${o.project.id}`}
              >
                {o.project.code}
              </Link>
            ) : (
              o.project.code
            )}
          </p>
        )}
        {o.status === OS.lost && (
          <Note>
            ผู้ชนะ: {o.winner} · ราคา {fmt(o.winnerPrice)} บาท · สาเหตุ:{" "}
            {o.lossReason}
            <p>{o.resultNotes}</p>
          </Note>
        )}
      </Card>
      {data.screen === "estimate" && closed && <Note>งานนี้บันทึกผล “{o.status}” แล้ว จึงแสดงเป็นข้อมูลอ้างอิง การแก้ไข BOQ ใช้กับงานที่ยังอยู่ระหว่างเสนอราคา</Note>}
      {data.screen === "estimate" &&
        !closed &&
        permission(data, "cpe.estimate.manage") && (
          <BoqEditor key={o.version} data={data} />
        )}
      {data.screen !== "estimate" && (
        <Card title="โครงสร้างต้นทุน BOQ รายหมวด">
          <BarList
            rows={costGroups.map(([label, value]) => ({
              label,
              value: Number(value),
              detail: `${fmt(value)} บาท`,
            }))}
          />
          {o.items.length > 0 && (
            <details>
              <summary>ดูรายการ BOQ ({o.items.length})</summary>
              {o.items.map((i) => (
                <p key={i.id}>
                  <strong>
                    {i.code} · {i.description}
                  </strong>
                  <small className="cpe-sub block">
                    {i.category} · {fmt(i.quantity)} {i.unit} × (วัสดุ{" "}
                    {fmt(i.material)} + แรง {fmt(i.labor)}) · {i.source}
                  </small>
                </p>
              ))}
            </details>
          )}
        </Card>
      )}
      {data.screen === "costcheck" && <CostCheck data={data} />}
      {data.screen === "bidsim" && <BidSimulator data={data} />}
      {data.screen === "sales" &&
        !closed &&
        permission(data, "cpe.sales.manage") && (
          <>
            <Card title="ติดตามขั้นตอน">
              <CommandForm
                {...common}
                type="opportunity.stage"
                fields={[
                  select("stage", "ขั้นตอนปัจจุบัน", options(STAGES), o.stage),
                ]}
              />
            </Card>
            <Card title="บันทึกผล · ได้งาน">
              <CommandForm
                {...common}
                type="opportunity.won"
                fields={[
                  field("contractNumber", "เลขที่สัญญา / ใบสั่งจ้าง"),
                  field("contractValue", "มูลค่าสัญญา", o.bid, "number"),
                  field("budget", "งบประมาณต้นทุน", o.cost, "number"),
                  field(
                    "durationMonths",
                    "ระยะเวลา (เดือน)",
                    undefined,
                    "number",
                  ),
                  field("startAt", "วันเริ่มงาน", undefined, "date"),
                  select(
                    "pmId",
                    "ผู้จัดการโครงการ",
                    data.people.map((p) => ({ value: p.id, label: p.name })),
                  ),
                  {
                    name: "generateRfqs",
                    label: "สร้างชุดขอราคาตามหมวด BOQ อัตโนมัติ",
                    type: "checkbox",
                    value: false,
                  },
                ]}
                label="ยืนยันได้งานและเปิดโครงการ"
              />
            </Card>
            <Card title="บันทึกผล · ไม่ได้งาน">
              <CommandForm
                {...common}
                type="opportunity.lost"
                fields={[
                  field("winner", "ผู้ชนะ"),
                  field(
                    "winnerPrice",
                    "ราคาผู้ชนะ (ถ้าทราบ)",
                    undefined,
                    "number",
                    false,
                  ),
                  field("lossReason", "สาเหตุหลักที่ไม่ได้งาน"),
                  field(
                    "notes",
                    "บันทึกเพิ่มเติม",
                    undefined,
                    "textarea",
                    false,
                  ),
                ]}
                label="บันทึกไม่ได้งาน"
              />
            </Card>
          </>
        )}
      {data.screen === "sales" && (
        <Card title="ประวัติการทำรายการ">
          {data.opportunityHistory.map((h) => (
            <p key={h.id}>
              {CPE_ACTION_LABELS[h.action] ?? "ปรับปรุงข้อมูลโครงการ"}
              <span className="cpe-sub block">
                {new Date(h.recordedAt).toLocaleString("th-TH", {
                  timeZone: "Asia/Bangkok",
                })}{" "}
                ·{" "}
                {data.people.find((p) => p.id === h.actorId)?.name ?? h.actorId}
              </span>
            </p>
          ))}
          {!data.opportunityHistory.length && <Empty />}
        </Card>
      )}
      {data.screen === "sales" && (
        <Card title="ความเสี่ยงราคาวัสดุ">
          {o.items
            .filter((i) => i.catalog)
            .map((i) => (
              <p key={i.id}>
                <strong>{i.catalog!.name}</strong>
                <span className="cpe-sub block">
                  ความผันผวน{i.catalog!.volatility} · พยากรณ์ 90 วัน{" "}
                  {fmt(i.catalog!.forecastPercent)}% · ผลต่างราคากลางล่าสุด{" "}
                  {fmt(
                    D(i.quantity)
                      .mul(D(i.catalog!.price).sub(i.material))
                      .toString(),
                  )}{" "}
                  บาท
                </span>
              </p>
            ))}
          {!o.items.some((i) => i.catalog) && (
            <Empty text="ยังไม่มีวัสดุใน BOQ ที่เชื่อมกับฐานต้นทุนกลาง" />
          )}
          {permission(data, "cpe.forecast.view") && (
            <Link className="link" href={`/cpe/forecast?org=${org}`}>
              เปิดพยากรณ์ราคาวัสดุ →
            </Link>
          )}
        </Card>
      )}
    </div>
  );
}
type EditableBoq = {
  category: string;
  code: string;
  description: string;
  unit: string;
  quantity: string;
  material: string;
  labor: string;
  source: string;
  catalogId?: string;
};
function BoqEditor({ data }: { data: CpePageData }) {
  const router = useRouter();
  const o = data.opportunityDetail!;
  const p = data.master.workTypes.find((w) => w.name === o.workType)!;
  const blank = (category = p?.categories[0] ?? ""): EditableBoq => ({
    category,
    code: "",
    description: "",
    unit: data.master.units[0],
    quantity: "1",
    material: "0",
    labor: "0",
    source: "ประมาณราคา",
  });
  const [items, setItems] = useState<EditableBoq[]>(
    o.items.length
      ? o.items.map((i) => ({
          category: i.category,
          code: i.code,
          description: i.description,
          unit: i.unit,
          quantity: i.quantity,
          material: i.material,
          labor: i.labor,
          source: i.source,
          ...(i.catalogId ? { catalogId: i.catalogId } : {}),
        }))
      : p.categories.map((c) => blank(c)),
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState("");
  const update = (index: number, key: keyof EditableBoq, value: string) =>
    setItems((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    );
  let total = "0";
  try {
    total = boqCost(items, p).toString();
  } catch {
    /* incomplete editor values are validated at submit */
  }
  return (
    <Card
      title="แก้ไขประมาณราคา / BOQ"
      sub="แก้จำนวน ค่าวัสดุ และค่าแรงแล้วคำนวณใหม่ทันที · สูงสุด 300 รายการต่อ BOQ"
    >
      <div className="cpe-grid three">
        <Kpi
          label="ต้นทุนรวม (รวมค่าใช้จ่ายและความเสี่ยง)"
          value={fmt(total)}
        />
        <Kpi
          label="ค่าดำเนินการ / ความเสี่ยง"
          value={`${p.overhead}% / ${p.risk}%`}
        />
        <Kpi label="รายการ BOQ" value={items.length} />
      </div>
      <Note>
        {p.categories.filter((c) => !items.some((i) => i.category === c))
          .length > 0
          ? `หมวดมาตรฐานที่ขาด: ${p.categories.filter((c) => !items.some((i) => i.category === c)).join(", ")}`
          : "มีครบทุกหมวดมาตรฐาน"}
        {items.some((i) =>
          D(i.material || 0)
            .add(i.labor || 0)
            .eq(0),
        ) && <p>มีรายการที่ยังไม่ระบุต้นทุน กรุณาตรวจสอบก่อนส่ง</p>}
        {items.flatMap((i, index) => {
          const catalog = data.pickerCatalog.find((c) => c.id === i.catalogId);
          if (!catalog) return [];
          return D(i.material || 0).lt(catalog.price)
            ? [
                <p key={index} className="cpe-danger">
                  {i.description}: ราคาวัสดุต่ำกว่าราคากลางล่าสุด{" "}
                  {fmt(catalog.price)} บาท
                </p>,
              ]
            : D(i.material || 0).gt(catalog.price)
              ? [
                  <p key={index} className="cpe-success">
                    {i.description}: มีโอกาสประหยัดจากราคากลางที่ลดลง
                  </p>,
                ]
              : [];
        })}
      </Note>
      <div className="cpe-boq-toolbar">
        <button
          className="secondary"
          type="button"
          disabled={items.length >= 300}
          onClick={() => setItems((r) => [...r, blank()])}
        >
          + เพิ่มรายการ / หมวดใหม่
        </button>
        <select
          aria-label="เพิ่มจากฐานต้นทุนกลาง"
          value=""
          onChange={(e) => {
            const material = data.pickerCatalog.find(
              (m) => m.id === e.target.value,
            );
            if (material)
              setItems((r) => [
                ...r,
                {
                  ...blank(),
                  code: material.code,
                  description: material.name,
                  unit: material.unit,
                  material: material.price,
                  source: material.source,
                  catalogId: material.id,
                },
              ]);
          }}
          disabled={items.length >= 300}
        >
          <option value="">เพิ่มจากฐานต้นทุนกลาง (100 รายการแรก)</option>
          {data.pickerCatalog.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.name}
            </option>
          ))}
        </select>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            await sendCommand({
              type: "boq.save",
              organizationId: data.filters.organizationId,
              id: o.id,
              version: o.version,
              items,
            });
            setMessage("บันทึก BOQ สำเร็จ");
            router.refresh();
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "บันทึกไม่สำเร็จ",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="table-wrap">
          <table className="table cpe-boq-table">
            <caption className="sr-only">รายการประมาณราคา BOQ</caption>
            <thead>
              <tr>
                {[
                  "หมวดงาน",
                  "รหัส / รายละเอียด",
                  "หน่วย",
                  "ปริมาณ",
                  "วัสดุ/หน่วย",
                  "แรง/หน่วย",
                  "รวม (บาท)",
                  "แหล่งราคา",
                  "จัดการ",
                ].map((t) => (
                  <th key={t} scope="col">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>
                    <input
                      aria-label={`หมวดงานแถว ${index + 1}`}
                      value={item.category}
                      onChange={(e) =>
                        update(index, "category", e.target.value)
                      }
                      required
                      maxLength={100}
                      list="cpe-categories"
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`รหัสแถว ${index + 1}`}
                      value={item.code}
                      onChange={(e) => update(index, "code", e.target.value)}
                      required
                      maxLength={64}
                    />
                    <input
                      aria-label={`รายละเอียดแถว ${index + 1}`}
                      value={item.description}
                      onChange={(e) =>
                        update(index, "description", e.target.value)
                      }
                      required
                      maxLength={500}
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`หน่วยแถว ${index + 1}`}
                      value={item.unit}
                      onChange={(e) => update(index, "unit", e.target.value)}
                    >
                      {data.master.units.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </td>
                  {(["quantity", "material", "labor"] as const).map((key) => (
                    <td key={key}>
                      <input
                        aria-label={`${key} แถว ${index + 1}`}
                        type="number"
                        min={key === "quantity" ? 0.0001 : 0}
                        max="99999999999999"
                        step="0.0001"
                        value={item[key]}
                        onChange={(e) => update(index, key, e.target.value)}
                        required
                      />
                    </td>
                  ))}
                  <td className="cpe-number">
                    {fmt(
                      D(item.quantity || 0)
                        .mul(D(item.material || 0).add(item.labor || 0))
                        .toString(),
                    )}
                  </td>
                  <td>
                    <input
                      aria-label={`ที่มาราคาแถว ${index + 1}`}
                      value={item.source}
                      onChange={(e) => update(index, "source", e.target.value)}
                      required
                      maxLength={255}
                    />
                  </td>
                  <td>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() =>
                        setItems((r) => r.filter((_, i) => i !== index))
                      }
                      aria-label={`ลบรายการ ${item.description || index + 1}`}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <datalist id="cpe-categories">
          {p.categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </datalist>
        <div className="cpe-form-footer">
          <button
            className="primary"
            type="submit"
            disabled={busy || !items.length}
          >
            {busy ? "กำลังบันทึก…" : "บันทึก BOQ และคำนวณต้นทุนใหม่"}
          </button>
          <span role="status">{message}</span>
        </div>
      </form>
      <details>
        <summary>คัดลอก BOQ จากงานเดิม</summary>
        <select
          aria-label="เลือกงานต้นทาง"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">เลือกงาน</option>
          {data.pickerOpps
            .filter((s) => s.id !== o.id)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name} ({s.unit})
              </option>
            ))}
        </select>
        <CommandForm
          type="boq.copy"
          organizationId={data.filters.organizationId}
          id={o.id}
          version={o.version}
          extra={{ sourceId: source }}
          fields={[
            {
              name: "scale",
              label: "ปรับปริมาณตามสัดส่วนขนาดงาน (ต้องเป็นหน่วยเดียวกัน)",
              type: "checkbox",
              value: true,
            },
          ]}
          label="คัดลอกแทน BOQ ปัจจุบัน"
        />
      </details>
    </Card>
  );
}
function CostCheck({ data }: { data: CpePageData }) {
  const o = data.opportunityDetail!;
  const org = data.filters.organizationId;
  const p = data.master.workTypes.find((w) => w.name === o.workType)!;
  const factor = D(1).add(D(p.overhead).add(p.risk).div(100));
  const categories = [...new Set(o.items.map((i) => i.category))];
  const rows = categories.map((category) => {
    const cost = sum(
      o.items
        .filter((i) => i.category === category)
        .map((i) => D(i.quantity).mul(D(i.material).add(i.labor))),
    ).mul(factor);
    const unit = cost.div(o.quantity);
    const refs = data.references.flatMap((r) => {
      const cats = r.actualCategories as Record<string, string> | null;
      return cats?.[category]
        ? [D(cats[category]).div(r.opportunity.quantity)]
        : [];
    });
    const reference = refs.length ? sum(refs).div(refs.length) : null;
    return {
      category,
      cost,
      unit,
      reference,
      band: reference
        ? costBand(unit, reference, data.master.tolerance.category)
        : null,
    };
  });
  const actuals = data.references.map((r) =>
    sum(r.months.map((m) => m.cashOut)).div(r.opportunity.quantity),
  );
  const avg = actuals.length ? sum(actuals).div(actuals.length) : null;
  return (
    <>
      <div className="cpe-grid three">
        <Kpi
          label="ต้นทุนต่อหน่วยของเรา"
          value={fmt(D(o.cost).div(o.quantity).toString())}
          detail={`บาท/${o.unit}`}
        />
        <Kpi
          label="ต้นทุนจริงเฉลี่ยงานใกล้เคียง"
          value={avg ? fmt(avg.toString()) : "ยังไม่มีงานอ้างอิง"}
        />
        <Kpi
          label="เกณฑ์ที่ยอมรับ (รวม / รายหมวด)"
          value={`±${data.master.tolerance.total}% / ±${data.master.tolerance.category}%`}
        />
      </div>
      <Card
        title="เทียบต้นทุนรายหมวดกับงานที่ปิดแล้ว"
        sub={`ใช้ต้นทุนจริงของงานประเภทเดียวกันและหน่วยตรงกัน · ล่าสุดไม่เกิน 100 โครงการ`}
      >
        {rows.map((r) => (
          <div className="cpe-comparison" key={r.category}>
            <div>
              <strong>{r.category}</strong>
              <p>
                ต้นทุน {fmt(r.cost.toString())} บาท · ต่อหน่วย{" "}
                {fmt(r.unit.toString())}
              </p>
              <p>
                อ้างอิง {r.reference ? fmt(r.reference.toString()) : "—"} ·
                ส่วนต่าง {r.band?.deviation ?? "—"}%
              </p>
            </div>
            <span className="cpe-chip">
              {r.band?.label ?? "ไม่มีข้อมูลอ้างอิง"}
            </span>
            {r.reference &&
              o.status === OS.active &&
              permission(data, "cpe.estimate.manage") && (
                <CommandForm
                  type="cost.reference"
                  organizationId={org}
                  id={o.id}
                  version={o.version}
                  extra={{ category: r.category }}
                  label="ปรับเท่าค่าอ้างอิง"
                />
              )}
          </div>
        ))}
        {!rows.length && <Empty text="ยังไม่มี BOQ ให้ตรวจต้นทุน" />}
        {!data.references.length && (
          <Note>
            ยังไม่มีโครงการที่ปิดงานและบันทึกต้นทุนจริงของประเภทงานและหน่วยนี้
            จึงยังเปรียบเทียบค่าอ้างอิงไม่ได้
          </Note>
        )}
        {o.status === OS.active &&
          permission(data, "cpe.costcheck.approve") && (
            <CommandForm
              type="cost.approve"
              organizationId={org}
              id={o.id}
              version={o.version}
              label="ยืนยันผลตรวจและส่งให้ฝ่ายขาย"
            />
          )}
      </Card>
      <Card title="โครงการอ้างอิง">
        {data.references.map((r) => (
          <p key={r.id}>
            <strong>
              {r.code} · {r.opportunity.name}
            </strong>
            <span className="cpe-sub block">
              {fmt(r.opportunity.quantity)} {r.opportunity.unit} · ประเมิน{" "}
              {fmt(D(r.budget).div(r.opportunity.quantity).toString())}{" "}
              บาท/หน่วย · จริง{" "}
              {fmt(
                sum(r.months.map((m) => m.cashOut))
                  .div(r.opportunity.quantity)
                  .toString(),
              )}{" "}
              บาท/หน่วย
            </span>
          </p>
        ))}
        {!data.references.length && <Empty />}
      </Card>
    </>
  );
}
function BidSimulator({ data }: { data: CpePageData }) {
  const o = data.opportunityDetail!;
  const master = data.master;
  const policy = master.workTypes.find((w) => w.name === o.workType)!;
  const [margin, setMargin] = useState(Number(o.margin));
  const history = data.model;
  const adjustment =
    master.sectors.find((s) => s.name === o.sector)?.adjustment ?? 0;
  const probability = winProbability(
    margin,
    history,
    adjustment,
    master.bidding,
  );
  const bid = bidPrice(o.cost, margin);
  const profit = bid.sub(o.cost);
  const expected =
    probability === null ? null : profit.mul(D(probability).div(100));
  const candidates = Array.from(
    {
      length: Math.max(
        1,
        Math.floor((Math.max(30, policy.target) - policy.minimum) * 2) + 1,
      ),
    },
    (_, i) => Math.min(99, policy.minimum + i / 2),
  );
  const best = candidates.reduce((best, m) => {
    const value = (x: number) =>
      bidPrice(o.cost, x)
        .sub(o.cost)
        .mul(
          (winProbability(x, history, adjustment, master.bidding) ?? 0) / 100,
        );
    return value(m).gt(value(best)) ? m : best;
  }, policy.minimum);
  return (
    <>
      <Card title="ตั้งราคาเสนอและโอกาสชนะ">
        <label className="cpe-slider-label">
          กำไรที่ต้องการ <strong>{margin.toFixed(1)}%</strong>
          <input
            aria-label="กำไรที่ต้องการ"
            type="range"
            min={0}
            max={Math.min(99, Math.max(30, policy.target + 10))}
            step="0.5"
            value={margin}
            onChange={(e) => setMargin(Number(e.target.value))}
          />
        </label>
        <div className="cpe-button-row">
          {[
            ["ขั้นต่ำ", policy.minimum],
            ["จุดคุ้มที่สุด", best],
            ["เป้าหมาย", policy.target],
            ["ราคาปัจจุบัน", Number(o.margin)],
          ].map(([label, value]) => (
            <button
              className="secondary"
              key={String(label)}
              type="button"
              disabled={label === "จุดคุ้มที่สุด" && !history.count}
              onClick={() => setMargin(Number(value))}
            >
              {label} {value}%
            </button>
          ))}
        </div>
        <div className="cpe-grid five">
          <Kpi label="ราคาเสนอ" value={fmt(bid.toString())} />
          <Kpi label="กำไรขั้นต้น" value={fmt(profit.toString())} />
          <Kpi
            label="โอกาสชนะ"
            value={
              probability === null ? "รอประวัติจริง" : `${fmt(probability, 1)}%`
            }
          />
          <Kpi
            label="กำไรคาดหวัง"
            value={expected ? fmt(expected.toString()) : "—"}
          />
          <Kpi
            label="ราคาต่อหน่วย"
            value={fmt(bid.div(o.quantity).toString())}
          />
        </div>
        <Note>
          แบบจำลองเชิงประมาณจากผลประมูลจริงทุกงานประเภทงานเดียวกัน
          ปรับตามกลุ่มลูกค้า {history.count} ตัวอย่าง ·
          ไม่มีข้อมูลจะไม่แสดงโอกาสชนะ ·
          ต้องผ่านการตรวจต้นทุนและนโยบายกำไรขั้นต่ำก่อนบันทึก
        </Note>
        {o.status === OS.active && permission(data, "cpe.bidsim.manage") && (
          <CommandForm
            type="bid.save"
            organizationId={data.filters.organizationId}
            id={o.id}
            version={o.version}
            extra={{ margin }}
            label="ใช้ราคานี้เป็นราคาเสนอ"
          />
        )}
      </Card>
      <div className="cpe-grid two">
        <Card title="โอกาสชนะตามกำไร">
          <LineChart
            title="โอกาสชนะตามกำไร"
            labels={candidates.map((m) => `${m}%`)}
            series={[
              {
                label: "โอกาสชนะ (%)",
                color: "#2c8461",
                values: candidates.map((m) =>
                  winProbability(m, history, adjustment, master.bidding),
                ),
              },
            ]}
          />
        </Card>
        <Card title="กำไรคาดหวังตามกำไร">
          <LineChart
            title="กำไรคาดหวัง"
            labels={candidates.map((m) => `${m}%`)}
            series={[
              {
                label: "กำไรคาดหวัง (บาท)",
                color: "#e39b1f",
                values: candidates.map((m) => {
                  const p = winProbability(
                    m,
                    history,
                    adjustment,
                    master.bidding,
                  );
                  return p === null
                    ? null
                    : Number(
                        bidPrice(o.cost, m)
                          .sub(o.cost)
                          .mul(p / 100),
                      );
                }),
              },
            ]}
          />
        </Card>
      </div>
      <Card
        title="ราคาเดิม · งานชนะและแพ้"
        sub="แสดงเฉพาะประวัติที่หน่วยขนาดงานตรงกัน"
      >
        <Scatter
          points={data.history
            .filter((h) => h.unit === o.unit)
            .map((h) => ({
              label: h.name,
              x: Number(D(h.bid).div(h.quantity)),
              y: Number(h.margin),
              won: h.status === OS.won,
            }))}
        />
        <div className="cpe-history-list">
          {data.history
            .filter((h) => h.unit === o.unit)
            .map((h) => (
              <p key={h.id}>
                {h.code} · {h.name}
                <span>
                  {h.status} · กำไร {fmt(h.margin)}% · ราคา/หน่วย{" "}
                  {fmt(D(h.bid).div(h.quantity).toString())}
                </span>
              </p>
            ))}
        </div>
      </Card>
    </>
  );
}
function EntityDetail({ data }: { data: CpePageData }) {
  const org = data.filters.organizationId;
  const c = data.catalogDetail,
    v = data.vendorDetail,
    r = data.rfqDetail,
    p = data.projectDetail;
  if (c) {
    const common = { organizationId: org, id: c.id, version: c.version };
    const prices = [...c.prices].reverse();
    return (
      <div className="cpe-detail-stack">
        <Card
          title={`${c.code} · ${c.name}`}
          sub={`${c.category} · ${c.unit} · ความผันผวน${c.volatility}`}
        >
          <div className="cpe-grid three">
            <Kpi label="ราคาปัจจุบัน" value={fmt(c.price)} />
            <Kpi label="พยากรณ์ 90 วัน" value={`${fmt(c.forecastPercent)}%`} />
            <Kpi label="BOQ ที่ต้องทบทวนราคา" value={data.catalogAffected} />
          </div>
          <p>
            ที่มา {c.source} · อัปเดต{" "}
            {new Date(c.updatedAt).toLocaleString("th-TH", {
              timeZone: "Asia/Bangkok",
            })}
          </p>
          <LineChart
            title="ราคาย้อนหลัง 6 เดือนและคาดการณ์ 90 วัน"
            labels={[
              ...prices.map((p) => p.recordedAt.slice(0, 10)),
              "+90 วัน",
            ]}
            series={[
              {
                label: "ราคาบันทึกจริง",
                color: "#25473d",
                values: [...prices.map((p) => Number(p.price)), null],
              },
              {
                label: "คาดการณ์",
                color: "#e39b1f",
                values: [
                  ...prices.map((p, i) =>
                    i === prices.length - 1 ? Number(p.price) : null,
                  ),
                  Number(
                    D(c.price).mul(D(1).add(D(c.forecastPercent).div(100))),
                  ),
                ],
              },
            ]}
          />
          <p>
            ช่วงราคาจากผู้ขาย:{" "}
            {c.prices.some((p) => p.vendorId)
              ? `${fmt(Math.min(...c.prices.filter((p) => p.vendorId).map((p) => Number(p.price))))} – ${fmt(Math.max(...c.prices.filter((p) => p.vendorId).map((p) => Number(p.price))))} บาท`
              : "ยังไม่มีราคาจากผู้ขายที่ระบุชื่อ"}
          </p>
          <Note>
            ราคาพยากรณ์มาจาก % ที่ผู้ดูแลราคาและแหล่งข้อมูลกำหนด
            ไม่ใช่ข้อมูลตลาดอัตโนมัติ
          </Note>
          {permission(data, "cpe.catalog.manage") && (
            <CommandForm
              {...common}
              type="catalog.price"
              fields={[
                field("price", "ราคาใหม่", c.price, "number"),
                field("source", "แหล่งที่มาราคา", c.source),
                field(
                  "forecastPercent",
                  "พยากรณ์ 90 วัน (%)",
                  c.forecastPercent,
                  "number",
                ),
                {
                  ...select(
                    "vendorId",
                    "ผู้เสนอราคา (ถ้ามี)",
                    data.pickerVendors.map((v) => ({
                      value: v.id,
                      label: v.name,
                    })),
                  ),
                  required: false,
                },
              ]}
              label="บันทึกราคาและแหล่งอ้างอิง"
            />
          )}
        </Card>
        <Card
          title="ผลกระทบต่อ BOQ ที่กำลังเสนอ"
          sub="แสดงไม่เกิน 100 รายการที่เกี่ยวข้อง"
        >
          {c.boqItems.map((i) => {
            const impact = D(i.quantity).mul(D(c.price).sub(i.material));
            return (
              <p key={i.id}>
                {i.opportunity.code} · {i.opportunity.name}
                <strong className={impact.gt(0) ? "cpe-danger" : "cpe-success"}>
                  {" "}
                  {fmt(impact.toString())} บาท
                </strong>
              </p>
            );
          })}
          {!c.boqItems.length && <Empty />}
        </Card>
      </div>
    );
  }
  if (v) {
    const wonQuotes = v.quotes.filter((q) => q.rfq.awardedQuoteId === q.id);
    return (
      <div className="cpe-detail-stack">
        <Card title={`${v.code} · ${v.name}`}>
          <div className="cpe-grid three">
            <Kpi label="คะแนนถ่วงน้ำหนัก" value={fmt(v.score)} />
            <Kpi
              label="เกรด / สถานะ"
              value={v.suspended ? "ระงับ" : (v.grade ?? "ยังไม่ประเมิน")}
            />
            <Kpi
              label="มูลค่างานสะสมที่ได้รับ"
              value={fmt(data.vendorStats.total)}
            />
          </div>
          <p>
            {v.workType} · ได้รับงานสะสม {data.vendorStats.count} งาน ·
            ใช้งานล่าสุด {data.vendorStats.lastAward?.slice(0, 10) ?? "—"} ·
            รายละเอียดแสดงล่าสุดไม่เกิน 100 รายการ
          </p>
          {permission(data, "cpe.vendors.manage") && (
            <CommandForm
              type="vendor.evaluate"
              organizationId={org}
              id={v.id}
              version={v.version}
              fields={[
                ...data.master.dimensions.map((d) => ({
                  ...field(
                    d.key,
                    `${d.name} (${d.weight}%)`,
                    (v.scores as Record<string, number>)[d.key] ?? 0,
                    "number",
                  ),
                  group: "scores",
                  min: 0,
                  max: 100,
                })),
                {
                  name: "suspended",
                  label: "ระงับการเชิญเข้าขอราคา",
                  type: "checkbox",
                  value: v.suspended,
                },
              ]}
              label="บันทึกผลประเมินและคำนวณเกรด"
            >
              <BarList
                rows={data.master.dimensions.map((d) => ({
                  label: d.name,
                  value: d.weight,
                  detail: `น้ำหนัก ${d.weight}%`,
                }))}
              />
            </CommandForm>
          )}
        </Card>
        <Card title="ผลงานและ PO ที่ได้รับ">
          {wonQuotes.map((q) => (
            <p key={q.id}>
              {q.rfq.code} · {q.rfq.opportunity.name}
              <strong> {fmt(q.price)} บาท</strong>
            </p>
          ))}
          {!wonQuotes.length && <Empty />}
        </Card>
      </div>
    );
  }
  if (r) {
    const common = { organizationId: org, id: r.id, version: r.version };
    return (
      <div className="cpe-detail-stack">
        <Card
          title={`${r.code} · ${r.name}`}
          sub={`${r.opportunity.code} · ${r.opportunity.name}`}
        >
          <div className="cpe-grid three">
            <Kpi label="ต้นทุนกลาง / งบ" value={fmt(r.budget)} />
            <Kpi label="ราคาเสนอต่ำสุด" value={fmt(r.quotes[0]?.price)} />
            <Kpi
              label="ส่วนต่างต่ำสุดเทียบงบ"
              value={
                r.quotes[0]
                  ? fmt(D(r.budget).sub(r.quotes[0].price).toString())
                  : "—"
              }
            />
          </div>
          <p>
            ต้องใช้ {r.needAt.slice(0, 10)} · {r.status}{" "}
            {r.poNumber && `· ${r.poNumber}`}
          </p>
          <p>เอกสารครบ {(r.documents as string[]).length} / 5</p>
          {!r.awardedQuoteId && permission(data, "cpe.procurement.manage") && (
            <CommandForm
              {...common}
              type="rfq.documents"
              fields={[
                {
                  name: "documents",
                  label: "เอกสารที่พร้อมสำหรับขอราคา",
                  type: "checks",
                  options: options(DOCUMENTS),
                  value: r.documents as string[],
                },
              ]}
            >
              <Note>
                รายการที่รองรับ: {DOCUMENTS.join(", ")} ·
                ระบุเฉพาะเอกสารที่พร้อมจริง
              </Note>
            </CommandForm>
          )}
        </Card>
        <Card title="เปรียบเทียบราคาและเลือกผู้รับเหมา">
          {r.quotes.map((q) => (
            <div className="cpe-comparison" key={q.id}>
              <div>
                <h3>
                  {q.vendor.code} · {q.vendor.name}
                </h3>
                <p>
                  <strong>{fmt(q.price)} บาท</strong> · ต่างจากงบ{" "}
                  {fmt(D(r.budget).sub(q.price).toString())} บาท
                </p>
                <p>
                  ส่งมอบ {q.days} วัน · {q.paymentTerms} · ยืนราคา{" "}
                  {q.validityDays} วัน · คะแนน {fmt(q.vendor.score)}
                </p>
                <p className="cpe-sub">{q.notes}</p>
                {q.validityDays < data.master.purchasing.shortValidityDays && (
                  <p className="cpe-danger">
                    ยืนราคาสั้นกว่า {data.master.purchasing.shortValidityDays}{" "}
                    วัน
                  </p>
                )}
                {(q.vendor.score === null ||
                  Number(q.vendor.score) < data.master.purchasing.lowScore) && (
                  <p className="cpe-danger">
                    ยังไม่ประเมินหรือคะแนนต่ำกว่า{" "}
                    {data.master.purchasing.lowScore}
                  </p>
                )}
                {q.vendor.suspended && (
                  <p className="cpe-danger">ผู้รับเหมาถูกระงับ</p>
                )}
              </div>
              {r.awardedQuoteId === q.id ? (
                <span className="cpe-chip">ผู้ได้รับ PO</span>
              ) : (
                !r.awardedQuoteId &&
                permission(data, "cpe.procurement.award") && (
                  <CommandForm
                    {...common}
                    type="rfq.award"
                    extra={{ quoteId: q.id }}
                    label="เลือกและออก PO"
                  />
                )
              )}
            </div>
          ))}
          {!r.quotes.length && <Empty text="ยังไม่มีใบเสนอราคา" />}
        </Card>
        {!r.awardedQuoteId && permission(data, "cpe.procurement.manage") && (
          <Card title="บันทึกใบเสนอราคาจากผู้รับเหมา">
            <CommandForm
              {...common}
              type="rfq.quote"
              fields={[
                select(
                  "vendorId",
                  "ผู้รับเหมาที่ยังไม่ถูกระงับ",
                  data.pickerVendors.map((v) => ({
                    value: v.id,
                    label: `${v.code} · ${v.name}`,
                  })),
                ),
                field("price", "ราคาเสนอ (บาท)", undefined, "number"),
                field("days", "ระยะเวลาส่งมอบ (วัน)", undefined, "number"),
                field("paymentTerms", "เงื่อนไขชำระเงิน"),
                field("validityDays", "ยืนราคา (วัน)", undefined, "number"),
                field("notes", "หมายเหตุ", undefined, "textarea", false),
              ]}
            />
          </Card>
        )}
      </div>
    );
  }
  if (p) return <ProjectDetail data={data} />;
  return null;
}
function ProjectDetail({ data }: { data: CpePageData }) {
  const p = data.projectDetail!;
  const org = data.filters.organizationId;
  const paid = sum(p.months.map((m) => m.cashOut));
  const received = sum(p.months.map((m) => m.cashIn));
  const awarded = p.opportunity.rfqs.flatMap((r) =>
    r.quotes.filter((q) => r.awardedQuoteId === q.id),
  );
  const commitment = sum(awarded.map((q) => q.price));
  const allocated = sum(
    p.months.flatMap((m) =>
      Object.values(m.poPayments as Record<string, string>),
    ),
  );
  const outstanding = PrismaMax(D(0), commitment.sub(allocated));
  const latest = p.months.filter((m) => m.actualPercent !== null).at(-1);
  const progress = latest?.actualPercent ?? "0";
  const currentMonth = Math.min(
    p.durationMonths,
    Math.max(
      1,
      (new Date(data.asOfBangkok).getUTCFullYear() -
        new Date(p.startAt).getUTCFullYear()) *
        12 +
        new Date(data.asOfBangkok).getUTCMonth() -
        new Date(p.startAt).getUTCMonth() +
        1,
    ),
  );
  const planned =
    p.months.find((m) => m.month === currentMonth)?.plannedPercent ?? "0";
  return (
    <div className="cpe-detail-stack">
      <Card
        title={`${p.code} · ${p.opportunity.name}`}
        sub={`${p.contractNumber} · ${p.status} · ${p.startAt.slice(0, 10)} · ${p.durationMonths} เดือน`}
      >
        <div className="cpe-grid three">
          <Kpi label="มูลค่าสัญญา" value={fmt(p.contractValue)} />
          <Kpi label="งบต้นทุน" value={fmt(p.budget)} />
          <Kpi
            label="จ่ายจริง + ผูกพันคงเหลือ"
            value={fmt(paid.add(outstanding).toString())}
          />
          <Kpi
            label="Backlog ตามความคืบหน้า"
            value={fmt(
              D(p.contractValue)
                .mul(D(1).sub(D(progress).div(100)))
                .toString(),
            )}
          />
          <Kpi label="รับเงินสะสม" value={fmt(received.toString())} />
          <Kpi
            label="สถานะความคืบหน้า"
            value={D(progress).lt(planned) ? "ช้ากว่าแผน" : "ตามแผน"}
            detail={`จริง ${fmt(progress)}% / แผน ${fmt(planned)}%`}
          />
        </div>
        <p>
          ภาระผูกพันคงเหลือ {fmt(outstanding.toString())} บาท · คำนวณจาก PO
          หักยอดชำระที่จัดสรรราย PO
        </p>
      </Card>
      <Card title="S-Curve แผนและจริง">
        <LineChart
          title="ความคืบหน้าแผนและจริง"
          labels={p.months.map((m) => String(m.month))}
          series={[
            {
              label: "แผน (%)",
              color: "#9aada5",
              values: p.months.map((m) => Number(m.plannedPercent)),
            },
            {
              label: "จริง (%)",
              color: "#2c8461",
              values: p.months.map((m) =>
                m.actualPercent === null ? null : Number(m.actualPercent),
              ),
            },
          ]}
        />
      </Card>
      <Card title="ต้นทุนสะสมและเงินสดโครงการ">
        <LineChart
          title="เงินเข้าออกและเงินสดสะสม"
          labels={p.months.map((m) => `ด.${m.month}`)}
          series={[
            {
              label: "เงินรับ",
              color: "#2c8461",
              values: p.months.map((m) => Number(m.cashIn)),
            },
            {
              label: "เงินจ่าย",
              color: "#b8443a",
              values: p.months.map((m) => Number(m.cashOut)),
            },
            {
              label: "ต้นทุนจ่ายสะสม",
              color: "#e39b1f",
              values: p.months.map((_, i) =>
                Number(sum(p.months.slice(0, i + 1).map((m) => m.cashOut))),
              ),
            },
            {
              label: "เงินสดสะสม",
              color: "#2c6e8f",
              values: p.months.map((_, i) =>
                Number(
                  sum(
                    p.months
                      .slice(0, i + 1)
                      .map((m) => D(m.cashIn).sub(m.cashOut)),
                  ),
                ),
              ),
            },
          ]}
        />
      </Card>
      <Card title="ผู้รับเหมาในโครงการ">
        {awarded.map((q) => (
          <p key={q.id}>
            {q.vendor.name} · {fmt(q.price)} บาท
          </p>
        ))}
        {!awarded.length && <Empty />}
      </Card>
      <Card title="ความเสี่ยงและแนวทางจัดการ">
        <p>{p.risks || "ยังไม่ได้บันทึก"}</p>
      </Card>
      {p.status === PS.active &&
        p.pmId === data.actorId &&
        permission(data, "cpe.projects.manage") && (
          <>
            <ProjectMonthForm key={p.version} data={data} />
            <Card title="ปิดงานและบันทึกต้นทุนจริงรายหมวด">
              <CommandForm
                type="project.close"
                organizationId={org}
                id={p.id}
                version={p.version}
                fields={[
                  ...[
                    ...new Set([
                      ...(data.master.workTypes.find(
                        (w) => w.name === p.opportunity.workType,
                      )?.categories ?? []),
                      ...p.opportunity.items.map((i) => i.category),
                    ]),
                  ].map((c) => ({
                    ...field(
                      c,
                      `${c} (บาท)`,
                      (p.actualCategories as Record<string, string> | null)?.[
                        c
                      ] ?? "0",
                      "number",
                    ),
                    group: "actualCategories",
                    min: 0,
                  })),
                ]}
                label="ยืนยันปิดงานและส่งเข้าคลังอ้างอิง"
              />
            </Card>
          </>
        )}
    </div>
  );
}
function ProjectMonthForm({ data }: { data: CpePageData }) {
  const p = data.projectDetail!;
  const [month, setMonth] = useState(1);
  const m = p.months.find((m) => m.month === month)!;
  return (
    <Card title="บันทึกความคืบหน้าและเงินเข้าออก">
      <label>
        เดือนที่{" "}
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {p.months.map((m) => (
            <option key={m.month} value={m.month}>
              {m.month}
            </option>
          ))}
        </select>
      </label>
      <CommandForm
        key={month}
        type="project.month"
        organizationId={data.filters.organizationId}
        id={p.id}
        version={p.version}
        extra={{ month }}
        fields={[
          field(
            "actualPercent",
            "ความคืบหน้าสะสม (%)",
            m.actualPercent ?? 0,
            "number",
          ),
          field("cashIn", "เงินรับจริง (บาท)", m.cashIn, "number"),
          field("cashOut", "เงินจ่ายจริง (บาท)", m.cashOut, "number"),
          field(
            "forecastIn",
            "เงินรับประมาณการเพิ่มเติม (บาท)",
            m.forecastIn,
            "number",
          ),
          field(
            "forecastOut",
            "เงินจ่ายประมาณการเพิ่มเติม (บาท)",
            m.forecastOut,
            "number",
          ),
          ...p.opportunity.rfqs
            .filter((r) => r.awardedQuoteId)
            .map((r) => ({
              ...field(
                r.id,
                `จ่ายตาม ${r.poNumber} · ${r.name} (บาท)`,
                (m.poPayments as Record<string, string>)[r.id] ?? "0",
                "number",
              ),
              group: "poPayments",
              min: 0,
            })),
          field(
            "risks",
            "ความเสี่ยงและวิธีจัดการ",
            p.risks ?? "",
            "textarea",
            false,
          ),
        ]}
      />
    </Card>
  );
}
function PrismaMax(a: ReturnType<typeof D>, b: ReturnType<typeof D>) {
  return a.gt(b) ? a : b;
}
function ForecastSummary({ data }: { data: CpePageData }) {
  const c = data.catalogDetail;
  if (!c) return null;
  const impact = D(c.price).mul(D(c.forecastPercent).div(100));
  return (
    <div className="cpe-grid two">
      <Card title={`ดัชนีราคา · ${c.name}`}>
        <div className="cpe-grid three">
          <Kpi label="ราคาฐาน" value={fmt(c.price)} />
          <Kpi
            label="คาดการณ์ 90 วัน"
            value={fmt(D(c.price).add(impact).toString())}
          />
          <Kpi
            label="คำแนะนำตามแนวโน้ม"
            value={
              Number(c.forecastPercent) > 0
                ? "พิจารณาซื้อเลย"
                : "รอได้ / ทบทวนราคา"
            }
          />
        </div>
        <Note>
          คำแนะนำอ้างอิง % พยากรณ์ที่บันทึกโดยผู้ดูแล
          ต้องตรวจเงื่อนไขส่งมอบและเงินสดก่อนตัดสินใจซื้อ
        </Note>
      </Card>
      <Card
        title="ผลกระทบกำไรของแต่ละงาน"
        sub="วัสดุที่เลือก · สูงสุด 100 รายการ BOQ"
      >
        {c.boqItems.map((i) => {
          const delta = D(i.quantity).mul(impact);
          return (
            <p key={i.id}>
              <strong>
                {i.opportunity.code} · {i.opportunity.name}
              </strong>
              <span className="cpe-sub block">
                ต้นทุนเพิ่ม {fmt(delta.toString())} บาท · กำไรคงเหลือ{" "}
                {fmt(
                  D(i.opportunity.bid)
                    .mul(D(i.opportunity.margin).div(100))
                    .sub(delta)
                    .toString(),
                )}{" "}
                บาท (ผลกระทบจากรายการนี้)
              </span>
            </p>
          );
        })}
        {!c.boqItems.length && <Empty />}
      </Card>
    </div>
  );
}
function CashChart({ data }: { data: CpePageData }) {
  return (
    <LineChart
      title="กระแสเงินสดบริษัทจริงและประมาณการ"
      labels={data.monthly.map((m) => m.month)}
      series={[
        {
          label: "รับจริง",
          color: "#2c8461",
          values: data.monthly.map((m) => Number(m.cashIn)),
        },
        {
          label: "จ่ายจริง",
          color: "#b8443a",
          values: data.monthly.map((m) => Number(m.cashOut)),
        },
        {
          label: "รับประมาณการเพิ่มเติม",
          color: "#2c6e8f",
          values: data.monthly.map((m) => Number(m.forecastIn)),
        },
        {
          label: "จ่ายประมาณการเพิ่มเติม",
          color: "#e39b1f",
          values: data.monthly.map((m) => Number(m.forecastOut)),
        },
      ]}
    />
  );
}
function FinanceOverview({ data }: { data: CpePageData }) {
  const projected = data.monthly.map((_, i) =>
    D(data.currentCash).add(
      sum(
        data.monthly
          .slice(0, i + 1)
          .map((m) => D(m.forecastIn).sub(m.forecastOut)),
      ),
    ),
  );
  const low = projected.reduce(
    (min, v) => (v.lt(min) ? v : min),
    D(data.currentCash),
  );
  return (
    <>
      <div className="cpe-grid five">
        <Kpi label="เงินสดคงเหลือ" value={`${million(data.currentCash)} ลบ.`} />
        <Kpi
          label="จุดต่ำสุดที่คาดการณ์"
          value={`${million(low.toString())} ลบ.`}
        />
        <Kpi
          label="ลูกหนี้ค้างรับ"
          value={`${million(data.receivables.find((r) => r.kind === "ลูกหนี้")?._sum.amount ?? 0)} ลบ.`}
        />
        <Kpi
          label="เจ้าหนี้ค้างจ่าย"
          value={`${million(data.receivables.find((r) => r.kind === "เจ้าหนี้")?._sum.amount ?? 0)} ลบ.`}
        />
        <Kpi
          label="วงเงินสินเชื่อ"
          value={`${million(data.master.finance.creditLimit)} ลบ.`}
        />
      </div>
      <div className="cpe-grid two">
        <Card
          title="เงินเข้าและออกบริษัท"
          sub="ข้อมูลรายเดือนล่าสุดไม่เกิน 24 เดือน · ยอดยกมากำหนดใน Data Master"
        >
          <CashChart data={data} />
        </Card>
        <Card title="สภาพคล่องและภาระเงินทุน">
          <p>
            เงินทุนที่ต้องจัดหาเพิ่มสูงสุด{" "}
            <strong className="cpe-danger">
              {fmt(low.lt(0) ? low.abs().toString() : "0")} บาท
            </strong>
          </p>
          <p>
            วงเงินสินเชื่อ {fmt(data.master.finance.creditLimit)} บาท · เงินสด +
            วงเงิน{" "}
            {fmt(
              D(data.currentCash)
                .add(data.master.finance.creditLimit)
                .toString(),
            )}{" "}
            บาท
          </p>
          <Note>
            ลูกหนี้/เจ้าหนี้เป็นทะเบียนกำหนดชำระ
            ส่วนเงินสดจริงมาจากข้อมูลเงินเข้าออกในโครงการ
            การกดชำระแล้วไม่บันทึกเงินสดซ้ำ
          </Note>
        </Card>
      </div>
      <div className="cpe-grid two">
        {["ลูกหนี้", "เจ้าหนี้"].map((kind) => (
          <Card key={kind} title={kind + "แยกตามอายุกำหนดชำระ"}>
            <BarList
              rows={data.aging
                .filter((a) => a.kind === kind)
                .map((a) => ({
                  label: a.bucket,
                  value: Number(a.amount),
                  detail: fmt(a.amount) + " บาท",
                }))}
            />
          </Card>
        ))}
      </div>
      <ProjectSummary data={data} />
    </>
  );
}
function ProjectSummary({ data }: { data: CpePageData }) {
  return (
    <Card
      title="สถานะโครงการและภาระเงินทุน"
      sub="โครงการกำลังดำเนินการ · สูงสุด 100 โครงการ"
    >
      <div className="cpe-grid two">
        {data.projectSummary.map((p) => (
          <div className="cpe-master-row" key={p.id}>
            <h3>
              {p.code} · {p.name}
            </h3>
            <p>
              มูลค่า {fmt(p.contractValue)} · จ่ายจริง {fmt(p.paid)} ·
              ผูกพันคงเหลือ{" "}
              {fmt(PrismaMax(D(0), D(p.committed).sub(p.paidPo)).toString())}{" "}
              บาท
            </p>
            <p>
              Backlog{" "}
              {fmt(
                D(p.contractValue)
                  .mul(D(1).sub(D(p.actual ?? 0).div(100)))
                  .toString(),
              )}{" "}
              บาท · จริง {fmt(p.actual ?? 0)}% / แผน {fmt(p.planned ?? 0)}%
            </p>
            <p className="cpe-danger">
              เงินทุนที่ต้องออกก่อนสูงสุด {fmt(p.funding)} บาท
            </p>
            {permission(data, "cpe.projects.view") && (
              <Link
                className="link"
                href={`/cpe/projects?org=${data.filters.organizationId}&id=${p.id}`}
              >
                ดูโครงการ →
              </Link>
            )}
          </div>
        ))}
      </div>
      {!data.projectSummary.length && <Empty />}
    </Card>
  );
}
function Knowledge({ data }: { data: CpePageData }) {
  const router = useRouter();
  const [tab, setTab] = useState(data.filters.tab || "analysis");
  const wins = data.history.filter((h) => h.status === OS.won);
  const losses = data.history.filter((h) => h.status === OS.lost);
  return (
    <div className="cpe-detail-stack">
      <div className="cpe-tabs" role="tablist" aria-label="คลังข้อมูล">
        {[
          ["analysis", "วิเคราะห์แพ้–ชนะ"],
          ["archive", "คลังงานย้อนหลัง"],
          ["master", "Data Master"],
        ].map(([id, label]) => (
          <button
            role="tab"
            aria-selected={tab === id}
            aria-controls={`knowledge-${id}`}
            id={`tab-${id}`}
            key={id}
            onClick={() => {
              setTab(id);
              router.replace(url(data, { tab: id }));
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <section
        id={`knowledge-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
      >
        {tab === "analysis" ? (
          <>
            <div className="cpe-grid three">
              <Kpi label="งานที่ชนะ" value={wins.length} />
              <Kpi label="งานที่แพ้" value={losses.length} />
              <Kpi
                label="ประวัติที่ใช้แสดง"
                value={data.history.length}
                detail="ล่าสุดไม่เกิน 100 งาน"
              />
            </div>
            <div className="cpe-grid two">
              <Card title="สถิติผลตามประเภทงาน">
                <BarList
                  rows={data.master.workTypes.map((w) => {
                    const records = data.history.filter(
                      (h) => h.workType === w.name,
                    );
                    return {
                      label: w.name,
                      value: records.length,
                      detail: `ชนะ ${records.filter((h) => h.status === OS.won).length} / ${records.length} งาน`,
                    };
                  })}
                />
              </Card>
              <Card title="ต้นทุนประเมินเทียบต้นทุนจริงหลังปิดงาน">
                {data.references.map((r) => (
                  <p key={r.id}>
                    {r.code} · {r.opportunity.name}
                    <span className="cpe-sub block">
                      ประเมิน {fmt(r.budget)} · จริง{" "}
                      {fmt(sum(r.months.map((m) => m.cashOut)).toString())} บาท
                    </span>
                  </p>
                ))}
                {!data.references.length && <Empty />}
              </Card>
            </div>
            <ImprovementList data={data} />
          </>
        ) : tab === "archive" ? (
          <Card title="ประวัติการเสนอราคา">
            <Note>
              ค้นหา กรองประเภทงาน/ผล และเปลี่ยนหน้าจากตารางด้านบนได้ ·
              งานที่ไม่ได้และงานที่ได้จะคงอยู่เพื่อใช้วิเคราะห์ครั้งถัดไป
            </Note>
            <p className="cpe-sub">กด “เปิดรายละเอียด” ที่รายการด้านบนเพื่อดูข้อมูลและแบบฟอร์มของงานนั้น</p>
          </Card>
        ) : (
          <MasterEditor data={data} />
        )}
      </section>
    </div>
  );
}
function ImprovementList({ data }: { data: CpePageData }) {
  return (
    <Card title="ข้อเสนอปรับปรุงจากข้อมูลจริง">
      {data.improvements.map((i) => (
        <div className="cpe-comparison" key={i.id}>
          <div>
            <strong>{i.title}</strong>
            <p>{i.reason}</p>
            <p className="cpe-sub">
              ผลที่คาด: {i.expectedEffect} · {i.status}
            </p>
          </div>
          {i.status === "รอพิจารณา" &&
            permission(data, "cpe.improvement.decide") && (
              <div>
                <CommandForm
                  type="improvement.decide"
                  organizationId={data.filters.organizationId}
                  id={i.id}
                  version={i.version}
                  extra={{ approve: true }}
                  fields={[field("reason", "เหตุผลการอนุมัติ")]}
                  label="อนุมัติและปรับ Data Master"
                />
                <CommandForm
                  type="improvement.decide"
                  organizationId={data.filters.organizationId}
                  id={i.id}
                  version={i.version}
                  extra={{ approve: false }}
                  fields={[field("reason", "เหตุผลไม่อนุมัติ")]}
                  label="ไม่อนุมัติ"
                />
              </div>
            )}
        </div>
      ))}
      {!data.improvements.length && <Empty text="ยังไม่มีข้อเสนอปรับปรุง" />}
    </Card>
  );
}
function MasterEditor({ data }: { data: CpePageData }) {
  const router = useRouter();
  const [master, setMaster] = useState<Master>(structuredClone(data.master));
  const [group, setGroup] = useState("work");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const editable =
    permission(data, "cpe.master.manage") ||
    permission(data, "cpe.improvement.propose");
  const input = (
    label: string,
    value: string | number,
    onChange: (v: string) => void,
    type = "number",
  ) => (
    <label className="cpe-field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        disabled={!editable}
        onChange={(e) => onChange(e.target.value)}
        step="0.1"
      />
    </label>
  );
  const updateWork = (
    index: number,
    key: "overhead" | "risk" | "target" | "minimum",
    v: string,
  ) =>
    setMaster((m) => ({
      ...m,
      workTypes: m.workTypes.map((w, i) =>
        i === index ? { ...w, [key]: Number(v) } : w,
      ),
    }));
  return (
    <Card
      title="Data Master"
      sub={`รุ่น ${data.masterVersion} · ค่ามาตรฐานใช้ร่วมกันทุกหน้าในหน่วยงานนี้`}
    >
      <div className="cpe-tabs">
        {[
          ["work", "นโยบายกำไร"],
          ["sector", "ประเภทลูกค้า"],
          ["categories", "หมวด BOQ"],
          ["units", "หน่วยนับ"],
          ["grades", "เกรด Vendor"],
          ["dimensions", "น้ำหนักประเมิน"],
          ["tolerance", "เกณฑ์ตรวจต้นทุน"],
          ["finance", "การเงิน / จัดซื้อ"],
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            onClick={() => setGroup(id)}
            aria-pressed={group === id}
          >
            {label}
          </button>
        ))}
      </div>
      {group === "work" &&
        master.workTypes.map((w, i) => (
          <div className="cpe-master-row" key={w.name}>
            <h3>{w.name}</h3>
            <div className="cpe-fields">
              {(["overhead", "risk", "target", "minimum"] as const).map(
                (key, k) =>
                  input(
                    [
                      "ค่าดำเนินการ (%)",
                      "เผื่อความเสี่ยง (%)",
                      "กำไรเป้าหมาย (%)",
                      "กำไรขั้นต่ำ (%)",
                    ][k],
                    w[key],
                    (v) => updateWork(i, key, v),
                  ),
              )}
            </div>
          </div>
        ))}
      {group === "sector" &&
        master.sectors.map((s, i) => (
          <div className="cpe-master-row" key={s.name}>
            <h3>{s.name}</h3>
            {input("ค่าปรับจุดพลิกผล (%)", s.adjustment, (v) =>
              setMaster((m) => ({
                ...m,
                sectors: m.sectors.map((x, j) =>
                  i === j ? { ...x, adjustment: Number(v) } : x,
                ),
              })),
            )}
          </div>
        ))}
      {group === "categories" &&
        master.workTypes.map((w, i) => (
          <label className="cpe-field cpe-master-row" key={w.name}>
            <span>{w.name} · หนึ่งหมวดต่อบรรทัด</span>
            <textarea
              value={w.categories.join("\n")}
              disabled={!editable}
              rows={6}
              onChange={(e) =>
                setMaster((m) => ({
                  ...m,
                  workTypes: m.workTypes.map((x, j) =>
                    i === j
                      ? { ...x, categories: e.target.value.split("\n") }
                      : x,
                  ),
                }))
              }
            />
          </label>
        ))}
      {group === "units" && (
        <label className="cpe-field">
          <span>หน่วยนับ · หนึ่งหน่วยต่อบรรทัด</span>
          <textarea
            value={master.units.join("\n")}
            rows={15}
            disabled={!editable}
            onChange={(e) =>
              setMaster((m) => ({ ...m, units: e.target.value.split("\n") }))
            }
          />
        </label>
      )}
      {group === "grades" &&
        master.grades.map((g, i) => (
          <div className="cpe-master-row" key={g.name}>
            <h3>เกรด {g.name}</h3>
            {input("คะแนนขั้นต่ำ", g.minimum, (v) =>
              setMaster((m) => ({
                ...m,
                grades: m.grades.map((x, j) =>
                  i === j ? { ...x, minimum: Number(v) } : x,
                ),
              })),
            )}
          </div>
        ))}
      {group === "dimensions" &&
        master.dimensions.map((d, i) => (
          <div className="cpe-master-row" key={d.key}>
            <h3>{d.name}</h3>
            {input("น้ำหนัก (%)", d.weight, (v) =>
              setMaster((m) => ({
                ...m,
                dimensions: m.dimensions.map((x, j) =>
                  i === j ? { ...x, weight: Number(v) } : x,
                ),
              })),
            )}
          </div>
        ))}
      {group === "tolerance" && (
        <div className="cpe-fields">
          {input("เกณฑ์เตือนรายหมวด (%)", master.tolerance.category, (v) =>
            setMaster((m) => ({
              ...m,
              tolerance: { ...m.tolerance, category: Number(v) },
            })),
          )}
          {input("เกณฑ์เตือนรวม (%)", master.tolerance.total, (v) =>
            setMaster((m) => ({
              ...m,
              tolerance: { ...m.tolerance, total: Number(v) },
            })),
          )}
        </div>
      )}
      {group === "finance" && (
        <div className="cpe-fields">
          {input("เพดานโอกาสชนะ (%)", master.bidding.probabilityCap, (v) =>
            setMaster((m) => ({
              ...m,
              bidding: { ...m.bidding, probabilityCap: Number(v) },
            })),
          )}
          {input("ความชันโมเดลโอกาสชนะ", master.bidding.slope, (v) =>
            setMaster((m) => ({
              ...m,
              bidding: { ...m.bidding, slope: Number(v) },
            })),
          )}
          {input(
            "จุดพลิกผลเมื่อข้อมูลยังไม่ครบ (%)",
            master.bidding.defaultPivot,
            (v) =>
              setMaster((m) => ({
                ...m,
                bidding: { ...m.bidding, defaultPivot: Number(v) },
              })),
          )}
          {input("เงินสดยกมา (บาท)", master.finance.openingCash, (v) =>
            setMaster((m) => ({
              ...m,
              finance: { ...m.finance, openingCash: v },
            })),
          )}
          {input("วงเงินสินเชื่อ (บาท)", master.finance.creditLimit, (v) =>
            setMaster((m) => ({
              ...m,
              finance: { ...m.finance, creditLimit: v },
            })),
          )}
          {input(
            "เตือนยืนราคาสั้นกว่า (วัน)",
            master.purchasing.shortValidityDays,
            (v) =>
              setMaster((m) => ({
                ...m,
                purchasing: { ...m.purchasing, shortValidityDays: Number(v) },
              })),
          )}
          {input("เตือนคะแนน Vendor ต่ำกว่า", master.purchasing.lowScore, (v) =>
            setMaster((m) => ({
              ...m,
              purchasing: { ...m.purchasing, lowScore: Number(v) },
            })),
          )}
        </div>
      )}
      {permission(data, "cpe.master.manage") && (
        <div className="cpe-form-footer">
          <button
            className="primary"
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await sendCommand({
                  type: "master.save",
                  organizationId: data.filters.organizationId,
                  version: data.masterVersion,
                  configuration: master,
                });
                setMessage("บันทึกค่ามาตรฐานสำเร็จ");
                router.refresh();
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
              } finally {
                setBusy(false);
              }
            }}
          >
            บันทึกค่ามาตรฐาน
          </button>
          <span role="status">{message}</span>
        </div>
      )}
      {permission(data, "cpe.improvement.propose") && (
        <details>
          <summary>เสนอค่าที่แก้ไขให้ผู้บริหารอนุมัติ</summary>
          <CommandForm
            type="improvement.propose"
            organizationId={data.filters.organizationId}
            extra={{ configuration: master, masterVersion: data.masterVersion }}
            fields={[
              field("title", "หัวข้อเสนอปรับปรุง"),
              field("reason", "เหตุผลจากข้อมูลจริง", undefined, "textarea"),
              field(
                "expectedEffect",
                "ผลที่คาดว่าจะได้รับ",
                undefined,
                "textarea",
              ),
            ]}
            label="ส่งข้อเสนอพร้อมค่ามาตรฐานที่แก้ไข"
          />
        </details>
      )}
    </Card>
  );
}

function RfqGenerator({ data }: { data: CpePageData }) {
  const candidates = data.pickerOpps.filter((o) => o.status === OS.won);
  const [id, setId] = useState(candidates[0]?.id ?? "");
  const selected = candidates.find((o) => o.id === id);
  if (!selected)
    return <Empty text="ยังไม่มีงานที่ได้งานแล้วสำหรับสร้างชุดขอราคา" />;
  return (
    <>
      <label className="cpe-field">
        <span>เลือกงานที่ได้งานแล้ว</span>
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {candidates.map((o) => (
            <option key={o.id} value={o.id}>
              {o.code} · {o.name}
            </option>
          ))}
        </select>
      </label>
      <CommandForm
        key={`${id}:${selected.version}`}
        type="rfq.generate"
        organizationId={data.filters.organizationId}
        id={id}
        version={selected.version}
        fields={[
          field(
            "needAt",
            "วันที่ต้องใช้",
            data.asOfBangkok.slice(0, 10),
            "date",
          ),
        ]}
        label="สร้างแพ็กเกจ RFQ ตามหมวด BOQ"
      />
      <p className="cpe-sub">
        เลือกจากงานล่าสุดไม่เกิน 100 งาน ·
        ระบบจะเก็บแพ็กเกจเดิมและเพิ่มเฉพาะหมวดที่ยังไม่มี
      </p>
    </>
  );
}
