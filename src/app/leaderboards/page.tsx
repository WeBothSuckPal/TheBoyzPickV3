import { getClubStats, getEnhancedLeaderboards } from "@/lib/clubhouse";
import { LeaderboardTabs } from "./leaderboard-tabs";

export const dynamic = "force-dynamic";

export default async function LeaderboardsPage() {
  const [{ leaderboards, rivalryBoard }, clubStats] = await Promise.all([
    getEnhancedLeaderboards(),
    getClubStats(),
  ]);

  return <LeaderboardTabs leaderboards={leaderboards} rivalryBoard={rivalryBoard} clubStats={clubStats} />;
}
