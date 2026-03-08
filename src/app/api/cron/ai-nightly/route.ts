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
          category: "cron_ai_nightly:ip",
          limit: 4,
          windowMs: 2 * 60 * 60 * 1000,
          blockMs: 2 * 60 * 60 * 1000,
        },
      ],
    });

    const result = await runAiOpsAutopilot("nightly");
    return NextResponse.json(result);
  } catch (error) {
    const response = describeRequestError(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
