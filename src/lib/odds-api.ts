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
    side: "home" | "away";
    spread: number;
    americanOdds: number;
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
  const spreadMarket = event.bookmakers?.[0]?.markets?.find(
    (market) => market.key === "spreads",
  );

  if (!spreadMarket) {
    return null;
  }

  const outcomes = spreadMarket.outcomes
    .filter((outcome) => typeof outcome.point === "number")
    .map((outcome) => ({
      team: outcome.name,
      side: outcome.name === event.home_team ? ("home" as const) : ("away" as const),
      spread: Number(outcome.point ?? 0),
      americanOdds: outcome.price,
      bookmaker,
      quoteTimestamp: observedAt.toISOString(),
    }));

  if (outcomes.length < 2) {
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
    markets: "spreads",
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
