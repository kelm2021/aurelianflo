const assert = require("node:assert/strict");
const test = require("node:test");
const JSZip = require("jszip");

const {
  generateDocxBuffer,
  generateDocxFromTemplate,
  generatePremiumReportDocxBuffer,
  generatePremiumSimpleDocxBuffer,
  generateTemplateDocxBuffer,
  normalizeDocxPayload,
} = require("../routes/auto-local/docx-generator");

async function readDocumentXml(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file("word/document.xml");
  assert.ok(entry, "missing word/document.xml");
  return entry.async("string");
}

test("normalizeDocxPayload infers content sections for markdown and plain strings", () => {
  const normalized = normalizeDocxPayload({
    title: "Simple Input",
    format: "markdown",
    content: "# Heading\n\n- One\n- Two",
    sections: ["Inline note"],
  });

  assert.equal(normalized.title, "Simple Input");
  assert.equal(normalized.template, "general");
  assert.equal(Array.isArray(normalized.sections), true);
  assert.equal(normalized.sections.length > 0, true);
  assert.equal(normalized.sections.some((section) => String(section.body || "").includes("Inline note")), true);
});

test("generatePremiumReportDocxBuffer renders report metadata and table content", async () => {
  const { buffer, fileName } = await generatePremiumReportDocxBuffer({
    title: "Vendor Risk Report",
    metadata: { author: "AurelianFlo", date: "2026-04-05", version: "v2.1" },
    sections: [
      {
        heading: "Executive Summary",
        bullets: ["Two vendors need review", "One vendor cleared"],
      },
      {
        heading: "Vendors",
        table: [
          { name: "SBERBANK", risk: "critical" },
          { name: "Example Co", risk: "low" },
        ],
      },
    ],
  });

  assert.equal(fileName, "Vendor-Risk-Report.docx");
  const xml = await readDocumentXml(buffer);
  assert.match(xml, /Vendor Risk Report/);
  assert.match(xml, /Author: AurelianFlo/);
  assert.match(xml, /Date: 2026-04-05/);
  assert.match(xml, /Version: v2.1/);
  assert.match(xml, /SBERBANK/);
  assert.match(xml, /Example Co/);
});

test("generatePremiumSimpleDocxBuffer accepts direct markdown content without raw markdown markers", async () => {
  const { buffer } = await generatePremiumSimpleDocxBuffer({
    title: "Simple Markdown",
    format: "markdown",
    content: "# Launch Plan\n\nUse **premium** docs with `route` support.\n\n- Step one\n- Step two",
  });

  const xml = await readDocumentXml(buffer);
  assert.match(xml, /Simple Markdown/);
  assert.match(xml, /Launch Plan/);
  assert.match(xml, /Use premium docs with route support\./);
  assert.match(xml, /Step one/);
  assert.match(xml, /Step two/);
  assert.doesNotMatch(xml, /\*\*premium\*\*/);
  assert.doesNotMatch(xml, /`route`/);
});

test("generatePremiumSimpleDocxBuffer accepts direct HTML content and strips tags", async () => {
  const { buffer } = await generatePremiumSimpleDocxBuffer({
    title: "Simple HTML",
    format: "html",
    content: "<h1>Status</h1><p>All systems nominal.</p><ul><li>API healthy</li><li>Docs healthy</li></ul>",
  });

  const xml = await readDocumentXml(buffer);
  assert.match(xml, /Simple HTML/);
  assert.match(xml, /Status/);
  assert.match(xml, /All systems nominal\./);
  assert.match(xml, /API healthy/);
  assert.match(xml, /Docs healthy/);
  assert.doesNotMatch(xml, /<h1>|<li>|<p>/);
});

test("generateTemplateDocxBuffer requires non-general template", async () => {
  await assert.rejects(
    () => generateTemplateDocxBuffer({ title: "Invalid Template", template: "general" }),
    /non-general template/i,
  );
});

test("generateDocxFromTemplate renders max-fidelity template path with NDA clauses", async () => {
  const { buffer, fileName } = await generateDocxFromTemplate("nda", {
    title: "Mutual NDA",
    parties: {
      party_a: { name: "Acme Labs" },
      party_b: { name: "Beta Ventures" },
      effective_date: "2026-04-05",
    },
    company: { state: "Texas" },
  });

  assert.equal(fileName, "Mutual-NDA.docx");
  const xml = await readDocumentXml(buffer);
  assert.match(xml, /Definition of Confidential Information/);
  assert.match(xml, /Acme Labs/);
  assert.match(xml, /Beta Ventures/);
  assert.match(xml, /State of Texas/);
});

test("generateDocxBuffer remains backward compatible for report template payloads", async () => {
  const { buffer } = await generateDocxBuffer({
    title: "Compatibility Report",
    template: "report",
    sections: [{ heading: "Summary", body: "Still works." }],
  });

  const xml = await readDocumentXml(buffer);
  assert.match(xml, /Compatibility Report/);
  assert.match(xml, /Still works\./);
});

test("generatePremiumReportDocxBuffer uses a compliance layout for OFAC wallet screening reports", async () => {
  const { buffer } = await generatePremiumReportDocxBuffer({
    title: "OFAC Wallet Screening Report",
    metadata: {
      author: "AurelianFlo",
      date: "2026-04-06T18:21:19.631Z",
      report_type: "ofac-wallet-screening",
    },
    sections: [
      {
        heading: "Executive Summary",
        bullets: [
          "Exact OFAC SDN digital currency address match found for the screened wallet.",
          "Hold funds movement until a compliance reviewer clears the address.",
        ],
      },
      {
        heading: "Headline Metrics",
        table: [
          { label: "Screening status", value: "match", unit: "label" },
          { label: "Match count", value: "1", unit: "count" },
          { label: "Manual review recommended", value: "Yes", unit: "boolean" },
        ],
      },
      {
        heading: "Wallet Screening Query",
        table: [
          {
            address: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
            normalized_address: "0x098b716b8aaf21512996dc57eb0615e2383e2f96",
            asset_filter: "ETH",
            status: "match",
            exact_address_match: true,
            manual_review_recommended: true,
          },
        ],
      },
      {
        heading: "Wallet Screening Matches",
        table: [
          {
            entity_name: "Lazarus Group",
            asset: "ETH",
            sanctioned_address: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
            list_name: "SDN List",
            programs: "DPRK3",
            listed_on: "2019-09-13",
          },
        ],
      },
      {
        heading: "Source Freshness",
        table: [
          {
            source_url: "https://www.treasury.gov/ofac/downloads/sanctions/1.0/sdn_advanced.xml",
            refreshed_at: "2026-04-06T18:21:19.631Z",
            dataset_published_at: "2026-04-03T14:17:12.000Z",
            address_count: 772,
          },
        ],
      },
    ],
  });

  const xml = await readDocumentXml(buffer);
  assert.match(xml, /Screening Decision/);
  assert.match(xml, /Disposition/);
  assert.match(xml, /Wallet Reviewed/);
  assert.match(xml, /Lazarus Group/);
  assert.match(xml, /Dataset Freshness/);
  assert.doesNotMatch(xml, /Headline Metrics/);
});
