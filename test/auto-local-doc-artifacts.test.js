const assert = require("node:assert/strict");
const test = require("node:test");
const ExcelJS = require("exceljs");
const JSZip = require("jszip");

const { buildDocumentArtifact, isDocumentArtifactPath } = require("../routes/auto-local/doc-artifacts");
const {
  buildStructuredReport,
  createAssumptionsTable,
  createHeadlineMetric,
  createTable,
} = require("../lib/report-builder");

function decodeArtifactBuffer(payload) {
  assert.equal(payload.success, true);
  assert.equal(typeof payload.data?.artifact?.contentBase64, "string");
  return Buffer.from(payload.data.artifact.contentBase64, "base64");
}

async function readZipEntryText(payload, entryName) {
  const bytes = decodeArtifactBuffer(payload);
  const zip = await JSZip.loadAsync(bytes);
  const entry = zip.file(entryName);
  assert.ok(entry, `missing zip entry: ${entryName}`);
  return entry.async("string");
}

async function readWorkbook(payload) {
  const bytes = decodeArtifactBuffer(payload);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  return workbook;
}

function worksheetContains(worksheet, needle) {
  for (const row of worksheet.getSheetValues().slice(1)) {
    if (!Array.isArray(row)) {
      continue;
    }
    for (const cell of row) {
      if (cell == null) {
        continue;
      }
      if (String(cell).includes(needle)) {
        return true;
      }
    }
  }
  return false;
}

function buildSharedReportFixture() {
  return buildStructuredReport({
    reportMeta: {
      report_type: "vendor-brief",
      title: "Vendor onboarding brief",
      author: "AurelianFlo",
    },
    executiveSummary: [
      "Counterparty passed data-quality checks.",
      "Manual review is still recommended before payout.",
    ],
    headlineMetrics: [
      createHeadlineMetric("Risk tier", "medium", "label"),
      createHeadlineMetric("Screened lists", 4, "count"),
      createHeadlineMetric("Manual review recommended", true, "boolean"),
    ],
    tables: {
      headline_metrics: createTable(
        ["label", "value", "unit"],
        [
          { label: "Risk tier", value: "medium", unit: "label" },
          { label: "Screened lists", value: 4, unit: "count" },
        ],
      ),
      counterparties: createTable(
        ["name", "country", "status"],
        [{ name: "Example Co", country: "US", status: "review" }],
      ),
      assumptions: createAssumptionsTable([
        { field: "workflow", value: "vendor_onboarding" },
        { field: "screening_date", value: "2026-04-03" },
      ]),
    },
    result: {
      status: "review",
    },
  });
}

function buildWorkflowReportFixture() {
  return {
    workflow_meta: {
      workflow: "sports.playoff_forecast",
      league: "nba",
      as_of_date: "2026-04-03",
      mode: "standings_snapshot",
      model_version: "1.0.0",
    },
    inputs_echo: {
      field: "top_6_only",
    },
    prediction: {
      predicted_winner: "Oklahoma City Thunder",
      championship_probability: 0.5036,
    },
    ranking: [
      { rank: 1, team: "Oklahoma City Thunder", probability: 0.5036 },
      { rank: 2, team: "San Antonio Spurs", probability: 0.4632 },
    ],
    assumptions: [
      "Modeled field: top 6 seeds in each conference",
      "Signals: win percentage, point differential, recent form, and seed strength",
    ],
    diagnostics: {
      simulations_run: 10000,
      seed: 12345,
    },
    report: buildStructuredReport({
      reportMeta: {
        report_type: "sports-playoff-forecast",
        title: "NBA Playoff Forecast",
        author: "AurelianFlo",
      },
      executiveSummary: [
        "Oklahoma City Thunder is the top-ranked title favorite in this snapshot.",
        "San Antonio Spurs is the strongest challenger in the modeled field.",
      ],
      headlineMetrics: [
        createHeadlineMetric("Predicted winner", "Oklahoma City Thunder", "team"),
        createHeadlineMetric("Championship probability", "50.36%", "percent"),
      ],
      tables: {
        contender_ranking: createTable(
          ["rank", "team", "probability"],
          [
            { rank: 1, team: "Oklahoma City Thunder", probability: "50.36%" },
            { rank: 2, team: "San Antonio Spurs", probability: "46.32%" },
          ],
        ),
      },
      exportArtifacts: {
        recommended_local_path: "outputs/nba-playoff-forecast-2026-04-03.xlsx",
      },
      result: {
        predicted_winner: "Oklahoma City Thunder",
      },
    }),
  };
}

function buildVendorWorkflowReportFixture() {
  return {
    workflow_meta: {
      workflow: "vendor.risk_forecast",
      as_of_date: "2026-04-03",
      mode: "vendor_batch",
      model_version: "1.0.0",
    },
    inputs_echo: {
      vendor_count: 3,
      screening_threshold: 90,
      screening_limit: 3,
    },
    summary: {
      status: "manual-review-required",
      recommended_action: "pause-and-review",
      risk_tier: "high",
      flagged_vendor_count: 2,
      clear_vendor_count: 1,
    },
    vendors: [
      {
        rank: 1,
        name: "SBERBANK",
        country: "CZ",
        risk_tier: "critical",
        risk_score: 0.97,
        recommended_action: "reject-or-escalate",
        manual_review_required: true,
      },
      {
        rank: 2,
        name: "VTB BANK PJSC",
        country: "RU",
        risk_tier: "high",
        risk_score: 0.88,
        recommended_action: "pause-and-review",
        manual_review_required: true,
      },
      {
        rank: 3,
        name: "Example Co",
        country: "US",
        risk_tier: "low",
        risk_score: 0.12,
        recommended_action: "proceed",
        manual_review_required: false,
      },
    ],
    assumptions: [
      "This workflow is a triage and screening aid, not legal clearance.",
      "Risk scoring uses sanctions and entity-resolution signals plus vendor context.",
    ],
    diagnostics: {
      vendors_processed: 3,
      brief_calls: 2,
      batch_screen_calls: 1,
      seed: 12345,
    },
    report: buildStructuredReport({
      reportMeta: {
        report_type: "vendor-risk-forecast",
        title: "Vendor Risk Forecast",
        author: "AurelianFlo",
      },
      executiveSummary: [
        "Two vendors require manual review before onboarding.",
        "One vendor is currently clear under the configured threshold.",
      ],
      headlineMetrics: [
        createHeadlineMetric("Risk tier", "high", "label"),
        createHeadlineMetric("Flagged vendors", 2, "count"),
        createHeadlineMetric("Vendors processed", 3, "count"),
      ],
      tables: {
        vendor_ranking: createTable(
          ["rank", "name", "country", "risk_tier", "recommended_action"],
          [
            { rank: 1, name: "SBERBANK", country: "CZ", risk_tier: "critical", recommended_action: "reject-or-escalate" },
            { rank: 2, name: "VTB BANK PJSC", country: "RU", risk_tier: "high", recommended_action: "pause-and-review" },
            { rank: 3, name: "Example Co", country: "US", risk_tier: "low", recommended_action: "proceed" },
          ],
        ),
      },
      exportArtifacts: {
        recommended_local_path: "outputs/vendor-risk-forecast-2026-04-03.xlsx",
      },
      result: {
        status: "manual-review-required",
      },
    }),
  };
}

test("isDocumentArtifactPath matches document-like auto-local paths", () => {
  assert.equal(isDocumentArtifactPath("/api/tools/pdf/generate"), true);
  assert.equal(isDocumentArtifactPath("/api/tools/invoice/generate"), true);
  assert.equal(isDocumentArtifactPath("/api/tools/convert/markdown-to-pdf"), true);
  assert.equal(isDocumentArtifactPath("/api/tools/random/joke"), false);
});

test("buildDocumentArtifact returns real binary PDF for /pdf/ paths", async () => {
  const payload = await buildDocumentArtifact({
    path: "/api/tools/pdf/generate",
    endpoint: "POST /api/tools/pdf/generate",
    body: { title: "Quarterly Plan", owner: "Ops" },
  });

  assert.equal(payload.success, true);
  assert.equal(payload.data.documentType, "pdf");
  assert.equal(payload.data.artifact.type, "pdf");

  const bytes = decodeArtifactBuffer(payload);
  assert.ok(bytes.length > 0);
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "%PDF");
});

test("buildDocumentArtifact returns real binary PDF for invoice/receipt-like paths", async () => {
  const payload = await buildDocumentArtifact({
    path: "/api/tools/invoice/generate",
    endpoint: "POST /api/tools/invoice/generate",
    body: { title: "Invoice 1024", amount: "250.00" },
  });

  assert.equal(payload.success, true);
  assert.equal(payload.data.documentType, "pdf");
  assert.equal(payload.data.artifact.type, "pdf");

  const bytes = decodeArtifactBuffer(payload);
  assert.ok(bytes.length > 0);
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "%PDF");
});

test("buildDocumentArtifact returns real binary PDF for conversion-to-pdf paths", async () => {
  const payload = await buildDocumentArtifact({
    path: "/api/tools/convert/markdown-to-pdf",
    endpoint: "POST /api/tools/convert/markdown-to-pdf",
    body: { title: "Release Notes", markdown: "# v1.2.3\\n\\n- Added feature" },
  });

  assert.equal(payload.success, true);
  assert.equal(payload.data.documentType, "pdf");
  assert.equal(payload.data.artifact.type, "pdf");

  const bytes = decodeArtifactBuffer(payload);
  assert.ok(bytes.length > 0);
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "%PDF");
});

test("buildDocumentArtifact returns real binary XLSX for structured sheet payloads", async () => {
  const payload = await buildDocumentArtifact({
    path: "/api/tools/xlsx/generate",
    endpoint: "POST /api/tools/xlsx/generate",
    body: {
      title: "Quarterly Workbook",
      sheets: [
        {
          name: "Scores",
          headers: ["name", "score"],
          rows: [
            ["Alice", 91],
            ["Bob", 84],
          ],
        },
        {
          name: "Summary",
          headers: ["metric", "value"],
          rows: [
            { metric: "avg_score", value: 87.5 },
            { metric: "count", value: 2 },
          ],
        },
      ],
    },
  });

  assert.equal(payload.success, true);
  assert.equal(payload.data.documentType, "xlsx");
  assert.equal(payload.data.artifact.type, "xlsx");

  const bytes = decodeArtifactBuffer(payload);
  assert.ok(bytes.length > 0);
  assert.equal(bytes.subarray(0, 2).toString("ascii"), "PK");

  const workbook = await readWorkbook(payload);
  assert.deepEqual(workbook.worksheets.map((worksheet) => worksheet.name), ["Scores", "Summary"]);
  assert.equal(workbook.getWorksheet("Scores").getCell("A2").value, "Alice");
  assert.equal(workbook.getWorksheet("Scores").getCell("B2").value, 91);
  assert.equal(workbook.getWorksheet("Summary").getCell("A2").value, "avg_score");
});

test("buildDocumentArtifact ingests shared report model directly into XLSX sheets", async () => {
  const payload = await buildDocumentArtifact({
    path: "/api/tools/xlsx/generate",
    endpoint: "POST /api/tools/xlsx/generate",
    body: buildSharedReportFixture(),
  });

  assert.equal(payload.success, true);
  assert.equal(payload.data.documentType, "xlsx");

  const workbook = await readWorkbook(payload);
  assert.ok(workbook.getWorksheet("Headline Metrics"));
  assert.ok(workbook.getWorksheet("Counterparties"));
  assert.ok(workbook.getWorksheet("Assumptions"));
  assert.equal(worksheetContains(workbook.getWorksheet("Counterparties"), "Example Co"), true);
});

test("buildDocumentArtifact ingests nested workflow report payloads into XLSX and preserves recommended path", async () => {
  const payload = await buildDocumentArtifact({
    path: "/api/tools/xlsx/generate",
    endpoint: "POST /api/tools/xlsx/generate",
    body: buildWorkflowReportFixture(),
  });

  assert.equal(payload.success, true);
  assert.equal(payload.data.documentType, "xlsx");
  assert.equal(payload.data.recommended_local_path, "outputs/nba-playoff-forecast-2026-04-03.xlsx");

  const workbook = await readWorkbook(payload);
  assert.ok(workbook.getWorksheet("Contender Ranking"));
  assert.equal(
    worksheetContains(workbook.getWorksheet("Contender Ranking"), "Oklahoma City Thunder"),
    true,
  );
});

test("buildDocumentArtifact ingests vendor workflow reports into XLSX and preserves vendor path", async () => {
  const payload = await buildDocumentArtifact({
    path: "/api/tools/xlsx/generate",
    endpoint: "POST /api/tools/xlsx/generate",
    body: buildVendorWorkflowReportFixture(),
  });

  assert.equal(payload.success, true);
  assert.equal(payload.data.documentType, "xlsx");
  assert.equal(payload.data.recommended_local_path, "outputs/vendor-risk-forecast-2026-04-03.xlsx");

  const workbook = await readWorkbook(payload);
  assert.ok(workbook.getWorksheet("Vendor Ranking"));
  assert.equal(
    worksheetContains(workbook.getWorksheet("Vendor Ranking"), "SBERBANK"),
    true,
  );
});

test("buildDocumentArtifact renders NDA-specific DOCX content instead of preview stub text", async () => {
  const payload = await buildDocumentArtifact({
    path: "/api/tools/docx/generate",
    endpoint: "POST /api/tools/docx/generate",
    body: {
      title: "Mutual NDA",
      template: "nda",
      parties: {
        party_a: { name: "Acme Labs" },
        party_b: { name: "Beta Ventures" },
        effective_date: "2026-04-02",
      },
      company: { state: "Texas" },
    },
  });

  assert.equal(payload.success, true);
  assert.equal(payload.data.documentType, "docx");
  assert.equal(payload.data.artifact.type, "docx");

  const documentXml = await readZipEntryText(payload, "word/document.xml");
  assert.match(documentXml, /Definition of Confidential Information/);
  assert.match(documentXml, /Acme Labs/);
  assert.match(documentXml, /Beta Ventures/);
  assert.doesNotMatch(documentXml, /Generated from POST \/api\/tools\/docx\/generate/);
});

test("buildDocumentArtifact ingests shared report model directly into DOCX report layout", async () => {
  const payload = await buildDocumentArtifact({
    path: "/api/tools/docx/generate",
    endpoint: "POST /api/tools/docx/generate",
    body: buildSharedReportFixture(),
  });

  assert.equal(payload.success, true);
  assert.equal(payload.data.documentType, "docx");

  const documentXml = await readZipEntryText(payload, "word/document.xml");
  assert.match(documentXml, /Vendor onboarding brief/);
  assert.match(documentXml, /Counterparty passed data-quality checks/);
  assert.match(documentXml, /Example Co/);
});

test("buildDocumentArtifact renders invoice XLSX template content instead of generic preview rows", async () => {
  const payload = await buildDocumentArtifact({
    path: "/api/tools/xlsx/generate",
    endpoint: "POST /api/tools/xlsx/generate",
    body: {
      title: "April Invoice",
      template: "invoice",
      company: { name: "AurelianFlo" },
      client: { name: "Kent Egan" },
      invoice_number: "INV-2026-0042",
      items: [
        { description: "Endpoint audit", quantity: 2, price: 125 },
        { description: "Doc generation upgrade", quantity: 1, price: 400 },
      ],
      tax_rate: 8.25,
    },
  });

  assert.equal(payload.success, true);
  assert.equal(payload.data.documentType, "xlsx");
  assert.equal(payload.data.artifact.type, "xlsx");

  const workbook = await readWorkbook(payload);
  const worksheet = workbook.getWorksheet("Invoice");
  assert.ok(worksheet);
  assert.equal(worksheet.getCell("B5").value, "INVOICE");
  assert.equal(worksheet.getCell("E5").value, "INV-2026-0042");
  assert.equal(worksheetContains(worksheet, "Subtotal:"), true);
  assert.equal(worksheetContains(worksheet, "TOTAL:"), true);
  assert.equal(worksheetContains(worksheet, "Generated from POST /api/tools/xlsx/generate"), false);
});

test("buildDocumentArtifact renders formatted invoice PDF instead of placeholder preview text", async () => {
  const payload = await buildDocumentArtifact({
    path: "/api/tools/invoice/generate",
    endpoint: "POST /api/tools/invoice/generate",
    body: {
      company: { name: "AurelianFlo", email: "ops@aurelianflo.com" },
      client: { name: "Kent Egan", email: "kent@example.com" },
      invoice_number: "INV-2026-0042",
      items: [{ description: "Doc generation upgrade", quantity: 1, price: 400 }],
      tax_rate: 8.25,
    },
  });

  assert.equal(payload.success, true);
  assert.equal(payload.data.documentType, "pdf");
  assert.equal(payload.data.artifact.type, "pdf");
  assert.equal(payload.data.fileName, "INV-2026-0042.pdf");

  const bytes = decodeArtifactBuffer(payload);
  const asText = bytes.toString("latin1");
  assert.ok(asText.startsWith("%PDF"));
  assert.ok(bytes.length > 1500);
  assert.doesNotMatch(asText, /Generated from POST \/api\/tools\/invoice\/generate/);
});

test("buildDocumentArtifact renders contract PDFs with legal-layout output instead of generic stubs", async () => {
  const payload = await buildDocumentArtifact({
    path: "/api/tools/contract/generate",
    endpoint: "POST /api/tools/contract/generate",
    body: {
      type: "nda",
      effectiveDate: "2026-04-02",
      jurisdiction: "Texas",
      duration: "3 years",
      partyA: { name: "Acme Labs", company: "Acme Labs" },
      partyB: { name: "Beta Ventures", company: "Beta Ventures" },
    },
  });

  assert.equal(payload.success, true);
  assert.equal(payload.data.documentType, "pdf");
  assert.equal(payload.data.fileName, "nda-2026-04-02.pdf");

  const bytes = decodeArtifactBuffer(payload);
  const asText = bytes.toString("latin1");
  assert.ok(asText.startsWith("%PDF"));
  assert.ok(bytes.length > 3000);
  assert.doesNotMatch(asText, /Generated from POST \/api\/tools\/contract\/generate/);
});

test("buildDocumentArtifact renders proposal PDFs with proposal-specific filename and non-stub size", async () => {
  const payload = await buildDocumentArtifact({
    path: "/api/tools/proposal/generate",
    endpoint: "POST /api/tools/proposal/generate",
    body: {
      projectName: "AurelianFlo Discovery Upgrade",
      client: "Kent Egan",
      preparedBy: { name: "AurelianFlo", company: "AurelianFlo" },
      scope: "Replace stub outputs with production-ready document generators.",
      deliverables: ["Contract PDF", "Proposal PDF", "Markdown PDF"],
      pricing: {
        currency: "USD",
        total: 1200,
        items: [
          { description: "Implementation", amount: 900 },
          { description: "Verification", amount: 300 },
        ],
      },
    },
  });

  assert.equal(payload.success, true);
  assert.equal(payload.data.documentType, "pdf");
  assert.equal(payload.data.fileName, "proposal-aurelianflo-discovery-upgrade.pdf");

  const bytes = decodeArtifactBuffer(payload);
  const asText = bytes.toString("latin1");
  assert.ok(asText.startsWith("%PDF"));
  assert.ok(bytes.length > 1800);
  assert.doesNotMatch(asText, /Generated from POST \/api\/tools\/proposal\/generate/);
});

test("buildDocumentArtifact renders markdown PDFs with dedicated filename and richer output size", async () => {
  const payload = await buildDocumentArtifact({
    path: "/api/tools/markdown-to-pdf",
    endpoint: "POST /api/tools/markdown-to-pdf",
    body: {
      markdown: [
        "# Release Notes",
        "",
        "## Summary",
        "- Added **contract** generator",
        "- Added `markdown-to-pdf` support",
        "",
        "> Stub outputs replaced",
        "",
        "```js",
        "console.log('hello');",
        "```",
      ].join("\n"),
    },
  });

  assert.equal(payload.success, true);
  assert.equal(payload.data.documentType, "pdf");
  assert.equal(payload.data.fileName, "document.pdf");

  const bytes = decodeArtifactBuffer(payload);
  const asText = bytes.toString("latin1");
  assert.ok(asText.startsWith("%PDF"));
  assert.ok(bytes.length > 1800);
  assert.doesNotMatch(asText, /Generated from POST \/api\/tools\/markdown-to-pdf/);
});

test("buildDocumentArtifact ingests shared report model directly into report PDF output", async () => {
  const payload = await buildDocumentArtifact({
    path: "/api/tools/report/generate",
    endpoint: "POST /api/tools/report/generate",
    body: buildSharedReportFixture(),
  });

  assert.equal(payload.success, true);
  assert.equal(payload.data.documentType, "pdf");

  const bytes = decodeArtifactBuffer(payload);
  const asText = bytes.toString("latin1");
  assert.ok(asText.startsWith("%PDF"));
  assert.ok(bytes.length > 1800);
  assert.doesNotMatch(asText, /Generated from POST \/api\/tools\/report\/generate/);
});

test("buildDocumentArtifact derives document-specific recommended path for workflow-backed report PDFs", async () => {
  const payload = await buildDocumentArtifact({
    path: "/api/tools/report/generate",
    endpoint: "POST /api/tools/report/generate",
    body: buildWorkflowReportFixture(),
  });

  assert.equal(payload.success, true);
  assert.equal(payload.data.documentType, "pdf");
  assert.equal(payload.data.recommended_local_path, "outputs/nba-playoff-forecast-2026-04-03.pdf");

  const bytes = decodeArtifactBuffer(payload);
  const asText = bytes.toString("latin1");
  assert.ok(asText.startsWith("%PDF"));
  assert.doesNotMatch(asText, /Generated from POST \/api\/tools\/report\/generate/);
});

test("buildDocumentArtifact derives document-specific recommended path for vendor report PDFs", async () => {
  const payload = await buildDocumentArtifact({
    path: "/api/tools/report/generate",
    endpoint: "POST /api/tools/report/generate",
    body: buildVendorWorkflowReportFixture(),
  });

  assert.equal(payload.success, true);
  assert.equal(payload.data.documentType, "pdf");
  assert.equal(payload.data.recommended_local_path, "outputs/vendor-risk-forecast-2026-04-03.pdf");

  const bytes = decodeArtifactBuffer(payload);
  const asText = bytes.toString("latin1");
  assert.ok(asText.startsWith("%PDF"));
  assert.doesNotMatch(asText, /Generated from POST \/api\/tools\/report\/generate/);
});
