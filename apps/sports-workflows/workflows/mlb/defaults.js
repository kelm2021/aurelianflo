const MLB_SIGNAL_DEFAULTS = {
  weights: {
    win_pct: 0.41,
    point_diff: 0.31,
    recent_form: 0.14,
    seed_strength: 0.09,
    conference_bonus: 0.05,
  },
  uncertainty: {
    win_pct: 0.23,
    point_diff: 0.33,
    recent_form: 0.36,
    seed_strength: 0.13,
    conference_bonus: 0.08,
  },
  threshold: 0.94,
  outcome_noise: 0.95,
};

const MLB_ASSUMPTIONS = {
  top_6_only: [
    "Modeled field: top 6 teams in each league as of the standings snapshot date.",
    "Signals: win percentage, run differential per game, last-10 form, seed strength, and a small National League bonus.",
    "Interpretation: this is a contender-ranking workflow on top of the generic Monte Carlo engine, not a sportsbook line or full bracket simulator.",
  ],
  top_6_plus_play_in: [
    "Modeled field: top 10 teams in each league as of the standings snapshot date.",
    "Signals: win percentage, run differential per game, last-10 form, seed strength, and a small National League bonus.",
    "Interpretation: this is a contender-ranking workflow on top of the generic Monte Carlo engine, not a sportsbook line or full bracket simulator.",
  ],
};

module.exports = {
  MLB_ASSUMPTIONS,
  MLB_SIGNAL_DEFAULTS,
};
