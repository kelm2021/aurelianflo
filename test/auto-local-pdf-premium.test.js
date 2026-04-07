const assert = require("node:assert/strict");
const test = require("node:test");
const zlib = require("node:zlib");

const {
  generateChromiumHtmlPdfBuffer,
  generateHtmlPdfBuffer,
  generateReportPdfBuffer,
  resolveChromiumPackLocation,
} = require("../routes/auto-local/pdf-generators");

function extractPdfText(buffer) {
  const source = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || "");
  const matches = [];
  const text = source.toString("latin1");
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;

  while ((match = streamPattern.exec(text)) !== null) {
    const chunk = Buffer.from(match[1], "latin1");
    try {
      matches.push(zlib.inflateSync(chunk).toString("latin1"));
      continue;
    } catch {}
    matches.push(chunk.toString("latin1"));
  }

  matches.push(text);
  return matches
    .join("\n")
    .replace(/\[([\s\S]*?)\]\s*TJ/g, (_full, content) => {
      const parts = [];
      content.replace(/<([0-9A-Fa-f]+)>|\(((?:\\.|[^\\)])*)\)/g, (_token, hex, literal) => {
        if (hex) {
          parts.push(Buffer.from(hex, "hex").toString("latin1"));
        } else if (literal) {
          parts.push(literal.replace(/\\([\\()])/g, "$1"));
        }
        return "";
      });
      return parts.join("");
    })
    .replace(/\(((?:\\.|[^\\)])*)\)\s*Tj/g, (_full, literal) => literal.replace(/\\([\\()])/g, "$1"))
    .replace(/\\([\\()])/g, "$1");
}

test("generateChromiumHtmlPdfBuffer uses a chromium adapter when provided", async () => {
  const calls = [];
  const result = await generateChromiumHtmlPdfBuffer(
    {
      html: "<html><body><h1>Native HTML Surface</h1><p>Strong table styling path.</p></body></html>",
      pageSize: "A4",
    },
    {
      chromiumAdapter: {
        async renderHtmlToPdfBuffer(input) {
          calls.push(input);
          return Buffer.from("%PDF-1.7\n%chromium-lane\n", "latin1");
        },
      },
      disableRuntimeChromium: true,
    },
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0].html, /Native HTML Surface/);
  assert.equal(result.engine, "chromium");
  assert.equal(result.fileName, "document.pdf");
  assert.ok(Buffer.isBuffer(result.buffer));
  assert.match(result.buffer.toString("latin1"), /^%PDF/);
});

test("generateChromiumHtmlPdfBuffer falls back to semantic HTML lane when chromium is unavailable", async () => {
  const result = await generateChromiumHtmlPdfBuffer(
    {
      html: "<html><body><h1>Fallback Render</h1><p><strong>Premium</strong> simple lane remains.</p></body></html>",
    },
    {
      disableRuntimeChromium: true,
    },
  );

  assert.equal(result.engine, "semantic");
  assert.equal(result.fileName, "document.pdf");
  assert.ok(Buffer.isBuffer(result.buffer));
  assert.match(result.buffer.toString("latin1"), /^%PDF/);
  const text = extractPdfText(result.buffer);
  assert.match(text, /Fallback Render/);
  assert.match(text, /Premium/);
  assert.doesNotMatch(text, /<strong>/);
});

test("generateHtmlPdfBuffer remains the premium-simple semantic renderer", async () => {
  const result = await generateHtmlPdfBuffer({
    html: "<html><body><h1>Simple Lane</h1><ul><li>One</li><li>Two</li></ul></body></html>",
  });

  assert.equal(result.fileName, "document.pdf");
  assert.ok(Buffer.isBuffer(result.buffer));
  assert.match(result.buffer.toString("latin1"), /^%PDF/);
  const text = extractPdfText(result.buffer);
  assert.match(text, /Simple Lane/);
  assert.match(text, /One/);
  assert.match(text, /Two/);
  assert.doesNotMatch(text, /<ul>|<li>/);
});

test("resolveChromiumPackLocation returns the hosted pack for chromium-min", () => {
  const location = resolveChromiumPackLocation({ packageName: "@sparticuz/chromium-min" });
  assert.match(location, /chromium-v143\.0\.0-pack\.x64\.tar$/);
});

test("generateReportPdfBuffer uses a compliance layout for OFAC wallet screening reports", async () => {
  const result = await generateReportPdfBuffer({
    title: "OFAC Wallet Screening Report",
    executiveSummary: [
      "Exact OFAC SDN digital currency address match found for the screened wallet.",
      "Hold funds movement until a compliance reviewer clears the address.",
    ],
    headlineMetrics: [
      { label: "Screening status", value: "match", unit: "label" },
      { label: "Match count", value: 1, unit: "count" },
      { label: "Manual review recommended", value: "Yes", unit: "boolean" },
    ],
    tables: [
      {
        heading: "Wallet Screening Query",
        columns: [
          "address",
          "normalized_address",
          "asset_filter",
          "status",
          "exact_address_match",
          "manual_review_recommended",
        ],
        rows: [
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
        columns: [
          "screened_address",
          "status",
          "entity_name",
          "asset",
          "sanctioned_address",
          "list_name",
          "programs",
          "listed_on",
        ],
        rows: [
          {
            screened_address: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
            status: "match",
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
        columns: [
          "source_url",
          "refreshed_at",
          "dataset_published_at",
          "address_count",
          "covered_assets",
        ],
        rows: [
          {
            source_url: "https://www.treasury.gov/ofac/downloads/sanctions/1.0/sdn_advanced.xml",
            refreshed_at: "2026-04-06T18:21:19.631Z",
            dataset_published_at: "2026-04-03T14:17:12.000Z",
            address_count: 772,
            covered_assets: "ARB, BCH, BSC, ETH, USDC, USDT, XBT, XMR, XRP, ZEC",
          },
        ],
      },
    ],
    metadata: {
      report_type: "ofac-wallet-screening",
      author: "AurelianFlo",
      date: "2026-04-06T18:21:19.631Z",
    },
  });

  const text = extractPdfText(result.buffer);
  assert.match(text, /Screening Decision/);
  assert.match(text, /Disposition/);
  assert.match(text, /Wallet Reviewed/);
  assert.match(text, /Lazarus Group/);
  assert.match(text, /Dataset Freshness/);
  assert.doesNotMatch(text, /Headline Metrics/);
});
