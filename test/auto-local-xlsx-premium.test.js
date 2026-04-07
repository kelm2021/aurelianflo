const assert = require("node:assert/strict");
const test = require("node:test");
const ExcelJS = require("exceljs");

const {
  generateReportXlsxBuffer,
  generateSimpleXlsxBuffer,
  generateTemplateXlsxBuffer,
  generateXlsxBuffer,
} = require("../routes/auto-local/xlsx-generator");

async function readWorkbook(result) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);
  return workbook;
}

function worksheetContains(worksheet, needle) {
  for (const row of worksheet.getSheetValues().slice(1)) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      if (cell == null) continue;
      if (String(cell).includes(needle)) {
        return true;
      }
    }
  }
  return false;
}

test("generateReportXlsxBuffer builds workbook sheets from shared report model fields", async () => {
  const result = await generateReportXlsxBuffer({
    title: "Vendor Risk Report",
    report_meta: { title: "Vendor Risk Report", report_type: "vendor-risk" },
    executive_summary: ["Two vendors require review."],
    headline_metrics: [
      { label: "Flagged vendors", value: 2, unit: "count" },
      { label: "Clear vendors", value: 1, unit: "count" },
    ],
    tables: {
      vendor_ranking: {
        columns: ["name", "risk_tier", "recommended_action"],
        rows: [
          { name: "SBERBANK", risk_tier: "critical", recommended_action: "reject-or-escalate" },
          { name: "Example Co", risk_tier: "low", recommended_action: "proceed" },
        ],
      },
    },
  });

  assert.equal(result.fileName, "Vendor-Risk-Report.xlsx");
  const workbook = await readWorkbook(result);
  assert.ok(workbook.getWorksheet("Executive Summary"));
  assert.ok(workbook.getWorksheet("Headline Metrics"));
  assert.ok(workbook.getWorksheet("Vendor Ranking"));
  assert.equal(
    worksheetContains(workbook.getWorksheet("Vendor Ranking"), "SBERBANK"),
    true,
  );
});

test("generateSimpleXlsxBuffer parses markdown tables into structured worksheet rows", async () => {
  const result = await generateSimpleXlsxBuffer({
    title: "Simple Markdown Workbook",
    markdown: [
      "# KPI Table",
      "",
      "| Metric | Value |",
      "| --- | --- |",
      "| Revenue | 120000 |",
      "| Margin | 42% |",
    ].join("\n"),
  });

  const workbook = await readWorkbook(result);
  const sheet = workbook.getWorksheet("Markdown");
  assert.ok(sheet);
  assert.equal(sheet.getCell("A1").value, "Metric");
  assert.equal(sheet.getCell("B1").value, "Value");
  assert.equal(sheet.getCell("A2").value, "Revenue");
  assert.equal(String(sheet.getCell("B3").value), "42%");
});

test("generateSimpleXlsxBuffer parses html tables into structured worksheet rows", async () => {
  const result = await generateSimpleXlsxBuffer({
    title: "Simple HTML Workbook",
    html: `
      <html><body>
        <table>
          <thead><tr><th>Quarter</th><th>Revenue</th></tr></thead>
          <tbody>
            <tr><td>Q1</td><td>10</td></tr>
            <tr><td>Q2</td><td>12</td></tr>
          </tbody>
        </table>
      </body></html>
    `,
  });

  const workbook = await readWorkbook(result);
  const sheet = workbook.getWorksheet("HTML");
  assert.ok(sheet);
  assert.equal(sheet.getCell("A1").value, "Quarter");
  assert.equal(sheet.getCell("B1").value, "Revenue");
  assert.equal(sheet.getCell("A2").value, "Q1");
  assert.equal(String(sheet.getCell("B3").value), "12");
});

test("generateTemplateXlsxBuffer keeps premium invoice template output path", async () => {
  const result = await generateTemplateXlsxBuffer({
    title: "April Invoice",
    template: "invoice",
    company: { name: "AurelianFlo" },
    client: { name: "Kent Egan" },
    invoice_number: "INV-2026-0042",
    items: [{ description: "Doc generation upgrade", quantity: 1, price: 400 }],
  });

  const workbook = await readWorkbook(result);
  const sheet = workbook.getWorksheet("Invoice");
  assert.ok(sheet);
  assert.equal(sheet.getCell("B5").value, "INVOICE");
  assert.equal(sheet.getCell("E5").value, "INV-2026-0042");
});

test("generateTemplateXlsxBuffer supports max-fidelity forecast_model template", async () => {
  const result = await generateTemplateXlsxBuffer({
    title: "Forecast Model",
    template: "forecast_model",
    assumptions: {
      growth_rate: 0.12,
      starting_revenue: 100000,
      months: 3,
    },
  });

  const workbook = await readWorkbook(result);
  assert.ok(workbook.getWorksheet("Assumptions"));
  const modelSheet = workbook.getWorksheet("Forecast Model");
  assert.ok(modelSheet);
  assert.equal(modelSheet.getCell("A1").value, "Month");
  assert.equal(modelSheet.getCell("B1").value, "Revenue");
  assert.equal(modelSheet.getCell("A2").value, 1);
  assert.equal(Number(modelSheet.getCell("B2").value), 100000);
  assert.ok(modelSheet.getCell("B3").value && modelSheet.getCell("B3").value.formula);
  assert.equal(result.fileName, "Forecast-Model.xlsx");
});

test("generateXlsxBuffer auto-selects report, simple, and template tiers", async () => {
  const reportResult = await generateXlsxBuffer({
    report_meta: { title: "Auto Report Workbook" },
    executive_summary: ["Auto mode report"],
  });
  const reportWorkbook = await readWorkbook(reportResult);
  assert.ok(reportWorkbook.getWorksheet("Executive Summary"));

  const simpleResult = await generateXlsxBuffer({
    title: "Auto Simple Workbook",
    rows: [
      { metric: "Revenue", value: "120000" },
      { metric: "Margin", value: "42%" },
    ],
  });
  const simpleWorkbook = await readWorkbook(simpleResult);
  assert.ok(simpleWorkbook.getWorksheet("Sheet1"));
  assert.equal(simpleWorkbook.getWorksheet("Sheet1").getCell("A1").value, "metric");

  const templateResult = await generateXlsxBuffer({
    title: "Auto Template Workbook",
    template: "tracker",
    rows: [
      { Task: "Deploy", Assignee: "Ops", Status: "In Progress", Priority: "High", "Due Date": "2026-04-10", Notes: "Monitor payout" },
    ],
  });
  const templateWorkbook = await readWorkbook(templateResult);
  assert.ok(templateWorkbook.getWorksheet("Auto Template Workbook"));
});
