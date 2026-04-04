# Workflow Adapter Agent Briefs

Use these as copy-paste prompts for parallel execution of the workflow-adapter build.

## Operating Rules

- You are not alone in the codebase.
- Do not revert or overwrite changes made by other agents.
- Stay inside your assigned files unless you are blocked.
- If you must touch an out-of-scope file, stop and report the blocker instead of freelancing.
- Prefer minimal, targeted changes.
- Run only the verification commands assigned to your lane before handing off.
- In your final handoff, list:
  - files changed
  - tests run
  - open risks or blockers

## Lead Integrator Brief

You own the integration lane for the workflow-adapter project.

Scope:
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\app.js`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\test\generated-auto-local.test.js`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\docs\plans\2026-04-03-workflow-adapter-spec.md`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\docs\plans\2026-04-03-workflow-adapter-implementation-plan.md`

Responsibilities:
- complete Wave 0 scaffold for `apps/sports-workflows`
- keep the root app stable
- merge the worker lanes
- wire curated discovery and OpenAPI
- run the full verification suite
- deploy and run paid production canaries

Constraints:
- no broad refactors
- do not push work from `app.js` into worker lanes
- own final production verification

Deliverable:
- integrated NBA workflow route live in the root app
- curated discovery includes the workflow endpoint
- full local and paid verification evidence

## Worker A Brief: Sports Workflow Core

You own the NBA workflow core only.

Files you may edit:
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\handlers\primary.js`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\lib\workflow-params.js`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\workflows\nba\playoff-forecast.js`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\workflows\nba\normalize.js`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\workflows\nba\defaults.js`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\fixtures\nba-standings-2026-04-03.json`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\test.js`

Do not edit:
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\app.js`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\routes\auto-local\*`
- shared report/document files outside your package

Your job:
- implement `POST /api/workflows/sports/nba/playoff-forecast`
- support `standings_snapshot` and `custom_field`
- validate inputs
- normalize NBA team data into generic sim inputs
- apply NBA defaults for weights, uncertainty, assumptions, and diagnostics
- return workflow-shaped output with:
  - `workflow_meta`
  - `inputs_echo`
  - `prediction`
  - `ranking`
  - `assumptions`
  - `diagnostics`

Verification:
- `node test.js`

Handoff format:
- files changed
- tests run
- exact remaining blockers, if any

## Worker B Brief: Report and Artifact Mapping

You own shared report and artifact integration for workflow results.

Files you may edit:
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\lib\report.js`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\lib\artifact-path.js`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\lib\report-builder.js`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\routes\auto-local\report-document-adapter.js`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\routes\auto-local\doc-artifacts.js`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\test\auto-local-doc-artifacts.test.js`

Do not edit:
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\app.js`
- sports request parsing or normalization files

Your job:
- map NBA workflow output into the shared report contract
- produce workbook-ready sports tables
- preserve or add `recommended_local_path`
- keep XLSX/PDF/DOCX generation compatible with workflow-generated reports
- extend shared report/document logic only as much as needed

Verification:
- `node --test test/auto-local-doc-artifacts.test.js`

Handoff format:
- files changed
- tests run
- any shared-contract assumptions the lead should know

## Worker C Brief: Tests and Canaries

You own the verification layer for the sports workflow package.

Files you may edit:
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\test.js`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\canary.js`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\paid-canary.cjs`
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\sports-workflows\package.json`

Do not edit:
- `C:\Users\KentEgan\claude projects\x402-data-bazaar\app.js`
- shared document/report files
- sports core logic unless absolutely blocked

Your job:
- build a local test harness for the NBA workflow
- add seeded reproducibility checks
- add a canary corpus using the April 3, 2026 NBA snapshot
- add a paid canary script for the production workflow endpoint
- add package scripts for repeatable testing

Verification:
- `node test.js`
- `node canary.js`

Handoff format:
- files changed
- tests run
- what the lead still needs to do live in prod

## Suggested Dispatch Order

1. Lead completes the initial sports-workflows scaffold.
2. Worker A starts once the skeleton files exist.
3. Worker B starts once the shared report target shape is confirmed.
4. Worker C starts once the package skeleton and fixture location exist.
5. Lead integrates only after all three workers finish.

## Merge Guidance

- Merge Worker A first.
- Merge Worker B second.
- Merge Worker C third.
- Touch `app.js` only after the worker lanes are merged.
- Run full verification only after all three lanes are in.
