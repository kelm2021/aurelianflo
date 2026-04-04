const snapshot = require("../../fixtures/nba-standings-2026-04-03.json");
const { runBatchProbability } = require("../../../generic-parameter-simulator/sim/engine");
const { NBA_ASSUMPTIONS } = require("./defaults");
const { selectTeams, teamToScenario } = require("./normalize");
const { buildNbaPlayoffForecastReport } = require("../../lib/report");
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

async function runNbaPlayoffForecast(params) {
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
      league: "nba",
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
    assumptions: NBA_ASSUMPTIONS[params.field] || NBA_ASSUMPTIONS.top_6_only,
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
  const report = buildNbaPlayoffForecastReport(workflowResult);

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
      params.reportTitle || "NBA Championship Forecast",
      params.includeArtifacts,
    );
  }

  return workflowPayload;
}

module.exports = {
  runNbaPlayoffForecast,
};
