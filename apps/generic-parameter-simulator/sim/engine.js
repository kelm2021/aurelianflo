const MODEL_VERSION = "3.1.0";
const DEFAULT_PARAMETER_WEIGHT = 1;
const DEFAULT_PARAMETER_UNCERTAINTY = 0.1;
const DEFAULT_OUTCOME_NOISE_PER_WEIGHT = 0.3;
const DEFAULT_FORECAST_PERIODS = 12;
const DEFAULT_OPTIMIZATION_ITERATIONS = 25;
const Z_SCORE_95 = 1.96;

const SCENARIO_KEYS = new Set([
  "parameters",
  "weights",
  "uncertainty",
  "outcome_noise",
  "bias",
  "threshold",
]);

function createError(error, message, details) {
  if (details === undefined) {
    return { error, message };
  }

  return { error, message, details };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) {
    return value;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function validateAllowedKeys(payload, allowedKeys, code = "invalid_request") {
  if (!isPlainObject(payload)) {
    return {
      error: createError(code, "request body must be an object"),
    };
  }

  const extras = Object.keys(payload).filter((key) => !allowedKeys.has(key));
  if (extras.length > 0) {
    return {
      error: createError(
        code,
        `unexpected field(s): ${extras.join(", ")}`,
        { unexpected_fields: extras },
      ),
    };
  }

  return { value: payload };
}

function validateSimCount(numSims) {
  if (!Number.isInteger(numSims) || numSims < 1) {
    return {
      error: createError(
        "invalid_sims",
        "numSims must be a positive integer",
        { numSims },
      ),
    };
  }

  return { value: numSims };
}

function percentile(sortedValues, quantile) {
  if (!sortedValues.length) {
    return 0;
  }

  if (quantile <= 0) {
    return sortedValues[0];
  }

  if (quantile >= 1) {
    return sortedValues[sortedValues.length - 1];
  }

  const index = (sortedValues.length - 1) * quantile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sortedValues[lower];
  }

  const weight = index - lower;
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * weight;
}

function hashSeed(input) {
  const text = String(input);
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = hashSeed(seed) || 1;

  return function seededRandom() {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRandomSource(options = {}) {
  if (options.seed === undefined) {
    return Math.random;
  }

  return createSeededRandom(options.seed);
}

function deriveSeed(seed, label) {
  if (seed === undefined) {
    return undefined;
  }

  return hashSeed(`${seed}:${label}`);
}

function randomNormal(mean, stddev, random = Math.random) {
  if (stddev === 0) {
    return mean;
  }

  let u1 = 0;
  let u2 = 0;

  while (u1 <= Number.EPSILON) {
    u1 = random();
  }

  while (u2 <= Number.EPSILON) {
    u2 = random();
  }

  const radius = Math.sqrt(-2 * Math.log(u1));
  const theta = 2 * Math.PI * u2;
  const z = radius * Math.cos(theta);
  return mean + z * stddev;
}

function summarizeScores(scores) {
  if (!scores.length) {
    return {
      mean: 0,
      stddev: 0,
      min: 0,
      p05: 0,
      p10: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      max: 0,
    };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const sum = scores.reduce((acc, value) => acc + value, 0);
  const mean = sum / scores.length;
  const variance =
    scores.reduce((acc, value) => acc + (value - mean) ** 2, 0) / scores.length;
  const stddev = Math.sqrt(variance);

  return {
    mean: round(mean),
    stddev: round(stddev),
    min: round(sorted[0]),
    p05: round(percentile(sorted, 0.05)),
    p10: round(percentile(sorted, 0.1)),
    p25: round(percentile(sorted, 0.25)),
    p50: round(percentile(sorted, 0.5)),
    p75: round(percentile(sorted, 0.75)),
    p90: round(percentile(sorted, 0.9)),
    p95: round(percentile(sorted, 0.95)),
    max: round(sorted[sorted.length - 1]),
  };
}

function meanOfSlice(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function summarizeRiskMetrics(effectiveScores, threshold, successCount) {
  if (!effectiveScores.length) {
    return {
      probability_above_threshold: 0,
      probability_below_threshold: 0,
      expected_shortfall_05: 0,
      expected_upside_95: 0,
      threshold_gap_p50: 0,
    };
  }

  const sorted = [...effectiveScores].sort((a, b) => a - b);
  const tailCount = Math.max(1, Math.ceil(sorted.length * 0.05));
  const bottomTail = sorted.slice(0, tailCount);
  const topTail = sorted.slice(sorted.length - tailCount);
  const probabilityAboveThreshold = successCount / effectiveScores.length;
  const median = percentile(sorted, 0.5);

  return {
    probability_above_threshold: round(probabilityAboveThreshold),
    probability_below_threshold: round(1 - probabilityAboveThreshold),
    expected_shortfall_05: round(meanOfSlice(bottomTail)),
    expected_upside_95: round(meanOfSlice(topTail)),
    threshold_gap_p50: round(median - threshold),
  };
}

function estimateDefaultOutcomeNoise(weights) {
  const aggregateAbsWeight = Object.values(weights).reduce(
    (acc, value) => acc + Math.abs(value),
    0,
  );

  return round(aggregateAbsWeight * DEFAULT_OUTCOME_NOISE_PER_WEIGHT, 6);
}

function classifySaturationRisk(probability) {
  if (probability <= 0.02 || probability >= 0.98) {
    return "critical";
  }

  if (probability <= 0.1 || probability >= 0.9) {
    return "elevated";
  }

  if (probability <= 0.25 || probability >= 0.75) {
    return "moderate";
  }

  return "low";
}

function normalizeScenario(rawScenario, options = {}) {
  const {
    requireParameters = true,
    allowedTopLevelKeys = SCENARIO_KEYS,
  } = options;

  if (!isPlainObject(rawScenario)) {
    return {
      error: createError("invalid_scenario", "scenario must be an object"),
    };
  }

  const extraKeys = Object.keys(rawScenario).filter(
    (key) => !allowedTopLevelKeys.has(key),
  );
  if (extraKeys.length > 0) {
    return {
      error: createError(
        "invalid_scenario",
        `unexpected scenario field(s): ${extraKeys.join(", ")}`,
        { unexpected_fields: extraKeys },
      ),
    };
  }

  const rawParameters = rawScenario.parameters;
  if (!isPlainObject(rawParameters)) {
    return {
      error: createError("invalid_parameters", "parameters must be an object"),
    };
  }

  const parameterKeys = Object.keys(rawParameters);
  if (requireParameters && parameterKeys.length === 0) {
    return {
      error: createError("invalid_parameters", "parameters must include at least one key"),
    };
  }

  const parameters = {};
  for (const key of parameterKeys) {
    const value = rawParameters[key];
    if (!isFiniteNumber(value)) {
      return {
        error: createError(
          "invalid_parameters",
          `parameter "${key}" must be a finite number`,
          { field: `parameters.${key}` },
        ),
      };
    }
    parameters[key] = value;
  }

  const rawWeights = rawScenario.weights ?? {};
  if (!isPlainObject(rawWeights)) {
    return {
      error: createError("invalid_weights", "weights must be an object when provided"),
    };
  }

  const unknownWeightKeys = Object.keys(rawWeights).filter((key) => !(key in parameters));
  if (unknownWeightKeys.length > 0) {
    return {
      error: createError(
        "invalid_weights",
        `weights includes unknown parameter(s): ${unknownWeightKeys.join(", ")}`,
        { unknown_parameters: unknownWeightKeys },
      ),
    };
  }

  const weights = {};
  for (const key of parameterKeys) {
    const value = rawWeights[key];
    if (value === undefined) {
      weights[key] = DEFAULT_PARAMETER_WEIGHT;
      continue;
    }

    if (!isFiniteNumber(value)) {
      return {
        error: createError(
          "invalid_weights",
          `weight "${key}" must be a finite number`,
          { field: `weights.${key}` },
        ),
      };
    }

    weights[key] = value;
  }

  const rawUncertainty = rawScenario.uncertainty ?? {};
  if (!isPlainObject(rawUncertainty)) {
    return {
      error: createError(
        "invalid_uncertainty",
        "uncertainty must be an object when provided",
      ),
    };
  }

  const unknownUncertaintyKeys = Object.keys(rawUncertainty).filter(
    (key) => !(key in parameters),
  );
  if (unknownUncertaintyKeys.length > 0) {
    return {
      error: createError(
        "invalid_uncertainty",
        `uncertainty includes unknown parameter(s): ${unknownUncertaintyKeys.join(", ")}`,
        { unknown_parameters: unknownUncertaintyKeys },
      ),
    };
  }

  const uncertainty = {};
  for (const key of parameterKeys) {
    const value = rawUncertainty[key];
    if (value === undefined) {
      uncertainty[key] = DEFAULT_PARAMETER_UNCERTAINTY;
      continue;
    }

    if (!isFiniteNumber(value) || value < 0) {
      return {
        error: createError(
          "invalid_uncertainty",
          `uncertainty "${key}" must be a finite number >= 0`,
          { field: `uncertainty.${key}` },
        ),
      };
    }

    uncertainty[key] = value;
  }

  const rawOutcomeNoise = rawScenario.outcome_noise;
  let outcomeNoise = rawOutcomeNoise;
  let outcomeNoiseSource = "user";

  if (outcomeNoise === undefined) {
    outcomeNoise = estimateDefaultOutcomeNoise(weights);
    outcomeNoiseSource = "default";
  }

  if (!isFiniteNumber(outcomeNoise) || outcomeNoise < 0) {
    return {
      error: createError(
        "invalid_outcome_noise",
        "outcome_noise must be a finite number >= 0",
      ),
    };
  }

  const bias = rawScenario.bias ?? 0;
  if (!isFiniteNumber(bias)) {
    return {
      error: createError("invalid_bias", "bias must be a finite number"),
    };
  }

  const threshold = rawScenario.threshold ?? 0;
  if (!isFiniteNumber(threshold)) {
    return {
      error: createError("invalid_threshold", "threshold must be a finite number"),
    };
  }

  return {
    value: {
      parameters,
      weights,
      uncertainty,
      outcome_noise: outcomeNoise,
      outcome_noise_source: outcomeNoiseSource,
      bias,
      threshold,
      parameterKeys,
    },
  };
}

function runTrials(numSims, normalizedScenario, options = {}) {
  const includeSamples = options.includeSamples === true;
  const random = createRandomSource(options);
  const scores = new Array(numSims);
  const effectiveScores = new Array(numSims);
  const sampleSums = Object.fromEntries(
    normalizedScenario.parameterKeys.map((key) => [key, 0]),
  );
  const contributionSums = Object.fromEntries(
    normalizedScenario.parameterKeys.map((key) => [key, 0]),
  );

  let successes = 0;

  for (let i = 0; i < numSims; i += 1) {
    let score = normalizedScenario.bias;

    for (const key of normalizedScenario.parameterKeys) {
      const sample = randomNormal(
        normalizedScenario.parameters[key],
        normalizedScenario.uncertainty[key],
        random,
      );
      const contribution = sample * normalizedScenario.weights[key];
      score += contribution;
      sampleSums[key] += sample;
      contributionSums[key] += contribution;
    }

    scores[i] = score;
    const effectiveScore =
      score + randomNormal(0, normalizedScenario.outcome_noise, random);
    effectiveScores[i] = effectiveScore;

    if (effectiveScore >= normalizedScenario.threshold) {
      successes += 1;
    }
  }

  const probability = successes / numSims;
  const margin =
    Z_SCORE_95 * Math.sqrt((probability * (1 - probability)) / Math.max(1, numSims));

  const parameterContributions = {};
  for (const key of normalizedScenario.parameterKeys) {
    parameterContributions[key] = {
      mean_sample: round(sampleSums[key] / numSims),
      weight: round(normalizedScenario.weights[key]),
      mean_contribution: round(contributionSums[key] / numSims),
    };
  }

  const rawScoreDistribution = summarizeScores(scores);
  const effectiveScoreDistribution = summarizeScores(effectiveScores);
  const riskMetrics = summarizeRiskMetrics(
    effectiveScores,
    normalizedScenario.threshold,
    successes,
  );

  const result = {
    simulation_meta: {
      simulations_run: numSims,
      model_version: MODEL_VERSION,
      success_rule:
        normalizedScenario.outcome_noise > 0
          ? "score + outcome_noise_draw >= threshold"
          : "score >= threshold",
      calibration: {
        outcome_noise: round(normalizedScenario.outcome_noise, 6),
        outcome_noise_source: normalizedScenario.outcome_noise_source,
      },
    },
    outcome_probability: round(probability),
    confidence_interval_95: {
      low: round(clamp(probability - margin, 0, 1)),
      high: round(clamp(probability + margin, 0, 1)),
    },
    score_distribution: rawScoreDistribution,
    effective_score_distribution: effectiveScoreDistribution,
    parameter_contributions: parameterContributions,
    risk_metrics: riskMetrics,
    diagnostics: {
      threshold: round(normalizedScenario.threshold, 6),
      effective_score_stddev: effectiveScoreDistribution.stddev,
      effective_margin_mean: round(
        effectiveScoreDistribution.mean - normalizedScenario.threshold,
      ),
      saturation_risk: classifySaturationRisk(probability),
    },
  };

  if (includeSamples) {
    result.samples = {
      scores,
      effective_scores: effectiveScores,
    };
  }

  return result;
}

function runSimulation(numSims, scenario, options = {}) {
  const simCount = validateSimCount(numSims);
  if (simCount.error) {
    return simCount.error;
  }

  const normalized = normalizeScenario(scenario);
  if (normalized.error) {
    return normalized.error;
  }

  return runTrials(numSims, normalized.value, options);
}

function runBatchProbability(numSims, payload, options = {}) {
  const simCount = validateSimCount(numSims);
  if (simCount.error) {
    return simCount.error;
  }

  if (!isPlainObject(payload)) {
    return createError("invalid_batch_request", "request body must be an object");
  }

  const allowedKeys = new Set(["scenarios"]);
  const keyCheck = validateAllowedKeys(payload, allowedKeys, "invalid_batch_request");
  if (keyCheck.error) {
    return keyCheck.error;
  }

  if (!Array.isArray(payload.scenarios) || payload.scenarios.length === 0) {
    return createError(
      "invalid_batch_request",
      "scenarios must be a non-empty array",
    );
  }

  if (payload.scenarios.length > 100) {
    return createError(
      "invalid_batch_request",
      "scenarios cannot contain more than 100 entries",
    );
  }

  const scenarios = payload.scenarios.map((entry, index) => {
    if (!isPlainObject(entry)) {
      return {
        error: createError(
          "invalid_batch_request",
          `scenarios[${index}] must be an object`,
        ),
      };
    }

    const entryKeys = new Set([
      "label",
      "scenario",
      "parameters",
      "weights",
      "uncertainty",
      "outcome_noise",
      "bias",
      "threshold",
    ]);
    const entryKeyCheck = validateAllowedKeys(entry, entryKeys, "invalid_batch_request");
    if (entryKeyCheck.error) {
      return entryKeyCheck;
    }

    const scenarioValue = isPlainObject(entry.scenario)
      ? entry.scenario
      : Object.fromEntries(
          Object.entries(entry).filter(([key]) => SCENARIO_KEYS.has(key)),
        );

    const normalized = normalizeScenario(scenarioValue);
    if (normalized.error) {
      return {
        error: {
          ...normalized.error,
          details: {
            ...(normalized.error.details ?? {}),
            scenario_index: index,
          },
        },
      };
    }

    return {
      value: {
        index,
        label:
          typeof entry.label === "string" && entry.label.trim() !== ""
            ? entry.label.trim()
            : `scenario_${index + 1}`,
        scenario: normalized.value,
      },
    };
  });

  const firstError = scenarios.find((entry) => entry.error);
  if (firstError) {
    return firstError.error;
  }

  const results = scenarios.map((entry) => {
    const result = runTrials(numSims, entry.value.scenario, {
      seed: deriveSeed(options.seed, `batch:${entry.value.index}`),
    });
    return {
      index: entry.value.index,
      label: entry.value.label,
      result,
    };
  });

  const ranking = [...results]
    .sort((left, right) => {
      if (right.result.outcome_probability !== left.result.outcome_probability) {
        return right.result.outcome_probability - left.result.outcome_probability;
      }

      return right.result.score_distribution.mean - left.result.score_distribution.mean;
    })
    .map((entry, rankIndex) => ({
      rank: rankIndex + 1,
      index: entry.index,
      label: entry.label,
      outcome_probability: entry.result.outcome_probability,
      mean_score: entry.result.score_distribution.mean,
      confidence_interval_95: entry.result.confidence_interval_95,
    }));

  return {
    batch_meta: {
      simulations_run: numSims,
      model_version: MODEL_VERSION,
      scenario_count: results.length,
      ranked_by: ["outcome_probability", "mean_score"],
    },
    scenarios: results,
    ranking,
  };
}

function toScenarioPayload(payload, options = {}) {
  if (!isPlainObject(payload)) {
    return {
      error: createError("invalid_request", "request body must be an object"),
    };
  }

  if (isPlainObject(payload.scenario)) {
    return { value: payload.scenario };
  }

  const allowedMetaKeys = options.metaKeys ?? new Set();
  const hasScenarioFields = Object.keys(payload).some((key) => SCENARIO_KEYS.has(key));
  if (!hasScenarioFields) {
    return {
      error: createError("invalid_scenario", "scenario is required"),
    };
  }

  const scenario = {};
  for (const key of Object.keys(payload)) {
    if (SCENARIO_KEYS.has(key)) {
      scenario[key] = payload[key];
    }
  }

  const extras = Object.keys(payload).filter(
    (key) => !allowedMetaKeys.has(key) && !SCENARIO_KEYS.has(key),
  );
  if (extras.length > 0) {
    return {
      error: createError(
        "invalid_request",
        `unexpected field(s): ${extras.join(", ")}`,
        { unexpected_fields: extras },
      ),
    };
  }

  return { value: scenario };
}
function runCompare(numSims, payload, options = {}) {
  const simCount = validateSimCount(numSims);
  if (simCount.error) {
    return simCount.error;
  }

  if (!isPlainObject(payload)) {
    return createError("invalid_compare_request", "request body must be an object");
  }

  let baselineRaw = payload.baseline;
  let candidateRaw = payload.candidate;
  let labels = payload.labels;

  if (Array.isArray(payload.scenarios)) {
    if (payload.scenarios.length !== 2) {
      return createError(
        "invalid_compare_request",
        "scenarios array must contain exactly two entries",
      );
    }

    const [first, second] = payload.scenarios;
    baselineRaw = isPlainObject(first) && isPlainObject(first.scenario) ? first.scenario : first;
    candidateRaw = isPlainObject(second) && isPlainObject(second.scenario) ? second.scenario : second;

    labels = labels || {
      baseline:
        isPlainObject(first) && typeof first.label === "string"
          ? first.label
          : "baseline",
      candidate:
        isPlainObject(second) && typeof second.label === "string"
          ? second.label
          : "candidate",
    };
  }

  const allowedKeys = new Set(["baseline", "candidate", "scenarios", "labels"]);
  const keyCheck = validateAllowedKeys(payload, allowedKeys, "invalid_compare_request");
  if (keyCheck.error) {
    return keyCheck.error;
  }

  if (!isPlainObject(baselineRaw) || !isPlainObject(candidateRaw)) {
    return createError(
      "invalid_compare_request",
      "baseline and candidate scenarios are required",
    );
  }

  const baselineNormalized = normalizeScenario(baselineRaw);
  if (baselineNormalized.error) {
    return {
      ...baselineNormalized.error,
      details: {
        ...(baselineNormalized.error.details ?? {}),
        scenario: "baseline",
      },
    };
  }

  const candidateNormalized = normalizeScenario(candidateRaw);
  if (candidateNormalized.error) {
    return {
      ...candidateNormalized.error,
      details: {
        ...(candidateNormalized.error.details ?? {}),
        scenario: "candidate",
      },
    };
  }

  const baselineDetailed = runTrials(numSims, baselineNormalized.value, {
    includeSamples: true,
    seed: deriveSeed(options.seed, "compare:baseline"),
  });
  const candidateDetailed = runTrials(numSims, candidateNormalized.value, {
    includeSamples: true,
    seed: deriveSeed(options.seed, "compare:candidate"),
  });
  const { samples: baselineSamples, ...baseline } = baselineDetailed;
  const { samples: candidateSamples, ...candidate } = candidateDetailed;

  const baselineLabel =
    isPlainObject(labels) && typeof labels.baseline === "string"
      ? labels.baseline
      : "baseline";
  const candidateLabel =
    isPlainObject(labels) && typeof labels.candidate === "string"
      ? labels.candidate
      : "candidate";

  const probabilityDelta = candidate.outcome_probability - baseline.outcome_probability;
  const meanScoreDelta =
    candidate.score_distribution.mean - baseline.score_distribution.mean;
  const pairedScoreGaps = candidateSamples.effective_scores.map(
    (candidateScore, index) => candidateScore - baselineSamples.effective_scores[index],
  );
  const probabilityCandidateOutperforms =
    pairedScoreGaps.filter((gap) => gap > 0).length / pairedScoreGaps.length;
  const expectedScoreGap =
    pairedScoreGaps.reduce((acc, gap) => acc + gap, 0) / pairedScoreGaps.length;
  const preferredScenario =
    probabilityCandidateOutperforms > 0.525
      ? candidateLabel
      : probabilityCandidateOutperforms < 0.475
        ? baselineLabel
        : "tie";

  return {
    comparison_meta: {
      simulations_run: numSims,
      model_version: MODEL_VERSION,
      baseline_label: baselineLabel,
      candidate_label: candidateLabel,
    },
    baseline,
    candidate,
    deltas: {
      outcome_probability: round(probabilityDelta),
      mean_score: round(meanScoreDelta),
      relative_probability_change:
        baseline.outcome_probability === 0
          ? null
          : round(probabilityDelta / baseline.outcome_probability),
    },
    paired_score_distribution: summarizeScores(pairedScoreGaps),
    decision_summary: {
      preferred_scenario: preferredScenario,
      probability_candidate_outperforms: round(probabilityCandidateOutperforms),
      expected_score_gap: round(expectedScoreGap),
    },
  };
}

function runSensitivity(numSims, payload, options = {}) {
  const simCount = validateSimCount(numSims);
  if (simCount.error) {
    return simCount.error;
  }

  if (!isPlainObject(payload)) {
    return createError("invalid_sensitivity_request", "request body must be an object");
  }

  const allowedKeys = new Set([
    "scenario",
    "parameters",
    "weights",
    "uncertainty",
    "outcome_noise",
    "bias",
    "threshold",
    "parameter",
    "delta",
    "mode",
  ]);
  const keyCheck = validateAllowedKeys(payload, allowedKeys, "invalid_sensitivity_request");
  if (keyCheck.error) {
    return keyCheck.error;
  }

  const scenarioPayload = toScenarioPayload(payload, {
    metaKeys: new Set(["parameter", "delta", "mode"]),
  });
  if (scenarioPayload.error) {
    return scenarioPayload.error;
  }

  const normalized = normalizeScenario(scenarioPayload.value);
  if (normalized.error) {
    return normalized.error;
  }

  if (typeof payload.parameter !== "string" || payload.parameter.trim() === "") {
    return createError(
      "invalid_sensitivity_request",
      "parameter must be a non-empty string",
    );
  }

  const parameter = payload.parameter.trim();
  if (!normalized.value.parameterKeys.includes(parameter)) {
    return createError(
      "invalid_sensitivity_request",
      `parameter "${parameter}" must exist in scenario.parameters`,
    );
  }

  const delta = payload.delta ?? 0.1;
  if (!isFiniteNumber(delta) || delta <= 0) {
    return createError(
      "invalid_sensitivity_request",
      "delta must be a finite number greater than 0",
    );
  }

  const mode = payload.mode ?? "absolute";
  if (mode !== "absolute" && mode !== "relative") {
    return createError(
      "invalid_sensitivity_request",
      'mode must be either "absolute" or "relative"',
    );
  }

  const baseScenario = normalized.value;
  const baseline = runTrials(numSims, baseScenario, {
    seed: deriveSeed(options.seed, "sensitivity:baseline"),
  });
  const baseValue = baseScenario.parameters[parameter];

  const lowerValue = mode === "relative" ? baseValue * (1 - delta) : baseValue - delta;
  const upperValue = mode === "relative" ? baseValue * (1 + delta) : baseValue + delta;

  const lowerScenario = {
    ...baseScenario,
    parameters: {
      ...baseScenario.parameters,
      [parameter]: lowerValue,
    },
  };

  const upperScenario = {
    ...baseScenario,
    parameters: {
      ...baseScenario.parameters,
      [parameter]: upperValue,
    },
  };

  const lower = runTrials(numSims, lowerScenario, {
    seed: deriveSeed(options.seed, "sensitivity:low"),
  });
  const upper = runTrials(numSims, upperScenario, {
    seed: deriveSeed(options.seed, "sensitivity:high"),
  });

  const denominator = upperValue - lowerValue;
  const gradient =
    denominator === 0
      ? null
      : round((upper.outcome_probability - lower.outcome_probability) / denominator, 6);
  const direction =
    upper.outcome_probability - lower.outcome_probability > 0.005
      ? "increasing"
      : upper.outcome_probability - lower.outcome_probability < -0.005
        ? "decreasing"
        : "flat";
  const midpointElasticity =
    mode === "relative"
    && baseline.outcome_probability > 0
    && baseValue !== 0
    && denominator !== 0
      ? round(
          ((upper.outcome_probability - lower.outcome_probability)
            / baseline.outcome_probability)
            / (denominator / Math.abs(baseValue)),
          6,
        )
      : null;

  return {
    sensitivity_meta: {
      simulations_run: numSims,
      model_version: MODEL_VERSION,
      parameter,
      mode,
      delta: round(delta, 6),
      base_parameter_value: round(baseValue, 6),
    },
    baseline,
    low_variant: {
      parameter_value: round(lowerValue, 6),
      result: lower,
    },
    high_variant: {
      parameter_value: round(upperValue, 6),
      result: upper,
    },
    sensitivity: {
      probability_gradient: gradient,
      midpoint_elasticity: midpointElasticity,
      direction,
      shift_low: round(lower.outcome_probability - baseline.outcome_probability),
      shift_high: round(upper.outcome_probability - baseline.outcome_probability),
    },
    response_curve: {
      low_probability: lower.outcome_probability,
      baseline_probability: baseline.outcome_probability,
      high_probability: upper.outcome_probability,
      span: round(upper.outcome_probability - lower.outcome_probability),
    },
  };
}

function runForecast(numSims, payload, options = {}) {
  const simCount = validateSimCount(numSims);
  if (simCount.error) {
    return simCount.error;
  }

  if (!isPlainObject(payload)) {
    return createError("invalid_forecast_request", "request body must be an object");
  }

  const allowedKeys = new Set([
    "scenario",
    "parameters",
    "weights",
    "uncertainty",
    "outcome_noise",
    "bias",
    "threshold",
    "periods",
    "drift",
    "uncertainty_growth",
    "growth_mode",
  ]);
  const keyCheck = validateAllowedKeys(payload, allowedKeys, "invalid_forecast_request");
  if (keyCheck.error) {
    return keyCheck.error;
  }

  const scenarioPayload = toScenarioPayload(payload, {
    metaKeys: new Set(["periods", "drift", "uncertainty_growth", "growth_mode"]),
  });
  if (scenarioPayload.error) {
    return scenarioPayload.error;
  }

  const normalized = normalizeScenario(scenarioPayload.value);
  if (normalized.error) {
    return normalized.error;
  }

  const periods = payload.periods ?? DEFAULT_FORECAST_PERIODS;
  if (!Number.isInteger(periods) || periods < 1 || periods > 120) {
    return createError(
      "invalid_forecast_request",
      "periods must be an integer between 1 and 120",
    );
  }

  const growthMode = payload.growth_mode ?? "additive";
  if (growthMode !== "additive" && growthMode !== "multiplicative") {
    return createError(
      "invalid_forecast_request",
      'growth_mode must be either "additive" or "multiplicative"',
    );
  }

  const drift = payload.drift ?? {};
  if (!isPlainObject(drift)) {
    return createError("invalid_forecast_request", "drift must be an object when provided");
  }

  const unknownDriftKeys = Object.keys(drift).filter(
    (key) => !(key in normalized.value.parameters),
  );
  if (unknownDriftKeys.length > 0) {
    return createError(
      "invalid_forecast_request",
      `drift includes unknown parameter(s): ${unknownDriftKeys.join(", ")}`,
      { unknown_parameters: unknownDriftKeys },
    );
  }

  for (const key of Object.keys(drift)) {
    if (!isFiniteNumber(drift[key])) {
      return createError(
        "invalid_forecast_request",
        `drift "${key}" must be a finite number`,
      );
    }
  }

  const uncertaintyGrowth = payload.uncertainty_growth ?? 0;
  if (!isFiniteNumber(uncertaintyGrowth) || uncertaintyGrowth < 0) {
    return createError(
      "invalid_forecast_request",
      "uncertainty_growth must be a finite number >= 0",
    );
  }

  let workingScenario = {
    ...normalized.value,
    parameters: { ...normalized.value.parameters },
    uncertainty: { ...normalized.value.uncertainty },
  };

  const timeline = [];
  for (let period = 1; period <= periods; period += 1) {
    const parameterSnapshot = {};

    for (const key of workingScenario.parameterKeys) {
      const driftValue = drift[key] ?? 0;
      const previous = workingScenario.parameters[key];
      const next =
        growthMode === "multiplicative"
          ? previous * (1 + driftValue)
          : previous + driftValue;

      workingScenario.parameters[key] = next;
      parameterSnapshot[key] = round(next, 6);
    }

    for (const key of workingScenario.parameterKeys) {
      const baseUncertainty = normalized.value.uncertainty[key];
      const scaled = baseUncertainty * (1 + uncertaintyGrowth * (period - 1));
      workingScenario.uncertainty[key] = scaled;
    }

    const result = runTrials(numSims, workingScenario, {
      seed: deriveSeed(options.seed, `forecast:${period}`),
    });
    timeline.push({
      period,
      parameters: parameterSnapshot,
      outcome_probability: result.outcome_probability,
      confidence_interval_95: result.confidence_interval_95,
      mean_score: result.score_distribution.mean,
      effective_score_distribution: result.effective_score_distribution,
      risk_metrics: result.risk_metrics,
    });
  }

  const firstProbability = timeline[0]?.outcome_probability ?? 0;
  const lastProbability = timeline[timeline.length - 1]?.outcome_probability ?? 0;

  return {
    forecast_meta: {
      simulations_run: numSims,
      model_version: MODEL_VERSION,
      periods,
      growth_mode: growthMode,
      uncertainty_growth: round(uncertaintyGrowth, 6),
    },
    timeline,
    summary: {
      start_probability: firstProbability,
      end_probability: lastProbability,
      net_change: round(lastProbability - firstProbability),
    },
  };
}
function runComposed(numSims, payload, options = {}) {
  const simCount = validateSimCount(numSims);
  if (simCount.error) {
    return simCount.error;
  }

  if (!isPlainObject(payload)) {
    return createError("invalid_composed_request", "request body must be an object");
  }

  const allowedKeys = new Set(["components"]);
  const keyCheck = validateAllowedKeys(payload, allowedKeys, "invalid_composed_request");
  if (keyCheck.error) {
    return keyCheck.error;
  }

  if (!Array.isArray(payload.components) || payload.components.length === 0) {
    return createError(
      "invalid_composed_request",
      "components must be a non-empty array",
    );
  }

  if (payload.components.length > 25) {
    return createError(
      "invalid_composed_request",
      "components cannot contain more than 25 entries",
    );
  }

  const normalizedComponents = [];
  for (let index = 0; index < payload.components.length; index += 1) {
    const component = payload.components[index];
    if (!isPlainObject(component)) {
      return createError(
        "invalid_composed_request",
        `components[${index}] must be an object`,
      );
    }

    const allowedComponentKeys = new Set([
      "label",
      "weight",
      "scenario",
      "parameters",
      "weights",
      "uncertainty",
      "outcome_noise",
      "bias",
      "threshold",
    ]);
    const componentKeyCheck = validateAllowedKeys(
      component,
      allowedComponentKeys,
      "invalid_composed_request",
    );
    if (componentKeyCheck.error) {
      return componentKeyCheck.error;
    }

    const scenarioPayload = toScenarioPayload(component, {
      metaKeys: new Set(["label", "weight"]),
    });
    if (scenarioPayload.error) {
      return {
        ...scenarioPayload.error,
        details: {
          ...(scenarioPayload.error.details ?? {}),
          component_index: index,
        },
      };
    }

    const normalizedScenario = normalizeScenario(scenarioPayload.value);
    if (normalizedScenario.error) {
      return {
        ...normalizedScenario.error,
        details: {
          ...(normalizedScenario.error.details ?? {}),
          component_index: index,
        },
      };
    }

    const weight = component.weight ?? 1;
    if (!isFiniteNumber(weight) || weight <= 0) {
      return createError(
        "invalid_composed_request",
        `components[${index}].weight must be a finite number > 0`,
      );
    }

    normalizedComponents.push({
      label:
        typeof component.label === "string" && component.label.trim() !== ""
          ? component.label.trim()
          : `component_${index + 1}`,
      weight,
      scenario: normalizedScenario.value,
    });
  }

  const totalWeight = normalizedComponents.reduce((acc, item) => acc + item.weight, 0);
  const components = normalizedComponents.map((component) => {
    const result = runTrials(numSims, component.scenario, {
      seed: deriveSeed(options.seed, `composed:${component.label}`),
    });
    return {
      label: component.label,
      weight: round(component.weight, 6),
      normalized_weight: round(component.weight / totalWeight, 6),
      result,
    };
  });

  const weightedProbability = components.reduce(
    (acc, component) =>
      acc + component.result.outcome_probability * component.normalized_weight,
    0,
  );
  const weightedMeanScore = components.reduce(
    (acc, component) =>
      acc + component.result.score_distribution.mean * component.normalized_weight,
    0,
  );
  const weightedCiLow = components.reduce(
    (acc, component) =>
      acc + component.result.confidence_interval_95.low * component.normalized_weight,
    0,
  );
  const weightedCiHigh = components.reduce(
    (acc, component) =>
      acc + component.result.confidence_interval_95.high * component.normalized_weight,
    0,
  );

  return {
    composed_meta: {
      simulations_run: numSims,
      model_version: MODEL_VERSION,
      components: components.length,
    },
    components,
    composed_outcome: {
      outcome_probability: round(weightedProbability),
      confidence_interval_95: {
        low: round(weightedCiLow),
        high: round(weightedCiHigh),
      },
      mean_score: round(weightedMeanScore),
    },
  };
}

function buildOptimizationBounds(parameters, rawBounds) {
  if (rawBounds === undefined) {
    const defaultBounds = {};
    for (const key of Object.keys(parameters)) {
      const center = parameters[key];
      const spread = Math.max(0.25, Math.abs(center) * 0.5);
      defaultBounds[key] = {
        min: center - spread,
        max: center + spread,
      };
    }
    return { value: defaultBounds };
  }

  if (!isPlainObject(rawBounds)) {
    return {
      error: createError("invalid_optimize_request", "bounds must be an object"),
    };
  }

  const unknownKeys = Object.keys(rawBounds).filter((key) => !(key in parameters));
  if (unknownKeys.length > 0) {
    return {
      error: createError(
        "invalid_optimize_request",
        `bounds include unknown parameter(s): ${unknownKeys.join(", ")}`,
        { unknown_parameters: unknownKeys },
      ),
    };
  }

  const bounds = {};
  for (const key of Object.keys(parameters)) {
    const bound = rawBounds[key];
    if (!isPlainObject(bound)) {
      const center = parameters[key];
      const spread = Math.max(0.25, Math.abs(center) * 0.5);
      bounds[key] = {
        min: center - spread,
        max: center + spread,
      };
      continue;
    }

    if (!isFiniteNumber(bound.min) || !isFiniteNumber(bound.max) || bound.min >= bound.max) {
      return {
        error: createError(
          "invalid_optimize_request",
          `bounds.${key} must include finite min < max`,
          { field: `bounds.${key}` },
        ),
      };
    }

    bounds[key] = {
      min: bound.min,
      max: bound.max,
    };
  }

  return { value: bounds };
}

function drawRandomCandidate(bounds) {
  return drawRandomCandidateWithRandom(bounds, Math.random);
}

function drawRandomCandidateWithRandom(bounds, random) {
  const candidate = {};
  for (const key of Object.keys(bounds)) {
    const min = bounds[key].min;
    const max = bounds[key].max;
    candidate[key] = min + random() * (max - min);
  }

  return candidate;
}

function objectiveValue(objective, result) {
  if (objective === "mean_score") {
    return result.score_distribution.mean;
  }

  return result.outcome_probability;
}

function runOptimize(numSims, payload, options = {}) {
  const simCount = validateSimCount(numSims);
  if (simCount.error) {
    return simCount.error;
  }

  if (!isPlainObject(payload)) {
    return createError("invalid_optimize_request", "request body must be an object");
  }

  const allowedKeys = new Set([
    "scenario",
    "parameters",
    "weights",
    "uncertainty",
    "outcome_noise",
    "bias",
    "threshold",
    "bounds",
    "iterations",
    "objective",
  ]);
  const keyCheck = validateAllowedKeys(payload, allowedKeys, "invalid_optimize_request");
  if (keyCheck.error) {
    return keyCheck.error;
  }

  const scenarioPayload = toScenarioPayload(payload, {
    metaKeys: new Set(["bounds", "iterations", "objective"]),
  });
  if (scenarioPayload.error) {
    return scenarioPayload.error;
  }

  const normalized = normalizeScenario(scenarioPayload.value);
  if (normalized.error) {
    return normalized.error;
  }

  const objective = payload.objective ?? "outcome_probability";
  if (objective !== "outcome_probability" && objective !== "mean_score") {
    return createError(
      "invalid_optimize_request",
      'objective must be either "outcome_probability" or "mean_score"',
    );
  }

  const iterations = payload.iterations ?? DEFAULT_OPTIMIZATION_ITERATIONS;
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 500) {
    return createError(
      "invalid_optimize_request",
      "iterations must be an integer between 1 and 500",
    );
  }

  const boundsResult = buildOptimizationBounds(
    normalized.value.parameters,
    payload.bounds,
  );
  if (boundsResult.error) {
    return boundsResult.error;
  }

  const bounds = boundsResult.value;
  const optimizationRandom = createRandomSource({
    seed: deriveSeed(options.seed, "optimize:candidates"),
  });
  const baseResult = runTrials(numSims, normalized.value, {
    seed: deriveSeed(options.seed, "optimize:baseline"),
  });
  let bestParameters = { ...normalized.value.parameters };
  let bestResult = baseResult;
  let bestObjectiveValue = objectiveValue(objective, baseResult);

  for (let i = 0; i < iterations; i += 1) {
    const candidateParameters = drawRandomCandidateWithRandom(bounds, optimizationRandom);
    const candidateScenario = {
      ...normalized.value,
      parameters: candidateParameters,
    };
    const candidateResult = runTrials(numSims, candidateScenario, {
      seed: deriveSeed(options.seed, `optimize:candidate:${i}`),
    });
    const score = objectiveValue(objective, candidateResult);
    if (score > bestObjectiveValue) {
      bestObjectiveValue = score;
      bestParameters = candidateParameters;
      bestResult = candidateResult;
    }
  }

  const improvement =
    objective === "mean_score"
      ? bestResult.score_distribution.mean - baseResult.score_distribution.mean
      : bestResult.outcome_probability - baseResult.outcome_probability;

  return {
    optimization_meta: {
      simulations_run: numSims,
      model_version: MODEL_VERSION,
      objective,
      iterations_evaluated: iterations + 1,
    },
    baseline: {
      parameters: Object.fromEntries(
        Object.entries(normalized.value.parameters).map(([key, value]) => [key, round(value, 6)]),
      ),
      result: baseResult,
    },
    optimum: {
      parameters: Object.fromEntries(
        Object.entries(bestParameters).map(([key, value]) => [key, round(value, 6)]),
      ),
      result: bestResult,
      objective_value: round(bestObjectiveValue),
    },
    improvement: round(improvement),
    bounds: Object.fromEntries(
      Object.entries(bounds).map(([key, value]) => [
        key,
        {
          min: round(value.min, 6),
          max: round(value.max, 6),
        },
      ]),
    ),
  };
}

module.exports = {
  MODEL_VERSION,
  normalizeScenario,
  runBatchProbability,
  runSimulation,
  runCompare,
  runSensitivity,
  runForecast,
  runComposed,
  runOptimize,
};
