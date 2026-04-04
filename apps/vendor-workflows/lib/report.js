const {
  buildStructuredReport,
  createAssumptionsTable,
  createHeadlineMetric,
  createTable,
} = require("../../../lib/report-builder");
const { buildRecommendedLocalPath } = require("./artifact-path");

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toObject(value) {
  return isPlainObject(value) ? value : {};
}

function readString(value, fallback = "") {
  if (value == null) {
    return fallback;
  }
  return String(value);
}

function toVendorRows(vendors) {
  const list = Array.isArray(vendors) ? vendors : [];
  return list.map((entry, index) => ({
    rank: entry.rank ?? index + 1,
    name: readString(entry.name || entry.vendor || "", ""),
    country: readString(entry.country || "", ""),
    risk_tier: readString(entry.risk_tier || "", ""),
    risk_score: entry.risk_score ?? "",
    recommended_action: readString(entry.recommended_action || "", ""),
    manual_review_required: entry.manual_review_required ?? "",
  }));
}

function buildVendorRiskForecastReport(workflowResult) {
  const payload = toObject(workflowResult);
  const workflowMeta = toObject(payload.workflow_meta);
  const summary = toObject(payload.summary);
  const diagnostics = toObject(payload.diagnostics);
  const assumptions = Array.isArray(payload.assumptions) ? payload.assumptions : [];
  const vendors = toVendorRows(payload.vendors);
  const asOfDate = readString(workflowMeta.as_of_date, "undated");

  return buildStructuredReport({
    reportMeta: {
      report_type: "vendor-risk-assessment",
      title: "Vendor Risk Assessment",
      author: "AurelianFlo",
      workflow: readString(workflowMeta.workflow, "vendor.risk_assessment"),
      as_of_date: asOfDate,
      model_version: readString(workflowMeta.model_version, ""),
      mode: readString(workflowMeta.mode, ""),
    },
    executiveSummary: assumptions.length > 0
      ? assumptions
      : [
          `Workflow status: ${readString(summary.status, "unknown")}.`,
          `Recommended action: ${readString(summary.recommended_action, "review")}.`,
        ],
    headlineMetrics: [
      createHeadlineMetric("Risk tier", readString(summary.risk_tier, ""), "label"),
      createHeadlineMetric("Recommended action", readString(summary.recommended_action, ""), "action"),
      createHeadlineMetric("Vendors processed", diagnostics.vendors_processed ?? vendors.length, "count"),
    ],
    tables: {
      vendor_ranking: createTable(
        ["rank", "name", "country", "risk_tier", "risk_score", "recommended_action", "manual_review_required"],
        vendors,
      ),
      assumptions: createAssumptionsTable(
        assumptions.map((entry, index) => ({
          field: `assumption_${index + 1}`,
          value: readString(entry, ""),
        })),
      ),
    },
    exportArtifacts: {
      recommended_local_path: buildRecommendedLocalPath(
        readString(toObject(payload.export_artifacts).recommended_local_path, ""),
        "xlsx",
        `vendor-risk-assessment-${asOfDate}.xlsx`,
      ),
    },
    result: payload,
  });
}

module.exports = {
  buildVendorRiskForecastReport,
};
