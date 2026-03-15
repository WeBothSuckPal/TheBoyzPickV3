"use client";

import { useOptimistic, useTransition } from "react";
import { toggleReactionAction } from "@/app/actions";
import type { ReactionEmoji, ReactionSummary } from "@/lib/types";

const ALL_EMOJIS: ReactionEmoji[] = ["🔥", "🤡", "💰", "💀", "🎯"];

export function ReactionBar({
  targetType,
  targetId,
  reactions,
}: {
  targetType: string;
  targetId: string;
  reactions: ReactionSummary[];
}) {
  const [optimistic, setOptimistic] = useOptimistic(
    reactions,
    (current: ReactionSummary[], emoji: ReactionEmoji) => {
      const existing = current.find((r) => r.emoji === emoji);
      if (existing?.userReacted) {
        // Remove reaction
        const newCount = existing.count - 1;
        return newCount <= 0
          ? current.filter((r) => r.emoji !== emoji)
          : current.map((r) => (r.emoji === emoji ? { ...r, count: newCount, userReacted: false } : r));
      }
      // Add reaction
      if (existing) {
        return current.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, userReacted: true } : r));
      }
      return [...current, { emoji, count: 1, userReacted: true }];
    },
  );

  const [, startTransition] = useTransition();

  function handleReaction(emoji: ReactionEmoji) {
    startTransition(async () => {
      setOptimistic(emoji);
      const formData = new FormData();
      formData.set("targetType", targetType);
      formData.set("targetId", targetId);
      formData.set("emoji", emoji);
      await toggleReactionAction(null, formData);
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_EMOJIS.map((emoji) => {
        const reaction = optimistic.find((r) => r.emoji === emoji);
        const count = reaction?.count ?? 0;
        const active = reaction?.userReacted ?? false;

        return (
          <button
            key={emoji}
            type="button"
            onClick={() => handleReaction(emoji)}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-150 active:scale-95 ${
              active
                ? "border border-[var(--accent)]/40 bg-[var(--accent)]/15 text-white shadow-[0_0_12px_rgba(204,41,54,0.12)]"
                : "border border-white/8 bg-white/4 text-[var(--muted-foreground)] hover:border-white/20 hover:bg-white/8"
            }`}
          >
            <span>{emoji}</span>
            {count > 0 ? <span className="font-mono text-[10px]">{count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
