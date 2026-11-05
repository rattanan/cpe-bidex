# AI Page Assistant — Implementation and Acceptance Criteria

| Metadata | Value |
|---|---|
| Status | Implemented |
| Date | 2026-08-24 |
| Related baseline | `product-requirements.md`, `system-architecture.md`, `ai-design.md` |
| Capability | `page-assistant` |

## Scope

AI Page Assistant เป็นบอลลูนแบบ read-only ที่มุมขวาล่างของ authenticated portal ผู้ใช้สามารถขอสรุปข้อมูลที่มองเห็นในหน้าปัจจุบัน ถามคำถามจากข้อมูลในหน้า และขอวิธีใช้งานที่ grounded ด้วย Help Center ได้ โดยไม่สร้างหรือแก้ไข business record

## Architecture and data boundary

1. Client อ่าน `innerText` เฉพาะ `#main-content` ซึ่งเป็นข้อมูลที่ authorization ของหน้าปัจจุบันอนุญาตให้ผู้ใช้เห็นแล้ว และจำกัด context 16,000 ตัวอักษร
2. `POST /api/v1/ai/page-assistant` ตรวจ session ฝั่ง server, strict-validate payload, ตรวจ secret และไม่ fetch URL/path หรือ query business table เพิ่มเติม
3. Service เลือก Help Center สูงสุด 3 บทความจาก pathname, page title และคำถาม จากนั้นแยก page/help content เป็น untrusted input เพื่อป้องกัน prompt injection
4. Provider ใช้ active OpenAI-compatible configuration จากหน้า `/admin/ai-settings` เป็นแหล่งเดียว โดยอ่าน URL, model, timeout, encrypted API key และสถานะ Enabled จาก active version ทุกคำขอ ไม่มี environment flag หรือ public fallback แยกสำหรับ Page Assistant
5. Audit เก็บเฉพาะ actor, pathname, จำนวนตัวอักษร/turn, provider configuration/model, prompt version, token usage และผลสำเร็จ/ล้มเหลว ไม่เก็บคำถาม, page content หรือคำตอบดิบ
6. API คืน answer, deterministic Help links และ provenance โดยไม่มี mutation endpoint หรือ autonomous action

## Acceptance criteria

- [x] ผู้ใช้ที่ล็อกอินเปิด/ปิด balloon ได้จากทุกหน้าใน portal; ผู้ที่ไม่มี session ได้ `401`
- [x] ผู้ใช้ขอ “สรุปข้อมูลหน้านี้” และถามข้อมูลจากข้อความที่มองเห็นในหน้าปัจจุบันได้
- [x] คำถามวิธีใช้งาน grounded ด้วย Help Center และ UI แสดงลิงก์บทความที่เกี่ยวข้อง
- [x] เมื่อข้อมูลไม่พอ prompt บังคับให้ตอบว่าไม่พบข้อมูล แทนการเดาหรือสร้างตัวเลข
- [x] AI Assistant ไม่มี business mutation และแจ้งผู้ใช้ชัดเจนว่าเป็น read-only
- [x] Secret-like input ถูกปฏิเสธก่อนเรียก provider และ raw prompt/response ไม่ถูกเขียน audit
- [x] เมื่อ AI Settings ปิด, ไม่มี active config/key หรือ provider outage ระบบคืน sanitized error โดยไม่ block workflow หลัก
- [x] การเปลี่ยน URL, model, timeout หรือ key ใน AI Settings มีผลกับคำขอ Page Assistant ถัดไปโดยไม่ต้องตั้ง environment เพิ่ม
- [x] UI รองรับ keyboard, Escape, focus return, ARIA live region, reduced motion, dark mode และ mobile viewport
- [x] มี unit tests สำหรับ Help ranking, context bounds, safety/prompt isolation, output bounds และ static integration contracts

## Operational notes

- เปิด/ปิด AI และแก้ URL, model, timeout หรือ key ที่ `/admin/ai-settings`; Page Assistant ไม่มี config แยก
- ต้องมี active AI Provider Configuration ที่ Enabled และ `AI_CONFIG_MASTER_KEY` ที่ถูกต้องสำหรับถอดรหัส key ที่หน้า AI Settings บันทึกไว้
- คำตอบเป็นคำแนะนำ ผู้ใช้ต้องตรวจสอบกับข้อมูลต้นทาง โดยเฉพาะข้อมูล commercial และ workflow

## CPE availability correction — 2026-11-06

The owner reported missing balloons on CPE pages. The shell had excluded `/cpe` and `/company`; it now mounts the existing assistant on every authenticated portal route. The public login page remains outside that shell. Short landscape CSS now hides the duplicate launcher only while the panel is open, so a closed assistant can always be opened; the panel header close control remains visible. Focus returns to the launcher after React commits the closed state, including when the launcher was hidden while open in landscape.

Acceptance: the launcher opens/closes on all twelve CPE workspaces, company and Help Center; Escape returns focus; portrait and short landscape viewports retain a usable launcher and panel close button. Page context follows the current route, and an unavailable provider displays a recoverable error while the workspace remains usable. No business writes or provider-setting changes are involved.

Changed files: `components/app-shell.tsx`, `components/ai-chat-balloon.tsx`, `app/globals.css`, `lib/help-center.ts`, `tests/unit/app-shell-help-contract.test.ts`, `tests/unit/cpe/help-center.test.ts`, `tests/e2e/cpe-assistant.spec.ts`, `docs/cpe/implementation.md`, `docs/cpe/help-center.md`, this document and release evidence in `docs/server-deployment.md`.

The opt-in browser regression uses protected test credentials and intercepts the provider request to exercise the unavailable state without paid provider traffic. Existing session enforcement, payload validation, secret rejection, audit and read-only boundaries remain unchanged.
