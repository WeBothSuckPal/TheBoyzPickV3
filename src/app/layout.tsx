import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import { appName } from "@/lib/constants";
import { isClerkConfigured } from "@/lib/env";
import "./globals.css";

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: `${appName} | Private Sports Picks Club`,
  description:
    "Invite-only sports picks club with daily spreads, leaderboards, bankroll tracking, and commissioner controls.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const body = (
    <body
      className={`${displayFont.variable} ${monoFont.variable} bg-[var(--background)] text-[var(--foreground)] antialiased`}
    >
      {children}
    </body>
  );

  return (
    <html lang="en">
      {isClerkConfigured() ? <ClerkProvider>{body}</ClerkProvider> : body}
    </html>
  );
}
