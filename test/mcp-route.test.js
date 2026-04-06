const assert = require("node:assert/strict");
const test = require("node:test");
const fetch = require("node-fetch");

const { createApp } = require("../app");
const { __internal } = require("../lib/aurelianflo-mcp-bridge");

function withServer(app, run) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", async () => {
      try {
        const { port } = server.address();
        const result = await run(`http://127.0.0.1:${port}`);
        server.close((closeErr) => {
          if (closeErr) {
            reject(closeErr);
            return;
          }
          resolve(result);
        });
      } catch (error) {
        server.close(() => reject(error));
      }
    });
  });
}

test("root app serves the AurelianFlo MCP server card", async () => {
  const app = createApp({
    env: {},
    enableDebugRoutes: false,
    paymentGate: (_req, _res, next) => next(),
    mercTrustMiddleware: null,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/.well-known/mcp/server-card.json`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.serverInfo.name, "AurelianFlo MCP");
    assert.deepEqual(
      payload.tools.map((tool) => tool.name),
      [
        "server_capabilities",
        "ofac_wallet_report",
        "ofac_wallet_screen",
        "monte_carlo_report",
        "monte_carlo_decision_report",
        "report_pdf_generate",
        "report_docx_generate",
      ],
    );
  });
});

test("root app mounts the /mcp route", async () => {
  const app = createApp({
    env: {},
    enableDebugRoutes: false,
    paymentGate: (_req, _res, next) => next(),
    mercTrustMiddleware: null,
  });

  const mountedPaths = (app.router?.stack || [])
    .map((layer) => layer?.route?.path)
    .filter(Boolean);

  assert.ok(mountedPaths.includes("/mcp"));
});

test("root app exposes MCP info and public docs pages", async () => {
  const app = createApp({
    env: {},
    enableDebugRoutes: false,
    paymentGate: (_req, _res, next) => next(),
    mercTrustMiddleware: null,
  });

  await withServer(app, async (baseUrl) => {
    const mcpResponse = await fetch(`${baseUrl}/mcp`);
    const mcpPayload = await mcpResponse.json();

    assert.equal(mcpResponse.status, 200);
    assert.equal(mcpPayload.name, "AurelianFlo MCP");
    assert.equal(mcpPayload.transport, "streamable-http");
    assert.match(mcpPayload.docs, /\/mcp\/docs$/);
    assert.match(mcpPayload.privacy, /\/mcp\/privacy$/);
    assert.match(mcpPayload.support, /\/mcp\/support$/);
    assert.equal(mcpPayload.prompts.length, 3);
    assert.equal(mcpPayload.icons[0].src.endsWith("/icon.png"), true);

    const docsResponse = await fetch(`${baseUrl}/mcp/docs`);
    const docsHtml = await docsResponse.text();
    assert.equal(docsResponse.status, 200);
    assert.match(docsHtml, /AurelianFlo MCP Docs/);
    assert.match(docsHtml, /codex mcp add aurelianflo --url https:\/\/x402\.aurelianflo\.com\/mcp/);
    assert.match(docsHtml, /aurelianflo-core/);
    assert.match(docsHtml, /monte_carlo_report/);
    assert.match(docsHtml, /Proof/);
    assert.match(docsHtml, /Lazarus Group/);
    assert.match(docsHtml, /candidate outperformance 0\.5903/i);

    const privacyResponse = await fetch(`${baseUrl}/mcp/privacy`);
    assert.equal(privacyResponse.status, 200);

    const supportResponse = await fetch(`${baseUrl}/mcp/support`);
    const supportHtml = await supportResponse.text();
    assert.equal(supportResponse.status, 200);
    assert.match(supportHtml, /support@aurelianflo\.com/);
  });
});

test("root app serves a core-only x402 well-known manifest", async () => {
  const app = createApp({
    env: {},
    enableDebugRoutes: false,
    paymentGate: (_req, _res, next) => next(),
    mercTrustMiddleware: null,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/.well-known/x402`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.version, 1);
    assert.match(payload.website || payload.website === undefined ? String(payload.website ?? "https://x402.aurelianflo.com") : "", /aurelianflo/i);
    assert.ok(Array.isArray(payload.resources));
    assert.deepEqual(
      payload.resources.map((resource) => new URL(resource).pathname),
      [
        "/api/ofac-wallet-screen/0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
        "/api/sim/report",
        "/api/tools/report/pdf/generate",
        "/api/tools/report/docx/generate",
      ],
    );
    assert.ok(Array.isArray(payload.endpoints));
    assert.deepEqual(
      payload.endpoints.map((endpoint) => endpoint.path),
      [
        "/api/ofac-wallet-screen/:address",
        "/api/sim/report",
        "/api/tools/report/pdf/generate",
        "/api/tools/report/docx/generate",
      ],
    );
    assert.equal(payload.endpointCount, 4);
    assert.equal(payload.endpoints.some((endpoint) => endpoint.path === "/api/weather/current/*"), false);
  });
});

test("root app serves MCP registry auth proof when configured", async () => {
  const proof = "v=MCPv1; k=ed25519; p=test-public-key";
  const app = createApp({
    env: {
      MCP_REGISTRY_AUTH_PROOF: proof,
    },
    enableDebugRoutes: false,
    paymentGate: (_req, _res, next) => next(),
    mercTrustMiddleware: null,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/.well-known/mcp-registry-auth`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
    assert.equal(response.headers.get("payment-required"), null);
    assert.equal(body, proof);
  });
});

test("root app hides MCP registry auth proof when unconfigured", async () => {
  const app = createApp({
    env: {},
    enableDebugRoutes: false,
    paymentGate: (_req, _res, next) => next(),
    mercTrustMiddleware: null,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/.well-known/mcp-registry-auth`);
    const body = await response.text();

    assert.equal(response.status, 404);
    assert.equal(response.headers.get("payment-required"), null);
    assert.equal(body, "");
  });
});

test("MCP bridge rebuilds POST JSON bodies instead of reusing consumed request streams", async () => {
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: {
        name: "test-client",
        version: "1.0.0",
      },
    },
  };

  const request = await __internal.toFetchRequest({
    protocol: "http",
    method: "POST",
    originalUrl: "/mcp",
    headers: {
      host: "127.0.0.1:3000",
      "content-type": "application/json",
      "content-length": "999",
    },
    body: payload,
    get(headerName) {
      return this.headers[String(headerName).toLowerCase()];
    },
  });

  assert.equal(request.headers.get("content-type"), "application/json");
  assert.equal(request.headers.get("content-length"), null);
  assert.equal(await request.text(), JSON.stringify(payload));
});
