import type {
  AdminAnomalyAlert,
  BetIntelligence,
  OpsFinding,
  OpsHealthReport,
  OpsRemediation,
  OpsSeverity,
} from "@/lib/types";

function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function standardDeviation(values: number[]) {
  if (values.length <= 1) {
    return 0;
  }

  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance =
    values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

function confidenceFromRisk(riskScore: number): BetIntelligence["confidenceBand"] {
  if (riskScore >= 65) {
    return "low";
  }

  if (riskScore >= 35) {
    return "medium";
  }

  return "high";
}

function severityWeight(severity: OpsSeverity) {
  if (severity === "critical") {
    return 30;
  }

  if (severity === "warning") {
    return 14;
  }

  return 4;
}

export function buildSpreadIntelligence(input: {
  currentSpread: number;
  currentOdds: number;
  history: Array<{ spread: number; capturedAt: string }>;
  commenceTime: string;
  now?: Date;
}): BetIntelligence {
  const now = input.now ?? new Date();
  const hoursToStart =
    (new Date(input.commenceTime).getTime() - now.getTime()) / (60 * 60 * 1000);
  const historicalSpreads = input.history.map((row) => row.spread);
  const referenceSpread =
    input.history.length > 0 ? input.history[0]!.spread : input.currentSpread;
  const lineMovement = round(input.currentSpread - referenceSpread);
  const volatility = round(standardDeviation([...historicalSpreads, input.currentSpread]));
  const riskTags: string[] = [];

  if (Math.abs(lineMovement) >= 0.75) {
    riskTags.push("line_shift");
  }

  if (volatility >= 0.8) {
    riskTags.push("volatile");
  }

  if (Math.abs(input.currentOdds) >= 130) {
    riskTags.push("heavy_juice");
  }

  if (Math.abs(input.currentSpread) <= 1.5) {
    riskTags.push("coin_flip");
  }

  if (hoursToStart <= 1) {
    riskTags.push("closing_soon");
  }

  const riskScore =
    Math.min(85, riskTags.length * 16) +
    Math.min(10, Math.round(Math.abs(lineMovement) * 5)) +
    Math.min(10, Math.round(volatility * 6));
  const confidenceBand = confidenceFromRisk(riskScore);

  const blurbParts: string[] = [];
  if (Math.abs(lineMovement) >= 0.25) {
    const direction = lineMovement > 0 ? "toward this side" : "against this side";
    blurbParts.push(`Line moved ${Math.abs(lineMovement).toFixed(2)} ${direction}`);
  } else {
    blurbParts.push("Line has stayed relatively stable");
  }

  if (volatility >= 0.8) {
    blurbParts.push(`high volatility (${volatility.toFixed(2)})`);
  } else {
    blurbParts.push(`low volatility (${volatility.toFixed(2)})`);
  }

  blurbParts.push(`confidence ${confidenceBand}`);

  return {
    riskTags,
    confidenceBand,
    lineMovement,
    volatility,
    blurb: blurbParts.join(", "),
  };
}

export function summarizeOpsHealth(input: {
  mode: OpsHealthReport["mode"];
  findings: OpsFinding[];
  remediations: OpsRemediation[];
  now?: Date;
}): Omit<OpsHealthReport, "id"> {
  const scorePenalty = input.findings.reduce(
    (total, finding) => total + severityWeight(finding.severity),
    0,
  );
  const score = Math.max(0, 100 - scorePenalty);

  const criticalCount = input.findings.filter(
    (finding) => finding.severity === "critical",
  ).length;
  const warningCount = input.findings.filter(
    (finding) => finding.severity === "warning",
  ).length;

  const summary =
    criticalCount > 0
      ? `${criticalCount} critical and ${warningCount} warning issues detected.`
      : warningCount > 0
        ? `${warningCount} warning issues detected.`
        : "Systems healthy with no warnings.";

  return {
    mode: input.mode,
    score,
    summary,
    findings: input.findings,
    remediations: input.remediations,
    createdAt: (input.now ?? new Date()).toISOString(),
  };
}

export function rankAnomalyAlerts(alerts: AdminAnomalyAlert[]) {
  const weight = (severity: OpsSeverity) => {
    if (severity === "critical") {
      return 3;
    }

    if (severity === "warning") {
      return 2;
    }

    return 1;
  };

  return [...alerts].sort((left, right) => {
    const severityDiff = weight(right.severity) - weight(left.severity);
    if (severityDiff !== 0) {
      return severityDiff;
    }

    return +new Date(right.createdAt) - +new Date(left.createdAt);
  });
}
