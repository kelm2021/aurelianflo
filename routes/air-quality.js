const fetch = require("node-fetch");
const { Router } = require("express");
const router = Router();

router.get("/api/air-quality/:zip", async (req, res) => {
  try {
    const { zip } = req.params;
    const apiKey = process.env.AIRNOW_API_KEY;
    if (!apiKey) return res.status(503).json({ success: false, error: "AirNow API key not configured" });

    const resp = await fetch(
      `https://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode=${zip}&API_KEY=${apiKey}`
    );
    const raw = await resp.json();

    if (!Array.isArray(raw) || raw.length === 0) {
      return res.status(404).json({ success: false, error: "No air quality data for this ZIP code" });
    }

    const readings = raw.map((r) => ({
      parameter: r.ParameterName,
      aqi: r.AQI,
      category: r.Category?.Name,
      categoryNumber: r.Category?.Number,
      reportingArea: r.ReportingArea,
      state: r.StateCode,
      dateObserved: r.DateObserved,
      hourObserved: r.HourObserved,
      latitude: r.Latitude,
      longitude: r.Longitude,
    }));

    const worstAqi = readings.reduce((max, r) => (r.aqi > max.aqi ? r : max), readings[0]);

    res.json({
      success: true,
      data: {
        zip,
        overallAqi: worstAqi.aqi,
        overallCategory: worstAqi.category,
        readings,
      },
      source: "EPA AirNow API",
    });
  } catch (err) {
    res.status(502).json({ success: false, error: "Upstream API error", details: err.message });
  }
});

module.exports = router;
