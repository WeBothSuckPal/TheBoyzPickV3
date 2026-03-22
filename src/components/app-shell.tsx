"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Settings, Shield, Target, Ticket, Trophy, User, Wallet } from "lucide-react";
import type { ReactNode } from "react";

import { appName } from "@/lib/constants";
import type { ViewerProfile } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { SettlementListener } from "@/components/settlement-listener";

const navItems = [
  { href: "/today", label: "Today", icon: Target },
  { href: "/slips", label: "Build Slip", icon: Shield },
  { href: "/bets", label: "My Bets", icon: Ticket },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/leaderboards", label: "Leaderboards", icon: Trophy },
];

export function AppShell({
  children,
  viewer,
  balanceCents,
  mode,
  maintenanceMode,
}: {
  children: ReactNode;
  viewer: ViewerProfile;
  balanceCents: number;
  mode: "demo" | "live";
  maintenanceMode: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      {maintenanceMode && viewer.role === "owner_admin" ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[#e67e22]/40 bg-[#e67e22]/15 px-4 py-3 text-sm font-semibold text-[#e67e22]">
          <AlertTriangle className="size-4" />
          Maintenance mode is ON — members are locked out. Toggle it off in the Admin panel.
        </div>
      ) : null}

      {viewer.displayName === "Club Member" && !pathname.startsWith("/profile") ? (
        <Link
          href="/profile?setup=true"
          className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]/25"
        >
          <User className="size-4" />
          Please complete your profile — the commissioner needs your real name.
        </Link>
      ) : null}

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
            <Link
              href="/profile"
              className="group rounded-3xl border border-white/10 bg-black/15 px-4 py-3 transition hover:border-white/20 hover:bg-white/5"
            >
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                  Logged in as
                </div>
                <User className="size-3 text-[var(--muted-foreground)] transition group-hover:text-white" />
              </div>
              <div className="mt-1 text-base font-semibold text-white">{viewer.nickname ?? viewer.displayName}</div>
              <div className="text-sm text-[var(--muted-foreground)]">{viewer.role}</div>
            </Link>
            <div className="flex gap-3">
              <div className="flex-1 rounded-3xl border border-white/10 bg-black/15 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                  Wallet
                </div>
                <div className="mt-1 text-base font-semibold text-white">
                  {formatCurrency(balanceCents)}
                </div>
                <div className="text-sm text-[var(--muted-foreground)]">Club credits ready</div>
              </div>
              {viewer.role === "owner_admin" ? (
                <Link
                  href="/admin"
                  className={cn(
                    "flex items-center justify-center rounded-3xl border px-4 py-3 transition",
                    pathname.startsWith("/admin")
                      ? "border-[var(--accent)]/40 bg-[var(--accent)]/15 text-white"
                      : "border-white/10 bg-black/15 text-[var(--muted-foreground)] hover:border-white/20 hover:text-white",
                  )}
                  title="Admin panel"
                >
                  <Settings className="size-5" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <nav className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
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
      </nav>

      <main id="main-content" className="animate-fade-in">{children}</main>

      <footer className="flex items-center justify-center gap-6 py-4 text-xs text-[var(--muted-foreground)]">
        <Link href="/faq" className="transition hover:text-white">
          FAQ
        </Link>
        <span className="opacity-30">·</span>
        <Link href="/legal" className="transition hover:text-white">
          Legal
        </Link>
      </footer>
      <SettlementListener />
    </div>
  );
}
