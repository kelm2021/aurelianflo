# Workflow Adapter Prompt Blocks

Use these directly with Codex or Claude Code. This set assumes:
- this session is the lead integrator lane
- one worker handles sports workflow core
- one worker handles report/artifact integration
- one worker handles tests/canaries

## Lead Prompt

You are the lead integrator for the workflow-adapter build in `C:\Users\KentEgan\claude projects\x402-data-bazaar`.

Read these first:
- `docs/plans/2026-04-03-workflow-adapter-spec.md`
- `docs/plans/2026-04-03-workflow-adapter-implementation-plan.md`
- `docs/plans/2026-04-03-workflow-adapter-agent-briefs.md`

Your role:
- own `app.js`
- own `test/generated-auto-local.test.js`
- complete Wave 0 scaffold for `apps/sports-workflows`
- merge worker changes
- wire curated discovery and OpenAPI
- run full verification
- deploy and run paid production canaries

Constraints:
- do not delegate `app.js`
- do not do worker-lane work unless integration is blocked
- do not revert other agents' changes

Success criteria:
- `POST /api/workflows/sports/nba/playoff-forecast` is integrated into the root app
- curated `/api` and `/openapi.json` include the workflow route
- full local verification passes
- paid prod canary passes

At the end, report:
- files changed
- tests run
- deployment status
- any remaining risks

## Worker A Prompt

You own the NBA workflow core only in `C:\Users\KentEgan\claude projects\x402-data-bazaar`.

Read these first:
- `docs/plans/2026-04-03-workflow-adapter-spec.md`
- `docs/plans/2026-04-03-workflow-adapter-implementation-plan.md`
- `docs/plans/2026-04-03-workflow-adapter-agent-briefs.md`

Edit only these files unless blocked:
- `apps/sports-workflows/handlers/primary.js`
- `apps/sports-workflows/lib/workflow-params.js`
- `apps/sports-workflows/workflows/nba/playoff-forecast.js`
- `apps/sports-workflows/workflows/nba/normalize.js`
- `apps/sports-workflows/workflows/nba/defaults.js`
- `apps/sports-workflows/fixtures/nba-standings-2026-04-03.json`
- `apps/sports-workflows/test.js`

Do not edit:
- `app.js`
- `routes/auto-local/*`
- shared report/document files outside `apps/sports-workflows`

Build:
- `POST /api/workflows/sports/nba/playoff-forecast`
- support `standings_snapshot` and `custom_field`
- validate inputs
- normalize NBA team data into generic sim inputs
- return:
  - `workflow_meta`
  - `inputs_echo`
  - `prediction`
  - `ranking`
  - `assumptions`
  - `diagnostics`

Run:
- `node test.js`

At the end, report:
- files changed
- tests run
- blockers

## Worker B Prompt

You own report and artifact integration for workflow results in `C:\Users\KentEgan\claude projects\x402-data-bazaar`.

Read these first:
- `docs/plans/2026-04-03-workflow-adapter-spec.md`
- `docs/plans/2026-04-03-workflow-adapter-implementation-plan.md`
- `docs/plans/2026-04-03-workflow-adapter-agent-briefs.md`

Edit only these files unless blocked:
- `apps/sports-workflows/lib/report.js`
- `apps/sports-workflows/lib/artifact-path.js`
- `lib/report-builder.js`
- `routes/auto-local/report-document-adapter.js`
- `routes/auto-local/doc-artifacts.js`
- `test/auto-local-doc-artifacts.test.js`

Do not edit:
- `app.js`
- sports normalization/request parsing files

Build:
- workflow result to shared report mapping
- workbook-ready sports tables
- `recommended_local_path`
- compatibility with XLSX/PDF/DOCX generation for workflow-generated reports

Run:
- `node --test test/auto-local-doc-artifacts.test.js`

At the end, report:
- files changed
- tests run
- contract assumptions the lead should know

## Worker C Prompt

You own the sports workflow verification lane in `C:\Users\KentEgan\claude projects\x402-data-bazaar`.

Read these first:
- `docs/plans/2026-04-03-workflow-adapter-spec.md`
- `docs/plans/2026-04-03-workflow-adapter-implementation-plan.md`
- `docs/plans/2026-04-03-workflow-adapter-agent-briefs.md`

Edit only these files unless blocked:
- `apps/sports-workflows/test.js`
- `apps/sports-workflows/canary.js`
- `apps/sports-workflows/paid-canary.cjs`
- `apps/sports-workflows/package.json`

Do not edit:
- `app.js`
- shared document/report files
- sports core logic unless blocked

Build:
- local test harness for the NBA workflow
- seeded reproducibility checks
- canary corpus using the April 3, 2026 NBA fixture
- paid production canary script
- package scripts for repeatable verification

Run:
- `node test.js`
- `node canary.js`

At the end, report:
- files changed
- tests run
- what still must be done in prod

## Suggested Assignment

- Codex in this session: Lead Prompt
- Claude Code worker 1: Worker A Prompt
- Claude Code worker 2: Worker B Prompt
- Claude Code worker 3: Worker C Prompt

## Merge Order

1. Merge Worker A
2. Merge Worker B
3. Merge Worker C
4. Lead performs root-app integration
5. Lead runs full verification and deploys
