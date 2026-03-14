"use client";

import { submitTopUpRequestAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { IdempotencyField } from "@/components/ui/idempotency-field";
import { Input } from "@/components/ui/input";

export function TopUpForm() {
  return (
    <ActionForm action={submitTopUpRequestAction}>
      {(pending) => (
        <div className="space-y-3">
          <IdempotencyField />
          <Input name="amount" type="number" min={5} max={500} placeholder="Amount in dollars" />
          <Input name="note" placeholder="Optional note for the commissioner" />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      )}
    </ActionForm>
  );
}
