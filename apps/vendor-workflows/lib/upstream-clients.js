const {
  buildScreeningData,
  fetchBatchSearchResults,
  fetchSearchResults,
  fetchSourceFreshness,
} = require("../../restricted-party-screen/lib/ofac");
const {
  buildVendorEntityBriefResponse,
  fetchEntityCandidates,
} = require("../../vendor-entity-brief/lib/vendor-entity-brief");

const SANCTIONS_KEYWORDS = ["SBERBANK", "VTB", "GAZPROMBANK", "ROSBANK"];
const HIGH_RISK_COUNTRIES = new Set(["RU", "BY", "IR", "KP", "SY", "CU"]);

function normalizeName(value) {
  return String(value || "").trim().toUpperCase();
}

function shouldUseRealUpstreams() {
  return (
    process.env.AURELIAN_VENDOR_WORKFLOW_USE_REAL === "1" ||
    process.env.VERCEL === "1" ||
    process.env.NODE_ENV === "production"
  );
}

function toVendorQuery(vendor, options) {
  return {
    name: String(vendor.name || "").trim(),
    country: String(vendor.country || "").trim().toUpperCase(),
    minScore: options.screening_threshold,
    limit: options.screening_limit,
    type: "Entity",
    programs: [],
    list: "",
  };
}

function buildScreeningEvidence(vendor, options) {
  const name = normalizeName(vendor.name);
  const keywordHit = SANCTIONS_KEYWORDS.some((keyword) => name.includes(keyword));
  const highRiskCountry = vendor.country && HIGH_RISK_COUNTRIES.has(vendor.country);

  const exact_match_count = keywordHit ? 1 : 0;
  const match_count = keywordHit || highRiskCountry ? 1 : 0;
  const best_name_score = keywordHit ? 99 : highRiskCountry ? 91 : 12;
  const manual_review_recommended = best_name_score >= options.screening_threshold || highRiskCountry;

  return {
    match_count,
    exact_match_count,
    best_name_score,
    manual_review_recommended,
    source: "stubbed-screening-composition",
  };
}

function buildBriefEvidence(vendor, screening) {
  const lowResolution = screening.match_count > 0 && !vendor.country;
  return {
    status: screening.manual_review_recommended ? "manual-review-required" : "clear",
    manual_review_recommended: screening.manual_review_recommended,
    lei_candidate_count: lowResolution ? 0 : 1,
    entity_resolution_quality: lowResolution ? "low" : "high",
    jurisdiction: vendor.country || "unknown",
    source: "stubbed-vendor-entity-brief",
  };
}

async function composeVendorEvidence(params) {
  if (shouldUseRealUpstreams()) {
    try {
      return await composeRealVendorEvidence(params);
    } catch (error) {
      const fallback = await composeStubVendorEvidence(params);
      return {
        ...fallback,
        diagnostics: {
          ...fallback.diagnostics,
          upstream_error: String(error?.message || "real upstream composition failed"),
          fallback_reason: "real-upstream-error",
        },
      };
    }
  }

  return composeStubVendorEvidence(params);
}

async function composeRealVendorEvidence(params) {
  const vendors = Array.isArray(params.vendors) ? params.vendors : [];
  const options = params.options || {};
  const freshness = await fetchSourceFreshness();

  const entries = [];
  let brief_calls = 0;
  let batch_screen_calls = 0;
  let screening_calls = 0;
  let brief_fallback_calls = 0;

  const screeningByVendor = new Map();

  if (params.mode === "vendor_batch") {
    batch_screen_calls = 1;
    const queries = vendors.map((vendor) => toVendorQuery(vendor, options));
    const batchRawMatches = await fetchBatchSearchResults(queries);

    vendors.forEach((vendor, index) => {
      const screeningData = buildScreeningData(
        queries[index],
        Array.isArray(batchRawMatches[index]) ? batchRawMatches[index] : [],
      );
      screeningByVendor.set(normalizeName(vendor.name), screeningData);
    });
  }

  for (const vendor of vendors) {
    const vendorQuery = toVendorQuery(vendor, options);
    const vendorKey = normalizeName(vendor.name);
    let screeningData = screeningByVendor.get(vendorKey);

    if (!screeningData) {
      const rawMatches = await fetchSearchResults(vendorQuery);
      screeningData = buildScreeningData(vendorQuery, rawMatches);
      screening_calls += 1;
    }

    const screening = {
      match_count: screeningData.summary.matchCount,
      exact_match_count: screeningData.summary.exactMatchCount,
      best_name_score: screeningData.matches?.[0]?.bestNameScore ?? 0,
      manual_review_recommended: Boolean(screeningData.summary.manualReviewRecommended),
      top_match: screeningData.matches?.[0] ?? null,
      source: "ofac-screening-composition",
    };

    let includeBrief = false;
    if (params.mode === "single_vendor") {
      includeBrief = true;
    } else if (screening.manual_review_recommended) {
      includeBrief = true;
    } else if (vendor.criticality === "high" || vendor.criticality === "critical") {
      includeBrief = true;
    }

    const brief = includeBrief
      ? await buildRealBriefEvidence(vendorQuery, vendor, screeningData, freshness)
      : {
          status: "not-requested",
          manual_review_recommended: screening.manual_review_recommended,
          lei_candidate_count: 0,
          entity_resolution_quality: "unknown",
          jurisdiction: vendor.country || "unknown",
          source: "vendor-entity-brief-not-requested",
        };
    if (includeBrief) {
      if (brief.source === "vendor-entity-brief") {
        brief_calls += 1;
      } else {
        brief_fallback_calls += 1;
      }
    }

    entries.push({
      vendor,
      screening,
      brief,
    });
  }

  return {
    entries,
    diagnostics: {
      brief_calls,
      brief_fallback_calls,
      batch_screen_calls,
      screening_calls,
      stubbed: false,
      source_freshness: freshness,
    },
  };
}

async function buildRealBriefEvidence(query, vendor, screeningData, freshness) {
  try {
    const entitySearch = await fetchEntityCandidates(query);
    const briefResponse = buildVendorEntityBriefResponse(
      query,
      entitySearch,
      screeningData,
      freshness,
    );
    const summary = briefResponse?.data?.summary || {};
    const bestEntity = briefResponse?.data?.bestEntityCandidate || null;

    return {
      status: summary.status || "clear",
      manual_review_recommended: Boolean(summary.manualReviewRecommended),
      lei_candidate_count: Number(summary.leiCandidateCount || 0),
      entity_resolution_quality: summary.entityResolutionConfidence || "unknown",
      jurisdiction: bestEntity?.jurisdiction || vendor.country || "unknown",
      source: "vendor-entity-brief",
      best_entity_candidate: bestEntity,
    };
  } catch (error) {
    return {
      ...buildBriefEvidence(vendor, {
        match_count: screeningData.summary.matchCount,
        exact_match_count: screeningData.summary.exactMatchCount,
        best_name_score: screeningData.matches?.[0]?.bestNameScore ?? 0,
        manual_review_recommended: Boolean(screeningData.summary.manualReviewRecommended),
      }),
      source: "stubbed-vendor-entity-brief-fallback",
      upstream_error: String(error?.message || "vendor brief lookup failed"),
    };
  }
}

async function composeStubVendorEvidence(params) {
  const vendors = Array.isArray(params.vendors) ? params.vendors : [];
  const options = params.options || {};

  const entries = [];
  let brief_calls = 0;
  let batch_screen_calls = 0;
  let screening_calls = 0;

  if (params.mode === "vendor_batch") {
    batch_screen_calls = 1;
  }

  for (const vendor of vendors) {
    const screening = buildScreeningEvidence(vendor, options);
    screening_calls += 1;

    let includeBrief = false;
    if (params.mode === "single_vendor") {
      includeBrief = true;
    } else if (screening.manual_review_recommended) {
      includeBrief = true;
    } else if (vendor.criticality === "high" || vendor.criticality === "critical") {
      includeBrief = true;
    }

    const brief = includeBrief
      ? buildBriefEvidence(vendor, screening)
      : {
          status: "not-requested",
          manual_review_recommended: screening.manual_review_recommended,
          lei_candidate_count: 0,
          entity_resolution_quality: "unknown",
          jurisdiction: vendor.country || "unknown",
          source: "stubbed-vendor-entity-brief",
        };
    if (includeBrief) {
      brief_calls += 1;
    }

    entries.push({
      vendor,
      screening,
      brief,
    });
  }

  return {
    entries,
    diagnostics: {
      brief_calls,
      batch_screen_calls,
      screening_calls,
      stubbed: true,
    },
  };
}

module.exports = {
  composeVendorEvidence,
};
