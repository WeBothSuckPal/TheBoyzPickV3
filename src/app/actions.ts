"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  addComment,
  approveTopUp,
  deleteComment,
  getCurrentSettings,
  placeSlip,
  requestTopUp,
  runAiOpsAutopilot,
  runOddsSync,
  runSettlementSweep,
  saveLockPick,
  setMaintenanceMode,
  toggleReaction,
  updateMemberAccess,
  updateProfile,
} from "@/lib/clubhouse";
import { requireAdmin, requireViewer } from "@/lib/auth";
import { assertRateLimit, getServerRequestContext } from "@/lib/security";

type ActionResult = { success: boolean; message: string };

/** Whitelist of error messages safe to show to end users. */
const SAFE_ERROR_MESSAGES = new Set([
  "Wallet balance is too low.",
  "Top-up request is no longer pending.",
  "You already have the maximum number of open slips.",
  "One or more selections are no longer available.",
  "Game has already started.",
  "You have already picked a lock for today.",
  "Cannot modify your own role.",
  "Cannot suspend yourself.",
]);

function safeMessage(error: unknown, fallback: string): string {
  const msg = error instanceof Error ? error.message : "";
  return SAFE_ERROR_MESSAGES.has(msg) ? msg : fallback;
}

const topUpSchema = z.object({
  amount: z.coerce.number().int().min(5).max(500),
  note: z.string().trim().max(120).optional(),
});

const slipSchema = z.object({
  stake: z.coerce.number().int().positive(),
  selectionIds: z.array(z.string()).min(1).max(4),
});

export async function submitTopUpRequestAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
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
    return { success: true, message: "Top-up request submitted." };
  } catch (error) {
    return { success: false, message: safeMessage(error, "Top-up request failed.") };
  }
}

export async function placeSlipAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
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

    const selectionIds = JSON.parse(formData.get("selectionIds")?.toString() ?? "[]") as string[];

    const parsed = slipSchema.parse({
      stake: formData.get("stake"),
      selectionIds,
    });

    const settings = await getCurrentSettings();
    const minDollars = settings.minStakeCents / 100;
    const maxDollars = settings.maxStakeCents / 100;
    if (parsed.stake < minDollars || parsed.stake > maxDollars) {
      return { success: false, message: `Stake must be between $${minDollars} and $${maxDollars}.` };
    }

    const idempotencyKey = formData.get("idempotencyKey")?.toString();

    await placeSlip({
      userId: viewer.id,
      stakeCents: parsed.stake * 100,
      selectionIds: parsed.selectionIds,
      idempotencyKey,
    });

    revalidatePath("/slips");
    revalidatePath("/wallet");
    revalidatePath("/leaderboards");
    return { success: true, message: "Slip placed successfully!" };
  } catch (error) {
    return { success: false, message: safeMessage(error, "Slip placement failed.") };
  }
}

export async function saveLockPickAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const viewer = await requireViewer();
    const requestContext = await getServerRequestContext();
    await assertRateLimit({
      viewer,
      requestContext,
      policies: [{ category: "lock_pick:user", limit: 10, windowMs: 60 * 60 * 1000, blockMs: 10 * 60 * 1000 }],
    });

    const selectionId = formData.get("selectionId")?.toString();

    if (!selectionId) {
      return { success: false, message: "Select a line for Lock of the Day." };
    }

    const noteRaw = formData.get("note")?.toString()?.trim();
    if (noteRaw && noteRaw.length > 140) {
      return { success: false, message: "Note must be 140 characters or fewer." };
    }
    const note = noteRaw || undefined;

    await saveLockPick(viewer.id, selectionId, note);
    revalidatePath("/today");
    revalidatePath("/leaderboards");
    return { success: true, message: "Lock of the Day saved!" };
  } catch (error) {
    return { success: false, message: safeMessage(error, "Failed to save lock pick.") };
  }
}

export async function approveTopUpAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const viewer = await requireAdmin();
    const requestContext = await getServerRequestContext();
    await assertRateLimit({
      viewer,
      requestContext,
      policies: [{ category: "admin_top_up:user", limit: 30, windowMs: 10 * 60 * 1000, blockMs: 10 * 60 * 1000 }],
    });

    const requestId = formData.get("requestId")?.toString();

    if (!requestId) {
      return { success: false, message: "Missing request id." };
    }

    await approveTopUp(viewer.id, requestId);
    revalidatePath("/admin");
    revalidatePath("/wallet");
    revalidatePath("/leaderboards");
    return { success: true, message: "Top-up approved." };
  } catch (error) {
    return { success: false, message: safeMessage(error, "Failed to approve top-up.") };
  }
}

export async function runOddsSyncAction(_prev: ActionResult | null): Promise<ActionResult> {
  try {
    const viewer = await requireAdmin();
    const requestContext = await getServerRequestContext();
    await assertRateLimit({
      viewer,
      requestContext,
      policies: [{ category: "admin_sync:user", limit: 12, windowMs: 10 * 60 * 1000, blockMs: 10 * 60 * 1000 }],
    });

    await runOddsSync();
    revalidatePath("/today");
    revalidatePath("/admin");
    return { success: true, message: "Odds synced successfully." };
  } catch (error) {
    return { success: false, message: safeMessage(error, "Odds sync failed.") };
  }
}

export async function runSettlementSweepAction(_prev: ActionResult | null): Promise<ActionResult> {
  try {
    const viewer = await requireAdmin();
    const requestContext = await getServerRequestContext();
    await assertRateLimit({
      viewer,
      requestContext,
      policies: [{ category: "admin_settle:user", limit: 12, windowMs: 10 * 60 * 1000, blockMs: 10 * 60 * 1000 }],
    });

    await runSettlementSweep();
    revalidatePath("/slips");
    revalidatePath("/wallet");
    revalidatePath("/leaderboards");
    revalidatePath("/admin");
    return { success: true, message: "Settlement sweep complete." };
  } catch (error) {
    return { success: false, message: safeMessage(error, "Settlement sweep failed.") };
  }
}

export async function runAiOpsAutopilotAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
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

    await runAiOpsAutopilot(mode);
    revalidatePath("/admin");
    revalidatePath("/today");
    return { success: true, message: `AI autopilot (${mode}) complete.` };
  } catch (error) {
    return { success: false, message: safeMessage(error, "AI autopilot failed.") };
  }
}

export async function updateMemberAccessAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const viewer = await requireAdmin();
    const requestContext = await getServerRequestContext();
    await assertRateLimit({
      viewer,
      requestContext,
      policies: [{ category: "admin_member_access:user", limit: 40, windowMs: 10 * 60 * 1000, blockMs: 10 * 60 * 1000 }],
    });

    const targetUserId = formData.get("targetUserId")?.toString();
    const roleRaw = formData.get("role")?.toString();
    const statusRaw = formData.get("status")?.toString();

    const validRoles = ["owner_admin", "member"] as const;
    const validStatuses = ["active", "suspended"] as const;

    const role = roleRaw && validRoles.includes(roleRaw as (typeof validRoles)[number])
      ? (roleRaw as (typeof validRoles)[number])
      : undefined;
    const status = statusRaw && validStatuses.includes(statusRaw as (typeof validStatuses)[number])
      ? (statusRaw as (typeof validStatuses)[number])
      : undefined;

    if (!targetUserId || (!role && !status)) {
      return { success: false, message: "Missing or invalid access update fields." };
    }

    await updateMemberAccess({
      actorUserId: viewer.id,
      targetUserId,
      role,
      status,
    });

    revalidatePath("/admin");
    return { success: true, message: "Member access updated." };
  } catch (error) {
    return { success: false, message: safeMessage(error, "Failed to update member access.") };
  }
}

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(50),
  nickname: z.string().trim().min(2).max(20).optional().or(z.literal("")),
});

export async function updateProfileAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const viewer = await requireViewer();
    const requestContext = await getServerRequestContext();
    await assertRateLimit({
      viewer,
      requestContext,
      policies: [{ category: "update_profile:user", limit: 20, windowMs: 10 * 60 * 1000, blockMs: 5 * 60 * 1000 }],
    });

    const parsed = profileSchema.parse({
      displayName: formData.get("displayName"),
      nickname: formData.get("nickname")?.toString(),
    });

    await updateProfile(viewer.id, {
      displayName: parsed.displayName,
      nickname: parsed.nickname || null,
    });

    revalidatePath("/profile");
    revalidatePath("/leaderboards");
    revalidatePath("/today");
    revalidatePath("/admin");
    return { success: true, message: "Profile saved." };
  } catch (error) {
    return { success: false, message: safeMessage(error, "Failed to save profile.") };
  }
}

export async function setMaintenanceModeAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
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
    return { success: true, message: enabled ? "Maintenance mode enabled." : "Maintenance mode disabled." };
  } catch (error) {
    return { success: false, message: safeMessage(error, "Failed to toggle maintenance mode.") };
  }
}

// ── Social actions ────────────────────────────────────────────────

const VALID_EMOJIS = ["🔥", "🤡", "💰", "💀", "🎯"];
const VALID_TARGET_TYPES = ["slip", "lock_pick"];

export async function toggleReactionAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const viewer = await requireViewer();
    const requestContext = await getServerRequestContext();
    await assertRateLimit({
      viewer,
      requestContext,
      policies: [
        { category: "reaction:user", limit: 60, windowMs: 60 * 1000, blockMs: 60 * 1000 },
        { category: "reaction:ip", limit: 120, windowMs: 60 * 1000, blockMs: 60 * 1000 },
      ],
    });

    const targetType = formData.get("targetType")?.toString() ?? "";
    const targetId = formData.get("targetId")?.toString() ?? "";
    const emoji = formData.get("emoji")?.toString() ?? "";

    if (!VALID_TARGET_TYPES.includes(targetType)) return { success: false, message: "Invalid target type." };
    if (!targetId) return { success: false, message: "Missing target." };
    if (!VALID_EMOJIS.includes(emoji)) return { success: false, message: "Invalid emoji." };

    const result = await toggleReaction(viewer.id, targetType, targetId, emoji);
    revalidatePath("/slips");
    revalidatePath("/today");
    return { success: true, message: result === "added" ? "Reaction added." : "Reaction removed." };
  } catch (error) {
    return { success: false, message: safeMessage(error, "Failed to toggle reaction.") };
  }
}

export async function addCommentAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const viewer = await requireViewer();
    const requestContext = await getServerRequestContext();
    await assertRateLimit({
      viewer,
      requestContext,
      policies: [
        { category: "comment:user", limit: 15, windowMs: 5 * 60 * 1000, blockMs: 5 * 60 * 1000 },
        { category: "comment:ip", limit: 30, windowMs: 5 * 60 * 1000, blockMs: 5 * 60 * 1000 },
      ],
    });

    const targetType = formData.get("targetType")?.toString() ?? "";
    const targetId = formData.get("targetId")?.toString() ?? "";
    const body = formData.get("body")?.toString()?.trim() ?? "";

    if (!VALID_TARGET_TYPES.includes(targetType)) return { success: false, message: "Invalid target type." };
    if (!targetId) return { success: false, message: "Missing target." };
    if (!body || body.length > 280) return { success: false, message: "Comment must be 1-280 characters." };

    await addComment(viewer.id, targetType, targetId, body);
    revalidatePath("/slips");
    revalidatePath("/today");
    return { success: true, message: "Comment posted." };
  } catch (error) {
    return { success: false, message: safeMessage(error, "Failed to post comment.") };
  }
}

export async function deleteCommentAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const viewer = await requireViewer();
    const requestContext = await getServerRequestContext();
    await assertRateLimit({
      viewer,
      requestContext,
      policies: [
        { category: "comment_delete:user", limit: 30, windowMs: 5 * 60 * 1000, blockMs: 5 * 60 * 1000 },
      ],
    });

    const commentId = formData.get("commentId")?.toString() ?? "";
    if (!commentId) return { success: false, message: "Missing comment ID." };

    const deleted = await deleteComment(viewer.id, commentId);
    if (!deleted) return { success: false, message: "Comment not found or not yours." };

    revalidatePath("/slips");
    revalidatePath("/today");
    return { success: true, message: "Comment deleted." };
  } catch (error) {
    return { success: false, message: safeMessage(error, "Failed to delete comment.") };
  }
}
