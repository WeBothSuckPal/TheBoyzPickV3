"use client";

import { saveLockPickAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LockPickForm({
  options,
  currentSelectionId,
  currentNote,
}: {
  options: { value: string; label: string }[];
  currentSelectionId?: string;
  currentNote?: string;
}) {
  return (
    <ActionForm action={saveLockPickAction} resetOnSuccess={false}>
      {(pending) => (
        <div className="space-y-3">
          <select
            name="selectionId"
            className="h-11 w-full rounded-2xl border border-white/12 bg-black/15 px-4 text-sm text-white outline-none"
            defaultValue={currentSelectionId ?? ""}
          >
            <option value="">Select a spread</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Input
            name="note"
            type="text"
            maxLength={140}
            placeholder="Your reasoning… 140 chars max"
            defaultValue={currentNote ?? ""}
          />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Save lock"}
          </Button>
        </div>
      )}
    </ActionForm>
  );
}
