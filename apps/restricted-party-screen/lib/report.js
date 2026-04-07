const {
  buildStructuredReport,
  createHeadlineMetric,
  createTable,
} = require("../../../lib/report-builder");

function readString(value, fallback = "") {
  if (value == null) {
    return fallback;
  }
  return String(value);
}

function toDisplayAsset(value) {
  const asset = readString(value, "").trim();
  return asset || "all";
}

function buildReportStem(screening) {
  const normalizedAddress = readString(screening?.query?.normalizedAddress, "").toLowerCase();
  const compact = normalizedAddress.replace(/[^a-z0-9]+/g, "");
  return `outputs/ofac-wallet-screen-${compact || "wallet"}`;
}

function buildBatchReportStem(batch) {
  const totalScreened = Number(batch?.summary?.totalScreened || 0);
  return `outputs/ofac-wallet-screen-batch-${totalScreened || "multi"}-wallets`;
}

function toSlug(value, fallback) {
  const normalized = readString(value, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function buildEddReportStem(caseContext) {
  const referenceSlug = toSlug(caseContext?.referenceId, "");
  const subjectSlug = toSlug(caseContext?.subjectName, "subject");
  return `outputs/edd-report-${referenceSlug || subjectSlug}`;
}

function buildExecutiveSummary(screening) {
  const summary = screening?.summary || {};
  const address = readString(screening?.query?.address, "unknown wallet");
  const matchCount = Number(summary.matchCount || 0);

  if (summary.status === "match") {
    return [
      `Exact OFAC SDN digital currency address match found for wallet ${address}.`,
      `${matchCount} sanctioned designation${matchCount === 1 ? "" : "s"} matched the screened wallet.`,
      "Hold or escalate funds movement until a human compliance reviewer clears the address.",
    ];
  }

  return [
    `No exact OFAC SDN digital currency address match was found for wallet ${address}.`,
    "This result covers only OFAC-published sanctioned wallet addresses, not behavioral or cluster analysis.",
    "Retain the screening memo for audit support and rerun if the transaction context changes.",
  ];
}

function buildMatchRows(screening) {
  const matches = Array.isArray(screening?.matches) ? screening.matches : [];
  if (matches.length === 0) {
    return [
      {
        screened_address: readString(screening?.query?.address, ""),
        status: "clear",
        entity_name: "",
        asset: toDisplayAsset(screening?.query?.asset),
        sanctioned_address: "",
        list_name: "SDN List",
        programs: "",
        listed_on: "",
      },
    ];
  }

  return matches.map((match) => ({
    screened_address: readString(screening?.query?.address, ""),
    status: "match",
    entity_name: readString(match.entityName, ""),
    asset: readString(match.asset, ""),
    sanctioned_address: readString(match.address, ""),
    list_name: readString(match.listName, "SDN List"),
    programs: Array.isArray(match.programs) ? match.programs.join(", ") : "",
    listed_on: readString(match.listedOn, ""),
  }));
}

function buildWalletScreeningReport(screening, freshness) {
  const summary = screening?.summary || {};
  const reportStem = buildReportStem(screening);

  return buildStructuredReport({
    reportMeta: {
      report_type: "ofac-wallet-screening",
      title: "OFAC Wallet Screening Report",
      author: "AurelianFlo",
      date: readString(freshness?.refreshedAt, ""),
      source: "OFAC SDN Advanced XML",
    },
    executiveSummary: buildExecutiveSummary(screening),
    headlineMetrics: [
      createHeadlineMetric("Screening status", readString(summary.status, "unknown"), "label"),
      createHeadlineMetric("Match count", Number(summary.matchCount || 0), "count"),
      createHeadlineMetric(
        "Manual review recommended",
        Boolean(summary.manualReviewRecommended),
        "boolean",
      ),
    ],
    tables: {
      wallet_screening_query: createTable(
        [
          "address",
          "normalized_address",
          "asset_filter",
          "status",
          "exact_address_match",
          "manual_review_recommended",
        ],
        [
          {
            address: readString(screening?.query?.address, ""),
            normalized_address: readString(screening?.query?.normalizedAddress, ""),
            asset_filter: toDisplayAsset(screening?.query?.asset),
            status: readString(summary.status, "unknown"),
            exact_address_match: Boolean(summary.exactAddressMatch),
            manual_review_recommended: Boolean(summary.manualReviewRecommended),
          },
        ],
      ),
      wallet_screening_matches: createTable(
        [
          "screened_address",
          "status",
          "entity_name",
          "asset",
          "sanctioned_address",
          "list_name",
          "programs",
          "listed_on",
        ],
        buildMatchRows(screening),
      ),
      source_freshness: createTable(
        [
          "source_url",
          "refreshed_at",
          "dataset_published_at",
          "address_count",
          "covered_assets",
        ],
        [
          {
            source_url: readString(freshness?.sourceUrl, ""),
            refreshed_at: readString(freshness?.refreshedAt, ""),
            dataset_published_at: readString(freshness?.datasetPublishedAt, ""),
            address_count: Number(freshness?.addressCount || 0),
            covered_assets: Array.isArray(freshness?.coveredAssets)
              ? freshness.coveredAssets.join(", ")
              : "",
          },
        ],
      ),
    },
    exportArtifacts: {
      recommended_local_path: reportStem,
    },
    result: {
      ...screening,
      sourceFreshness: freshness,
    },
  });
}

function buildWalletScreeningArtifactHints(report) {
  const basePath = readString(report?.export_artifacts?.recommended_local_path, "outputs/ofac-wallet-screen-wallet");
  return {
    recommended_local_path: basePath,
    pdf: {
      endpoint: "/api/tools/report/pdf/generate",
      recommended_local_path: `${basePath}.pdf`,
    },
    docx: {
      endpoint: "/api/tools/report/docx/generate",
      recommended_local_path: `${basePath}.docx`,
    },
  };
}

function buildBatchExecutiveSummary(batch) {
  const summary = batch?.summary || {};
  const totalScreened = Number(summary.totalScreened || 0);
  const matchCount = Number(summary.matchCount || 0);
  const clearCount = Number(summary.clearCount || 0);

  if (matchCount > 0) {
    return [
      `Batch OFAC screening found ${matchCount} exact sanctioned wallet match${matchCount === 1 ? "" : "es"} across ${totalScreened} wallet${totalScreened === 1 ? "" : "s"}.`,
      `${clearCount} wallet${clearCount === 1 ? "" : "s"} screened clear against OFAC-published digital currency address designations.`,
      "Pause funds movement or onboarding decisions until a human compliance reviewer resolves each matched wallet.",
    ];
  }

  return [
    `Batch OFAC screening found no exact sanctioned wallet matches across ${totalScreened} wallet${totalScreened === 1 ? "" : "s"}.`,
    "This result covers only OFAC-published sanctioned wallet addresses, not behavioral or cluster analysis.",
    "Retain the batch memo for audit support and rescreen if transaction context or source lists change.",
  ];
}

function buildBatchQueryRows(batch) {
  const addresses = Array.isArray(batch?.query?.addresses) ? batch.query.addresses : [];
  const normalizedAddresses = Array.isArray(batch?.query?.normalizedAddresses)
    ? batch.query.normalizedAddresses
    : [];

  return addresses.map((address, index) => ({
    address,
    normalized_address: readString(normalizedAddresses[index], ""),
    asset_filter: toDisplayAsset(batch?.query?.asset),
  }));
}

function buildBatchResultRows(batch) {
  const results = Array.isArray(batch?.results) ? batch.results : [];

  return results.map((result) => {
    const firstMatch = Array.isArray(result?.matches) ? result.matches[0] || null : null;
    return {
      screened_address: readString(result?.query?.address, ""),
      normalized_address: readString(result?.query?.normalizedAddress, ""),
      asset_filter: toDisplayAsset(batch?.query?.asset),
      status: readString(result?.summary?.status, "unknown"),
      match_count: Number(result?.summary?.matchCount || 0),
      exact_address_match: Boolean(result?.summary?.exactAddressMatch),
      manual_review_recommended: Boolean(result?.summary?.manualReviewRecommended),
      entity_name: readString(firstMatch?.entityName, ""),
      matched_asset: readString(firstMatch?.asset, ""),
      sanctioned_address: readString(firstMatch?.address, ""),
      list_name: readString(firstMatch?.listName, "SDN List"),
      programs: Array.isArray(firstMatch?.programs) ? firstMatch.programs.join(", ") : "",
      listed_on: readString(firstMatch?.listedOn, ""),
    };
  });
}

function buildBatchScreeningReport(batch, freshness) {
  const summary = batch?.summary || {};
  const reportStem = buildBatchReportStem(batch);
  const workflowStatus = readString(
    summary.workflowStatus,
    Number(summary.matchCount || 0) > 0 ? "manual_review_required" : "screening_complete_no_exact_match",
  );

  return buildStructuredReport({
    reportMeta: {
      report_type: "ofac-wallet-screening-batch",
      title: "OFAC Batch Wallet Screening Report",
      author: "AurelianFlo",
      date: readString(freshness?.refreshedAt, ""),
      source: "OFAC SDN Advanced XML",
    },
    executiveSummary: buildBatchExecutiveSummary(batch),
    headlineMetrics: [
      createHeadlineMetric("Total screened", Number(summary.totalScreened || 0), "count"),
      createHeadlineMetric("Match count", Number(summary.matchCount || 0), "count"),
      createHeadlineMetric("Clear count", Number(summary.clearCount || 0), "count"),
      createHeadlineMetric("Workflow status", workflowStatus, "label"),
    ],
    tables: {
      batch_wallet_query: createTable(
        ["address", "normalized_address", "asset_filter"],
        buildBatchQueryRows(batch),
      ),
      batch_wallet_results: createTable(
        [
          "screened_address",
          "normalized_address",
          "asset_filter",
          "status",
          "match_count",
          "exact_address_match",
          "manual_review_recommended",
          "entity_name",
          "matched_asset",
          "sanctioned_address",
          "list_name",
          "programs",
          "listed_on",
        ],
        buildBatchResultRows(batch),
      ),
      source_freshness: createTable(
        [
          "source_url",
          "refreshed_at",
          "dataset_published_at",
          "address_count",
          "covered_assets",
        ],
        [
          {
            source_url: readString(freshness?.sourceUrl, ""),
            refreshed_at: readString(freshness?.refreshedAt, ""),
            dataset_published_at: readString(freshness?.datasetPublishedAt, ""),
            address_count: Number(freshness?.addressCount || 0),
            covered_assets: Array.isArray(freshness?.coveredAssets)
              ? freshness.coveredAssets.join(", ")
              : "",
          },
        ],
      ),
    },
    exportArtifacts: {
      recommended_local_path: reportStem,
    },
    result: {
      ...batch,
      sourceFreshness: freshness,
    },
  });
}

function buildBatchScreeningArtifactHints(report) {
  const basePath = readString(
    report?.export_artifacts?.recommended_local_path,
    "outputs/ofac-wallet-screen-batch-wallets",
  );
  return {
    recommended_local_path: basePath,
    pdf: {
      endpoint: "/api/tools/report/pdf/generate",
      recommended_local_path: `${basePath}.pdf`,
    },
    docx: {
      endpoint: "/api/tools/report/docx/generate",
      recommended_local_path: `${basePath}.docx`,
    },
  };
}

function getMatchedEntities(batch) {
  const entityNames = new Set();
  for (const result of Array.isArray(batch?.results) ? batch.results : []) {
    for (const match of Array.isArray(result?.matches) ? result.matches : []) {
      if (match?.entityName) {
        entityNames.add(readString(match.entityName, ""));
      }
    }
  }
  return [...entityNames];
}

function getWorkflowStatus(batch) {
  return Number(batch?.summary?.matchCount || 0) > 0
    ? "manual_review_required"
    : "screening_complete_no_exact_match";
}

function buildEddExecutiveSummary(caseContext, batch) {
  const workflowStatus = getWorkflowStatus(batch);
  const subjectName = readString(caseContext?.subjectName, "Unnamed subject");
  const totalScreened = Number(batch?.summary?.totalScreened || 0);
  const matchCount = Number(batch?.summary?.matchCount || 0);

  if (workflowStatus === "manual_review_required") {
    return [
      `Enhanced due diligence memo prepared for ${subjectName} after screening ${totalScreened} wallet${totalScreened === 1 ? "" : "s"}.`,
      `Exact OFAC SDN digital currency address match activity was found on ${matchCount} screened wallet${matchCount === 1 ? "" : "s"}, so human compliance review remains required.`,
      "This memo organizes evidence and follow-up tasks for review operations. It does not provide legal advice or a final compliance determination.",
    ];
  }

  return [
    `Enhanced due diligence memo prepared for ${subjectName} after screening ${totalScreened} wallet${totalScreened === 1 ? "" : "s"}.`,
    "No exact OFAC SDN digital currency address match was found in the screened wallet set.",
    "This memo records the screening evidence, remaining follow-up items, and reviewer handoff fields for audit support.",
  ];
}

function buildEddEvidenceSummary(caseContext, batch, freshness) {
  const subjectName = readString(caseContext?.subjectName, "the subject");
  const entities = getMatchedEntities(batch);
  const lines = [];

  if (entities.length > 0) {
    lines.push(
      `${subjectName} screening returned exact OFAC SDN digital currency address matches linked to ${entities.join(", ")}.`,
    );
  } else {
    lines.push(`${subjectName} screening returned no exact OFAC SDN digital currency address matches.`);
  }

  lines.push(
    `The screening dataset covered ${Number(freshness?.addressCount || 0)} designated wallet addresses across ${Array.isArray(freshness?.coveredAssets) ? freshness.coveredAssets.length : 0} asset labels.`,
  );
  lines.push(
    `Source freshness is anchored to ${readString(freshness?.datasetPublishedAt, "") || "the latest available OFAC publication metadata"}.`,
  );

  return lines;
}

function buildEddRequiredFollowUp(batch) {
  if (getWorkflowStatus(batch) === "manual_review_required") {
    return [
      "Escalate the case to a human compliance reviewer before onboarding, payout release, or funds movement.",
      "Document the purpose of the relationship, expected transaction activity, and any beneficial ownership context outside this screening result.",
      "Retain this memo and any reviewer disposition in the case record for audit support.",
    ];
  }

  return [
    "Record the memo in the case file and retain the source freshness evidence.",
    "Rescreen the wallet set if the transaction context, wallet set, or OFAC source data changes.",
    "Run additional AML, transaction-monitoring, or KYC procedures if the broader risk policy requires them.",
  ];
}

function buildEddCaseMetadataRow(caseContext, batch) {
  return {
    subject_name: readString(caseContext?.subjectName, ""),
    case_name: readString(caseContext?.caseName, ""),
    review_reason: readString(caseContext?.reviewReason, ""),
    jurisdiction: readString(caseContext?.jurisdiction, ""),
    requested_by: readString(caseContext?.requestedBy, ""),
    reference_id: readString(caseContext?.referenceId, ""),
    asset_filter: toDisplayAsset(batch?.query?.asset),
  };
}

function buildEddScreeningRows(batch) {
  return buildBatchResultRows(batch).map((row) => ({
    screened_address: row.screened_address,
    normalized_address: row.normalized_address,
    asset_filter: row.asset_filter,
    screening_status: row.status,
    match_count: row.match_count,
    exact_address_match: row.exact_address_match,
    manual_review_required: row.manual_review_recommended,
    matched_entity_name: row.entity_name,
    matched_asset: row.matched_asset,
    sanctioned_address: row.sanctioned_address,
    list_name: row.list_name,
    programs: row.programs,
    listed_on: row.listed_on,
  }));
}

function buildRequiredFollowUpRows(requiredFollowUp) {
  return requiredFollowUp.map((step, index) => ({
    step_number: index + 1,
    action: step,
  }));
}

function buildReviewerAttestationRows(workflowStatus) {
  return [
    {
      workflow_status: workflowStatus,
      assigned_reviewer: "",
      review_disposition: "",
      reviewed_at: "",
      attestation_note:
        "Reviewer records the final disposition outside this automated memo.",
    },
  ];
}

function buildEddReport(caseContext, batch, freshness) {
  const workflowStatus = getWorkflowStatus(batch);
  const requiredFollowUp = buildEddRequiredFollowUp(batch);
  const reportStem = buildEddReportStem(caseContext);
  const subjectName = readString(caseContext?.subjectName, "Subject");
  const caseName = readString(caseContext?.caseName, "");

  return buildStructuredReport({
    reportMeta: {
      report_type: "enhanced-due-diligence",
      title: caseName || `Enhanced Due Diligence Memo - ${subjectName}`,
      author: "AurelianFlo",
      date: readString(freshness?.refreshedAt, ""),
      source: "OFAC SDN Advanced XML",
    },
    executiveSummary: buildEddExecutiveSummary(caseContext, batch),
    headlineMetrics: [
      createHeadlineMetric("Workflow status", workflowStatus, "label"),
      createHeadlineMetric("Total screened", Number(batch?.summary?.totalScreened || 0), "count"),
      createHeadlineMetric("Match count", Number(batch?.summary?.matchCount || 0), "count"),
      createHeadlineMetric(
        "Manual review required",
        workflowStatus === "manual_review_required",
        "boolean",
      ),
    ],
    tables: {
      case_metadata: createTable(
        [
          "subject_name",
          "case_name",
          "review_reason",
          "jurisdiction",
          "requested_by",
          "reference_id",
          "asset_filter",
        ],
        [buildEddCaseMetadataRow(caseContext, batch)],
      ),
      screening_results: createTable(
        [
          "screened_address",
          "normalized_address",
          "asset_filter",
          "screening_status",
          "match_count",
          "exact_address_match",
          "manual_review_required",
          "matched_entity_name",
          "matched_asset",
          "sanctioned_address",
          "list_name",
          "programs",
          "listed_on",
        ],
        buildEddScreeningRows(batch),
      ),
      source_freshness: createTable(
        [
          "source_url",
          "refreshed_at",
          "dataset_published_at",
          "address_count",
          "covered_assets",
        ],
        [
          {
            source_url: readString(freshness?.sourceUrl, ""),
            refreshed_at: readString(freshness?.refreshedAt, ""),
            dataset_published_at: readString(freshness?.datasetPublishedAt, ""),
            address_count: Number(freshness?.addressCount || 0),
            covered_assets: Array.isArray(freshness?.coveredAssets)
              ? freshness.coveredAssets.join(", ")
              : "",
          },
        ],
      ),
      required_follow_up: createTable(
        ["step_number", "action"],
        buildRequiredFollowUpRows(requiredFollowUp),
      ),
      reviewer_attestation: createTable(
        [
          "workflow_status",
          "assigned_reviewer",
          "review_disposition",
          "reviewed_at",
          "attestation_note",
        ],
        buildReviewerAttestationRows(workflowStatus),
      ),
    },
    exportArtifacts: {
      recommended_local_path: reportStem,
    },
    result: {
      case: caseContext,
      workflowStatus,
      evidenceSummary: buildEddEvidenceSummary(caseContext, batch, freshness),
      requiredFollowUp,
      screening: {
        ...batch,
        sourceFreshness: freshness,
      },
    },
  });
}

function buildEddArtifactHints(report) {
  const basePath = readString(
    report?.export_artifacts?.recommended_local_path,
    "outputs/edd-report-subject",
  );
  return {
    recommended_local_path: basePath,
    pdf: {
      endpoint: "/api/tools/report/pdf/generate",
      recommended_local_path: `${basePath}.pdf`,
    },
    docx: {
      endpoint: "/api/tools/report/docx/generate",
      recommended_local_path: `${basePath}.docx`,
    },
  };
}

module.exports = {
  buildBatchScreeningArtifactHints,
  buildBatchScreeningReport,
  buildEddArtifactHints,
  buildEddReport,
  buildWalletScreeningArtifactHints,
  buildWalletScreeningReport,
};
