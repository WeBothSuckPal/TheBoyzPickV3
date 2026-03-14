"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-white">
        <div className="mx-auto max-w-md space-y-6 px-6 text-center">
          <div className="text-6xl">⚠</div>
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-neutral-400">
            An unexpected error occurred. Please try again.
          </p>
          {error.digest ? (
            <p className="font-mono text-xs text-neutral-500">Error ID: {error.digest}</p>
          ) : null}
          <button
            onClick={reset}
            className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold transition hover:bg-white/10"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
