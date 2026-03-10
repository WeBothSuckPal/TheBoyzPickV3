import type { AppSettings } from "@/lib/types";

export const appName = "Clubhouse Lines";
export const defaultStartingBalanceCents = 15000;

export const leagueProviders = {
  NFL: { sportKey: "americanfootball_nfl", label: "NFL", sortOrder: 1 },
  NBA: { sportKey: "basketball_nba", label: "NBA", sortOrder: 2 },
  MLB: { sportKey: "baseball_mlb", label: "MLB", sortOrder: 3 },
  NHL: { sportKey: "icehockey_nhl", label: "NHL", sortOrder: 4 },
  NCAAF: {
    sportKey: "americanfootball_ncaaf",
    label: "NCAAF",
    sortOrder: 5,
  },
  NCAAB: {
    sportKey: "basketball_ncaab",
    label: "NCAAB",
    sortOrder: 6,
  },
  WNBA: { sportKey: "basketball_wnba", label: "WNBA", sortOrder: 7 },
} as const;

export const defaultSettings: AppSettings = {
  enabledLeagues: ["NFL", "NCAAF"],
  primaryBookmaker: process.env.PRIMARY_BOOKMAKER ?? "draftkings",
  minStakeCents: 500,
  maxStakeCents: 20000,
  maxOpenSlipsPerUser: 15,
  bankrollInstructions:
    process.env.BANKROLL_PAYMENT_INSTRUCTIONS ??
    "Send payment to the commissioner and request approval here once sent.",
  maintenanceMode: false,
};
