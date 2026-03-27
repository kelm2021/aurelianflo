const { Router } = require("express");
const {
  requestJson,
  sendNormalizedError,
  withProviderFallback,
} = require("../lib/upstream-client");

const router = Router();

const SPORT_MAP = {
  nfl: {
    theSportsDbLeagueId: "4391",
    espnPath: "football/nfl",
    oddsKey: "americanfootball_nfl",
    apiSportsLeagueId: "1",
    apiSportsSport: "american-football",
  },
  nba: {
    theSportsDbLeagueId: "4387",
    espnPath: "basketball/nba",
    oddsKey: "basketball_nba",
    apiSportsLeagueId: "12",
    apiSportsSport: "basketball",
  },
  mlb: {
    theSportsDbLeagueId: "4424",
    espnPath: "baseball/mlb",
    oddsKey: "baseball_mlb",
    apiSportsLeagueId: "1",
    apiSportsSport: "baseball",
  },
  nhl: {
    theSportsDbLeagueId: "4380",
    espnPath: "hockey/nhl",
    oddsKey: "icehockey_nhl",
    apiSportsLeagueId: "57",
    apiSportsSport: "hockey",
  },
  epl: {
    theSportsDbLeagueId: "4328",
    espnPath: "soccer/eng.1",
    oddsKey: "soccer_epl",
    apiSportsLeagueId: "39",
    apiSportsSport: "football",
  },
  ncaaf: {
    theSportsDbLeagueId: "4479",
    espnPath: "football/college-football",
    oddsKey: "americanfootball_ncaaf",
    apiSportsLeagueId: "1",
    apiSportsSport: "american-football",
  },
  ncaamb: {
    theSportsDbLeagueId: "4432",
    espnPath: "basketball/mens-college-basketball",
    oddsKey: "basketball_ncaab",
    apiSportsLeagueId: "12",
    apiSportsSport: "basketball",
  },
  mls: {
    theSportsDbLeagueId: "4346",
    espnPath: "soccer/usa.1",
    oddsKey: "soccer_usa_mls",
    apiSportsLeagueId: "253",
    apiSportsSport: "football",
  },
};

function normalizeSportSlug(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getSportConfig(slug) {
  return SPORT_MAP[normalizeSportSlug(slug)] ?? null;
}

function parsePositiveInt(value, fallback, minimum = 1, maximum = 100) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
}

function normalizeSportsDbEvents(events = [], limit = 25) {
  return events.slice(0, limit).map((event) => ({
    id: event.idEvent ?? null,
    startTime: event.strTimestamp ?? event.dateEvent ?? null,
    status: event.strStatus ?? null,
    homeTeam: event.strHomeTeam ?? null,
    awayTeam: event.strAwayTeam ?? null,
    homeScore: event.intHomeScore == null ? null : Number(event.intHomeScore),
    awayScore: event.intAwayScore == null ? null : Number(event.intAwayScore),
    venue: event.strVenue ?? null,
    league: event.strLeague ?? null,
  }));
}

function normalizeEspnEvents(events = [], limit = 25) {
  return events.slice(0, limit).map((event) => {
    const competition = event.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    const home = competitors.find((entry) => entry.homeAway === "home") || {};
    const away = competitors.find((entry) => entry.homeAway === "away") || {};

    return {
      id: event.id ?? null,
      startTime: event.date ?? null,
      status: event.status?.type?.description ?? null,
      period: competition.status?.period ?? event.status?.period ?? null,
      clock: competition.status?.displayClock ?? event.status?.displayClock ?? null,
      homeTeam: home.team?.displayName ?? null,
      awayTeam: away.team?.displayName ?? null,
      homeScore: home.score == null ? null : Number(home.score),
      awayScore: away.score == null ? null : Number(away.score),
      venue: competition.venue?.fullName ?? null,
      league: event.league?.name ?? null,
    };
  });
}

function normalizeSportsDbStandings(rows = [], limit = 40) {
  return rows.slice(0, limit).map((row) => ({
    rank: row.intRank == null ? null : Number(row.intRank),
    team: row.strTeam ?? null,
    played: row.intPlayed == null ? null : Number(row.intPlayed),
    won: row.intWin == null ? null : Number(row.intWin),
    lost: row.intLoss == null ? null : Number(row.intLoss),
    draw: row.intDraw == null ? null : Number(row.intDraw),
    points: row.intPoints == null ? null : Number(row.intPoints),
    pct: row.fltWinPercentage == null ? null : Number(row.fltWinPercentage),
    streak: row.strForm ?? null,
  }));
}

function normalizeEspnStandings(data = {}, limit = 40) {
  const entries = data.children?.[0]?.standings?.entries || data.standings?.entries || [];
  return entries.slice(0, limit).map((entry, index) => {
    const stats = Array.isArray(entry.stats) ? entry.stats : [];
    const valueByName = (name) => stats.find((stat) => stat.name === name)?.value ?? null;
    return {
      rank: valueByName("rank") ?? index + 1,
      team: entry.team?.displayName ?? null,
      played: valueByName("gamesPlayed"),
      won: valueByName("wins"),
      lost: valueByName("losses"),
      draw: valueByName("ties"),
      points: valueByName("points"),
      pct: valueByName("winPercent"),
      streak: valueByName("streak"),
    };
  });
}

function normalizeOddsEvents(events = [], limit = 50) {
  return events.slice(0, limit).map((event) => ({
    id: event.id ?? null,
    commenceTime: event.commence_time ?? event.commenceTime ?? null,
    homeTeam: event.home_team ?? event.homeTeam ?? null,
    awayTeam: event.away_team ?? event.awayTeam ?? null,
    bookmakers: (event.bookmakers || []).map((bookmaker) => ({
      key: bookmaker.key ?? null,
      title: bookmaker.title ?? null,
      lastUpdate: bookmaker.last_update ?? bookmaker.lastUpdate ?? null,
      markets: (bookmaker.markets || []).map((market) => ({
        key: market.key ?? null,
        outcomes: (market.outcomes || []).map((outcome) => ({
          name: outcome.name ?? null,
          price: outcome.price ?? null,
          point: outcome.point ?? null,
        })),
      })),
    })),
  }));
}

function normalizeApiSportsOdds(response, limit = 50) {
  const rows = Array.isArray(response?.response) ? response.response : [];
  return rows.slice(0, limit).map((row) => ({
    id: row.fixture?.id ?? null,
    commenceTime: row.fixture?.date ?? null,
    homeTeam: row.teams?.home?.name ?? null,
    awayTeam: row.teams?.away?.name ?? null,
    bookmakers: (row.bookmakers || []).map((bookmaker) => ({
      key: String(bookmaker.id ?? bookmaker.name ?? ""),
      title: bookmaker.name ?? null,
      lastUpdate: row.update ?? null,
      markets: (bookmaker.bets || []).map((bet) => ({
        key: String(bet.id ?? bet.name ?? ""),
        outcomes: (bet.values || []).map((value) => ({
          name: value.value ?? null,
          price: value.odd ?? null,
          point: null,
        })),
      })),
    })),
  }));
}

function ensureSport(slug) {
  const config = getSportConfig(slug);
  if (!config) {
    const error = new Error(
      "Unsupported sport. Use one of: nfl,nba,mlb,nhl,epl,ncaaf,ncaamb,mls",
    );
    error.statusCode = 400;
    throw error;
  }

  return config;
}

async function resolveScores(config, query) {
  const date = String(query.date || "").trim();
  const limit = parsePositiveInt(query.limit, 25, 1, 100);
  const sportsDbKey = String(process.env.THESPORTSDB_API_KEY || "").trim();

  const resolved = await withProviderFallback({
    primary: {
      provider: "thesportsdb",
      enabled: Boolean(sportsDbKey),
      keyName: "THESPORTSDB_API_KEY",
      execute: async () => {
        const raw = await requestJson({
          provider: "thesportsdb",
          url: `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(sportsDbKey)}/eventspastleague.php?id=${config.theSportsDbLeagueId}`,
        });
        const events = normalizeSportsDbEvents(raw?.events || [], limit).filter((event) =>
          date ? String(event.startTime || "").startsWith(date) : true,
        );
        return events;
      },
    },
    fallback: {
      provider: "espn",
      enabled: true,
      execute: async () => {
        const raw = await requestJson({
          provider: "espn",
          url:
            `https://site.api.espn.com/apis/site/v2/sports/${config.espnPath}/scoreboard` +
            (date ? `?dates=${encodeURIComponent(date.replaceAll("-", ""))}` : ""),
        });
        return normalizeEspnEvents(raw?.events || [], limit);
      },
    },
  });

  return {
    events: resolved.data,
    provider: resolved.provider,
    fallbackUsed: resolved.fallbackUsed,
  };
}

async function resolveStandings(config, query) {
  const season = String(query.season || "").trim();
  const limit = parsePositiveInt(query.limit, 40, 1, 100);
  const sportsDbKey = String(process.env.THESPORTSDB_API_KEY || "").trim();

  const resolved = await withProviderFallback({
    primary: {
      provider: "thesportsdb",
      enabled: Boolean(sportsDbKey),
      keyName: "THESPORTSDB_API_KEY",
      execute: async () => {
        const url =
          `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(sportsDbKey)}/lookuptable.php?l=${config.theSportsDbLeagueId}` +
          (season ? `&s=${encodeURIComponent(season)}` : "");
        const raw = await requestJson({ provider: "thesportsdb", url });
        return normalizeSportsDbStandings(raw?.table || [], limit);
      },
    },
    fallback: {
      provider: "espn",
      enabled: true,
      execute: async () => {
        const raw = await requestJson({
          provider: "espn",
          url: `https://site.api.espn.com/apis/site/v2/sports/${config.espnPath}/standings`,
        });
        return normalizeEspnStandings(raw, limit);
      },
    },
  });

  return {
    standings: resolved.data,
    provider: resolved.provider,
    fallbackUsed: resolved.fallbackUsed,
  };
}

async function resolveSchedule(config, teamQuery, query) {
  const limit = parsePositiveInt(query.limit, 25, 1, 100);
  const date = String(query.date || "").trim();
  const sportsDbKey = String(process.env.THESPORTSDB_API_KEY || "").trim();

  const resolved = await withProviderFallback({
    primary: {
      provider: "thesportsdb",
      enabled: Boolean(sportsDbKey),
      keyName: "THESPORTSDB_API_KEY",
      execute: async () => {
        const raw = await requestJson({
          provider: "thesportsdb",
          url:
            `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(sportsDbKey)}/searchevents.php?e=${encodeURIComponent(teamQuery)}`,
        });
        const events = normalizeSportsDbEvents(raw?.event || [], limit).filter((event) =>
          date ? String(event.startTime || "").startsWith(date) : true,
        );
        return events;
      },
    },
    fallback: {
      provider: "espn",
      enabled: true,
      execute: async () => {
        const raw = await requestJson({
          provider: "espn",
          url: `https://site.api.espn.com/apis/site/v2/sports/${config.espnPath}/scoreboard`,
        });
        const normalized = normalizeEspnEvents(raw?.events || [], 250).filter((event) => {
          const combined = `${event.homeTeam || ""} ${event.awayTeam || ""}`.toLowerCase();
          return combined.includes(teamQuery.toLowerCase());
        });
        return normalized.slice(0, limit);
      },
    },
  });

  return {
    games: resolved.data,
    provider: resolved.provider,
    fallbackUsed: resolved.fallbackUsed,
  };
}

async function resolveOdds(config, query) {
  const regions = String(query.regions || "us").trim();
  const markets = String(query.markets || "h2h,spreads,totals").trim();
  const oddsFormat = String(query.oddsFormat || "american").trim();
  const dateFormat = String(query.dateFormat || "iso").trim();
  const limit = parsePositiveInt(query.limit, 50, 1, 100);
  const oddsApiKey = String(process.env.THE_ODDS_API_KEY || "").trim();
  const apiSportsKey = String(process.env.API_SPORTS_API_KEY || "").trim();

  const resolved = await withProviderFallback({
    primary: {
      provider: "the-odds-api",
      enabled: Boolean(oddsApiKey),
      keyName: "THE_ODDS_API_KEY",
      execute: async () => {
        const raw = await requestJson({
          provider: "the-odds-api",
          url:
            `https://api.the-odds-api.com/v4/sports/${config.oddsKey}/odds/?apiKey=${encodeURIComponent(oddsApiKey)}` +
            `&regions=${encodeURIComponent(regions)}&markets=${encodeURIComponent(markets)}` +
            `&oddsFormat=${encodeURIComponent(oddsFormat)}&dateFormat=${encodeURIComponent(dateFormat)}`,
        });
        return normalizeOddsEvents(raw, limit);
      },
    },
    fallback: {
      provider: "api-sports",
      enabled: Boolean(apiSportsKey),
      execute: async () => {
        const raw = await requestJson({
          provider: "api-sports",
          url:
            `https://v3.${config.apiSportsSport}.api-sports.io/odds?league=${encodeURIComponent(config.apiSportsLeagueId)}&season=${new Date().getFullYear()}`,
          headers: {
            "x-apisports-key": apiSportsKey,
          },
        });
        return normalizeApiSportsOdds(raw, limit);
      },
    },
  });

  return {
    events: resolved.data,
    provider: resolved.provider,
    fallbackUsed: resolved.fallbackUsed,
  };
}

router.get("/api/sports/scores/:sport", async (req, res) => {
  try {
    const sport = normalizeSportSlug(req.params.sport);
    const config = ensureSport(sport);
    const resolved = await resolveScores(config, req.query);
    res.json({
      success: true,
      data: {
        sport,
        date: req.query.date ?? null,
        count: resolved.events.length,
        games: resolved.events,
        provider: resolved.provider,
        fallbackUsed: resolved.fallbackUsed,
        providerRisk: resolved.provider === "espn" ? "unofficial-fallback" : null,
      },
      source:
        resolved.provider === "espn"
          ? "ESPN Site API (fallback, unofficial)"
          : "TheSportsDB API",
    });
  } catch (error) {
    sendNormalizedError(res, error);
  }
});

router.get("/api/sports/standings/:sport", async (req, res) => {
  try {
    const sport = normalizeSportSlug(req.params.sport);
    const config = ensureSport(sport);
    const resolved = await resolveStandings(config, req.query);
    res.json({
      success: true,
      data: {
        sport,
        season: req.query.season ?? null,
        count: resolved.standings.length,
        standings: resolved.standings,
        provider: resolved.provider,
        fallbackUsed: resolved.fallbackUsed,
        providerRisk: resolved.provider === "espn" ? "unofficial-fallback" : null,
      },
      source:
        resolved.provider === "espn"
          ? "ESPN Site API (fallback, unofficial)"
          : "TheSportsDB API",
    });
  } catch (error) {
    sendNormalizedError(res, error);
  }
});

router.get("/api/sports/schedule/:team", async (req, res) => {
  try {
    const sport = normalizeSportSlug(req.query.sport || "nfl");
    const config = ensureSport(sport);
    const teamQuery = String(req.params.team || "").trim();
    if (!teamQuery) {
      return res.status(400).json({ success: false, error: "team is required" });
    }

    const resolved = await resolveSchedule(config, teamQuery, req.query);
    res.json({
      success: true,
      data: {
        teamQuery,
        sport,
        count: resolved.games.length,
        games: resolved.games,
        provider: resolved.provider,
        fallbackUsed: resolved.fallbackUsed,
        providerRisk: resolved.provider === "espn" ? "unofficial-fallback" : null,
      },
      source:
        resolved.provider === "espn"
          ? "ESPN Site API (fallback, unofficial)"
          : "TheSportsDB API",
    });
  } catch (error) {
    sendNormalizedError(res, error);
  }
});

router.get("/api/sports/odds/:sport", async (req, res) => {
  try {
    const sport = normalizeSportSlug(req.params.sport);
    const config = ensureSport(sport);
    const resolved = await resolveOdds(config, req.query);
    res.json({
      success: true,
      data: {
        sport,
        eventCount: resolved.events.length,
        events: resolved.events,
        provider: resolved.provider,
        fallbackUsed: resolved.fallbackUsed,
      },
      source: resolved.provider === "api-sports" ? "API-Sports Odds API" : "The Odds API",
    });
  } catch (error) {
    sendNormalizedError(res, error);
  }
});

router.normalizeSportSlug = normalizeSportSlug;
router.getSportConfig = getSportConfig;
router.parsePositiveInt = parsePositiveInt;
router.normalizeSportsDbEvents = normalizeSportsDbEvents;
router.normalizeEspnEvents = normalizeEspnEvents;
router.normalizeOddsEvents = normalizeOddsEvents;
router.normalizeApiSportsOdds = normalizeApiSportsOdds;

module.exports = router;
