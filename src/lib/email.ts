import { Resend } from "resend";

import { getEmailFrom, getResendApiKey } from "@/lib/env";
import { formatCurrency, formatOdds, formatSpread } from "@/lib/utils";
import type { BetLegResult, BetSlipStatus, BetSlipType } from "@/lib/types";
import { isDatabaseConfigured } from "@/lib/env";

/** Redact email to prevent PII leaking into production logs. */
function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***";
  return `${local[0]}***@${domain}`;
}

/** Per-execution dedup — prevents the same recipient getting multiple emails in one cron run. */
const emailedThisRun = new Set<string>();

function shouldThrottle(email: string): boolean {
  if (emailedThisRun.has(email)) return true;
  emailedThisRun.add(email);
  return false;
}

/** Best-effort persistence of failed email for later retry. */
/** Best-effort persistence of failed email for later retry. */
async function persistEmailFailure(
  recipientEmail: string,
  emailType: string,
  payload: Record<string, unknown>,
  err: unknown,
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const { getDb } = await import("@/lib/db/client");
    const { failedEmails } = await import("@/lib/db/schema");
    const db = getDb();
    if (!db) return;
    await db.insert(failedEmails).values({
      recipientEmail,
      emailType,
      payload,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });
  } catch {
    // Don't let logging failure break the email loop
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface SettledSlipEmailLeg {
  selectionTeam: string;
  spread: number;
  americanOdds: number;
  result: BetLegResult;
}

export interface SettledSlipRecord {
  userId: string;
  userEmail: string;
  userDisplayName: string;
  slipId: string;
  slipType: BetSlipType;
  status: Exclude<BetSlipStatus, "open">;
  stakeCents: number;
  payoutCents: number;
  legs: SettledSlipEmailLeg[];
}

function resultColor(status: Exclude<BetSlipStatus, "open">) {
  if (status === "won") return "#22c55e";
  if (status === "lost") return "#ef4444";
  return "#eab308";
}

function resultLabel(status: Exclude<BetSlipStatus, "open">) {
  if (status === "won") return "WON";
  if (status === "lost") return "LOST";
  if (status === "push") return "PUSH";
  return "VOID";
}

function legResultLabel(result: BetLegResult) {
  if (result === "win") return "WIN";
  if (result === "loss") return "LOSS";
  if (result === "push") return "PUSH";
  if (result === "void") return "VOID";
  return "PENDING";
}

function buildEmailHtml(record: SettledSlipRecord): string {
  const color = resultColor(record.status);
  const label = resultLabel(record.status);
  const slipLabel =
    record.slipType === "straight"
      ? "Straight bet"
      : `${record.legs.length}-leg parlay`;

  const legsRows = record.legs
    .map(
      (leg) => `
      <tr>
        <td style="padding:8px 12px;font-size:13px;color:#e5e7eb;">${leg.selectionTeam}</td>
        <td style="padding:8px 12px;font-size:13px;color:#9ca3af;font-family:monospace;">${formatSpread(leg.spread)} | ${formatOdds(leg.americanOdds)}</td>
        <td style="padding:8px 12px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;">${legResultLabel(leg.result)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.18em;color:#6b7280;margin-bottom:6px;">Clubhouse Lines</div>
              <div style="font-size:22px;font-weight:700;color:#fff;">Slip settled</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:14px;color:#9ca3af;">Hey ${escapeHtml(record.userDisplayName)},</div>
                    <div style="margin-top:8px;font-size:14px;color:#d1d5db;">Your <strong style="color:#fff;">${slipLabel}</strong> has been graded.</div>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <div style="display:inline-block;background:${color}22;border:1px solid ${color}55;border-radius:8px;padding:6px 14px;font-size:13px;font-weight:700;color:${color};letter-spacing:0.1em;">${label}</div>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.07);">
                <thead>
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                    <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#6b7280;font-weight:500;">Selection</th>
                    <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#6b7280;font-weight:500;">Line</th>
                    <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#6b7280;font-weight:500;">Result</th>
                  </tr>
                </thead>
                <tbody>${legsRows}</tbody>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                <tr>
                  <td width="50%" style="padding-right:8px;">
                    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:14px 16px;">
                      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:#6b7280;">Stake</div>
                      <div style="margin-top:4px;font-size:16px;font-weight:600;color:#fff;">${formatCurrency(record.stakeCents)}</div>
                    </div>
                  </td>
                  <td width="50%" style="padding-left:8px;">
                    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:14px 16px;">
                      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:#6b7280;">Settled</div>
                      <div style="margin-top:4px;font-size:16px;font-weight:600;color:${record.payoutCents > 0 ? "#22c55e" : "#e5e7eb"};">${formatCurrency(record.payoutCents)}</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:12px;color:#4b5563;">You're receiving this because you placed a bet on Clubhouse Lines.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// --- Daily Game Digest ---

export interface DigestGame {
  league: string;
  matchup: string;
  commenceTime: string;
  spreads: { team: string; spread: number; americanOdds: number }[];
}

function buildDigestEmailHtml(displayName: string, games: DigestGame[]): string {
  const byLeague = new Map<string, DigestGame[]>();
  for (const game of games) {
    const list = byLeague.get(game.league) ?? [];
    list.push(game);
    byLeague.set(game.league, list);
  }

  let leagueSections = "";
  for (const [league, leagueGames] of byLeague) {
    const gameRows = leagueGames
      .map((game) => {
        const spreadCells = game.spreads
          .map(
            (s) =>
              `<td style="padding:6px 12px;font-size:13px;color:#e5e7eb;">${s.team}</td>
               <td style="padding:6px 12px;font-size:13px;color:#9ca3af;font-family:monospace;">${formatSpread(s.spread)} | ${formatOdds(s.americanOdds)}</td>`,
          )
          .join("</tr><tr>");
        return `<tr>
          <td colspan="2" style="padding:10px 12px 4px;font-size:14px;font-weight:600;color:#fff;">${game.matchup}</td>
        </tr>
        <tr>${spreadCells}</tr>`;
      })
      .join("");

    leagueSections += `
      <div style="margin-top:16px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.18em;color:#CC2936;font-weight:600;padding:0 12px;">${league}</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.07);">
          <tbody>${gameRows}</tbody>
        </table>
      </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.18em;color:#6b7280;margin-bottom:6px;">Clubhouse Lines</div>
              <div style="font-size:22px;font-weight:700;color:#fff;">Today&rsquo;s card is live</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;">
              <div style="font-size:14px;color:#9ca3af;">Hey ${escapeHtml(displayName)},</div>
              <div style="margin-top:8px;font-size:14px;color:#d1d5db;"><strong style="color:#fff;">${games.length} game${games.length !== 1 ? "s" : ""}</strong> on the board today. Check the spreads and lock in your picks.</div>
              ${leagueSections}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:12px;color:#4b5563;">You're receiving this because you're a member of Clubhouse Lines.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendDailyGameDigest(
  members: { email: string; displayName: string }[],
  games: DigestGame[],
): Promise<number> {
  const apiKey = getResendApiKey();
  if (!apiKey || members.length === 0 || games.length === 0) {
    return 0;
  }

  const resend = new Resend(apiKey);
  const from = getEmailFrom();
  const subject = `Today's card is live — ${games.length} game${games.length !== 1 ? "s" : ""} on the board`;
  let sent = 0;

  for (const member of members) {
    if (shouldThrottle(member.email)) continue;
    try {
      await resend.emails.send({
        from,
        to: member.email,
        subject,
        html: buildDigestEmailHtml(member.displayName, games),
      });
      sent++;
    } catch (err) {
      console.error("[email] Failed to send daily digest to", redactEmail(member.email), err);
      await persistEmailFailure(member.email, "digest", { displayName: member.displayName, gameCount: games.length }, err);
    }
  }

  return sent;
}

// --- Odds Shift Alert ---

export interface OddsShift {
  matchup: string;
  team: string;
  oldSpread: number;
  newSpread: number;
  oldOdds: number;
  newOdds: number;
}

function buildOddsShiftEmailHtml(displayName: string, shifts: OddsShift[]): string {
  const shiftRows = shifts
    .map(
      (s) => `
      <tr>
        <td style="padding:8px 12px;font-size:13px;color:#e5e7eb;">${s.team}</td>
        <td style="padding:8px 12px;font-size:13px;color:#9ca3af;font-family:monospace;">${formatSpread(s.oldSpread)} → ${formatSpread(s.newSpread)}</td>
        <td style="padding:8px 12px;font-size:13px;color:#9ca3af;font-family:monospace;">${formatOdds(s.oldOdds)} → ${formatOdds(s.newOdds)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.18em;color:#6b7280;margin-bottom:6px;">Clubhouse Lines</div>
              <div style="font-size:22px;font-weight:700;color:#fff;">Line movement alert</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;">
              <div style="font-size:14px;color:#9ca3af;">Hey ${escapeHtml(displayName)},</div>
              <div style="margin-top:8px;font-size:14px;color:#d1d5db;"><strong style="color:#eab308;">${shifts.length}</strong> of your open picks had significant line movement.</div>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.07);">
                <thead>
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                    <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#6b7280;font-weight:500;">Selection</th>
                    <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#6b7280;font-weight:500;">Spread</th>
                    <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#6b7280;font-weight:500;">Odds</th>
                  </tr>
                </thead>
                <tbody>${shiftRows}</tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:12px;color:#4b5563;">You're receiving this because you have open bets on Clubhouse Lines.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendOddsShiftAlerts(
  affectedUsers: { email: string; displayName: string; shifts: OddsShift[] }[],
): Promise<number> {
  const apiKey = getResendApiKey();
  if (!apiKey || affectedUsers.length === 0) {
    return 0;
  }

  const resend = new Resend(apiKey);
  const from = getEmailFrom();
  let sent = 0;

  for (const user of affectedUsers) {
    if (user.shifts.length === 0) continue;
    if (shouldThrottle(user.email)) continue;
    try {
      const subject = `Line movement alert — ${user.shifts.length} of your picks shifted`;
      await resend.emails.send({
        from,
        to: user.email,
        subject,
        html: buildOddsShiftEmailHtml(user.displayName, user.shifts),
      });
      sent++;
    } catch (err) {
      console.error("[email] Failed to send odds shift alert to", redactEmail(user.email), err);
      await persistEmailFailure(user.email, "odds_shift", { displayName: user.displayName, shiftCount: user.shifts.length }, err);
    }
  }

  return sent;
}

export async function sendSettlementEmails(records: SettledSlipRecord[]): Promise<void> {
  const apiKey = getResendApiKey();
  if (!apiKey || records.length === 0) {
    return;
  }

  const resend = new Resend(apiKey);
  const from = getEmailFrom();

  // Group by userId so one email per user even if multiple slips settle
  const byUser = new Map<string, SettledSlipRecord[]>();
  for (const record of records) {
    const existing = byUser.get(record.userId) ?? [];
    existing.push(record);
    byUser.set(record.userId, existing);
  }

  for (const [, userRecords] of byUser) {
    const first = userRecords[0]!;
    try {
      if (userRecords.length === 1) {
        const subject = `Your slip ${resultLabel(first.status).toLowerCase()} — Clubhouse Lines`;
        await resend.emails.send({
          from,
          to: first.userEmail,
          subject,
          html: buildEmailHtml(first),
        });
      } else {
        // Multiple slips settled: send one email per slip (keep it simple)
        for (const record of userRecords) {
          const subject = `Your slip ${resultLabel(record.status).toLowerCase()} — Clubhouse Lines`;
          await resend.emails.send({
            from,
            to: record.userEmail,
            subject,
            html: buildEmailHtml(record),
          });
        }
      }
    } catch (err) {
      console.error("[email] Failed to send settlement email to", redactEmail(first.userEmail), err);
      await persistEmailFailure(first.userEmail, "settlement", { userId: first.userId, slipCount: userRecords.length }, err);
    }
  }
}
