"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "default",
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: "default" | "danger";
  onConfirm: () => void;
  children?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const confirmColors =
    variant === "danger"
      ? "border-red-500/40 bg-red-500/15 text-red-400 hover:bg-red-500/25"
      : "border-[var(--accent)]/40 bg-[var(--accent)]/15 text-white hover:bg-[var(--accent)]/25";

  return (
    <dialog
      ref={dialogRef}
      onClose={() => onOpenChange(false)}
      className="fixed inset-0 z-[9998] m-auto max-w-md rounded-[28px] border border-white/10 bg-[var(--panel-strong)] p-0 text-white shadow-2xl"
    >
      <div className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? (
          <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
        ) : null}
        {children}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-[var(--muted-foreground)] transition hover:bg-white/10 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className={`rounded-2xl border px-5 py-2.5 text-sm font-semibold transition ${confirmColors}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
