const AURELIANFLO_ALLOWED_ROUTE_KEYS = [
  "GET /api/ofac-wallet-screen/:address",
  "POST /api/workflows/compliance/wallet-sanctions-report",
  "POST /api/workflows/compliance/batch-wallet-screen",
  "POST /api/workflows/compliance/edd-report",
  "POST /api/sim/probability",
  "POST /api/sim/batch-probability",
  "POST /api/sim/compare",
  "POST /api/sim/sensitivity",
  "POST /api/sim/forecast",
  "POST /api/sim/composed",
  "POST /api/sim/optimize",
  "POST /api/sim/report",
  "POST /api/tools/report/generate",
  "POST /api/tools/report/pdf/generate",
  "POST /api/tools/report/docx/generate",
  "POST /api/tools/report/xlsx/generate",
  "POST /api/tools/pdf/render-html",
  "POST /api/tools/docx/render-template",
  "POST /api/tools/xlsx/render-template",
  "POST /api/tools/pdf/generate",
  "POST /api/tools/docx/generate",
  "POST /api/tools/xlsx/generate",
];

const AURELIANFLO_RETAINED_SECONDARY_ROUTE_KEYS = [
  "POST /api/sim/probability",
  "POST /api/sim/batch-probability",
  "POST /api/sim/compare",
  "POST /api/sim/sensitivity",
  "POST /api/sim/forecast",
  "POST /api/sim/composed",
  "POST /api/sim/optimize",
  "POST /api/sim/report",
];

const PUBLIC_CORE_DISCOVERY_ROUTE_KEYS = [
  "POST /api/workflows/compliance/edd-report",
  "POST /api/workflows/compliance/batch-wallet-screen",
  "GET /api/ofac-wallet-screen/:address",
  "POST /api/workflows/compliance/wallet-sanctions-report",
  "POST /api/tools/report/generate",
  "POST /api/tools/report/pdf/generate",
  "POST /api/tools/report/docx/generate",
  "POST /api/tools/report/xlsx/generate",
];

const WELL_KNOWN_DESCRIPTION =
  "AurelianFlo is a pay-per-call API for EDD memos, OFAC wallet screening, and PDF, DOCX, and XLSX document generation over x402.";

const WELL_KNOWN_INSTRUCTIONS = [
  "# AurelianFlo",
  "",
  "AurelianFlo is a pay-per-call API for AI agents and operations teams that need enhanced due diligence memos, OFAC wallet screening, and formatted document output.",
  "",
  "## Primary Surface",
  "- EDD memos for counterparty and wallet review workflows",
  "- Batch and single-wallet OFAC screening",
  "- Report PDF, DOCX, and XLSX output for audit handoff",
  "",
  "## Additional Surface",
  "- Monte Carlo decision and simulation routes remain available for modeling workflows",
  "- The primary discovery surfaces stay compliance-first",
  "",
  "## Payment",
  "USDC on Base via x402. Paid endpoints return `402 Payment Required` with machine-readable settlement instructions until payment is attached.",
  "",
  "## Discovery",
  "Use `GET /api` for the buyer-facing catalog.",
].join("\n");

function buildAllowedRouteKeySet() {
  return new Set(AURELIANFLO_ALLOWED_ROUTE_KEYS);
}

function buildPublicCoreRouteKeySet() {
  return new Set(PUBLIC_CORE_DISCOVERY_ROUTE_KEYS);
}

function isAllowedAurelianFloRouteKey(routeKey) {
  return buildAllowedRouteKeySet().has(String(routeKey || ""));
}

function isPublicCoreDiscoveryRouteKey(routeKey) {
  return buildPublicCoreRouteKeySet().has(String(routeKey || ""));
}

module.exports = {
  AURELIANFLO_ALLOWED_ROUTE_KEYS,
  AURELIANFLO_RETAINED_SECONDARY_ROUTE_KEYS,
  PUBLIC_CORE_DISCOVERY_ROUTE_KEYS,
  WELL_KNOWN_DESCRIPTION,
  WELL_KNOWN_INSTRUCTIONS,
  buildAllowedRouteKeySet,
  buildPublicCoreRouteKeySet,
  isAllowedAurelianFloRouteKey,
  isPublicCoreDiscoveryRouteKey,
};
