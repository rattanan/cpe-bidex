# NTOP Enterprise Sales Platform — Product Requirements

> Active application baseline (2026-11-05): the owner approved CPE Project Bid Excellence in `requirements/SRS.pdf` and its HTML prototype as the new product scope. See [CPE implementation and acceptance](cpe/implementation.md). The NTOP baseline below remains the retained legacy domain contract; its production platform, security and integrity controls continue to apply.

| Metadata | Value |
|---|---|
| Status | Approved Baseline |
| Version | 1.1 |
| Owner | Product Owner — Enterprise Sales |
| Reviewers | Sales, Presales, Pricing, Order Operations, Enterprise Architecture, Security, Data Governance, IT Operations |
| Last Updated | 2026-07-11 |
| Related Documents | [Architecture](system-architecture.md), [Domain Model](domain-model.md), [Database](database-design.md), [API](api-design.md), [Permissions](roles-and-permissions.md), [Roadmap](implementation-roadmap.md), [Testing](testing-strategy.md) |
| Assumptions | Private cloud; >2M customers; 100 concurrent users; MySQL 8 InnoDB Cluster production target; local identity initially |
| Open Decisions | OD-001–OD-006 closed on 2026-07-11; remaining implementation ADRs are tracked separately |

## 1. Vision and outcomes

NTOP เป็นระบบควบคุมงานขายลูกค้าองค์กรแบบ end-to-end ตั้งแต่ Lead ถึง Internal Order Handoff โดยให้ทุกฝ่ายใช้ข้อมูลลูกค้า โอกาสขาย solution ราคา และการอนุมัติชุดเดียวกัน เป้าหมาย 12 เดือนคือทำให้ enterprise sales units เลิกพึ่ง spreadsheet ใน workflow หลัก และมีข้อมูล forecast/audit ที่ตรวจสอบย้อนกลับได้

### Success metrics

| Metric | Target at production acceptance |
|---|---|
| Customer capacity | ทดสอบอย่างน้อย 2.5M synthetic customer records |
| Concurrent workload | 100 active users และ capacity headroom 30% |
| Exact customer lookup | p95 < 1 second |
| Filtered/full-text search | p95 < 2 seconds |
| Transactional write | p95 < 1.5 seconds ไม่รวม asynchronous work |
| Availability | 99.9% monthly excluding approved maintenance |
| Audit coverage | 100% ของ privileged, workflow transition และ commercial approval actions |
| Authorization | ไม่พบ unauthorized cross-scope access ใน acceptance test |
| Workflow adoption | pilot users ทำ lead-to-order flow ในระบบได้โดยไม่ใช้ shadow spreadsheet สำหรับข้อมูลหลัก |

## 2. Users and scope

ผู้ใช้ปีแรกประกอบด้วย Admin, Executive, Sales Director, Team Manager, KAM, Presales, Coverage, Pricing Approver, Order Operations, Viewer และ Auditor รายละเอียดสิทธิ์อยู่ใน [roles-and-permissions.md](roles-and-permissions.md)

**In scope:** Customer 360, hierarchy/contact/ownership, Lead, Activity, Opportunity, Forecast, Product, Coverage, Solution, Quote, Approval, Internal Order Handoff, document references, bulk jobs, search, audit, administration, adapter framework และ Phase 1 AI assistance ตาม [AI Design](ai-design.md)

**Out of scope:** full customer migration ก่อน readiness gate, automated provisioning, billing ledger, after-sale ticketing, corporate SSO cutover, broad enterprise integration ที่ยังไม่มี approved contract และ AI capabilities ที่ถูก defer ใน AI Release 2/3

## 3. Requirement catalog

Priority ใช้ Must/Should/Could; Source `Roadmap` หมายถึง [historical roadmap](nt-salesforce-roadmap.md), `Scale` คือข้อกำหนด 2M+ customers และ `Assumption` ต้องได้รับการยืนยันก่อน production

| ID | Requirement and rationale | Priority | Owner | Acceptance criteria | Dependency | Source | Responsible design/component |
|---|---|---:|---|---|---|---|---|
| BR-001 | มี Customer 360 เป็น shared sales record เพื่อลดข้อมูลซ้ำ | Must | Product/Data Owner | แสดง hierarchy, identifiers, contacts, owner และ linked sales history ตามสิทธิ์ | DATA-001, SEC-002 | Roadmap | Customer domain/API |
| BR-002 | รองรับ lead-to-internal-order workflow เพื่อควบคุม sales lifecycle | Must | Sales Director | UAT ผ่านตั้งแต่ Lead conversion ถึง acknowledged handoff | FR-002–FR-008 | Roadmap | Sales/Commercial/Order |
| BR-003 | มี forecast ที่ทำซ้ำย้อนหลังได้เพื่อการบริหาร pipeline | Must | Sales Director | Snapshot และสูตรให้ผลตรงกับ approved examples | FR-009, DATA-004 | Roadmap | Forecast |
| BR-004 | ลด approval bypass และเก็บหลักฐาน commercial decision | Must | Pricing Owner | ทุก decision ผูก policy version, actor, timestamp และ reason | FR-007, COMP-001 | Risk | Approval/Audit |
| BR-005 | ระบบต้องมี manual fallback เมื่อ integration ใช้งานไม่ได้ | Must | Operations Owner | critical handoff ดำเนินต่อและ reconcile ภายหลังได้ | INT-001–INT-004 | Roadmap | Integration/Order |
| FR-001 | จัดการ customer hierarchy, external IDs, contacts, segmentation และ ownership history | Must | Customer Data Owner | CRUD/merge/ownership scenarios ผ่านตาม permission และ audit | DATA-001 | Roadmap | Customer |
| FR-002 | รับ คัดกรอง แปลง และ disqualify Lead พร้อม duplicate checks | Must | Sales Operations | state transitions และ conversion ไม่สร้าง customer ซ้ำโดยไม่เตือน | FR-001 | Roadmap | Lead |
| FR-003 | จัดการ Activity, next action, meeting note และ reminders | Must | Team Manager | activities ผูก customer/opportunity และ overdue query ได้ | FR-001 | Roadmap | Activity |
| FR-004 | จัดการ Opportunity stages, owner และข้อมูลประกอบการปิดงาน | Must | Sales Director | ผู้มีสิทธิ์เลือกเปลี่ยนไปยัง canonical stage อื่นได้อิสระ โดยยังตรวจ scope/version และเก็บ history/audit | FR-001–FR-003 | Roadmap | Opportunity |
| FR-005 | จัดการ Product, Coverage และ Solution พร้อม confirmed cost/risk | Must | Presales/Coverage | quote submission ถูก block เมื่อ mandatory gate ไม่ครบ | FR-004 | Roadmap | Presales |
| FR-006 | สร้าง versioned Quote พร้อม items, discount, margin และ validity | Must | Commercial Owner | totals reproducible และ accepted version immutable | FR-005 | Roadmap | Quote |
| FR-007 | Routing approval ตาม policy และ authority | Must | Pricing Owner | approve/reject/return/delegate/escalate มี SoD และ audit | FR-006 | Risk | Approval |
| FR-008 | สร้าง Internal Order และ manual/integrated handoff พร้อม acknowledgement | Must | Order Operations | handoff/rework/completion และ external refs ตรวจสอบได้ | FR-007, INT-001 | Roadmap | Order |
| FR-009 | Forecast snapshot, weighted pipeline, categories, aging และ risk signals | Must | Sales Director | monthly/quarterly rollup ตรงกับ test vectors | FR-004, DATA-004 | Roadmap | Forecast |
| FR-010 | Search, saved filters และ cursor pagination สำหรับ customer/opportunity | Must | Product Owner | ไม่เกิด unbounded query; ผ่าน NFR-001 | DATA-002 | Scale | Search/Query |
| FR-011 | Bulk import/export เป็น background job พร้อม preview/rejection/reconciliation | Should | Data Operations | resumable job และ totals accepted/rejected/replayed ตรงกัน | OPS-002, DATA-003 | Scale | Bulk Jobs |
| FR-012 | Notifications, task inbox และ SLA escalation | Should | Operations Owner | event duplicate ไม่สร้าง notification ซ้ำ | INT-003 | Roadmap | Notification |
| NFR-001 | รองรับ 2.5M customer test dataset และ search SLA | Must | Architecture | benchmark ผ่าน targets ใน success metrics | FR-010 | Scale | Database/Search |
| NFR-002 | รองรับ 100 concurrent active users + 30% headroom | Must | IT Operations | load test ผ่าน error rate <1% และ resource thresholds | OPS-001 | Assumption | Platform |
| NFR-003 | Availability 99.9% และ graceful degradation | Must | IT Operations | HA/failover exercise ผ่านและ manual fallback ใช้ได้ | OPS-003 | Assumption | Platform |
| NFR-004 | API และ workflow รองรับ idempotency/optimistic concurrency | Must | Architecture | duplicate request ไม่สร้างผลซ้ำ; stale update ได้ 409 | FR-006–FR-008 | Risk | API/Application |
| SEC-001 | Local authentication มี MFA สำหรับ privileged roles, lockout และ session revocation | Must | Security | security test ผ่าน policy ที่อนุมัติ | OPS-004 | Risk | Identity |
| SEC-002 | Authorization ตาม role, organization, ownership และ workflow responsibility | Must | Security/Product | deny-by-default และ matrix tests ผ่าน | FR-001–FR-008 | Risk | Policy Enforcement |
| SEC-003 | Encrypt in transit/at rest และเก็บ secrets ใน approved vault | Must | Security/Operations | configuration review และ secret scan ผ่าน | OPS-001 | Policy | Platform |
| DATA-001 | ใช้ stable internal IDs แยกจาก external identifiers และเก็บ history | Must | Data Owner | source IDs ไม่ overwrite internal identity; changes traceable | — | Risk | Data Model |
| DATA-002 | MySQL เป็น source of truth; OpenSearch เป็น rebuildable projection | Must | Architecture | index rebuild/reconciliation ผ่านโดยไม่สูญข้อมูลหลัก | INT-003 | Scale | Data/Search |
| DATA-003 | มี validation, duplicate detection, quarantine และ lineage สำหรับ bulk data | Must | Data Governance | invalid data ไม่เข้าตารางหลักและมี rejection report | FR-011 | Risk | Import/Data Quality |
| DATA-004 | Forecast snapshot เป็น immutable historical fact | Must | Sales/Data Owner | rerun report จาก snapshot ให้ผลเดิม | FR-009 | Risk | Forecast Data |
| INT-001 | Integration ผ่าน versioned adapters และมี manual fallback | Must | Integration Owner | adapter outage scenario ผ่านโดย workflow ไม่สูญหาย | BR-005 | Roadmap | Integration |
| INT-002 | กำหนด source-of-truth และ field ownership ก่อนเปิด integration | Must | Data/Integration Owner | contract checklist ได้รับ sign-off | — | Risk | Governance |
| INT-003 | ใช้ outbox/inbox, idempotency, retry และ dead-letter handling | Must | Architecture | failure/replay tests ไม่สร้าง duplicate business effect | OPS-002 | Risk | Messaging |
| INT-004 | มี reconciliation และ operational ownership ต่อ interface | Must | Integration Operations | dashboard/alert/reconcile runbook ผ่าน rehearsal | INT-002–INT-003 | Risk | Integration Ops |
| OPS-001 | มี private-cloud topology, capacity, monitoring, logs, metrics และ traces | Must | IT Operations | production readiness review ผ่าน | — | Risk | Platform/O11y |
| OPS-002 | Long-running work ใช้ queue workers ไม่ block web request | Must | Architecture | import/index/notification jobs retry และ scale แยกได้ | OPS-001 | Scale | Workers |
| OPS-003 | Backup, restore, failover และ DR ได้รับการทดสอบ | Must | IT Operations | RPO ≤15m/RTO ≤4h หรือค่าที่อนุมัติใหม่ ผ่าน exercise | NFR-003 | Assumption | DR |
| OPS-004 | มี runbook, incident ownership, release/rollback และ support model | Must | Service Owner | operational acceptance evidence ครบ | OPS-001 | Risk | Service Management |
| COMP-001 | Audit log แบบ append-only สำหรับ privileged/commercial/workflow actions | Must | Auditor/Security | audit coverage 100% และตรวจ tamper evidence ได้ | SEC-002 | Risk | Audit |
| COMP-002 | Retention, masking, export และ deletion policy ต้องได้รับอนุมัติ | Must | Data Governance | policy matrix และ test evidence พร้อมก่อน production data | DATA-001 | Open Decision | Data Lifecycle |
| FR-013 | Admin จัดการ OpenAI-compatible provider และ Test Connection ได้โดยไม่เปิดเผย secret | Must | System Admin/Security | server authorization, encrypted key, sanitized test และ audit tests ผ่าน | SEC-004, OPS-005 | Approved AI scope | AI Administration |
| FR-014 | AI สร้าง Meeting/Visit/Call Draft จาก typed/pasted text ตาม schema ที่กำหนด | Must | Sales Operations | user-confirmed selected fields เท่านั้นที่เป็น business record; ไม่มี audio/transcription/autonomous mutation | FR-003, SEC-004 | Approved AI scope | AI Meeting Assistance |
| FR-015 | AI Next Action สร้าง Activity/Task หลัง Human Confirmation แบบ idempotent | Must | Sales Operations | duplicate confirmation สร้าง task เดียว; owner/scope/timezone/audit ถูกต้อง | FR-003, NFR-004 | Approved AI scope | AI Next Action |
| FR-016 | Deal Risk ใช้ versioned deterministic rules และ AI อธิบายได้โดยไม่เป็น trigger authority | Must | Sales Director | same facts/rule version ให้ผลเดิมและ signal ใช้ได้เมื่อ AI unavailable | FR-009, DATA-004 | Approved AI scope | Pipeline Risk |
| NFR-005 | AI outage/timeout ต้องไม่ block core workflow และไม่มี automatic public fallback | Must | IT Operations | timeout/circuit-open tests ผ่าน; manual path ใช้ได้ | OPS-005 | Approved AI scope | AI Resilience |
| SEC-004 | AI input ใช้ least privilege, ห้าม secrets และทุก business mutation ต้อง Human Confirmation | Must | Security/Product | data-boundary, authorization, secret-redaction และ autonomy-negative tests ผ่าน | SEC-002/003 | Approved AI scope | AI Safety |
| DATA-005 | AI output มี provenance/confidence/retention และ feedback ไม่เป็น training consent | Must | Data Governance/AI Governance | provenance completeness, 30-day purge และ no-raw-prompt-default tests ผ่าน | COMP-001/002 | Approved AI scope | AI Governance |
| OPS-005 | AI configuration, quota, timeout, retry, circuit breaker, feature flag และ telemetry ต้อง configurable | Must | SRE/System Admin | provider failure/rotation/quota/retry/disable scenarios ผ่าน | NFR-005 | Approved AI scope | AI Operations |

## 4. Consolidated risk register

Severity พิจารณาจาก Probability × Impact; Critical/High ต้องมี named accountable role ก่อนเริ่ม phase ที่เกี่ยวข้อง

| ID | Risk | P | I | Severity | Owner | Mitigation | Contingency | Trigger |
|---|---|---|---|---|---|---|---|---|
| R-01 | MariaDB 5.5 ไม่รองรับ production evolution | High | Critical | Critical | Architecture | production ใช้ MySQL 8; compatibility benchmark/migration rehearsal | freeze legacy writes, rollback release | unsupported feature/migration failure |
| R-02 | schema ขาด hierarchy/history/audit | High | High | High | Data Architecture | redesign aggregates and forward migrations | limit pilot scope | missing traceability in design review |
| R-03 | unbounded/client-side query ล่มที่ 2M records | High | Critical | Critical | Application Architecture | cursor pagination, indexes, OpenSearch, budgets | disable expensive filter/export | p95/search resource breach |
| R-04 | local identity lifecycle/privilege risk | Medium | Critical | High | Security | MFA, lockout, JML process, audit, SSO boundary | disable privileged account/revoke sessions | orphaned/admin misuse finding |
| R-05 | coarse role model causes data leakage | High | Critical | Critical | Security/Product | scoped policy model and deny-by-default tests | suspend affected scope/export | cross-scope test failure |
| R-06 | external API/SoT unclear | High | High | High | Integration Governance | approved contract and field ownership | manual handoff | contract owner unavailable/change |
| R-07 | duplicate/poor customer data | High | High | High | Data Owner | matching rules, quarantine, stewardship | stop import and reconcile batch | duplicate threshold exceeded |
| R-08 | pricing approval bypass | Medium | Critical | Critical | Pricing Owner | immutable policy, SoD, server-side transition | freeze quote/order and investigate | unapproved commercial transition |
| R-09 | unreliable forecast | High | High | High | Sales Director | stage governance, snapshots, DQ indicators | label forecast incomplete | freshness/completeness breach |
| R-10 | bulk import overload/partial corruption | Medium | Critical | High | Data Operations | staged async jobs, chunking, checkpoints | pause/rollback batch | queue/db saturation or mismatch |
| R-11 | integration data divergence | High | High | High | Integration Operations | idempotency and reconciliation | manual replay/correction | reconciliation mismatch |
| R-12 | 12-month scope overrun | High | High | High | Program Sponsor | phase gates, empowered PO, scope control | defer Should/Could items | milestone/decision slippage |
| R-13 | private-cloud HA/DR not ready | Medium | Critical | Critical | IT Operations | early provisioning and exercises | delayed go-live/read-only mode | failed failover/restore |
| R-14 | missing automated quality gates | High | High | High | QA Lead | test pyramid and CI evidence | block promotion | critical suite absent/failing |
| R-15 | low adoption/shadow spreadsheets | Medium | High | High | Business Change Lead | pilot, UX research, training, KPI ownership | targeted support/process redesign | low active workflow completion |

## 5. Release boundaries and gates

1. **Foundation gate:** architecture, security, data ownership, environments และ test strategy approved
2. **Customer gate:** 2.5M benchmark, search, authorization และ bulk reconciliation pass
3. **Sales gate:** pilot lead/opportunity/forecast UAT และ audit pass
4. **Commercial gate:** coverage-to-approved-quote flow ไม่มี bypass
5. **Integration gate:** outage/replay/reconciliation และ manual fallback pass
6. **Production gate:** security, DR, capacity, UAT, operations และ executive approval complete

## 6. Approved decisions

- **OD-001:** Central Customer Data Governance; stable internal ID; external ID unique per source; deterministic/scored duplicate candidates; Data Steward-approved merge with history/audit
- **OD-002:** Commercial/audit evidence 7 years, sales activities 3 years, security/technical logs 1 year; legal hold overrides deletion; governed export/anonymization/deletion
- **OD-003:** Risk-based approval: T1 ≤10M THB, T2 >10M–100M THB, T3 >100M THB; discount >10%, margin <15% and defined exceptions escalate; maker-checker and no auto-approval
- **OD-004:** No live integrations in year one; adapter/outbox/inbox/reconciliation foundations plus versioned manual handoff for OM, CRM, Billing and Coverage/GIS
- **OD-005:** 99.9% monthly availability excluding approved maintenance, RPO ≤15 minutes, RTO ≤4 hours, quarterly restore and pre-production failover/DR rehearsal
- **OD-006:** One representative enterprise-sales division, 75 named users, four-week pilot plus two-week hypercare; capacity target remains 100 concurrent users +30% headroom

Approval source: project owner confirmation in the Codex task on 2026-07-11. Named Steering Committee signatures remain an administrative evidence item and are not fabricated in this repository.
