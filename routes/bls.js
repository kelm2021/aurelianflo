const { Router } = require("express");
const {
  buildMissingKeyError,
  requestJson,
  sendNormalizedError,
} = require("../lib/upstream-client");

const router = Router();

function parseYearsQuery(value, defaultYears = 5) {
  const parsed = Number.parseInt(String(value ?? defaultYears), 10);
  if (!Number.isFinite(parsed)) {
    return defaultYears;
  }

  return Math.max(1, Math.min(20, parsed));
}

async function fetchBLS(seriesId, years) {
  const endYear = new Date().getFullYear();
  const startYear = endYear - years;

  const raw = await requestJson({
    provider: "bls",
    url: "https://api.bls.gov/publicAPI/v1/timeseries/data/",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {
      seriesid: [seriesId],
      startyear: String(startYear),
      endyear: String(endYear),
    },
  });

  if (raw.status !== "REQUEST_SUCCEEDED") {
    throw new Error(raw.message || "BLS request failed");
  }

  const series = raw?.Results?.series?.[0];
  if (!series || !Array.isArray(series.data)) {
    throw new Error("BLS response missing series data");
  }

  return series.data;
}

function mapBlsData(seriesData, mapper) {
  return seriesData.map((entry) => mapper(entry)).filter((entry) => entry != null);
}

async function fetchFredPce(years) {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    throw buildMissingKeyError("fred", "FRED_API_KEY");
  }

  const limit = years * 12 + 24;
  const raw = await requestJson({
    provider: "fred",
    url:
      "https://api.stlouisfed.org/fred/series/observations" +
      `?series_id=PCEPI&api_key=${encodeURIComponent(apiKey)}&file_type=json&sort_order=desc&limit=${limit}`,
  });

  const observations = Array.isArray(raw?.observations) ? raw.observations : [];
  const clean = observations
    .map((obs) => ({
      date: obs.date,
      value: obs.value === "." ? null : Number(obs.value),
    }))
    .filter((obs) => Number.isFinite(obs.value));

  const byDate = new Map(clean.map((row) => [row.date, row.value]));

  return clean.map((row) => {
    const priorYearDate = `${Number(row.date.slice(0, 4)) - 1}${row.date.slice(4)}`;
    const priorValue = byDate.get(priorYearDate);
    const yoyPct =
      Number.isFinite(priorValue) && priorValue !== 0
        ? Number((((row.value - priorValue) / priorValue) * 100).toFixed(2))
        : null;

    return {
      date: row.date,
      value: Number(row.value.toFixed(3)),
      yoy_pct: yoyPct,
    };
  });
}

function buildBlsHandler(options) {
  const { seriesId, title, valueKey, valueMapper } = options;

  return async function handleBlsSeries(req, res) {
    try {
      const years = parseYearsQuery(req.query.years, 5);
      const rawData = await fetchBLS(seriesId, years);
      const history = mapBlsData(rawData, (entry) => ({
        year: entry.year,
        period: entry.periodName,
        [valueKey]: valueMapper(entry),
      }));

      return res.json({
        success: true,
        data: {
          seriesId,
          title,
          latest: history[0] || null,
          history,
        },
        source: "Bureau of Labor Statistics",
      });
    } catch (error) {
      return sendNormalizedError(res, error);
    }
  };
}

router.get(
  "/api/bls/cpi",
  buildBlsHandler({
    seriesId: "CUUR0000SA0",
    title:
      "Consumer Price Index - All Urban Consumers (CPI-U), All Items, US City Average",
    valueKey: "value",
    valueMapper: (entry) => Number.parseFloat(entry.value),
  }),
);

router.get(
  "/api/bls/unemployment",
  buildBlsHandler({
    seriesId: "LNS14000000",
    title: "Unemployment Rate, Seasonally Adjusted",
    valueKey: "rate_pct",
    valueMapper: (entry) => Number.parseFloat(entry.value),
  }),
);

router.get(
  "/api/bls/jobs",
  buildBlsHandler({
    seriesId: "CES0000000001",
    title: "All Employees, Total Nonfarm (thousands)",
    valueKey: "jobs_thousands",
    valueMapper: (entry) => Number.parseFloat(entry.value),
  }),
);

router.get(
  "/api/bls/wages",
  buildBlsHandler({
    seriesId: "CES0500000003",
    title: "Average Hourly Earnings of All Employees, Total Private",
    valueKey: "avg_hourly_earnings_usd",
    valueMapper: (entry) => Number.parseFloat(entry.value),
  }),
);

router.get("/api/bls/pce", async (req, res) => {
  try {
    const years = parseYearsQuery(req.query.years, 5);
    const history = await fetchFredPce(years);

    return res.json({
      success: true,
      data: {
        seriesId: "PCEPI",
        title: "Personal Consumption Expenditures: Chain-type Price Index",
        latest: history[0] || null,
        history,
      },
      source: "FRED API",
    });
  } catch (error) {
    return sendNormalizedError(res, error);
  }
});

router.parseYearsQuery = parseYearsQuery;

module.exports = router;
