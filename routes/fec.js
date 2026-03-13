const fetch = require("node-fetch");
const { Router } = require("express");
const router = Router();

router.get("/api/fec/candidates", async (req, res) => {
  try {
    const { name, office, state, party, cycle, limit } = req.query;
    const apiKey = process.env.FEC_API_KEY;
    if (!apiKey) return res.status(503).json({ success: false, error: "FEC API key not configured" });

    const params = new URLSearchParams({ api_key: apiKey, per_page: String(Math.min(parseInt(limit) || 20, 100)) });
    if (name) params.set("q", name);
    if (office) params.set("office", office.toUpperCase()); // H, S, or P
    if (state) params.set("state", state.toUpperCase());
    if (party) params.set("party", party.toUpperCase());
    if (cycle) params.set("cycle", cycle);

    const resp = await fetch(`https://api.open.fec.gov/v1/candidates/search/?${params}`);
    const raw = await resp.json();

    const candidates = (raw.results || []).map((c) => ({
      candidateId: c.candidate_id,
      name: c.name,
      party: c.party_full,
      partyCode: c.party,
      office: c.office_full,
      officeCode: c.office,
      state: c.state,
      district: c.district,
      incumbentChallenger: c.incumbent_challenge_full,
      cycles: c.cycles,
      candidateStatus: c.candidate_status,
    }));

    res.json({
      success: true,
      data: {
        count: candidates.length,
        totalCount: raw.pagination?.count || null,
        candidates,
      },
      source: "Federal Election Commission API",
    });
  } catch (err) {
    res.status(502).json({ success: false, error: "Upstream API error", details: err.message });
  }
});

module.exports = router;
