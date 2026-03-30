import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { getMemberSnapshot } from "@/lib/clubhouse";
import { getOptionalViewer } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { appName } from "@/lib/constants";
import { isClerkConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function MemberProfileLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer = await getOptionalViewer();

  if (!viewer) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <header className="border-b border-white/10 px-4 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <Link href="/" className="font-semibold text-white hover:text-[var(--accent)]">
              {appName}
            </Link>
            <Button asChild size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    );
  }

  const snapshot = await getMemberSnapshot(viewer);

  return (
    <AppShell
      viewer={viewer}
      balanceCents={snapshot.wallet.balanceCents}
      mode={snapshot.mode}
      maintenanceMode={snapshot.settings.maintenanceMode}
      clerkConfigured={isClerkConfigured()}
    >
      {children}
    </AppShell>
  );
}
