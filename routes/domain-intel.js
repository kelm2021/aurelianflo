const tls = require("node:tls");
const { Router } = require("express");
const {
  UpstreamRequestError,
  requestJson,
  sendNormalizedError,
  withProviderFallback,
} = require("../lib/upstream-client");

const router = Router();

function normalizeDomain(value) {
  const domain = String(value ?? "").trim().toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) {
    return null;
  }

  return domain;
}

function normalizeDnsType(value) {
  const type = String(value ?? "A").trim().toUpperCase();
  const supported = new Set(["A", "AAAA", "CNAME", "MX", "NS", "TXT", "SOA", "CAA"]);
  return supported.has(type) ? type : null;
}

function normalizeDnsAnswer(answer) {
  return {
    name: answer.name || null,
    type: answer.type || null,
    ttl: Number(answer.TTL ?? answer.ttl),
    data: answer.data || null,
  };
}

function normalizeRdapPayload(raw) {
  const nameservers = Array.isArray(raw?.nameservers)
    ? raw.nameservers
        .map((entry) => entry?.ldhName || entry?.unicodeName || null)
        .filter(Boolean)
    : [];

  const entities = Array.isArray(raw?.entities)
    ? raw.entities
        .map((entity) => entity?.handle || null)
        .filter(Boolean)
    : [];

  return {
    domainName: raw?.ldhName || raw?.unicodeName || null,
    handle: raw?.handle || null,
    status: Array.isArray(raw?.status) ? raw.status : [],
    nameservers,
    entities,
    events: Array.isArray(raw?.events)
      ? raw.events.map((entry) => ({
          action: entry?.eventAction || null,
          date: entry?.eventDate || null,
        }))
      : [],
    registrar: raw?.registrar || raw?.port43 || null,
  };
}

async function resolveDirectRdap(domain) {
  const bootstrap = await requestJson({
    provider: "iana-rdap-bootstrap",
    url: "https://data.iana.org/rdap/dns.json",
  });

  const tld = domain.split(".").pop();
  const services = Array.isArray(bootstrap?.services) ? bootstrap.services : [];
  const service = services.find(
    (entry) =>
      Array.isArray(entry?.[0]) &&
      entry[0].map((suffix) => String(suffix).toLowerCase()).includes(tld),
  );
  const server = service?.[1]?.[0];
  if (!server) {
    throw new UpstreamRequestError(`No RDAP server found for TLD ${tld}`, {
      provider: "iana-rdap-bootstrap",
      code: "upstream_payload",
    });
  }

  const base = String(server).replace(/\/+$/, "");
  return requestJson({
    provider: "direct-rdap",
    url: `${base}/domain/${encodeURIComponent(domain)}`,
  });
}

async function fetchSslViaTls(domain) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: domain,
        port: 443,
        servername: domain,
        rejectUnauthorized: false,
        timeout: 8000,
      },
      () => {
        try {
          const cert = socket.getPeerCertificate(true);
          if (!cert || !cert.valid_to) {
            throw new Error("TLS certificate not available");
          }

          const validTo = new Date(cert.valid_to);
          const now = new Date();
          const daysUntilExpiry = Math.round((validTo.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

          resolve({
            subject: cert.subject || null,
            issuer: cert.issuer || null,
            validFrom: cert.valid_from || null,
            validTo: cert.valid_to || null,
            serialNumber: cert.serialNumber || null,
            fingerprint256: cert.fingerprint256 || null,
            daysUntilExpiry,
          });
        } catch (error) {
          reject(
            new UpstreamRequestError(error.message || "TLS certificate parse failed", {
              provider: "native-tls",
              code: "upstream_payload",
            }),
          );
        } finally {
          socket.end();
        }
      },
    );

    socket.on("error", (error) => {
      reject(
        new UpstreamRequestError(`TLS connection failed: ${error.message}`, {
          provider: "native-tls",
          code: "network",
          retryable: true,
        }),
      );
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(
        new UpstreamRequestError("TLS connection timed out", {
          provider: "native-tls",
          code: "timeout",
          retryable: true,
        }),
      );
    });
  });
}

router.get("/api/whois/:domain", async (req, res) => {
  try {
    const domain = normalizeDomain(req.params.domain);
    if (!domain) {
      return res.status(400).json({ success: false, error: "domain is invalid" });
    }

    const result = await withProviderFallback({
      primary: {
        provider: "rdap.org",
        enabled: true,
        execute: async () =>
          requestJson({
            provider: "rdap.org",
            url: `https://rdap.org/domain/${encodeURIComponent(domain)}`,
          }),
      },
      fallback: {
        provider: "direct-rdap",
        enabled: true,
        execute: async () => resolveDirectRdap(domain),
      },
    });

    return res.json({
      success: true,
      data: {
        domain,
        ...normalizeRdapPayload(result.data),
        provider: result.provider,
        fallbackUsed: result.fallbackUsed,
      },
      source: result.provider === "rdap.org" ? "RDAP.org" : "Direct RDAP",
    });
  } catch (error) {
    return sendNormalizedError(res, error);
  }
});

router.get("/api/dns/:domain", async (req, res) => {
  try {
    const domain = normalizeDomain(req.params.domain);
    if (!domain) {
      return res.status(400).json({ success: false, error: "domain is invalid" });
    }
    const type = normalizeDnsType(req.query.type);
    if (!type) {
      return res.status(400).json({ success: false, error: "Unsupported DNS record type" });
    }

    const result = await withProviderFallback({
      primary: {
        provider: "cloudflare-doh",
        enabled: true,
        execute: async () =>
          requestJson({
            provider: "cloudflare-doh",
            url:
              "https://cloudflare-dns.com/dns-query" +
              `?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`,
            headers: { Accept: "application/dns-json" },
          }),
      },
      fallback: {
        provider: "google-dns",
        enabled: true,
        execute: async () =>
          requestJson({
            provider: "google-dns",
            url:
              "https://dns.google/resolve" +
              `?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`,
          }),
      },
    });

    const answers = Array.isArray(result.data?.Answer)
      ? result.data.Answer.map(normalizeDnsAnswer)
      : [];

    return res.json({
      success: true,
      data: {
        domain,
        type,
        status: Number(result.data?.Status),
        answerCount: answers.length,
        answers,
        provider: result.provider,
        fallbackUsed: result.fallbackUsed,
      },
      source: result.provider === "cloudflare-doh" ? "Cloudflare DNS over HTTPS" : "Google DNS",
    });
  } catch (error) {
    return sendNormalizedError(res, error);
  }
});

router.get("/api/ssl/:domain", async (req, res) => {
  try {
    const domain = normalizeDomain(req.params.domain);
    if (!domain) {
      return res.status(400).json({ success: false, error: "domain is invalid" });
    }

    const result = await withProviderFallback({
      primary: {
        provider: "ssl-checker",
        enabled: true,
        execute: async () =>
          requestJson({
            provider: "ssl-checker",
            url: `https://ssl-checker.io/api/v1/check/${encodeURIComponent(domain)}`,
          }),
      },
      fallback: {
        provider: "native-tls",
        enabled: true,
        execute: async () => fetchSslViaTls(domain),
      },
    });

    const payload =
      result.provider === "ssl-checker"
        ? {
            subject: result.data?.subject || result.data?.certificate?.subject || null,
            issuer: result.data?.issuer || result.data?.certificate?.issuer || null,
            validFrom: result.data?.valid_from || result.data?.certificate?.valid_from || null,
            validTo: result.data?.valid_to || result.data?.certificate?.valid_to || null,
            daysUntilExpiry: Number(result.data?.days_left ?? result.data?.daysUntilExpiry),
          }
        : result.data;

    return res.json({
      success: true,
      data: {
        domain,
        ...payload,
        provider: result.provider,
        fallbackUsed: result.fallbackUsed,
      },
      source: result.provider === "ssl-checker" ? "ssl-checker.io" : "Native TLS",
    });
  } catch (error) {
    return sendNormalizedError(res, error);
  }
});

router.get("/api/domain-availability/:domain", async (req, res) => {
  try {
    const domain = normalizeDomain(req.params.domain);
    if (!domain) {
      return res.status(400).json({ success: false, error: "domain is invalid" });
    }

    const whoisJsonKey = String(process.env.WHOISJSON_API_KEY || "").trim();
    const result = await withProviderFallback({
      primary: {
        provider: "whoisjson",
        enabled: Boolean(whoisJsonKey),
        keyName: "WHOISJSON_API_KEY",
        execute: async () =>
          requestJson({
            provider: "whoisjson",
            url:
              "https://whoisjson.com/api/v1/whois" +
              `?domain=${encodeURIComponent(domain)}&key=${encodeURIComponent(whoisJsonKey)}`,
          }),
      },
      fallback: {
        provider: "rdap-heuristic",
        enabled: true,
        execute: async () => {
          try {
            await requestJson({
              provider: "rdap.org",
              url: `https://rdap.org/domain/${encodeURIComponent(domain)}`,
            });
            return { available: false, reason: "RDAP registration found" };
          } catch (error) {
            if (error instanceof UpstreamRequestError && Number(error.upstreamStatus) === 404) {
              return { available: true, reason: "RDAP registration not found" };
            }
            throw error;
          }
        },
      },
    });

    const available =
      typeof result.data?.available === "boolean"
        ? result.data.available
        : typeof result.data?.domain_available === "boolean"
          ? result.data.domain_available
          : null;

    return res.json({
      success: true,
      data: {
        domain,
        available,
        reason: result.data?.reason || result.data?.message || null,
        provider: result.provider,
        fallbackUsed: result.fallbackUsed,
      },
      source: result.provider === "whoisjson" ? "WhoisJSON API" : "RDAP heuristic",
    });
  } catch (error) {
    return sendNormalizedError(res, error);
  }
});

router.normalizeDomain = normalizeDomain;
router.normalizeDnsType = normalizeDnsType;
router.normalizeDnsAnswer = normalizeDnsAnswer;
router.normalizeRdapPayload = normalizeRdapPayload;
router.resolveDirectRdap = resolveDirectRdap;
router.fetchSslViaTls = fetchSslViaTls;

module.exports = router;
