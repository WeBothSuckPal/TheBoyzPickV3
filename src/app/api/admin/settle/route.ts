import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { runSettlementSweep } from "@/lib/clubhouse";
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
      policies: [{ category: "admin_settle_api:user", limit: 12, windowMs: 10 * 60 * 1000, blockMs: 10 * 60 * 1000 }],
    });
    const result = await runSettlementSweep();
    return NextResponse.json(result);
  } catch (error) {
    const response = describeRequestError(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
