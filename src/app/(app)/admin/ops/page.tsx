import { Activity, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { getOpsHealth } from "@/lib/clubhouse";
import { relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "critical")
    return <Badge className="bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/30">{severity}</Badge>;
  if (severity === "warning")
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">{severity}</Badge>;
  return <Badge className="bg-white/10 text-[var(--muted-foreground)] border-white/10">{severity}</Badge>;
}

export default async function AdminOpsPage() {
  await requireAdmin();
  const ops = await getOpsHealth();

  return (
    <div className="grid gap-6">
      {/* Cron Job Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5" />
            Cron Jobs
          </CardTitle>
          <CardDescription>Last run time and outcome for each scheduled job.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {ops.cronJobs.map((job) => (
              <div
                key={job.action}
                className="rounded-2xl border border-white/10 bg-black/15 px-4 py-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{job.label}</span>
                  {job.outcome === null ? (
                    <Clock className="size-4 text-[var(--muted-foreground)]" />
                  ) : job.outcome === "success" ? (
                    <CheckCircle className="size-4 text-green-400" />
                  ) : (
                    <XCircle className="size-4 text-[var(--accent)]" />
                  )}
                </div>
                <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                  {job.lastRunAt ? relativeTime(job.lastRunAt) : "Never run"}
                </div>
                {job.outcome && (
                  <div className={`mt-1 text-xs font-mono ${job.outcome === "success" ? "text-green-400" : "text-[var(--accent)]"}`}>
                    {job.outcome}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Health Reports */}
      {(ops.latestHourlyReport || ops.latestNightlyReport) && (
        <div className="grid gap-6 sm:grid-cols-2">
          {[
            { label: "Hourly Report", report: ops.latestHourlyReport },
            { label: "Nightly Report", report: ops.latestNightlyReport },
          ].map(({ label, report }) =>
            report ? (
              <Card key={label}>
                <CardHeader>
                  <CardTitle className="text-base">{label}</CardTitle>
                  <CardDescription>{relativeTime(report.createdAt)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-white">{report.score}</span>
                    <span className="text-sm text-[var(--muted-foreground)]">/ 100 health score</span>
                  </div>
                  <p className="text-sm text-[var(--muted-foreground)]">{report.summary}</p>
                  {(report.findings as string[]).length > 0 && (
                    <details className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                      <summary className="cursor-pointer text-sm font-semibold text-white">
                        {(report.findings as string[]).length} finding(s)
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {(report.findings as string[]).map((f, i) => (
                          <li key={i} className="text-xs text-[var(--muted-foreground)]">• {String(f)}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </CardContent>
              </Card>
            ) : null,
          )}
        </div>
      )}

      {/* Anomaly Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5" />
            Active Anomaly Alerts
          </CardTitle>
          <CardDescription>Unresolved alerts from the AI ops autopilot.</CardDescription>
        </CardHeader>
        <CardContent>
          {ops.anomalyAlerts.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No active anomaly alerts.</p>
          ) : (
            <div className="space-y-3">
              {ops.anomalyAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={alert.severity} />
                    <span className="text-sm font-semibold text-white">{alert.title}</span>
                    <span className="ml-auto text-xs text-[var(--muted-foreground)]">{relativeTime(alert.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">{alert.detail}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]/60">{alert.category}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
