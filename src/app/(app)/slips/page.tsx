import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth";
import { getMemberSnapshot } from "@/lib/clubhouse";
import { SlipBuilder } from "./slip-builder";

export const dynamic = "force-dynamic";

export default async function SlipsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const initialSelectionIds =
    typeof searchParams.selections === "string" ? searchParams.selections.split(",") : [];

  const viewer = await requireViewer();
  const snapshot = await getMemberSnapshot(viewer);
  const now = new Date();

  const availableGames = snapshot.games
    .filter((game) => game.status === "scheduled" && new Date(game.commenceTime) > now)
    .map((game) => ({
      id: game.id,
      league: game.league,
      matchup: game.matchup,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      commenceTime: game.commenceTime,
      options: game.options.map((option) => ({
        id: option.id,
        team: option.team,
        side: option.side,
        spread: option.spread,
        americanOdds: option.americanOdds,
        market: option.market,
        openingPoint: option.openingPoint,
        openingAmericanOdds: option.openingAmericanOdds,
      })),
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Build slip</CardTitle>
        <CardDescription>
          Tap a spread to add it to your slip. One side per game, up to four legs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SlipBuilder
          games={availableGames}
          walletBalanceCents={snapshot.wallet.balanceCents}
          minStakeCents={snapshot.settings.minStakeCents}
          maxStakeCents={snapshot.settings.maxStakeCents}
          initialSelectionIds={initialSelectionIds}
        />
      </CardContent>
    </Card>
  );
}
