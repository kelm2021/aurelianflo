const fetch = require("node-fetch");

const { createApp } = require("./app");

const DEFAULT_SEED = 20260403;

function buildVendorBatchPayload(seed = DEFAULT_SEED, options = {}) {
  return {
    as_of_date: "2026-04-03",
    workflow: "vendor.risk_assessment",
    mode: "vendor_batch",
    inputs: {
      vendors: [
        {
          name: "SBERBANK",
          country: "CZ",
          criticality: "high",
          annual_spend_usd: 2500000,
          cross_border: true,
          service_category: "banking",
        },
        {
          name: "ACME LOGISTICS LLC",
          country: "US",
          criticality: "medium",
          annual_spend_usd: 900000,
          cross_border: false,
          service_category: "logistics",
        },
        {
          name: "NOVA PAYMENTS LTD",
          country: "GB",
          criticality: "high",
          annual_spend_usd: 1700000,
          cross_border: true,
          service_category: "payments",
        },
      ],
    },
    model_options: {
      seed,
      screening_threshold: 90,
      screening_limit: 3,
      include_report: Boolean(options.includeReport),
      include_artifacts: options.includeArtifacts || [],
    },
  };
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

async function postJson(baseUrl, body) {
  const response = await fetch(`${baseUrl}/api/workflows/vendor/risk-assessment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return { response, payload };
}

function sanitizeForDeterministicCompare(payload) {
  const clone = JSON.parse(JSON.stringify(payload));
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

  console.log("=== Vendor Workflow Canary ===");
  console.log(`Seed: ${DEFAULT_SEED}\n`);

  await withServer(app, async (baseUrl) => {
    const baseline = await postJson(baseUrl, buildVendorBatchPayload(DEFAULT_SEED));
    const repeat = await postJson(baseUrl, buildVendorBatchPayload(DEFAULT_SEED));
    const withArtifacts = await postJson(
      baseUrl,
      buildVendorBatchPayload(DEFAULT_SEED, { includeReport: true, includeArtifacts: ["xlsx"] }),
    );
    const invalid = await postJson(baseUrl, {
      workflow: "vendor.risk_assessment",
      mode: "invalid_mode",
      inputs: { vendors: [{ name: "SBERBANK" }] },
    });

    const checks = [
      {
        name: "baseline returns 200",
        ok: baseline.response.status === 200,
        detail: `got ${baseline.response.status}`,
      },
      {
        name: "repeat returns 200",
        ok: repeat.response.status === 200,
        detail: `got ${repeat.response.status}`,
      },
      {
        name: "same seed is reproducible",
        ok:
          JSON.stringify(sanitizeForDeterministicCompare(baseline.payload)) ===
          JSON.stringify(sanitizeForDeterministicCompare(repeat.payload)),
        detail: "baseline payload did not match repeat payload",
      },
      {
        name: "summary object is present",
        ok: typeof baseline.payload?.summary === "object" && baseline.payload.summary !== null,
        detail: `summary was ${JSON.stringify(baseline.payload?.summary ?? null)}`,
      },
      {
        name: "vendors array is non-empty",
        ok: Array.isArray(baseline.payload?.vendors) && baseline.payload.vendors.length > 0,
        detail: `vendors length was ${baseline.payload?.vendors?.length ?? 0}`,
      },
      {
        name: "xlsx artifact is bundled when requested",
        ok:
          withArtifacts.payload?.artifacts === undefined ||
          withArtifacts.payload?.artifacts?.xlsx?.documentType === "xlsx",
        detail: `xlsx artifact was ${JSON.stringify(withArtifacts.payload?.artifacts?.xlsx ?? null)}`,
      },
      {
        name: "unsupported mode returns 400",
        ok: invalid.response.status === 400,
        detail: `got ${invalid.response.status}`,
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
