const assert = require("node:assert/strict");
const test = require("node:test");
const fetch = require("node-fetch");

const { createApp } = require("./app");

const cashFixture = require("./fixtures/cash-runway-2026-04-03.json");
const pricingFixture = require("./fixtures/pricing-scenario-2026-04-03.json");

const DEFAULT_SEED = 20260403;

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildCashPayload(seed = DEFAULT_SEED, options = {}) {
  const payload = cloneJson(cashFixture);
  payload.model_options.seed = seed;
  payload.model_options.include_report = Boolean(options.includeReport);
  payload.model_options.include_artifacts = options.includeArtifacts || [];
  if (options.simulations) {
    payload.model_options.simulations = options.simulations;
  }
  if (options.horizonMonths) {
    payload.model_options.horizon_months = options.horizonMonths;
  }
  return payload;
}

function buildPricingPayload(seed = DEFAULT_SEED, options = {}) {
  const payload = cloneJson(pricingFixture);
  payload.model_options.seed = seed;
  payload.model_options.include_report = Boolean(options.includeReport);
  payload.model_options.include_artifacts = options.includeArtifacts || [];
  if (options.simulations) {
    payload.model_options.simulations = options.simulations;
  }
  if (options.horizonMonths) {
    payload.model_options.horizon_months = options.horizonMonths;
  }
  return payload;
}

function withServer(app, run) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", async () => {
      try {
        const { port } = server.address();
        const result = await run(`http://127.0.0.1:${port}`);
        server.close((closeErr) => {
          if (closeErr) {
            reject(closeErr);
            return;
          }
          resolve(result);
        });
      } catch (error) {
        server.close(() => reject(error));
      }
    });
  });
}

async function postJson(baseUrl, routePath, body) {
  const response = await fetch(`${baseUrl}${routePath}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return { response, payload };
}

function sanitizeForDeterministicCompare(payload) {
  const clone = cloneJson(payload);
  if (!clone || typeof clone !== "object") {
    return clone;
  }

  if (clone.artifacts && typeof clone.artifacts === "object") {
    for (const key of Object.keys(clone.artifacts)) {
      if (key === "recommended_local_path") {
        continue;
      }
      if (clone.artifacts[key] && typeof clone.artifacts[key] === "object") {
        delete clone.artifacts[key].artifact;
      }
    }
  }

  return clone;
}

test("cash runway forecast returns workflow contract", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const { response, payload } = await postJson(
      baseUrl,
      "/api/workflows/finance/cash-runway-forecast",
      buildCashPayload(12345),
    );

    assert.equal(response.status, 200);
    assert.equal(payload.workflow_meta.workflow, "finance.cash_runway_forecast");
    assert.equal(payload.workflow_meta.mode, "single_case");
    assert.equal(typeof payload.summary, "object");
    assert.equal(typeof payload.summary.median_runway_months, "number");
    assert.ok(Array.isArray(payload.timeline));
    assert.ok(Array.isArray(payload.assumptions));
    assert.equal(typeof payload.diagnostics, "object");
  });
});

test("pricing plan compare returns workflow contract on the primary route", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const primaryPayload = buildPricingPayload(12345);
    primaryPayload.workflow = "finance.pricing_plan_compare";

    const { response, payload } = await postJson(
      baseUrl,
      "/api/workflows/finance/pricing-plan-compare",
      primaryPayload,
    );

    assert.equal(response.status, 200);
    assert.equal(payload.workflow_meta.workflow, "finance.pricing_plan_compare");
    assert.equal(payload.workflow_meta.mode, "plan_compare");
    assert.equal(typeof payload.summary, "object");
    assert.ok(Array.isArray(payload.scenarios));
  });
});

test("pricing scenario forecast returns workflow contract", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const { response, payload } = await postJson(
      baseUrl,
      "/api/workflows/finance/pricing-plan-compare",
      buildPricingPayload(12345),
    );

    assert.equal(response.status, 200);
    assert.equal(payload.workflow_meta.workflow, "finance.pricing_plan_compare");
    assert.equal(payload.workflow_meta.mode, "plan_compare");
    assert.equal(typeof payload.summary, "object");
    assert.equal(typeof payload.summary.best_expected_scenario, "string");
    assert.ok(Array.isArray(payload.scenarios));
    assert.ok(payload.scenarios.length >= 2);
    assert.ok(Array.isArray(payload.assumptions));
    assert.equal(typeof payload.diagnostics, "object");
  });
});

test("cash runway forecast is reproducible for the same seed", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const first = await postJson(
      baseUrl,
      "/api/workflows/finance/cash-runway-forecast",
      buildCashPayload(DEFAULT_SEED),
    );
    const second = await postJson(
      baseUrl,
      "/api/workflows/finance/cash-runway-forecast",
      buildCashPayload(DEFAULT_SEED),
    );

    assert.equal(first.response.status, 200);
    assert.equal(second.response.status, 200);
    assert.deepEqual(
      sanitizeForDeterministicCompare(second.payload),
      sanitizeForDeterministicCompare(first.payload),
    );
  });
});

test("pricing scenario forecast is reproducible for the same seed", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const first = await postJson(
      baseUrl,
      "/api/workflows/finance/pricing-plan-compare",
      buildPricingPayload(DEFAULT_SEED),
    );
    const second = await postJson(
      baseUrl,
      "/api/workflows/finance/pricing-plan-compare",
      buildPricingPayload(DEFAULT_SEED),
    );

    assert.equal(first.response.status, 200);
    assert.equal(second.response.status, 200);
    assert.deepEqual(
      sanitizeForDeterministicCompare(second.payload),
      sanitizeForDeterministicCompare(first.payload),
    );
  });
});

test("cash runway forecast bundles requested artifacts into workflow response", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const { response, payload } = await postJson(
      baseUrl,
      "/api/workflows/finance/cash-runway-forecast",
      buildCashPayload(12345, {
        includeReport: true,
        includeArtifacts: ["xlsx", "pdf"],
      }),
    );

    assert.equal(response.status, 200);
    assert.equal(typeof payload.report, "object");
    assert.equal(typeof payload.artifacts, "object");
    assert.equal(payload.artifacts.xlsx.documentType, "xlsx");
    assert.equal(payload.artifacts.pdf.documentType, "pdf");
    assert.match(String(payload.artifacts.xlsx.fileName || ""), /\.xlsx$/);
    assert.match(String(payload.artifacts.pdf.fileName || ""), /\.pdf$/);
  });
});

test("pricing scenario forecast bundles requested artifacts into workflow response", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const { response, payload } = await postJson(
      baseUrl,
      "/api/workflows/finance/pricing-plan-compare",
      buildPricingPayload(12345, {
        includeReport: true,
        includeArtifacts: ["xlsx", "docx"],
      }),
    );

    assert.equal(response.status, 200);
    assert.equal(typeof payload.report, "object");
    assert.equal(typeof payload.artifacts, "object");
    assert.equal(payload.artifacts.xlsx.documentType, "xlsx");
    assert.equal(payload.artifacts.docx.documentType, "docx");
    assert.match(String(payload.artifacts.xlsx.fileName || ""), /\.xlsx$/);
    assert.match(String(payload.artifacts.docx.fileName || ""), /\.docx$/);
  });
});

test("cash runway forecast rejects unsupported mode", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const { response, payload } = await postJson(
      baseUrl,
      "/api/workflows/finance/cash-runway-forecast",
      {
        workflow: "finance.cash_runway_forecast",
        mode: "plan_compare",
        inputs: {
          current_cash_usd: 1000,
          monthly_burn_usd: 100,
        },
      },
    );

    assert.equal(response.status, 400);
    assert.equal(payload.error_code, "invalid_mode");
  });
});

test("pricing scenario forecast rejects requests without candidates", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const { response, payload } = await postJson(
      baseUrl,
      "/api/workflows/finance/pricing-plan-compare",
      {
        workflow: "finance.pricing_plan_compare",
        mode: "plan_compare",
        inputs: {
          baseline: pricingFixture.inputs.baseline,
          candidates: [],
        },
      },
    );

    assert.equal(response.status, 400);
    assert.equal(payload.error_code, "invalid_candidates");
  });
});
