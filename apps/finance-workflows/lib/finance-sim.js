const CASH_MODEL_VERSION = "1.0.0";
const PRICING_MODEL_VERSION = "1.0.0";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 6) {
  const precision = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * precision) / precision;
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const value of values) {
    sum += Number(value) || 0;
  }
  return sum / values.length;
}

function quantile(values, q) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  if (values.length === 1) {
    return values[0];
  }

  const sorted = [...values].sort((a, b) => a - b);
  const position = clamp(q, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function createSeededRng(seed) {
  let state = Number(seed) >>> 0;
  if (state === 0) {
    state = 0x6d2b79f5;
  }

  let spareNormal = null;

  function next() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  }

  function normal() {
    if (spareNormal !== null) {
      const value = spareNormal;
      spareNormal = null;
      return value;
    }

    let u = 0;
    let v = 0;
    while (u <= Number.EPSILON) {
      u = next();
    }
    while (v <= Number.EPSILON) {
      v = next();
    }
    const magnitude = Math.sqrt(-2.0 * Math.log(u));
    const angle = 2.0 * Math.PI * v;
    spareNormal = magnitude * Math.sin(angle);
    return magnitude * Math.cos(angle);
  }

  return {
    next,
    normal,
  };
}

function simulateCashRunwayForecast(params) {
  const options = params.options;
  const inputs = params.inputs;
  const horizonMonths = options.horizon_months;
  const simulations = options.simulations;
  const threshold = inputs.runway_threshold_usd;
  const rng = createSeededRng(options.seed);

  const runwayMonths = new Array(simulations);
  const endingCashValues = new Array(simulations);
  const cashByMonth = Array.from({ length: horizonMonths }, () => new Array(simulations));

  for (let simIndex = 0; simIndex < simulations; simIndex += 1) {
    let cash = inputs.current_cash_usd;
    let runwayMonth = horizonMonths + 1;

    for (let month = 1; month <= horizonMonths; month += 1) {
      const burnTrend = inputs.monthly_burn_usd * Math.pow(1 + inputs.burn_growth_rate_monthly, month - 1);
      const revenueTrend = inputs.monthly_revenue_usd * Math.pow(1 + inputs.revenue_growth_rate_monthly, month - 1);

      const burnShock = Math.max(0, 1 + (rng.normal() * inputs.burn_volatility_pct));
      const revenueShock = Math.max(0, 1 + (rng.normal() * inputs.revenue_volatility_pct));

      const actualBurn = Math.max(0, burnTrend * burnShock);
      const actualRevenue = Math.max(0, revenueTrend * revenueShock);
      cash += actualRevenue - actualBurn;

      cashByMonth[month - 1][simIndex] = cash;
      if (runwayMonth === horizonMonths + 1 && cash <= threshold) {
        runwayMonth = month;
      }
    }

    runwayMonths[simIndex] = runwayMonth;
    endingCashValues[simIndex] = cash;
  }

  const pRunOutWithin6 = runwayMonths.filter((month) => month <= 6).length / simulations;
  const pRunOutWithin12 = runwayMonths.filter((month) => month <= 12).length / simulations;
  const pRunOutWithinHorizon = runwayMonths.filter((month) => month <= horizonMonths).length / simulations;
  const medianRunwayMonths = quantile(runwayMonths, 0.5);
  const expectedRunwayMonths = average(runwayMonths);

  const endingCashP10 = quantile(endingCashValues, 0.1);
  const endingCashP50 = quantile(endingCashValues, 0.5);
  const endingCashP90 = quantile(endingCashValues, 0.9);

  let runwayStatus = "healthy";
  let recommendedAction = "maintain_current_plan";
  if (pRunOutWithin6 >= 0.5 || medianRunwayMonths <= 6) {
    runwayStatus = "critical";
    recommendedAction = "reduce_burn_immediately_or_raise_capital";
  } else if (pRunOutWithin12 >= 0.5 || endingCashP50 <= threshold) {
    runwayStatus = "at_risk";
    recommendedAction = "stage_cost_controls_and_extend_runway";
  } else if (pRunOutWithin12 >= 0.25) {
    runwayStatus = "watch";
    recommendedAction = "monitor_monthly_and_prepare_contingency_plan";
  }

  const timeline = [];
  for (let month = 1; month <= horizonMonths; month += 1) {
    const monthValues = cashByMonth[month - 1];
    const pRunOutByMonth = runwayMonths.filter((runwayMonth) => runwayMonth <= month).length / simulations;
    timeline.push({
      month,
      ending_cash_p10: round(quantile(monthValues, 0.1), 2),
      ending_cash_p50: round(quantile(monthValues, 0.5), 2),
      ending_cash_p90: round(quantile(monthValues, 0.9), 2),
      p_run_out_by_month: round(pRunOutByMonth, 6),
    });
  }

  return {
    model_version: CASH_MODEL_VERSION,
    summary: {
      median_runway_months: round(medianRunwayMonths, 3),
      expected_runway_months: round(expectedRunwayMonths, 3),
      p_run_out_within_6_months: round(pRunOutWithin6, 6),
      p_run_out_within_12_months: round(pRunOutWithin12, 6),
      p_run_out_within_horizon: round(pRunOutWithinHorizon, 6),
      ending_cash_p10: round(endingCashP10, 2),
      ending_cash_p50: round(endingCashP50, 2),
      ending_cash_p90: round(endingCashP90, 2),
      runway_status: runwayStatus,
      recommended_action: recommendedAction,
    },
    timeline,
    diagnostics: {
      simulations_run: simulations,
      horizon_months: horizonMonths,
      seed: options.seed,
      threshold_usd: threshold,
      model_family: "seeded-monte-carlo",
    },
  };
}

function simulateScenarioYearlyOutcome(scenario, horizonMonths, rng) {
  let cumulativeRevenue = 0;
  let cumulativeGrossProfit = 0;
  let cumulativeProfit = 0;

  for (let month = 0; month < horizonMonths; month += 1) {
    const visitors = Math.max(0, scenario.monthly_visitors * Math.max(0, 1 + (rng.normal() * 0.06)));
    const conversionRate = clamp(
      scenario.conversion_rate * Math.max(0, 1 + (rng.normal() * 0.08)),
      0,
      1,
    );
    const retentionMonths = Math.max(
      0.5,
      scenario.retention_months * Math.max(0.2, 1 + (rng.normal() * 0.12)),
    );
    const price = Math.max(0, scenario.price_usd * Math.max(0.2, 1 + (rng.normal() * 0.05)));
    const variableCost = Math.max(
      0,
      scenario.variable_cost_usd * Math.max(0.2, 1 + (rng.normal() * 0.05)),
    );

    const newCustomers = visitors * conversionRate;
    const activeCustomers = newCustomers * retentionMonths;
    const revenue = activeCustomers * price;
    const variableCostTotal = activeCustomers * variableCost;
    const grossProfit = revenue - variableCostTotal;
    const profit = grossProfit - scenario.fixed_cost_usd;

    cumulativeRevenue += revenue;
    cumulativeGrossProfit += grossProfit;
    cumulativeProfit += profit;
  }

  const annualizationFactor = 12 / horizonMonths;
  return {
    annual_revenue_usd: cumulativeRevenue * annualizationFactor,
    annual_gross_profit_usd: cumulativeGrossProfit * annualizationFactor,
    annual_profit_usd: cumulativeProfit * annualizationFactor,
  };
}

function summarizeScenarioDistribution(label, values, bestCount, simulations) {
  const expectedAnnualProfit = average(values.annual_profit_usd);
  return {
    label,
    expected_annual_revenue_usd: round(average(values.annual_revenue_usd), 2),
    expected_annual_gross_profit_usd: round(average(values.annual_gross_profit_usd), 2),
    expected_annual_profit_usd: round(expectedAnnualProfit, 2),
    annual_profit_p10: round(quantile(values.annual_profit_usd, 0.1), 2),
    annual_profit_p50: round(quantile(values.annual_profit_usd, 0.5), 2),
    annual_profit_p90: round(quantile(values.annual_profit_usd, 0.9), 2),
    probability_profitable: round(
      values.annual_profit_usd.filter((profit) => profit > 0).length / simulations,
      6,
    ),
    probability_best: round(bestCount / simulations, 6),
  };
}

function simulatePricingScenarioForecast(params) {
  const baseline = params.inputs.baseline;
  const candidates = params.inputs.candidates;
  const allScenarios = [baseline, ...candidates];
  const options = params.options;
  const horizonMonths = options.horizon_months;
  const simulations = options.simulations;
  const rng = createSeededRng(options.seed);

  const scenarioOutcomes = new Map();
  const scenarioBestCounts = new Map();
  for (const scenario of allScenarios) {
    scenarioOutcomes.set(scenario.label, {
      annual_revenue_usd: [],
      annual_gross_profit_usd: [],
      annual_profit_usd: [],
    });
    scenarioBestCounts.set(scenario.label, 0);
  }

  for (let simIndex = 0; simIndex < simulations; simIndex += 1) {
    let bestScenarioLabel = allScenarios[0].label;
    let bestScenarioProfit = Number.NEGATIVE_INFINITY;

    for (const scenario of allScenarios) {
      const outcome = simulateScenarioYearlyOutcome(scenario, horizonMonths, rng);
      const bucket = scenarioOutcomes.get(scenario.label);
      bucket.annual_revenue_usd.push(outcome.annual_revenue_usd);
      bucket.annual_gross_profit_usd.push(outcome.annual_gross_profit_usd);
      bucket.annual_profit_usd.push(outcome.annual_profit_usd);

      if (
        outcome.annual_profit_usd > bestScenarioProfit ||
        (outcome.annual_profit_usd === bestScenarioProfit && scenario.label < bestScenarioLabel)
      ) {
        bestScenarioProfit = outcome.annual_profit_usd;
        bestScenarioLabel = scenario.label;
      }
    }

    scenarioBestCounts.set(bestScenarioLabel, (scenarioBestCounts.get(bestScenarioLabel) || 0) + 1);
  }

  const scenarios = allScenarios.map((scenario) => summarizeScenarioDistribution(
    scenario.label,
    scenarioOutcomes.get(scenario.label),
    scenarioBestCounts.get(scenario.label) || 0,
    simulations,
  ));

  scenarios.sort((left, right) => {
    if (right.expected_annual_profit_usd !== left.expected_annual_profit_usd) {
      return right.expected_annual_profit_usd - left.expected_annual_profit_usd;
    }
    return left.label.localeCompare(right.label);
  });
  scenarios.forEach((scenario, index) => {
    scenario.rank = index + 1;
  });

  const baselineResult = scenarios.find((scenario) => scenario.label === baseline.label) || scenarios[0];
  for (const scenario of scenarios) {
    scenario.uplift_vs_baseline_annual_profit_usd = round(
      scenario.expected_annual_profit_usd - baselineResult.expected_annual_profit_usd,
      2,
    );
  }

  const bestScenario = scenarios[0];
  const secondScenario = scenarios[1] || scenarios[0];

  return {
    model_version: PRICING_MODEL_VERSION,
    summary: {
      best_expected_scenario: bestScenario.label,
      best_expected_annual_profit_usd: bestScenario.expected_annual_profit_usd,
      best_probability_best: bestScenario.probability_best,
      baseline_label: baselineResult.label,
      baseline_expected_annual_profit_usd: baselineResult.expected_annual_profit_usd,
      spread_vs_second_best_annual_profit_usd: round(
        bestScenario.expected_annual_profit_usd - secondScenario.expected_annual_profit_usd,
        2,
      ),
      recommendation: bestScenario.expected_annual_profit_usd > baselineResult.expected_annual_profit_usd
        ? `consider_promoting_${bestScenario.label}`
        : "hold_baseline_or_optimize_conversion",
    },
    scenarios,
    diagnostics: {
      simulations_run: simulations,
      horizon_months: horizonMonths,
      seed: options.seed,
      scenario_count: allScenarios.length,
      baseline_label: baseline.label,
      model_family: "seeded-scenario-comparison",
      ranking_metric: "expected_annual_profit_usd",
    },
  };
}

module.exports = {
  CASH_MODEL_VERSION,
  PRICING_MODEL_VERSION,
  simulateCashRunwayForecast,
  simulatePricingScenarioForecast,
};
