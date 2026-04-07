# Document 9-of-9 Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the 3-tier document surface across PDF, DOCX, and XLSX so the product has explicit report, premium-simple, and max-fidelity lanes for each format.

**Architecture:** Reuse the existing report model and artifact envelope, but formalize the product surface with explicit route aliases and clearer engine separation. Keep `report/*` routes opinionated and shared-report-backed, keep `*/generate` routes as premium simple direct generators, and add explicit max-fidelity routes (`pdf/render-html`, `docx/render-template`, `xlsx/render-template`) with format-appropriate engines.

**Tech Stack:** Node.js, PDFKit, ExcelJS, docx, Vercel, x402 route metadata, AgentCash paid verification.

---

## Target 9/9 Surface

### Tier 1: Premium Report
- `POST /api/tools/report/pdf/generate`
- `POST /api/tools/report/docx/generate`
- `POST /api/tools/report/xlsx/generate`

### Tier 2: Premium Simple
- `POST /api/tools/pdf/generate`
- `POST /api/tools/docx/generate`
- `POST /api/tools/xlsx/generate`

### Tier 3: Max Fidelity
- `POST /api/tools/pdf/render-html`
- `POST /api/tools/docx/render-template`
- `POST /api/tools/xlsx/render-template`

### Compatibility
- Keep existing `POST /api/tools/report/generate` as alias to `report/pdf/generate`
- Keep existing `POST /api/tools/html-to-pdf` and `POST /api/tools/markdown-to-pdf` working
- Do not remove current curated routes until new aliases are verified

---

## Ownership Split

### Lead Integrator
**Files**
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\app.js`
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\routes\auto-local\doc-artifacts.js`
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\test\generated-auto-local.test.js`
- Create/Modify: docs as needed

**Responsibilities**
- Add explicit route aliases/metadata for the 9-route surface
- Keep discovery/OpenAPI coherent
- Integrate worker outputs without cross-file conflict
- Deploy and run paid production verification

### Worker A: PDF Max-Fidelity
**Files**
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\package.json`
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\routes\auto-local\pdf-generators.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\test\auto-local-pdf-premium.test.js`

**Responsibilities**
- Add Chromium-backed HTML-to-PDF renderer for `pdf/render-html`
- Preserve existing semantic HTML/markdown renderer as the premium-simple lane
- Return the same artifact envelope and file naming conventions

### Worker B: DOCX 3-Tier Completion
**Files**
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\routes\auto-local\docx-generator.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\test\auto-local-docx-premium.test.js`

**Responsibilities**
- Upgrade `docx/generate` into true premium-simple direct generation from markdown/html/simple sections
- Expose explicit template-backed mode for `docx/render-template`
- Keep report-backed DOCX route premium and structured

### Worker C: XLSX 3-Tier Completion
**Files**
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\routes\auto-local\xlsx-generator.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\test\auto-local-xlsx-premium.test.js`

**Responsibilities**
- Upgrade `xlsx/generate` into premium-simple direct generation from HTML tables, markdown tables, and simple row/table payloads
- Expose explicit template-backed mode for `xlsx/render-template`
- Keep report-backed XLSX route premium and structured

---

## Wave 0: Route Model and Assumptions

### Step 1: Preserve current public routes
No removals.

### Step 2: Add new explicit aliases
Lead should add a document alias system similar to the workflow compatibility alias system so generated document routes can expose:
- `report/pdf/generate`
- `report/docx/generate`
- `report/xlsx/generate`
- `pdf/render-html`
- `docx/render-template`
- `xlsx/render-template`

### Step 3: Keep pricing differentiated
Assume:
- report lanes: medium price
- premium simple lanes: low/medium price
- max-fidelity lanes: highest price

Exact pricing can be tuned in `app.js` route overrides during integration.

---

## Wave 1: Tests First

### Lead
1. Add failing generated-route discovery/OpenAPI tests for the six new explicit aliases.
2. Run:
   - `node --test "C:\Users\KentEgan\claude projects\x402-data-bazaar\test\generated-auto-local.test.js"`
3. Expect: FAIL

### Worker A
1. Add failing PDF premium tests covering:
   - Chromium-backed `pdf/render-html`
   - CSS table borders/layout present in extracted output or artifact metadata
   - direct route does not fall back to semantic path when Chromium is available
2. Run:
   - `node --test "C:\Users\KentEgan\claude projects\x402-data-bazaar\test\auto-local-pdf-premium.test.js"`
3. Expect: FAIL

### Worker B
1. Add failing DOCX tests covering:
   - markdown -> styled DOCX
   - html -> styled DOCX
   - `docx/render-template` with `nda`, `letter`, and `report`
2. Run:
   - `node --test "C:\Users\KentEgan\claude projects\x402-data-bazaar\test\auto-local-docx-premium.test.js"`
3. Expect: FAIL

### Worker C
1. Add failing XLSX tests covering:
   - HTML table -> workbook
   - markdown table -> workbook
   - `xlsx/render-template` with `invoice` and `tracker`
2. Run:
   - `node --test "C:\Users\KentEgan\claude projects\x402-data-bazaar\test\auto-local-xlsx-premium.test.js"`
3. Expect: FAIL

---

## Wave 2: Minimal Implementation

### Worker A
1. Add Chromium-backed renderer in `pdf-generators.js`.
2. Prefer a dedicated function such as `generateChromiumHtmlPdfBuffer(payload)`.
3. Keep a clean fallback contract if Chromium is unavailable in local tests, but mark engine selection in capabilities.
4. Do not edit `app.js`.

### Worker B
1. Add a small internal normalizer in `docx-generator.js` for:
   - markdown headings, bullets, code blocks, tables
   - html headings, lists, paragraphs, tables
2. Add explicit template mode handling for:
   - `report`
   - `nda`
   - `letter`
   - `general`
3. Do not edit `app.js`.

### Worker C
1. Add internal normalization in `xlsx-generator.js` for:
   - markdown tables
   - HTML tables
   - direct row/table payloads
2. Add explicit template mode handling for:
   - `invoice`
   - `tracker`
   - `general`
3. Do not edit `app.js`.

### Lead
1. Integrate worker outputs into `doc-artifacts.js`.
2. Route based on:
   - path
   - requested format
   - requested engine/template mode
3. Add route alias metadata and pricing in `app.js`.

---

## Wave 3: Verification

### Local
Run:
- `node --test "C:\Users\KentEgan\claude projects\x402-data-bazaar\test\auto-local-doc-artifacts.test.js"`
- `node --test "C:\Users\KentEgan\claude projects\x402-data-bazaar\test\auto-local-pdf-premium.test.js"`
- `node --test "C:\Users\KentEgan\claude projects\x402-data-bazaar\test\auto-local-docx-premium.test.js"`
- `node --test "C:\Users\KentEgan\claude projects\x402-data-bazaar\test\auto-local-xlsx-premium.test.js"`
- `node --test "C:\Users\KentEgan\claude projects\x402-data-bazaar\test\generated-auto-local.test.js"`
- `node -e "require('C:/Users/KentEgan/claude projects/x402-data-bazaar/app.js')"`

Expected: PASS

### Deploy
Run:
- `cmd /c npx vercel deploy --prod --yes`

### Paid Production Verification
Use AgentCash paid requests to verify:
- `POST /api/tools/report/pdf/generate`
- `POST /api/tools/report/docx/generate`
- `POST /api/tools/report/xlsx/generate`
- `POST /api/tools/pdf/generate`
- `POST /api/tools/docx/generate`
- `POST /api/tools/xlsx/generate`
- `POST /api/tools/pdf/render-html`
- `POST /api/tools/docx/render-template`
- `POST /api/tools/xlsx/render-template`

Confirm:
- correct artifact type
- route appears in discovery/OpenAPI
- price tier matches intended lane
- no stub/fallback-only outputs on premium routes

---

## Success Criteria

- All 9 lanes exist as explicit product surfaces.
- Discovery/OpenAPI describe the three-tier model clearly.
- Report lanes are the strongest structured paths.
- Simple lanes are premium enough for direct use without the report funnel.
- Max-fidelity lanes are explicit and higher priced.
- Legacy routes still work.

---

## 2026-04-05 Implementation Status

### Completed
- All 9 explicit routes are implemented and live on `https://x402.aurelianflo.com`.
- Discovery/OpenAPI publish the 9-route surface.
- Local tests pass for:
  - `test/auto-local-doc-artifacts.test.js`
  - `test/auto-local-pdf-premium.test.js`
  - `test/auto-local-docx-premium.test.js`
  - `test/auto-local-xlsx-premium.test.js`
  - `test/generated-auto-local.test.js`
- Paid production verification passed for:
  - `report/pdf/generate`
  - `report/docx/generate`
  - `report/xlsx/generate`
  - `pdf/generate`
  - `docx/generate`
  - `xlsx/generate`
  - `docx/render-template`
  - `xlsx/render-template`
  - `pdf/render-html` route/payment/artifact path

### Current Live Score
- Product surface implemented: `9/9`
- Fully verified at intended engine fidelity: `9/9`

### Remaining Gap
- None blocking. The final max-fidelity PDF lane is now running with a true Chromium engine in production.

### Latest Observed Live State
- `pdf/render-html` returns:
  - `lane: max-fidelity`
  - `requestedEngine: chromium`
  - `engine: chromium`
  - `fulfilledLane: max-fidelity`
  - `degraded: false`

### Notes
- Root causes fixed in code:
  - the serverless Chromium pack URL helper originally rejected the function-like `@sparticuz/chromium-min` export
  - the runtime adapter order needed to prefer the full `@sparticuz/chromium` package once it was bundled into production
- Final paid verification succeeded for `POST /api/tools/pdf/render-html` with:
  - `engine: chromium`
  - tx hash: `0x21dac49cf0b7acb251d13ac04357ee20a1b95c19cc6aaed173b1f7184e571e22`
