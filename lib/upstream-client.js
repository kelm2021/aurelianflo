const fetch = require("node-fetch");

const DEFAULT_TIMEOUT_MS = 12000;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

class UpstreamRequestError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "UpstreamRequestError";
    this.provider = options.provider ?? "upstream";
    this.code = options.code ?? "upstream_error";
    this.upstreamStatus = options.upstreamStatus ?? null;
    this.retryable = Boolean(options.retryable);
    this.details = options.details ?? null;
    this.statusCode = options.statusCode ?? null;
  }
}

function buildMissingKeyError(provider, keyName) {
  return new UpstreamRequestError(`${keyName} not configured`, {
    provider,
    code: "missing_key",
    statusCode: 503,
  });
}

function normalizeHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers).filter(([, value]) => value !== undefined && value !== null),
  );
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}

function shouldRetryError(error) {
  if (!(error instanceof UpstreamRequestError)) {
    return false;
  }

  if (error.code === "timeout" || error.code === "network") {
    return true;
  }

  return RETRYABLE_STATUS_CODES.has(Number(error.upstreamStatus));
}

async function requestJson(options = {}) {
  const {
    url,
    method = "GET",
    headers = {},
    body,
    provider = "upstream",
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 1,
  } = options;

  if (!url) {
    throw new UpstreamRequestError("Missing upstream URL", {
      provider,
      code: "invalid_upstream",
      statusCode: 500,
    });
  }

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: normalizeHeaders(headers),
        body: body == null ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const payload = await readResponseBody(response);

      if (!response.ok) {
        throw new UpstreamRequestError(
          `Upstream ${provider} failed with status ${response.status}`,
          {
            provider,
            code: "upstream_http",
            upstreamStatus: response.status,
            retryable: RETRYABLE_STATUS_CODES.has(response.status),
            details: payload,
          },
        );
      }

      return payload;
    } catch (error) {
      let normalizedError = error;
      if (error?.name === "AbortError") {
        normalizedError = new UpstreamRequestError(`Upstream ${provider} timed out`, {
          provider,
          code: "timeout",
          retryable: true,
        });
      } else if (!(error instanceof UpstreamRequestError)) {
        normalizedError = new UpstreamRequestError(
          `Upstream ${provider} request failed: ${error.message || "Unknown network error"}`,
          {
            provider,
            code: "network",
            retryable: true,
          },
        );
      }

      if (attempt < retries && shouldRetryError(normalizedError)) {
        continue;
      }

      throw normalizedError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new UpstreamRequestError(`Upstream ${provider} failed after retries`, {
    provider,
    code: "upstream_retry_exhausted",
  });
}

function shouldFallbackOnError(error) {
  if (!(error instanceof UpstreamRequestError)) {
    return false;
  }

  if (error.code === "missing_key" || error.code === "timeout") {
    return true;
  }

  if ([401, 403, 429].includes(Number(error.upstreamStatus))) {
    return true;
  }

  if (Number(error.upstreamStatus) >= 500) {
    return true;
  }

  return false;
}

async function withProviderFallback(options = {}) {
  const { primary, fallback } = options;

  if (!primary || typeof primary.execute !== "function") {
    throw new UpstreamRequestError("Missing primary provider execution function", {
      code: "invalid_provider_setup",
      statusCode: 500,
    });
  }

  try {
    if (!primary.enabled) {
      throw buildMissingKeyError(primary.provider, primary.keyName || "primary provider key");
    }
    const data = await primary.execute();
    return { data, provider: primary.provider, fallbackUsed: false };
  } catch (primaryError) {
    if (!fallback || !shouldFallbackOnError(primaryError)) {
      throw primaryError;
    }

    if (!fallback.enabled) {
      throw primaryError;
    }

    const data = await fallback.execute();
    return {
      data,
      provider: fallback.provider,
      fallbackUsed: true,
      primaryError,
    };
  }
}

function sendNormalizedError(res, error, defaultMessage = "Upstream API error") {
  if (error instanceof UpstreamRequestError) {
    const statusCode = error.statusCode ?? (error.code === "missing_key" ? 503 : 502);
    return res.status(statusCode).json({
      success: false,
      error: statusCode === 503 ? error.message : defaultMessage,
      details: error.details ?? error.message,
    });
  }

  return res.status(502).json({
    success: false,
    error: defaultMessage,
    details: error?.message || "Unknown upstream error",
  });
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  UpstreamRequestError,
  buildMissingKeyError,
  requestJson,
  sendNormalizedError,
  shouldFallbackOnError,
  withProviderFallback,
};
