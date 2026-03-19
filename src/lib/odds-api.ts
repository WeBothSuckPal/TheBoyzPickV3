import { leagueProviders } from "@/lib/constants";
import { requireOddsApiKey } from "@/lib/env";
import type { GameStatus, LeagueSlug } from "@/lib/types";

interface OddsApiOutcome {
  name: string;
  price: number;
  point?: number;
}

interface OddsApiMarket {
  key: string;
  outcomes: OddsApiOutcome[];
}

interface OddsApiBookmaker {
  key: string;
  title: string;
  markets: OddsApiMarket[];
}

interface OddsApiEvent {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: OddsApiBookmaker[];
  completed?: boolean;
  scores?: Array<{
    name: string;
    score: string;
  }>;
}

export interface OddsSyncEvent {
  externalId: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  outcomes: Array<{
    team: string;
    side: "home" | "away" | "over" | "under";
    spread: number;
    americanOdds: number;
    market: "h2h" | "spreads" | "totals";
    bookmaker: string;
    quoteTimestamp: string;
  }>;
}

export interface ScoreSyncEvent {
  externalId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  status: GameStatus;
  completed: boolean;
}

function getBaseUrl() {
  return "https://api.the-odds-api.com/v4";
}

function getSportKey(league: LeagueSlug) {
  return leagueProviders[league].sportKey;
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Odds API request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

function parseScore(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeOddsEvent(
  event: OddsApiEvent,
  bookmaker: string,
  observedAt = new Date(),
): OddsSyncEvent | null {
  const bk = event.bookmakers?.find((b) => b.key === bookmaker) ?? event.bookmakers?.[0];
  const bkMarkets = bk?.markets ?? [];
  const timestamp = observedAt.toISOString();
  const outcomes: OddsSyncEvent["outcomes"] = [];

  const spreadMarket = bkMarkets.find((m) => m.key === "spreads");
  if (spreadMarket) {
    for (const o of spreadMarket.outcomes) {
      if (typeof o.point === "number") {
        outcomes.push({
          team: o.name,
          side: o.name === event.home_team ? "home" : "away",
          spread: o.point,
          americanOdds: o.price,
          market: "spreads",
          bookmaker,
          quoteTimestamp: timestamp,
        });
      }
    }
  }

  const h2hMarket = bkMarkets.find((m) => m.key === "h2h");
  if (h2hMarket) {
    for (const o of h2hMarket.outcomes) {
      outcomes.push({
        team: o.name,
        side: o.name === event.home_team ? "home" : "away",
        spread: 0,
        americanOdds: o.price,
        market: "h2h",
        bookmaker,
        quoteTimestamp: timestamp,
      });
    }
  }

  const totalsMarket = bkMarkets.find((m) => m.key === "totals");
  if (totalsMarket) {
    for (const o of totalsMarket.outcomes) {
      if (typeof o.point === "number") {
        outcomes.push({
          team: o.name,
          side: o.name.toLowerCase() as "over" | "under",
          spread: o.point,
          americanOdds: o.price,
          market: "totals",
          bookmaker,
          quoteTimestamp: timestamp,
        });
      }
    }
  }

  if (outcomes.length === 0) {
    return null;
  }

  return {
    externalId: event.id,
    commenceTime: event.commence_time,
    homeTeam: event.home_team,
    awayTeam: event.away_team,
    outcomes,
  };
}

export function normalizeScoreEvent(
  event: OddsApiEvent,
  observedAt = new Date(),
): ScoreSyncEvent {
  const homeScore = parseScore(
    event.scores?.find((score) => score.name === event.home_team)?.score,
  );
  const awayScore = parseScore(
    event.scores?.find((score) => score.name === event.away_team)?.score,
  );
  const hasScores = typeof homeScore === "number" && typeof awayScore === "number";
  const commenceTime = new Date(event.commence_time);

  let status: GameStatus;
  if (event.completed && hasScores) {
    status = "final";
  } else if (event.completed) {
    status = "cancelled";
  } else if (commenceTime > observedAt) {
    status = "scheduled";
  } else if (hasScores) {
    status = "in_progress";
  } else if (observedAt.getTime() - commenceTime.getTime() > 6 * 60 * 60 * 1000) {
    status = "postponed";
  } else {
    status = "in_progress";
  }

  return {
    externalId: event.id,
    homeTeam: event.home_team,
    awayTeam: event.away_team,
    homeScore,
    awayScore,
    completed: Boolean(event.completed),
    status,
  };
}

export async function fetchLeagueOdds(
  league: LeagueSlug,
  bookmaker: string,
): Promise<OddsSyncEvent[]> {
  const apiKey = requireOddsApiKey();
  const params = new URLSearchParams({
    apiKey,
    regions: "us",
    markets: "h2h,spreads,totals",
    bookmakers: bookmaker,
    oddsFormat: "american",
    dateFormat: "iso",
  });

  const events = await fetchJson<OddsApiEvent[]>(
    `${getBaseUrl()}/sports/${getSportKey(league)}/odds?${params.toString()}`,
  );

  return events
    .map((event) => normalizeOddsEvent(event, bookmaker))
    .filter((event): event is OddsSyncEvent => Boolean(event));
}

export async function fetchLeagueScores(league: LeagueSlug): Promise<ScoreSyncEvent[]> {
  const apiKey = requireOddsApiKey();
  const params = new URLSearchParams({
    apiKey,
    daysFrom: "3",
    dateFormat: "iso",
  });

  const events = await fetchJson<OddsApiEvent[]>(
    `${getBaseUrl()}/sports/${getSportKey(league)}/scores?${params.toString()}`,
  );

  const observedAt = new Date();
  return events.map((event) => normalizeScoreEvent(event, observedAt));
}
