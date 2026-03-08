import { AppShell } from "@/components/app-shell";
import { getMemberSnapshot } from "@/lib/clubhouse";
import { requireViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer = await requireViewer();
  const snapshot = await getMemberSnapshot(viewer);

  return (
    <AppShell viewer={viewer} balanceCents={snapshot.wallet.balanceCents} mode={snapshot.mode}>
      {children}
    </AppShell>
  );
}
