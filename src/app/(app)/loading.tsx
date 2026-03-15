export default function AppLoading() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-[32px] border border-white/10 bg-[var(--panel-strong)] p-6"
        >
          <div className="animate-shimmer mb-4 h-5 w-32 rounded-full bg-white/10" />
          <div className="space-y-3">
            <div className="animate-shimmer h-4 w-full rounded-full bg-white/6" />
            <div className="animate-shimmer h-4 w-3/4 rounded-full bg-white/6" />
            <div className="animate-shimmer h-4 w-1/2 rounded-full bg-white/6" />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="animate-shimmer h-16 rounded-2xl bg-white/6" />
            <div className="animate-shimmer h-16 rounded-2xl bg-white/6" />
          </div>
        </div>
      ))}
    </div>
  );
}
