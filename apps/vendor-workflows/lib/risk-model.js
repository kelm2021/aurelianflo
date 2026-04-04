const CRITICALITY_POINTS = {
  low: 0.01,
  medium: 0.05,
  high: 0.1,
  critical: 0.15,
};

const HIGH_RISK_COUNTRIES = new Set(["RU", "BY", "IR", "KP", "SY", "CU"]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function tierFromScore(score) {
  if (score >= 0.85) {
    return "critical";
  }
  if (score >= 0.6) {
    return "high";
  }
  if (score >= 0.35) {
    return "medium";
  }
  return "low";
}

function actionFromTier(tier) {
  if (tier === "critical") {
    return "reject-or-escalate";
  }
  if (tier === "high") {
    return "pause-and-review";
  }
  return "proceed";
}

function evaluateVendorRisk(vendor, evidence) {
  let score = 0;
  const reasons = [];

  if (evidence.screening.exact_match_count > 0) {
    score += 0.7;
    reasons.push("High-confidence sanctions match");
  } else if (evidence.screening.match_count > 0) {
    score += 0.45;
    reasons.push("Potential restricted-party match detected");
  }

  if (evidence.screening.manual_review_recommended) {
    score += 0.2;
    reasons.push("Screening source recommends manual review");
  }

  if (vendor.country && HIGH_RISK_COUNTRIES.has(vendor.country)) {
    score += 0.15;
    reasons.push("Vendor jurisdiction falls in elevated sanctions-risk bucket");
  }

  if (vendor.cross_border) {
    score += 0.08;
    reasons.push("Cross-border vendor relationship");
  }

  if (Number.isFinite(vendor.annual_spend_usd)) {
    if (vendor.annual_spend_usd >= 1000000) {
      score += 0.08;
      reasons.push("High annual spend exposure");
    } else if (vendor.annual_spend_usd >= 100000) {
      score += 0.03;
      reasons.push("Material annual spend exposure");
    }
  }

  score += CRITICALITY_POINTS[vendor.criticality] || 0;
  if (vendor.criticality === "high" || vendor.criticality === "critical") {
    reasons.push(`Vendor criticality is ${vendor.criticality}`);
  }

  if (evidence.brief.entity_resolution_quality === "low") {
    score += 0.08;
    reasons.push("Entity resolution confidence is low");
  }

  score = clamp(score, 0, 0.99);

  if (evidence.screening.manual_review_recommended && score < 0.35) {
    score = 0.38;
  }

  const risk_tier = tierFromScore(score);
  const recommended_action = actionFromTier(risk_tier);
  const manual_review_required = evidence.screening.manual_review_recommended || risk_tier === "high" || risk_tier === "critical";

  if (reasons.length === 0) {
    reasons.push("No material restricted-party signal detected");
  }

  return {
    risk_score: Number(score.toFixed(4)),
    risk_tier,
    recommended_action,
    manual_review_required,
    reasons,
  };
}

module.exports = {
  evaluateVendorRisk,
};
