# AurelianFlo MCP

## Description

AurelianFlo MCP is a remote MCP server for lean AurelianFlo workflows:

- bundled OFAC wallet screening plus report output
- bundled Monte Carlo reporting plus report output
- Premium report artifact generation in PDF and DOCX
- lower-level Monte Carlo decision reporting

This package uses `x402-mcp` for paid MCP tools and, by default, boots the repo's internal Express app with the payment gate disabled so MCP users are charged once at the MCP tool layer instead of being forced through the public HTTP payment flow again.

## Features

- `server_capabilities` as a free connection and capability check
- `ofac_wallet_report` for one-call wallet screening with JSON, PDF, or DOCX output
- `ofac_wallet_screen` for exact-match OFAC wallet screening
- `monte_carlo_report` for one-call simulation reporting with JSON, PDF, or DOCX output
- `monte_carlo_decision_report` for structured simulation reports
- `report_pdf_generate` for premium report PDFs
- `report_docx_generate` for premium report DOCX artifacts
- Streamable HTTP MCP endpoint with a static server card at `/.well-known/mcp/server-card.json`
- AgentCash-compatible discovery lane for the canonical origin

## Setup

1. Install dependencies with `npm install`
2. Set `AURELIANFLO_MCP_RECIPIENT` or `WALLET_ADDRESS`
3. Optionally set `X402_FACILITATOR_URL`
4. Start the server with `npm start`
5. Deploy the server behind HTTPS before submitting to Anthropic or Smithery

Environment variables:

- `AURELIANFLO_MCP_RECIPIENT` or `WALLET_ADDRESS`
- optional `X402_FACILITATOR_URL`
- optional `AURELIANFLO_MCP_NETWORK` (`base` by default)
- optional `AURELIANFLO_MCP_UPSTREAM_BASE_URL` to point at a separate upstream instead of the in-repo app
- optional `PORT` for the HTTP listener

## Authentication

Two supported access modes are available:

- Direct origin: `https://x402.aurelianflo.com/mcp`
- Smithery-hosted gateway: `https://core--aurelianflo.run.tools`

The direct origin does not require end-user OAuth authentication. Payment authorization is handled per tool through x402.

The Smithery-hosted gateway uses Smithery's connection and authorization flow. OAuth-capable clients should follow the authorization URL returned by the hosted gateway when it responds with `auth_required`.

## Examples

### Example 0: Free server check

User prompt: `Call server_capabilities and show me how this server is meant to be used.`

What happens:

- Claude calls `server_capabilities`
- The server returns direct and Smithery-hosted connection modes
- The response identifies which tools are free and which require x402 payment

### Example 1: Bundled OFAC wallet screening report

User prompt: `Screen 0x098B716B8Aaf21512996dC57EB0615e2383E2f96 for OFAC sanctions and give me a PDF I can hand off.`

What happens:

- Claude calls `ofac_wallet_report`
- The server runs the live wallet screening route and then returns either structured JSON or a premium PDF or DOCX artifact from the same screening result
- The result includes exact hits, sanctioned entity metadata, source freshness, and the generated report output

### Example 2: Direct wallet screening JSON

User prompt: `Screen 0x098B716B8Aaf21512996dC57EB0615e2383E2f96 and return the JSON report only.`

What happens:

- Claude calls `ofac_wallet_screen`
- The server returns exact wallet screening data plus the structured report payload for downstream use

### Example 3: Bundled Monte Carlo report

User prompt: `Generate a compare-style decision report for a baseline and candidate launch scenario and return a PDF.`

What happens:

- Claude calls `monte_carlo_report`
- The server runs the live `POST /api/sim/report` workflow
- The response returns either structured JSON or a premium PDF or DOCX artifact from the same simulation result

### Example 4: Monte Carlo building blocks

User prompt: `Generate a compare-style decision report payload and then render it to DOCX.`

What happens:

- Claude calls `monte_carlo_decision_report`
- The server returns the structured report payload
- Claude can then call `report_docx_generate` or `report_pdf_generate` as a second step

## Privacy Policy

Draft privacy policy for publication is in [submission/privacy-policy.md](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/apps/aurelianflo-mcp/submission/privacy-policy.md).

## Support

Draft support details for publication are in [submission/support.md](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/apps/aurelianflo-mcp/submission/support.md).

## Registry Submission

Draft official MCP Registry metadata is in [submission/server.json](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/apps/aurelianflo-mcp/submission/server.json).

Official registry publish notes are in [submission/official-registry-publish.md](C:/Users/KentEgan/claude%20projects/x402-data-bazaar/apps/aurelianflo-mcp/submission/official-registry-publish.md).

## Public Production URLs

- Origin: `https://x402.aurelianflo.com`
- MCP endpoint: `https://x402.aurelianflo.com/mcp`
- Server card: `https://x402.aurelianflo.com/.well-known/mcp/server-card.json`
- Docs: `https://x402.aurelianflo.com/mcp/docs`
- Privacy: `https://x402.aurelianflo.com/mcp/privacy`
- Support: `https://x402.aurelianflo.com/mcp/support`

## Codex Setup

Recommended direct install:

```bash
codex mcp add aurelianflo --url https://x402.aurelianflo.com/mcp
```

Smithery listing:

```bash
smithery mcp add aurelianflo/core
```

Smithery-hosted gateway:

```bash
codex mcp add aurelianflo-core --url https://core--aurelianflo.run.tools
```

Windows note:

- Smithery's `--client codex` handoff can fail on Windows even when the MCP server is healthy.
- If that happens, add the hosted gateway or the direct origin with `codex mcp add ... --url ...` instead of relying on the Smithery installer handoff.
- If the client does not support Smithery's hosted OAuth flow, use the direct origin.

## AgentCash Lane

Keep the existing AgentCash stdio flow alongside this MCP server for auto-discovery and HTTP payment handling against the canonical origin:

```bash
npx agentcash install --client codex
npx agentcash discover https://x402.aurelianflo.com
```

Verified locally on April 5, 2026:

- `npx agentcash` starts the AgentCash MCP server
- `npx agentcash install --client <client>` installs the stdio MCP config
- `npx agentcash discover https://x402.aurelianflo.com` discovers the live AurelianFlo origin
