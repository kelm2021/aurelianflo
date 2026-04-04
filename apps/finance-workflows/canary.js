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
  return payload;
}

function buildPricingPayload(seed = DEFAULT_SEED, options = {}) {
  const payload = cloneJson(pricingFixture);
  payload.model_options.seed = seed;
  payload.model_options.include_report = Boolean(options.includeReport);
  payload.model_options.include_artifacts = options.includeArtifacts || [];
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

async function postJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
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

async function run() {
  const app = createApp();
  let failures = 0;

  console.log("=== Finance Workflow Canary ===");
  console.log(`Seed: ${DEFAULT_SEED}\n`);

  await withServer(app, async (baseUrl) => {
    const cashA = await postJson(
      baseUrl,
      "/api/workflows/finance/cash-runway-forecast",
      buildCashPayload(DEFAULT_SEED),
    );
    const cashB = await postJson(
      baseUrl,
      "/api/workflows/finance/cash-runway-forecast",
      buildCashPayload(DEFAULT_SEED),
    );
    const cashArtifacts = await postJson(
      baseUrl,
      "/api/workflows/finance/cash-runway-forecast",
      buildCashPayload(DEFAULT_SEED, {
        includeReport: true,
        includeArtifacts: ["xlsx"],
      }),
    );
    const pricingA = await postJson(
      baseUrl,
      "/api/workflows/finance/pricing-plan-compare",
      buildPricingPayload(DEFAULT_SEED),
    );
    const pricingB = await postJson(
      baseUrl,
      "/api/workflows/finance/pricing-plan-compare",
      buildPricingPayload(DEFAULT_SEED),
    );
    const pricingArtifacts = await postJson(
      baseUrl,
      "/api/workflows/finance/pricing-plan-compare",
      buildPricingPayload(DEFAULT_SEED, {
        includeReport: true,
        includeArtifacts: ["xlsx"],
      }),
    );
    const invalidCashMode = await postJson(
      baseUrl,
      "/api/workflows/finance/cash-runway-forecast",
      {
        workflow: "finance.cash_runway_forecast",
        mode: "plan_compare",
        inputs: { current_cash_usd: 1000, monthly_burn_usd: 100 },
      },
    );

    const checks = [
      {
        name: "cash runway baseline returns 200",
        ok: cashA.response.status === 200,
        detail: `got ${cashA.response.status}`,
      },
      {
        name: "cash runway same-seed is reproducible",
        ok:
          JSON.stringify(sanitizeForDeterministicCompare(cashA.payload)) ===
          JSON.stringify(sanitizeForDeterministicCompare(cashB.payload)),
        detail: "baseline payload did not match repeat payload",
      },
      {
        name: "cash runway summary includes runway_status",
        ok: typeof cashA.payload?.summary?.runway_status === "string",
        detail: `runway_status was ${JSON.stringify(cashA.payload?.summary?.runway_status ?? null)}`,
      },
      {
        name: "cash runway xlsx artifact is bundled when requested",
        ok: cashArtifacts.payload?.artifacts?.xlsx?.documentType === "xlsx",
        detail: `xlsx artifact was ${JSON.stringify(cashArtifacts.payload?.artifacts?.xlsx ?? null)}`,
      },
      {
        name: "pricing scenario baseline returns 200",
        ok: pricingA.response.status === 200,
        detail: `got ${pricingA.response.status}`,
      },
      {
        name: "pricing scenario same-seed is reproducible",
        ok:
          JSON.stringify(sanitizeForDeterministicCompare(pricingA.payload)) ===
          JSON.stringify(sanitizeForDeterministicCompare(pricingB.payload)),
        detail: "baseline payload did not match repeat payload",
      },
      {
        name: "pricing summary includes best_expected_scenario",
        ok: typeof pricingA.payload?.summary?.best_expected_scenario === "string",
        detail: `best scenario was ${JSON.stringify(pricingA.payload?.summary?.best_expected_scenario ?? null)}`,
      },
      {
        name: "pricing xlsx artifact is bundled when requested",
        ok: pricingArtifacts.payload?.artifacts?.xlsx?.documentType === "xlsx",
        detail: `xlsx artifact was ${JSON.stringify(pricingArtifacts.payload?.artifacts?.xlsx ?? null)}`,
      },
      {
        name: "invalid cash mode returns 400",
        ok: invalidCashMode.response.status === 400,
        detail: `got ${invalidCashMode.response.status}`,
      },
    ];

    for (const check of checks) {
      if (check.ok) {
        console.log(`PASS ${check.name}`);
      } else {
        failures += 1;
        console.log(`FAIL ${check.name} (${check.detail})`);
      }
    }
  });

  if (failures > 0) {
    console.log(`\nCanary failed with ${failures} assertion(s).`);
    process.exit(1);
  }

  console.log("\nCanary passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
