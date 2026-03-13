const fetch = require("node-fetch");
const { Router } = require("express");
const router = Router();

router.get("/api/exchange-rates/:base", async (req, res) => {
  try {
    const { base } = req.params;
    const { symbols } = req.query;

    const resp = await fetch(`https://open.er-api.com/v6/latest/${base.toUpperCase()}`);
    const raw = await resp.json();

    if (raw.result !== "success") {
      return res.status(400).json({ success: false, error: `Invalid base currency: ${base}` });
    }

    let rates = raw.rates;
    if (symbols) {
      const wanted = symbols.toUpperCase().split(",");
      rates = {};
      for (const s of wanted) {
        if (raw.rates[s]) rates[s] = raw.rates[s];
      }
    }

    res.json({
      success: true,
      data: {
        base: base.toUpperCase(),
        lastUpdated: raw.time_last_update_utc,
        rates,
      },
      source: "ExchangeRate-API (open.er-api.com)",
    });
  } catch (err) {
    res.status(502).json({ success: false, error: "Upstream API error", details: err.message });
  }
});

module.exports = router;
