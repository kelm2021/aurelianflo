const assert = require("node:assert/strict");
const test = require("node:test");
const fetch = require("node-fetch");

const { createApp } = require("../app");

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

function createTestApp() {
  return createApp({
    env: {},
    enableDebugRoutes: false,
    paymentGate: (_req, _res, next) => next(),
    mercTrustMiddleware: null,
  });
}

test("root landing page emphasizes the flagship commercial sequence", async () => {
  const app = createTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`, {
      headers: { accept: "text/html" },
    });
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /Core services\./);
    assert.match(html, /Lead endpoint: POST \/api\/workflows\/compliance\/edd-report/);
    assert.match(html, /Lead endpoints: POST \/api\/workflows\/compliance\/batch-wallet-screen and GET \/api\/ofac-wallet-screen\/:address/);
    assert.match(html, /Lead endpoint: POST \/api\/workflows\/compliance\/wallet-sanctions-report/);
    assert.match(html, /Lead endpoints: POST \/api\/tools\/report\/pdf\/generate, POST \/api\/tools\/report\/docx\/generate, and POST \/api\/tools\/report\/xlsx\/generate/);
    assert.ok(!html.toLowerCase().includes("gilt"));
  });
});

test("/api renders a flagship-only HTML catalog while JSON stays complete", async () => {
  const app = createTestApp();

  await withServer(app, async (baseUrl) => {
    const htmlResponse = await fetch(`${baseUrl}/api`, {
      headers: { accept: "text/html" },
    });
    const html = await htmlResponse.text();

    assert.equal(htmlResponse.status, 200);
    assert.match(html, /Featured routes/);
    assert.match(html, /<h2>EDD memo<\/h2>/);
    assert.match(html, /<h2>Batch wallet screening<\/h2>/);
    assert.match(html, /<h2>OFAC wallet screening<\/h2>/);
    assert.match(html, /<h2>Report PDF generation<\/h2>/);
    assert.match(html, /<h2>Report DOCX generation<\/h2>/);
    assert.match(html, /<h2>Report XLSX generation<\/h2>/);
    assert.match(html, /Open docs/);
    assert.doesNotMatch(html, /\/api\/workflows\/finance\/cash-runway-forecast/);

    const jsonResponse = await fetch(`${baseUrl}/api?format=json`, {
      headers: { accept: "application/json" },
    });
    const payload = await jsonResponse.json();

    assert.equal(jsonResponse.status, 200);
    assert.ok(
      payload.catalog.some((entry) => entry.routeKey === "POST /api/workflows/compliance/edd-report"),
    );
    assert.ok(
      payload.catalog.some(
        (entry) => entry.routeKey === "POST /api/workflows/compliance/batch-wallet-screen",
      ),
    );
    assert.ok(
      !payload.catalog.some((entry) => entry.routeKey === "POST /api/workflows/finance/cash-runway-forecast"),
    );
    assert.ok(
      payload.catalog.some((entry) => entry.routeKey === "POST /api/tools/report/pdf/generate"),
    );
  });
});

test("public POST workflows expose browsable route docs on GET", async () => {
  const app = createTestApp();

  await withServer(app, async (baseUrl) => {
    const htmlResponse = await fetch(`${baseUrl}/api/workflows/compliance/edd-report`, {
      headers: { accept: "text/html" },
    });
    const html = await htmlResponse.text();

    assert.equal(htmlResponse.status, 200);
    assert.match(html, /Browser note: GET on this URL serves human-readable docs/);
    assert.match(html, /<h1>EDD memo<\/h1>/);
    assert.match(html, /workflowStatus/);
    assert.match(html, /output_format/);

    const jsonResponse = await fetch(`${baseUrl}/api/workflows/compliance/edd-report?format=json`, {
      headers: { accept: "application/json" },
    });
    const payload = await jsonResponse.json();

    assert.equal(jsonResponse.status, 200);
    assert.equal(payload.docsOnlyGet, true);
    assert.equal(payload.method, "POST");
    assert.equal(payload.path, "/api/workflows/compliance/edd-report");
    assert.equal(payload.routeKey, "POST /api/workflows/compliance/edd-report");
    assert.equal(payload.requestExample.output_format, "pdf");
  });
});

test("GET on flagship POST workflow routes renders route docs instead of a dead-end", async () => {
  const app = createTestApp();

  await withServer(app, async (baseUrl) => {
    const htmlResponse = await fetch(`${baseUrl}/api/workflows/compliance/edd-report`, {
      headers: { accept: "text/html" },
    });
    const html = await htmlResponse.text();

    assert.equal(htmlResponse.status, 200);
    assert.match(html, /Browser note: GET on this URL serves human-readable docs/);
    assert.match(html, /<h2>Example request body<\/h2>/);
    assert.match(html, /<h2>Request schema<\/h2>/);
    assert.match(html, /output_format/);

    const jsonResponse = await fetch(`${baseUrl}/api/workflows/compliance/edd-report`, {
      headers: { accept: "application/json" },
    });
    const payload = await jsonResponse.json();

    assert.equal(jsonResponse.status, 200);
    assert.equal(payload.docsOnlyGet, true);
    assert.equal(payload.method, "POST");
    assert.equal(payload.path, "/api/workflows/compliance/edd-report");
  });
});

test("payments MCP integration is reachable from the root origin and keeps EDD-first prompts clean", async () => {
  const app = createTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/integrations/payments-mcp`, {
      headers: { accept: "application/json" },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.paymentsMcp.installerPackage, "@coinbase/payments-mcp");
    assert.match(payload.paymentsMcp.primaryPrompt, /edd-report/);
    assert.doesNotMatch(payload.paymentsMcp.primaryPrompt, /\r|\n/);
  });
});
