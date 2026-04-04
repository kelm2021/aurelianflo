const { simulateCashRunwayForecast } = require("../../lib/finance-sim");
const { buildCashRunwayForecastReport } = require("../../lib/report");
const { buildDocumentArtifact } = require("../../../../routes/auto-local/doc-artifacts");

const ARTIFACT_ROUTE_PATHS = {
  xlsx: "/api/tools/xlsx/generate",
  pdf: "/api/tools/report/generate",
  docx: "/api/tools/docx/generate",
};

function buildAssumptions() {
  return [
    "Monte Carlo simulation uses monthly burn and revenue shocks from deterministic seeded normal draws.",
    "Growth rates are applied monthly as compounded trends before volatility shocks.",
    "Runway is treated as exhausted when cash falls to or below the configured runway threshold.",
  ];
}

function buildInputsEcho(params) {
  return {
    company_name: params.inputs.company_name,
    current_cash_usd: params.inputs.current_cash_usd,
    monthly_burn_usd: params.inputs.monthly_burn_usd,
    monthly_revenue_usd: params.inputs.monthly_revenue_usd,
    burn_growth_rate_monthly: params.inputs.burn_growth_rate_monthly,
    revenue_growth_rate_monthly: params.inputs.revenue_growth_rate_monthly,
    burn_volatility_pct: params.inputs.burn_volatility_pct,
    revenue_volatility_pct: params.inputs.revenue_volatility_pct,
    runway_threshold_usd: params.inputs.runway_threshold_usd,
    simulations: params.options.simulations,
    horizon_months: params.options.horizon_months,
    seed: params.options.seed,
    include_report: params.options.include_report,
    include_artifacts: params.options.include_artifacts,
  };
}

async function attachRequestedArtifacts(workflowPayload, requestedArtifacts) {
  const artifactTypes = Array.isArray(requestedArtifacts) ? requestedArtifacts : [];
  const artifacts = {
    recommended_local_path: workflowPayload.report?.export_artifacts?.recommended_local_path,
  };

  for (const artifactType of artifactTypes) {
    const routePath = ARTIFACT_ROUTE_PATHS[artifactType];
    if (!routePath) {
      continue;
    }

    const artifactResponse = await buildDocumentArtifact({
      path: routePath,
      title: "Cash Runway Forecast",
      body: workflowPayload,
    });

    if (artifactResponse?.success) {
      artifacts[artifactType] = artifactResponse.data;
      continue;
    }

    artifacts[artifactType] = {
      error: artifactResponse?.error || "artifact_generation_failed",
      message: artifactResponse?.message || `Unable to generate ${artifactType} artifact`,
    };
  }

  return artifacts;
}

async function runCashRunwayForecast(params) {
  const simulation = simulateCashRunwayForecast(params);
  const assumptions = buildAssumptions();
  const workflowResult = {
    workflow_meta: {
      workflow: params.workflow,
      mode: params.mode,
      as_of_date: params.asOfDate,
      model_version: simulation.model_version,
      source: "seeded-monte-carlo-cash-model",
    },
    inputs_echo: buildInputsEcho(params),
    summary: simulation.summary,
    timeline: simulation.timeline,
    assumptions,
    diagnostics: simulation.diagnostics,
  };

  const report = buildCashRunwayForecastReport(workflowResult);
  const workflowPayload = {
    ...workflowResult,
    ...(params.options.include_report || params.options.include_artifacts.length > 0 ? { report } : {}),
    artifacts: {
      recommended_local_path: report.export_artifacts?.recommended_local_path,
    },
  };
  if (params.options.include_report || params.options.include_artifacts.length > 0) {
    workflowPayload.artifacts.recommended_local_path = report.export_artifacts.recommended_local_path;
  } else {
    delete workflowPayload.artifacts;
  }

  if (params.options.include_artifacts.length > 0) {
    workflowPayload.artifacts = await attachRequestedArtifacts(
      workflowPayload,
      params.options.include_artifacts,
    );
  }

  return workflowPayload;
}

module.exports = {
  runCashRunwayForecast,
};
