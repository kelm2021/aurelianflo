const assert = require("node:assert/strict");
const test = require("node:test");

const {
  UpstreamRequestError,
  shouldFallbackOnError,
  withProviderFallback,
} = require("../lib/upstream-client");

test("shouldFallbackOnError matches the configured fallback policy", () => {
  assert.equal(
    shouldFallbackOnError(new UpstreamRequestError("missing key", { code: "missing_key" })),
    true,
  );
  assert.equal(
    shouldFallbackOnError(new UpstreamRequestError("timeout", { code: "timeout" })),
    true,
  );
  assert.equal(
    shouldFallbackOnError(
      new UpstreamRequestError("forbidden", { code: "upstream_http", upstreamStatus: 403 }),
    ),
    true,
  );
  assert.equal(
    shouldFallbackOnError(
      new UpstreamRequestError("rate limited", { code: "upstream_http", upstreamStatus: 429 }),
    ),
    true,
  );
  assert.equal(
    shouldFallbackOnError(
      new UpstreamRequestError("server error", { code: "upstream_http", upstreamStatus: 503 }),
    ),
    true,
  );
  assert.equal(
    shouldFallbackOnError(
      new UpstreamRequestError("not found", { code: "upstream_http", upstreamStatus: 404 }),
    ),
    false,
  );
});

test("withProviderFallback uses primary provider when available", async () => {
  const result = await withProviderFallback({
    primary: {
      provider: "primary",
      enabled: true,
      execute: async () => ({ ok: true }),
    },
    fallback: {
      provider: "fallback",
      enabled: true,
      execute: async () => ({ ok: false }),
    },
  });

  assert.equal(result.provider, "primary");
  assert.equal(result.fallbackUsed, false);
  assert.deepEqual(result.data, { ok: true });
});

test("withProviderFallback switches to fallback provider when policy allows", async () => {
  const result = await withProviderFallback({
    primary: {
      provider: "primary",
      enabled: true,
      execute: async () => {
        throw new UpstreamRequestError("forbidden", {
          code: "upstream_http",
          upstreamStatus: 403,
        });
      },
    },
    fallback: {
      provider: "fallback",
      enabled: true,
      execute: async () => ({ source: "fallback-response" }),
    },
  });

  assert.equal(result.provider, "fallback");
  assert.equal(result.fallbackUsed, true);
  assert.deepEqual(result.data, { source: "fallback-response" });
});

test("withProviderFallback does not use fallback for non-fallback errors", async () => {
  await assert.rejects(
    withProviderFallback({
      primary: {
        provider: "primary",
        enabled: true,
        execute: async () => {
          throw new UpstreamRequestError("not found", {
            code: "upstream_http",
            upstreamStatus: 404,
          });
        },
      },
      fallback: {
        provider: "fallback",
        enabled: true,
        execute: async () => ({ source: "fallback-response" }),
      },
    }),
    /not found/i,
  );
});
