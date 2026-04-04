const {
  parseCashRunwayParams,
  parsePricingScenarioParams,
} = require("../lib/workflow-params");
const { runCashRunwayForecast } = require("../workflows/finance/cash-runway-forecast");
const { runPricingScenarioForecast } = require("../workflows/finance/pricing-scenario-forecast");

const WORKFLOW_ROUTES = {
  "/api/workflows/finance/cash-runway-forecast": {
    parser: parseCashRunwayParams,
    runner: runCashRunwayForecast,
  },
  "/api/workflows/finance/pricing-plan-compare": {
    parser: parsePricingScenarioParams,
    runner: runPricingScenarioForecast,
  },
  "/api/workflows/finance/pricing-scenario-forecast": {
    parser: parsePricingScenarioParams,
    runner: runPricingScenarioForecast,
  },
};

async function primaryHandler(req, res) {
  const routeConfig = WORKFLOW_ROUTES[req.path];
  if (!routeConfig) {
    return res.status(404).json({
      error: "unsupported_endpoint",
      message: `No finance workflow endpoint is registered for path ${req.path || "(empty)"}`,
    });
  }

  const parsed = routeConfig.parser(req);
  if (parsed.error) {
    return res.status(400).json(parsed.error);
  }

  const result = await routeConfig.runner(parsed.value);
  if (result?.error) {
    return res.status(422).json(result.error);
  }

  return res.status(200).json(result);
}

module.exports = primaryHandler;
