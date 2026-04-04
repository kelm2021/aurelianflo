# Vendor Risk Workflow Product Spec

**Goal:** Ship the first non-sports workflow adapter on top of the current x402 stack so users can assess vendor onboarding risk and receive a decision-ready report or file artifact in one paid call.

**Primary Outcome:** A user should be able to ask for a task such as "screen these vendors and give me an XLSX" or "assess this counterparty and give me a PDF memo" and receive a structured risk result plus export artifacts without manually orchestrating sanctions screening, entity brief lookup, and report generation.

**Architecture Direction:** Reuse the current three-layer model:
- workflow adapter for vendor-shaped input and decision framing
- existing compliance endpoints as upstream data producers
- shared report/document layer for summaries, tables, and XLSX/PDF/DOCX generation

**Tech Assumption:** Extend the existing Express/x402 repo. Do not replace the current `vendor-entity-brief`, `restricted-party-screen`, shared report model, or document-generation stack.

---

## Why This Exists

The current compliance surface is useful but still endpoint-shaped:
- `GET /api/vendor-entity-brief`
- `GET /api/vendor-onboarding/restricted-party-batch`
- `GET /api/ofac-sanctions-screening/{name}`
- `GET /api/restricted-party/screen/{name}`

That means the caller still has to:
- decide which route to call first
- normalize names and countries
- combine entity and sanctions evidence into one risk decision
- build a report separately

The product gap is not data availability. The gap is task completion. Buyers think in workflow outcomes:
- approve or pause a vendor
- rank a vendor cohort by risk
- export a procurement memo

This spec closes that gap by adding a thin vendor workflow adapter above the existing compliance endpoints.

---

## Product Principles

1. Keep compliance sources reusable.
The workflow should call existing compliance endpoints and not reimplement sanctions or GLEIF logic.

2. Keep the workflow decision-oriented.
The adapter should return a triage recommendation, not just raw entity and screening payloads.

3. Preserve the shared report model.
The output should map into the same report/document system already used by sports and generic simulation workflows.

4. Separate screening support from legal clearance.
This workflow helps users prioritize review. It must not imply sanctions clearance or legal approval.

5. Support one vendor and many vendors.
The same family should handle a single onboarding decision and a batch procurement queue.

---

## Scope

### In Scope
- vendor workflow adapter layer
- single-vendor and batch-vendor request modes
- sanctions and entity-brief enrichment using existing endpoints
- normalized vendor risk scoring and decision guidance
- shared report and artifact output
- curated discovery metadata
- local and paid canary coverage

### Out of Scope
- replacing the existing compliance endpoints
- full KYB or beneficial ownership resolution
- adverse media ingestion
- legal conclusions or sanctions clearance
- persistent case management in the first release

---

## Proposed Workflow Family

### Recommended Family
- `POST /api/workflows/vendor/risk-forecast`
- later: `POST /api/workflows/vendor/onboarding-report`
- later: `POST /api/workflows/vendor/portfolio-monitor`

### First Workflow
`POST /api/workflows/vendor/risk-forecast`

This endpoint should support:
- a single vendor onboarding decision
- a batch vendor ranking for procurement triage

---

## Upstream Dependencies

The workflow adapter should compose the following existing surfaces:

- `GET /api/vendor-entity-brief`
  Used for entity candidate resolution, jurisdiction, and embedded screening summary.
- `GET /api/vendor-onboarding/restricted-party-batch`
  Used for cheap cohort-level screening when the request includes multiple vendors.
- `GET /api/ofac-sanctions-screening/{name}`
  Used for vendor-level rescreening or more detailed evidence when needed.
- `GET /api/restricted-party/screen/{name}`
  Treated as a compatibility alias, not the preferred primary dependency.

### Composition Guidance
- For a single vendor, start with `vendor-entity-brief`.
- For a batch, start with `restricted-party-batch`.
- Escalate to `vendor-entity-brief` or `ofac-sanctions-screening` for vendors that are high-priority, flagged, or unresolved.

This keeps cost and latency practical while still producing a better workflow result.

---

## First-Release Modes

### `single_vendor`
Best for:
- onboarding one vendor
- generating a short PDF or memo
- deciding whether to proceed, pause, or reject

### `vendor_batch`
Best for:
- screening a procurement queue
- ranking vendors by risk
- exporting an XLSX for analyst review

---

## Workflow Request Contract

```json
{
  "as_of_date": "2026-04-03",
  "workflow": "vendor.risk_forecast",
  "mode": "vendor_batch",
  "inputs": {
    "vendors": [
      {
        "name": "SBERBANK",
        "country": "CZ",
        "criticality": "high",
        "annual_spend_usd": 2500000,
        "cross_border": true,
        "service_category": "banking",
        "notes": "New payout rail partner"
      }
    ]
  },
  "model_options": {
    "seed": 12345,
    "screening_threshold": 90,
    "screening_limit": 3,
    "include_report": true,
    "include_artifacts": ["xlsx"]
  }
}
```

### Required Fields
- `mode`
- `inputs.vendors`

### Optional Fields
- `as_of_date`
- `model_options.seed`
- `model_options.include_report`
- `model_options.include_artifacts`
- `model_options.screening_threshold`
- `model_options.screening_limit`

### Vendor Input Fields
- `name` required
- `country` optional but recommended
- `criticality` optional enum: `low`, `medium`, `high`, `critical`
- `annual_spend_usd` optional number
- `cross_border` optional boolean
- `service_category` optional string
- `notes` optional string

### Input Rules
- `single_vendor` requires exactly one vendor
- `vendor_batch` supports `1..25` vendors
- duplicate names should be rejected unless the request includes a clear differentiator
- `screening_threshold` defaults to `90`
- `screening_limit` defaults to `3`

---

## Workflow Responsibilities

The adapter owns:
- request validation
- batching strategy
- route selection between brief and batch screening
- normalized vendor evidence model
- risk scoring and recommendation mapping
- report generation
- artifact bundling when requested

The adapter does not own:
- sanctions list fetching
- raw GLEIF lookups
- legal advice

---

## Risk Model Direction

The first release should use a transparent rule-plus-score model, not a black-box risk engine.

### Core Signals
- sanctions or restricted-party match count
- exact-match or high-confidence match signal
- manual-review recommendation from upstream sources
- entity resolution quality
- jurisdiction consistency
- cross-border flag
- vendor criticality
- annual spend band

### First-Release Output Semantics
- `risk_tier`: `low`, `medium`, `high`, `critical`
- `recommended_action`: `proceed`, `pause-and-review`, `reject-or-escalate`
- `manual_review_required`: boolean

### Interpretation
- `critical` means strong pause/escalation signal
- `high` means review before onboarding
- `medium` means proceed with controls or targeted review
- `low` means no immediate restricted-party evidence and no major escalation signals

This should remain explainable by returning the factor breakdown.

---

## Workflow Response Contract

```json
{
  "workflow_meta": {
    "workflow": "vendor.risk_forecast",
    "as_of_date": "2026-04-03",
    "mode": "vendor_batch",
    "model_version": "1.0.0"
  },
  "inputs_echo": {
    "vendor_count": 3,
    "screening_threshold": 90,
    "screening_limit": 3
  },
  "summary": {
    "status": "manual-review-required",
    "recommended_action": "pause-and-review",
    "risk_tier": "high",
    "flagged_vendor_count": 2,
    "clear_vendor_count": 1
  },
  "vendors": [
    {
      "rank": 1,
      "name": "SBERBANK",
      "country": "CZ",
      "risk_tier": "critical",
      "risk_score": 0.97,
      "recommended_action": "reject-or-escalate",
      "manual_review_required": true,
      "reasons": [
        "High-confidence sanctions match",
        "Batch screen flagged vendor for manual review"
      ]
    }
  ],
  "assumptions": [
    "This workflow is a triage and screening aid, not legal clearance.",
    "Risk scoring uses existing sanctions and entity-resolution signals plus caller-supplied vendor context."
  ],
  "diagnostics": {
    "vendors_processed": 3,
    "brief_calls": 2,
    "batch_screen_calls": 1,
    "seed": 12345
  },
  "report": {},
  "artifacts": {
    "xlsx": {}
  }
}
```

### Required Top-Level Fields
- `workflow_meta`
- `inputs_echo`
- `summary`
- `vendors`
- `assumptions`
- `diagnostics`

### Strongly Recommended
- `report`
- `artifacts`

---

## Shared Report Contract

The workflow should emit the existing shared report model:
- `report_meta`
- `executive_summary`
- `headline_metrics`
- `tables`
- `chart_hints`
- `export_artifacts`
- `result`

### Vendor-Specific Report Sections
- `vendor_ranking`
- `flagged_vendors`
- `review_recommendations`
- `source_coverage`
- `assumptions`

### Artifact Defaults
- single-vendor mode defaults to PDF or DOCX
- batch mode defaults to XLSX

---

## Artifact Contract

Use the existing artifact envelope:
- `documentType`
- `fileName`
- `mimeType`
- `artifact`
- `recommended_local_path`
- `preview`
- `capabilities`

### Naming Guidance
- batch XLSX: `vendor-risk-forecast-YYYY-MM-DD.xlsx`
- single-vendor PDF: `vendor-risk-<slug>-YYYY-MM-DD.pdf`
- single-vendor DOCX: `vendor-risk-<slug>-YYYY-MM-DD.docx`

---

## Discovery and Catalog Rules

The curated public surface should list the workflow route once shipped.

### Required Metadata
- `best_for`: "Fast vendor onboarding triage and export-ready review reports"
- `not_for`: "Legal clearance, beneficial ownership investigations, or adverse media due diligence"
- `input_style`: "`single_vendor` or `vendor_batch`"
- `returns_artifacts`: `["xlsx", "pdf", "docx"]`
- `example_task`: "Screen these vendors and give me an XLSX"
- `maturity`: `beta` at first release

---

## Error Handling

Workflow validation should fail before upstream calls when possible.

### Required Error Fields
- `error_code`
- `message`
- `fix_hint`
- `input_path`

### Example Errors
- `invalid_mode`
- `missing_vendors`
- `too_many_vendors`
- `duplicate_vendor_names`
- `single_vendor_requires_exactly_one_vendor`
- `unsupported_artifact_type`

---

## Testing Requirements

### Unit Tests
- request parsing
- vendor deduping and normalization
- risk-tier mapping
- report builder mapping

### Integration Tests
- single-vendor workflow result
- batch-vendor workflow result
- workflow plus report
- workflow plus XLSX/PDF/DOCX bundling

### Paid Canary Tests
- one production canary for `single_vendor`
- one production canary for `vendor_batch`
- one artifact-bundling production canary

---

## Rollout Plan

### Phase 1: Vendor Vertical Slice
- add `POST /api/workflows/vendor/risk-forecast`
- support `single_vendor` and `vendor_batch`
- compose existing compliance endpoints
- emit shared report payload
- support artifact bundling

### Phase 2: Better Vendor Evidence
- add clearer entity-resolution diagnostics
- add stronger source coverage fields
- add optional rerun/escalation strategy for ambiguous vendors

### Phase 3: Portfolio Monitoring
- add portfolio-level monitoring mode
- add periodic rescreen workflow patterns
- add stronger cohort comparison outputs

---

## Open Questions

1. Should the workflow call `vendor-entity-brief` for every vendor in a batch?
Recommendation: no. Use batch screening first, then selectively enrich vendors that are flagged or high-priority.

2. Should the workflow expose a numeric risk probability?
Recommendation: yes, but treat it as a triage score, not a claim of real-world event probability.

3. Should adverse media be included in the first release?
Recommendation: no. Keep the first version grounded in existing sanctions and entity data.

4. Should the batch mode return one overall recommendation or per-vendor recommendations only?
Recommendation: return both.

---

## Success Criteria

This spec is successful if the system can complete all of the following with one paid workflow call:
- assess one vendor and return a PDF memo
- screen a vendor cohort and return an XLSX
- give a machine-readable proceed or pause recommendation grounded in the current compliance surfaces

The main test is simple: the caller should not need to manually orchestrate compliance endpoints to answer a vendor onboarding question.
