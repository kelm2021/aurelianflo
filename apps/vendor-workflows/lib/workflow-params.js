const ALLOWED_MODES = new Set(["single_vendor", "vendor_batch"]);
const ALLOWED_CRITICALITY = new Set(["low", "medium", "high", "critical"]);
const ALLOWED_ARTIFACTS = new Set(["xlsx", "pdf", "docx"]);

const DEFAULT_THRESHOLD = 90;
const DEFAULT_LIMIT = 3;
const CANONICAL_WORKFLOW = "vendor.risk_assessment";
const LEGACY_WORKFLOW = "vendor.risk_forecast";

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
        `Provide a positive integer for model_options.${fieldName}.`,
        `model_options.${fieldName}`,
      ),
    };
  }
  return { value: parsed };
}

function parseThreshold(value) {
  if (value === undefined) {
    return { value: DEFAULT_THRESHOLD };
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    return {
      error: createError(
        "invalid_screening_threshold",
        "screening_threshold must be an integer between 0 and 100",
        "Use an integer threshold from 0 to 100.",
        "model_options.screening_threshold",
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
    .map((item) => String(item).trim().toLowerCase())
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

function normalizeVendor(rawVendor, index) {
  if (!isPlainObject(rawVendor)) {
    return {
      error: createError(
        "invalid_vendor",
        `inputs.vendors[${index}] must be an object`,
        "Provide vendors as objects with at least a non-empty name.",
        `inputs.vendors[${index}]`,
      ),
    };
  }

  const rawName = rawVendor.name;
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name) {
    return {
      error: createError(
        "invalid_vendor_name",
        `inputs.vendors[${index}].name is required`,
        "Set a non-empty vendor name.",
        `inputs.vendors[${index}].name`,
      ),
    };
  }

  let annualSpend = undefined;
  if (rawVendor.annual_spend_usd !== undefined) {
    annualSpend = Number(rawVendor.annual_spend_usd);
    if (!Number.isFinite(annualSpend) || annualSpend < 0) {
      return {
        error: createError(
          "invalid_annual_spend_usd",
          `inputs.vendors[${index}].annual_spend_usd must be a non-negative number`,
          "Use a non-negative number for annual spend.",
          `inputs.vendors[${index}].annual_spend_usd`,
        ),
      };
    }
  }

  const criticality = String(rawVendor.criticality || "medium").trim().toLowerCase();
  if (!ALLOWED_CRITICALITY.has(criticality)) {
    return {
      error: createError(
        "invalid_criticality",
        `inputs.vendors[${index}].criticality must be low, medium, high, or critical`,
        "Use one of low, medium, high, critical.",
        `inputs.vendors[${index}].criticality`,
      ),
    };
  }

  const country = rawVendor.country === undefined || rawVendor.country === null
    ? undefined
    : String(rawVendor.country).trim().toUpperCase();

  return {
    value: {
      name,
      country: country || undefined,
      criticality,
      annual_spend_usd: annualSpend,
      cross_border: Boolean(rawVendor.cross_border),
      service_category: rawVendor.service_category ? String(rawVendor.service_category).trim() : undefined,
      notes: rawVendor.notes ? String(rawVendor.notes).trim() : undefined,
    },
  };
}

function parseWorkflowParams(req) {
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
  if (!ALLOWED_MODES.has(body.mode)) {
    return {
      error: createError(
        "invalid_mode",
        "mode must be single_vendor or vendor_batch",
        "Set mode to single_vendor or vendor_batch.",
        "mode",
      ),
    };
  }

  if (!isPlainObject(body.inputs) || !Array.isArray(body.inputs.vendors)) {
    return {
      error: createError(
        "missing_vendors",
        "inputs.vendors must be an array",
        "Provide inputs.vendors as an array with one or more vendors.",
        "inputs.vendors",
      ),
    };
  }

  const rawVendors = body.inputs.vendors;
  if (rawVendors.length === 0) {
    return {
      error: createError(
        "missing_vendors",
        "inputs.vendors must contain at least one vendor",
        "Provide at least one vendor.",
        "inputs.vendors",
      ),
    };
  }
  if (rawVendors.length > 25) {
    return {
      error: createError(
        "too_many_vendors",
        "inputs.vendors supports at most 25 vendors",
        "Split requests larger than 25 vendors into batches.",
        "inputs.vendors",
      ),
    };
  }

  if (body.mode === "single_vendor" && rawVendors.length !== 1) {
    return {
      error: createError(
        "single_vendor_requires_exactly_one_vendor",
        "single_vendor mode requires exactly one vendor",
        "Provide one vendor or switch mode to vendor_batch.",
        "inputs.vendors",
      ),
    };
  }

  const normalizedVendors = [];
  for (let i = 0; i < rawVendors.length; i += 1) {
    const normalized = normalizeVendor(rawVendors[i], i);
    if (normalized.error) {
      return { error: normalized.error };
    }
    normalizedVendors.push(normalized.value);
  }

  const seen = new Set();
  for (let i = 0; i < normalizedVendors.length; i += 1) {
    const vendor = normalizedVendors[i];
    const key = `${vendor.name.toLowerCase()}|${(vendor.country || "").toLowerCase()}`;
    if (seen.has(key)) {
      return {
        error: createError(
          "duplicate_vendor_names",
          "duplicate vendor name/country combination detected",
          "Ensure each vendor appears once per request.",
          `inputs.vendors[${i}]`,
        ),
      };
    }
    seen.add(key);
  }

  const seedResult = parsePositiveInteger(body.model_options?.seed, "seed", undefined);
  if (seedResult.error) {
    return { error: seedResult.error };
  }

  const thresholdResult = parseThreshold(body.model_options?.screening_threshold);
  if (thresholdResult.error) {
    return { error: thresholdResult.error };
  }

  const limitResult = parsePositiveInteger(body.model_options?.screening_limit, "screening_limit", DEFAULT_LIMIT);
  if (limitResult.error) {
    return { error: limitResult.error };
  }

  const artifactResult = parseArtifacts(body.model_options?.include_artifacts);
  if (artifactResult.error) {
    return { error: artifactResult.error };
  }

  const workflow = body.workflow == null ? CANONICAL_WORKFLOW : String(body.workflow);
  if (workflow !== CANONICAL_WORKFLOW && workflow !== LEGACY_WORKFLOW) {
    return {
      error: createError(
        "invalid_workflow",
        `workflow must be ${CANONICAL_WORKFLOW} or ${LEGACY_WORKFLOW}`,
        `Set workflow to ${CANONICAL_WORKFLOW}.`,
        "workflow",
      ),
    };
  }

  return {
    value: {
      asOfDate: body.as_of_date || new Date().toISOString().slice(0, 10),
      workflow: workflow === LEGACY_WORKFLOW ? CANONICAL_WORKFLOW : workflow,
      mode: body.mode,
      vendors: normalizedVendors,
      options: {
        seed: seedResult.value,
        screening_threshold: thresholdResult.value,
        screening_limit: limitResult.value,
        include_report: Boolean(body.model_options?.include_report),
        include_artifacts: artifactResult.value,
      },
    },
  };
}

module.exports = {
  CANONICAL_WORKFLOW,
  LEGACY_WORKFLOW,
  createError,
  parseWorkflowParams,
};
