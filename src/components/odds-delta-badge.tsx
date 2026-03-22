export function OddsDeltaBadge({ current, opening }: { current?: number; opening?: number }) {
  if (opening == null || current == null) return null;
  const delta = current - opening;
  if (delta === 0) return null;
  return (
    <span
      title="Moved from opening line"
      className={`whitespace-nowrap text-xs ${delta > 0 ? "text-amber-400" : "text-blue-400"}`}
    >
      {delta > 0 ? "▲" : "▼"} {delta > 0 ? "+" : ""}{delta}
    </span>
  );
}
