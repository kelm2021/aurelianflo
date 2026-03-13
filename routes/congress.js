const fetch = require("node-fetch");
const { Router } = require("express");
const router = Router();

router.get("/api/congress/bills", async (req, res) => {
  try {
    const { query, congress, limit } = req.query;
    const apiKey = process.env.CONGRESS_API_KEY;
    if (!apiKey) return res.status(503).json({ success: false, error: "Congress API key not configured" });

    const congressNum = congress || "119";
    const pageSize = Math.min(parseInt(limit) || 20, 250);

    let url;
    if (query) {
      url = `https://api.congress.gov/v3/bill?format=json&limit=${pageSize}&api_key=${apiKey}&sort=updateDate+desc`;
    } else {
      url = `https://api.congress.gov/v3/bill/${congressNum}?format=json&limit=${pageSize}&api_key=${apiKey}`;
    }

    const resp = await fetch(url);
    const raw = await resp.json();

    const bills = (raw.bills || []).map((b) => ({
      congress: b.congress,
      type: b.type,
      number: b.number,
      title: b.title,
      latestAction: b.latestAction,
      originChamber: b.originChamber,
      updateDate: b.updateDate,
      url: b.url,
    }));

    res.json({
      success: true,
      data: { congress: parseInt(congressNum), count: bills.length, bills },
      source: "Congress.gov API",
    });
  } catch (err) {
    res.status(502).json({ success: false, error: "Upstream API error", details: err.message });
  }
});

module.exports = router;
