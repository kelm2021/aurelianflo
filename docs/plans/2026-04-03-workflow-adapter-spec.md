# Workflow Adapter Product Spec

**Goal:** Add a task-shaped workflow layer above the current generic simulation engine and shared report/document system so users can complete real forecasting and reporting jobs in one paid call.

**Primary Outcome:** A user should be able to ask for a real task such as "predict the NBA Finals winner and give me an XLSX" or "screen these vendors and give me a PDF report" and receive a structured result plus export artifacts without manually composing multiple low-level endpoints.

**Architecture Direction:** Keep the current three-layer separation:
- core simulation engine for numeric modeling, calibration, distributions, and diagnostics
- workflow adapters for domain-specific inputs and normalized task contracts
- shared report/document layer for summaries, tables, chart hints, and XLSX/PDF/DOCX generation

**Tech Assumption:** Extend the existing Express/x402 app. Do not replace the current simulator, report model, or document-generation stack.

---

## Why This Exists

The current product is usable, but it still asks the caller to translate domain questions into generic parameters. That is acceptable for advanced internal use and too demanding for a normal paid workflow.

The product gap is not transport, payment, or basic report generation. Those are now working. The gap is product fit:
- users think in tasks, not generic parameter arrays
- discovery is better when offerings are framed around outcomes
- export and report generation are most valuable when coupled to a task contract
- domain-specific input validation should happen before simulation, not in the caller

This spec solves that by introducing workflow adapters as thin, explicit layers over the existing engine.

---

## Product Principles

1. Keep the engine generic.
The simulation engine should remain reusable, deterministic when seeded, and independent of any one domain.

2. Make workflows opinionated.
Workflow adapters should accept task-shaped input and own normalization, assumptions, defaults, and validation.

3. Keep reporting general-purpose.
The shared report model must remain usable by non-simulation workflows such as compliance briefs and vendor onboarding reports.

4. Curate public discovery aggressively.
The public `/api` surface should highlight only the intended paid offerings, not every available route.

5. Return artifacts in a consistent way.
Every workflow that can produce a file should return the same artifact envelope and recommended local path metadata.

---

## Scope

### In Scope
- workflow adapter layer
- sports workflow family
- first sports implementation for NBA
- workflow-to-report integration
- workflow-to-XLSX/PDF/DOCX integration
- curated discovery metadata for workflow endpoints
- artifact handling conventions
- testing and canary requirements for workflow endpoints

### Out of Scope
- rewriting the simulation engine
- replacing current report or document endpoints
- building all sports leagues before shipping the first workflow
- adding long-lived server-side artifact storage in the first phase
- building a full bracket engine for every league in the first release

---

## Proposed Product Layers

### Layer 1: Core Simulation Engine

Owns:
- probability and batch probability calculations
- compare, sensitivity, forecast, composed, optimize
- calibration and `outcome_noise`
- score distributions and risk metrics
- seeds and reproducibility
- low-level diagnostics

Does not own:
- sports rules
- vendor workflow semantics
- document layout or artifact naming

### Layer 2: Workflow Adapters

Owns:
- domain-specific request schemas
- source data normalization
- domain defaults and assumptions
- validation of required inputs
- mapping domain data into engine requests
- shaping engine output into user-meaningful results

Examples:
- sports playoff forecast
- vendor risk forecast
- pricing scenario forecast
- cash runway forecast

### Layer 3: Shared Report and Artifact Layer

Owns:
- `report_meta`
- `executive_summary`
- `headline_metrics`
- `tables`
- `chart_hints`
- `export_artifacts`
- XLSX/PDF/DOCX rendering

Does not own:
- simulation logic
- sports-specific rules
- workflow-specific validation

---

## Sports Workflow Family

Sports should be broadened beyond NBA at the contract level immediately, but implemented in phases.

### Recommended Family
- `POST /api/workflows/sports/{league}/forecast`
- `POST /api/workflows/sports/{league}/playoff-forecast`
- `POST /api/workflows/sports/{league}/game-sim`

### Initial League Rollout Order
1. `nba`
2. `nfl`
3. `mlb`
4. `nhl`
5. optional fifth based on demand: `wnba` or `epl`

### Why This Structure
- avoids building a one-off NBA-only product
- keeps the outer API stable across leagues
- lets reporting and artifact logic stay shared
- supports league-specific internals without changing the public contract

### What Varies by League
- standings schema
- playoff or postseason structure
- series vs single-game rules
- home-court/home-field logic
- schedule normalization
- feature engineering

### What Stays Shared
- request envelope
- result envelope
- diagnostics contract
- report model
- document-generation path
- artifact envelope

---

## First Workflow: NBA Playoff Forecast

### Endpoint
`POST /api/workflows/sports/nba/playoff-forecast`

### Supported Modes
- `standings_snapshot`
- `custom_field`

### First-Release Use Cases
- predict likely NBA champion from current standings snapshot
- rank contenders and export an XLSX
- produce a PDF summary memo for the current playoff race

### First-Release Non-Goals
- sportsbook-grade lines
- injury-aware modeling
- full public odds ingestion
- exact series-by-series bracket realism

Those can be added later behind richer workflow modes.

---

## Workflow Request Contract

```json
{
  "as_of_date": "2026-04-03",
  "league": "nba",
  "mode": "standings_snapshot",
  "field": "top_6_only",
  "inputs": {
    "teams": [
      {
        "name": "Oklahoma City Thunder",
        "abbr": "OKC",
        "conference": "West",
        "seed": 1,
        "wins": 61,
        "losses": 16,
        "win_pct": 0.792,
        "point_diff": 11.4,
        "last_10": "9-1"
      }
    ]
  },
  "model_options": {
    "seed": 12345,
    "simulations": 10000,
    "include_report": true,
    "include_artifacts": ["xlsx"]
  }
}
```

### Input Rules
- `league` is required and must match the path
- `mode` is required
- `field` is required
- `inputs.teams` is required for `custom_field`
- `as_of_date` is optional when the adapter can source live standings
- `seed` is optional but recommended for reproducibility

### Adapter Responsibilities
- parse standings into normalized numeric inputs
- infer recent-form signal from `last_10`
- convert seed into a bounded strength factor
- assign default weights and uncertainties per league
- validate conference and seed consistency

---

## Workflow Response Contract

```json
{
  "workflow_meta": {
    "workflow": "sports.playoff_forecast",
    "league": "nba",
    "as_of_date": "2026-04-03",
    "mode": "standings_snapshot",
    "model_version": "1.0.0"
  },
  "inputs_echo": {
    "field": "top_6_only"
  },
  "prediction": {
    "predicted_winner": "Oklahoma City Thunder",
    "championship_probability": 0.5036
  },
  "ranking": [
    {
      "rank": 1,
      "team": "Oklahoma City Thunder",
      "probability": 0.5036,
      "confidence_interval_95": { "low": 0.4938, "high": 0.5134 }
    }
  ],
  "assumptions": [
    "Modeled field: top 6 seeds in each conference",
    "Signals: win percentage, point differential, recent form, seed strength"
  ],
  "diagnostics": {
    "simulations_run": 10000,
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
- `prediction`
- `assumptions`
- `diagnostics`

### Optional but Strongly Recommended
- `ranking`
- `distribution`
- `report`
- `artifacts`

---

## Shared Report Contract

All workflows that support reporting should emit the existing shared report model:
- `report_meta`
- `executive_summary`
- `headline_metrics`
- `tables`
- `chart_hints`
- `export_artifacts`
- `result`

### Rule
Workflow adapters should produce report-model payloads through a report builder, not inline per endpoint.

### Benefit
The same report system can support:
- simulation reports
- vendor screening reports
- sanctions summaries
- operational memos
- future finance or pricing workflows

---

## Artifact Contract

Every artifact-capable endpoint should return:
- `documentType`
- `fileName`
- `mimeType`
- `artifact`
- `recommended_local_path`
- `preview`
- `capabilities`

### Artifact Rules
- `artifact.contentBase64` is the canonical transfer field
- `recommended_local_path` should tell the client where the file should land locally
- `fileName` should be deterministic and human-readable
- if a report is present, artifact generation should prefer the report model over raw low-level data

### First-Release Storage Guidance
- do not depend on long-term server storage
- return the full artifact payload to the caller
- optionally add server-side artifact retrieval later through a distinct artifact service

---

## Discovery and Catalog Rules

### Public Curated Surface
Public `/api` and `/openapi.json` should list only:
- workflow endpoints
- simulation endpoints
- document-generation endpoints
- the selected compliance endpoints already approved for the curated core

### Full Surface
Keep the complete inventory available in:
- `/api/system/discovery/full`
- `/openapi-full.json`
- `/api/system/openapi.json`

### Additional Discovery Fields
Each curated workflow endpoint should expose:
- `best_for`
- `not_for`
- `input_style`
- `returns_artifacts`
- `example_task`
- `maturity`

### Example
- `best_for`: "Fast contender ranking from standings snapshot"
- `not_for`: "Injury-aware sportsbook modeling"
- `input_style`: "standings_snapshot or custom_field"
- `returns_artifacts`: `["xlsx", "pdf", "docx"]`
- `example_task`: "Predict the NBA Finals winner and give me an XLSX"

---

## Error Handling

Workflow adapters should reject bad inputs before simulation.

### Required Error Fields
- `error_code`
- `message`
- `fix_hint`
- `input_path`

### Example Errors
- invalid team count for chosen mode
- duplicate team abbreviations
- seed conflicts inside a conference
- unsupported league/mode combination
- required export requested without report generation enabled

---

## Testing Requirements

### Unit Tests
- adapter normalization logic
- league-specific input validation
- assumptions and default-weight generation
- report builder mapping from workflow result to shared report model

### Golden Tests
- stable seeded workflow outputs for a small scenario corpus
- expected artifact sheet/table names for generated reports

### Integration Tests
- local end-to-end workflow call
- workflow plus report generation
- workflow plus XLSX/PDF/DOCX generation

### Paid Canary Tests
- one paid production canary for NBA workflow
- one paid production canary for one non-sports workflow after launch
- artifact verification in prod after deploy

---

## Rollout Plan

### Phase 1: NBA Vertical Slice
- add workflow adapter contract
- build `sports/nba/playoff-forecast`
- map workflow result into shared report model
- generate XLSX and PDF from workflow result
- add curated discovery metadata

### Phase 2: Additional Sports Leagues
- generalize standings normalization utilities
- add `nfl`
- add `mlb`
- add `nhl`

### Phase 3: Non-Sports Validation
- ship one non-sports workflow using the same adapter architecture
- recommended target: vendor-risk or cash-runway forecast

### Phase 4: Advanced Workflow Features
- richer domain-specific modeling options
- better artifact storage/distribution
- stronger workflow examples and pricing guidance

---

## Open Questions

1. Should workflow adapters source live standings internally, or should callers always pass normalized team data?
Recommendation: support both, with `standings_snapshot` as the opinionated default.

2. Should the first sports workflow include play-in teams?
Recommendation: ship `top_6_only` first, then add `top_6_plus_play_in` after the base workflow is stable.

3. Should workflow endpoints return artifacts directly by default?
Recommendation: make artifacts opt-in through `model_options.include_artifacts`.

4. Should workflow endpoints replace the generic sim endpoints in public discovery?
Recommendation: no. Keep both, but position workflow adapters first in the curated catalog.

---

## Success Criteria

This spec is successful if the system can do all of the following with one paid workflow call:
- predict the NBA Finals winner and return an XLSX
- rank sports contenders and return a report
- screen a vendor cohort and return a decision memo

The main test is simple: the user should not need to manually translate a business or sports question into generic simulation parameters to get a useful answer.
