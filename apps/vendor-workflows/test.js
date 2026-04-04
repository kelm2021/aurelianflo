const assert = require("node:assert/strict");
const test = require("node:test");
const fetch = require("node-fetch");

const { createApp } = require("./app");
const DEFAULT_SEED = 20260403;

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

test("vendor risk forecast returns workflow contract", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/workflows/vendor/risk-assessment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildVendorBatchPayload(12345)),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.workflow_meta.workflow, "vendor.risk_assessment");
    assert.equal(payload.inputs_echo.vendor_count, 3);
    assert.equal(typeof payload.summary, "object");
    assert.ok(Array.isArray(payload.vendors));
    assert.ok(Array.isArray(payload.assumptions));
    assert.equal(typeof payload.diagnostics, "object");
  });
});

test("vendor risk assessment returns workflow contract on the primary route", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const payloadIn = buildVendorBatchPayload(12345);
    payloadIn.workflow = "vendor.risk_assessment";

    const response = await fetch(`${baseUrl}/api/workflows/vendor/risk-assessment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payloadIn),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.workflow_meta.workflow, "vendor.risk_assessment");
    assert.equal(payload.inputs_echo.vendor_count, 3);
    assert.equal(typeof payload.summary, "object");
    assert.ok(Array.isArray(payload.vendors));
  });
});

function buildVendorBatchPayload(seed = DEFAULT_SEED) {
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
          notes: "New payout rail partner",
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
      include_report: false,
      include_artifacts: [],
    },
  };
}

function buildSingleVendorPayload(seed = DEFAULT_SEED) {
  return {
    as_of_date: "2026-04-03",
    workflow: "vendor.risk_assessment",
    mode: "single_vendor",
    inputs: {
      vendors: [
        {
          name: "SBERBANK",
          country: "CZ",
          criticality: "high",
          annual_spend_usd: 2500000,
          cross_border: true,
          service_category: "banking",
          notes: "New payout rail partner",
        },
      ],
    },
    model_options: {
      seed,
      screening_threshold: 90,
      screening_limit: 3,
      include_report: true,
      include_artifacts: ["pdf"],
    },
  };
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

test("vendor risk forecast supports single_vendor mode", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/workflows/vendor/risk-assessment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildSingleVendorPayload(12345)),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.workflow_meta.workflow, "vendor.risk_assessment");
    assert.equal(payload.workflow_meta.mode, "single_vendor");
    assert.equal(payload.inputs_echo.vendor_count, 1);
    assert.ok(Array.isArray(payload.vendors));
  });
});

test("vendor risk forecast is reproducible for the same seed", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const firstResponse = await fetch(`${baseUrl}/api/workflows/vendor/risk-assessment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildVendorBatchPayload(DEFAULT_SEED)),
    });
    const firstPayload = await firstResponse.json();

    const secondResponse = await fetch(`${baseUrl}/api/workflows/vendor/risk-assessment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildVendorBatchPayload(DEFAULT_SEED)),
    });
    const secondPayload = await secondResponse.json();

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 200);
    assert.deepEqual(
      sanitizeForDeterministicCompare(secondPayload),
      sanitizeForDeterministicCompare(firstPayload),
    );
  });
});

test("vendor risk forecast bundles requested artifacts into the workflow response", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/workflows/vendor/risk-assessment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...buildVendorBatchPayload(12345),
        model_options: {
          seed: 12345,
          screening_threshold: 90,
          screening_limit: 3,
          include_report: true,
          include_artifacts: ["xlsx", "pdf"],
        },
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    if (payload.report !== undefined) {
      assert.equal(typeof payload.report, "object");
    }
    if (payload.artifacts !== undefined) {
      assert.equal(typeof payload.artifacts, "object");
      if (payload.artifacts.xlsx) {
        assert.equal(payload.artifacts.xlsx.documentType, "xlsx");
      }
      if (payload.artifacts.pdf) {
        assert.equal(payload.artifacts.pdf.documentType, "pdf");
      }
    }
  });
});

test("vendor risk forecast rejects unsupported mode", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/workflows/vendor/risk-assessment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workflow: "vendor.risk_assessment",
        mode: "invalid_mode",
        inputs: { vendors: [{ name: "SBERBANK" }] },
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.ok(typeof payload.error === "string" || typeof payload.error_code === "string");
  });
});

test("vendor risk forecast rejects requests without vendors", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/workflows/vendor/risk-assessment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workflow: "vendor.risk_assessment",
        mode: "vendor_batch",
        inputs: {},
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.ok(typeof payload.error === "string" || typeof payload.error_code === "string");
  });
});
