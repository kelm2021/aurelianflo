const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const fetch = require("node-fetch");
const { bazaarResourceServerExtension } = require("@x402/extensions/bazaar");
const { siwxResourceServerExtension } = require("@x402/extensions/sign-in-with-x");

const {
  PAY_TO,
  X402_NETWORK,
  createApp,
  createPaymentResourceServer,
  sellerConfig,
} = require("../app");
const {
  OFAC_SDN_ADVANCED_XML_URL,
  resetDatasetCache,
} = require("../lib/ofac");
const { OFAC_WALLET_XML } = require("./fixtures/ofac-wallet-xml");

function getSellerRoutes() {
  if (Array.isArray(sellerConfig.routes) && sellerConfig.routes.length) {
    return sellerConfig.routes;
  }

  return sellerConfig.route ? [sellerConfig.route] : [];
}

function getPrimaryRoute() {
  return getSellerRoutes()[0];
}

function buildRouteRequestPath(route, options = {}) {
  const basePath = route.canonicalPath || route.resourcePath || route.routePath;
  const includeQuery = Boolean(options.includeQuery);
  const queryExample =
    route && route.queryExample && typeof route.queryExample === "object"
      ? route.queryExample
      : null;

  if (!includeQuery || !queryExample || !Object.keys(queryExample).length) {
    return basePath;
  }

  const params = new URLSearchParams(
    Object.entries(queryExample).map(([key, value]) => [key, String(value)]),
  );
  return `${basePath}?${params.toString()}`;
}

function createStubFacilitator() {
  return {
    verify: async () => ({ isValid: true }),
    settle: async () => ({
      success: true,
      transaction: "0x123",
      network: X402_NETWORK,
    }),
    getSupported: async () => ({
      kinds: [{ x402Version: 2, scheme: "exact", network: X402_NETWORK }],
      extensions: [],
      signers: {},
    }),
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

function createTextFetchResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return headers[String(name).toLowerCase()] ?? null;
      },
    },
    async text() {
      return body;
    },
  };
}

function withPatchedGlobalFetch(run, responder) {
  const originalFetch = global.fetch;
  resetDatasetCache();
  global.fetch = responder;

  return Promise.resolve()
    .then(run)
    .finally(() => {
      global.fetch = originalFetch;
      resetDatasetCache();
    });
}

test("requiring index.js does not start the server", () => {
  const result = spawnSync(
    process.execPath,
    ["-e", "require('./index'); console.log('loaded');"],
    {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf8",
      timeout: 5000,
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /loaded/);
  assert.doesNotMatch(result.stdout, /running on port/i);
});

test("health check stays free and advertises the wallet screen", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.name, sellerConfig.serviceName);
    assert.equal(body.payment.protocol, "x402");
    assert.equal(body.catalog.length, 4);
    assert.ok(body.catalog.some((entry) => /ofac-wallet-screen/.test(String(entry.path || ""))));
    assert.ok(body.catalog.some((entry) => /wallet-sanctions-report/.test(String(entry.path || ""))));
    assert.ok(body.catalog.some((entry) => /batch-wallet-screen/.test(String(entry.path || ""))));
    assert.ok(body.catalog.some((entry) => /edd-report/.test(String(entry.path || ""))));
    assert.equal(body.extensions.signInWithX.enabled, true);
    assert.equal(body.integrations.paymentsMcp.installerPackage, "@coinbase/payments-mcp");
    assert.ok(body.integrations.paymentsMcp.scenarioPrompts.length >= 3);
  });
});

test("payments MCP integration endpoint stays free", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/integrations/payments-mcp`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.service, sellerConfig.serviceName);
    assert.equal(body.paymentsMcp.installerPackage, "@coinbase/payments-mcp");
    assert.match(body.paymentsMcp.installCommands.codex, /payments-mcp/);
    assert.match(body.paymentsMcp.primaryPrompt, /edd-report/);
    assert.doesNotMatch(body.paymentsMcp.primaryPrompt, /\r|\n/);
    assert.ok(body.paymentsMcp.shareCopy.shortPost.includes("wallet"));
    assert.equal(body.signInWithX.enabled, true);
  });
});

test("protected route returns payment requirements without a payment header", async () => {
  const app = createApp({
    env: {},
    facilitatorLoader: async () => createStubFacilitator(),
  });
  const primaryRoute = getPrimaryRoute();
  const canonicalPath = buildRouteRequestPath(primaryRoute);

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${canonicalPath}`);
    const body = await response.json();
    const paymentRequiredHeader = response.headers.get("payment-required");
    const expectedAmount = String(Math.round(Number(primaryRoute.price) * 1000000));

    assert.equal(response.status, 402);
    assert.ok(paymentRequiredHeader);
    assert.equal(body.x402Version, 2);
    assert.equal(body.error, "Payment required");
    assert.equal(body.accepts[0].payTo, PAY_TO);
    assert.equal(body.accepts[0].network, X402_NETWORK);
    assert.equal(body.accepts[0].amount, expectedAmount);
    assert.equal(
      body.accepts[0].resource,
      "https://x402.aurelianflo.com/api/ofac-wallet-screen/0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
    );
    assert.ok(body.extensions["sign-in-with-x"]);
  });
});

test("payment resource server registers the Bazaar discovery extension", () => {
  const recorded = {
    extensions: [],
    registerCalls: [],
  };
  const stubFacilitator = createStubFacilitator();
  const stubScheme = { scheme: "exact" };
  const afterSettleHook = () => {};

  class StubResourceServer {
    constructor(facilitatorClient) {
      recorded.facilitatorClient = facilitatorClient;
    }

    register(network, scheme) {
      recorded.registerCalls.push({ network, scheme });
      return this;
    }

    registerExtension(extension) {
      recorded.extensions.push(extension);
      return this;
    }

    onAfterSettle(handler) {
      recorded.afterSettleHandler = handler;
      return this;
    }

    onVerifyFailure(handler) {
      recorded.verifyFailureHandler = handler;
      return this;
    }

    onSettleFailure(handler) {
      recorded.settleFailureHandler = handler;
      return this;
    }
  }

  const resourceServer = createPaymentResourceServer({
    afterSettleHooks: [afterSettleHook],
    facilitator: stubFacilitator,
    resourceServerClass: StubResourceServer,
    schemeFactory: () => stubScheme,
  });

  assert.ok(resourceServer instanceof StubResourceServer);
  assert.deepEqual(recorded.registerCalls, [
    { network: X402_NETWORK, scheme: stubScheme },
  ]);
  assert.deepEqual(recorded.extensions, [
    bazaarResourceServerExtension,
    siwxResourceServerExtension,
  ]);
  assert.equal(recorded.afterSettleHandler, afterSettleHook);
  assert.equal(typeof recorded.verifyFailureHandler, "function");
  assert.equal(typeof recorded.settleFailureHandler, "function");
});

test("paid route only passes through the payment gate once and returns a wallet hit", async () => {
  let paymentGateCalls = 0;
  const paymentGate = (_req, _res, next) => {
    paymentGateCalls += 1;
    next();
  };

  await withPatchedGlobalFetch(
    async () => {
      const app = createApp({ paymentGate });
      const primaryRoute = getPrimaryRoute();
      const canonicalPath = buildRouteRequestPath(primaryRoute, { includeQuery: true });

      await withServer(app, async (baseUrl) => {
        const response = await fetch(`${baseUrl}${canonicalPath}`);
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(paymentGateCalls, 1);
        assert.equal(body.success, true);
        assert.equal(body.data.summary.status, "match");
        assert.equal(body.data.matches[0].entityName, "Lazarus Group");
        assert.equal(body.data.matches[0].asset, "ETH");
        assert.equal(body.data.sourceFreshness.sourceUrl, OFAC_SDN_ADVANCED_XML_URL);
        assert.equal(body.report.report_meta.report_type, "ofac-wallet-screening");
        assert.equal(body.report.result.summary.status, "match");
        assert.equal(body.artifacts.pdf.endpoint, "/api/tools/report/pdf/generate");
        assert.equal(body.artifacts.docx.endpoint, "/api/tools/report/docx/generate");
        assert.match(
          body.artifacts.pdf.recommended_local_path,
          /outputs\/ofac-wallet-screen-0x098b716b8aaf21512996dc57eb0615e2383e2f96\.pdf$/,
        );
        assert.equal(body.source, "OFAC SDN Advanced XML");
      });
    },
    async (url) => {
      if (url === OFAC_SDN_ADVANCED_XML_URL) {
        return createTextFetchResponse(200, OFAC_WALLET_XML, {
          "last-modified": "Sun, 06 Apr 2026 02:00:00 GMT",
        });
      }

      throw new Error(`Unexpected fetch URL in test: ${url}`);
    },
  );
});

test("paid route returns a clear result for an unsanctioned wallet", async () => {
  const paymentGate = (_req, _res, next) => next();

  await withPatchedGlobalFetch(
    async () => {
      const app = createApp({ paymentGate });

      await withServer(app, async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/ofac-wallet-screen/0x1111111111111111111111111111111111111111`,
        );
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.success, true);
        assert.equal(body.data.summary.status, "clear");
        assert.equal(body.data.summary.matchCount, 0);
        assert.deepEqual(body.data.matches, []);
        assert.equal(body.report.result.summary.status, "clear");
        assert.equal(body.report.tables.wallet_screening_matches.rows[0].status, "clear");
      });
    },
    async (url) => {
      if (url === OFAC_SDN_ADVANCED_XML_URL) {
        return createTextFetchResponse(200, OFAC_WALLET_XML, {
          "last-modified": "Sun, 06 Apr 2026 02:00:00 GMT",
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    },
  );
});

test("wallet sanctions workflow route accepts POST body input and returns a report-ready payload", async () => {
  const paymentGate = (_req, _res, next) => next();

  await withPatchedGlobalFetch(
    async () => {
      const app = createApp({ paymentGate });

      await withServer(app, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/workflows/compliance/wallet-sanctions-report`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            address: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
            asset: "ETH",
          }),
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.success, true);
        assert.equal(body.data.summary.status, "match");
        assert.equal(body.data.summary.matchCount, 1);
        assert.equal(body.report.report_meta.report_type, "ofac-wallet-screening");
        assert.equal(body.artifacts.pdf.endpoint, "/api/tools/report/pdf/generate");
        assert.equal(body.source, "OFAC SDN Advanced XML");
      });
    },
    async (url) => {
      if (url === OFAC_SDN_ADVANCED_XML_URL) {
        return createTextFetchResponse(200, OFAC_WALLET_XML, {
          "last-modified": "Sun, 06 Apr 2026 02:00:00 GMT",
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    },
  );
});

test("batch wallet screening route accepts POST body input and returns a batch decision payload", async () => {
  const paymentGate = (_req, _res, next) => next();

  await withPatchedGlobalFetch(
    async () => {
      const app = createApp({ paymentGate });

      await withServer(app, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/workflows/compliance/batch-wallet-screen`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            addresses: [
              "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
              "0x1111111111111111111111111111111111111111",
            ],
            asset: "ETH",
          }),
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.success, true);
        assert.equal(body.data.summary.totalScreened, 2);
        assert.equal(body.data.summary.matchCount, 1);
        assert.equal(body.data.summary.clearCount, 1);
        assert.equal(body.data.summary.workflowStatus, "manual_review_required");
        assert.equal(body.report.report_meta.report_type, "ofac-wallet-screening-batch");
        assert.equal(body.report.tables.batch_wallet_results.rows.length, 2);
        assert.equal(body.artifacts.pdf.endpoint, "/api/tools/report/pdf/generate");
        assert.equal(body.source, "OFAC SDN Advanced XML");
      });
    },
    async (url) => {
      if (url === OFAC_SDN_ADVANCED_XML_URL) {
        return createTextFetchResponse(200, OFAC_WALLET_XML, {
          "last-modified": "Sun, 06 Apr 2026 02:00:00 GMT",
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    },
  );
});

test("EDD report route accepts case metadata and returns a workflow memo without legal approval language", async () => {
  const paymentGate = (_req, _res, next) => next();

  await withPatchedGlobalFetch(
    async () => {
      const app = createApp({ paymentGate });

      await withServer(app, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/workflows/compliance/edd-report`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            subject_name: "Northwind Treasury Counterparty",
            case_name: "Counterparty onboarding review",
            review_reason: "Treasury payout review",
            jurisdiction: "US",
            requested_by: "ops@northwind.example",
            reference_id: "case-2026-04-07-001",
            output_format: "json",
            addresses: [
              "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
              "0x1111111111111111111111111111111111111111",
            ],
            asset: "ETH",
          }),
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.success, true);
        assert.equal(body.data.case.subjectName, "Northwind Treasury Counterparty");
        assert.equal(body.data.workflowStatus, "manual_review_required");
        assert.equal(body.data.screening.summary.matchCount, 1);
        assert.ok(body.data.evidenceSummary.some((line) => /Lazarus Group/i.test(line)));
        assert.ok(body.data.requiredFollowUp.some((line) => /human compliance reviewer/i.test(line)));
        assert.equal(body.report.report_meta.report_type, "enhanced-due-diligence");
        assert.equal(body.report.tables.case_metadata.rows[0].reference_id, "case-2026-04-07-001");
        assert.equal(body.report.tables.screening_results.rows.length, 2);
        assert.equal(body.artifacts.pdf.endpoint, "/api/tools/report/pdf/generate");
        assert.equal(body.source, "OFAC SDN Advanced XML");
      });
    },
    async (url) => {
      if (url === OFAC_SDN_ADVANCED_XML_URL) {
        return createTextFetchResponse(200, OFAC_WALLET_XML, {
          "last-modified": "Sun, 06 Apr 2026 02:00:00 GMT",
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    },
  );
});

test("EDD report route can bundle PDF artifact output in one call", async () => {
  const paymentGate = (_req, _res, next) => next();

  await withPatchedGlobalFetch(
    async () => {
      const app = createApp({ paymentGate });

      await withServer(app, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/workflows/compliance/edd-report`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            subject_name: "Northwind Treasury Counterparty",
            case_name: "Counterparty onboarding review",
            review_reason: "Treasury payout review",
            jurisdiction: "US",
            requested_by: "ops@northwind.example",
            reference_id: "case-2026-04-07-002",
            output_format: "pdf",
            addresses: [
              "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
              "0x1111111111111111111111111111111111111111",
            ],
            asset: "ETH",
          }),
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.success, true);
        assert.equal(body.output_format, "pdf");
        assert.equal(body.output.mimeType, "application/pdf");
        assert.equal(typeof body.output.artifact.contentBase64, "string");
        assert.ok(body.output.artifact.contentBase64.length > 100);
        assert.equal(body.report.report_meta.report_type, "enhanced-due-diligence");
        assert.equal(body.source, "OFAC SDN Advanced XML");
      });
    },
    async (url) => {
      if (url === OFAC_SDN_ADVANCED_XML_URL) {
        return createTextFetchResponse(200, OFAC_WALLET_XML, {
          "last-modified": "Sun, 06 Apr 2026 02:00:00 GMT",
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    },
  );
});
