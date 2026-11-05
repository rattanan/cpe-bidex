# CPE Bidex Help Center

The owner requested replacing the active sales-platform Help Center with CPE Bidex guidance on 2026-11-06. The catalog contains 17 reviewed Thai guides covering all twelve CPE screens, onboarding, organization/role access, sample data, dialog troubleshooting and the read-only AI assistant.

## Sources and scope

Content follows `docs/cpe/implementation.md`, `docs/cpe/demo-data.md`, the live CPE screen configuration, UI labels and command validation. It explains the actual BOQ/cost-review/bid/RFQ/PO/project/cash/master workflow. It does not advertise document upload/scanning, market-price feeds, bank transfers or AI approval as CPE capabilities. Provider settings and the optional assistant behavior are retained; CPE business pages do not acquire a new AI feature.

`lib/help-center.ts` is the active article/search/retrieval source, with shared types in `lib/help-center-types.ts`. Role filters use Executive, Sales, Estimator, Procurement, PM and Administrator labels. These filters choose documentation, not record access permissions. Article pages include a contents list and a link to the related workspace; existing page authorization still applies.

## Compatibility

The previous article data is retained in `lib/help-center-legacy.ts` for existing bookmarks and routes. A legacy-only article displays an explicit archive notice and link to the current catalog. Archived guides are excluded from active search, current related articles and AI retrieval. The existing `ai-page-assistant` URL now resolves to the current CPE assistant guide.

AI retrieval selects only active CPE guides, ranks the actual `/cpe/<screen>` or help-article route ahead of keyword matches, and includes the assistant safety guide with at most three sources. Existing grounding, input isolation, authentication, secret checks and read-only limits remain intact.

## Verification and maintenance

- Unit coverage checks each CPE screen's guide and AI route relevance, Thai/English multiword search, role filtering, FAQ/body search, current metadata, bounded source count, capability caveats and legacy URL compatibility.
- `tests/e2e/cpe-help.spec.ts` checks real login, 17 current cards, Procurement RFQ/PO search, FAQ opening, all article routes/workspace links, readable dark/light/mobile text, and archived-route notices. It uses explicit protected demo credentials and does not submit business commands or call an AI provider.
- When a CPE screen or command changes, review its guide against actual labels and constraints, update its review date, related links and tests. Keep company/private data and secrets out of article text.

No database migration, seed, role assignment or new runtime setting is required. This is an application release; retain database/audit state when rolling back code.

## Changed files

- Content and compatibility: `lib/help-center.ts`, `lib/help-center-types.ts`, `lib/help-center-legacy.ts`.
- Help pages: `app/(portal)/help/page.tsx`, `app/(portal)/help/[slug]/page.tsx`.
- Existing UI styling/helpers: `components/company-brand.css`, `components/form-field-assistance.tsx`, `components/expandable-text-assistance.tsx`, `components/province-input-assistance.tsx`. Legacy automatic field helpers skip documentation pages; the separate page assistant is retained.
- Regression coverage: `tests/unit/cpe/help-center.test.ts`, `tests/unit/app-shell-help-contract.test.ts`, `tests/unit/page-assistant-service.test.ts`, `tests/e2e/cpe-help.spec.ts`, `tests/e2e/cpe-demo.spec.ts`.
- Documentation: this file and `docs/server-deployment.md`.
