import test from "node:test";
import assert from "node:assert/strict";

import { SERVER_CARD } from "../src/server-card.js";

test("server card exposes the bundled compliance workflow plus sim and document tools", () => {
  assert.deepEqual(
    SERVER_CARD.tools.map((tool) => tool.name),
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
  assert.equal(SERVER_CARD.serverInfo.name, "AurelianFlo MCP");
  assert.equal(SERVER_CARD.serverInfo.version, "0.1.0");
});

test("server card marks the server as unauthenticated and statically scannable", () => {
  assert.equal(SERVER_CARD.authentication.required, false);
  assert.deepEqual(SERVER_CARD.authentication.schemes, []);
  assert.equal(SERVER_CARD.configSchema.type, "object");
  assert.deepEqual(SERVER_CARD.configSchema.properties, {});
  assert.equal(SERVER_CARD.security.userAuthenticationRequired, false);
  assert.equal(SERVER_CARD.security.paymentRequired, true);
  assert.deepEqual(SERVER_CARD.resources, []);
  assert.equal(SERVER_CARD.capabilities.prompts, true);
  assert.equal(SERVER_CARD.serverInfo.icons[0].src, "https://x402.aurelianflo.com/icon.png");
});

test("server card publishes typed input schemas for tool discovery", () => {
  const capabilitiesTool = SERVER_CARD.tools.find((tool) => tool.name === "server_capabilities");
  const bundledOfacTool = SERVER_CARD.tools.find((tool) => tool.name === "ofac_wallet_report");
  const ofacTool = SERVER_CARD.tools.find((tool) => tool.name === "ofac_wallet_screen");
  const bundledSimTool = SERVER_CARD.tools.find((tool) => tool.name === "monte_carlo_report");
  const reportTool = SERVER_CARD.tools.find((tool) => tool.name === "monte_carlo_decision_report");
  const pdfTool = SERVER_CARD.tools.find((tool) => tool.name === "report_pdf_generate");

  assert.equal(capabilitiesTool.inputSchema.type, "object");
  assert.deepEqual(capabilitiesTool.inputSchema.properties, {});
  assert.deepEqual(bundledOfacTool.inputSchema.properties.output_format.enum, ["json", "pdf", "docx"]);
  assert.equal(ofacTool.inputSchema.properties.address.type, "string");
  assert.equal(ofacTool.inputSchema.properties.asset.type, "string");
  assert.deepEqual(bundledSimTool.inputSchema.properties.output_format.enum, ["json", "pdf", "docx"]);
  assert.deepEqual(reportTool.inputSchema.properties.analysis_type.enum, [
    "probability",
    "batch-probability",
    "compare",
    "sensitivity",
    "forecast",
    "composed",
    "optimize",
  ]);
  assert.equal(pdfTool.inputSchema.properties.tables.type, "object");
  assert.equal(pdfTool.inputSchema.required.includes("report_meta"), true);
});

test("server card publishes prompt templates for the main workflows", () => {
  assert.deepEqual(
    SERVER_CARD.prompts.map((prompt) => prompt.name),
    [
      "wallet_ofac_screening_brief",
      "decision_report_brief",
      "report_artifact_brief",
    ],
  );
  assert.match(
    SERVER_CARD.prompts.find((prompt) => prompt.name === "wallet_ofac_screening_brief").arguments[0].description,
    /screen/i,
  );
});
