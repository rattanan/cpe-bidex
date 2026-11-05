"use client";
import { useId, useRef, useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "checkbox" | "textarea" | "checks";
  options?: { value: string; label: string }[];
  value?: string | number | boolean | readonly string[];
  group?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
};
export async function sendCommand(
  command: Record<string, unknown>,
  requestId = crypto.randomUUID(),
) {
  const response = await fetch("/api/cpe/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...command, requestId }),
  });
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json"))
    throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  const result = (await response.json()) as {
    error?: string;
    resultId?: string;
  };
  if (!response.ok) throw new Error(result.error ?? "บันทึกไม่สำเร็จ");
  window.dispatchEvent(
    new CustomEvent("cpe:notice", { detail: "บันทึกข้อมูลเรียบร้อยแล้ว" }),
  );
  return result.resultId;
}
export function CommandForm({
  type,
  organizationId,
  id,
  version,
  fields = [],
  extra = {},
  label = "บันทึก",
  onSaved,
  children,
}: {
  type: string;
  organizationId: string;
  id?: string;
  version?: number;
  fields?: Field[];
  extra?: Record<string, unknown>;
  label?: string;
  onSaved?: () => void;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef<{ body: string; id: string } | null>(null);
  return (
    <form
      className="cpe-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = new FormData(form);
        setBusy(true);
        setMessage("");
        try {
          const input: Record<string, unknown> = {
            type,
            organizationId,
            ...(id ? { id } : {}),
            ...(version !== undefined ? { version } : {}),
            ...extra,
          };
          for (const field of fields) {
            const raw = values.get(field.name);
            const value =
              field.type === "checkbox"
                ? raw === "on"
                : field.type === "checks"
                  ? values.getAll(field.name).map(String)
                  : String(raw ?? "");
            if (field.group) {
              const group = (input[field.group] ?? {}) as Record<
                string,
                unknown
              >;
              group[field.name] = value;
              input[field.group] = group;
            } else {
              input[field.name] = value;
              if (value === "" && !field.required) delete input[field.name];
            }
          }
          const body = JSON.stringify(input);
          if (request.current?.body !== body)
            request.current = { body, id: crypto.randomUUID() };
          await sendCommand(input, request.current!.id);
          request.current = null;
          setMessage("บันทึกสำเร็จ");
          router.refresh();
          onSaved?.();
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "บันทึกไม่สำเร็จ",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="cpe-fields">
        {fields.map((field) => (
          <label
            className={
              field.type === "textarea" ? "cpe-field wide" : "cpe-field"
            }
            key={field.name}
          >
            <span>{field.label}</span>
            {field.type === "checks" ? (
              <span className="cpe-checks">
                {field.options?.map((o) => (
                  <span key={o.value}>
                    <input
                      aria-label={o.label}
                      type="checkbox"
                      name={field.name}
                      value={o.value}
                      defaultChecked={
                        Array.isArray(field.value) &&
                        field.value.includes(o.value)
                      }
                    />
                    {o.label}
                  </span>
                ))}
              </span>
            ) : field.options ? (
              <select
                name={field.name}
                defaultValue={String(field.value ?? "")}
                required={field.required}
              >
                <option value="">เลือก…</option>
                {field.options.map((o) => (
                  <option value={o.value} key={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                name={field.name}
                defaultValue={String(field.value ?? "")}
                rows={3}
                required={field.required}
                spellCheck={false}
              />
            ) : (
              <input
                name={field.name}
                type={field.type ?? "text"}
                defaultValue={
                  field.type === "checkbox"
                    ? undefined
                    : String(field.value ?? "")
                }
                defaultChecked={
                  field.type === "checkbox" ? Boolean(field.value) : undefined
                }
                required={field.required}
                min={field.min}
                max={field.max}
                step={
                  field.step ?? (field.type === "number" ? "0.0001" : undefined)
                }
              />
            )}
          </label>
        ))}
      </div>
      {children}
      <div className="cpe-form-footer">
        <button
          className="primary"
          disabled={busy || !organizationId}
          type="submit"
        >
          {busy ? "กำลังบันทึก…" : label}
        </button>
        <span
          role="status"
          className={message === "บันทึกสำเร็จ" ? "cpe-success" : "cpe-error"}
        >
          {message}
        </span>
      </div>
    </form>
  );
}
export function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const close = () => {
    ref.current?.close();
    onClose();
    document.querySelector<HTMLElement>("#main-content")?.focus({ preventScroll: true });
  };
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    if (!dialog.open) dialog.showModal();
    document.body.style.overflow = "hidden";
    heading.current?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return (
    <dialog
      className="cpe-drawer"
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            close();
        }
      }}
      aria-labelledby={titleId}
    >
      <div className="cpe-drawer-head">
        <div><p className="cpe-drawer-eyebrow">รายละเอียดและแบบฟอร์ม</p><h2 id={titleId} ref={heading} tabIndex={-1}>{title}</h2></div>
        <button
          className="secondary"
          type="button"
          onClick={close}
          aria-label="ปิดรายละเอียด"
        >
          ✕ ปิด
        </button>
      </div>
      <div className="cpe-drawer-body">{children}</div>
      <div className="cpe-drawer-footer"><span>ตรวจสอบข้อมูลให้ครบก่อนบันทึก</span><button type="button" className="secondary" onClick={close}>ปิดหน้าต่าง</button></div>
    </dialog>
  );
}
export const options = (values: readonly string[]) =>
  values.map((v) => ({ value: v, label: v }));

export function Toast() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = (event: Event) => {
      setMessage(String((event as CustomEvent<string>).detail));
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(""), 4500);
    };
    window.addEventListener("cpe:notice", show);
    return () => {
      window.removeEventListener("cpe:notice", show);
      clearTimeout(timer);
    };
  }, []);
  return message ? (
    <div className="cpe-toast" role="status" aria-live="polite">
      ✓ {message}
      <button
        type="button"
        aria-label="ปิดข้อความแจ้งผล"
        onClick={() => setMessage("")}
      >
        ✕
      </button>
    </div>
  ) : null;
}
