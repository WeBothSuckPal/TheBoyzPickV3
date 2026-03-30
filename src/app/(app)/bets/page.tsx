import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth";
import { getComments, getMemberSnapshot, getReactionSummaries } from "@/lib/clubhouse";
import { appName } from "@/lib/constants";
import { BetTabs } from "./bet-tabs";

export const metadata: Metadata = {
  title: `My Bets | ${appName}`,
};

export const dynamic = "force-dynamic";

export default async function BetsPage() {
  const viewer = await requireViewer();
  const snapshot = await getMemberSnapshot(viewer);
  const socialEnabled = snapshot.mode === "live";
  const slipIds = snapshot.slips.map((slip) => slip.id);

  const [slipReactions, slipComments] = socialEnabled
    ? await Promise.all([
        getReactionSummaries(viewer.id, "slip", slipIds),
        getComments("slip", slipIds),
      ])
    : [new Map(), new Map()];

  const slips = snapshot.slips.map((slip) => ({
    ...slip,
    reactions: slipReactions.get(slip.id) ?? [],
    comments: slipComments.get(slip.id) ?? [],
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>My Bets</CardTitle>
          <CardDescription>
            Full history of your pending and settled slips, with reactions and comments in live mode.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BetTabs slips={slips} socialEnabled={socialEnabled} viewerUserId={viewer.id} />
        </CardContent>
      </Card>
    </div>
  );
}
