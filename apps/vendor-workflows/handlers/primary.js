const { parseWorkflowParams } = require("../lib/workflow-params");
const { runVendorRiskForecast } = require("../workflows/vendor/risk-forecast");

async function primaryHandler(req, res) {
  if (
    req.path !== "/api/workflows/vendor/risk-forecast"
    && req.path !== "/api/workflows/vendor/risk-assessment"
  ) {
    return res.status(404).json({
      error: "unsupported_endpoint",
      message: `No vendor workflow endpoint is registered for path ${req.path || "(empty)"}`,
    });
  }

  const parsed = parseWorkflowParams(req);
  if (parsed.error) {
    return res.status(400).json(parsed.error);
  }

  const result = await runVendorRiskForecast(parsed.value);
  if (result?.error) {
    return res.status(422).json(result.error);
  }

  return res.status(200).json(result);
}

module.exports = primaryHandler;
