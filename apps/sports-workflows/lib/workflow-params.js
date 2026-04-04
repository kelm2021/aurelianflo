const DEFAULT_SIMS = 10000;

const ALLOWED_MODES = new Set(["standings_snapshot", "custom_field"]);
const ALLOWED_FIELDS = new Set(["top_6_only", "top_6_plus_play_in"]);
const LEAGUE_CONFERENCES = {
  nba: new Set(["East", "West"]),
  nfl: new Set(["AFC", "NFC"]),
  mlb: new Set(["AL", "NL"]),
  nhl: new Set(["East", "West"]),
};
const ALLOWED_ARTIFACTS = new Set(["xlsx", "pdf", "docx"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function createError(error, message, details) {
  return {
    error,
    message,
    ...(details ? { details } : {}),
  };
}

function parseInteger(value, field, defaultValue) {
  if (value === undefined) {
    return { value: defaultValue };
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: createError(`invalid_${field}`, `${field} must be a positive integer`) };
  }
  return { value: parsed };
}

function normalizeTeamsInput(rawTeams, options = {}) {
  const allowedConferences = options.allowedConferences || LEAGUE_CONFERENCES.nba;
  const conferenceList = Array.from(allowedConferences);
  const conferenceMessage = conferenceList.length === 2
    ? `${conferenceList[0]} or ${conferenceList[1]}`
    : conferenceList.join(", ");

  if (!Array.isArray(rawTeams) || rawTeams.length === 0) {
    return {
      error: createError(
        "invalid_inputs_teams",
        "inputs.teams must be a non-empty array for custom_field mode",
      ),
    };
  }

  const seenAbbr = new Set();

  const teams = rawTeams.map((team, index) => {
    if (!isPlainObject(team)) {
      return {
        error: createError(
          "invalid_inputs_teams",
          `inputs.teams[${index}] must be an object`,
        ),
      };
    }

    const requiredFields = [
      "name",
      "abbr",
      "conference",
      "seed",
      "wins",
      "losses",
      "win_pct",
      "point_diff",
      "last_10",
    ];
    for (const field of requiredFields) {
      if (team[field] === undefined || team[field] === null || team[field] === "") {
        return {
          error: createError(
            "invalid_inputs_teams",
            `inputs.teams[${index}].${field} is required`,
          ),
        };
      }
    }

    if (!allowedConferences.has(team.conference)) {
      return {
        error: createError(
          "invalid_inputs_teams",
          `inputs.teams[${index}].conference must be ${conferenceMessage}`,
        ),
      };
    }

    if (!Number.isInteger(team.seed) || team.seed <= 0) {
      return {
        error: createError(
          "invalid_inputs_teams",
          `inputs.teams[${index}].seed must be a positive integer`,
        ),
      };
    }

    for (const numericField of ["wins", "losses", "win_pct", "point_diff"]) {
      if (!Number.isFinite(team[numericField])) {
        return {
          error: createError(
            "invalid_inputs_teams",
            `inputs.teams[${index}].${numericField} must be a finite number`,
          ),
        };
      }
    }

    if (!/^\d{1,2}-\d{1,2}$/.test(String(team.last_10))) {
      return {
        error: createError(
          "invalid_inputs_teams",
          `inputs.teams[${index}].last_10 must look like 8-2`,
        ),
      };
    }

    const abbr = String(team.abbr).trim();
    if (seenAbbr.has(abbr)) {
      return {
        error: createError(
          "invalid_inputs_teams",
          `inputs.teams[${index}].abbr must be unique`,
        ),
      };
    }
    seenAbbr.add(abbr);

    return {
      value: {
        name: String(team.name).trim(),
        abbr,
        conference: team.conference,
        seed: team.seed,
        wins: team.wins,
        losses: team.losses,
        win_pct: team.win_pct,
        point_diff: team.point_diff,
        last_10: String(team.last_10),
      },
    };
  });

  const firstError = teams.find((entry) => entry.error);
  if (firstError) {
    return { error: firstError.error };
  }

  return { value: teams.map((entry) => entry.value) };
}

function parseWorkflowParams(req, options = {}) {
  if (!isPlainObject(req.body)) {
    return {
      error: createError("invalid_request", "request body must be an object"),
    };
  }

  const body = req.body;
  const expectedLeague = options.expectedLeague;
  const league = String(body.league || "").toLowerCase();
  if (!Object.hasOwn(LEAGUE_CONFERENCES, league)) {
    return {
      error: createError("invalid_league", "league must be nba, nfl, mlb, or nhl"),
    };
  }

  if (expectedLeague && league !== expectedLeague) {
    return {
      error: createError("invalid_league", `league must be ${expectedLeague}`),
    };
  }

  if (!ALLOWED_MODES.has(body.mode)) {
    return {
      error: createError("invalid_mode", "mode must be standings_snapshot or custom_field"),
    };
  }

  if (!ALLOWED_FIELDS.has(body.field)) {
    return {
      error: createError("invalid_field", "field must be top_6_only or top_6_plus_play_in"),
    };
  }

  const seedResult = parseInteger(body.model_options?.seed, "seed", undefined);
  if (seedResult.error) {
    return { error: seedResult.error };
  }

  const simsResult = parseInteger(body.model_options?.simulations, "simulations", DEFAULT_SIMS);
  if (simsResult.error) {
    return { error: simsResult.error };
  }

  const rawArtifacts = body.model_options?.include_artifacts;
  let includeArtifacts = [];
  if (rawArtifacts !== undefined) {
    if (!Array.isArray(rawArtifacts)) {
      return {
        error: createError(
          "invalid_include_artifacts",
          "model_options.include_artifacts must be an array when provided",
        ),
      };
    }
    includeArtifacts = rawArtifacts.map((value) => String(value).trim().toLowerCase()).filter(Boolean);
    const invalidArtifact = includeArtifacts.find((value) => !ALLOWED_ARTIFACTS.has(value));
    if (invalidArtifact) {
      return {
        error: createError(
          "invalid_include_artifacts",
          "model_options.include_artifacts may only include xlsx, pdf, or docx",
          { artifact: invalidArtifact },
        ),
      };
    }
  }

  let teams;
  if (body.mode === "custom_field") {
    const teamsResult = normalizeTeamsInput(body.inputs?.teams, {
      allowedConferences: LEAGUE_CONFERENCES[league],
    });
    if (teamsResult.error) {
      return { error: teamsResult.error };
    }
    teams = teamsResult.value;
  } else {
    teams = undefined;
  }

  return {
    value: {
      asOfDate: body.as_of_date,
      league,
      mode: body.mode,
      field: body.field,
      seed: seedResult.value,
      simulations: simsResult.value,
      includeReport: Boolean(body.model_options?.include_report),
      includeArtifacts,
      teams,
    },
  };
}

module.exports = {
  DEFAULT_SIMS,
  createError,
  parseWorkflowParams,
};
