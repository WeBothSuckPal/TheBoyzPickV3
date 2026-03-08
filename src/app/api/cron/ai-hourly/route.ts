import { NextResponse } from "next/server";

import { runAiOpsAutopilot } from "@/lib/clubhouse";
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
      policies: [
        {
          category: "cron_ai_hourly:ip",
          limit: 8,
          windowMs: 60 * 60 * 1000,
          blockMs: 30 * 60 * 1000,
        },
      ],
    });

    const result = await runAiOpsAutopilot("hourly");
    return NextResponse.json(result);
  } catch (error) {
    const response = describeRequestError(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
