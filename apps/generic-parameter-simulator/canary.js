const {
  runBatchProbability,
  runCompare,
  runForecast,
  runSensitivity,
  runSimulation,
} = require("./sim/engine");

const DEFAULT_NUM_SIMS = 10000;
const DEFAULT_SEED = 20260403;

const canaries = [
  {
    name: "probability-baseline",
    run: () =>
      runSimulation(
        DEFAULT_NUM_SIMS,
        {
          parameters: {
            demand_signal: 0.65,
            execution_quality: 0.6,
            pricing_pressure: -0.25,
          },
          threshold: 0.25,
        },
        { seed: DEFAULT_SEED },
      ),
    assertions: [
      { label: "probability", value: (result) => result.outcome_probability, min: 0.74, max: 0.85 },
      { label: "tail risk", value: (result) => result.risk_metrics.expected_shortfall_05, min: -1.1, max: -0.7 },
    ],
  },
  {
    name: "batch-ranking",
    run: () =>
      runBatchProbability(
        DEFAULT_NUM_SIMS,
        {
          scenarios: [
            {
              label: "baseline",
              parameters: {
                demand_signal: 0.65,
                execution_quality: 0.6,
                pricing_pressure: -0.25,
              },
              threshold: 0.25,
            },
            {
              label: "candidate",
              parameters: {
                demand_signal: 0.78,
                execution_quality: 0.68,
                pricing_pressure: -0.2,
              },
              threshold: 0.25,
            },
          ],
        },
        { seed: DEFAULT_SEED },
      ),
    assertions: [
      { label: "top ranking", value: (result) => result.ranking[0].label, equals: "candidate" },
      {
        label: "baseline probability",
        value: (result) => result.scenarios[0].result.outcome_probability,
        min: 0.74,
        max: 0.85,
      },
      {
        label: "candidate probability",
        value: (result) => result.scenarios[1].result.outcome_probability,
        min: 0.82,
        max: 0.91,
      },
    ],
  },
  {
    name: "compare-decision",
    run: () =>
      runCompare(
        DEFAULT_NUM_SIMS,
        {
          baseline: {
            parameters: {
              demand_signal: 0.65,
              execution_quality: 0.6,
              pricing_pressure: -0.25,
            },
            threshold: 0.25,
          },
          candidate: {
            parameters: {
              demand_signal: 0.78,
              execution_quality: 0.68,
              pricing_pressure: -0.2,
            },
            threshold: 0.25,
          },
        },
        { seed: DEFAULT_SEED },
      ),
    assertions: [
      {
        label: "preferred scenario",
        value: (result) => result.decision_summary.preferred_scenario,
        equals: "candidate",
      },
      {
        label: "outperformance probability",
        value: (result) => result.decision_summary.probability_candidate_outperforms,
        min: 0.54,
        max: 0.62,
      },
    ],
  },
  {
    name: "sensitivity-response",
    run: () =>
      runSensitivity(
        DEFAULT_NUM_SIMS,
        {
          scenario: {
            parameters: {
              demand_signal: 0.72,
              execution_quality: 0.65,
              pricing_pressure: -0.35,
            },
            threshold: 0.25,
          },
          parameter: "demand_signal",
          delta: 0.1,
          mode: "relative",
        },
        { seed: DEFAULT_SEED },
      ),
    assertions: [
      { label: "direction", value: (result) => result.sensitivity.direction, equals: "increasing" },
      { label: "response span", value: (result) => result.response_curve.span, min: 0.03, max: 0.07 },
    ],
  },
  {
    name: "forecast-trend",
    run: () =>
      runForecast(
        DEFAULT_NUM_SIMS,
        {
          scenario: {
            parameters: { signal: 0.2 },
            uncertainty: { signal: 0.4 },
            outcome_noise: 0.5,
            threshold: 0,
          },
          periods: 2,
          drift: { signal: 0.05 },
        },
        { seed: DEFAULT_SEED },
      ),
    assertions: [
      { label: "start probability", value: (result) => result.timeline[0].outcome_probability, min: 0.62, max: 0.69 },
      { label: "end probability", value: (result) => result.timeline[1].outcome_probability, min: 0.65, max: 0.71 },
      {
        label: "forecast tail risk",
        value: (result) => result.timeline[0].risk_metrics.expected_shortfall_05,
        min: -1.15,
        max: -0.85,
      },
    ],
  },
];

function formatValue(value) {
  if (typeof value === "number") {
    return value.toFixed(4);
  }

  return JSON.stringify(value);
}

function runAssertion(result, assertion) {
  const actual = assertion.value(result);

  if (assertion.equals !== undefined) {
    return {
      ok: actual === assertion.equals,
      message: `${assertion.label}: expected ${formatValue(assertion.equals)}, got ${formatValue(actual)}`,
    };
  }

  const ok = actual >= assertion.min && actual <= assertion.max;
  return {
    ok,
    message: `${assertion.label}: expected ${assertion.min}..${assertion.max}, got ${formatValue(actual)}`,
  };
}

let failures = 0;

console.log("=== Simulator Canary ===");
console.log(`Seed: ${DEFAULT_SEED}`);
console.log(`Simulations: ${DEFAULT_NUM_SIMS}\n`);

for (const canary of canaries) {
  const result = canary.run();
  console.log(`[${canary.name}]`);

  for (const assertion of canary.assertions) {
    const outcome = runAssertion(result, assertion);
    if (outcome.ok) {
      console.log(`  PASS ${outcome.message}`);
    } else {
      failures += 1;
      console.log(`  FAIL ${outcome.message}`);
    }
  }

  console.log("");
}

if (failures > 0) {
  console.log(`Canary failed with ${failures} assertion(s).`);
  process.exit(1);
}

console.log("Canary passed.");
