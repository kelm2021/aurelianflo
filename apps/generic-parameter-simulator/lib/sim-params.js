const DEFAULT_SIMS = 10000;
const MIN_SIMS = 100;
const MAX_SIMS = 100000;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseStrictInteger(candidate) {
  if (typeof candidate === "number") {
    return Number.isInteger(candidate) ? candidate : null;
  }

  if (typeof candidate !== "string") {
    return null;
  }

  const trimmed = candidate.trim();
  if (!/^[-+]?\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) {
    return null;
  }

  return parsed;
}

function parseIntegerInput(candidate, options = {}) {
  const {
    field = "value",
    min = Number.MIN_SAFE_INTEGER,
    max = Number.MAX_SAFE_INTEGER,
    defaultValue,
    required = false,
  } = options;

  if (candidate === undefined) {
    if (required && defaultValue === undefined) {
      return {
        error: {
          error: `invalid_${field}`,
          message: `${field} is required`,
        },
      };
    }

    if (defaultValue !== undefined) {
      return { value: defaultValue };
    }

    return { value: undefined };
  }

  const parsed = parseStrictInteger(candidate);
  if (parsed === null || parsed < min || parsed > max) {
    return {
      error: {
        error: `invalid_${field}`,
        message: `${field} must be an integer between ${min} and ${max}`,
      },
    };
  }

  return { value: parsed };
}

function parseSimCount(req, options = {}) {
  const defaultSims = options.defaultSims ?? DEFAULT_SIMS;
  const minSims = options.minSims ?? MIN_SIMS;
  const maxSims = options.maxSims ?? MAX_SIMS;
  const candidate = req.query?.sims ?? req.body?.sims;

  return parseIntegerInput(candidate, {
    field: "sims",
    min: minSims,
    max: maxSims,
    defaultValue: defaultSims,
  });
}

function parseSeed(req, options = {}) {
  const candidate = req.query?.seed ?? req.body?.seed;

  return parseIntegerInput(candidate, {
    field: "seed",
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    defaultValue: options.defaultSeed,
  });
}

function parseScenarioBody(req) {
  if (!isPlainObject(req.body)) {
    return {};
  }

  const { sims: _ignoredSims, seed: _ignoredSeed, ...scenario } = req.body;
  return scenario;
}

function parseSimParams(req, options = {}) {
  const simCountResult = parseSimCount(req, options);
  if (simCountResult.error) {
    return { error: simCountResult.error };
  }

  const seedResult = parseSeed(req, options);
  if (seedResult.error) {
    return { error: seedResult.error };
  }

  return {
    numSims: simCountResult.value,
    seed: seedResult.value,
    scenario: parseScenarioBody(req),
  };
}

module.exports = {
  DEFAULT_SIMS,
  MIN_SIMS,
  MAX_SIMS,
  parseIntegerInput,
  parseSimCount,
  parseSeed,
  parseSimParams,
};
