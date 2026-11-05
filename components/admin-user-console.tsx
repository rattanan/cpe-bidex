"use client";

import { PRODUCT } from "@/lib/company-profile";

import { useActionState, useState } from "react";
import type { Role } from "@prisma/client";
import { assignAdminRole, createAdminUser, revokeAdminRole, rotateAdminUserApiKey, updateAdminRoleOrganization, updateAdminUser } from "@/app/actions/identity-admin";
import type { FormState } from "@/app/action-types";
import { FormNotice } from "@/components/notice";
import { AUTHORIZATION_SCOPES, ENTERPRISE_ROLES } from "@/lib/authorization/enterprise-role-policy";

const initial: FormState = {};
const legacyRoles: Role[] = ["ADMIN", "SALES", "VIEWER"];
type Org = { id: string; code: string; name: string };

function Result({ state }: { state: FormState }) { return <FormNotice state={state}/>; }

function ApiKeyReveal({ apiKey }: { apiKey: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
  }
  return <div className="notice success" role="status" aria-live="polite"><strong>API Key ใหม่ — แสดงครั้งเดียว</strong><code style={{display:"block", margin:"8px 0", overflowWrap:"anywhere"}}>{apiKey}</code><button className="secondary" type="button" onClick={copy}>{copied ? "คัดลอกแล้ว" : "Copy API Key"}</button><small className="help" style={{display:"block", marginTop:8}}>นำ Key นี้ไปบันทึกใน InsightKM ระบบ {PRODUCT.shortName} จะเก็บเฉพาะค่า hash และไม่สามารถแสดงค่าเดิมอีกได้</small></div>;
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createAdminUser, initial);
  return <form action={action} className="card form-card"><div className="card-body"><h2>สร้างผู้ใช้งาน</h2><div className="form-grid"><label className="field"><span>ชื่อ</span><input className="control" name="name" required minLength={2}/></label><label className="field"><span>อีเมล</span><input className="control" name="email" type="email" required/></label><label className="field"><span>รหัสผ่านเริ่มต้น</span><input className="control" name="password" type="password" minLength={12} autoComplete="new-password" required/><small className="help">อย่างน้อย 12 ตัวอักษร</small></label><label className="field"><span>Legacy role</span><select className="control" name="role" defaultValue="SALES">{legacyRoles.map(role=><option key={role}>{role}</option>)}</select></label></div><Result state={state}/>{state.apiKey&&<ApiKeyReveal apiKey={state.apiKey}/>}<div className="actions"><button className="primary" disabled={pending}>{pending ? "กำลังสร้าง…" : "สร้างผู้ใช้งาน"}</button></div></div></form>;
}

export function UpdateUserForm({ user, self }: { user: { id: string; name: string; role: Role; active: boolean }; self: boolean }) {
  const [state, action, pending] = useActionState(updateAdminUser, initial);
  return <form action={action} className="identity-user-edit-form"><input type="hidden" name="userId" value={user.id}/><label className="field-label required-label" htmlFor={`admin-user-name-${user.id}`}>ชื่อ</label><input className="control" id={`admin-user-name-${user.id}`} name="name" defaultValue={user.name} required minLength={2}/><label className="field-label" htmlFor={`admin-user-role-${user.id}`}>Legacy role</label><select className="control" id={`admin-user-role-${user.id}`} name="role" defaultValue={user.role} disabled={self}>{legacyRoles.map(role=><option key={role}>{role}</option>)}</select>{self&&<input type="hidden" name="role" value={user.role}/>}<label className="help identity-user-active"><input type="checkbox" name="active" defaultChecked={user.active} disabled={self}/> เปิดใช้งาน</label>{self&&<input type="hidden" name="active" value="on"/>}<Result state={state}/><button className="secondary" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึกผู้ใช้"}</button></form>;
}

export function UserApiKeyForm({ user }: { user: { id: string; apiKeyPrefix: string | null; apiKeyCreatedAt: Date | null } }) {
  const [state, action, pending] = useActionState(rotateAdminUserApiKey, initial);
  return <div><div><span className={`badge ${user.apiKeyPrefix ? "success" : "muted"}`}>{user.apiKeyPrefix ? `ntop_${user.apiKeyPrefix}_••••` : "ยังไม่มี API Key"}</span></div><small className="help">{user.apiKeyCreatedAt ? `ออกเมื่อ ${user.apiKeyCreatedAt.toLocaleString("th-TH")}` : "สร้างหรือหมุน Key เพื่อเชื่อม InsightKM"}</small><form action={action} style={{marginTop:8}}><input type="hidden" name="userId" value={user.id}/><button className="secondary" disabled={pending}>{pending ? "กำลังออก Key…" : user.apiKeyPrefix ? "Rotate API Key" : "Create API Key"}</button><Result state={state}/>{state.apiKey&&<ApiKeyReveal apiKey={state.apiKey}/>}</form></div>;
}

export function AssignRoleForm({ user, orgs }: { user: { id: string; name: string; email: string }; orgs: Org[] }) {
  const [state, action, pending] = useActionState(assignAdminRole, initial);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <form action={action} className="card form-card identity-role-form"><div className="card-body"><h2>เพิ่ม Enterprise role</h2><p className="help">มอบหมายให้ {user.name} · {user.email}</p><input type="hidden" name="userId" value={user.id}/><div className="form-grid"><label className="field"><span>Role</span><select className="control" name="roleCode">{ENTERPRISE_ROLES.map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Scope</span><select className="control" name="scopeCode">{AUTHORIZATION_SCOPES.map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>หน่วยงาน</span><select className="control" name="organizationUnitId"><option value="">ไม่ระบุ</option>{orgs.map(org=><option value={org.id} key={org.id}>{org.code} — {org.name}</option>)}</select></label><label className="field"><span>เริ่มใช้</span><input className="control" type="date" name="effectiveFrom" defaultValue={today} required/></label><label className="field"><span>สิ้นสุด</span><input className="control" type="date" name="effectiveTo"/></label></div><Result state={state}/><div className="actions"><button className="primary" disabled={pending}>{pending ? "กำลังมอบหมาย…" : "มอบหมาย role"}</button></div></div></form>;
}

export function RevokeRoleForm({ assignmentId, disabled }: { assignmentId: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(revokeAdminRole, initial);
  return <form action={action}><input type="hidden" name="assignmentId" value={assignmentId}/><button className="secondary" disabled={disabled||pending}>{pending ? "กำลังถอน…" : "ถอนสิทธิ์"}</button><Result state={state}/></form>;
}

export function UpdateRoleAssignmentOrganizationForm({ assignment, orgs, disabled }: { assignment: { id: string; organizationUnitId: string | null; scopeCode: string }; orgs: Org[]; disabled: boolean }) {
  const [state, action, pending] = useActionState(updateAdminRoleOrganization, initial);
  const requiresOrganization = assignment.scopeCode === "TEAM" || assignment.scopeCode === "ORG_UNIT";
  return <form action={action} className="identity-assignment-edit"><input type="hidden" name="assignmentId" value={assignment.id}/><label className={requiresOrganization ? "field-label required-label" : "field-label"} htmlFor={`assignment-organization-${assignment.id}`}>แก้ไขหน่วยงาน</label><select className="control" id={`assignment-organization-${assignment.id}`} name="organizationUnitId" defaultValue={assignment.organizationUnitId ?? ""} required={requiresOrganization} disabled={disabled}><option value="">{requiresOrganization ? "เลือกหน่วยงาน" : "ไม่ระบุหน่วยงาน"}</option>{orgs.map(org=><option value={org.id} key={org.id}>{org.code} — {org.name}</option>)}</select><button className="secondary" disabled={disabled||pending}>{pending ? "กำลังบันทึก…" : "บันทึกหน่วยงาน"}</button><Result state={state}/></form>;
}
