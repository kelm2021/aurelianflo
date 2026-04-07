# AurelianFlo Repo Cleanup Audit

Date: 2026-04-07
Repo: `C:\Users\KentEgan\claude projects\x402-data-bazaar`

## Verdict

The codebase is now partially cleaned, but the identity layer is still split across:

- live product identity: `AurelianFlo` / `https://x402.aurelianflo.com`
- GitHub repo identity: `aurelianflo`
- Vercel project identity: `x402-data-bazaar`
- legacy standalone seller identity: `restricted-party-screen.vercel.app`, `vendor-entity-brief.vercel.app`

## Safe Cleanup Completed

- Renamed the GitHub repo from `kelm2021/x402-data-bazaar` to `kelm2021/aurelianflo`.
- Updated the GitHub repo homepage to `https://x402.aurelianflo.com`.
- Updated the GitHub repo description to the current AurelianFlo compliance-first positioning.
- Renamed root package metadata from `x402-data-bazaar` to `aurelianflo` in:
  - `package.json`
  - `package-lock.json`
- Updated active repo metadata references from `kelm2021/x402-data-bazaar` to `kelm2021/aurelianflo` in:
  - `apps/aurelianflo-mcp/package.json`
  - `apps/aurelianflo-mcp/submission/server.json`
  - `apps/aurelianflo-mcp/submission/support.md`
  - `apps/aurelianflo-mcp/submission/official-registry-publish.md`
- Repointed the local git remote to `https://github.com/kelm2021/aurelianflo.git`.
- Normalized active seller config base URLs to `https://x402.aurelianflo.com` in:
  - `apps/restricted-party-screen/seller.config.json`
  - `apps/vendor-entity-brief/seller.config.json`
- Normalized local env examples to `https://x402.aurelianflo.com` in:
  - `apps/restricted-party-screen/.env.example`
  - `apps/vendor-entity-brief/.env.example`
- Replaced stale standalone-origin marketing copy in:
  - `apps/restricted-party-screen/app.js`
  - `apps/vendor-entity-brief/app.js`
- Replaced stale outbound user-agent strings with AurelianFlo-branded identifiers in:
  - `routes/food.js`
  - `routes/weather.js`
  - `routes/location.js`
  - `apps/restricted-party-screen/lib/ofac.js`
  - `apps/vendor-entity-brief/lib/ofac.js`
  - `apps/vendor-entity-brief/lib/vendor-entity-brief.js`
- Updated seller tests to assert the AurelianFlo canonical origin.

## Verification

Fresh verification passed after cleanup:

- `apps/restricted-party-screen/test/seller.test.js`
- `apps/vendor-entity-brief/test/seller.test.js`
- `test/payment.test.js`

Result: `53/53` passing in the targeted seller and payment suites.

## Branch Audit

Current local branch set:

- `main`
- `codex/cleanup-checkpoint-20260325`
- `codex/generated-tooling-split`
- `codex/integrated-clean-tree`
- `codex/publisher-stack-split`
- `codex/seller-facilitator-split`
- `codex/facilitator-and-api-expansion`

Operator read:

- `codex/facilitator-and-api-expansion` is the active working branch.
- `main` is stale relative to the current AurelianFlo product state.
- `codex/generated-tooling-split`, `codex/integrated-clean-tree`, `codex/publisher-stack-split`, and `codex/seller-facilitator-split` look like transitional architecture branches from 2026-04-02 to 2026-04-03.
- `codex/cleanup-checkpoint-20260325` is a checkpoint branch and should not remain part of the long-term working set.

## Vercel Audit

Current linked Vercel project:

- `.vercel/project.json`
- `projectName`: `x402-data-bazaar`
- production URL: `https://aurelianflo.com`

Relevant Vercel projects still present:

- `x402-data-bazaar`
- `x402-data-bazaar-prod-deploy`
- `x402-data-bazaar-integrated`
- `restricted-party-screen`
- `vendor-entity-brief`

Operator read:

- The live product runs from the old Vercel project name.
- There are still multiple old deployment projects that preserve the legacy split architecture.
- The current CLI session can inspect the project, but the available CLI surface does not expose a rename command.
- This is now an infrastructure cleanup task, not a source-only cleanup task.

## Remaining High-Risk Cleanup

These items should be handled in a separate deliberate migration pass:

1. Rename the GitHub repo from `x402-data-bazaar` to an AurelianFlo-aligned name.
2. Rename the Vercel project from `x402-data-bazaar` to an AurelianFlo-aligned name.
3. Decide which old Vercel projects should be deleted or archived:
   - `x402-data-bazaar-prod-deploy`
   - `x402-data-bazaar-integrated`
   - `restricted-party-screen`
   - `vendor-entity-brief`
4. Rewrite or archive legacy operator inventories that still encode stale domains and route families:
   - `portfolio/live-sellers.json`
   - `apps/restricted-party-screen.seed.json`
5. Review historical docs under `docs/` and explicitly separate:
   - active operator docs
   - archival incident notes
   - obsolete discovery/escalation records

## Next Step

Create one deliberate migration branch for the identity rename itself: repo name, Vercel project name, and retirement/archive rules for the old standalone projects.
