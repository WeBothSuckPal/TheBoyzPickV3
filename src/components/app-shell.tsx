"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle, Shield, Target, Trophy, Wallet } from "lucide-react";
import type { ReactNode } from "react";

import { appName } from "@/lib/constants";
import type { ViewerProfile } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

const navItems = [
  { href: "/today", label: "Today", icon: Target },
  { href: "/slips", label: "Build Slip", icon: Shield },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/leaderboards", label: "Leaderboards", icon: Trophy },
  { href: "/faq", label: "FAQ", icon: HelpCircle },
];

export function AppShell({
  children,
  viewer,
  balanceCents,
  mode,
}: {
  children: ReactNode;
  viewer: ViewerProfile;
  balanceCents: number;
  mode: "demo" | "live";
}) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-[32px] border border-white/10 bg-[var(--panel-strong)] p-5 shadow-[0_18px_56px_rgba(0,0,0,0.22)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/" className="rounded-full bg-[var(--accent)]/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)] transition hover:bg-[var(--accent)]/30">
                {appName}
              </Link>
              <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                {mode === "live" ? "Live stack" : "Demo mode"}
              </span>
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-white">
                Run the card. Track the chaos.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
                Private picks club with locked lines, club-credit bankrolls,
                rivalry boards, and commissioner controls.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-black/15 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                Logged in as
              </div>
              <div className="mt-1 text-base font-semibold text-white">{viewer.displayName}</div>
              <div className="text-sm text-[var(--muted-foreground)]">{viewer.role}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/15 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                Wallet
              </div>
              <div className="mt-1 text-base font-semibold text-white">
                {formatCurrency(balanceCents)}
              </div>
              <div className="text-sm text-[var(--muted-foreground)]">Club credits ready</div>
            </div>
          </div>
        </div>
      </header>

      <nav className={cn("grid grid-cols-2 gap-3", viewer.role === "owner_admin" ? "md:grid-cols-6" : "md:grid-cols-5")}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                active
                  ? "border-[var(--accent)]/40 bg-[var(--accent)]/15 text-white"
                  : "border-white/10 bg-white/5 text-[var(--muted-foreground)] hover:bg-white/8 hover:text-white",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}

        {viewer.role === "owner_admin" ? (
          <Link
            href="/admin"
            className={cn(
              "flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
              pathname.startsWith("/admin")
                ? "border-[var(--accent)]/40 bg-[var(--accent)]/15 text-white"
                : "border-white/10 bg-white/5 text-[var(--muted-foreground)] hover:bg-white/8 hover:text-white",
            )}
          >
            <Shield className="size-4" />
            Admin
          </Link>
        ) : null}
      </nav>

      {children}
    </div>
  );
}
