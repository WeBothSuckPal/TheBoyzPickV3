import Link from "next/link";
import { appName } from "@/lib/constants";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto max-w-md space-y-6 px-6 text-center">
        <div className="text-6xl font-bold text-[var(--accent)]">404</div>
        <h1 className="text-2xl font-semibold text-white">Page not found</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          The page you&apos;re looking for doesn&apos;t exist in {appName}.
        </p>
        <Link
          href="/"
          className="inline-block rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]/25"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
