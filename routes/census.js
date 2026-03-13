const fetch = require("node-fetch");
const { Router } = require("express");
const router = Router();

router.get("/api/census/population", async (req, res) => {
  try {
    const { state, zip } = req.query;
    const apiKey = process.env.CENSUS_API_KEY;
    if (!apiKey) return res.status(503).json({ success: false, error: "Census API key not configured" });

    // ACS 5-year estimates: population, median income, median age
    const vars = "NAME,B01003_001E,B19013_001E,B01002_001E";
    let url;

    if (zip) {
      url = `https://api.census.gov/data/2022/acs/acs5?get=${vars}&for=zip%20code%20tabulation%20area:${zip}&key=${apiKey}`;
    } else if (state) {
      url = `https://api.census.gov/data/2022/acs/acs5?get=${vars}&for=state:${state}&key=${apiKey}`;
    } else {
      url = `https://api.census.gov/data/2022/acs/acs5?get=${vars}&for=state:*&key=${apiKey}`;
    }

    const resp = await fetch(url);
    const raw = await resp.json();

    if (!Array.isArray(raw) || raw.length < 2) {
      return res.status(404).json({ success: false, error: "No census data found for that location" });
    }

    const headers = raw[0];
    const rows = raw.slice(1).map((row) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i]));
      return {
        name: obj.NAME,
        population: parseInt(obj.B01003_001E) || null,
        medianHouseholdIncome: parseInt(obj.B19013_001E) || null,
        medianAge: parseFloat(obj.B01002_001E) || null,
        fips: obj.state || obj["zip code tabulation area"],
      };
    });

    res.json({
      success: true,
      data: { survey: "ACS 5-Year Estimates (2022)", count: rows.length, locations: rows },
      source: "US Census Bureau API",
    });
  } catch (err) {
    res.status(502).json({ success: false, error: "Upstream API error", details: err.message });
  }
});

module.exports = router;
