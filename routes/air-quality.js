const fetch = require("node-fetch");
const { Router } = require("express");
const router = Router();

function buildAirQualityDecision({ aqi, category, dominantPollutant }) {
  const normalizedCategory = String(category ?? "").trim() || "Unknown";

  if (aqi <= 50) {
    return {
      riskLevel: "low",
      summary: `Air quality is ${normalizedCategory} (AQI ${aqi}). Outdoor activity is generally safe for most people.`,
      outdoorGuidance: "Proceed with normal outdoor plans.",
      sensitiveGroupGuidance: "No special precautions for most people.",
      maskRecommended: false,
      dominantPollutant,
    };
  }

  if (aqi <= 100) {
    return {
      riskLevel: "moderate",
      summary: `Air quality is ${normalizedCategory} (AQI ${aqi}). Most people can continue normal activity, but sensitive groups should reduce prolonged exertion.`,
      outdoorGuidance: "Short outdoor activity is usually fine; avoid prolonged heavy exertion.",
      sensitiveGroupGuidance:
        "Children, older adults, and people with asthma or heart/lung conditions should pace activity.",
      maskRecommended: false,
      dominantPollutant,
    };
  }

  if (aqi <= 150) {
    return {
      riskLevel: "elevated",
      summary: `Air quality is ${normalizedCategory} (AQI ${aqi}). Sensitive groups are at higher risk and should limit outdoor exertion.`,
      outdoorGuidance: "Reduce prolonged outdoor activity, especially cardio-heavy sessions.",
      sensitiveGroupGuidance:
        "Sensitive groups should minimize time outdoors and consider well-fitted masks.",
      maskRecommended: true,
      dominantPollutant,
    };
  }

  if (aqi <= 200) {
    return {
      riskLevel: "high",
      summary: `Air quality is ${normalizedCategory} (AQI ${aqi}). Everyone should reduce prolonged outdoor exertion.`,
      outdoorGuidance: "Move training and extended activities indoors where possible.",
      sensitiveGroupGuidance: "Sensitive groups should avoid outdoor exertion.",
      maskRecommended: true,
      dominantPollutant,
    };
  }

  return {
    riskLevel: "very-high",
    summary: `Air quality is ${normalizedCategory} (AQI ${aqi}). Health risk is significant and outdoor exposure should be minimized.`,
    outdoorGuidance: "Avoid non-essential outdoor activity until conditions improve.",
    sensitiveGroupGuidance: "Sensitive groups should remain indoors with filtered air.",
    maskRecommended: true,
    dominantPollutant,
  };
}

async function fetchAirQualityByZip(zip, options = {}) {
  const apiKey = options.apiKey ?? process.env.AIRNOW_API_KEY;
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!apiKey) {
    const error = new Error("AirNow API key not configured");
    error.statusCode = 503;
    throw error;
  }

  const resp = await fetchImpl(
    `https://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode=${zip}&API_KEY=${apiKey}`,
  );
  const raw = await resp.json();

  if (!Array.isArray(raw) || raw.length === 0) {
    const error = new Error("No air quality data for this ZIP code");
    error.statusCode = 404;
    throw error;
  }

  const readings = raw.map((r) => ({
    parameter: r.ParameterName,
    aqi: Number(r.AQI),
    category: r.Category?.Name,
    categoryNumber: r.Category?.Number,
    reportingArea: r.ReportingArea,
    state: r.StateCode,
    dateObserved: r.DateObserved,
    hourObserved: r.HourObserved,
    latitude: r.Latitude,
    longitude: r.Longitude,
  }));

  const validReadings = readings.filter((reading) => Number.isFinite(reading.aqi));
  if (!validReadings.length) {
    const error = new Error("Upstream API returned non-numeric AQI readings");
    error.statusCode = 502;
    throw error;
  }

  const worstAqi = validReadings.reduce(
    (max, reading) => (reading.aqi > max.aqi ? reading : max),
    validReadings[0],
  );
  const decision = buildAirQualityDecision({
    aqi: worstAqi.aqi,
    category: worstAqi.category,
    dominantPollutant: worstAqi.parameter,
  });

  return {
    zip,
    overallAqi: worstAqi.aqi,
    overallCategory: worstAqi.category,
    dominantPollutant: worstAqi.parameter,
    decision,
    readings,
  };
}

router.get("/api/air-quality/:zip", async (req, res) => {
  try {
    const { zip } = req.params;
    const data = await fetchAirQualityByZip(zip);

    res.json({
      success: true,
      data,
      source: "EPA AirNow API",
    });
  } catch (err) {
    res
      .status(err.statusCode || 502)
      .json({ success: false, error: err.statusCode ? err.message : "Upstream API error", details: err.message });
  }
});

router.fetchAirQualityByZip = fetchAirQualityByZip;
router.buildAirQualityDecision = buildAirQualityDecision;

module.exports = router;
