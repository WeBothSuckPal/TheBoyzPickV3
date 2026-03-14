"use client";

import { useState } from "react";
import { approveTopUpAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatCurrency } from "@/lib/utils";

export function ApproveButton({
  requestId,
  amountCents,
}: {
  requestId: string;
  amountCents: number;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setConfirmOpen(true)}>
        Approve
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Approve top-up?"
        description={`This will credit ${formatCurrency(amountCents)} to the member's wallet. This action cannot be undone.`}
        confirmLabel="Approve"
        onConfirm={() => {
          // Submit the hidden form
          const form = document.getElementById(`approve-form-${requestId}`) as HTMLFormElement;
          form?.requestSubmit();
        }}
      />
      <ActionForm action={approveTopUpAction}>
        {(pending) => (
          <span id={`approve-form-${requestId}`} className="hidden">
            <input type="hidden" name="requestId" value={requestId} />
            <button type="submit" disabled={pending} />
          </span>
        )}
      </ActionForm>
    </>
  );
}
