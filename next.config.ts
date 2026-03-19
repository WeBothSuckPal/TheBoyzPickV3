import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// Note: Content-Security-Policy is set dynamically in middleware.ts with a
// per-request nonce, eliminating the need for 'unsafe-inline' in script-src.

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const securityHeaders = [
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "Cross-Origin-Opener-Policy",
        value: "same-origin-allow-popups",
      },
      {
        key: "Cross-Origin-Resource-Policy",
        value: "cross-origin",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/(today|slips|wallet|leaderboards|admin|api/:path*)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "the-boyz",
  project: "clubhouse-lines",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  reactComponentAnnotation: {
    enabled: true,
  },
  sourcemaps: {
    disable: false,
    deleteSourcemapsAfterUpload: true,
  },
  disableLogger: true,
});
