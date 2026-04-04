const { parseWorkflowParams } = require("../lib/workflow-params");
const { runNbaPlayoffForecast } = require("../workflows/nba/playoff-forecast");
const { runNflPlayoffForecast } = require("../workflows/nfl/playoff-forecast");
const { runMlbPlayoffForecast } = require("../workflows/mlb/playoff-forecast");
const { runNhlPlayoffForecast } = require("../workflows/nhl/playoff-forecast");

const WORKFLOW_ROUTES = {
  "/api/workflows/sports/nba/championship-forecast": {
    expectedLeague: "nba",
    runner: runNbaPlayoffForecast,
    workflowName: "sports.championship_forecast",
    reportTitle: "NBA Championship Forecast",
  },
  "/api/workflows/sports/nba/playoff-forecast": {
    expectedLeague: "nba",
    runner: runNbaPlayoffForecast,
    workflowName: "sports.championship_forecast",
    reportTitle: "NBA Championship Forecast",
  },
  "/api/workflows/sports/nfl/championship-forecast": {
    expectedLeague: "nfl",
    runner: runNflPlayoffForecast,
    workflowName: "sports.championship_forecast",
    reportTitle: "NFL Championship Forecast",
  },
  "/api/workflows/sports/nfl/playoff-forecast": {
    expectedLeague: "nfl",
    runner: runNflPlayoffForecast,
    workflowName: "sports.championship_forecast",
    reportTitle: "NFL Championship Forecast",
  },
  "/api/workflows/sports/mlb/championship-forecast": {
    expectedLeague: "mlb",
    runner: runMlbPlayoffForecast,
    workflowName: "sports.championship_forecast",
    reportTitle: "MLB Championship Forecast",
  },
  "/api/workflows/sports/mlb/playoff-forecast": {
    expectedLeague: "mlb",
    runner: runMlbPlayoffForecast,
    workflowName: "sports.championship_forecast",
    reportTitle: "MLB Championship Forecast",
  },
  "/api/workflows/sports/nhl/championship-forecast": {
    expectedLeague: "nhl",
    runner: runNhlPlayoffForecast,
    workflowName: "sports.championship_forecast",
    reportTitle: "NHL Championship Forecast",
  },
  "/api/workflows/sports/nhl/playoff-forecast": {
    expectedLeague: "nhl",
    runner: runNhlPlayoffForecast,
    workflowName: "sports.championship_forecast",
    reportTitle: "NHL Championship Forecast",
  },
};

async function primaryHandler(req, res) {
  const routeConfig = WORKFLOW_ROUTES[req.path];
  if (!routeConfig) {
    return res.status(404).json({
      error: "unsupported_endpoint",
      message: `No sports workflow endpoint is registered for path ${req.path || "(empty)"}`,
    });
  }

  const parsed = parseWorkflowParams(req, { expectedLeague: routeConfig.expectedLeague });
  if (parsed.error) {
    return res.status(400).json(parsed.error);
  }

  const result = await routeConfig.runner({
    ...parsed.value,
    workflowName: routeConfig.workflowName,
    reportTitle: routeConfig.reportTitle,
  });
  if (result?.error) {
    return res.status(422).json(result.error);
  }

  return res.json(result);
}

module.exports = primaryHandler;
