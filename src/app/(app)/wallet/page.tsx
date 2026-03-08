import { approveTopUpAction, submitTopUpRequestAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAdminSnapshot, getMemberSnapshot } from "@/lib/clubhouse";
import { requireViewer } from "@/lib/auth";
import { formatCompactDate, formatCurrency, toTitleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const viewer = await requireViewer();
  const snapshot = await getMemberSnapshot(viewer);
  const admin = viewer.role === "owner_admin" ? await getAdminSnapshot() : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Wallet balance</CardTitle>
            <CardDescription>All bankroll changes are backed by append-only ledger entries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[28px] border border-[var(--accent)]/25 bg-[var(--accent)]/10 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
                Available balance
              </div>
              <div className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold text-white">
                {formatCurrency(snapshot.wallet.balanceCents)}
              </div>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-black/18 p-4 text-sm leading-7 text-[var(--muted-foreground)]">
              {snapshot.settings.bankrollInstructions}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request bankroll top-up</CardTitle>
            <CardDescription>
              Submit a request after sending payment to the commissioner.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={submitTopUpRequestAction} className="space-y-3">
              <Input name="amount" type="number" min={5} max={500} placeholder="Amount in dollars" />
              <Input name="note" placeholder="Optional note for the commissioner" />
              <Button type="submit" className="w-full">
                Submit request
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top-up requests</CardTitle>
            <CardDescription>Your bankroll reload history.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.topUps.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between rounded-3xl border border-white/10 bg-black/18 px-4 py-3"
              >
                <div>
                  <div className="font-semibold text-white">{formatCurrency(request.amountCents)}</div>
                  <div className="text-sm text-[var(--muted-foreground)]">
                    {formatCompactDate(request.requestedAt)}
                  </div>
                </div>
                <Badge>{request.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ledger history</CardTitle>
            <CardDescription>Full wallet movement history for your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.wallet.ledger.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-3xl border border-white/10 bg-black/18 px-4 py-3"
              >
                <div>
                  <div className="font-semibold text-white">{toTitleCase(entry.type)}</div>
                  <div className="text-sm text-[var(--muted-foreground)]">{entry.note}</div>
                </div>
                <div className="text-right">
                  <div className={`font-semibold ${entry.amountCents >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {entry.amountCents >= 0 ? "+" : ""}
                    {formatCurrency(entry.amountCents)}
                  </div>
                  <div className="text-sm text-[var(--muted-foreground)]">
                    Bal. {formatCurrency(entry.balanceAfterCents)}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {admin ? (
          <Card>
            <CardHeader>
              <CardTitle>Pending approvals</CardTitle>
              <CardDescription>Quick commissioner queue for bankroll requests.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {admin.pendingTopUps.map((request) => (
                <form
                  key={request.id}
                  action={approveTopUpAction}
                  className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-black/18 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <input type="hidden" name="requestId" value={request.id} />
                  <div>
                    <div className="font-semibold text-white">{formatCurrency(request.amountCents)}</div>
                    <div className="text-sm text-[var(--muted-foreground)]">
                      {formatCompactDate(request.requestedAt)}
                    </div>
                  </div>
                  <Button type="submit" size="sm">
                    Approve
                  </Button>
                </form>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
