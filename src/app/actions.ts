"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  approveTopUp,
  placeSlip,
  requestTopUp,
  runAiOpsAutopilot,
  runOddsSync,
  runSettlementSweep,
  saveLockPick,
  setMaintenanceMode,
  updateMemberAccess,
} from "@/lib/clubhouse";
import { requireAdmin, requireViewer } from "@/lib/auth";
import { assertRateLimit, getServerRequestContext } from "@/lib/security";

const topUpSchema = z.object({
  amount: z.coerce.number().int().min(5).max(500),
  note: z.string().trim().max(120).optional(),
});

const slipSchema = z.object({
  stake: z.coerce.number().int().min(5).max(200),
  selectionIds: z.array(z.string()).min(1).max(4),
});

export async function submitTopUpRequestAction(formData: FormData) {
  const viewer = await requireViewer();
  const requestContext = await getServerRequestContext();
  await assertRateLimit({
    viewer,
    requestContext,
    policies: [
      { category: "top_up_request:user", limit: 5, windowMs: 60 * 60 * 1000, blockMs: 15 * 60 * 1000 },
      { category: "top_up_request:ip", limit: 12, windowMs: 60 * 60 * 1000, blockMs: 15 * 60 * 1000 },
    ],
  });

  const parsed = topUpSchema.parse({
    amount: formData.get("amount"),
    note: formData.get("note")?.toString(),
  });

  await requestTopUp(viewer.id, parsed.amount * 100, parsed.note);
  revalidatePath("/wallet");
  revalidatePath("/admin");
}

export async function placeSlipAction(formData: FormData) {
  const viewer = await requireViewer();
  const requestContext = await getServerRequestContext();
  await assertRateLimit({
    viewer,
    requestContext,
    policies: [
      { category: "place_slip:user", limit: 20, windowMs: 60 * 1000, blockMs: 5 * 60 * 1000 },
      { category: "place_slip:ip", limit: 40, windowMs: 60 * 1000, blockMs: 5 * 60 * 1000 },
    ],
  });

  const selectionIds = [
    formData.get("selectionOne")?.toString(),
    formData.get("selectionTwo")?.toString(),
    formData.get("selectionThree")?.toString(),
    formData.get("selectionFour")?.toString(),
  ].filter((value): value is string => Boolean(value));

  const parsed = slipSchema.parse({
    stake: formData.get("stake"),
    selectionIds,
  });

  await placeSlip({
    userId: viewer.id,
    stakeCents: parsed.stake * 100,
    selectionIds: parsed.selectionIds,
  });

  revalidatePath("/slips");
  revalidatePath("/wallet");
  revalidatePath("/leaderboards");
}

export async function saveLockPickAction(formData: FormData) {
  const viewer = await requireViewer();
  const requestContext = await getServerRequestContext();
  await assertRateLimit({
    viewer,
    requestContext,
    policies: [{ category: "lock_pick:user", limit: 10, windowMs: 60 * 60 * 1000, blockMs: 10 * 60 * 1000 }],
  });

  const selectionId = formData.get("selectionId")?.toString();

  if (!selectionId) {
    throw new Error("Select a line for Lock of the Day.");
  }

  await saveLockPick(viewer.id, selectionId);
  revalidatePath("/today");
  revalidatePath("/leaderboards");
}

export async function approveTopUpAction(formData: FormData) {
  const viewer = await requireAdmin();
  const requestContext = await getServerRequestContext();
  await assertRateLimit({
    viewer,
    requestContext,
    policies: [{ category: "admin_top_up:user", limit: 30, windowMs: 10 * 60 * 1000, blockMs: 10 * 60 * 1000 }],
  });

  const requestId = formData.get("requestId")?.toString();

  if (!requestId) {
    throw new Error("Missing request id.");
  }

  await approveTopUp(viewer.id, requestId);
  revalidatePath("/admin");
  revalidatePath("/wallet");
  revalidatePath("/leaderboards");
}

export async function runOddsSyncAction() {
  const viewer = await requireAdmin();
  const requestContext = await getServerRequestContext();
  await assertRateLimit({
    viewer,
    requestContext,
    policies: [{ category: "admin_sync:user", limit: 12, windowMs: 10 * 60 * 1000, blockMs: 10 * 60 * 1000 }],
  });

  let errorMessage: string | undefined;
  try {
    await runOddsSync();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Odds sync failed.";
  }

  if (errorMessage) {
    redirect(`/admin?error=${encodeURIComponent(errorMessage)}`);
  }

  revalidatePath("/today");
  revalidatePath("/admin");
}

export async function runSettlementSweepAction() {
  const viewer = await requireAdmin();
  const requestContext = await getServerRequestContext();
  await assertRateLimit({
    viewer,
    requestContext,
    policies: [{ category: "admin_settle:user", limit: 12, windowMs: 10 * 60 * 1000, blockMs: 10 * 60 * 1000 }],
  });

  let errorMessage: string | undefined;
  try {
    await runSettlementSweep();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Settlement sweep failed.";
  }

  if (errorMessage) {
    redirect(`/admin?error=${encodeURIComponent(errorMessage)}`);
  }

  revalidatePath("/slips");
  revalidatePath("/wallet");
  revalidatePath("/leaderboards");
  revalidatePath("/admin");
}

export async function runAiOpsAutopilotAction(formData: FormData) {
  const viewer = await requireAdmin();
  const requestContext = await getServerRequestContext();
  await assertRateLimit({
    viewer,
    requestContext,
    policies: [{ category: "admin_ai_ops:user", limit: 8, windowMs: 10 * 60 * 1000, blockMs: 15 * 60 * 1000 }],
  });

  const modeRaw = formData.get("mode")?.toString();
  const mode =
    modeRaw === "nightly" || modeRaw === "hourly" || modeRaw === "manual"
      ? modeRaw
      : "manual";

  let errorMessage: string | undefined;
  try {
    await runAiOpsAutopilot(mode);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "AI autopilot failed.";
  }

  if (errorMessage) {
    redirect(`/admin?error=${encodeURIComponent(errorMessage)}`);
  }

  revalidatePath("/admin");
  revalidatePath("/today");
}

export async function updateMemberAccessAction(formData: FormData) {
  const viewer = await requireAdmin();
  const requestContext = await getServerRequestContext();
  await assertRateLimit({
    viewer,
    requestContext,
    policies: [{ category: "admin_member_access:user", limit: 40, windowMs: 10 * 60 * 1000, blockMs: 10 * 60 * 1000 }],
  });

  const targetUserId = formData.get("targetUserId")?.toString();
  const role = formData.get("role")?.toString() as "owner_admin" | "member" | undefined;
  const status = formData.get("status")?.toString() as "active" | "suspended" | undefined;

  if (!targetUserId || (!role && !status)) {
    throw new Error("Missing access update fields.");
  }

  await updateMemberAccess({
    actorUserId: viewer.id,
    targetUserId,
    role,
    status,
  });

  revalidatePath("/admin");
}

export async function setMaintenanceModeAction(formData: FormData) {
  const viewer = await requireAdmin();
  const requestContext = await getServerRequestContext();
  await assertRateLimit({
    viewer,
    requestContext,
    policies: [{ category: "admin_maintenance:user", limit: 20, windowMs: 10 * 60 * 1000, blockMs: 10 * 60 * 1000 }],
  });

  const enabled = formData.get("enabled")?.toString() === "true";
  await setMaintenanceMode(viewer.id, enabled);
  revalidatePath("/admin");
}
