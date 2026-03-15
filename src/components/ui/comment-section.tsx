"use client";

import { useState } from "react";
import { addCommentAction, deleteCommentAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CommentView } from "@/lib/types";

export function CommentSection({
  targetType,
  targetId,
  comments,
  viewerUserId,
}: {
  targetType: string;
  targetId: string;
  comments: CommentView[];
  viewerUserId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayComments = expanded ? comments : comments.slice(0, 3);

  return (
    <div className="space-y-2">
      {/* Toggle */}
      {comments.length > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-semibold text-[var(--muted-foreground)] transition hover:text-white"
        >
          💬 {comments.length} comment{comments.length !== 1 ? "s" : ""}
          {comments.length > 3 && !expanded ? " — show all" : ""}
          {expanded && comments.length > 3 ? " — collapse" : ""}
        </button>
      ) : null}

      {/* Comment list */}
      {(expanded || comments.length <= 3) && comments.length > 0 ? (
        <div className="space-y-1.5">
          {displayComments.map((comment) => (
            <div
              key={comment.id}
              className="flex items-start gap-2 rounded-xl border border-white/6 bg-white/3 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-white">{comment.displayName}</span>
                <span className="ml-1.5 text-xs text-[var(--muted-foreground)]">
                  {formatRelativeTime(comment.createdAt)}
                </span>
                <p className="mt-0.5 text-xs leading-relaxed text-white/80 break-words">
                  {comment.body}
                </p>
              </div>
              {comment.userProfileId === viewerUserId ? (
                <DeleteCommentButton commentId={comment.id} />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* Add comment form */}
      <ActionForm action={addCommentAction}>
        {(pending) => (
          <div className="flex items-center gap-2">
            <input type="hidden" name="targetType" value={targetType} />
            <input type="hidden" name="targetId" value={targetId} />
            <Input
              name="body"
              type="text"
              maxLength={280}
              placeholder="Drop a comment…"
              className="h-8 text-xs"
            />
            <Button type="submit" size="sm" disabled={pending} className="shrink-0">
              {pending ? "…" : "Post"}
            </Button>
          </div>
        )}
      </ActionForm>
    </div>
  );
}

function DeleteCommentButton({ commentId }: { commentId: string }) {
  return (
    <ActionForm action={deleteCommentAction} resetOnSuccess={false}>
      {(pending) => (
        <>
          <input type="hidden" name="commentId" value={commentId} />
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-full p-1 text-[var(--muted-foreground)] transition hover:bg-white/10 hover:text-white"
            aria-label="Delete comment"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </>
      )}
    </ActionForm>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
