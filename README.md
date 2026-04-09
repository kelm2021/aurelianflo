# AurelianFlo

AurelianFlo is a compliance-focused x402 and MCP service for agent workflows.

Public production surfaces:

- UI: `https://aurelianflo.com`
- API: `https://api.aurelianflo.com`
- MCP: `https://api.aurelianflo.com/mcp`
- Server card: `https://api.aurelianflo.com/.well-known/mcp/server-card.json`

Core capabilities:

- OFAC wallet screening
- Batch wallet screening
- Enhanced due diligence memo generation
- Monte Carlo decision reporting
- PDF and DOCX report generation

## Repo Structure

- `app/`: backend and machine-readable API surface
- `apps/aurelianflo-mcp/`: MCP package, metadata, and submission assets
- `web/`: public frontend project
- `docs/`: product, launch, and implementation documentation

## Local Development

Install dependencies:

```bash
npm install
npm --prefix web install
```

Run the backend:

```bash
npm run dev
```

Run the frontend:

```bash
npm run web:dev
```

Build both:

```bash
npm run build
npm run web:build
```

## Verification

Backend and MCP tests:

```bash
node --test test/payment.test.js test/mcp-route.test.js
node --test apps/aurelianflo-mcp/test/server-card.test.mjs apps/aurelianflo-mcp/test/server-capabilities.test.mjs apps/aurelianflo-mcp/test/upstream.test.mjs
```

## Deployment Topology

- `main` is the canonical production branch
- `aurelianflo.com` serves the UI
- `api.aurelianflo.com` serves API, discovery, and MCP
- `www.aurelianflo.com` and `x402.aurelianflo.com` redirect to the apex UI
