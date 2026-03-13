const fetch = require("node-fetch");
const { Router } = require("express");
const router = Router();

const WEATHER_CODES = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
  80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
  85: "Slight snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
};

router.get("/api/weather/current", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ success: false, error: "lat and lon query params required" });
    }

    const resp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch`
    );
    const raw = await resp.json();
    const c = raw.current;

    res.json({
      success: true,
      data: {
        latitude: raw.latitude,
        longitude: raw.longitude,
        temperature_f: c.temperature_2m,
        feels_like_f: c.apparent_temperature,
        humidity_pct: c.relative_humidity_2m,
        precipitation_in: c.precipitation,
        wind_speed_mph: c.wind_speed_10m,
        wind_direction_deg: c.wind_direction_10m,
        condition: WEATHER_CODES[c.weather_code] || "Unknown",
        weather_code: c.weather_code,
        time: c.time,
      },
      source: "Open-Meteo API",
    });
  } catch (err) {
    res.status(502).json({ success: false, error: "Upstream API error", details: err.message });
  }
});

router.get("/api/weather/forecast", async (req, res) => {
  try {
    const { lat, lon, days } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ success: false, error: "lat and lon query params required" });
    }

    const forecastDays = Math.min(parseInt(days) || 7, 16);
    const resp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,wind_speed_10m_max&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=${forecastDays}`
    );
    const raw = await resp.json();
    const d = raw.daily;

    const forecast = d.time.map((date, i) => ({
      date,
      high_f: d.temperature_2m_max[i],
      low_f: d.temperature_2m_min[i],
      precipitation_in: d.precipitation_sum[i],
      precip_chance_pct: d.precipitation_probability_max[i],
      wind_max_mph: d.wind_speed_10m_max[i],
      condition: WEATHER_CODES[d.weather_code[i]] || "Unknown",
    }));

    res.json({
      success: true,
      data: { latitude: raw.latitude, longitude: raw.longitude, timezone: raw.timezone, forecast },
      source: "Open-Meteo API",
    });
  } catch (err) {
    res.status(502).json({ success: false, error: "Upstream API error", details: err.message });
  }
});

module.exports = router;
