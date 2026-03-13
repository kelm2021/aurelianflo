const fetch = require("node-fetch");
const { Router } = require("express");
const router = Router();

router.get("/api/fda/recalls", async (req, res) => {
  try {
    const { query, limit } = req.query;
    const searchLimit = Math.min(parseInt(limit) || 10, 100);
    const search = query ? `reason_for_recall:"${query}"` : "";

    const url = `https://api.fda.gov/food/enforcement.json?search=${encodeURIComponent(search)}&limit=${searchLimit}&sort=report_date:desc`;
    const resp = await fetch(url);
    const raw = await resp.json();

    if (raw.error) {
      return res.status(400).json({ success: false, error: raw.error.message });
    }

    const recalls = (raw.results || []).map((r) => ({
      recallNumber: r.recall_number,
      status: r.status,
      classification: r.classification,
      productDescription: r.product_description,
      reason: r.reason_for_recall,
      company: r.recalling_firm,
      city: r.city,
      state: r.state,
      country: r.country,
      reportDate: r.report_date,
      voluntaryOrMandated: r.voluntary_mandated,
    }));

    res.json({
      success: true,
      data: { query: query || "all", count: recalls.length, recalls },
      source: "openFDA Food Enforcement API",
    });
  } catch (err) {
    res.status(502).json({ success: false, error: "Upstream API error", details: err.message });
  }
});

router.get("/api/fda/adverse-events", async (req, res) => {
  try {
    const { drug, limit } = req.query;
    if (!drug) {
      return res.status(400).json({ success: false, error: "drug query param required (e.g. ?drug=aspirin)" });
    }

    const searchLimit = Math.min(parseInt(limit) || 10, 100);
    const url = `https://api.fda.gov/drug/event.json?search=patient.drug.openfda.brand_name:"${encodeURIComponent(drug)}"&limit=${searchLimit}`;
    const resp = await fetch(url);
    const raw = await resp.json();

    if (raw.error) {
      return res.status(400).json({ success: false, error: raw.error.message });
    }

    const events = (raw.results || []).map((r) => ({
      safetyReportId: r.safetyreportid,
      receiveDate: r.receivedate,
      serious: r.serious === "1",
      reactions: (r.patient?.reaction || []).map((rx) => rx.reactionmeddrapt),
      drugs: (r.patient?.drug || []).map((d) => ({
        name: d.medicinalproduct,
        role: d.drugcharacterization === "1" ? "suspect" : d.drugcharacterization === "2" ? "concomitant" : "interacting",
        indication: d.drugindication,
      })),
    }));

    res.json({
      success: true,
      data: { drug, count: events.length, events },
      source: "openFDA Drug Adverse Events API",
    });
  } catch (err) {
    res.status(502).json({ success: false, error: "Upstream API error", details: err.message });
  }
});

module.exports = router;
