const { NBA_SIGNAL_DEFAULTS } = require("./defaults");

function formSignal(last10) {
  const wins = Number(String(last10).split("-")[0]);
  return (wins - 5) / 5;
}

function winPctSignal(winPct) {
  return (winPct - 0.5) / 0.3;
}

function seedStrength(seed) {
  return (11 - seed) / 10;
}

function selectTeams(snapshot, field) {
  const perConferenceLimit = field === "top_6_plus_play_in" ? 10 : 6;
  const east = snapshot.teams
    .filter((team) => team.conference === "East")
    .sort((left, right) => left.seed - right.seed)
    .slice(0, perConferenceLimit);
  const west = snapshot.teams
    .filter((team) => team.conference === "West")
    .sort((left, right) => left.seed - right.seed)
    .slice(0, perConferenceLimit);

  return [...east, ...west];
}

function teamToScenario(team) {
  return {
    label: team.name,
    parameters: {
      win_pct: Number(winPctSignal(team.win_pct).toFixed(4)),
      point_diff: Number((team.point_diff / 10).toFixed(4)),
      recent_form: Number(formSignal(team.last_10).toFixed(4)),
      seed_strength: Number(seedStrength(team.seed).toFixed(4)),
      conference_bonus: team.conference === "West" ? 0.08 : 0,
    },
    weights: { ...NBA_SIGNAL_DEFAULTS.weights },
    uncertainty: { ...NBA_SIGNAL_DEFAULTS.uncertainty },
    outcome_noise: NBA_SIGNAL_DEFAULTS.outcome_noise,
    threshold: NBA_SIGNAL_DEFAULTS.threshold,
  };
}

module.exports = {
  selectTeams,
  teamToScenario,
};
