import { getEnhancedLeaderboards } from "@/lib/clubhouse";
import { LeaderboardTabs } from "./leaderboard-tabs";

export const dynamic = "force-dynamic";

export default async function LeaderboardsPage() {
  const { leaderboards, rivalryBoard } = await getEnhancedLeaderboards();

  return <LeaderboardTabs leaderboards={leaderboards} rivalryBoard={rivalryBoard} />;
}
