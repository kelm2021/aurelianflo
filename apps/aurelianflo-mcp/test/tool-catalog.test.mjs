import test from "node:test";
import assert from "node:assert/strict";

import { MCP_TOOL_DEFINITIONS } from "../src/tool-catalog.js";

test("MCP tool catalog exposes a free demo tool, bundled compliance workflow, and sim plus document tools", () => {
  assert.deepEqual(
    MCP_TOOL_DEFINITIONS.map((tool) => tool.name),
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

test("tool catalog maps each flagship tool to the live route surface", () => {
  const byName = new Map(MCP_TOOL_DEFINITIONS.map((tool) => [tool.name, tool]));

  assert.equal(byName.get("server_capabilities").price, 0);
  assert.equal(byName.get("server_capabilities").route, null);
  assert.deepEqual(byName.get("server_capabilities").required, []);

  assert.deepEqual(byName.get("ofac_wallet_report").route, {
    method: "GET",
    pathTemplate: "/api/ofac-wallet-screen/{address}",
  });
  assert.equal(byName.get("ofac_wallet_report").price, 0.205);
  assert.deepEqual(byName.get("ofac_wallet_report").required, ["address", "output_format"]);

  assert.deepEqual(byName.get("ofac_wallet_screen").route, {
    method: "GET",
    pathTemplate: "/api/ofac-wallet-screen/{address}",
  });
  assert.equal(byName.get("ofac_wallet_screen").price, 0.005);
  assert.deepEqual(byName.get("ofac_wallet_screen").required, ["address"]);

  assert.deepEqual(byName.get("monte_carlo_report").route, {
    method: "POST",
    pathTemplate: "/api/sim/report",
  });
  assert.equal(byName.get("monte_carlo_report").price, 0.29);
  assert.deepEqual(byName.get("monte_carlo_report").required, ["analysis_type", "request", "output_format"]);

  assert.deepEqual(byName.get("monte_carlo_decision_report").route, {
    method: "POST",
    pathTemplate: "/api/sim/report",
  });
  assert.equal(byName.get("monte_carlo_decision_report").price, 0.09);
  assert.deepEqual(byName.get("monte_carlo_decision_report").required, ["analysis_type", "request"]);

  assert.deepEqual(byName.get("report_pdf_generate").route, {
    method: "POST",
    pathTemplate: "/api/tools/report/pdf/generate",
  });
  assert.equal(byName.get("report_pdf_generate").price, 0.2);
  assert.ok(byName.get("report_pdf_generate").required.includes("report_meta"));

  assert.deepEqual(byName.get("report_docx_generate").route, {
    method: "POST",
    pathTemplate: "/api/tools/report/docx/generate",
  });
  assert.equal(byName.get("report_docx_generate").price, 0.16);
  assert.ok(byName.get("report_docx_generate").required.includes("report_meta"));
});

test("tool catalog includes submission-ready safety annotations", () => {
  const byName = new Map(MCP_TOOL_DEFINITIONS.map((tool) => [tool.name, tool]));

  assert.deepEqual(byName.get("server_capabilities").annotations, {
    title: "Server Capabilities",
    readOnlyHint: true,
  });
  assert.deepEqual(byName.get("ofac_wallet_report").annotations, {
    title: "OFAC Wallet Screen Report",
    destructiveHint: true,
  });
  assert.deepEqual(byName.get("ofac_wallet_screen").annotations, {
    title: "OFAC Wallet Screen",
    readOnlyHint: true,
  });
  assert.deepEqual(byName.get("monte_carlo_report").annotations, {
    title: "Monte Carlo Report",
    destructiveHint: true,
  });
  assert.deepEqual(byName.get("monte_carlo_decision_report").annotations, {
    title: "Monte Carlo Decision Report",
    readOnlyHint: true,
  });
  assert.deepEqual(byName.get("report_pdf_generate").annotations, {
    title: "Report PDF Generate",
    destructiveHint: true,
  });
  assert.deepEqual(byName.get("report_docx_generate").annotations, {
    title: "Report DOCX Generate",
    destructiveHint: true,
  });
});

test("tool catalog includes parameter descriptions for directory indexing", () => {
  const byName = new Map(MCP_TOOL_DEFINITIONS.map((tool) => [tool.name, tool]));

  assert.match(byName.get("server_capabilities").description, /free|connection|capabilities/i);
  assert.match(
    byName.get("ofac_wallet_report").inputSchema.properties.output_format.description,
    /pdf|docx|json/i,
  );
  assert.match(byName.get("ofac_wallet_screen").inputSchema.properties.address.description, /wallet/i);
  assert.match(
    byName.get("monte_carlo_report").inputSchema.properties.output_format.description,
    /pdf|docx|json/i,
  );
  assert.match(
    byName.get("monte_carlo_decision_report").inputSchema.properties.analysis_type.description,
    /simulation workflow/i,
  );
  assert.match(
    byName.get("report_pdf_generate").inputSchema.properties.tables.description,
    /Named tables/i,
  );
});
