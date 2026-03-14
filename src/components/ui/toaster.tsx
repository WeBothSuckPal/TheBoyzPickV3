"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

import { ToastContext, useToastState, type Toast } from "./use-toast";

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
} as const;

const colors = {
  success: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
  error: "border-red-500/40 bg-red-500/15 text-red-400",
  info: "border-white/20 bg-white/10 text-white",
} as const;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = icons[toast.type];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-300 ${colors[toast.type]} ${visible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"}`}
    >
      <Icon className="size-4 shrink-0" />
      <span className="text-sm font-medium">{toast.message}</span>
      <button onClick={onDismiss} className="ml-auto shrink-0 rounded-full p-1 transition hover:bg-white/10">
        <X className="size-3" />
      </button>
    </div>
  );
}

function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || toasts.length === 0) return null;

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2" style={{ maxWidth: "24rem" }}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>,
    document.body,
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const state = useToastState();

  return (
    <ToastContext value={state}>
      {children}
      <ToastContainer toasts={state.toasts} dismiss={state.dismiss} />
    </ToastContext>
  );
}
