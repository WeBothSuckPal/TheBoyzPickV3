export default function LeaderboardsLoading() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-[32px] border border-white/10 bg-[var(--panel-strong)] p-6"
        >
          <div className="mb-4 h-5 w-40 rounded-full bg-white/10" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-white/6" />
                <div className="h-4 flex-1 rounded-full bg-white/6" />
                <div className="h-4 w-16 rounded-full bg-white/6" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
