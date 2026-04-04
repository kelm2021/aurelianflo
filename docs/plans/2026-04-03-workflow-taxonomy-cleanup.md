# Workflow Taxonomy Cleanup

**Goal:** Tighten the public workflow taxonomy so route names match what the product actually does, remain useful year-round, and stay discoverable without overpromising.

**Primary Outcome:** Replace overly broad or seasonally awkward endpoint framing with a stable cross-domain workflow family that is clearer for users and safer to keep public long term.

**Date:** April 3, 2026

---

## Why This Cleanup Is Needed

The current workflow layer is technically working, but some public route names are more specific than the underlying product.

Two kinds of mismatch showed up:

1. **Seasonality mismatch**
Some sports routes are framed around playoffs even when a league is out of season. That makes the endpoint feel artificial despite the underlying contender-ranking model being valid.

2. **Business-model mismatch**
Some non-sports routes are more specific than their public names suggest. The model may be useful, but the route name implies broader applicability than the current inputs actually support.

This cleanup is about product truthfulness, not engine quality. The product should expose task-shaped routes whose names remain accurate even when conditions change.

---

## Taxonomy Principles

1. **Public names should describe the real task.**
If the endpoint is doing ranking, assessment, or comparison, the route should say that.

2. **Always-on routes should be seasonally safe.**
If a route is public year-round, it should make sense year-round.

3. **Specialized routes should be explicit.**
If a workflow assumes a SaaS funnel, onboarding queue, or playoff field, the route should say so.

4. **General systems can sit behind specific adapters.**
The core model can stay generic while the public route stays honest and bounded.

5. **Compatibility matters.**
Existing live routes should not disappear immediately. Migrate by introducing clearer primary routes, then keep older names as compatibility aliases until deliberately retired.

---

## Recommended Public Workflow Families

### Sports

Primary family:
- `POST /api/workflows/sports/{league}/championship-forecast`
- `POST /api/workflows/sports/{league}/game-forecast`

Seasonal or stateful family:
- `POST /api/workflows/sports/{league}/playoff-forecast`

Interpretation:
- `championship-forecast` is the always-on route for contender ranking / title odds.
- `playoff-forecast` is only appropriate when the product is actually modeling a current or near-current playoff field.
- `game-forecast` is the matchup-specific route for single games or short slates.

### Vendor / Compliance

Primary family:
- `POST /api/workflows/vendor/risk-assessment`
- later: `POST /api/workflows/vendor/batch-risk-assessment`
- later: `POST /api/workflows/vendor/onboarding-report`

Interpretation:
- `risk-assessment` is clearer than `risk-forecast` because the current workflow is not projecting future risk under time-series uncertainty. It is composing current signals into a decision payload.

### Finance

Primary family:
- `POST /api/workflows/finance/cash-runway-forecast`
- `POST /api/workflows/finance/pricing-plan-compare`

Later optional broader family:
- `POST /api/workflows/finance/scenario-analysis`

Interpretation:
- `cash-runway-forecast` is already correctly named and can remain primary.
- `pricing-plan-compare` is more honest than `pricing-scenario-forecast` because the current input contract assumes a bounded plan comparison rather than an open-ended pricing simulation framework.

---

## Current Route Assessment

### Safe As-Is

#### `POST /api/workflows/finance/cash-runway-forecast`

Status: keep as primary.

Why:
- useful year-round
- explicit inputs
- output is clearly forecast-shaped
- the route name matches the current model

Minor note:
- `runway-forecast` would also be acceptable, but `cash-runway-forecast` is already clear.

### Usable But Misnamed

#### `POST /api/workflows/vendor/risk-forecast`

Status: keep temporarily, but reframe.

Problem:
- the workflow is mostly an assessment/composition workflow, not a time-forward forecast

Better name:
- `POST /api/workflows/vendor/risk-assessment`

Compatibility plan:
- keep `vendor/risk-forecast` as an alias
- public discovery should prefer `vendor/risk-assessment`

#### `POST /api/workflows/finance/pricing-scenario-forecast`

Status: keep temporarily, but narrow the name.

Problem:
- the route implies a broad pricing forecasting surface
- the actual inputs are closer to a SaaS-style plan comparison model

Better name:
- `POST /api/workflows/finance/pricing-plan-compare`

Compatibility plan:
- keep `pricing-scenario-forecast` as an alias
- public discovery should prefer `pricing-plan-compare`

### Most In Need of Cleanup

#### `POST /api/workflows/sports/{league}/playoff-forecast`

Status: demote from primary route family.

Problem:
- it sounds live-playoff-specific
- it feels awkward out of season
- the current model is often closer to contender ranking / championship odds than true bracket simulation

Better primary name:
- `POST /api/workflows/sports/{league}/championship-forecast`

Compatibility plan:
- keep `playoff-forecast` as a compatibility alias
- expose `championship-forecast` as the main public sports route
- reserve `playoff-forecast` for stricter postseason-aware modeling over time

---

## Recommended Target Taxonomy

### Public Primary Routes

- `POST /api/workflows/sports/nba/championship-forecast`
- `POST /api/workflows/sports/nfl/championship-forecast`
- `POST /api/workflows/sports/nhl/championship-forecast`
- `POST /api/workflows/vendor/risk-assessment`
- `POST /api/workflows/finance/cash-runway-forecast`
- `POST /api/workflows/finance/pricing-plan-compare`

### Compatibility Aliases

- `POST /api/workflows/sports/nba/playoff-forecast`
- `POST /api/workflows/sports/nfl/playoff-forecast`
- `POST /api/workflows/sports/nhl/playoff-forecast`
- `POST /api/workflows/vendor/risk-forecast`
- `POST /api/workflows/finance/pricing-scenario-forecast`

### Future Additions

- `POST /api/workflows/sports/{league}/game-forecast`
- `POST /api/workflows/sports/{league}/playoff-forecast` with stricter postseason contract
- `POST /api/workflows/finance/scenario-analysis`
- `POST /api/workflows/vendor/onboarding-report`

---

## Domain-by-Domain Guidance

## Sports

### What the current sports workflows really are

Today’s sports workflows are best understood as:
- contender ranking
- title probability estimate
- export-ready summary/report generation

They are not yet:
- sportsbook-grade odds
- injury-aware forecast systems
- exact bracket path simulation engines
- schedule-aware season simulators

So the public naming should reflect that.

### Recommended sports contract shift

Current:
- `playoff-forecast`

Preferred:
- `championship-forecast`

This lets the route stay live all year:
- preseason
- midseason
- late season
- postseason
- offseason custom-field modeling

### When `playoff-forecast` should exist

Keep it for:
- playoff-bracket-specific input contracts
- postseason-only fields
- path-dependent series structures
- play-in or wildcard logic

That route should become more specialized over time, not remain the default label for a general title-odds workflow.

## Vendor

### What the current vendor workflow really is

Today’s vendor workflow is:
- a present-state risk assessment
- a screening and entity-resolution composition layer
- a recommendation engine for proceed/pause/review

It is not primarily a forecast.

### Recommended vendor contract shift

Current:
- `risk-forecast`

Preferred:
- `risk-assessment`

This improves:
- trustworthiness
- procurement clarity
- legal/compliance expectations

## Finance

### Cash runway

This route is already well-scoped:
- explicitly time-based
- simulation-backed
- clearly forecast-oriented

No taxonomy change needed.

### Pricing

The current pricing route is useful, but the public name is too broad.

Today it is closer to:
- plan comparison
- scenario ranking
- expected annual profit comparison

It is not yet a generic pricing strategy platform.

### Recommended finance contract shift

Current:
- `pricing-scenario-forecast`

Preferred:
- `pricing-plan-compare`

That still leaves room later for a broader:
- `scenario-analysis`
- `pricing-experiment-forecast`
- `pricing-optimization`

---

## Discovery Recommendations

Curated public discovery should show the new primary names first.

For compatibility aliases:
- mark them as `compatibility`
- optionally mark them as `legacy-label`
- describe the preferred route in the summary

Example:
- `POST /api/workflows/sports/nfl/playoff-forecast`
  Summary: compatibility alias for `sports/nfl/championship-forecast`

This avoids breaking clients while steering discovery toward the cleaner taxonomy.

---

## Rollout Plan

### Phase 1: Introduce new primary routes

Add:
- `sports/{league}/championship-forecast`
- `vendor/risk-assessment`
- `finance/pricing-plan-compare`

Back them with the current workflow implementations where behavior matches.

### Phase 2: Keep compatibility aliases

Continue serving:
- sports playoff routes
- vendor risk forecast
- pricing scenario forecast

But remove them from preferred curated messaging.

### Phase 3: Tighten specialized routes

Evolve:
- `playoff-forecast` into real postseason-aware contracts
- `pricing-scenario-forecast` into either alias-only or retire it once clients move

---

## Recommended Immediate Refactor Order

1. Add new primary alias routes without changing behavior:
   - sports championship routes
   - vendor risk assessment
   - finance pricing plan compare
2. Update curated discovery to prefer the new names
3. Update docs and examples
4. Keep old routes live as compatibility aliases
5. Later, tighten the semantics of the specialized routes

---

## Success Criteria

The taxonomy is successful when:
- every public route name matches the actual task being done
- sports routes make sense even out of season
- finance routes do not imply more generality than the current model supports
- vendor routes read like compliance workflows, not probabilistic forecasts
- the curated catalog is understandable without trial-and-error

---

## Recommendation Summary

Keep:
- `cash-runway-forecast`

Rename or reframe as primary:
- `vendor-risk-forecast` -> `vendor-risk-assessment`
- `pricing-scenario-forecast` -> `pricing-plan-compare`
- `sports/{league}/playoff-forecast` -> `sports/{league}/championship-forecast`

Keep compatibility aliases:
- current sports playoff routes
- current vendor risk forecast route
- current pricing scenario forecast route

This gives the product a cleaner, safer public surface without throwing away the working implementations already shipped.
