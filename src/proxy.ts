import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { ConfigurationError, getMissingProductionEnvKeys, isClerkConfigured, isProduction } from "@/lib/env";

const isProtectedRoute = createRouteMatcher([
  "/today(.*)",
  "/slips(.*)",
  "/wallet(.*)",
  "/admin(.*)",
  "/api/admin(.*)",
  "/leaderboards(.*)",
  "/faq(.*)",
]);
const isCronRoute = createRouteMatcher(["/api/cron(.*)"]);

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://*.clerk.com https://*.clerk.accounts.dev https://clerk.theboyzpick.com https://challenges.cloudflare.com https://vercel.live`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://clerk.theboyzpick.com https://challenges.cloudflare.com https://api.the-odds-api.com https://*.vercel-insights.com",
    "frame-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://clerk.theboyzpick.com https://challenges.cloudflare.com",
  ].join("; ");
}

function failClosedForMisconfig(request: NextRequest, missingKeys: string[]) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "Service is not configured for production.",
        code: "service_not_configured",
        missingKeys,
      },
      { status: 503 },
    );
  }

  const fallbackUrl = new URL("/", request.url);
  fallbackUrl.searchParams.set("setup", "incomplete");
  return NextResponse.redirect(fallbackUrl);
}

const withClerk = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    return response;
  }

  return NextResponse.next();
});

function handleWithoutClerk(request: NextRequest) {
  if (isProduction() && isProtectedRoute(request)) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "Auth provider is not configured.",
          code: "service_not_configured",
        },
        { status: 503 },
      );
    }

    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isProtectedRoute(request)) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    return response;
  }

  return NextResponse.next();
}

/**
 * Merges Clerk's response headers onto a nonce-forwarding NextResponse.
 * For redirects and error responses, just attaches the CSP header directly.
 * For pass-through responses, replaces with NextResponse.next({ request: { headers } })
 * so the app (layout/server components) can read x-nonce from headers().
 */
function applyNonceToResponse(
  baseResp: NextResponse | Response,
  nonce: string,
  requestHeaders: Headers,
): NextResponse {
  const resp = baseResp as NextResponse;
  const csp = buildCsp(nonce);

  // Redirects and error responses — attach CSP and return as-is
  if (resp.status >= 300) {
    resp.headers.set("Content-Security-Policy", csp);
    return resp;
  }

  // Pass-through response — replace with one that forwards x-nonce to the app
  const newResp = NextResponse.next({ request: { headers: requestHeaders } });

  // Preserve Clerk's auth cookies and any other response headers
  resp.headers.forEach((value, key) => {
    newResp.headers.set(key, value);
  });

  newResp.headers.set("Content-Security-Policy", csp);
  return newResp;
}

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  // Generate a unique nonce for this request
  const nonce = btoa(crypto.randomUUID());

  // Build request headers that include x-nonce so server components can read it
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  if (isProduction() && (isProtectedRoute(request) || isCronRoute(request))) {
    try {
      const missingKeys = getMissingProductionEnvKeys();
      if (missingKeys.length > 0) {
        const resp = failClosedForMisconfig(request, missingKeys);
        resp.headers.set("Content-Security-Policy", buildCsp(nonce));
        return resp;
      }
    } catch (error) {
      if (error instanceof ConfigurationError) {
        const resp = failClosedForMisconfig(request, ["invalid_environment"]);
        resp.headers.set("Content-Security-Policy", buildCsp(nonce));
        return resp;
      }

      throw error;
    }
  }

  if (!isClerkConfigured()) {
    const resp = handleWithoutClerk(request);
    return applyNonceToResponse(resp, nonce, requestHeaders);
  }

  const clerkResp = await withClerk(request, event);
  return applyNonceToResponse(clerkResp as NextResponse, nonce, requestHeaders);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api)(.*)"],
};
