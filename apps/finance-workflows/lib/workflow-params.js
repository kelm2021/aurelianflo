const CASH_WORKFLOW_NAME = "finance.cash_runway_forecast";
const PRICING_WORKFLOW_NAME = "finance.pricing_plan_compare";
const PRICING_LEGACY_WORKFLOW_NAME = "finance.pricing_scenario_forecast";
const ALLOWED_ARTIFACTS = new Set(["xlsx", "pdf", "docx"]);

const DEFAULT_SEED = 20260403;
const DEFAULT_SIMULATIONS = 10000;
const DEFAULT_HORIZON_MONTHS = 24;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function createError(error_code, message, fix_hint, input_path) {
  return {
    error: error_code,
    error_code,
    message,
    ...(fix_hint ? { fix_hint } : {}),
    ...(input_path ? { input_path } : {}),
  };
}

function parsePositiveInteger(value, fieldName, defaultValue) {
  if (value === undefined) {
    return { value: defaultValue };
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return {
      error: createError(
        `invalid_${fieldName}`,
        `${fieldName} must be a positive integer`,
        `Provide a positive integer for ${fieldName}.`,
        fieldName,
      ),
    };
  }

  return { value: parsed };
}

function parseNumberInRange(value, fieldName, options = {}) {
  if (value === undefined) {
    return { value: options.defaultValue };
  }

  const parsed = Number(value);
  const min = options.min ?? Number.NEGATIVE_INFINITY;
  const max = options.max ?? Number.POSITIVE_INFINITY;
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return {
      error: createError(
        `invalid_${fieldName}`,
        `${fieldName} must be a finite number between ${min} and ${max}`,
        options.fixHint || `Provide ${fieldName} in the supported range.`,
        fieldName,
      ),
    };
  }

  return { value: parsed };
}

function parseArtifacts(value) {
  if (value === undefined) {
    return { value: [] };
  }

  if (!Array.isArray(value)) {
    return {
      error: createError(
        "invalid_include_artifacts",
        "include_artifacts must be an array",
        "Set model_options.include_artifacts to an array of xlsx, pdf, or docx.",
        "model_options.include_artifacts",
      ),
    };
  }

  const artifacts = value
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);

  for (const artifact of artifacts) {
    if (!ALLOWED_ARTIFACTS.has(artifact)) {
      return {
        error: createError(
          "invalid_include_artifacts",
          `unsupported artifact type: ${artifact}`,
          "Only xlsx, pdf, and docx are supported.",
          "model_options.include_artifacts",
        ),
      };
    }
  }

  return { value: artifacts };
}

function parseCommonModelOptions(modelOptions) {
  if (modelOptions !== undefined && !isPlainObject(modelOptions)) {
    return {
      error: createError(
        "invalid_model_options",
        "model_options must be an object when provided",
        "Send model_options as a JSON object.",
        "model_options",
      ),
    };
  }

  const seedResult = parsePositiveInteger(
    modelOptions?.seed,
    "model_options.seed",
    DEFAULT_SEED,
  );
  if (seedResult.error) {
    return { error: seedResult.error };
  }

  const simulationsResult = parsePositiveInteger(
    modelOptions?.simulations,
    "model_options.simulations",
    DEFAULT_SIMULATIONS,
  );
  if (simulationsResult.error) {
    return { error: simulationsResult.error };
  }

  const horizonResult = parsePositiveInteger(
    modelOptions?.horizon_months,
    "model_options.horizon_months",
    DEFAULT_HORIZON_MONTHS,
  );
  if (horizonResult.error) {
    return { error: horizonResult.error };
  }

  const artifactsResult = parseArtifacts(modelOptions?.include_artifacts);
  if (artifactsResult.error) {
    return { error: artifactsResult.error };
  }

  return {
    value: {
      seed: seedResult.value,
      simulations: simulationsResult.value,
      horizon_months: horizonResult.value,
      include_report: Boolean(modelOptions?.include_report),
      include_artifacts: artifactsResult.value,
    },
  };
}

function parseCashInputs(inputs) {
  if (!isPlainObject(inputs)) {
    return {
      error: createError(
        "invalid_inputs",
        "inputs must be an object",
        "Provide workflow inputs as a JSON object.",
        "inputs",
      ),
    };
  }

  const currentCashResult = parseNumberInRange(
    inputs.current_cash_usd,
    "inputs.current_cash_usd",
    {
      min: 0,
      max: 1_000_000_000_000,
      defaultValue: undefined,
      fixHint: "Provide a non-negative cash balance in USD.",
    },
  );
  if (currentCashResult.error || currentCashResult.value === undefined) {
    return {
      error: currentCashResult.error || createError(
        "missing_current_cash_usd",
        "inputs.current_cash_usd is required",
        "Provide inputs.current_cash_usd.",
        "inputs.current_cash_usd",
      ),
    };
  }

  const monthlyBurnResult = parseNumberInRange(
    inputs.monthly_burn_usd,
    "inputs.monthly_burn_usd",
    {
      min: 0.01,
      max: 1_000_000_000_000,
      defaultValue: undefined,
      fixHint: "Provide a positive monthly burn in USD.",
    },
  );
  if (monthlyBurnResult.error || monthlyBurnResult.value === undefined) {
    return {
      error: monthlyBurnResult.error || createError(
        "missing_monthly_burn_usd",
        "inputs.monthly_burn_usd is required",
        "Provide inputs.monthly_burn_usd.",
        "inputs.monthly_burn_usd",
      ),
    };
  }

  const monthlyRevenueResult = parseNumberInRange(
    inputs.monthly_revenue_usd,
    "inputs.monthly_revenue_usd",
    {
      min: 0,
      max: 1_000_000_000_000,
      defaultValue: 0,
      fixHint: "Provide a non-negative monthly revenue estimate in USD.",
    },
  );
  if (monthlyRevenueResult.error) {
    return { error: monthlyRevenueResult.error };
  }

  const burnGrowthResult = parseNumberInRange(
    inputs.burn_growth_rate_monthly,
    "inputs.burn_growth_rate_monthly",
    {
      min: -0.95,
      max: 5,
      defaultValue: 0,
      fixHint: "Provide a decimal monthly growth rate between -0.95 and 5.",
    },
  );
  if (burnGrowthResult.error) {
    return { error: burnGrowthResult.error };
  }

  const revenueGrowthResult = parseNumberInRange(
    inputs.revenue_growth_rate_monthly,
    "inputs.revenue_growth_rate_monthly",
    {
      min: -0.95,
      max: 5,
      defaultValue: 0,
      fixHint: "Provide a decimal monthly growth rate between -0.95 and 5.",
    },
  );
  if (revenueGrowthResult.error) {
    return { error: revenueGrowthResult.error };
  }

  const burnVolatilityResult = parseNumberInRange(
    inputs.burn_volatility_pct,
    "inputs.burn_volatility_pct",
    {
      min: 0,
      max: 2,
      defaultValue: 0.12,
      fixHint: "Provide a burn volatility decimal between 0 and 2.",
    },
  );
  if (burnVolatilityResult.error) {
    return { error: burnVolatilityResult.error };
  }

  const revenueVolatilityResult = parseNumberInRange(
    inputs.revenue_volatility_pct,
    "inputs.revenue_volatility_pct",
    {
      min: 0,
      max: 2,
      defaultValue: 0.15,
      fixHint: "Provide a revenue volatility decimal between 0 and 2.",
    },
  );
  if (revenueVolatilityResult.error) {
    return { error: revenueVolatilityResult.error };
  }

  const thresholdResult = parseNumberInRange(
    inputs.runway_threshold_usd,
    "inputs.runway_threshold_usd",
    {
      min: 0,
      max: 1_000_000_000_000,
      defaultValue: 0,
      fixHint: "Provide a non-negative runway threshold in USD.",
    },
  );
  if (thresholdResult.error) {
    return { error: thresholdResult.error };
  }

  const companyName = inputs.company_name == null
    ? undefined
    : String(inputs.company_name).trim();

  return {
    value: {
      company_name: companyName || undefined,
      current_cash_usd: currentCashResult.value,
      monthly_burn_usd: monthlyBurnResult.value,
      monthly_revenue_usd: monthlyRevenueResult.value,
      burn_growth_rate_monthly: burnGrowthResult.value,
      revenue_growth_rate_monthly: revenueGrowthResult.value,
      burn_volatility_pct: burnVolatilityResult.value,
      revenue_volatility_pct: revenueVolatilityResult.value,
      runway_threshold_usd: thresholdResult.value,
    },
  };
}

function normalizeScenario(rawScenario, path) {
  if (!isPlainObject(rawScenario)) {
    return {
      error: createError(
        "invalid_scenario",
        `${path} must be an object`,
        "Provide scenario values as an object.",
        path,
      ),
    };
  }

  const label = String(rawScenario.label || "").trim();
  if (!label) {
    return {
      error: createError(
        "invalid_scenario_label",
        `${path}.label is required`,
        "Provide a non-empty scenario label.",
        `${path}.label`,
      ),
    };
  }

  const monthlyVisitorsResult = parseNumberInRange(
    rawScenario.monthly_visitors,
    `${path}.monthly_visitors`,
    {
      min: 0,
      max: 100_000_000,
      defaultValue: undefined,
      fixHint: "Provide a non-negative monthly visitor count.",
    },
  );
  if (monthlyVisitorsResult.error || monthlyVisitorsResult.value === undefined) {
    return {
      error: monthlyVisitorsResult.error || createError(
        "missing_monthly_visitors",
        `${path}.monthly_visitors is required`,
        "Provide monthly visitors for the scenario.",
        `${path}.monthly_visitors`,
      ),
    };
  }

  const conversionRateResult = parseNumberInRange(
    rawScenario.conversion_rate,
    `${path}.conversion_rate`,
    {
      min: 0,
      max: 1,
      defaultValue: undefined,
      fixHint: "Provide conversion_rate as a decimal between 0 and 1.",
    },
  );
  if (conversionRateResult.error || conversionRateResult.value === undefined) {
    return {
      error: conversionRateResult.error || createError(
        "missing_conversion_rate",
        `${path}.conversion_rate is required`,
        "Provide conversion_rate for the scenario.",
        `${path}.conversion_rate`,
      ),
    };
  }

  const priceResult = parseNumberInRange(
    rawScenario.price_usd,
    `${path}.price_usd`,
    {
      min: 0,
      max: 1_000_000,
      defaultValue: undefined,
      fixHint: "Provide a non-negative price in USD.",
    },
  );
  if (priceResult.error || priceResult.value === undefined) {
    return {
      error: priceResult.error || createError(
        "missing_price_usd",
        `${path}.price_usd is required`,
        "Provide price_usd for the scenario.",
        `${path}.price_usd`,
      ),
    };
  }

  const variableCostResult = parseNumberInRange(
    rawScenario.variable_cost_usd,
    `${path}.variable_cost_usd`,
    {
      min: 0,
      max: 1_000_000,
      defaultValue: undefined,
      fixHint: "Provide a non-negative variable_cost_usd.",
    },
  );
  if (variableCostResult.error || variableCostResult.value === undefined) {
    return {
      error: variableCostResult.error || createError(
        "missing_variable_cost_usd",
        `${path}.variable_cost_usd is required`,
        "Provide variable_cost_usd for the scenario.",
        `${path}.variable_cost_usd`,
      ),
    };
  }

  const retentionResult = parseNumberInRange(
    rawScenario.retention_months,
    `${path}.retention_months`,
    {
      min: 0.1,
      max: 120,
      defaultValue: undefined,
      fixHint: "Provide a positive retention_months value.",
    },
  );
  if (retentionResult.error || retentionResult.value === undefined) {
    return {
      error: retentionResult.error || createError(
        "missing_retention_months",
        `${path}.retention_months is required`,
        "Provide retention_months for the scenario.",
        `${path}.retention_months`,
      ),
    };
  }

  const fixedCostResult = parseNumberInRange(
    rawScenario.fixed_cost_usd,
    `${path}.fixed_cost_usd`,
    {
      min: 0,
      max: 1_000_000_000,
      defaultValue: undefined,
      fixHint: "Provide a non-negative fixed_cost_usd.",
    },
  );
  if (fixedCostResult.error || fixedCostResult.value === undefined) {
    return {
      error: fixedCostResult.error || createError(
        "missing_fixed_cost_usd",
        `${path}.fixed_cost_usd is required`,
        "Provide fixed_cost_usd for the scenario.",
        `${path}.fixed_cost_usd`,
      ),
    };
  }

  return {
    value: {
      label,
      monthly_visitors: monthlyVisitorsResult.value,
      conversion_rate: conversionRateResult.value,
      price_usd: priceResult.value,
      variable_cost_usd: variableCostResult.value,
      retention_months: retentionResult.value,
      fixed_cost_usd: fixedCostResult.value,
    },
  };
}

function parsePricingInputs(inputs) {
  if (!isPlainObject(inputs)) {
    return {
      error: createError(
        "invalid_inputs",
        "inputs must be an object",
        "Provide workflow inputs as a JSON object.",
        "inputs",
      ),
    };
  }

  const baselineResult = normalizeScenario(inputs.baseline, "inputs.baseline");
  if (baselineResult.error) {
    return { error: baselineResult.error };
  }

  const rawCandidates = inputs.candidates;
  if (!Array.isArray(rawCandidates) || rawCandidates.length === 0) {
    return {
      error: createError(
        "invalid_candidates",
        "inputs.candidates must be a non-empty array",
        "Provide one or more candidate scenarios.",
        "inputs.candidates",
      ),
    };
  }
  if (rawCandidates.length > 20) {
    return {
      error: createError(
        "too_many_candidates",
        "inputs.candidates supports at most 20 scenarios",
        "Split larger comparisons into multiple requests.",
        "inputs.candidates",
      ),
    };
  }

  const candidates = [];
  for (let index = 0; index < rawCandidates.length; index += 1) {
    const candidateResult = normalizeScenario(
      rawCandidates[index],
      `inputs.candidates[${index}]`,
    );
    if (candidateResult.error) {
      return { error: candidateResult.error };
    }
    candidates.push(candidateResult.value);
  }

  const labels = new Set([baselineResult.value.label.toLowerCase()]);
  for (let index = 0; index < candidates.length; index += 1) {
    const key = candidates[index].label.toLowerCase();
    if (labels.has(key)) {
      return {
        error: createError(
          "duplicate_scenario_label",
          `Duplicate scenario label: ${candidates[index].label}`,
          "Make each scenario label unique.",
          `inputs.candidates[${index}].label`,
        ),
      };
    }
    labels.add(key);
  }

  return {
    value: {
      baseline: baselineResult.value,
      candidates,
    },
  };
}

function parseCashRunwayParams(req) {
  if (!isPlainObject(req.body)) {
    return {
      error: createError(
        "invalid_request",
        "request body must be an object",
        "Send a JSON object body.",
        "body",
      ),
    };
  }

  const body = req.body;
  const workflow = body.workflow == null ? CASH_WORKFLOW_NAME : String(body.workflow);
  if (workflow !== CASH_WORKFLOW_NAME) {
    return {
      error: createError(
        "invalid_workflow",
        `workflow must be ${CASH_WORKFLOW_NAME}`,
        `Set workflow to ${CASH_WORKFLOW_NAME}.`,
        "workflow",
      ),
    };
  }

  if (body.mode !== "single_case") {
    return {
      error: createError(
        "invalid_mode",
        "mode must be single_case",
        "Set mode to single_case for this endpoint.",
        "mode",
      ),
    };
  }

  const inputsResult = parseCashInputs(body.inputs);
  if (inputsResult.error) {
    return { error: inputsResult.error };
  }

  const optionsResult = parseCommonModelOptions(body.model_options);
  if (optionsResult.error) {
    return { error: optionsResult.error };
  }

  return {
    value: {
      asOfDate: body.as_of_date || new Date().toISOString().slice(0, 10),
      workflow,
      mode: "single_case",
      inputs: inputsResult.value,
      options: optionsResult.value,
    },
  };
}

function parsePricingScenarioParams(req) {
  if (!isPlainObject(req.body)) {
    return {
      error: createError(
        "invalid_request",
        "request body must be an object",
        "Send a JSON object body.",
        "body",
      ),
    };
  }

  const body = req.body;
  const workflow = body.workflow == null ? PRICING_WORKFLOW_NAME : String(body.workflow);
  if (workflow !== PRICING_WORKFLOW_NAME && workflow !== PRICING_LEGACY_WORKFLOW_NAME) {
    return {
      error: createError(
        "invalid_workflow",
        `workflow must be ${PRICING_WORKFLOW_NAME} or ${PRICING_LEGACY_WORKFLOW_NAME}`,
        `Set workflow to ${PRICING_WORKFLOW_NAME}.`,
        "workflow",
      ),
    };
  }

  if (body.mode !== "plan_compare") {
    return {
      error: createError(
        "invalid_mode",
        "mode must be plan_compare",
        "Set mode to plan_compare for this endpoint.",
        "mode",
      ),
    };
  }

  const inputsResult = parsePricingInputs(body.inputs);
  if (inputsResult.error) {
    return { error: inputsResult.error };
  }

  const optionsResult = parseCommonModelOptions(body.model_options);
  if (optionsResult.error) {
    return { error: optionsResult.error };
  }

  return {
    value: {
      asOfDate: body.as_of_date || new Date().toISOString().slice(0, 10),
      workflow: PRICING_WORKFLOW_NAME,
      mode: "plan_compare",
      inputs: inputsResult.value,
      options: optionsResult.value,
    },
  };
}

module.exports = {
  CASH_WORKFLOW_NAME,
  PRICING_LEGACY_WORKFLOW_NAME,
  PRICING_WORKFLOW_NAME,
  createError,
  parseCashRunwayParams,
  parsePricingScenarioParams,
};
