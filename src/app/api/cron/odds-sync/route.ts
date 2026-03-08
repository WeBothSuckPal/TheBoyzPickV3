import { NextResponse } from "next/server";

import { runOddsSync } from "@/lib/clubhouse";
import { describeRequestError } from "@/lib/http";
import {
  assertCronAuthorization,
  assertRateLimit,
  getRouteRequestContext,
} from "@/lib/security";

export async function GET(request: Request) {
  try {
    const requestContext = await getRouteRequestContext(request);
    await assertCronAuthorization(request);
    await assertRateLimit({
      requestContext,
      policies: [{ category: "cron_odds:ip", limit: 24, windowMs: 5 * 60 * 1000, blockMs: 15 * 60 * 1000 }],
    });

    const result = await runOddsSync();
    return NextResponse.json(result);
  } catch (error) {
    const response = describeRequestError(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
