"use client";

import { PRODUCT } from "@/lib/company-profile";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Notice, type NoticeVariant } from "@/components/notice";

type TransitionOption = { code: string; label: string };
type ServiceOrderOption = { id: string; orderNo: string; status: string };

async function payload(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "ดำเนินการไม่สำเร็จ");
  return result.data;
}

export function ContractWorkflowControls({ contractId, version, currentStatusLabel, workflowUnavailableReason, transitions, canUploadDocument, canCreateServiceOrder, serviceOrders }: { contractId: string; version: number; currentStatusLabel: string; workflowUnavailableReason: string; transitions: TransitionOption[]; canUploadDocument: boolean; canCreateServiceOrder: boolean; serviceOrders: ServiceOrderOption[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<"transition" | "document" | "serviceOrder" | null>(null);
  const [message, setMessage] = useState<{ text: string; variant: NoticeVariant } | null>(null);

  return <div className="grid-2 contract-control-grid" data-testid="contract-workflow-controls">
    {transitions.length > 0 ? <form className="card contract-workflow-card" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const target = String(form.get("toStatusCode") ?? "");
      if (!window.confirm(`ยืนยันเปลี่ยนสถานะ Contract เป็น ${target}?`)) return;
      setPending("transition"); setMessage(null);
      try {
        await payload(await fetch(`/api/v1/contracts/${contractId}/status`, {
          method: "POST",
          headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
          body: JSON.stringify({ expectedVersion: version, toStatusCode: target, comment: form.get("comment") }),
        }));
        setMessage({ text: "เปลี่ยนสถานะ Contract เรียบร้อย", variant: "success" });
        router.refresh();
      } catch (error) {
        setMessage({ text: error instanceof Error ? error.message : "เปลี่ยนสถานะไม่สำเร็จ", variant: "error" });
      } finally { setPending(null); }
    }}><div className="card-header"><strong>Contract Workflow</strong></div><div className="card-body form-grid">
      <label className="field"><span>Next status</span><select className="control" name="toStatusCode" data-testid="contract-next-status">{transitions.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
      <label className="field full"><span>Comment / reason</span><textarea className="control" name="comment" minLength={3} required /></label>
      <div className="field full"><button className="primary" data-testid="contract-transition-submit" disabled={pending !== null}>{pending === "transition" ? "กำลังเปลี่ยนสถานะ…" : "ยืนยัน Transition"}</button></div>
    </div></form> : <section className="card contract-workflow-card contract-workflow-unavailable" data-testid="contract-workflow-panel"><div className="card-header"><strong>Contract Workflow</strong><span className="badge muted">{currentStatusLabel}</span></div><div className="card-body"><strong>ยังไม่มี Transition ที่คุณดำเนินการได้</strong><p>{workflowUnavailableReason}</p></div></section>}

    {(canCreateServiceOrder || serviceOrders.length > 0) && <section className="card" data-testid="contract-service-order-panel"><div className="card-header"><strong>Order Handoff</strong><span className="badge muted">{PRODUCT.shortName} orchestration record</span></div><div className="card-body">
      {serviceOrders.length > 0 ? <div className="contract-order-list">{serviceOrders.map((order) => <article key={order.id}><div><span>Service Order</span><strong>{order.orderNo}</strong></div><small>{order.status} · ยังไม่ถือว่า NTSP integration สำเร็จ</small></article>)}</div> : <form onSubmit={async (event) => {
        event.preventDefault();
        if (!window.confirm("ยืนยันสร้าง Service Order จาก Contract Version ปัจจุบัน?")) return;
        setPending("serviceOrder"); setMessage(null);
        try {
          const result = await payload(await fetch(`/api/v1/contracts/${contractId}/service-orders`, { method: "POST", headers: { "idempotency-key": crypto.randomUUID() } }));
          setMessage({ text: result.reused ? `มี Service Order ${result.orderNo} อยู่แล้ว` : `สร้าง Service Order ${result.orderNo} เรียบร้อย`, variant: "success" });
          router.refresh();
        } catch (error) {
          setMessage({ text: error instanceof Error ? error.message : "สร้าง Service Order ไม่สำเร็จ", variant: "error" });
        } finally { setPending(null); }
      }}><p className="help">สร้าง handoff record แบบ DRAFT เท่านั้น ระบบจะไม่แสดง Integration Success จนกว่าจะได้รับ acknowledgement จากระบบปลายทางจริง</p><button className="primary" data-testid="contract-service-order-submit" disabled={pending !== null}>{pending === "serviceOrder" ? "กำลังสร้าง…" : "สร้าง Service Order"}</button></form>}
    </div></section>}

    {canUploadDocument && <form className="card contract-document-card" onSubmit={async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        setMessage({ text: "กรุณาเลือกไฟล์เอกสารก่อนอัปโหลด", variant: "error" });
        return;
      }
      if (file.size > 25_000_000) {
        setMessage({ text: "ไฟล์ต้องมีขนาดไม่เกิน 25 MB", variant: "error" });
        return;
      }
      setPending("document"); setMessage(null);
      try {
        await payload(await fetch(`/api/v1/contracts/${contractId}/documents`, {
          method: "POST",
          headers: { "idempotency-key": crypto.randomUUID() },
          body: formData,
        }));
        form.reset();
        setMessage({ text: "แนบเอกสาร Contract เรียบร้อย", variant: "success" });
        router.refresh();
      } catch (error) {
        setMessage({ text: error instanceof Error ? error.message : "แนบเอกสารไม่สำเร็จ", variant: "error" });
      } finally { setPending(null); }
    }}><div className="card-header"><div><strong>Contract Document</strong><small>จัดเก็บใน local private storage แบบเดียวกับเอกสาร Prospect</small></div><span className="badge muted">สูงสุด 25 MB</span></div><div className="card-body form-grid contract-document-form-grid">
      <label className="field"><span>Category</span><input className="control" name="category" defaultValue="CONTRACT" minLength={2} required /></label>
      <label className="field"><span>File</span><input className="control" name="file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip" aria-describedby="contract-document-guidance" required /></label>
      <p className="contract-document-guidance" id="contract-document-guidance">รองรับ PDF, Word, Excel, JPG, PNG และ ZIP · ไฟล์อยู่ภายนอก public path และเข้าถึงผ่านสิทธิ์ของระบบเท่านั้น</p>
      <div className="field full contract-document-actions"><button className="secondary" data-testid="contract-document-submit" disabled={pending !== null}>{pending === "document" ? "กำลังอัปโหลด…" : "อัปโหลดเอกสาร"}</button></div>
    </div></form>}
    {message && <Notice variant={message.variant}>{message.text}</Notice>}
  </div>;
}
