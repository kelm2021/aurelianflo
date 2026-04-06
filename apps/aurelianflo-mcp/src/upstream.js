function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").trim().replace(/\/+$/, "");
}

function encodePathSegment(value) {
  return encodeURIComponent(String(value));
}

function appendQueryParams(url, params = {}) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    url.searchParams.set(key, String(value));
  }
}

export function buildUpstreamRequest(tool, args, baseUrl) {
  if (!tool) {
    throw new Error("Tool definition is required.");
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    throw new Error("A base URL is required.");
  }

  const method = String(tool.route?.method || "GET").toUpperCase();
  const rawPathTemplate = String(tool.route?.pathTemplate || "");
  const path = rawPathTemplate.replace(/\{([^}]+)\}/g, (_match, token) => {
    if (!(token in args)) {
      throw new Error(`Missing required path parameter: ${token}`);
    }
    return encodePathSegment(args[token]);
  });
  const url = new URL(`${normalizedBaseUrl}${path}`);

  if (method === "GET") {
    const pathParamNames = [...rawPathTemplate.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
    const query = { ...args };
    for (const paramName of pathParamNames) {
      delete query[paramName];
    }
    appendQueryParams(url, query);
    return {
      method,
      url: url.toString(),
      headers: {
        accept: "application/json",
      },
    };
  }

  return {
    method,
    url: url.toString(),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
  };
}

export async function invokeUpstream(tool, args, options = {}) {
  const { baseUrl, fetchImpl = fetch } = options;
  const request = buildUpstreamRequest(tool, args, baseUrl);
  const response = await fetchImpl(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (_error) {
    payload = text;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && payload.error
        ? payload.error
        : `Upstream request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}
