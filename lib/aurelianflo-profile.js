const DEFAULT_ORIGIN_TITLE = "AurelianFlo";

const DESCRIPTION_SHORT =
  "Enhanced due diligence memos and wallet screening for AI agents.";

const DESCRIPTION_MEDIUM =
  "EDD memos, OFAC wallet screening, and PDF/DOCX/XLSX document output for AI agents.";

const DESCRIPTION_FULL =
  "AurelianFlo is a pay-per-call API for enhanced due diligence memos, OFAC wallet screening, and audit-ready document output (PDF, DOCX, XLSX). Built for compliance teams, fintech operators, and AI agents. No API keys. Paid in USDC via x402.";

const HEALTH_PAGE_LEDE =
  "EDD memos, OFAC wallet screening, and audit-ready document output for AI agents.";

const CATALOG_PAGE_LEDE =
  "Enhanced due diligence memos, wallet screening, and formatted document output.";

const HOME_PAGE_AUDIENCE =
  "Built for compliance teams, fintech operators, and AI agents that need wallet screening and review-ready diligence output in automated workflows.";

const HOME_PAGE_VALUE_PROP =
  "Use one paid API surface for EDD memos, wallet screening, and document output instead of stitching together screening, memo, and rendering tools.";

const PRIMARY_NAV_ITEMS = [
  { label: "Catalog", href: "catalog", variant: "primary" },
  { label: "OpenAPI", href: "openapi", variant: "secondary" },
];

const JARGON_REPLACEMENTS = {
  workflowSafe: "status labels for compliance review pipelines",
  workbookReady: "structured tables compatible with Excel and Sheets",
  premium: "formatted",
  onchainCompliance: "blockchain wallet compliance",
};

module.exports = {
  DEFAULT_ORIGIN_TITLE,
  DESCRIPTION_SHORT,
  DESCRIPTION_MEDIUM,
  DESCRIPTION_FULL,
  HEALTH_PAGE_LEDE,
  CATALOG_PAGE_LEDE,
  HOME_PAGE_AUDIENCE,
  HOME_PAGE_VALUE_PROP,
  PRIMARY_NAV_ITEMS,
  JARGON_REPLACEMENTS,
};
