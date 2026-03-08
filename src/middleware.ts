import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { ConfigurationError, getMissingProductionEnvKeys, isClerkConfigured, isProduction } from "@/lib/env";

const isProtectedRoute = createRouteMatcher([
  "/today(.*)",
  "/slips(.*)",
  "/wallet(.*)",
  "/admin(.*)",
  "/api/admin(.*)",
]);
const isCronRoute = createRouteMatcher(["/api/cron(.*)"]);

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

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (isProduction() && (isProtectedRoute(request) || isCronRoute(request))) {
    try {
      const missingKeys = getMissingProductionEnvKeys();
      if (missingKeys.length > 0) {
        return failClosedForMisconfig(request, missingKeys);
      }
    } catch (error) {
      if (error instanceof ConfigurationError) {
        return failClosedForMisconfig(request, ["invalid_environment"]);
      }

      throw error;
    }
  }

  if (!isClerkConfigured()) {
    return handleWithoutClerk(request);
  }

  return withClerk(request, event);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api)(.*)"],
};
