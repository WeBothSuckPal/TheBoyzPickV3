import type { Metadata } from "next";
import { headers } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import { appName } from "@/lib/constants";
import { isClerkConfigured } from "@/lib/env";
import { ToastProvider } from "@/components/ui/toaster";
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
    "Private sports picks club with daily competition, leaderboards, and commissioner controls. Members only.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the per-request nonce forwarded by middleware so ClerkProvider and
  // any manually rendered <Script> elements can carry the correct nonce attribute.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  const body = (
    <body
      className={`${displayFont.variable} ${monoFont.variable} bg-[var(--background)] text-[var(--foreground)] antialiased`}
    >
      <ToastProvider>{children}</ToastProvider>
    </body>
  );

  return (
    <html lang="en">
      {isClerkConfigured() ? <ClerkProvider nonce={nonce}>{body}</ClerkProvider> : body}
    </html>
  );
}
