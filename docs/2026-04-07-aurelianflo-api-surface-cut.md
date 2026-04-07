# AurelianFlo API Surface Cut

Date: 2026-04-07

## Verdict

Production `full` discovery was reduced from a 426-route mixed catalog to a 31-route AurelianFlo allowlist. Non-whitelisted `/api/*` endpoints now return `404` in production instead of remaining live but undiscoverable.

## Why

The prior surface diluted AurelianFlo's product identity. Compliance, EDD, simulation, vendor diligence, and premium document generation were mixed with unrelated endpoints such as weather, stocks, VIN, sports, generic utilities, and long-tail generated tools. That made the product look like a route dump instead of a focused x402 offering.

## What Was Kept

The production allowlist now preserves only these lanes:

- Compliance
  - `GET /api/ofac-wallet-screen/:address`
  - `POST /api/workflows/compliance/wallet-sanctions-report`
  - `POST /api/workflows/compliance/batch-wallet-screen`
  - `POST /api/workflows/compliance/edd-report`
- Vendor due diligence
  - `GET /api/vendor-entity-brief`
  - `POST /api/workflows/vendor/risk-assessment`
  - `POST /api/workflows/vendor/risk-forecast`
  - `POST /api/workflows/vendor/due-diligence-report`
- Simulation
  - all `POST /api/sim/*` routes
- Finance workflows
  - `POST /api/workflows/finance/cash-runway-forecast`
  - `POST /api/workflows/finance/startup-runway-forecast`
  - `POST /api/workflows/finance/pricing-plan-compare`
  - `POST /api/workflows/finance/pricing-scenario-forecast`
  - `POST /api/workflows/finance/pricing-sensitivity-report`
- Premium document output
  - `POST /api/tools/report/generate`
  - `POST /api/tools/report/pdf/generate`
  - `POST /api/tools/report/docx/generate`
  - `POST /api/tools/report/xlsx/generate`
  - `POST /api/tools/pdf/render-html`
  - `POST /api/tools/docx/render-template`
  - `POST /api/tools/xlsx/render-template`
  - `POST /api/tools/pdf/generate`
  - `POST /api/tools/docx/generate`
  - `POST /api/tools/xlsx/generate`

## What Changed Technically

- Added a single production allowlist in [app.js](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/app.js).
- Changed `/api/system/discovery/full` and `openapi-full.json` to use the allowlist in production.
- Added a production-only middleware that returns `404` for non-whitelisted `/api/*` paths.
- Filtered `.well-known/x402-aurelian.json` resources through the same allowed route set.
- Updated tests in [payment.test.js](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/test/payment.test.js) and [generated-auto-local.test.js](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/test/generated-auto-local.test.js).

## Live Verification

After deployment on 2026-04-07:

- `https://x402.aurelianflo.com/api/system/discovery/full?format=json` reports `31` endpoints
- `GET /api/weather/current/*` is absent
- `GET /api/stocks/quote/*` is absent
- `POST /api/tools/password/generate` is absent
- `POST /api/workflows/compliance/edd-report` is present
- `POST /api/workflows/finance/pricing-scenario-forecast` is present
- `POST /api/workflows/vendor/risk-forecast` is present
- `https://x402.aurelianflo.com/api/weather/current/40.7128/-74.0060` returns `404`
- `POST https://x402.aurelianflo.com/api/workflows/compliance/edd-report` still returns `402`
- `https://x402.aurelianflo.com/.well-known/x402-aurelian.json` no longer includes weather or stocks resources

## Note

The hard takedown is production-only. Local development still retains the broader route surface unless production mode is enabled.
