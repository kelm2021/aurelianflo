# Workflow Adapter Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the first workflow-adapter vertical slice on top of the existing x402 stack, starting with `POST /api/workflows/sports/nba/playoff-forecast`, including report generation, XLSX/PDF export compatibility, curated discovery metadata, and paid canary coverage.

**Architecture:** Keep the existing generic simulator, shared report model, and document-generation stack. Add a new bundled seller app for sports workflows that translates task-shaped sports inputs into simulator inputs, emits the shared report contract, and reuses the current artifact pipeline. Reserve root-app discovery wiring for the integration lane only.

**Tech Stack:** Express, existing x402 middleware, current bundled seller pattern, shared `lib/report-builder.js`, auto-local document artifacts, Vercel deployment, AgentCash paid canaries

---

## Delivery Model

This plan is optimized for parallel agent execution. Do not split work arbitrarily by endpoint. Split it by layer so each lane owns mostly disjoint files.

### Recommended Agent Count
- `1` lead integrator
- `3` worker agents

### Lead Responsibilities
- own the cross-cutting files
- sequence the waves
- review integration points
- run full verification
- deploy and run live paid canaries

### Worker Lane Boundaries
- Lane A: sports workflow package and NBA normalization
- Lane B: shared-report and artifact mapping for workflow results
- Lane C: tests, canaries, and fixture corpus for the new workflow package

### Lead-Only Files
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\app.js`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\test\generated-auto-local.test.js`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\docs\plans\2026-04-03-workflow-adapter-spec.md`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\docs\plans\2026-04-03-workflow-adapter-implementation-plan.md`

Do not let multiple agents edit `app.js` in parallel.

---

## Target File Layout

### New Package
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\app.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\index.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\package.json`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\seller.config.json`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\test.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\canary.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\paid-canary.cjs`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\handlers\primary.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\lib\workflow-params.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\lib\report.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\lib\artifact-path.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\workflows\nba\playoff-forecast.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\workflows\nba\normalize.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\workflows\nba\defaults.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\fixtures\nba-standings-2026-04-03.json`

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

This wave is lead-only. Do not dispatch workers until this is done.

### Task 1: Scaffold the sports workflow package

**Files:**
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\package.json`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\app.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\index.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\seller.config.json`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\handlers\primary.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\test.js`

**Steps:**
1. Create the package directory and file skeleton.
2. Define a single initial paid route: `POST /api/workflows/sports/nba/playoff-forecast`.
3. Make the handler return `501 not_implemented` initially.
4. Write a failing local test that expects the final contract shape, not the placeholder.
5. Run the new package tests and confirm the contract test fails.

**Verification Command:**
- `node test.js`

**Expected Result:**
- one failing test for the missing NBA workflow behavior

---

## Wave 1: Parallel Build Lanes

Once Wave 0 is complete, dispatch the workers.

### Lane A: Sports Workflow Core

**Owner:** Worker A

**Files:**
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\handlers\primary.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\lib\workflow-params.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\workflows\nba\playoff-forecast.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\workflows\nba\normalize.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\workflows\nba\defaults.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\fixtures\nba-standings-2026-04-03.json`

**Scope:**
- request parsing and validation
- `standings_snapshot` and `custom_field` mode handling
- normalization from sports input into generic sim request
- default weights, uncertainties, assumptions, and diagnostics
- ranking/prediction output shaping

**Do Not Touch:**
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\app.js`
- shared document routes

**Steps:**
1. Add failing tests for invalid mode, invalid team shape, and missing fields.
2. Add failing test for `custom_field` happy path.
3. Implement request parsing in `workflow-params.js`.
4. Implement NBA defaults in `defaults.js`.
5. Implement team normalization in `normalize.js`.
6. Implement workflow executor in `playoff-forecast.js`.
7. Wire the handler path to the new executor.
8. Run the package tests and make them pass.

**Verification Commands:**
- `node test.js`

---

### Lane B: Report and Artifact Integration

**Owner:** Worker B

**Files:**
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\lib\report.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\lib\artifact-path.js`
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\lib\report-builder.js`
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\routes\auto-local\report-document-adapter.js`
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\routes\auto-local\doc-artifacts.js`
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\test\auto-local-doc-artifacts.test.js`

**Scope:**
- workflow result to shared report model mapping
- workbook-ready sports tables
- recommended local artifact path metadata
- document adapter compatibility for workflow-generated reports

**Do Not Touch:**
- sports request parsing
- root discovery logic in `app.js`

**Steps:**
1. Add failing tests for shared report ingestion of workflow output.
2. Add failing tests for `recommended_local_path` propagation.
3. Implement sports report builder in `apps/sports-workflows/lib/report.js`.
4. Extend `report-builder.js` only where necessary to support workflow metadata cleanly.
5. Update document adapter to preserve or derive artifact path metadata.
6. Run document artifact tests until green.

**Verification Commands:**
- `node --test test/auto-local-doc-artifacts.test.js`

---

### Lane C: Workflow Test Harness and Paid Canary

**Owner:** Worker C

**Files:**
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\test.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\canary.js`
- Create: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\paid-canary.cjs`
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\package.json`

**Scope:**
- local workflow canary corpus
- seeded reproducibility checks
- paid production canary script for the NBA workflow
- package scripts for repeatable verification

**Do Not Touch:**
- root app integration
- report/document internals unless blocked

**Steps:**
1. Add local canary cases using the NBA fixture snapshot.
2. Add seeded reproducibility expectations.
3. Add a paid canary script that exercises:
   - workflow only
   - workflow plus report
   - workflow plus XLSX export request path if exposed in the same lane later
4. Add package scripts for `test`, `test:canary`, and `test:paid-canary`.
5. Run local tests and canary until green.

**Verification Commands:**
- `node test.js`
- `node canary.js`

---

## Wave 2: Serial Integration

This wave is lead-only again.

### Task 2: Bundle the new sports workflow seller into the root app

**Files:**
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\app.js`

**Steps:**
1. Require the new sports workflow seller config and primary handler.
2. Extend the bundled seller route collection.
3. Route `seller: "sports-workflows"` to the sports workflow primary handler.
4. Add the new workflow endpoint to the curated public discovery allowlist.
5. Add route description, category, and tags that fit the curated catalog.

**Verification Commands:**
- `node --test test/generated-auto-local.test.js`
- `node test.js` in `apps/sports-workflows`

---

### Task 3: Tighten discovery and OpenAPI coverage for the workflow route

**Files:**
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\app.js`
- Modify: `C:\Users\KentEgan\claude projects\x402-data-bazaar\test\generated-auto-local.test.js`

**Steps:**
1. Add the workflow route to curated `/api` and curated `/openapi.json`.
2. Keep full discovery unchanged in `/api/system/discovery/full`.
3. Add explicit assertions for:
   - public discovery includes the workflow route
   - public discovery excludes unrelated routes
   - public OpenAPI includes the workflow route
4. Verify the curated count grows only by the new intended workflow route.

**Verification Commands:**
- `node --test test/generated-auto-local.test.js`

---

## Wave 3: Full Verification

This wave is lead-only.

### Task 4: Run the full local verification suite

**Commands:**
- `node --test test/generated-auto-local.test.js`
- `node --test test/auto-local-doc-artifacts.test.js`
- `node test.js` in `apps/generic-parameter-simulator`
- `node canary.js` in `apps/generic-parameter-simulator`
- `node test.js` in `apps/sports-workflows`
- `node canary.js` in `apps/sports-workflows`

**Expected Result:**
- all local suites green

---

### Task 5: Deploy and run paid production canaries

**Files:**
- Modify if needed: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\paid-canary.cjs`
- Modify if needed: `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\reports\paid-canary-latest.json`

**Steps:**
1. Deploy to prod.
2. Verify AgentCash discovery shows the workflow route on the curated public surface.
3. Run the paid sports workflow canary.
4. Save the paid canary output artifact.
5. Confirm the workflow can produce a report-compatible payload and at least one file artifact path.

**Verification Commands:**
- `cmd /c npx vercel deploy --prod -y`
- `node paid-canary.cjs`

---

## Future Parallel Follow-On Lanes

Once the NBA lane is live, use the same split for additional leagues:

- Lane A: `nfl` workflow adapter
- Lane B: `mlb` workflow adapter
- Lane C: `nhl` workflow adapter
- Lead: shared discovery and final integration

Do not run multiple league agents against the same shared files simultaneously. Keep league-specific logic inside:
- `apps\sports-workflows\workflows\nfl\...`
- `apps\sports-workflows\workflows\mlb\...`
- `apps\sports-workflows\workflows\nhl\...`

---

## Suggested Agent Prompts

### Worker A Prompt
Implement the NBA workflow core in `apps/sports-workflows` only. Own request parsing, normalization, defaults, and the workflow executor for `POST /api/workflows/sports/nba/playoff-forecast`. Do not edit root `app.js` or shared document files. Add and pass local package tests. Report changed files only.

### Worker B Prompt
Implement workflow result to shared report/artifact mapping. Own `apps/sports-workflows/lib/report.js`, `apps/sports-workflows/lib/artifact-path.js`, and shared report/document compatibility in `lib/report-builder.js`, `routes/auto-local/report-document-adapter.js`, `routes/auto-local/doc-artifacts.js`, and `test/auto-local-doc-artifacts.test.js`. Do not edit root `app.js`. Report changed files only.

### Worker C Prompt
Build the sports workflow verification layer only. Own `apps/sports-workflows/test.js`, `apps/sports-workflows/canary.js`, `apps/sports-workflows/paid-canary.cjs`, and `apps/sports-workflows/package.json`. Do not edit root `app.js` or shared document files unless absolutely required. Report changed files only.

---

## Success Criteria

The plan is complete when all of the following are true:
- `POST /api/workflows/sports/nba/playoff-forecast` exists and is paid
- it accepts task-shaped sports input instead of generic sim parameters
- it returns workflow metadata, prediction, ranking, assumptions, diagnostics, and a shared-report-compatible payload
- curated `/api` and `/openapi.json` include the new workflow route
- local and paid canaries pass
- the workflow can be used to answer “predict the NBA Finals winner and give me an XLSX” without manual parameter translation

---

## Execution Guidance

Recommended execution pattern:
1. Lead completes Wave 0.
2. Dispatch Workers A, B, and C in parallel.
3. Lead works only on integration prep while workers run.
4. Lead integrates Wave 2 after all worker branches are ready.
5. Lead runs Wave 3 verification and deploys.

Do not start the next league until the NBA workflow has completed Wave 3 cleanly.
