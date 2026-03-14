"use client";

import { updateProfileAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProfileForm({
  displayName,
  nickname,
}: {
  displayName: string;
  nickname: string | null;
}) {
  return (
    <ActionForm action={updateProfileAction} resetOnSuccess={false}>
      {(pending) => (
        <div className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="displayName" className="text-sm font-medium text-white">
              Real Name <span className="text-[var(--accent)]">*</span>
            </label>
            <Input
              id="displayName"
              name="displayName"
              defaultValue={displayName === "Club Member" ? "" : displayName}
              placeholder="Your full name (admin-only)"
              required
              minLength={2}
              maxLength={50}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Only the commissioner can see this. Used for identity verification.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="nickname" className="text-sm font-medium text-white">
              Nickname <span className="text-[var(--muted-foreground)]">(optional)</span>
            </label>
            <Input
              id="nickname"
              name="nickname"
              defaultValue={nickname ?? ""}
              placeholder="What other members see"
              minLength={2}
              maxLength={20}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Shown on leaderboards, lock feed, and rivalry boards. Leave blank to use your real name.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Save Profile"}
          </Button>
        </div>
      )}
    </ActionForm>
  );
}
