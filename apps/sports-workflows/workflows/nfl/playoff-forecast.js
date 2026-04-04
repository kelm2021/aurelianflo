const snapshot = require("../../fixtures/nfl-standings-2026-04-03.json");
const { runBatchProbability } = require("../../../generic-parameter-simulator/sim/engine");
const {
  buildStructuredReport,
  createAssumptionsTable,
  createHeadlineMetric,
  createTable,
} = require("../../../../lib/report-builder");
const { buildRecommendedLocalPath } = require("../../lib/artifact-path");
const { NFL_ASSUMPTIONS } = require("./defaults");
const { selectTeams, teamToScenario } = require("./normalize");
const { buildDocumentArtifact } = require("../../../../routes/auto-local/doc-artifacts");

function formatRanking(result, teamsByName) {
  return result.ranking.map((entry) => {
    const team = teamsByName.get(entry.label);
    return {
      rank: entry.rank,
      team: entry.label,
      abbr: team?.abbr,
      conference: team?.conference,
      seed: team?.seed,
      probability: entry.outcome_probability,
      confidence_interval_95: entry.confidence_interval_95,
      mean_score: entry.mean_score,
    };
  });
}

const ARTIFACT_ROUTE_PATHS = {
  xlsx: "/api/tools/xlsx/generate",
  pdf: "/api/tools/report/generate",
  docx: "/api/tools/docx/generate",
};

function buildNflPlayoffForecastReport(workflowResult) {
  const workflowMeta = workflowResult?.workflow_meta || {};
  const prediction = workflowResult?.prediction || {};
  const diagnostics = workflowResult?.diagnostics || {};
  const ranking = Array.isArray(workflowResult?.ranking) ? workflowResult.ranking : [];
  const assumptions = Array.isArray(workflowResult?.assumptions) ? workflowResult.assumptions : [];
  const asOfDate = String(workflowMeta.as_of_date || "undated");

  return buildStructuredReport({
    reportMeta: {
      report_type: "sports-championship-forecast",
      title: "NFL Championship Forecast",
      author: "AurelianFlo",
      workflow: String(workflowMeta.workflow || "sports.championship_forecast"),
      league: String(workflowMeta.league || "nfl"),
      as_of_date: asOfDate,
      model_version: String(workflowMeta.model_version || ""),
    },
    executiveSummary: assumptions.length > 0
      ? assumptions
      : [`${String(prediction.predicted_winner || "Unknown team")} is the top-ranked title favorite in this forecast.`],
    headlineMetrics: [
      createHeadlineMetric("Predicted winner", String(prediction.predicted_winner || ""), "team"),
      createHeadlineMetric(
        "Championship probability",
        prediction.championship_probability == null ? "" : prediction.championship_probability,
        "probability",
      ),
      createHeadlineMetric("Simulations", diagnostics.simulations_run ?? "", "count"),
    ],
    tables: {
      contender_ranking: createTable(
        ["rank", "team", "probability"],
        ranking.map((entry) => ({
          rank: entry.rank,
          team: String(entry.team || entry.label || ""),
          probability: entry.probability ?? entry.outcome_probability ?? "",
        })),
      ),
      assumptions: createAssumptionsTable(
        assumptions.map((entry, index) => ({
          field: `assumption_${index + 1}`,
          value: String(entry || ""),
        })),
      ),
    },
    exportArtifacts: {
      recommended_local_path: buildRecommendedLocalPath(
        String(workflowResult?.export_artifacts?.recommended_local_path || ""),
        "xlsx",
        `nfl-championship-forecast-${asOfDate}.xlsx`,
      ),
    },
    result: workflowResult,
  });
}

async function attachRequestedArtifacts(workflowPayload, title, requestedArtifacts) {
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
      title,
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

async function runNflPlayoffForecast(params) {
  const sourceSnapshot = params.mode === "custom_field"
    ? {
        as_of_date: params.asOfDate || snapshot.as_of_date,
        source: "custom_field",
        teams: params.teams,
      }
    : snapshot;

  const teams = params.mode === "custom_field"
    ? params.teams
    : selectTeams(snapshot, params.field);
  const scenarios = teams.map(teamToScenario);
  const simulation = runBatchProbability(
    params.simulations,
    { scenarios },
    { seed: params.seed },
  );

  if (simulation?.error) {
    return { error: simulation.error };
  }

  const teamsByName = new Map(teams.map((team) => [team.name, team]));
  const rankedTeams = formatRanking(simulation, teamsByName);
  const topPick = rankedTeams[0];
  const workflowResult = {
    workflow_meta: {
      workflow: params.workflowName || "sports.championship_forecast",
      league: "nfl",
      as_of_date: params.asOfDate || sourceSnapshot.as_of_date,
      mode: params.mode,
      model_version: simulation.batch_meta.model_version,
      source: sourceSnapshot.source,
    },
    inputs_echo: {
      field: params.field,
      team_count: teams.length,
      teams_source: params.mode === "custom_field" ? "custom_field" : "standings_snapshot",
    },
    prediction: {
      predicted_winner: topPick.team,
      championship_probability: topPick.probability,
    },
    ranking: rankedTeams,
    assumptions: NFL_ASSUMPTIONS[params.field] || NFL_ASSUMPTIONS.top_6_only,
    diagnostics: {
      simulations_run: simulation.batch_meta.simulations_run,
      seed: params.seed,
      scenario_count: simulation.batch_meta.scenario_count,
      ranked_by: simulation.batch_meta.ranked_by,
    },
    source_snapshot: {
      as_of_date: params.asOfDate || sourceSnapshot.as_of_date,
      source: sourceSnapshot.source,
      team_count: teams.length,
    },
  };
  const report = buildNflPlayoffForecastReport(workflowResult);

  const workflowPayload = {
    ...workflowResult,
    ...(params.includeReport || params.includeArtifacts.length > 0 ? { report } : {}),
    artifacts: {
      recommended_local_path: report.export_artifacts?.recommended_local_path,
    },
  };

  if (params.includeArtifacts.length > 0) {
    workflowPayload.artifacts = await attachRequestedArtifacts(
      workflowPayload,
      params.reportTitle || "NFL Championship Forecast",
      params.includeArtifacts,
    );
  }

  return workflowPayload;
}

module.exports = {
  runNflPlayoffForecast,
};
