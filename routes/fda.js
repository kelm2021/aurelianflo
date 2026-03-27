const fetch = require("node-fetch");
const { Router } = require("express");
const router = Router();

const CLASSIFICATION_PRIORITY = {
  "Class I": 3,
  "Class II": 2,
  "Class III": 1,
};

function parseSearchLimit(value, fallback = 10, max = 100) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, parsed));
}

function buildRecallDecision(recalls, queryLabel) {
  if (!recalls.length) {
    return {
      riskLevel: "none",
      summary: `No FDA food recalls matched query "${queryLabel}".`,
      recommendedAction: "No immediate hold action needed. Continue routine monitoring.",
    };
  }

  const classBreakdown = recalls.reduce((accumulator, recall) => {
    const key = recall.classification || "Unclassified";
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
  const highestClassification =
    recalls
      .slice()
      .sort(
        (left, right) =>
          (CLASSIFICATION_PRIORITY[right.classification] || 0) -
          (CLASSIFICATION_PRIORITY[left.classification] || 0),
      )[0]?.classification || "Unclassified";

  if (highestClassification === "Class I") {
    return {
      riskLevel: "critical",
      highestClassification,
      classBreakdown,
      summary: `Class I recalls are present for query "${queryLabel}", indicating a high probability of serious adverse health consequences.`,
      recommendedAction:
        "Immediately quarantine matching inventory, pause fulfillment, and verify affected lot codes before release.",
    };
  }

  if (highestClassification === "Class II") {
    return {
      riskLevel: "high",
      highestClassification,
      classBreakdown,
      summary: `Class II recalls are present for query "${queryLabel}", indicating meaningful health risk if exposure occurs.`,
      recommendedAction:
        "Place suspect items on hold and complete lot-level verification before shipping or sale.",
    };
  }

  return {
    riskLevel: "moderate",
    highestClassification,
    classBreakdown,
    summary: `Only Class III or unclassified recalls are present for query "${queryLabel}".`,
    recommendedAction:
      "Review supplier updates and remove confirmed affected lots during normal quality-control workflows.",
  };
}

function buildAdverseEventDecision({ count, seriousCount, topReactions, drug }) {
  if (!count) {
    return {
      riskLevel: "none",
      summary: `No adverse-event reports were returned for "${drug}".`,
      recommendedAction: "No immediate escalation needed; continue routine monitoring.",
    };
  }

  const seriousRate = seriousCount / count;
  const seriousRatePct = Math.round(seriousRate * 100);

  if (seriousRate >= 0.4) {
    return {
      riskLevel: "high",
      seriousEventRatePct: seriousRatePct,
      summary: `${seriousCount} of ${count} reports (${seriousRatePct}%) are serious for "${drug}".`,
      recommendedAction:
        "Escalate for pharmacovigilance review, inspect recent signal trends, and evaluate risk controls before broad recommendations.",
      watchlistReactions: topReactions.slice(0, 3),
    };
  }

  if (seriousRate >= 0.15) {
    return {
      riskLevel: "elevated",
      seriousEventRatePct: seriousRatePct,
      summary: `${seriousCount} of ${count} reports (${seriousRatePct}%) are serious for "${drug}".`,
      recommendedAction:
        "Maintain active monitoring and trigger manual review if serious reports continue rising.",
      watchlistReactions: topReactions.slice(0, 3),
    };
  }

  return {
    riskLevel: "monitor",
    seriousEventRatePct: seriousRatePct,
    summary: `${seriousCount} of ${count} reports (${seriousRatePct}%) are serious for "${drug}".`,
    recommendedAction:
      "Continue routine monitoring and compare against baseline incidence for similar therapies.",
    watchlistReactions: topReactions.slice(0, 3),
  };
}

async function fetchOpenFda(url) {
  const response = await fetch(url);
  const raw = await response.json();
  if (raw?.error) {
    const error = new Error(raw.error.message || "openFDA request failed");
    error.statusCode = response.status === 404 ? 404 : 400;
    throw error;
  }
  return raw;
}

async function fetchAdverseEvents(drug, limit) {
  const searchLimit = parseSearchLimit(limit, 10, 100);
  const search = `patient.drug.openfda.brand_name:"${String(drug || "").trim()}"`;
  const url =
    "https://api.fda.gov/drug/event.json" +
    `?search=${encodeURIComponent(search)}&limit=${searchLimit}`;
  const raw = await fetchOpenFda(url);

  const events = (raw.results || []).map((entry) => ({
    safetyReportId: entry.safetyreportid,
    receiveDate: entry.receivedate,
    serious: entry.serious === "1",
    reactions: (entry.patient?.reaction || []).map((reaction) => reaction.reactionmeddrapt),
    drugs: (entry.patient?.drug || []).map((drugItem) => ({
      name: drugItem.medicinalproduct,
      role:
        drugItem.drugcharacterization === "1"
          ? "suspect"
          : drugItem.drugcharacterization === "2"
            ? "concomitant"
            : "interacting",
      indication: drugItem.drugindication,
    })),
  }));

  const seriousCount = events.filter((event) => event.serious).length;
  const reactionCounts = new Map();
  for (const event of events) {
    for (const reaction of event.reactions) {
      const key = String(reaction || "").trim();
      if (!key) {
        continue;
      }
      reactionCounts.set(key, (reactionCounts.get(key) || 0) + 1);
    }
  }

  const topReactions = [...reactionCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([reaction, reportCount]) => ({ reaction, reportCount }));

  return {
    drug,
    count: events.length,
    events,
    signal: {
      seriousEvents: seriousCount,
      totalEvents: events.length,
      seriousEventRatePct: events.length ? Math.round((seriousCount / events.length) * 100) : 0,
      topReactions,
    },
    decision: buildAdverseEventDecision({
      count: events.length,
      seriousCount,
      topReactions,
      drug,
    }),
  };
}

router.get("/api/fda/recalls", async (req, res) => {
  try {
    const { query, limit } = req.query;
    const searchLimit = parseSearchLimit(limit, 10, 100);
    const search = query ? `reason_for_recall:"${query}"` : "";

    const url =
      "https://api.fda.gov/food/enforcement.json" +
      `?search=${encodeURIComponent(search)}&limit=${searchLimit}&sort=report_date:desc`;
    const raw = await fetchOpenFda(url);

    const recalls = (raw.results || []).map((entry) => ({
      recallNumber: entry.recall_number,
      status: entry.status,
      classification: entry.classification,
      productDescription: entry.product_description,
      reason: entry.reason_for_recall,
      company: entry.recalling_firm,
      city: entry.city,
      state: entry.state,
      country: entry.country,
      reportDate: entry.report_date,
      voluntaryOrMandated: entry.voluntary_mandated,
    }));
    const queryLabel = query || "all";

    res.json({
      success: true,
      data: {
        query: queryLabel,
        count: recalls.length,
        recalls,
        decision: buildRecallDecision(recalls, queryLabel),
      },
      source: "openFDA Food Enforcement API",
    });
  } catch (error) {
    res
      .status(error.statusCode || 502)
      .json({ success: false, error: error.statusCode ? error.message : "Upstream API error", details: error.message });
  }
});

router.get("/api/fda/adverse-events", async (req, res) => {
  try {
    const drug = String(req.query.drug ?? "aspirin").trim() || "aspirin";
    const data = await fetchAdverseEvents(drug, req.query.limit);
    res.json({
      success: true,
      data,
      source: "openFDA Drug Adverse Events API",
    });
  } catch (error) {
    res
      .status(error.statusCode || 502)
      .json({ success: false, error: error.statusCode ? error.message : "Upstream API error", details: error.message });
  }
});

router.get("/api/fda/drug-events/:drug", async (req, res) => {
  try {
    const drug = String(req.params.drug || "").trim();
    if (!drug) {
      return res.status(400).json({ success: false, error: "drug is required" });
    }

    const data = await fetchAdverseEvents(drug, req.query.limit);
    return res.json({
      success: true,
      data,
      source: "openFDA Drug Adverse Events API",
    });
  } catch (error) {
    return res
      .status(error.statusCode || 502)
      .json({ success: false, error: error.statusCode ? error.message : "Upstream API error", details: error.message });
  }
});

router.get("/api/fda/drug-labels/:drug", async (req, res) => {
  try {
    const drug = String(req.params.drug || "").trim();
    if (!drug) {
      return res.status(400).json({ success: false, error: "drug is required" });
    }
    const limit = parseSearchLimit(req.query.limit, 10, 25);
    const search = `openfda.brand_name:"${drug}" + openfda.generic_name:"${drug}"`;
    const raw = await fetchOpenFda(
      "https://api.fda.gov/drug/label.json" +
        `?search=${encodeURIComponent(search)}&limit=${limit}`,
    );
    const labels = (raw.results || []).map((entry) => ({
      setId: entry.set_id,
      brandName: entry.openfda?.brand_name?.[0] || null,
      genericName: entry.openfda?.generic_name?.[0] || null,
      warnings: entry.warnings || [],
      indications: entry.indications_and_usage || [],
      dosage: entry.dosage_and_administration || [],
      contraindications: entry.contraindications || [],
      route: entry.openfda?.route || [],
      manufacturer: entry.openfda?.manufacturer_name?.[0] || null,
    }));

    return res.json({
      success: true,
      data: { drug, count: labels.length, labels },
      source: "openFDA Drug Label API",
    });
  } catch (error) {
    return res
      .status(error.statusCode || 502)
      .json({ success: false, error: error.statusCode ? error.message : "Upstream API error", details: error.message });
  }
});

router.get("/api/fda/medical-devices", async (req, res) => {
  try {
    const query = String(req.query.query || "").trim();
    const limit = parseSearchLimit(req.query.limit, 10, 50);
    const search = query ? `device.brand_name:"${query}"` : "";
    const raw = await fetchOpenFda(
      "https://api.fda.gov/device/event.json" +
        `?search=${encodeURIComponent(search)}&limit=${limit}&sort=date_received:desc`,
    );

    const events = (raw.results || []).map((entry) => ({
      reportNumber: entry.mdr_report_key || null,
      eventDate: entry.date_received || null,
      deviceName: entry.device?.[0]?.brand_name || null,
      manufacturer: entry.device?.[0]?.manufacturer_d_name || null,
      eventType: entry.event_type || null,
      patientOutcome: entry.patient?.[0]?.sequence_number_outcome?.[0] || null,
      reportSource: entry.source_type || null,
    }));

    return res.json({
      success: true,
      data: { query: query || "all", count: events.length, events },
      source: "openFDA Device Event API",
    });
  } catch (error) {
    return res
      .status(error.statusCode || 502)
      .json({ success: false, error: error.statusCode ? error.message : "Upstream API error", details: error.message });
  }
});

router.get("/api/fda/device-recalls", async (req, res) => {
  try {
    const query = String(req.query.query || "").trim();
    const limit = parseSearchLimit(req.query.limit, 10, 50);
    const search = query ? `reason_for_recall:"${query}"` : "";
    const raw = await fetchOpenFda(
      "https://api.fda.gov/device/recall.json" +
        `?search=${encodeURIComponent(search)}&limit=${limit}&sort=event_date_terminated:desc`,
    );

    const recalls = (raw.results || []).map((entry) => ({
      recallNumber: entry.recall_number || null,
      status: entry.status || null,
      classification: entry.classification || null,
      productCode: entry.product_code || null,
      productDescription: entry.product_description || null,
      reason: entry.reason_for_recall || null,
      firm: entry.recalling_firm || null,
      recallInitiationDate: entry.recall_initiation_date || null,
    }));

    return res.json({
      success: true,
      data: { query: query || "all", count: recalls.length, recalls },
      source: "openFDA Device Recall API",
    });
  } catch (error) {
    return res
      .status(error.statusCode || 502)
      .json({ success: false, error: error.statusCode ? error.message : "Upstream API error", details: error.message });
  }
});

router.get("/api/fda/ndc/:code", async (req, res) => {
  try {
    const code = String(req.params.code || "").trim();
    if (!code) {
      return res.status(400).json({ success: false, error: "code is required" });
    }
    const normalizedCode = code.replace(/\s+/g, "");
    const raw = await fetchOpenFda(
      "https://api.fda.gov/drug/ndc.json" +
        `?search=${encodeURIComponent(`product_ndc:"${normalizedCode}"`)}&limit=10`,
    );
    const products = (raw.results || []).map((entry) => ({
      productNdc: entry.product_ndc || null,
      brandName: entry.brand_name || null,
      genericName: entry.generic_name || null,
      dosageForm: entry.dosage_form || null,
      route: entry.route || [],
      labelerName: entry.labeler_name || null,
      marketingStatus: entry.marketing_category || null,
      listingExpirationDate: entry.listing_expiration_date || null,
    }));

    return res.json({
      success: true,
      data: {
        ndc: normalizedCode,
        count: products.length,
        products,
      },
      source: "openFDA NDC API",
    });
  } catch (error) {
    return res
      .status(error.statusCode || 502)
      .json({ success: false, error: error.statusCode ? error.message : "Upstream API error", details: error.message });
  }
});

router.parseSearchLimit = parseSearchLimit;
router.fetchAdverseEvents = fetchAdverseEvents;

module.exports = router;
