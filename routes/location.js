const { Router } = require("express");
const {
  UpstreamRequestError,
  requestJson,
  sendNormalizedError,
  withProviderFallback,
} = require("../lib/upstream-client");

const router = Router();

function parseCoordinate(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

function normalizeZipCode(value) {
  const zip = String(value ?? "").trim();
  return /^\d{5}$/.test(zip) ? zip : null;
}

function getNominatimUserAgent() {
  const contact = String(process.env.UPSTREAM_CONTACT_EMAIL || "").trim();
  if (contact) {
    return `x402-data-bazaar/1.0 (${contact})`;
  }
  return "x402-data-bazaar/1.0";
}

function normalizeNominatimResult(entry) {
  return {
    displayName: entry.display_name || null,
    latitude: Number(entry.lat),
    longitude: Number(entry.lon),
    type: entry.type || null,
    class: entry.class || null,
    placeId: entry.place_id || null,
    importance: Number(entry.importance),
    address: entry.address || null,
  };
}

async function inferTimezoneFromCoordinates(lat, lon) {
  const openMeteo = await requestJson({
    provider: "open-meteo",
    url:
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}` +
      "&current=temperature_2m&timezone=auto&forecast_days=1",
  });

  const timezone = openMeteo?.timezone;
  if (!timezone) {
    throw new UpstreamRequestError("Unable to infer timezone from coordinates", {
      provider: "open-meteo",
      code: "upstream_payload",
      details: openMeteo,
    });
  }

  return timezone;
}

router.get("/api/geocode", async (req, res) => {
  try {
    const query = String(req.query.query || req.query.q || "").trim();
    if (!query) {
      return res.status(400).json({ success: false, error: "query is required" });
    }

    const limit = Math.max(1, Math.min(5, Number.parseInt(String(req.query.limit || "1"), 10) || 1));
    const raw = await requestJson({
      provider: "nominatim",
      url:
        "https://nominatim.openstreetmap.org/search" +
        `?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=${limit}`,
      headers: {
        "User-Agent": getNominatimUserAgent(),
      },
    });

    const results = Array.isArray(raw) ? raw.map(normalizeNominatimResult) : [];

    return res.json({
      success: true,
      data: {
        query,
        count: results.length,
        results,
        provider: "nominatim",
        fallbackUsed: false,
      },
      source: "Nominatim (OpenStreetMap)",
    });
  } catch (error) {
    return sendNormalizedError(res, error);
  }
});

router.get("/api/reverse-geocode", async (req, res) => {
  try {
    const lat = parseCoordinate(req.query.lat, -90, 90);
    const lon = parseCoordinate(req.query.lon, -180, 180);
    if (lat == null || lon == null) {
      return res.status(400).json({ success: false, error: "lat and lon are required" });
    }

    const raw = await requestJson({
      provider: "nominatim",
      url:
        "https://nominatim.openstreetmap.org/reverse" +
        `?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=jsonv2&addressdetails=1`,
      headers: {
        "User-Agent": getNominatimUserAgent(),
      },
    });

    return res.json({
      success: true,
      data: {
        latitude: lat,
        longitude: lon,
        displayName: raw?.display_name || null,
        address: raw?.address || null,
        placeId: raw?.place_id || null,
        provider: "nominatim",
        fallbackUsed: false,
      },
      source: "Nominatim (OpenStreetMap)",
    });
  } catch (error) {
    return sendNormalizedError(res, error);
  }
});

router.get("/api/timezone/:lat/:lon", async (req, res) => {
  try {
    const lat = parseCoordinate(req.params.lat, -90, 90);
    const lon = parseCoordinate(req.params.lon, -180, 180);
    if (lat == null || lon == null) {
      return res.status(400).json({ success: false, error: "lat and lon must be valid coordinates" });
    }

    const result = await withProviderFallback({
      primary: {
        provider: "timeapi",
        enabled: true,
        execute: async () =>
          requestJson({
            provider: "timeapi",
            url:
              "https://timeapi.io/api/TimeZone/coordinate" +
              `?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`,
          }),
      },
      fallback: {
        provider: "worldtimeapi",
        enabled: true,
        execute: async () => {
          const timezone = await inferTimezoneFromCoordinates(lat, lon);
          const raw = await requestJson({
            provider: "worldtimeapi",
            url: `https://worldtimeapi.org/api/timezone/${encodeURIComponent(timezone)}`,
          });

          return {
            timeZone: timezone,
            currentLocalTime: raw?.datetime || null,
            abbreviation: raw?.abbreviation || null,
            utcOffset: raw?.utc_offset || null,
            dst: raw?.dst ?? null,
            dayOfWeek: raw?.day_of_week ?? null,
          };
        },
      },
    });

    return res.json({
      success: true,
      data: {
        latitude: lat,
        longitude: lon,
        timezone: result.data?.timeZone || result.data?.timezone || null,
        currentLocalTime: result.data?.currentLocalTime || result.data?.currentDateTime || null,
        abbreviation: result.data?.abbreviation || null,
        utcOffset: result.data?.utcOffset || null,
        dst: result.data?.dst ?? null,
        dayOfWeek: result.data?.dayOfWeek ?? null,
        provider: result.provider,
        fallbackUsed: result.fallbackUsed,
      },
      source: result.provider === "timeapi" ? "timeapi.io" : "WorldTimeAPI",
    });
  } catch (error) {
    return sendNormalizedError(res, error);
  }
});

router.get("/api/zipcode/:zip", async (req, res) => {
  try {
    const zip = normalizeZipCode(req.params.zip);
    if (!zip) {
      return res.status(400).json({ success: false, error: "zip must be a 5-digit ZIP code" });
    }

    const raw = await requestJson({
      provider: "zippopotam",
      url: `https://api.zippopotam.us/us/${zip}`,
    });
    const places = Array.isArray(raw?.places)
      ? raw.places.map((entry) => ({
          placeName: entry["place name"] || null,
          state: entry.state || null,
          stateAbbreviation: entry["state abbreviation"] || null,
          latitude: Number(entry.latitude),
          longitude: Number(entry.longitude),
        }))
      : [];

    return res.json({
      success: true,
      data: {
        zip,
        country: raw?.country || null,
        countryAbbreviation: raw?.["country abbreviation"] || null,
        count: places.length,
        places,
        provider: "zippopotam",
        fallbackUsed: false,
      },
      source: "Zippopotam.us",
    });
  } catch (error) {
    return sendNormalizedError(res, error);
  }
});

router.get("/api/elevation/:lat/:lon", async (req, res) => {
  try {
    const lat = parseCoordinate(req.params.lat, -90, 90);
    const lon = parseCoordinate(req.params.lon, -180, 180);
    if (lat == null || lon == null) {
      return res.status(400).json({ success: false, error: "lat and lon must be valid coordinates" });
    }

    const raw = await requestJson({
      provider: "open-elevation",
      url:
        "https://api.open-elevation.com/api/v1/lookup" +
        `?locations=${encodeURIComponent(`${lat},${lon}`)}`,
    });
    const result = raw?.results?.[0] || {};

    return res.json({
      success: true,
      data: {
        latitude: lat,
        longitude: lon,
        elevationMeters: Number(result.elevation),
        provider: "open-elevation",
        fallbackUsed: false,
      },
      source: "Open-Elevation API",
    });
  } catch (error) {
    return sendNormalizedError(res, error);
  }
});

router.parseCoordinate = parseCoordinate;
router.normalizeZipCode = normalizeZipCode;
router.normalizeNominatimResult = normalizeNominatimResult;
router.getNominatimUserAgent = getNominatimUserAgent;
router.inferTimezoneFromCoordinates = inferTimezoneFromCoordinates;

module.exports = router;
