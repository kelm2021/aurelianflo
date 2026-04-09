# 402index Category Patch Runbook

Date: 2026-03-30  
Repo: `C:\Users\KentEgan\claude projects\x402-data-bazaar`

## Scope

Patch 402index categories for endpoints listed in:

- `tmp/reports/endpoints-added-today-2026-03-30.json`

## Required Inputs

- Domain: `x402.aurelianflo.com`
- 402index verification token for the domain
- Report file generated for the endpoint set being patched

Do not store the live verification token in committed docs. Load it from a local env var or paste it only into a transient local script run.

## Procedure

1. Confirm the report contents and current category distribution.
2. Fetch all indexed services for the domain using paginated 402index API reads.
3. Match services by exact endpoint URL, preferring method matches when duplicates exist.
4. Compute target categories:
   - Keep the reported category if it is not `uncategorized`.
   - Fallback `uncategorized` entries to `tools/utilities`.
5. PATCH each matched service with:
   - `domain`
   - `verification_token`
   - `category`
6. Persist a patch result JSON file with:
   - summary counts
   - per-endpoint status
   - HTTP status and error snippets for failures
7. Retry failed rows sequentially with backoff, especially when 402index responds with rate-limit or payment-style errors.
8. Run a final verification pass for the exact endpoint set and write a verification snapshot.

## Local Script Shape

The original run used small Node one-offs embedded in PowerShell. The flow was:

```text
1. read report JSON
2. GET /api/v1/services?q=<domain>&limit=<n>&offset=<n>
3. map services by url
4. PATCH /api/v1/services/<id>
5. write patch-result JSON
6. retry failed rows
7. write verify JSON
```

## Suggested Local Env

```powershell
$env:INDEX402_DOMAIN = "x402.aurelianflo.com"
$env:INDEX402_VERIFICATION_TOKEN = "<local token>"
$env:INDEX402_REPORT_PATH = "C:/Users/KentEgan/claude projects/x402-data-bazaar/tmp/reports/endpoints-added-today-2026-03-30.json"
```

## Output Files

- `tmp/reports/endpoints-added-today-2026-03-30.category-patch-result.json`
- `tmp/reports/endpoints-added-today-2026-03-30.category-verify.json`

## Notes

- Run sequential PATCH requests when the API starts rate-limiting.
- Keep the raw report file immutable and write new result snapshots alongside it.
- Prefer preserving this as a dedicated runbook doc instead of reusing a generic handoff file.
