import test from "node:test";
import assert from "node:assert/strict";

import { MCP_TOOL_DEFINITIONS } from "../src/tool-catalog.js";
import { buildUpstreamRequest } from "../src/upstream.js";

function getTool(name) {
  return MCP_TOOL_DEFINITIONS.find((tool) => tool.name === name);
}

test("bundled OFAC wallet report tool still targets the wallet-screen route and carries output selection in query params", () => {
  const request = buildUpstreamRequest(
    getTool("ofac_wallet_report"),
    {
      address: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
      asset: "ETH",
      output_format: "pdf",
    },
    "https://x402.aurelianflo.com",
  );

  assert.equal(request.method, "GET");
  assert.equal(
    request.url,
    "https://x402.aurelianflo.com/api/ofac-wallet-screen/0x098B716B8Aaf21512996dC57EB0615e2383E2f96?asset=ETH&output_format=pdf",
  );
  assert.equal(request.body, undefined);
});

test("OFAC wallet tool becomes a GET request with path and query params", () => {
  const request = buildUpstreamRequest(
    getTool("ofac_wallet_screen"),
    {
      address: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
      asset: "ETH",
    },
    "https://x402.aurelianflo.com",
  );

  assert.equal(request.method, "GET");
  assert.equal(
    request.url,
    "https://x402.aurelianflo.com/api/ofac-wallet-screen/0x098B716B8Aaf21512996dC57EB0615e2383E2f96?asset=ETH",
  );
  assert.equal(request.body, undefined);
});

test("decision report tool becomes a POST request with a JSON body", () => {
  const request = buildUpstreamRequest(
    getTool("monte_carlo_decision_report"),
    {
      analysis_type: "compare",
      title: "Candidate vs baseline decision memo",
      request: {
        baseline: { parameters: { demand_signal: 0.65 } },
        candidate: { parameters: { demand_signal: 0.78 } },
      },
    },
    "https://x402.aurelianflo.com",
  );

  assert.equal(request.method, "POST");
  assert.equal(request.url, "https://x402.aurelianflo.com/api/sim/report");
  assert.deepEqual(JSON.parse(request.body), {
    analysis_type: "compare",
    title: "Candidate vs baseline decision memo",
    request: {
      baseline: { parameters: { demand_signal: 0.65 } },
      candidate: { parameters: { demand_signal: 0.78 } },
    },
  });
});

test("bundled simulation report tool preserves output selection in the JSON body", () => {
  const request = buildUpstreamRequest(
    getTool("monte_carlo_report"),
    {
      analysis_type: "compare",
      title: "Candidate vs baseline decision memo",
      output_format: "pdf",
      request: {
        baseline: { parameters: { demand_signal: 0.65 } },
        candidate: { parameters: { demand_signal: 0.78 } },
      },
    },
    "https://x402.aurelianflo.com",
  );

  assert.equal(request.method, "POST");
  assert.equal(request.url, "https://x402.aurelianflo.com/api/sim/report");
  assert.deepEqual(JSON.parse(request.body), {
    analysis_type: "compare",
    title: "Candidate vs baseline decision memo",
    output_format: "pdf",
    request: {
      baseline: { parameters: { demand_signal: 0.65 } },
      candidate: { parameters: { demand_signal: 0.78 } },
    },
  });
});

test("document tools preserve the shared report payload", () => {
  const payload = {
    report_meta: { report_type: "ops-brief", title: "Weekly Ops Brief", author: "AurelianFlo" },
    executive_summary: ["Core routes stayed available through the reporting window."],
    tables: {
      route_health: {
        columns: ["route", "status"],
        rows: [{ route: "/api/tools/report/pdf/generate", status: "healthy" }],
      },
    },
  };

  const pdfRequest = buildUpstreamRequest(
    getTool("report_pdf_generate"),
    payload,
    "https://x402.aurelianflo.com",
  );
  const docxRequest = buildUpstreamRequest(
    getTool("report_docx_generate"),
    payload,
    "https://x402.aurelianflo.com",
  );

  assert.equal(pdfRequest.url, "https://x402.aurelianflo.com/api/tools/report/pdf/generate");
  assert.deepEqual(JSON.parse(pdfRequest.body), payload);
  assert.equal(docxRequest.url, "https://x402.aurelianflo.com/api/tools/report/docx/generate");
  assert.deepEqual(JSON.parse(docxRequest.body), payload);
});
