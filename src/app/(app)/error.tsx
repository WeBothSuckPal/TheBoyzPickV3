"use client";

import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md space-y-6 py-16 text-center">
      <div className="text-5xl">⚠</div>
      <h1 className="text-2xl font-semibold text-white">Something went wrong</h1>
      <p className="text-sm text-[var(--muted-foreground)]">
        {error.message || "An unexpected error occurred."}
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-[var(--muted-foreground)]">Error ID: {error.digest}</p>
      ) : null}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]/25"
        >
          Try again
        </button>
        <Link
          href="/today"
          className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-[var(--muted-foreground)] transition hover:bg-white/10 hover:text-white"
        >
          Go to Today
        </Link>
      </div>
    </div>
  );
}
