const NHL_SIGNAL_DEFAULTS = {
  weights: {
    win_pct: 0.43,
    point_diff: 0.29,
    recent_form: 0.15,
    seed_strength: 0.09,
    conference_bonus: 0.04,
  },
  uncertainty: {
    win_pct: 0.2,
    point_diff: 0.29,
    recent_form: 0.31,
    seed_strength: 0.12,
    conference_bonus: 0.08,
  },
  threshold: 0.95,
  outcome_noise: 0.91,
};

const NHL_ASSUMPTIONS = {
  top_6_only: [
    "Modeled field: top 6 seeds in each conference as of the standings snapshot date.",
    "Signals: win percentage, point differential, last-10 form, seed strength, and a small West conference bonus.",
    "Interpretation: this is a contender-ranking workflow on top of the generic Monte Carlo engine, not a sportsbook line or full bracket simulator.",
  ],
  top_6_plus_play_in: [
    "Modeled field: top 10 teams in each conference as of the standings snapshot date.",
    "Signals: win percentage, point differential, last-10 form, seed strength, and a small West conference bonus.",
    "Interpretation: this is a contender-ranking workflow on top of the generic Monte Carlo engine, not a sportsbook line or full bracket simulator.",
  ],
};

module.exports = {
  NHL_ASSUMPTIONS,
  NHL_SIGNAL_DEFAULTS,
};
