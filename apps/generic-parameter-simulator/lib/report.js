const {
  buildStructuredReport,
  createAssumptionsTable,
  createChartHint,
  createHeadlineMetric,
  createTable,
} = require("../../../lib/report-builder");
const {
  runBatchProbability,
  runCompare,
  runComposed,
  runForecast,
  runOptimize,
  runSensitivity,
  runSimulation,
} = require("../sim/engine");

const ANALYSIS_TYPES = new Set([
  "probability",
  "batch-probability",
  "compare",
  "sensitivity",
  "forecast",
  "composed",
  "optimize",
]);

const ANALYSIS_RUNNERS = {
  probability: (numSims, request, options) => runSimulation(numSims, request, options),
  "batch-probability": (numSims, request, options) => runBatchProbability(numSims, request, options),
  compare: (numSims, request, options) => runCompare(numSims, request, options),
  sensitivity: (numSims, request, options) => runSensitivity(numSims, request, options),
  forecast: (numSims, request, options) => runForecast(numSims, request, options),
  composed: (numSims, request, options) => runComposed(numSims, request, options),
  optimize: (numSims, request, options) => runOptimize(numSims, request, options),
};

function createError(error, message, details) {
  if (details === undefined) {
    return { error, message };
  }

  return { error, message, details };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function titleCase(value) {
  return String(value || "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatProbability(value) {
  return value == null ? null : Number(value.toFixed(4));
}

function extractModelVersion(result) {
  return (
    result?.simulation_meta?.model_version
    || result?.batch_meta?.model_version
    || result?.comparison_meta?.model_version
    || result?.sensitivity_meta?.model_version
    || result?.forecast_meta?.model_version
    || result?.composed_meta?.model_version
    || result?.optimization_meta?.model_version
    || null
  );
}

function buildAssumptionsRows({ analysisType, numSims, seed, result, summaryFocus }) {
  return [
    { field: "analysis_type", value: analysisType },
    { field: "simulations_run", value: numSims },
    { field: "model_version", value: extractModelVersion(result) },
    { field: "summary_focus", value: summaryFocus },
    { field: "seed", value: seed ?? null },
  ];
}

function buildProbabilitySections(result) {
  return {
    executiveSummary: [
      `Base scenario clears the threshold ${formatProbability(result.outcome_probability)} of the time.`,
      `Median effective margin versus threshold is ${result.risk_metrics?.threshold_gap_p50 ?? null}.`,
      `Calibration currently flags saturation risk as ${result.diagnostics?.saturation_risk ?? "unknown"}.`,
    ],
    headlineMetrics: [
      createHeadlineMetric("Outcome probability", result.outcome_probability, "probability"),
      createHeadlineMetric("Median threshold gap", result.risk_metrics?.threshold_gap_p50 ?? null, "score"),
      createHeadlineMetric("Saturation risk", result.diagnostics?.saturation_risk ?? null, "label"),
    ],
    scenarioSummary: createTable(
      [
        "scenario",
        "outcome_probability",
        "ci_low",
        "ci_high",
        "mean_score",
        "effective_p50",
        "expected_shortfall_05",
        "saturation_risk",
      ],
      [
        {
          scenario: "scenario",
          outcome_probability: result.outcome_probability,
          ci_low: result.confidence_interval_95?.low ?? null,
          ci_high: result.confidence_interval_95?.high ?? null,
          mean_score: result.score_distribution?.mean ?? null,
          effective_p50: result.effective_score_distribution?.p50 ?? null,
          expected_shortfall_05: result.risk_metrics?.expected_shortfall_05 ?? null,
          saturation_risk: result.diagnostics?.saturation_risk ?? null,
        },
      ],
    ),
  };
}

function buildBatchProbabilitySections(result) {
  return {
    executiveSummary: [
      `Batch ranking evaluated ${result.batch_meta?.scenario_count ?? 0} scenarios in one paid call.`,
      `Top-ranked scenario is ${result.ranking?.[0]?.label ?? "unknown"} at probability ${result.ranking?.[0]?.outcome_probability ?? null}.`,
      "Use the scenario summary table directly as an analyst-facing candidate ranking sheet.",
    ],
    headlineMetrics: [
      createHeadlineMetric("Best scenario", result.ranking?.[0]?.label ?? null, "label"),
      createHeadlineMetric("Best probability", result.ranking?.[0]?.outcome_probability ?? null, "probability"),
      createHeadlineMetric("Scenario count", result.batch_meta?.scenario_count ?? null, "count"),
    ],
    scenarioSummary: createTable(
      [
        "rank",
        "label",
        "outcome_probability",
        "mean_score",
        "effective_p50",
        "expected_shortfall_05",
        "saturation_risk",
      ],
      result.ranking.map((rankingEntry) => {
        const scenario = result.scenarios.find((entry) => entry.index === rankingEntry.index);
        return {
          rank: rankingEntry.rank,
          label: rankingEntry.label,
          outcome_probability: rankingEntry.outcome_probability,
          mean_score: rankingEntry.mean_score,
          effective_p50: scenario?.result?.effective_score_distribution?.p50 ?? null,
          expected_shortfall_05: scenario?.result?.risk_metrics?.expected_shortfall_05 ?? null,
          saturation_risk: scenario?.result?.diagnostics?.saturation_risk ?? null,
        };
      }),
    ),
  };
}

function buildCompareSections(result) {
  const baselineLabel = result.comparison_meta?.baseline_label ?? "baseline";
  const candidateLabel = result.comparison_meta?.candidate_label ?? "candidate";

  return {
    executiveSummary: [
      `${candidateLabel} outperforms ${baselineLabel} in ${result.decision_summary?.probability_candidate_outperforms ?? null} of paired draws.`,
      `Expected effective score gap is ${result.decision_summary?.expected_score_gap ?? null}.`,
      `Probability uplift from ${baselineLabel} to ${candidateLabel} is ${result.deltas?.outcome_probability ?? null}.`,
    ],
    headlineMetrics: [
      createHeadlineMetric("Preferred scenario", result.decision_summary?.preferred_scenario ?? null, "label"),
      createHeadlineMetric(
        "Candidate outperformance",
        result.decision_summary?.probability_candidate_outperforms ?? null,
        "probability",
      ),
      createHeadlineMetric("Expected score gap", result.decision_summary?.expected_score_gap ?? null, "score"),
      createHeadlineMetric("Probability uplift", result.deltas?.outcome_probability ?? null, "probability"),
    ],
    scenarioSummary: createTable(
      [
        "scenario",
        "outcome_probability",
        "mean_score",
        "effective_p50",
        "expected_shortfall_05",
        "saturation_risk",
      ],
      [
        {
          scenario: baselineLabel,
          outcome_probability: result.baseline?.outcome_probability ?? null,
          mean_score: result.baseline?.score_distribution?.mean ?? null,
          effective_p50: result.baseline?.effective_score_distribution?.p50 ?? null,
          expected_shortfall_05: result.baseline?.risk_metrics?.expected_shortfall_05 ?? null,
          saturation_risk: result.baseline?.diagnostics?.saturation_risk ?? null,
        },
        {
          scenario: candidateLabel,
          outcome_probability: result.candidate?.outcome_probability ?? null,
          mean_score: result.candidate?.score_distribution?.mean ?? null,
          effective_p50: result.candidate?.effective_score_distribution?.p50 ?? null,
          expected_shortfall_05: result.candidate?.risk_metrics?.expected_shortfall_05 ?? null,
          saturation_risk: result.candidate?.diagnostics?.saturation_risk ?? null,
        },
        {
          scenario: "delta",
          outcome_probability: result.deltas?.outcome_probability ?? null,
          mean_score: result.deltas?.mean_score ?? null,
          effective_p50: result.decision_summary?.expected_score_gap ?? null,
          expected_shortfall_05: null,
          saturation_risk: null,
        },
      ],
    ),
  };
}

function buildSensitivitySections(result) {
  return {
    executiveSummary: [
      `The selected parameter response is ${result.sensitivity?.direction ?? "unknown"}.`,
      `Probability span across the local response curve is ${result.response_curve?.span ?? null}.`,
      `Midpoint elasticity is ${result.sensitivity?.midpoint_elasticity ?? null}.`,
    ],
    headlineMetrics: [
      createHeadlineMetric("Direction", result.sensitivity?.direction ?? null, "label"),
      createHeadlineMetric("Response span", result.response_curve?.span ?? null, "probability"),
      createHeadlineMetric("Midpoint elasticity", result.sensitivity?.midpoint_elasticity ?? null, "ratio"),
    ],
    scenarioSummary: createTable(
      ["variant", "parameter_value", "outcome_probability", "mean_score"],
      [
        {
          variant: "low",
          parameter_value: result.low_variant?.parameter_value ?? null,
          outcome_probability: result.low_variant?.result?.outcome_probability ?? null,
          mean_score: result.low_variant?.result?.score_distribution?.mean ?? null,
        },
        {
          variant: "baseline",
          parameter_value: result.sensitivity_meta?.base_parameter_value ?? null,
          outcome_probability: result.baseline?.outcome_probability ?? null,
          mean_score: result.baseline?.score_distribution?.mean ?? null,
        },
        {
          variant: "high",
          parameter_value: result.high_variant?.parameter_value ?? null,
          outcome_probability: result.high_variant?.result?.outcome_probability ?? null,
          mean_score: result.high_variant?.result?.score_distribution?.mean ?? null,
        },
      ],
    ),
  };
}

function buildForecastSections(result) {
  return {
    executiveSummary: [
      `Forecast begins at ${result.summary?.start_probability ?? null} and ends at ${result.summary?.end_probability ?? null}.`,
      `Net probability change across the horizon is ${result.summary?.net_change ?? null}.`,
      "Timeline rows are shaped to drop directly into a workbook trend tab.",
    ],
    headlineMetrics: [
      createHeadlineMetric("Start probability", result.summary?.start_probability ?? null, "probability"),
      createHeadlineMetric("End probability", result.summary?.end_probability ?? null, "probability"),
      createHeadlineMetric("Net change", result.summary?.net_change ?? null, "probability"),
    ],
    scenarioSummary: createTable(
      ["period", "outcome_probability", "mean_score", "effective_p50", "expected_shortfall_05"],
      result.timeline.map((entry) => ({
        period: entry.period,
        outcome_probability: entry.outcome_probability,
        mean_score: entry.mean_score,
        effective_p50: entry.effective_score_distribution?.p50 ?? null,
        expected_shortfall_05: entry.risk_metrics?.expected_shortfall_05 ?? null,
      })),
    ),
  };
}

function buildComposedSections(result) {
  return {
    executiveSummary: [
      `Weighted composed probability is ${result.composed_outcome?.outcome_probability ?? null}.`,
      `The blend covers ${result.composed_meta?.components ?? 0} components.`,
      "Component rows expose the weighted contribution structure for downstream reporting.",
    ],
    headlineMetrics: [
      createHeadlineMetric("Composed probability", result.composed_outcome?.outcome_probability ?? null, "probability"),
      createHeadlineMetric("Component count", result.composed_meta?.components ?? null, "count"),
      createHeadlineMetric("Mean score", result.composed_outcome?.mean_score ?? null, "score"),
    ],
    scenarioSummary: createTable(
      ["component", "weight", "normalized_weight", "outcome_probability", "mean_score"],
      result.components.map((component) => ({
        component: component.label,
        weight: component.weight,
        normalized_weight: component.normalized_weight,
        outcome_probability: component.result?.outcome_probability ?? null,
        mean_score: component.result?.score_distribution?.mean ?? null,
      })),
    ),
  };
}

function buildOptimizeSections(result) {
  return {
    executiveSummary: [
      `Optimization objective is ${result.optimization_meta?.objective ?? "unknown"}.`,
      `Best candidate improved the objective by ${result.improvement ?? null}.`,
      `Optimum scenario clears at ${result.optimum?.result?.outcome_probability ?? null}.`,
    ],
    headlineMetrics: [
      createHeadlineMetric("Objective", result.optimization_meta?.objective ?? null, "label"),
      createHeadlineMetric("Objective improvement", result.improvement ?? null, "score"),
      createHeadlineMetric("Optimum probability", result.optimum?.result?.outcome_probability ?? null, "probability"),
    ],
    scenarioSummary: createTable(
      ["scenario", "outcome_probability", "mean_score", "objective_value"],
      [
        {
          scenario: "baseline",
          outcome_probability: result.baseline?.result?.outcome_probability ?? null,
          mean_score: result.baseline?.result?.score_distribution?.mean ?? null,
          objective_value: result.optimization_meta?.objective === "mean_score"
            ? result.baseline?.result?.score_distribution?.mean ?? null
            : result.baseline?.result?.outcome_probability ?? null,
        },
        {
          scenario: "optimum",
          outcome_probability: result.optimum?.result?.outcome_probability ?? null,
          mean_score: result.optimum?.result?.score_distribution?.mean ?? null,
          objective_value: result.optimum?.objective_value ?? null,
        },
      ],
    ),
  };
}

function buildSimulationSections(analysisType, result) {
  if (analysisType === "probability") {
    return buildProbabilitySections(result);
  }

  if (analysisType === "batch-probability") {
    return buildBatchProbabilitySections(result);
  }

  if (analysisType === "compare") {
    return buildCompareSections(result);
  }

  if (analysisType === "sensitivity") {
    return buildSensitivitySections(result);
  }

  if (analysisType === "forecast") {
    return buildForecastSections(result);
  }

  if (analysisType === "composed") {
    return buildComposedSections(result);
  }

  return buildOptimizeSections(result);
}

function normalizeTitle(payload, analysisType) {
  if (typeof payload.title === "string" && payload.title.trim() !== "") {
    return payload.title.trim();
  }

  return `${titleCase(analysisType)} simulation report`;
}

function normalizeSummaryFocus(payload) {
  if (typeof payload.summary_focus === "string" && payload.summary_focus.trim() !== "") {
    return payload.summary_focus.trim().toLowerCase();
  }

  return "decision";
}

function runSimulationReport(numSims, payload, options = {}) {
  if (!isPlainObject(payload)) {
    return createError("invalid_report_request", "request body must be an object");
  }

  const allowedKeys = new Set(["analysis_type", "title", "summary_focus", "request"]);
  const unexpectedFields = Object.keys(payload).filter((key) => !allowedKeys.has(key));
  if (unexpectedFields.length > 0) {
    return createError(
      "invalid_report_request",
      `unexpected field(s): ${unexpectedFields.join(", ")}`,
      { unexpected_fields: unexpectedFields },
    );
  }

  const analysisType =
    typeof payload.analysis_type === "string" ? payload.analysis_type.trim().toLowerCase() : "";
  if (!ANALYSIS_TYPES.has(analysisType)) {
    return createError(
      "invalid_report_request",
      `analysis_type must be one of: ${Array.from(ANALYSIS_TYPES).join(", ")}`,
    );
  }

  if (!isPlainObject(payload.request)) {
    return createError("invalid_report_request", "request must be an object");
  }

  const runner = ANALYSIS_RUNNERS[analysisType];
  const result = runner(numSims, payload.request, options);
  if (result?.error) {
    return result;
  }

  const summaryFocus = normalizeSummaryFocus(payload);
  const sections = buildSimulationSections(analysisType, result);
  const assumptions = createAssumptionsTable(
    buildAssumptionsRows({
      analysisType,
      numSims,
      seed: options.seed,
      result,
      summaryFocus,
    }),
  );

  return buildStructuredReport({
    reportMeta: {
      report_type: "simulation",
      analysis_type: analysisType,
      title: normalizeTitle(payload, analysisType),
      summary_focus: summaryFocus,
      simulations_run: numSims,
      model_version: extractModelVersion(result),
      seed: options.seed ?? null,
    },
    executiveSummary: sections.executiveSummary,
    headlineMetrics: sections.headlineMetrics,
    tables: {
      scenario_summary: sections.scenarioSummary,
      assumptions,
    },
    chartHints: [
      createChartHint(
        "scenario_probability_comparison",
        "scenario_summary",
        sections.scenarioSummary.columns[0],
        "outcome_probability",
      ),
    ],
    result,
  });
}

module.exports = {
  runSimulationReport,
};
