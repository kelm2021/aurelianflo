# AurelianFlo MCP Registry Publication Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish AurelianFlo to the official MCP Registry as a public remote MCP server using domain-based authentication, then verify registry ingestion and downstream discoverability.

**Architecture:** AurelianFlo is already live as a remote MCP endpoint at `https://x402.aurelianflo.com/mcp` and already has a Smithery-hosted gateway at `https://core--aurelianflo.run.tools`. The official MCP Registry should publish the direct origin as the canonical remote server using a reverse-DNS namespace (`com.aurelianflo/core`) and domain-based auth. The cleanest operational path is HTTP authentication using `/.well-known/mcp-registry-auth`, because the app already serves other `/.well-known/*` assets and the repo already contains a draft `server.json`.

**Tech Stack:** Node.js, Express, PowerShell, `mcp-publisher`, OpenSSL, official MCP Registry, public HTTPS hosting on `x402.aurelianflo.com`

**Out of Scope:** Smithery setup, AurelianFlo MCP tool implementation, OpenAPI re-ranking work beyond what already landed, third-party directory submission beyond the official MCP Registry.

---

## Known Inputs

- Remote MCP endpoint: `https://x402.aurelianflo.com/mcp`
- Server card: `https://x402.aurelianflo.com/.well-known/mcp/server-card.json`
- Docs: `https://x402.aurelianflo.com/mcp/docs`
- Privacy: `https://x402.aurelianflo.com/mcp/privacy`
- Support: `https://x402.aurelianflo.com/mcp/support`
- Draft registry metadata: [apps/aurelianflo-mcp/submission/server.json](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/apps/aurelianflo-mcp/submission/server.json)
- Draft registry notes: [apps/aurelianflo-mcp/submission/official-registry-publish.md](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/apps/aurelianflo-mcp/submission/official-registry-publish.md)
- Package metadata: [apps/aurelianflo-mcp/package.json](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/apps/aurelianflo-mcp/package.json)
- Smithery is already live: `https://core--aurelianflo.run.tools`

## Recommended Auth Choice

Use **HTTP authentication** for the official MCP Registry.

Why:
- The official registry allows domain-based auth, which enables the namespace `com.aurelianflo/*`.
- The current app already serves `/.well-known/x402*` and `/.well-known/mcp/server-card.json`, so adding one more well-known file is operationally simple.
- HTTP auth avoids waiting on DNS propagation during iteration.

Fallback:
- If serving `/.well-known/mcp-registry-auth` is operationally awkward, use DNS TXT auth instead.

## Target Registry Identity

- Registry `name`: `com.aurelianflo/core`
- `title`: `AurelianFlo MCP`
- `version`: `0.1.0` for first publish
- `description`: `Remote MCP server for OFAC wallet screening, vendor due diligence, Monte Carlo forecasting, and premium PDF, DOCX, and XLSX report generation.`
- Remote transport: `streamable-http`
- Remote URL: `https://x402.aurelianflo.com/mcp`

---

### Task 1: Validate the current remote MCP production surface

**Files:**
- Review: [apps/aurelianflo-mcp/submission/server.json](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/apps/aurelianflo-mcp/submission/server.json)
- Review: [apps/aurelianflo-mcp/README.md](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/apps/aurelianflo-mcp/README.md)

**Step 1: Verify the public endpoint URLs**
Run:
```powershell
Invoke-WebRequest https://x402.aurelianflo.com/mcp -Method GET -MaximumRedirection 0
Invoke-WebRequest https://x402.aurelianflo.com/.well-known/mcp/server-card.json
Invoke-WebRequest https://x402.aurelianflo.com/mcp/docs
Invoke-WebRequest https://x402.aurelianflo.com/mcp/privacy
Invoke-WebRequest https://x402.aurelianflo.com/mcp/support
```
Expected:
- All URLs return publicly reachable responses.
- `/.well-known/mcp/server-card.json` returns JSON.
- Docs, privacy, and support pages return `200`.

**Step 2: Confirm the remote endpoint is suitable for registry publication**
Check:
- Remote URL is public, not private-network-only.
- Transport is `streamable-http`.
- No auth wall blocks access to the remote endpoint itself.

Expected:
- The endpoint satisfies the registry’s remote-server requirement that the remote server be publicly accessible.

**Step 3: Confirm the registry metadata draft still matches production**
Review [apps/aurelianflo-mcp/submission/server.json](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/apps/aurelianflo-mcp/submission/server.json).

Expected:
- `name` is `com.aurelianflo/core`
- `version` is `0.1.0`
- `remotes[0].type` is `streamable-http`
- `remotes[0].url` is `https://x402.aurelianflo.com/mcp`

---

### Task 2: Implement HTTP authentication proof hosting

**Files:**
- Modify: [app.js](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/app.js)
- Create: `outputs/mcp-registry-auth` during key generation only, do not commit secrets
- Optional Create: [apps/aurelianflo-mcp/submission/mcp-registry-auth.example](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/apps/aurelianflo-mcp/submission/mcp-registry-auth.example)
- Test: [test/mcp-route.test.js](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/test/mcp-route.test.js)

**Step 1: Generate the Ed25519 keypair locally**
Run:
```powershell
New-Item -ItemType Directory -Force outputs | Out-Null
openssl genpkey -algorithm Ed25519 -out outputs\mcp-registry-auth-key.pem
$publicKey = (openssl pkey -in outputs\mcp-registry-auth-key.pem -pubout -outform DER | Select-Object -SkipLast 0)
```

Then create the auth file using the official format:
```powershell
$env:PUBLIC_KEY = (openssl pkey -in outputs\mcp-registry-auth-key.pem -pubout -outform DER | %{ $_ }) -join ""
```

Operational note:
- In practice, use the exact official shell recipe from the registry docs to derive the base64 public key:
```bash
PUBLIC_KEY="$(openssl pkey -in key.pem -pubout -outform DER | tail -c 32 | base64)"
echo "v=MCPv1; k=ed25519; p=${PUBLIC_KEY}" > mcp-registry-auth
```

Expected:
- You have a private key file that is kept local and uncommitted.
- You have a one-line `mcp-registry-auth` file whose contents begin with `v=MCPv1; k=ed25519; p=`.

**Step 2: Decide how the server will expose the auth file**
Choose one:
- Preferred: serve the file content from an environment variable such as `MCP_REGISTRY_AUTH_PROOF`
- Acceptable: read a non-secret text file at startup from a configured path

Recommendation:
- Use env-driven content so no auth proof file has to be committed.

**Step 3: Add the well-known route**
Add:
- `GET /.well-known/mcp-registry-auth`

Behavior:
- If `MCP_REGISTRY_AUTH_PROOF` is set, respond with `text/plain` and the exact proof content.
- If it is unset, return `404`.
- Do not require payment or auth.
- Add cache headers appropriate for a static proof file.

**Step 4: Add a focused test**
Test cases:
- Returns `200` and exact proof body when env var is set
- Returns `404` when env var is missing
- Does not emit any x402 payment headers

**Step 5: Verify locally**
Run:
```powershell
node --test test/mcp-route.test.js
```
Expected:
- New test passes
- Existing MCP route tests still pass

---

### Task 3: Finalize the registry submission packet

**Files:**
- Review/modify if needed: [apps/aurelianflo-mcp/submission/server.json](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/apps/aurelianflo-mcp/submission/server.json)
- Review: [apps/aurelianflo-mcp/package.json](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/apps/aurelianflo-mcp/package.json)
- Review: [apps/aurelianflo-mcp/README.md](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/apps/aurelianflo-mcp/README.md)
- Review: [apps/aurelianflo-mcp/submission/official-registry-publish.md](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/apps/aurelianflo-mcp/submission/official-registry-publish.md)

**Step 1: Confirm the exact `server.json` contents**
Expected final file:
```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "com.aurelianflo/core",
  "title": "AurelianFlo MCP",
  "description": "Remote MCP server for OFAC wallet screening, vendor due diligence, Monte Carlo forecasting, and premium PDF, DOCX, and XLSX report generation.",
  "version": "0.1.0",
  "remotes": [
    {
      "type": "streamable-http",
      "url": "https://x402.aurelianflo.com/mcp"
    }
  ]
}
```

**Step 2: Decide whether to add repository metadata**
Optional but recommended:
- Add `repository` block to `server.json` if you want stronger provenance.

Suggested block:
```json
"repository": {
  "url": "https://github.com/kelm2021/x402-data-bazaar",
  "source": "github"
}
```

**Step 3: Confirm version policy before publish**
Rules:
- First publish uses `0.1.0`
- Every metadata update requires a unique version string
- Never republish the same version

Expected:
- Team agrees the next metadata change after initial publish will use `0.1.1`

---

### Task 4: Install and verify `mcp-publisher`

**Files:**
- No repo file changes required

**Step 1: Install the CLI**
Follow the official registry install instructions for your platform.

**Step 2: Verify installation**
Run:
```powershell
mcp-publisher --help
```
Expected:
- Command succeeds
- Output includes `init`, `login`, `logout`, and `publish`

**Step 3: Work from the submission directory**
Use:
```powershell
Set-Location "C:\Users\KentEgan\claude projects\x402-data-bazaar\apps\aurelianflo-mcp\submission"
```

Expected:
- `server.json` is in the current working directory when running publish commands

---

### Task 5: Perform official registry authentication

**Files:**
- No committed repo changes
- Local secret material only: `outputs/mcp-registry-auth-key.pem`

**Step 1: Set the target domain**
Run:
```powershell
$env:MY_DOMAIN = "aurelianflo.com"
```

Operational note:
- If the auth proof is hosted on `x402.aurelianflo.com` and the registry accepts that domain scope for the reverse-DNS namespace you want, use that exact domain consistently.
- Preferred naming target remains `com.aurelianflo/core`, which implies the parent domain identity is `aurelianflo.com`.

**Step 2: Derive the private key string in the official format**
Use the official recipe:
```bash
PRIVATE_KEY="$(openssl pkey -in key.pem -noout -text | grep -A3 "priv:" | tail -n +2 | tr -d ' :\n')"
```

**Step 3: Log in with HTTP auth**
Run:
```bash
mcp-publisher login http --domain "${MY_DOMAIN}" --private-key "${PRIVATE_KEY}"
```

Expected:
- Login succeeds
- Registry accepts domain ownership proof

**Step 4: Fallback to DNS auth if HTTP auth fails**
Use the official DNS flow:
```bash
PUBLIC_KEY="$(openssl pkey -in key.pem -pubout -outform DER | tail -c 32 | base64)"
echo "${MY_DOMAIN}. IN TXT \"v=MCPv1; k=ed25519; p=${PUBLIC_KEY}\""
mcp-publisher login dns --domain "${MY_DOMAIN}" --private-key "${PRIVATE_KEY}"
```

Expected:
- If HTTP auth is blocked by hosting constraints, DNS auth still allows publication under `com.aurelianflo/*`

---

### Task 6: Publish to the official MCP Registry

**Files:**
- Publish from: [apps/aurelianflo-mcp/submission/server.json](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/apps/aurelianflo-mcp/submission/server.json)

**Step 1: Run the publish command**
From the submission directory, run:
```powershell
mcp-publisher publish
```

Expected:
- Publish succeeds
- Output names `com.aurelianflo/core`
- Published version is `0.1.0`

**Step 2: Record the success output**
Capture:
- publish timestamp
- published name
- published version
- any returned canonical registry URL or identifier

**Step 3: Commit the final submission artifacts if any local docs changed**
Commit only:
- registry plan docs
- `server.json`
- any auth-route code/tests if implemented

---

### Task 7: Verify the official registry listing

**Files:**
- Optional doc update: [apps/aurelianflo-mcp/submission/official-registry-publish.md](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/apps/aurelianflo-mcp/submission/official-registry-publish.md)

**Step 1: Verify via registry search API**
Run:
```powershell
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=com.aurelianflo/core"
```

Expected:
- JSON includes `com.aurelianflo/core`

**Step 2: Verify in the registry UI**
Check:
- [https://registry.modelcontextprotocol.io/](https://registry.modelcontextprotocol.io/)

Search for:
- `com.aurelianflo/core`
- `AurelianFlo`

Expected:
- Public listing is visible

**Step 3: Verify metadata correctness**
Check that the listing shows:
- title
- description
- version `0.1.0`
- remote URL `https://x402.aurelianflo.com/mcp`

---

### Task 8: Verify downstream ingestion and update operational notes

**Files:**
- Modify: [apps/aurelianflo-mcp/submission/official-registry-publish.md](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/apps/aurelianflo-mcp/submission/official-registry-publish.md)
- Optional modify: [apps/aurelianflo-mcp/README.md](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/apps/aurelianflo-mcp/README.md)

**Step 1: Wait for aggregator pickup**
The registry is the official centralized metadata repository and downstream aggregators are expected to consume it. Allow time for ingestion.

**Step 2: Re-check key surfaces**
Check:
- Official MCP Registry
- Glama
- PulseMCP
- other MCP aggregators you care about

Expected:
- AurelianFlo appears with the direct MCP origin as canonical source

**Step 3: Update internal publication notes**
Record:
- auth method used
- domain used for auth
- version published
- date/time of publish
- downstream pickup status

---

## Manual Action Checklist

- Control the domain used for registry auth
- Generate and securely store the Ed25519 private key
- Host `/.well-known/mcp-registry-auth` if using HTTP auth
- Install `mcp-publisher`
- Run `mcp-publisher login ...`
- Run `mcp-publisher publish`
- Verify listing in registry UI and API
- Re-check downstream aggregators after propagation

## Risks

- Wrong namespace/auth pairing
  - Symptom: publish denied
  - Fix: use domain auth for `com.aurelianflo/*`

- Remote endpoint not publicly accessible
  - Symptom: registry validation or downstream install failures
  - Fix: confirm public reachability of `https://x402.aurelianflo.com/mcp`

- Reusing a version string
  - Symptom: publish rejected or metadata immutability conflict
  - Fix: bump to a new unique version

- Auth proof mismatch
  - Symptom: `login http` or `login dns` fails
  - Fix: regenerate proof from the same keypair and re-host/re-publish proof material

## Success Criteria

- `com.aurelianflo/core` is published in the official MCP Registry
- The listing resolves to `https://x402.aurelianflo.com/mcp`
- The listing is publicly searchable in the registry UI/API
- The publish method and versioning discipline are documented for the next update

## Source Notes

This plan is based on the official MCP Registry docs as reviewed on April 6, 2026:

- [Quickstart](https://modelcontextprotocol.io/registry/quickstart)
- [Remote Servers](https://modelcontextprotocol.io/registry/remote-servers)
- [Authentication](https://modelcontextprotocol.io/registry/authentication)
- [Versioning](https://modelcontextprotocol.io/registry/versioning)
- [About](https://modelcontextprotocol.io/registry/about)

## Execution Options

1. **Subagent-Driven (this session)**: implement the HTTP auth route, verify locally, and prepare the exact publish commands.
2. **Parallel Session (separate)**: use superpowers:executing-plans against this file and carry the publish flow end-to-end.
