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

function leagueLabel(league) {
  const normalized = readString(league, "").trim().toLowerCase();
  if (normalized === "nfl") {
    return "NFL";
  }
  if (normalized === "mlb") {
    return "MLB";
  }
  if (normalized === "nhl") {
    return "NHL";
  }
  return "NBA";
}

function buildChampionshipFilenamePrefix(league) {
  const normalized = readString(league, "").trim().toLowerCase();
  if (normalized === "nfl") {
    return "nfl-championship-forecast";
  }
  if (normalized === "mlb") {
    return "mlb-championship-forecast";
  }
  if (normalized === "nhl") {
    return "nhl-championship-forecast";
  }
  return "nba-championship-forecast";
}

function buildPlayoffForecastReport(workflowResult, defaultLeague) {
  const payload = toObject(workflowResult);
  const workflowMeta = toObject(payload.workflow_meta);
  const prediction = toObject(payload.prediction);
  const diagnostics = toObject(payload.diagnostics);
  const ranking = Array.isArray(payload.ranking) ? payload.ranking : [];
  const assumptions = Array.isArray(payload.assumptions) ? payload.assumptions : [];
  const asOfDate = readString(workflowMeta.as_of_date, "undated");
  const league = readString(workflowMeta.league, defaultLeague);
  const titleLeague = leagueLabel(league);
  const filenamePrefix = buildChampionshipFilenamePrefix(league);

  return buildStructuredReport({
    reportMeta: {
      report_type: "sports-championship-forecast",
      title: `${titleLeague} Championship Forecast`,
      author: "AurelianFlo",
      workflow: readString(workflowMeta.workflow, "sports.championship_forecast"),
      league,
      as_of_date: asOfDate,
      model_version: readString(workflowMeta.model_version, ""),
    },
    executiveSummary: assumptions.length > 0
      ? assumptions
      : [
          `${readString(prediction.predicted_winner, "Unknown team")} is the top-ranked title favorite in this forecast.`,
        ],
    headlineMetrics: [
      createHeadlineMetric("Predicted winner", readString(prediction.predicted_winner, ""), "team"),
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
          team: readString(entry.team || entry.label, ""),
          probability: entry.probability ?? entry.outcome_probability ?? "",
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
        `${filenamePrefix}-${asOfDate}.xlsx`,
      ),
    },
    result: payload,
  });
}

function buildNbaPlayoffForecastReport(workflowResult) {
  return buildPlayoffForecastReport(workflowResult, "nba");
}

function buildNflPlayoffForecastReport(workflowResult) {
  return buildPlayoffForecastReport(workflowResult, "nfl");
}

function buildNhlPlayoffForecastReport(workflowResult) {
  return buildPlayoffForecastReport(workflowResult, "nhl");
}

function buildMlbPlayoffForecastReport(workflowResult) {
  return buildPlayoffForecastReport(workflowResult, "mlb");
}

module.exports = {
  buildMlbPlayoffForecastReport,
  buildNbaPlayoffForecastReport,
  buildNflPlayoffForecastReport,
  buildNhlPlayoffForecastReport,
};
