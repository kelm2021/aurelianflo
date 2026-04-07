const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildBatchScreeningResponse,
  buildScreeningResponse,
  extractWalletDatasetFromXml,
  normalizeWalletAddress,
  screenWalletAddressesBatch,
  screenWalletAddress,
} = require("../lib/ofac");
const { OFAC_WALLET_XML } = require("./fixtures/ofac-wallet-xml");

test("extractWalletDatasetFromXml builds an exact-match address dataset from OFAC XML", () => {
  const dataset = extractWalletDatasetFromXml(OFAC_WALLET_XML);

  assert.equal(dataset.addressCount, 2);
  assert.deepEqual(dataset.coveredAssets, ["ETH", "XBT"]);
  assert.equal(dataset.entries[0].entityName, "Lazarus Group");
  assert.deepEqual(dataset.entries[0].aliases, ["Hidden Cobra"]);
  assert.deepEqual(dataset.entries[0].programs, ["DPRK3"]);
  assert.deepEqual(dataset.entries[0].measures, ["Block", "Program"]);
  assert.equal(dataset.entries[0].listName, "SDN List");
  assert.equal(dataset.entries[0].listedOn, "2019-09-13");
});

test("normalizeWalletAddress lowercases hex addresses but preserves case-sensitive formats", () => {
  assert.equal(
    normalizeWalletAddress("  0x098B716B8Aaf21512996dC57EB0615e2383E2f96  "),
    "0x098b716b8aaf21512996dc57eb0615e2383e2f96",
  );
  assert.equal(
    normalizeWalletAddress("1BoatSLRHtKNngkdXEeobR76b53LETtpyT"),
    "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
  );
});

test("screenWalletAddress performs exact matching with optional asset filtering", () => {
  const dataset = extractWalletDatasetFromXml(OFAC_WALLET_XML);

  const hit = screenWalletAddress(dataset, {
    address: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
  });
  assert.equal(hit.summary.status, "match");
  assert.equal(hit.summary.matchCount, 1);
  assert.equal(hit.summary.manualReviewRecommended, true);
  assert.equal(hit.matches[0].asset, "ETH");
  assert.equal(hit.matches[0].entityName, "Lazarus Group");

  const filteredClear = screenWalletAddress(dataset, {
    address: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
    asset: "XBT",
  });
  assert.equal(filteredClear.summary.status, "clear");
  assert.equal(filteredClear.summary.matchCount, 0);
  assert.equal(filteredClear.summary.manualReviewRecommended, false);
});

test("buildScreeningResponse returns a wallet-screening payload that is usable directly or in reports", () => {
  const dataset = extractWalletDatasetFromXml(OFAC_WALLET_XML);
  const screening = screenWalletAddress(dataset, {
    address: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
  });

  const response = buildScreeningResponse(screening, {
    sourceUrl: "https://www.treasury.gov/ofac/downloads/sanctions/1.0/sdn_advanced.xml",
    refreshedAt: "2026-04-06T02:00:00.000Z",
    datasetPublishedAt: "2026-04-06T02:00:00.000Z",
    addressCount: dataset.addressCount,
    coveredAssets: dataset.coveredAssets,
  });

  assert.equal(response.success, true);
  assert.equal(response.data.query.address, "1BoatSLRHtKNngkdXEeobR76b53LETtpyT");
  assert.equal(response.data.summary.status, "match");
  assert.equal(response.data.matches[0].entityName, "Example Mixer");
  assert.equal(response.data.sourceFreshness.addressCount, 2);
  assert.deepEqual(response.data.sourceFreshness.coveredAssets, ["ETH", "XBT"]);
  assert.equal(response.data.screeningOnly, true);
  assert.match(response.data.note, /wallet address/i);
  assert.equal(response.report.report_meta.report_type, "ofac-wallet-screening");
  assert.match(response.report.report_meta.title, /OFAC Wallet Screening Report/i);
  assert.equal(response.report.headline_metrics[0].label, "Screening status");
  assert.equal(response.report.headline_metrics[0].value, "match");
  assert.equal(response.report.headline_metrics[1].label, "Match count");
  assert.equal(response.report.headline_metrics[1].value, 1);
  assert.deepEqual(response.report.tables.wallet_screening_query.columns, [
    "address",
    "normalized_address",
    "asset_filter",
    "status",
    "exact_address_match",
    "manual_review_recommended",
  ]);
  assert.equal(
    response.report.tables.wallet_screening_matches.rows[0].entity_name,
    "Example Mixer",
  );
  assert.equal(
    response.report.tables.wallet_screening_matches.rows[0].screened_address,
    "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
  );
  assert.equal(
    response.report.tables.source_freshness.rows[0].dataset_published_at,
    "2026-04-06T02:00:00.000Z",
  );
  assert.equal(
    response.report.export_artifacts.recommended_local_path,
    "outputs/ofac-wallet-screen-1boatslrhtknngkdxeeobr76b53lettpyt",
  );
  assert.equal(response.artifacts.pdf.endpoint, "/api/tools/report/pdf/generate");
  assert.equal(response.artifacts.docx.endpoint, "/api/tools/report/docx/generate");
  assert.equal(
    response.artifacts.pdf.recommended_local_path,
    "outputs/ofac-wallet-screen-1boatslrhtknngkdxeeobr76b53lettpyt.pdf",
  );
  assert.equal(
    response.artifacts.docx.recommended_local_path,
    "outputs/ofac-wallet-screen-1boatslrhtknngkdxeeobr76b53lettpyt.docx",
  );
});

test("screenWalletAddressesBatch aggregates wallet decisions into a batch summary", () => {
  const dataset = extractWalletDatasetFromXml(OFAC_WALLET_XML);

  const batch = screenWalletAddressesBatch(dataset, {
    addresses: [
      "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
      "0x1111111111111111111111111111111111111111",
    ],
    asset: "ETH",
  });

  assert.equal(batch.summary.totalScreened, 2);
  assert.equal(batch.summary.matchCount, 1);
  assert.equal(batch.summary.clearCount, 1);
  assert.equal(batch.summary.manualReviewRecommended, true);
  assert.equal(batch.summary.workflowStatus, "manual_review_required");
  assert.equal(batch.results[0].summary.status, "match");
  assert.equal(batch.results[1].summary.status, "clear");
});

test("buildBatchScreeningResponse returns a report-ready payload with artifact hints", () => {
  const dataset = extractWalletDatasetFromXml(OFAC_WALLET_XML);
  const batch = screenWalletAddressesBatch(dataset, {
    addresses: [
      "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
      "0x1111111111111111111111111111111111111111",
    ],
    asset: "ETH",
  });

  const response = buildBatchScreeningResponse(batch, {
    sourceUrl: "https://www.treasury.gov/ofac/downloads/sanctions/1.0/sdn_advanced.xml",
    refreshedAt: "2026-04-06T02:00:00.000Z",
    datasetPublishedAt: "2026-04-06T02:00:00.000Z",
    addressCount: dataset.addressCount,
    coveredAssets: dataset.coveredAssets,
  });

  assert.equal(response.success, true);
  assert.equal(response.data.summary.totalScreened, 2);
  assert.equal(response.data.summary.matchCount, 1);
  assert.equal(response.data.summary.workflowStatus, "manual_review_required");
  assert.equal(response.report.report_meta.report_type, "ofac-wallet-screening-batch");
  assert.equal(response.report.headline_metrics[0].label, "Total screened");
  assert.equal(response.report.headline_metrics[0].value, 2);
  assert.equal(response.report.tables.batch_wallet_results.rows.length, 2);
  assert.equal(response.artifacts.pdf.endpoint, "/api/tools/report/pdf/generate");
  assert.equal(response.artifacts.docx.endpoint, "/api/tools/report/docx/generate");
});
