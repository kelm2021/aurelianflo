const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_ORIGIN_TITLE,
  DESCRIPTION_SHORT,
  DESCRIPTION_MEDIUM,
  DESCRIPTION_FULL,
  HEALTH_PAGE_LEDE,
  CATALOG_PAGE_LEDE,
  PRIMARY_NAV_ITEMS,
  HOME_PAGE_AUDIENCE,
  HOME_PAGE_VALUE_PROP,
  JARGON_REPLACEMENTS,
} = require("../lib/aurelianflo-profile");

test("aurelianflo profile exports canonical descriptions and buyer-facing copy", () => {
  assert.equal(DEFAULT_ORIGIN_TITLE, "AurelianFlo");
  assert.equal(DESCRIPTION_SHORT, "Enhanced due diligence memos and wallet screening for AI agents.");
  assert.match(DESCRIPTION_MEDIUM, /EDD memos/i);
  assert.match(DESCRIPTION_MEDIUM, /OFAC wallet screening/i);
  assert.match(DESCRIPTION_FULL, /pay-per-call API/i);
  assert.match(DESCRIPTION_FULL, /USDC via x402/i);
  assert.match(HEALTH_PAGE_LEDE, /EDD memos/i);
  assert.match(CATALOG_PAGE_LEDE, /wallet screening/i);
  assert.match(HOME_PAGE_AUDIENCE, /compliance teams|fintech operators|AI agents/i);
  assert.match(HOME_PAGE_VALUE_PROP, /screening, memo, and rendering tools/i);
});

test("aurelianflo profile removes stale marketing jargon from exported ledes and nav", () => {
  assert.doesNotMatch(HEALTH_PAGE_LEDE, /onchain compliance/i);
  assert.doesNotMatch(HEALTH_PAGE_LEDE, /premium reporting/i);
  assert.doesNotMatch(CATALOG_PAGE_LEDE, /premium document output/i);
  assert.doesNotMatch(DESCRIPTION_FULL, /workflow-safe/i);
  assert.doesNotMatch(DESCRIPTION_FULL, /premium/i);
  assert.ok(Array.isArray(PRIMARY_NAV_ITEMS));
  assert.ok(!PRIMARY_NAV_ITEMS.some((item) => String(item?.label || "").trim() === "App"));
  assert.equal(JARGON_REPLACEMENTS.workflowSafe, "status labels for compliance review pipelines");
  assert.equal(JARGON_REPLACEMENTS.workbookReady, "structured tables compatible with Excel and Sheets");
  assert.equal(JARGON_REPLACEMENTS.premium, "formatted");
  assert.equal(JARGON_REPLACEMENTS.onchainCompliance, "blockchain wallet compliance");
});
