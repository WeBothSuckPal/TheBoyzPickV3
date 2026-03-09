import { Resend } from "resend";

import { getEmailFrom, getResendApiKey } from "@/lib/env";
import { formatCurrency, formatOdds, formatSpread } from "@/lib/utils";
import type { BetLegResult, BetSlipStatus, BetSlipType } from "@/lib/types";

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
                    <div style="font-size:14px;color:#9ca3af;">Hey ${record.userDisplayName},</div>
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
      console.error("[email] Failed to send settlement email to", first.userEmail, err);
    }
  }
}
