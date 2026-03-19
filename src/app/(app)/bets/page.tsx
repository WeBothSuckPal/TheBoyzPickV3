import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth";
import { getMemberSnapshot } from "@/lib/clubhouse";
import { appName } from "@/lib/constants";
import { BetTabs } from "./bet-tabs";

export const metadata: Metadata = {
  title: `My Bets | ${appName}`,
};

export const dynamic = "force-dynamic";

export default async function BetsPage() {
  const viewer = await requireViewer();
  const snapshot = await getMemberSnapshot(viewer);

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>My Bets</CardTitle>
          <CardDescription>
            Full history of your pending and settled slips — DraftKings style.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BetTabs slips={snapshot.slips} />
        </CardContent>
      </Card>
    </div>
  );
}
