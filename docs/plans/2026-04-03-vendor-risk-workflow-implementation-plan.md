# Vendor Risk Workflow Implementation Plan

**Goal:** Ship `POST /api/workflows/vendor/risk-forecast` as the first non-sports workflow adapter on top of the current x402 stack, using the existing compliance endpoints plus the shared report and document-generation system.

**Architecture:** Keep the current compliance sellers intact. Add a new bundled seller app for vendor workflows that accepts task-shaped vendor input, orchestrates the existing vendor/sanctions routes, returns a normalized risk result, emits the shared report contract, and optionally bundles XLSX/PDF/DOCX artifacts.

**Tech Stack:** Express, current bundled seller pattern, existing compliance handlers/libs where reusable, shared `lib/report-builder.js`, auto-local document artifacts, Vercel deployment, AgentCash paid canaries

---

## Delivery Model

This plan is optimized for parallel execution with one lead integrator and three worker lanes.

### Recommended Agent Count
- `1` lead integrator
- `3` worker agents

### Lead Responsibilities
- own cross-cutting integration files
- keep the workflow contract coherent
- review merge boundaries
- run full verification
- deploy and run paid canaries

### Worker Lane Boundaries
- Lane A: vendor workflow package and orchestration core
- Lane B: report/artifact mapping and shared-report compatibility
- Lane C: tests, fixtures, and canary scripts

### Lead-Only Files
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\app.js`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\test\generated-auto-local.test.js`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\docs\plans\2026-04-03-vendor-risk-workflow-spec.md`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\docs\plans\2026-04-03-vendor-risk-workflow-implementation-plan.md`

Do not let multiple agents edit `app.js` in parallel.

---

## Target File Layout

### New Package
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\app.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\index.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\package.json`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\seller.config.json`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\test.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\canary.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\paid-canary.cjs`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\handlers\primary.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\lib\workflow-params.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\lib\report.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\lib\artifact-path.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\lib\risk-model.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\lib\upstream-clients.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\fixtures\vendor-batch-2026-04-03.json`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\workflows\vendor\risk-forecast.js`

### Shared-Layer Touch Points
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\lib\report-builder.js`
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\routes\auto-local\report-document-adapter.js`
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\routes\auto-local\doc-artifacts.js`
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\test\auto-local-doc-artifacts.test.js`

### Root-App Integration Touch Points
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\app.js`
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\test\generated-auto-local.test.js`

---

## Wave 0: Serial Foundation

Lead-only. Do not dispatch workers until this scaffold exists.

### Task 1: Scaffold the vendor workflow package

**Files:**
- Create the package skeleton under `apps\vendor-workflows`

**Steps:**
1. Add the new package folder and basic files.
2. Define one paid route: `POST /api/workflows/vendor/risk-forecast`.
3. Make the handler return `501 not_implemented`.
4. Add an initial failing contract test in the package.
5. Confirm the package test fails for missing implementation, not bad wiring.

**Verification Command:**
- `node test.js`

---

## Wave 1: Parallel Build Lanes

### Lane A: Vendor Workflow Core

**Owner:** Worker A

**Files:**
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\handlers\primary.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\lib\workflow-params.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\lib\risk-model.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\lib\upstream-clients.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\workflows\vendor\risk-forecast.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\fixtures\vendor-batch-2026-04-03.json`

**Scope:**
- request parsing and validation
- `single_vendor` and `vendor_batch` handling
- orchestration strategy over existing compliance endpoints
- normalized vendor evidence model
- risk-tier and recommendation mapping
- top-level workflow response shaping

**Do Not Touch:**
- `app.js`
- shared document routes

**Steps:**
1. Add failing tests for invalid mode, missing vendors, too many vendors, and duplicate names.
2. Add failing happy-path tests for `single_vendor` and `vendor_batch`.
3. Implement request parsing in `workflow-params.js`.
4. Implement a transparent risk mapper in `risk-model.js`.
5. Implement upstream composition helpers in `upstream-clients.js`.
6. Implement the workflow executor in `risk-forecast.js`.
7. Wire the primary handler to the executor.
8. Run package tests until green.

**Verification Commands:**
- `node test.js`

---

### Lane B: Report and Artifact Integration

**Owner:** Worker B

**Files:**
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\lib\report.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\lib\artifact-path.js`
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\lib\report-builder.js`
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\routes\auto-local\report-document-adapter.js`
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\routes\auto-local\doc-artifacts.js`
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\test\auto-local-doc-artifacts.test.js`

**Scope:**
- workflow result to shared report model mapping
- vendor-specific tables for ranking and flagged counterparties
- recommended local path metadata
- artifact adapter compatibility for workflow-generated vendor reports

**Do Not Touch:**
- vendor request parsing
- root discovery logic in `app.js`

**Steps:**
1. Add failing tests for shared report ingestion of vendor workflow output.
2. Add failing tests for recommended path propagation for XLSX and PDF.
3. Implement the vendor report builder.
4. Extend shared report handling only where necessary.
5. Ensure document adapters consume vendor workflow reports directly.
6. Run artifact tests until green.

**Verification Commands:**
- `node --test test/auto-local-doc-artifacts.test.js`

---

### Lane C: Tests, Fixtures, and Paid Canary

**Owner:** Worker C

**Files:**
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\test.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\canary.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\paid-canary.cjs`
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\vendor-workflows\package.json`

**Scope:**
- local scenario corpus
- deterministic workflow assertions
- artifact-bundling assertions
- paid production canary for single and batch modes

**Do Not Touch:**
- root app integration
- shared report/document internals unless blocked

**Steps:**
1. Add local canary cases for one vendor and a batch.
2. Add reproducibility checks for stable parts of the workflow payload.
3. Add a paid canary script that exercises:
   - `single_vendor`
   - `vendor_batch`
   - one artifact-bundling path
4. Add package scripts for `test`, `test:canary`, and `test:paid-canary`.
5. Run local tests and canaries until green.

**Verification Commands:**
- `node test.js`
- `node canary.js`

---

## Wave 2: Serial Integration

Lead-only again.

### Task 2: Bundle the vendor workflow seller into the root app

**Files:**
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\app.js`

**Steps:**
1. Require the vendor workflow seller config and primary handler.
2. Extend the bundled seller route collection.
3. Route seller `vendor-workflows` to the vendor primary handler.
4. Add the new workflow route to the curated public discovery allowlist.
5. Add workflow metadata that matches the curated core surface.

**Verification Commands:**
- `node --test test/generated-auto-local.test.js`
- `node test.js` in `apps/vendor-workflows`

---

### Task 3: Tighten discovery and OpenAPI coverage

**Files:**
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\app.js`
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\test\generated-auto-local.test.js`

**Steps:**
1. Add the workflow route to curated `/api` and curated `/openapi.json`.
2. Keep the full-system discovery unchanged.
3. Add explicit assertions for:
   - public discovery includes the vendor workflow route
   - public OpenAPI includes the vendor workflow route
   - curated surface size changes only by the intended route

**Verification Commands:**
- `node --test test/generated-auto-local.test.js`

---

## Wave 3: Full Verification

Lead-only.

### Task 4: Run the full local verification suite

**Commands:**
- `node --test test/generated-auto-local.test.js`
- `node --test test/auto-local-doc-artifacts.test.js`
- `node test.js` in `apps/vendor-workflows`
- `node canary.js` in `apps/vendor-workflows`
- existing core suites that could be affected:
  - `node test.js` in `apps/sports-workflows`
  - `node canary.js` in `apps/sports-workflows`

---

### Task 5: Deploy and run paid production canaries

**Steps:**
1. Deploy to production.
2. Verify AgentCash discovery shows the new workflow route.
3. Run the paid vendor workflow canary.
4. Save the latest paid canary report.
5. Confirm the workflow returns a report-compatible payload and at least one embedded artifact path.

**Verification Commands:**
- `cmd /c npx vercel deploy --prod -y`
- `node paid-canary.cjs`

---

## Future Follow-On Lanes

Once vendor risk forecast is live, the same adapter package can be extended for:
- `vendor/onboarding-report`
- `vendor/portfolio-monitor`
- `vendor/rescreen-batch`

Keep new workflow logic inside:
- `apps\vendor-workflows\workflows\vendor\...`

Do not parallelize multiple agents against shared report/document files unless the lead sequences them.

---

## Suggested Agent Prompts

### Worker A Prompt
Implement the vendor workflow core in `apps/vendor-workflows` only. Own request parsing, orchestration over the existing compliance surfaces, transparent risk scoring, and the workflow executor for `POST /api/workflows/vendor/risk-forecast`. Do not edit root `app.js` or shared document files. Add and pass local package tests. Report changed files only.

### Worker B Prompt
Implement vendor workflow result to shared report/artifact mapping. Own `apps/vendor-workflows/lib/report.js`, `apps/vendor-workflows/lib/artifact-path.js`, and shared report/document compatibility in `lib/report-builder.js`, `routes/auto-local/report-document-adapter.js`, `routes/auto-local/doc-artifacts.js`, and `test/auto-local-doc-artifacts.test.js`. Do not edit root `app.js`. Report changed files only.

### Worker C Prompt
Build the vendor workflow verification layer only. Own `apps/vendor-workflows/test.js`, `apps/vendor-workflows/canary.js`, `apps/vendor-workflows/paid-canary.cjs`, and `apps/vendor-workflows/package.json`. Do not edit root `app.js` or shared document files unless absolutely required. Report changed files only.

---

## Success Criteria

The plan is complete when all of the following are true:
- `POST /api/workflows/vendor/risk-forecast` exists and is paid
- it accepts task-shaped vendor input rather than low-level query strings
- it returns workflow metadata, summary, per-vendor ranking, assumptions, diagnostics, and a shared-report-compatible payload
- curated `/api` and `/openapi.json` include the workflow route
- local and paid canaries pass
- the workflow can answer "screen these vendors and give me an XLSX" without the caller manually orchestrating compliance endpoints
