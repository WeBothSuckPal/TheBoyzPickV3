import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { runOddsSync } from "@/lib/clubhouse";
import { describeRequestError } from "@/lib/http";
import {
  assertRateLimit,
  getRouteRequestContext,
} from "@/lib/security";

export async function POST(request: Request) {
  try {
    const viewer = await requireAdmin();
    const requestContext = await getRouteRequestContext(request);
    await assertRateLimit({
      viewer,
      requestContext,
      policies: [{ category: "admin_sync_api:user", limit: 12, windowMs: 10 * 60 * 1000, blockMs: 10 * 60 * 1000 }],
    });
    const result = await runOddsSync();
    return NextResponse.json(result);
  } catch (error) {
    const response = describeRequestError(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
