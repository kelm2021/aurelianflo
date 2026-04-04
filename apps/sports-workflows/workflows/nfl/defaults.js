const NFL_SIGNAL_DEFAULTS = {
  weights: {
    win_pct: 0.44,
    point_diff: 0.28,
    recent_form: 0.15,
    seed_strength: 0.09,
    conference_bonus: 0.04,
  },
  uncertainty: {
    win_pct: 0.19,
    point_diff: 0.3,
    recent_form: 0.3,
    seed_strength: 0.13,
    conference_bonus: 0.07,
  },
  threshold: 0.95,
  outcome_noise: 0.9,
};

const NFL_ASSUMPTIONS = {
  top_6_only: [
    "Modeled field: top 6 seeds in each conference as of the standings snapshot date.",
    "Signals: win percentage, point differential, last-10 form, seed strength, and a small AFC conference bonus.",
    "Interpretation: this is a contender-ranking workflow on top of the generic Monte Carlo engine, not a sportsbook line or full bracket simulator.",
  ],
  top_6_plus_play_in: [
    "Modeled field: top 10 teams in each conference as of the standings snapshot date.",
    "Signals: win percentage, point differential, last-10 form, seed strength, and a small AFC conference bonus.",
    "Interpretation: this is a contender-ranking workflow on top of the generic Monte Carlo engine, not a sportsbook line or full bracket simulator.",
  ],
};

module.exports = {
  NFL_ASSUMPTIONS,
  NFL_SIGNAL_DEFAULTS,
};
