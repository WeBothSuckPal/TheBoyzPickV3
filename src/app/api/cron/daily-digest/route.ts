import { NextResponse } from "next/server";

import { getDailyDigestData } from "@/lib/clubhouse";
import { sendDailyGameDigest } from "@/lib/email";
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
      policies: [{ category: "cron_digest:ip", limit: 4, windowMs: 60 * 60 * 1000, blockMs: 30 * 60 * 1000 }],
    });

    const { members, games } = await getDailyDigestData();

    if (games.length === 0) {
      return NextResponse.json({ success: true, sent: 0, reason: "no games today" });
    }

    const sent = await sendDailyGameDigest(members, games);
    return NextResponse.json({ success: true, sent, memberCount: members.length, gameCount: games.length });
  } catch (error) {
    const response = describeRequestError(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
