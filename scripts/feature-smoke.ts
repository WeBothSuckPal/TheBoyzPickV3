import {
  approveTopUp,
  getAdminSnapshot,
  getMemberSnapshot,
  placeSlip,
  requestTopUp,
  runOddsSync,
  runSettlementSweep,
  saveLockPick,
  syncViewer,
} from "@/lib/clubhouse";

async function main() {
  const viewer = await syncViewer({
    clerkUserId: "demo-admin",
    email: "commissioner@example.com",
    displayName: "Commissioner",
    role: "owner_admin",
  });

  const before = await getMemberSnapshot(viewer);
  const game = before.games[0];
  const selection = game?.options[0];

  const placedSlip = selection
    ? await placeSlip({
        userId: viewer.id,
        stakeCents: before.settings.minStakeCents,
        selectionIds: [selection.id],
      })
    : null;

  const topUp = await requestTopUp(viewer.id, 1200, "feature-smoke");
  await approveTopUp(viewer.id, topUp.id);

  const lockPick = selection ? await saveLockPick(viewer.id, selection.id) : null;
  const syncResult = await runOddsSync();
  const settleResult = await runSettlementSweep();

  const admin = await getAdminSnapshot();
  const after = await getMemberSnapshot(viewer);

  const summary = {
    viewerRole: viewer.role,
    gamesVisible: before.games.length,
    placedSlip: placedSlip
      ? {
          id: placedSlip.id,
          status: placedSlip.status,
          legs: placedSlip.legs.length,
        }
      : null,
    topUpPaid: true,
    lockPick: lockPick
      ? {
          id: lockPick.id,
          weekKey: lockPick.weekKey,
        }
      : null,
    syncResult,
    settleResult,
    walletDeltaCents: after.wallet.balanceCents - before.wallet.balanceCents,
    pendingTopUps: admin.pendingTopUps.length,
    auditItems: admin.audit.length,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
