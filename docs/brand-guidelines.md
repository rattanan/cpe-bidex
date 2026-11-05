# CP Engineering application identity

Owner request: update the CPE template, colors, logo, company information and readable typography. Reference inspected on 2026-11-05: [About CP Engineering](https://cpe.cpcrts.com/en/pages/322/About-CP-Engineering/).

## Company content and asset provenance

`lib/company-profile.ts` holds the read-only public company profile, not business/workflow reference data. Official company name: บริษัท เจริญโภคภัณฑ์วิศวกรรม จำกัด / Charoen Pokphand Engineering Co., Ltd.; founded in 1978. The reference identifies three business areas: seeds and grains processing, engineering and construction, and renewable energy. Vision and mission are paraphrased in Thai from the reference's overview/vision/mission graphics.

Public footer contact: 97 Yenjit Road, Thung Wat Don, Sathorn, Bangkok 10120; 02-780-2890; info@cpe.co.th. The original map link is retained. No private contact, financial identifiers or unverified company registration data is added.

`public/brand/cp-engineering-logo.png` is the unchanged official header asset from `https://dglgnp0mchi1j.cloudfront.net/website-logos/logos/34/93eb7e96-306c-4d83-862f-841b2468b3a7.png` (SHA-256 `8f84f2d5445579420daf8369fb91d40dfb177d23928574bbe80e2d963ca419d5`). Preserve its proportions and green/gold artwork. Use a white surface and clear space; no effects, recoloring, stretching or AI reconstruction. The legacy NT logo remains unchanged.

## Palette and typography

The application palette interprets the reference's navy/cyan website and green/gold logo; these values are application choices, not a claimed official corporate color standard. Navy `#152650` / `#192e5c`; accessible blue action `#006e9c` with white text; green accent `#008d52`; amber `#f39b19`; light background `#f3f6fb`. Dark mode uses navy surfaces, light text and cyan accents. Status colors retain their existing meaning.

Self-hosted Noto Sans Thai 400/500/600/700 is sourced from Google Fonts and distributed with its SIL Open Font License under `public/fonts/noto-sans-thai/`. Font delivery needs no third-party request at runtime. Main body/forms 16px, table body 15px, table headings/secondary content 14px, page headings 30px (26px on mobile), card headings 18px, primary controls at least 44px high. Small 12–13px text is restricted to decorative labels, product/version labels and secondary footer text. Charts retain bounded horizontal scrolling to keep axis labels readable on narrow viewports.

## Surfaces and verification

- Shared `CompanyBrand` renders the unchanged logo and product identity on login, sidebar and company page; metadata/favicon also uses the company identity.
- Login introduces the company and product alongside the existing authentication form. `/company` is authenticated by the existing portal layout and presents only public company facts with a source link. Sidebar/mobile company links are available to all signed-in users; no role grants, organization data or authorization policy changes.
- Executive dashboard gains a compact company introduction. Existing screen/data workflows, server search/sort/pagination and legacy routes remain intact.
- E2E acceptance checks actual rendered font sizes, all twelve business screens, company contact links, light/dark appearance, mobile overflow and the existing PM denial case. Unit checks retain the original asset digest and verify contact link consistency.

No database migration, seed, user change or new environment configuration is needed. Rollback is an application release change only.

Product labels are shared through `PRODUCT` in `lib/company-profile.ts`: CPE Project Bid Excellence, CPE, and CPE AI Assistant. Help Center, administrative copy and handoff badges use this identity; spreadsheet author metadata uses the legal company name. The page assistant's identity prompt is versioned as `page-assistant.prompt.v2`; its grounding, read-only constraints and input isolation remain intact. Retained compatibility identifiers (session/storage keys, encryption context, integration environment variables and issued API key prefixes) are technical contracts, not product labels, and remain stable.

## Login contrast correction — 2026-11-06

The login card remains white in both themes. It now defines its own foreground, muted foreground, input surface and color-scheme tokens so the shared dark-theme field-label rule cannot inherit a white foreground into this white card. Typed text, caret, placeholders and browser autofill also have explicit readable colors. Portal forms continue to use their actual light/dark surfaces.

Browser regression measures composited text/background contrast (minimum 4.5:1) for login labels and typed inputs at desktop/mobile sizes in both themes, controls across all twelve CPE pages, and the sales/catalog/vendor/finance creation drawers. The optional `CPE_ADMIN_CREDENTIALS_FILE` acceptance case checks the administrator's populated demo dashboard without logging credentials.
