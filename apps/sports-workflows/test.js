const assert = require("node:assert/strict");
const test = require("node:test");
const fetch = require("node-fetch");

const { createApp } = require("./app");
const DEFAULT_SEED = 20260403;

function buildCustomFieldPayload(seed = DEFAULT_SEED) {
  return {
    as_of_date: "2026-04-03",
    league: "nba",
    mode: "custom_field",
    field: "top_6_only",
    inputs: {
      teams: [
        { name: "Detroit Pistons", abbr: "DET", conference: "East", seed: 1, wins: 56, losses: 21, win_pct: 0.727, point_diff: 7.9, last_10: "8-2" },
        { name: "Boston Celtics", abbr: "BOS", conference: "East", seed: 2, wins: 51, losses: 25, win_pct: 0.671, point_diff: 7.2, last_10: "8-2" },
        { name: "New York Knicks", abbr: "NY", conference: "East", seed: 3, wins: 49, losses: 28, win_pct: 0.636, point_diff: 6.1, last_10: "7-3" },
        { name: "Cleveland Cavaliers", abbr: "CLE", conference: "East", seed: 4, wins: 48, losses: 29, win_pct: 0.623, point_diff: 4.1, last_10: "7-3" },
        { name: "Atlanta Hawks", abbr: "ATL", conference: "East", seed: 5, wins: 44, losses: 33, win_pct: 0.571, point_diff: 2.3, last_10: "8-2" },
        { name: "Philadelphia 76ers", abbr: "PHI", conference: "East", seed: 6, wins: 42, losses: 34, win_pct: 0.553, point_diff: -0.1, last_10: "7-3" },
        { name: "Oklahoma City Thunder", abbr: "OKC", conference: "West", seed: 1, wins: 61, losses: 16, win_pct: 0.792, point_diff: 11.4, last_10: "9-1" },
        { name: "San Antonio Spurs", abbr: "SA", conference: "West", seed: 2, wins: 59, losses: 18, win_pct: 0.766, point_diff: 8.5, last_10: "10-0" },
        { name: "Los Angeles Lakers", abbr: "LAL", conference: "West", seed: 3, wins: 50, losses: 27, win_pct: 0.649, point_diff: 1.5, last_10: "8-2" },
        { name: "Denver Nuggets", abbr: "DEN", conference: "West", seed: 4, wins: 49, losses: 28, win_pct: 0.636, point_diff: 4.8, last_10: "8-2" },
        { name: "Houston Rockets", abbr: "HOU", conference: "West", seed: 5, wins: 47, losses: 29, win_pct: 0.618, point_diff: 4.5, last_10: "6-4" },
        { name: "Minnesota Timberwolves", abbr: "MIN", conference: "West", seed: 6, wins: 46, losses: 30, win_pct: 0.605, point_diff: 3.7, last_10: "6-4" }
      ]
    },
    model_options: {
      seed,
      simulations: 10000,
      include_report: true,
      include_artifacts: ["xlsx"]
    }
  };
}

function buildNflCustomFieldPayload(seed = DEFAULT_SEED) {
  return {
    as_of_date: "2026-04-03",
    league: "nfl",
    mode: "custom_field",
    field: "top_6_only",
    inputs: {
      teams: [
        { name: "Kansas City Chiefs", abbr: "KC", conference: "AFC", seed: 1, wins: 14, losses: 3, win_pct: 0.824, point_diff: 11.2, last_10: "8-2" },
        { name: "Buffalo Bills", abbr: "BUF", conference: "AFC", seed: 2, wins: 13, losses: 4, win_pct: 0.765, point_diff: 10.4, last_10: "8-2" },
        { name: "Baltimore Ravens", abbr: "BAL", conference: "AFC", seed: 3, wins: 12, losses: 5, win_pct: 0.706, point_diff: 8.3, last_10: "7-3" },
        { name: "Houston Texans", abbr: "HOU", conference: "AFC", seed: 4, wins: 11, losses: 6, win_pct: 0.647, point_diff: 4.8, last_10: "6-4" },
        { name: "Cincinnati Bengals", abbr: "CIN", conference: "AFC", seed: 5, wins: 11, losses: 6, win_pct: 0.647, point_diff: 5.1, last_10: "7-3" },
        { name: "New York Jets", abbr: "NYJ", conference: "AFC", seed: 6, wins: 10, losses: 7, win_pct: 0.588, point_diff: 1.9, last_10: "6-4" },
        { name: "San Francisco 49ers", abbr: "SF", conference: "NFC", seed: 1, wins: 14, losses: 3, win_pct: 0.824, point_diff: 12.6, last_10: "9-1" },
        { name: "Detroit Lions", abbr: "DET", conference: "NFC", seed: 2, wins: 13, losses: 4, win_pct: 0.765, point_diff: 9.1, last_10: "8-2" },
        { name: "Philadelphia Eagles", abbr: "PHI", conference: "NFC", seed: 3, wins: 12, losses: 5, win_pct: 0.706, point_diff: 7.4, last_10: "7-3" },
        { name: "Dallas Cowboys", abbr: "DAL", conference: "NFC", seed: 4, wins: 11, losses: 6, win_pct: 0.647, point_diff: 6.3, last_10: "6-4" },
        { name: "Green Bay Packers", abbr: "GB", conference: "NFC", seed: 5, wins: 11, losses: 6, win_pct: 0.647, point_diff: 3.6, last_10: "7-3" },
        { name: "Los Angeles Rams", abbr: "LAR", conference: "NFC", seed: 6, wins: 10, losses: 7, win_pct: 0.588, point_diff: 2.8, last_10: "6-4" }
      ]
    },
    model_options: {
      seed,
      simulations: 10000,
      include_report: true,
      include_artifacts: ["xlsx"]
    }
  };
}

function buildNhlCustomFieldPayload(seed = DEFAULT_SEED) {
  return {
    as_of_date: "2026-04-03",
    league: "nhl",
    mode: "custom_field",
    field: "top_6_only",
    inputs: {
      teams: [
        { name: "New York Rangers", abbr: "NYR", conference: "East", seed: 1, wins: 54, losses: 22, win_pct: 0.711, point_diff: 1.15, last_10: "7-3" },
        { name: "Carolina Hurricanes", abbr: "CAR", conference: "East", seed: 2, wins: 52, losses: 24, win_pct: 0.684, point_diff: 0.91, last_10: "8-2" },
        { name: "Boston Bruins", abbr: "BOS", conference: "East", seed: 3, wins: 49, losses: 27, win_pct: 0.645, point_diff: 0.73, last_10: "6-4" },
        { name: "Toronto Maple Leafs", abbr: "TOR", conference: "East", seed: 4, wins: 47, losses: 29, win_pct: 0.618, point_diff: 0.54, last_10: "6-4" },
        { name: "Florida Panthers", abbr: "FLA", conference: "East", seed: 5, wins: 46, losses: 30, win_pct: 0.605, point_diff: 0.48, last_10: "7-3" },
        { name: "Tampa Bay Lightning", abbr: "TBL", conference: "East", seed: 6, wins: 44, losses: 32, win_pct: 0.579, point_diff: 0.33, last_10: "5-5" },
        { name: "Dallas Stars", abbr: "DAL", conference: "West", seed: 1, wins: 55, losses: 21, win_pct: 0.724, point_diff: 1.19, last_10: "8-2" },
        { name: "Colorado Avalanche", abbr: "COL", conference: "West", seed: 2, wins: 53, losses: 23, win_pct: 0.697, point_diff: 1.02, last_10: "7-3" },
        { name: "Vancouver Canucks", abbr: "VAN", conference: "West", seed: 3, wins: 50, losses: 26, win_pct: 0.658, point_diff: 0.82, last_10: "7-3" },
        { name: "Edmonton Oilers", abbr: "EDM", conference: "West", seed: 4, wins: 49, losses: 27, win_pct: 0.645, point_diff: 0.77, last_10: "6-4" },
        { name: "Winnipeg Jets", abbr: "WPG", conference: "West", seed: 5, wins: 47, losses: 29, win_pct: 0.618, point_diff: 0.61, last_10: "6-4" },
        { name: "Nashville Predators", abbr: "NSH", conference: "West", seed: 6, wins: 43, losses: 33, win_pct: 0.566, point_diff: 0.21, last_10: "5-5" }
      ]
    },
    model_options: {
      seed,
      simulations: 10000,
      include_report: true,
      include_artifacts: ["xlsx"]
    }
  };
}

function buildMlbCustomFieldPayload(seed = DEFAULT_SEED) {
  return {
    as_of_date: "2026-04-03",
    league: "mlb",
    mode: "custom_field",
    field: "top_6_only",
    inputs: {
      teams: [
        { name: "New York Yankees", abbr: "NYY", conference: "AL", seed: 1, wins: 5, losses: 1, win_pct: 0.833, point_diff: 2.33, last_10: "5-1" },
        { name: "Detroit Tigers", abbr: "DET", conference: "AL", seed: 2, wins: 5, losses: 1, win_pct: 0.833, point_diff: 2.17, last_10: "5-1" },
        { name: "Baltimore Orioles", abbr: "BAL", conference: "AL", seed: 3, wins: 4, losses: 2, win_pct: 0.667, point_diff: 1.5, last_10: "4-2" },
        { name: "Toronto Blue Jays", abbr: "TOR", conference: "AL", seed: 4, wins: 4, losses: 2, win_pct: 0.667, point_diff: 1.17, last_10: "4-2" },
        { name: "Houston Astros", abbr: "HOU", conference: "AL", seed: 5, wins: 4, losses: 2, win_pct: 0.667, point_diff: 0.83, last_10: "4-2" },
        { name: "Seattle Mariners", abbr: "SEA", conference: "AL", seed: 6, wins: 4, losses: 2, win_pct: 0.667, point_diff: 0.67, last_10: "4-2" },
        { name: "Los Angeles Dodgers", abbr: "LAD", conference: "NL", seed: 1, wins: 6, losses: 0, win_pct: 1, point_diff: 2.83, last_10: "6-0" },
        { name: "San Diego Padres", abbr: "SD", conference: "NL", seed: 2, wins: 5, losses: 1, win_pct: 0.833, point_diff: 2.5, last_10: "5-1" },
        { name: "Chicago Cubs", abbr: "CHC", conference: "NL", seed: 3, wins: 5, losses: 1, win_pct: 0.833, point_diff: 1.83, last_10: "5-1" },
        { name: "Philadelphia Phillies", abbr: "PHI", conference: "NL", seed: 4, wins: 4, losses: 2, win_pct: 0.667, point_diff: 1.33, last_10: "4-2" },
        { name: "San Francisco Giants", abbr: "SF", conference: "NL", seed: 5, wins: 4, losses: 2, win_pct: 0.667, point_diff: 1, last_10: "4-2" },
        { name: "Atlanta Braves", abbr: "ATL", conference: "NL", seed: 6, wins: 4, losses: 2, win_pct: 0.667, point_diff: 0.83, last_10: "4-2" }
      ]
    },
    model_options: {
      seed,
      simulations: 10000,
      include_report: true,
      include_artifacts: ["xlsx"]
    }
  };
}

function withServer(app, run) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", async () => {
      try {
        const { port } = server.address();
        const result = await run(`http://127.0.0.1:${port}`);
        server.close((closeErr) => {
          if (closeErr) {
            reject(closeErr);
            return;
          }
          resolve(result);
        });
      } catch (error) {
        server.close(() => reject(error));
      }
    });
  });
}

function sanitizeForDeterministicCompare(payload) {
  const clone = JSON.parse(JSON.stringify(payload));
  if (!clone || typeof clone !== "object") {
    return clone;
  }

  if (clone.artifacts && typeof clone.artifacts === "object") {
    for (const key of Object.keys(clone.artifacts)) {
      if (key === "recommended_local_path") {
        continue;
      }
      if (clone.artifacts[key] && typeof clone.artifacts[key] === "object") {
        delete clone.artifacts[key].artifact;
      }
    }
  }

  return clone;
}

test("nba playoff forecast returns workflow contract", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/workflows/sports/nba/championship-forecast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        as_of_date: "2026-04-03",
        league: "nba",
        mode: "standings_snapshot",
        field: "top_6_only",
        inputs: {},
        model_options: {
          seed: 12345,
          simulations: 10000,
        },
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.workflow_meta.workflow, "sports.championship_forecast");
    assert.equal(payload.workflow_meta.league, "nba");
    assert.equal(payload.inputs_echo.field, "top_6_only");
    assert.equal(typeof payload.prediction.predicted_winner, "string");
    assert.equal(typeof payload.prediction.championship_probability, "number");
    assert.ok(Array.isArray(payload.ranking));
    assert.ok(payload.ranking.length > 0);
    assert.ok(Array.isArray(payload.assumptions));
    assert.equal(typeof payload.diagnostics, "object");
  });
});

test("nba championship forecast returns workflow contract on the primary route", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/workflows/sports/nba/championship-forecast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildCustomFieldPayload(12345)),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.workflow_meta.workflow, "sports.championship_forecast");
    assert.equal(payload.workflow_meta.league, "nba");
    assert.equal(typeof payload.prediction.predicted_winner, "string");
    assert.equal(typeof payload.report, "object");
    assert.equal(payload.artifacts.xlsx.documentType, "xlsx");
  });
});

test("nba playoff forecast is reproducible for the same seed", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const firstResponse = await fetch(`${baseUrl}/api/workflows/sports/nba/championship-forecast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildCustomFieldPayload(DEFAULT_SEED)),
    });
    const firstPayload = await firstResponse.json();

    const secondResponse = await fetch(`${baseUrl}/api/workflows/sports/nba/championship-forecast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildCustomFieldPayload(DEFAULT_SEED)),
    });
    const secondPayload = await secondResponse.json();

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 200);
    assert.deepEqual(
      sanitizeForDeterministicCompare(secondPayload),
      sanitizeForDeterministicCompare(firstPayload),
    );
  });
});

test("nba playoff forecast supports custom_field mode", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/workflows/sports/nba/championship-forecast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        as_of_date: "2026-04-03",
        league: "nba",
        mode: "custom_field",
        field: "top_6_only",
        inputs: {
          teams: [
            {
              name: "Oklahoma City Thunder",
              abbr: "OKC",
              conference: "West",
              seed: 1,
              wins: 61,
              losses: 16,
              win_pct: 0.792,
              point_diff: 11.4,
              last_10: "9-1",
            },
            {
              name: "San Antonio Spurs",
              abbr: "SA",
              conference: "West",
              seed: 2,
              wins: 59,
              losses: 18,
              win_pct: 0.766,
              point_diff: 8.5,
              last_10: "10-0",
            },
            {
              name: "Detroit Pistons",
              abbr: "DET",
              conference: "East",
              seed: 1,
              wins: 56,
              losses: 21,
              win_pct: 0.727,
              point_diff: 7.9,
              last_10: "8-2",
            },
            {
              name: "Boston Celtics",
              abbr: "BOS",
              conference: "East",
              seed: 2,
              wins: 51,
              losses: 25,
              win_pct: 0.671,
              point_diff: 7.2,
              last_10: "8-2",
            },
          ],
        },
        model_options: {
          seed: 12345,
          simulations: 5000,
        },
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.workflow_meta.mode, "custom_field");
    assert.equal(payload.inputs_echo.team_count, 4);
    assert.equal(payload.ranking.length, 4);
    assert.ok(
      ["Oklahoma City Thunder", "San Antonio Spurs", "Detroit Pistons", "Boston Celtics"].includes(
        payload.prediction.predicted_winner,
      ),
    );
  });
});

test("nba playoff forecast bundles requested artifacts into the workflow response", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/workflows/sports/nba/championship-forecast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...buildCustomFieldPayload(12345),
        model_options: {
          seed: 12345,
          simulations: 5000,
          include_report: true,
          include_artifacts: ["xlsx", "pdf"],
        },
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(typeof payload.report, "object");
    assert.equal(typeof payload.artifacts, "object");
    assert.equal(typeof payload.artifacts.recommended_local_path, "string");
    assert.equal(payload.artifacts.recommended_local_path, "outputs/nba-championship-forecast-2026-04-03.xlsx");
    assert.equal(payload.artifacts.xlsx.documentType, "xlsx");
    assert.equal(payload.artifacts.pdf.documentType, "pdf");
    assert.match(String(payload.artifacts.xlsx.fileName || ""), /\.xlsx$/);
    assert.match(String(payload.artifacts.pdf.fileName || ""), /\.pdf$/);
    assert.equal(typeof payload.artifacts.xlsx.artifact.contentBase64, "string");
    assert.equal(typeof payload.artifacts.pdf.artifact.contentBase64, "string");
    assert.equal(payload.artifacts.xlsx.recommended_local_path, "outputs/nba-championship-forecast-2026-04-03.xlsx");
    assert.equal(payload.artifacts.pdf.recommended_local_path, "outputs/nba-championship-forecast-2026-04-03.pdf");
  });
});

test("nba playoff forecast rejects unsupported mode", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/workflows/sports/nba/championship-forecast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        league: "nba",
        mode: "invalid_mode",
        field: "top_6_only",
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error, "invalid_mode");
  });
});

test("nba playoff forecast rejects custom_field requests without teams", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/workflows/sports/nba/championship-forecast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        league: "nba",
        mode: "custom_field",
        field: "top_6_only",
        inputs: {},
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error, "invalid_inputs_teams");
  });
});

test("nfl playoff forecast returns workflow contract", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/workflows/sports/nfl/championship-forecast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildNflCustomFieldPayload(12345)),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.workflow_meta.workflow, "sports.championship_forecast");
    assert.equal(payload.workflow_meta.league, "nfl");
    assert.equal(payload.workflow_meta.mode, "custom_field");
    assert.equal(typeof payload.prediction.predicted_winner, "string");
    assert.equal(typeof payload.prediction.championship_probability, "number");
    assert.ok(Array.isArray(payload.ranking));
    assert.ok(payload.ranking.length > 0);
    assert.ok(Array.isArray(payload.assumptions));
    assert.equal(typeof payload.diagnostics, "object");
    assert.equal(typeof payload.report, "object");
    assert.equal(payload.artifacts.xlsx.documentType, "xlsx");
    assert.equal(
      payload.artifacts.xlsx.recommended_local_path,
      "outputs/nfl-championship-forecast-2026-04-03.xlsx",
    );
  });
});

test("nfl playoff forecast is reproducible for the same seed", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const firstResponse = await fetch(`${baseUrl}/api/workflows/sports/nfl/championship-forecast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildNflCustomFieldPayload(DEFAULT_SEED)),
    });
    const firstPayload = await firstResponse.json();

    const secondResponse = await fetch(`${baseUrl}/api/workflows/sports/nfl/championship-forecast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildNflCustomFieldPayload(DEFAULT_SEED)),
    });
    const secondPayload = await secondResponse.json();

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 200);
    assert.deepEqual(
      sanitizeForDeterministicCompare(secondPayload),
      sanitizeForDeterministicCompare(firstPayload),
    );
  });
});

test("nfl playoff forecast bundles requested artifacts into the workflow response", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/workflows/sports/nfl/championship-forecast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...buildNflCustomFieldPayload(12345),
        model_options: {
          seed: 12345,
          simulations: 5000,
          include_report: true,
          include_artifacts: ["xlsx", "pdf"],
        },
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(typeof payload.report, "object");
    assert.equal(typeof payload.artifacts, "object");
    assert.equal(typeof payload.artifacts.recommended_local_path, "string");
    assert.equal(payload.artifacts.recommended_local_path, "outputs/nfl-championship-forecast-2026-04-03.xlsx");
    assert.equal(payload.artifacts.xlsx.documentType, "xlsx");
    assert.equal(payload.artifacts.pdf.documentType, "pdf");
    assert.match(String(payload.artifacts.xlsx.fileName || ""), /\.xlsx$/);
    assert.match(String(payload.artifacts.pdf.fileName || ""), /\.pdf$/);
    assert.equal(typeof payload.artifacts.xlsx.artifact.contentBase64, "string");
    assert.equal(typeof payload.artifacts.pdf.artifact.contentBase64, "string");
    assert.equal(payload.artifacts.xlsx.recommended_local_path, "outputs/nfl-championship-forecast-2026-04-03.xlsx");
    assert.equal(payload.artifacts.pdf.recommended_local_path, "outputs/nfl-championship-forecast-2026-04-03.pdf");
  });
});

test("nhl playoff forecast returns workflow contract", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/workflows/sports/nhl/championship-forecast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildNhlCustomFieldPayload(12345)),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.workflow_meta.workflow, "sports.championship_forecast");
    assert.equal(payload.workflow_meta.league, "nhl");
    assert.equal(payload.workflow_meta.mode, "custom_field");
    assert.equal(typeof payload.prediction.predicted_winner, "string");
    assert.equal(typeof payload.prediction.championship_probability, "number");
    assert.ok(Array.isArray(payload.ranking));
    assert.ok(payload.ranking.length > 0);
    assert.ok(Array.isArray(payload.assumptions));
    assert.equal(typeof payload.diagnostics, "object");
    assert.equal(typeof payload.report, "object");
    assert.equal(payload.artifacts.xlsx.documentType, "xlsx");
    assert.equal(
      payload.artifacts.xlsx.recommended_local_path,
      "outputs/nhl-championship-forecast-2026-04-03.xlsx",
    );
  });
});

test("mlb playoff forecast returns workflow contract", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/workflows/sports/mlb/championship-forecast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildMlbCustomFieldPayload(12345)),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.workflow_meta.workflow, "sports.championship_forecast");
    assert.equal(payload.workflow_meta.league, "mlb");
    assert.equal(payload.workflow_meta.mode, "custom_field");
    assert.equal(typeof payload.prediction.predicted_winner, "string");
    assert.equal(typeof payload.prediction.championship_probability, "number");
    assert.ok(Array.isArray(payload.ranking));
    assert.ok(payload.ranking.length > 0);
    assert.ok(Array.isArray(payload.assumptions));
    assert.equal(typeof payload.diagnostics, "object");
    assert.equal(typeof payload.report, "object");
    assert.equal(payload.artifacts.xlsx.documentType, "xlsx");
    assert.equal(
      payload.artifacts.xlsx.recommended_local_path,
      "outputs/mlb-championship-forecast-2026-04-03.xlsx",
    );
  });
});

test("mlb playoff forecast is reproducible for the same seed", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const firstResponse = await fetch(`${baseUrl}/api/workflows/sports/mlb/championship-forecast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildMlbCustomFieldPayload(DEFAULT_SEED)),
    });
    const firstPayload = await firstResponse.json();

    const secondResponse = await fetch(`${baseUrl}/api/workflows/sports/mlb/championship-forecast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildMlbCustomFieldPayload(DEFAULT_SEED)),
    });
    const secondPayload = await secondResponse.json();

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 200);
    assert.deepEqual(
      sanitizeForDeterministicCompare(secondPayload),
      sanitizeForDeterministicCompare(firstPayload),
    );
  });
});
