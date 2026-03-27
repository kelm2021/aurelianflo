const { Router } = require("express");
const {
  requestJson,
  sendNormalizedError,
  withProviderFallback,
} = require("../lib/upstream-client");

const router = Router();

function parsePositiveInt(value, fallback, minimum = 1, maximum = 1000) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
}

function normalizeCountryCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeWorldBankObservations(rows = [], limit = 200) {
  return rows.slice(0, limit).map((row) => ({
    date: row.date ?? null,
    value: row.value ?? null,
    unit: row.unit ?? null,
    obsStatus: row.obs_status ?? null,
    decimal: row.decimal ?? null,
  }));
}

function normalizeCountryPayload(entry) {
  if (!entry) {
    return null;
  }

  return {
    code: entry.cca2 ?? entry.cca3 ?? null,
    name: entry.name?.common ?? null,
    officialName: entry.name?.official ?? null,
    region: entry.region ?? null,
    subregion: entry.subregion ?? null,
    capital: Array.isArray(entry.capital) ? entry.capital : [],
    population: entry.population ?? null,
    currencies: entry.currencies ?? {},
    languages: entry.languages ?? {},
    timezones: entry.timezones ?? [],
    latlng: entry.latlng ?? [],
    flagPng: entry.flags?.png ?? null,
    flagSvg: entry.flags?.svg ?? null,
  };
}

function normalizePatentsViewResults(rows = [], limit = 20) {
  return rows.slice(0, limit).map((row) => ({
    patentNumber: row.patent_number ?? row.patentNumber ?? null,
    title: row.patent_title ?? row.title ?? null,
    abstract: row.patent_abstract ?? row.abstract ?? null,
    grantDate: row.patent_date ?? row.grantDate ?? null,
    assignee:
      row.assignee_organization ??
      row.assignee ??
      (Array.isArray(row.assignees) ? row.assignees[0]?.assignee_organization : null) ??
      null,
    inventors: Array.isArray(row.inventor_name)
      ? row.inventor_name
      : Array.isArray(row.inventors)
        ? row.inventors
            .map((inventor) =>
              [inventor.inventor_first_name, inventor.inventor_last_name].filter(Boolean).join(" "),
            )
            .filter(Boolean)
        : [],
    cpc: Array.isArray(row.cpc_subgroup_id)
      ? row.cpc_subgroup_id
      : Array.isArray(row.cpcs)
        ? row.cpcs.map((item) => item.cpc_subgroup_id).filter(Boolean)
        : [],
    url: row.patent_link ?? null,
  }));
}

async function fetchPatentsWithFallback(query, page, perPage, fromDate, toDate) {
  const epoKey = String(process.env.EPO_OPS_KEY || "").trim();
  const epoSecret = String(process.env.EPO_OPS_SECRET || "").trim();

  const resolved = await withProviderFallback({
    primary: {
      provider: "patentsview",
      enabled: true,
      execute: async () => {
        const payload = {
          q: {
            _and: [
              { _text_any: { patent_title: query } },
              ...(fromDate ? [{ _gte: { patent_date: fromDate } }] : []),
              ...(toDate ? [{ _lte: { patent_date: toDate } }] : []),
            ],
          },
          f: [
            "patent_number",
            "patent_title",
            "patent_abstract",
            "patent_date",
            "assignee_organization",
            "inventors",
            "cpcs",
          ],
          o: {
            page,
            per_page: perPage,
          },
        };
        const raw = await requestJson({
          provider: "patentsview",
          url: "https://api.patentsview.org/patents/query",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        });
        const rows = Array.isArray(raw?.patents) ? raw.patents : [];
        return normalizePatentsViewResults(rows, perPage);
      },
    },
    fallback: {
      provider: "epo-ops",
      enabled: Boolean(epoKey && epoSecret),
      execute: async () => {
        const raw = await requestJson({
          provider: "epo-ops",
          url:
            "https://ops.epo.org/3.2/rest-services/published-data/search/biblio" +
            `?q=${encodeURIComponent(query)}&Range=${encodeURIComponent(
              `${(page - 1) * perPage + 1}-${page * perPage}`,
            )}`,
          headers: {
            Authorization: `Basic ${Buffer.from(`${epoKey}:${epoSecret}`).toString("base64")}`,
            Accept: "application/json",
          },
        });
        if (typeof raw === "string") {
          return [];
        }
        return normalizePatentsViewResults(raw?.results || raw?.patents || [], perPage);
      },
    },
  });

  return {
    results: resolved.data,
    provider: resolved.provider,
    fallbackUsed: resolved.fallbackUsed,
  };
}

router.get("/api/worldbank/:country/:indicator", async (req, res) => {
  try {
    const country = String(req.params.country || "").trim();
    const indicator = String(req.params.indicator || "").trim();
    if (!country || !indicator) {
      return res.status(400).json({ success: false, error: "country and indicator are required" });
    }

    const perPage = parsePositiveInt(req.query.perPage, 50, 1, 1000);
    const date = String(req.query.date || "").trim();
    const raw = await requestJson({
      provider: "worldbank",
      url:
        `https://api.worldbank.org/v2/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(indicator)}` +
        `?format=json&per_page=${perPage}` +
        (date ? `&date=${encodeURIComponent(date)}` : ""),
    });
    const rows = Array.isArray(raw?.[1]) ? raw[1] : [];
    const observations = normalizeWorldBankObservations(rows, perPage);

    res.json({
      success: true,
      data: {
        country,
        indicator,
        count: observations.length,
        observations,
        provider: "worldbank",
        fallbackUsed: false,
      },
      source: "World Bank API",
    });
  } catch (error) {
    sendNormalizedError(res, error);
  }
});

router.get("/api/country/:code", async (req, res) => {
  try {
    const code = normalizeCountryCode(req.params.code);
    if (!code) {
      return res.status(400).json({ success: false, error: "code is required" });
    }

    const raw = await requestJson({
      provider: "restcountries",
      url: `https://restcountries.com/v3.1/alpha/${encodeURIComponent(code)}`,
    });
    const country = normalizeCountryPayload(Array.isArray(raw) ? raw[0] : raw);

    if (!country) {
      return res.status(404).json({ success: false, error: `No country found for code ${code}` });
    }

    res.json({
      success: true,
      data: {
        ...country,
        provider: "restcountries",
        fallbackUsed: false,
      },
      source: "RestCountries API",
    });
  } catch (error) {
    sendNormalizedError(res, error);
  }
});

router.get("/api/patents/search", async (req, res) => {
  try {
    const query = String(req.query.q || req.query.query || "").trim();
    if (!query) {
      return res.status(400).json({ success: false, error: "q is required" });
    }

    const page = parsePositiveInt(req.query.page, 1, 1, 1000);
    const perPage = parsePositiveInt(req.query.perPage, 20, 1, 100);
    const fromDate = String(req.query.fromDate || "").trim();
    const toDate = String(req.query.toDate || "").trim();
    const resolved = await fetchPatentsWithFallback(query, page, perPage, fromDate, toDate);

    res.json({
      success: true,
      data: {
        query,
        page,
        perPage,
        count: resolved.results.length,
        results: resolved.results,
        provider: resolved.provider,
        fallbackUsed: resolved.fallbackUsed,
      },
      source: resolved.provider === "epo-ops" ? "EPO Open Patent Services" : "USPTO PatentsView",
    });
  } catch (error) {
    sendNormalizedError(res, error);
  }
});

router.parsePositiveInt = parsePositiveInt;
router.normalizeCountryCode = normalizeCountryCode;
router.normalizeWorldBankObservations = normalizeWorldBankObservations;
router.normalizeCountryPayload = normalizeCountryPayload;
router.normalizePatentsViewResults = normalizePatentsViewResults;

module.exports = router;
