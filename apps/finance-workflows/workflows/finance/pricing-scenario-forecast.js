const { simulatePricingScenarioForecast } = require("../../lib/finance-sim");
const { buildPricingScenarioForecastReport } = require("../../lib/report");
const { buildDocumentArtifact } = require("../../../../routes/auto-local/doc-artifacts");

const ARTIFACT_ROUTE_PATHS = {
  xlsx: "/api/tools/xlsx/generate",
  pdf: "/api/tools/report/generate",
  docx: "/api/tools/docx/generate",
};

function buildAssumptions() {
  return [
    "Each scenario applies stochastic variability to visitors, conversion, retention, price, and variable cost.",
    "Expected values are Monte Carlo means annualized from the configured horizon.",
    "Ranking is based on expected annual profit, with probability_best representing the share of simulations where a scenario wins.",
  ];
}

function buildInputsEcho(params) {
  return {
    baseline: params.inputs.baseline,
    candidates: params.inputs.candidates,
    scenario_count: params.inputs.candidates.length + 1,
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
      title: "Pricing Plan Compare",
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

async function runPricingScenarioForecast(params) {
  const simulation = simulatePricingScenarioForecast(params);
  const assumptions = buildAssumptions();
  const workflowResult = {
    workflow_meta: {
      workflow: params.workflow,
      mode: params.mode,
      as_of_date: params.asOfDate,
      model_version: simulation.model_version,
      source: "seeded-scenario-compare-model",
    },
    inputs_echo: buildInputsEcho(params),
    summary: simulation.summary,
    scenarios: simulation.scenarios,
    assumptions,
    diagnostics: simulation.diagnostics,
  };

  const report = buildPricingScenarioForecastReport(workflowResult);
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
  runPricingScenarioForecast,
};
