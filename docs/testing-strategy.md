# NTOP Testing Strategy

| Metadata | Value |
|---|---|
| Status | Approved Baseline |
| Version | 1.1 |
| Owner | QA and Quality Engineering Lead |
| Reviewers | Product, Architecture, Security, Data, Integration, SRE, Business SMEs |
| Last Updated | 2026-07-11 |
| Related Documents | [Requirements](product-requirements.md), [Architecture](system-architecture.md), [API](api-design.md), [Permissions](roles-and-permissions.md), [Roadmap](implementation-roadmap.md) |
| Assumptions | Automated CI gates; synthetic/masked data only before migration approval |
| Open Decisions | Toolchain; performance environment sizing; penetration-test provider; defect SLA; production test-data policy |

## 1. Quality model and ownership

- Developers own unit/component/integration tests; QA owns strategy, E2E, exploratory และ release evidence
- Security owns threat-based acceptance; Data owns quality/reconciliation; SRE owns resilience/DR; business owners own UAT
- Test pyramid: many domain unit tests, service/database integration tests, API/event contracts, focused E2E/UAT
- Test data deterministic, synthetic by default; secrets/production PII ห้ามอยู่ใน fixtures/logs

## 2. Test levels

| Level | Coverage | Gate |
|---|---|---|
| Unit/domain | invariants, transitions, totals, forecast formulas, validation, policy evaluation | every change |
| Integration | MySQL migrations/transactions, outbox/inbox, Redis, RabbitMQ, OpenSearch, object storage | merge/nightly |
| Contract | OpenAPI, event schemas, adapters, backward compatibility, idempotency | merge/provider release |
| E2E workflow | role-based lead→order journeys and failure paths | release candidate |
| UAT | business process, language/UX, evidence, operational handoff | phase/production gate |
| Non-functional | performance, security, resilience, accessibility, recovery | scheduled + production gate |

## 3. Critical scenarios

- Customer duplicate/merge, hierarchy cycle, ownership history และ scoped search
- Lead conversion retry; Opportunity unrestricted target-stage transitions, unauthorized scope และ stale version
- Coverage/solution prerequisites; deterministic quote totals/versioning
- Maker-checker, authority/delegation expiry, return/resubmit/supersede
- Won→Internal Order handoff, acknowledgement, return/rework และ manual fallback
- Forecast snapshot reproducibility, rollup, timezone, rounding, slippage และ quality warning
- Bulk preview/promote/reject/resume/reconcile; export authorization/expiry
- Integration duplicate/out-of-order/timeout-after-success/DLQ/replay/reconciliation

## 4. Permission and security

Generate role × scope × action positive/negative matrix from [roles-and-permissions.md](roles-and-permissions.md) Critical negatives: ID guessing, cross-org access, hidden-field serialization, admin self-escalation, maker approval, expired delegation, bulk export, document download และ audit mutation

Security suite: authentication/MFA/session revocation, OWASP application/API, injection, CSRF/XSS, SSRF, rate limit, secrets/dependencies/SAST, malware/file upload, webhook replay/signature และ penetration test (SEC-001–SEC-003)

## 5. Data and migration

- Forward/backward compatibility อย่างน้อยหนึ่ง release; expand/backfill/verify/contract rehearsal
- 2.5M synthetic customers with realistic hierarchy/contact/activity skew
- Import checksum/count, invalid quarantine, duplicate resolution และ rerun idempotency
- MySQL↔OpenSearch rebuild/reconcile; external interface mismatch/repair
- Backup restore verifies row counts, critical hashes, users/permissions และ application smoke tests

## 6. Performance workload

Environment ต้อง production-representative และ isolated Baseline: 2.5M customers, related sales history, 100 concurrent active users + 30% headroom Mix draft: 40% search/list, 25% detail, 15% activity/write, 10% workflow, 5% dashboard, 5% async submission

Acceptance: exact lookup p95 <1s; full-text/filter p95 <2s; normal write p95 <1.5s; error rate <1%; no unbounded query; queue/search lag within approved SLO; DB/CPU/memory/connection มี safe headroom (NFR-001/002)

Run load, stress, soak, spike, bulk-import contention และ large-export tests; report dataset, build, topology, query plans และ bottleneck ไม่รายงานเฉพาะ average

## 7. Resilience and DR

Inject app node loss, MySQL failover, Redis/queue/search node failure, queue backlog, object-store/adapter outage, credential expiry และ network timeout ตรวจ graceful degradation, no data loss/duplicate effect, alerts/runbooks/recovery

Restore/failover exercise ต้องพิสูจน์ draft RPO ≤15m/RTO ≤4h หรือ approved replacement; DR evidence รวม timestamps, decision log, reconciliation และ corrective actions (NFR-003, OPS-003)

## 8. CI/CD quality gates

- PR: lint/type/unit, changed integration/contract, SAST/dependency/secret scan
- Main/nightly: full integration, migration, permission matrix subset, E2E, schema compatibility
- Release candidate: full critical E2E, performance delta, DAST/security, restore smoke, UAT evidence
- Production: signed approvals, immutable artifacts/SBOM, migration/rollback plan, feature flags, dashboards/runbooks

Block release เมื่อ Critical/High security defect, Must acceptance failure, migration/recovery failure, unauthorized access, approval bypass หรือ unresolved data loss risk

## 9. Requirement coverage matrix

| Requirement group | Unit | Integration | Contract | E2E/UAT | NFR/Security/DR |
|---|---:|---:|---:|---:|---:|
| BR-001, FR-001, FR-010/011, DATA-001–003 | ✓ | ✓ | ✓ | ✓ | performance/data |
| BR-002, FR-002–008 | ✓ | ✓ | ✓ | ✓ | permission/resilience |
| BR-003, FR-009, DATA-004 | ✓ | ✓ | API | ✓ | scale/reproducibility |
| BR-004, SEC-002, COMP-001 | ✓ | ✓ | API/event | ✓ | security/audit |
| BR-005, INT-001–004 | ✓ | ✓ | ✓ | ✓ | chaos/reconciliation |
| NFR-001–004, OPS-001–004, SEC-001/003 | targeted | ✓ | ✓ | smoke/UAT | ✓ |

ทุก Must requirement ต้องมี linked automated test IDs และ acceptance evidence ใน release record; ตารางนี้เป็น coverage baseline ไม่แทน detailed test cases

**Must requirement coverage index:** BR-001, BR-002, BR-003, BR-004, BR-005; FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-013, FR-014, FR-015, FR-016; NFR-001, NFR-002, NFR-003, NFR-004, NFR-005; SEC-001, SEC-002, SEC-003, SEC-004; DATA-001, DATA-002, DATA-003, DATA-004, DATA-005; INT-001, INT-002, INT-003, INT-004; OPS-001, OPS-002, OPS-003, OPS-004, OPS-005; COMP-001, COMP-002. รายการนี้ต้องถูกแทนด้วย test case IDs จริงใน test management system ก่อน Production gate

## 10. Exit evidence

Test summary, requirement trace, defect/risk disposition, performance report, security report, migration/reconciliation, DR timestamps, UAT sign-off และ operational readiness ต้องเก็บแบบ versioned/auditable ต่อ phase gate

## 11. AI Release 1 testing

| Area | Required scenarios/evidence |
|---|---|
| Provider admin | Admin positive/non-Admin negative; endpoint/model/timeout validation; write-only encrypted key; wrong master key/tamper fail closed; sanitized Test Connection; audit without secret |
| Scope exclusion | no web fetch/browser, audio/video/transcription, transcript-file, document-analysis, Opportunity/Quote/Stage mutation routes in Release 1 |
| Meeting Draft | typed/pasted input only; size/secret/prompt-injection rejection; strict schema; unknown fields; edit/select/confirm; AI outage manual Activity path |
| Next Action | authorization, Customer/Opportunity context, owner resolution, timezone round-trip, idempotent duplicate confirmation and provenance |
| Deal Risk | deterministic same facts/version; configurable thresholds; history unchanged after rule change; explanation optional when AI unavailable |
| Safety/data | least-privilege allowlist, cross-scope denial, secret/PII redaction, no raw prompt storage, no public provider fallback |
| Governance | provenance completeness, Helpful/Incorrect/Unsafe feedback, abandoned metadata purge at 30 days, no training-consent implication |
| Operations | timeout, transient/non-retryable error, bounded retry, concurrency/quota, circuit breaker, feature flag, cancel/retry AI Job and telemetry redaction |

AI acceptance blocks capability enablement, not core application release Core regression suite must prove all manual workflows remain operational with AI disabled and provider unavailable

## 12. CPE construction workspace

The active CPE baseline and acceptance trace are in [CPE implementation](cpe/implementation.md). Run the added CPE unit suite with `npm test`; opt-in real-database and browser suites require an isolated local `cpe_*test*` database and explicit `RUN_CPE_DB_INTEGRATION=1` / `CPE_E2E=1`. Legacy tests remain regression coverage for the retained NTOP routes and contracts.
