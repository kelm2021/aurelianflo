const { Router } = require("express");
const { requestJson, sendNormalizedError } = require("../lib/upstream-client");

const router = Router();
const ACS_YEAR = "2022";
const ACS_DATASET = `${ACS_YEAR}/acs/acs5`;

function getCensusKeyQuery() {
  const key = String(process.env.CENSUS_API_KEY || "").trim();
  if (!key) {
    return "";
  }

  return `&key=${encodeURIComponent(key)}`;
}

function normalizeZip(value) {
  const zip = String(value ?? "").trim();
  return /^\d{5}$/.test(zip) ? zip : null;
}

function normalizeState(value) {
  const state = String(value ?? "").trim();
  return /^\d{2}$/.test(state) ? state : null;
}

function buildGeography(req) {
  const zip = normalizeZip(req.query.zip);
  const state = normalizeState(req.query.state);

  if (req.params.zip) {
    const pathZip = normalizeZip(req.params.zip);
    if (!pathZip) {
      const error = new Error("zip must be a 5-digit ZIP code");
      error.statusCode = 400;
      throw error;
    }

    return {
      label: `ZIP ${pathZip}`,
      forQuery: `zip%20code%20tabulation%20area:${pathZip}`,
      fipsField: "zip code tabulation area",
    };
  }

  if (zip) {
    return {
      label: `ZIP ${zip}`,
      forQuery: `zip%20code%20tabulation%20area:${zip}`,
      fipsField: "zip code tabulation area",
    };
  }

  if (state) {
    return {
      label: `State ${state}`,
      forQuery: `state:${state}`,
      fipsField: "state",
    };
  }

  return {
    label: "United States",
    forQuery: "us:1",
    fipsField: "us",
  };
}

async function fetchCensusRows(variables, geography) {
  const url =
    `https://api.census.gov/data/${ACS_DATASET}?get=${encodeURIComponent(variables.join(","))}` +
    `&for=${geography.forQuery}${getCensusKeyQuery()}`;
  const raw = await requestJson({
    provider: "census",
    url,
  });

  if (!Array.isArray(raw) || raw.length < 2) {
    const error = new Error("No census data found for that location");
    error.statusCode = 404;
    throw error;
  }

  const [headers, ...rows] = raw;
  return rows.map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });
    return item;
  });
}

function toInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDecimal(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

router.get("/api/census/population", async (req, res) => {
  try {
    const geography = buildGeography(req);
    const rows = await fetchCensusRows(
      ["NAME", "B01003_001E", "B19013_001E", "B01002_001E"],
      geography,
    );

    const locations = rows.map((entry) => ({
      name: entry.NAME,
      population: toInteger(entry.B01003_001E),
      medianHouseholdIncome: toInteger(entry.B19013_001E),
      medianAge: toDecimal(entry.B01002_001E),
      fips: entry[geography.fipsField] || null,
    }));

    return res.json({
      success: true,
      data: {
        survey: `ACS 5-Year Estimates (${ACS_YEAR})`,
        count: locations.length,
        locations,
      },
      source: "US Census Bureau API",
    });
  } catch (error) {
    return sendNormalizedError(res, error);
  }
});

router.get("/api/census/housing", async (req, res) => {
  try {
    const geography = buildGeography(req);
    const rows = await fetchCensusRows(
      ["NAME", "B25077_001E", "B25003_002E", "B25003_003E"],
      geography,
    );

    const locations = rows.map((entry) => {
      const ownerOccupied = toInteger(entry.B25003_002E);
      const renterOccupied = toInteger(entry.B25003_003E);
      const occupiedTotal =
        Number.isFinite(ownerOccupied) && Number.isFinite(renterOccupied)
          ? ownerOccupied + renterOccupied
          : null;
      const renterRatioPct =
        occupiedTotal && occupiedTotal > 0
          ? Number(((renterOccupied / occupiedTotal) * 100).toFixed(2))
          : null;

      return {
        name: entry.NAME,
        medianHomeValue: toInteger(entry.B25077_001E),
        ownerOccupied,
        renterOccupied,
        renterRatioPct,
        fips: entry[geography.fipsField] || null,
      };
    });

    return res.json({
      success: true,
      data: {
        survey: `ACS 5-Year Estimates (${ACS_YEAR})`,
        geography: geography.label,
        count: locations.length,
        locations,
      },
      source: "US Census Bureau API",
    });
  } catch (error) {
    return sendNormalizedError(res, error);
  }
});

router.get("/api/census/income/:zip", async (req, res) => {
  try {
    const geography = buildGeography(req);
    const rows = await fetchCensusRows(
      ["NAME", "B19013_001E", "B19301_001E", "B17001_002E", "B01003_001E"],
      geography,
    );
    const entry = rows[0];
    const population = toInteger(entry.B01003_001E);
    const povertyCount = toInteger(entry.B17001_002E);
    const povertyRatePct =
      Number.isFinite(population) && population > 0 && Number.isFinite(povertyCount)
        ? Number(((povertyCount / population) * 100).toFixed(2))
        : null;

    return res.json({
      success: true,
      data: {
        survey: `ACS 5-Year Estimates (${ACS_YEAR})`,
        zip: normalizeZip(req.params.zip),
        medianHouseholdIncome: toInteger(entry.B19013_001E),
        perCapitaIncome: toInteger(entry.B19301_001E),
        population,
        povertyCount,
        povertyRatePct,
      },
      source: "US Census Bureau API",
    });
  } catch (error) {
    return sendNormalizedError(res, error);
  }
});

router.get("/api/census/age-breakdown", async (req, res) => {
  try {
    const geography = buildGeography(req);
    const variables = [
      "NAME",
      "B01003_001E",
      "B01001_003E",
      "B01001_004E",
      "B01001_005E",
      "B01001_006E",
      "B01001_007E",
      "B01001_027E",
      "B01001_028E",
      "B01001_029E",
      "B01001_030E",
      "B01001_031E",
    ];
    const rows = await fetchCensusRows(variables, geography);
    const entry = rows[0];

    const male = [
      { bucket: "Under 5", count: toInteger(entry.B01001_003E) },
      { bucket: "5-9", count: toInteger(entry.B01001_004E) },
      { bucket: "10-14", count: toInteger(entry.B01001_005E) },
      { bucket: "15-17", count: toInteger(entry.B01001_006E) },
      { bucket: "18-19", count: toInteger(entry.B01001_007E) },
    ];
    const female = [
      { bucket: "Under 5", count: toInteger(entry.B01001_027E) },
      { bucket: "5-9", count: toInteger(entry.B01001_028E) },
      { bucket: "10-14", count: toInteger(entry.B01001_029E) },
      { bucket: "15-17", count: toInteger(entry.B01001_030E) },
      { bucket: "18-19", count: toInteger(entry.B01001_031E) },
    ];

    return res.json({
      success: true,
      data: {
        survey: `ACS 5-Year Estimates (${ACS_YEAR})`,
        geography: geography.label,
        totalPopulation: toInteger(entry.B01003_001E),
        male,
        female,
      },
      source: "US Census Bureau API",
    });
  } catch (error) {
    return sendNormalizedError(res, error);
  }
});

router.normalizeZip = normalizeZip;
router.normalizeState = normalizeState;

module.exports = router;
