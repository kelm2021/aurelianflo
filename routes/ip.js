const fetch = require("node-fetch");
const { Router } = require("express");
const router = Router();

router.get("/api/ip/:ip", async (req, res) => {
  try {
    const { ip } = req.params;

    const resp = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as`);
    const raw = await resp.json();

    if (raw.status !== "success") {
      return res.status(400).json({ success: false, error: raw.message || "Invalid IP address" });
    }

    res.json({
      success: true,
      data: {
        ip,
        country: raw.country,
        countryCode: raw.countryCode,
        region: raw.regionName,
        regionCode: raw.region,
        city: raw.city,
        zip: raw.zip,
        latitude: raw.lat,
        longitude: raw.lon,
        timezone: raw.timezone,
        isp: raw.isp,
        org: raw.org,
        asn: raw.as,
      },
      source: "ip-api.com",
    });
  } catch (err) {
    res.status(502).json({ success: false, error: "Upstream API error", details: err.message });
  }
});

module.exports = router;
