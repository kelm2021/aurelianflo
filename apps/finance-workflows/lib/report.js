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

function buildCashRunwayForecastReport(workflowResult) {
  const payload = toObject(workflowResult);
  const workflowMeta = toObject(payload.workflow_meta);
  const summary = toObject(payload.summary);
  const diagnostics = toObject(payload.diagnostics);
  const timeline = Array.isArray(payload.timeline) ? payload.timeline : [];
  const assumptions = Array.isArray(payload.assumptions) ? payload.assumptions : [];
  const asOfDate = readString(workflowMeta.as_of_date, "undated");

  return buildStructuredReport({
    reportMeta: {
      report_type: "finance-cash-runway-forecast",
      title: "Cash Runway Forecast",
      author: "AurelianFlo",
      workflow: readString(workflowMeta.workflow, "finance.cash_runway_forecast"),
      as_of_date: asOfDate,
      model_version: readString(workflowMeta.model_version, ""),
      mode: readString(workflowMeta.mode, ""),
    },
    executiveSummary: assumptions.length > 0
      ? assumptions
      : [
          `Runway status: ${readString(summary.runway_status, "unknown")}.`,
          `Recommended action: ${readString(summary.recommended_action, "review")}.`,
        ],
    headlineMetrics: [
      createHeadlineMetric("Median runway (months)", summary.median_runway_months ?? "", "months"),
      createHeadlineMetric(
        "P(run-out <= 12 months)",
        summary.p_run_out_within_12_months ?? "",
        "probability",
      ),
      createHeadlineMetric("Ending cash p50", summary.ending_cash_p50 ?? "", "usd"),
    ],
    tables: {
      timeline: createTable(
        ["month", "ending_cash_p10", "ending_cash_p50", "ending_cash_p90", "p_run_out_by_month"],
        timeline.map((entry) => ({
          month: entry.month,
          ending_cash_p10: entry.ending_cash_p10,
          ending_cash_p50: entry.ending_cash_p50,
          ending_cash_p90: entry.ending_cash_p90,
          p_run_out_by_month: entry.p_run_out_by_month,
        })),
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
        `cash-runway-forecast-${asOfDate}.xlsx`,
      ),
      workbook_rows: {
        summary: [
          { metric: "median_runway_months", value: summary.median_runway_months ?? "" },
          { metric: "expected_runway_months", value: summary.expected_runway_months ?? "" },
          { metric: "p_run_out_within_6_months", value: summary.p_run_out_within_6_months ?? "" },
          { metric: "p_run_out_within_12_months", value: summary.p_run_out_within_12_months ?? "" },
          { metric: "ending_cash_p50", value: summary.ending_cash_p50 ?? "" },
          { metric: "runway_status", value: readString(summary.runway_status, "") },
          { metric: "recommended_action", value: readString(summary.recommended_action, "") },
          { metric: "simulations_run", value: diagnostics.simulations_run ?? "" },
          { metric: "horizon_months", value: diagnostics.horizon_months ?? "" },
          { metric: "seed", value: diagnostics.seed ?? "" },
        ],
      },
    },
    result: payload,
  });
}

function buildPricingScenarioForecastReport(workflowResult) {
  const payload = toObject(workflowResult);
  const workflowMeta = toObject(payload.workflow_meta);
  const summary = toObject(payload.summary);
  const diagnostics = toObject(payload.diagnostics);
  const scenarios = Array.isArray(payload.scenarios) ? payload.scenarios : [];
  const assumptions = Array.isArray(payload.assumptions) ? payload.assumptions : [];
  const asOfDate = readString(workflowMeta.as_of_date, "undated");

  return buildStructuredReport({
    reportMeta: {
      report_type: "finance-pricing-plan-compare",
      title: "Pricing Plan Compare",
      author: "AurelianFlo",
      workflow: readString(workflowMeta.workflow, "finance.pricing_plan_compare"),
      as_of_date: asOfDate,
      model_version: readString(workflowMeta.model_version, ""),
      mode: readString(workflowMeta.mode, ""),
    },
    executiveSummary: assumptions.length > 0
      ? assumptions
      : [
          `Top expected plan: ${readString(summary.best_expected_scenario, "unknown")}.`,
          `Recommendation: ${readString(summary.recommendation, "review options")}.`,
        ],
    headlineMetrics: [
      createHeadlineMetric(
        "Top expected scenario",
        readString(summary.best_expected_scenario, ""),
        "label",
      ),
      createHeadlineMetric(
        "Top expected annual profit",
        summary.best_expected_annual_profit_usd ?? "",
        "usd",
      ),
      createHeadlineMetric(
        "Top probability best",
        summary.best_probability_best ?? "",
        "probability",
      ),
    ],
    tables: {
      scenario_ranking: createTable(
        [
          "rank",
          "label",
          "expected_annual_revenue_usd",
          "expected_annual_gross_profit_usd",
          "expected_annual_profit_usd",
          "probability_best",
          "probability_profitable",
          "uplift_vs_baseline_annual_profit_usd",
        ],
        scenarios.map((entry) => ({
          rank: entry.rank,
          label: readString(entry.label, ""),
          expected_annual_revenue_usd: entry.expected_annual_revenue_usd,
          expected_annual_gross_profit_usd: entry.expected_annual_gross_profit_usd,
          expected_annual_profit_usd: entry.expected_annual_profit_usd,
          probability_best: entry.probability_best,
          probability_profitable: entry.probability_profitable,
          uplift_vs_baseline_annual_profit_usd: entry.uplift_vs_baseline_annual_profit_usd,
        })),
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
        `pricing-plan-compare-${asOfDate}.xlsx`,
      ),
      workbook_rows: {
        summary: [
          { metric: "best_expected_scenario", value: readString(summary.best_expected_scenario, "") },
          { metric: "best_expected_annual_profit_usd", value: summary.best_expected_annual_profit_usd ?? "" },
          { metric: "best_probability_best", value: summary.best_probability_best ?? "" },
          { metric: "baseline_label", value: readString(summary.baseline_label, "") },
          { metric: "baseline_expected_annual_profit_usd", value: summary.baseline_expected_annual_profit_usd ?? "" },
          { metric: "spread_vs_second_best_annual_profit_usd", value: summary.spread_vs_second_best_annual_profit_usd ?? "" },
          { metric: "recommendation", value: readString(summary.recommendation, "") },
          { metric: "simulations_run", value: diagnostics.simulations_run ?? "" },
          { metric: "horizon_months", value: diagnostics.horizon_months ?? "" },
          { metric: "seed", value: diagnostics.seed ?? "" },
        ],
      },
    },
    result: payload,
  });
}

module.exports = {
  buildCashRunwayForecastReport,
  buildPricingScenarioForecastReport,
};
