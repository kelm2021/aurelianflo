const { composeVendorEvidence } = require("../../lib/upstream-clients");
const { evaluateVendorRisk } = require("../../lib/risk-model");
const { buildDocumentArtifact } = require("../../../../routes/auto-local/doc-artifacts");

function buildAssumptions(upstreamStubbed) {
  return [
    "This workflow is a triage and screening aid, not legal clearance.",
    upstreamStubbed
      ? "Risk scoring combines fallback stub evidence with vendor context fields."
      : "Risk scoring combines live OFAC screening and GLEIF entity-resolution signals with vendor context fields.",
  ];
}

const SEVERITY_RANK = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const ARTIFACT_ROUTE_PATHS = {
  xlsx: "/api/tools/xlsx/generate",
  pdf: "/api/tools/report/generate",
  docx: "/api/tools/docx/generate",
};

function sortByRisk(a, b) {
  if (b.risk_score !== a.risk_score) {
    return b.risk_score - a.risk_score;
  }
  return a.name.localeCompare(b.name);
}

function summarizeResults(vendors) {
  let flagged = 0;
  let mostSevereTier = "low";

  for (const vendor of vendors) {
    if (vendor.manual_review_required) {
      flagged += 1;
    }
    if (SEVERITY_RANK[vendor.risk_tier] > SEVERITY_RANK[mostSevereTier]) {
      mostSevereTier = vendor.risk_tier;
    }
  }

  const clear = vendors.length - flagged;
  const status = flagged > 0 ? "manual-review-required" : "clear-to-proceed";

  let recommended_action = "proceed";
  if (mostSevereTier === "critical") {
    recommended_action = "reject-or-escalate";
  } else if (flagged > 0) {
    recommended_action = "pause-and-review";
  }

  return {
    status,
    recommended_action,
    risk_tier: mostSevereTier,
    flagged_vendor_count: flagged,
    clear_vendor_count: clear,
  };
}

function buildWorkflowReport(payload) {
  const reportResult = {
    workflow_meta: payload.workflow_meta,
    inputs_echo: payload.inputs_echo,
    summary: payload.summary,
    vendors: payload.vendors,
    assumptions: payload.assumptions,
    diagnostics: payload.diagnostics,
  };

  return {
    report_meta: {
      report_type: "vendor-risk-assessment",
      title: "Vendor Risk Assessment",
      workflow: payload.workflow_meta.workflow,
      as_of_date: payload.workflow_meta.as_of_date,
      model_version: payload.workflow_meta.model_version,
    },
    executive_summary: payload.assumptions,
    headline_metrics: [
      { label: "Vendor count", value: payload.vendors.length, unit: "count" },
      { label: "Flagged vendors", value: payload.summary.flagged_vendor_count, unit: "count" },
      { label: "Recommended action", value: payload.summary.recommended_action, unit: "action" },
    ],
    tables: {
      vendor_ranking: {
        columns: ["rank", "name", "risk_tier", "risk_score", "recommended_action"],
        rows: payload.vendors.map((vendor) => ({
          rank: vendor.rank,
          name: vendor.name,
          risk_tier: vendor.risk_tier,
          risk_score: vendor.risk_score,
          recommended_action: vendor.recommended_action,
        })),
      },
    },
    chart_hints: [],
    export_artifacts: {
      recommended_local_path: `outputs/vendor-risk-assessment-${payload.workflow_meta.as_of_date}.xlsx`,
      workbook_rows: {
        vendor_ranking: payload.vendors.map((vendor) => ({
          rank: vendor.rank,
          name: vendor.name,
          risk_tier: vendor.risk_tier,
          risk_score: vendor.risk_score,
          recommended_action: vendor.recommended_action,
          manual_review_required: vendor.manual_review_required,
        })),
      },
    },
    result: reportResult,
  };
}

async function attachRequestedArtifacts(workflowPayload, requestedArtifacts) {
  const artifactTypes = Array.isArray(requestedArtifacts) ? requestedArtifacts : [];
  const artifacts = {
    recommended_local_path: workflowPayload.report?.export_artifacts?.recommended_local_path,
  };

  for (const artifactType of artifactTypes) {
    const routePath = ARTIFACT_ROUTE_PATHS[artifactType];
    if (!routePath) {
      continue;
    }

    const artifactResponse = await buildDocumentArtifact({
      path: routePath,
      title: "Vendor Risk Assessment",
      body: workflowPayload,
    });

    if (artifactResponse?.success) {
      artifacts[artifactType] = artifactResponse.data;
      continue;
    }

    artifacts[artifactType] = {
      error: artifactResponse?.error || "artifact_generation_failed",
      message: artifactResponse?.message || `Unable to generate ${artifactType} artifact`,
    };
  }

  return artifacts;
}

async function runVendorRiskForecast(params) {
  const composed = await composeVendorEvidence(params);
  const assumptions = buildAssumptions(Boolean(composed?.diagnostics?.stubbed));
  const scored = composed.entries.map((entry) => {
    const scoredRisk = evaluateVendorRisk(entry.vendor, entry);
    return {
      name: entry.vendor.name,
      country: entry.vendor.country,
      ...scoredRisk,
      evidence: {
        screening: {
          match_count: entry.screening.match_count,
          exact_match_count: entry.screening.exact_match_count,
          best_name_score: entry.screening.best_name_score,
        },
        brief: {
          status: entry.brief.status,
          entity_resolution_quality: entry.brief.entity_resolution_quality,
        },
      },
    };
  });

  const ranked = [...scored].sort(sortByRisk).map((entry, index) => ({
    rank: index + 1,
    ...entry,
  }));

  const summary = summarizeResults(ranked);

  const workflowPayload = {
    workflow_meta: {
      workflow: params.workflow,
      as_of_date: params.asOfDate,
      mode: params.mode,
      model_version: composed?.diagnostics?.stubbed ? "1.0.0-stub" : "1.1.0",
      source: composed?.diagnostics?.stubbed
        ? "stubbed-compliance-composition"
        : "ofac-gleif-composition",
    },
    inputs_echo: {
      vendor_count: params.vendors.length,
      screening_threshold: params.options.screening_threshold,
      screening_limit: params.options.screening_limit,
      include_report: params.options.include_report,
      include_artifacts: params.options.include_artifacts,
    },
    summary,
    vendors: ranked,
    assumptions,
    diagnostics: {
      vendors_processed: params.vendors.length,
      brief_calls: composed.diagnostics.brief_calls,
      brief_fallback_calls: composed.diagnostics.brief_fallback_calls || 0,
      batch_screen_calls: composed.diagnostics.batch_screen_calls,
      screening_calls: composed.diagnostics.screening_calls,
      seed: params.options.seed,
      upstream_stubbed: composed.diagnostics.stubbed,
      ...(composed.diagnostics.source_freshness
        ? { source_freshness: composed.diagnostics.source_freshness }
        : {}),
      ...(composed.diagnostics.upstream_error
        ? { upstream_error: composed.diagnostics.upstream_error }
        : {}),
      ...(composed.diagnostics.fallback_reason
        ? { fallback_reason: composed.diagnostics.fallback_reason }
        : {}),
    },
  };

  if (params.options.include_report || params.options.include_artifacts.length > 0) {
    workflowPayload.report = buildWorkflowReport(workflowPayload);
    workflowPayload.artifacts = {
      recommended_local_path: workflowPayload.report.export_artifacts.recommended_local_path,
    };
  }

  if (params.options.include_artifacts.length > 0) {
    workflowPayload.artifacts = await attachRequestedArtifacts(workflowPayload, params.options.include_artifacts);
  }

  return workflowPayload;
}

module.exports = {
  runVendorRiskForecast,
};
