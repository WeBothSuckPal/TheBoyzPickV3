import {
  runAiOpsAutopilotAction,
  runOddsSyncAction,
  runSettlementSweepAction,
  setMaintenanceModeAction,
  updateMemberAccessAction,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { getAdminSnapshot, getMemberSnapshot } from "@/lib/clubhouse";
import { formatCompactDate, formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const viewer = await requireAdmin();
  const snapshot = await getMemberSnapshot(viewer);
  const admin = await getAdminSnapshot();

  return (
    <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="grid gap-6">
        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Operations</CardTitle>
            <CardDescription>
              Run odds syncs, settlement sweeps, and inspect launch settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form action={runOddsSyncAction}>
              <Button type="submit" className="w-full">
                Run odds sync
              </Button>
            </form>
            <form action={runSettlementSweepAction}>
              <Button type="submit" variant="secondary" className="w-full">
                Run settlement sweep
              </Button>
            </form>
            <form action={runAiOpsAutopilotAction}>
              <input type="hidden" name="mode" value="hourly" />
              <Button type="submit" variant="secondary" className="w-full">
                Run AI autopilot (hourly)
              </Button>
            </form>
            <form action={runAiOpsAutopilotAction}>
              <input type="hidden" name="mode" value="nightly" />
              <Button type="submit" variant="secondary" className="w-full">
                Run AI autopilot (nightly)
              </Button>
            </form>
            {snapshot.mode === "live" ? (
              <form action={setMaintenanceModeAction}>
                <input
                  type="hidden"
                  name="enabled"
                  value={snapshot.settings.maintenanceMode ? "false" : "true"}
                />
                <Button type="submit" variant="secondary" className="w-full">
                  {snapshot.settings.maintenanceMode
                    ? "Disable maintenance mode"
                    : "Enable maintenance mode"}
                </Button>
              </form>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-black/18 px-4 py-3 text-sm text-[var(--muted-foreground)]">
                Maintenance and member-access controls activate once the app is connected to the live database.
              </div>
            )}
            <div className="rounded-[28px] border border-white/10 bg-black/18 p-4 text-sm leading-7 text-[var(--muted-foreground)]">
              <div>Primary bookmaker: {snapshot.settings.primaryBookmaker}</div>
              <div>
                Stakes: {formatCurrency(snapshot.settings.minStakeCents)} to{" "}
                {formatCurrency(snapshot.settings.maxStakeCents)}
              </div>
              <div>Max open slips: {snapshot.settings.maxOpenSlipsPerUser}</div>
              <div>Maintenance mode: {snapshot.settings.maintenanceMode ? "On" : "Off"}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>Private club roster. Approve new sign-ups or manage existing members.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {admin.members.map((member) => (
              <div
                key={member.id}
                className="rounded-3xl border border-white/10 bg-black/18 px-4 py-3"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold text-white">
                      {member.displayName}
                      {member.nickname ? (
                        <span className="ml-2 text-sm font-normal text-[var(--muted-foreground)]">
                          aka &ldquo;{member.nickname}&rdquo;
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm text-[var(--muted-foreground)]">{member.email}</div>
                  </div>
                  <div className="text-sm text-[var(--muted-foreground)]">
                    {member.role} | {member.status}
                  </div>
                </div>
                {snapshot.mode === "live" && member.id !== viewer.id ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={updateMemberAccessAction}>
                      <input type="hidden" name="targetUserId" value={member.id} />
                      <input
                        type="hidden"
                        name="role"
                        value={member.role === "owner_admin" ? "member" : "owner_admin"}
                      />
                      <Button type="submit" size="sm" variant="secondary">
                        {member.role === "owner_admin" ? "Demote" : "Promote"}
                      </Button>
                    </form>
                    <form action={updateMemberAccessAction}>
                      <input type="hidden" name="targetUserId" value={member.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={member.status === "active" ? "suspended" : "active"}
                      />
                      <Button type="submit" size="sm" variant="secondary">
                        {member.status === "active" ? "Suspend" : "Approve"}
                      </Button>
                    </form>
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>AI ops health</CardTitle>
            <CardDescription>
              Hourly and nightly reliability score plus applied remediations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {admin.opsHealthReport ? (
              <>
                <div className="rounded-[28px] border border-white/10 bg-black/18 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                    {admin.opsHealthReport.mode} run
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-white">
                    Score {admin.opsHealthReport.score}
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {admin.opsHealthReport.summary}
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                    {formatCompactDate(admin.opsHealthReport.createdAt)}
                  </div>
                </div>
                {admin.opsHealthReport.findings.map((finding) => (
                  <div
                    key={`${finding.code}:${finding.metric}`}
                    className="rounded-[24px] border border-white/10 bg-black/18 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-white">{finding.code}</div>
                      <Badge>{finding.severity}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {finding.message}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                      metric {finding.metric}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="rounded-[24px] border border-white/10 bg-black/18 p-4 text-sm text-[var(--muted-foreground)]">
                No AI ops health report yet. Run autopilot to generate one.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI anomaly alerts</CardTitle>
            <CardDescription>
              Collusion, abuse, and bankroll trajectory anomalies with explainable details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {admin.anomalyAlerts.length === 0 ? (
              <div className="rounded-[24px] border border-white/10 bg-black/18 p-4 text-sm text-[var(--muted-foreground)]">
                No active anomaly alerts.
              </div>
            ) : (
              admin.anomalyAlerts.map((alert) => (
                <div key={alert.id} className="rounded-[24px] border border-white/10 bg-black/18 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-white">{alert.title}</div>
                    <Badge>{alert.severity}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {alert.category} | {alert.detail}
                  </div>
                  {alert.userIds.length > 0 ? (
                    <div className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                      users: {alert.userIds.join(", ")}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending top-ups</CardTitle>
            <CardDescription>Use the wallet page for quick approvals as well.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {admin.pendingTopUps.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between rounded-[28px] border border-white/10 bg-black/18 p-4"
              >
                <div>
                  <div className="font-semibold text-white">{formatCurrency(request.amountCents)}</div>
                  <div className="text-sm text-[var(--muted-foreground)]">
                    {formatCompactDate(request.requestedAt)}
                  </div>
                </div>
                <div className="text-sm text-[var(--muted-foreground)]">{request.status}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit trail</CardTitle>
            <CardDescription>Recent commissioner and system activity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {admin.audit.map((item) => (
              <div
                key={item.id}
                className="rounded-[28px] border border-white/10 bg-black/18 p-4"
              >
                <div className="font-semibold text-white">{item.action}</div>
                <div className="text-sm text-[var(--muted-foreground)]">
                  {item.targetType} | {item.targetId}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                  {formatCompactDate(item.createdAt)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
