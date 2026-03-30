"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { CheckCircle, MinusCircle, XCircle } from "lucide-react";

import { getPusherClient } from "@/lib/pusher";
import { formatCurrency } from "@/lib/utils";

type SlipResult = "won" | "lost" | "push" | "void";

interface SettlementToast {
  id: string;
  result: SlipResult;
  payoutCents: number;
}

export function SettlementListener() {
  const { user } = useUser();
  const userId = user?.id;
  const [toasts, setToasts] = useState<SettlementToast[]>([]);
  const seenIds = useRef(new Set<string>());
  const timeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!userId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = `user-${userId}`;
    const channel = pusher.subscribe(channelName);

    channel.bind(
      "slip.settled",
      (data: { slipId: string; result: SlipResult; payoutCents: number }) => {
        if (seenIds.current.has(data.slipId)) return;
        seenIds.current.add(data.slipId);

        const toast: SettlementToast = {
          id: data.slipId,
          result: data.result,
          payoutCents: data.payoutCents,
        };

        setToasts((previous) => [...previous.slice(-2), toast]);

        const timeoutId = setTimeout(() => {
          setToasts((previous) => previous.filter((entry) => entry.id !== toast.id));
        }, 6000);

        timeoutIds.current.push(timeoutId);
      },
    );

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      timeoutIds.current.forEach(clearTimeout);
      timeoutIds.current = [];
    };
  }, [userId]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`animate-fade-in flex items-center gap-3 rounded-2xl border px-5 py-4 text-white shadow-lg backdrop-blur-sm ${
            toast.result === "won"
              ? "border-green-500/30 bg-green-500/15"
              : toast.result === "lost"
                ? "border-[var(--accent)]/30 bg-[var(--accent)]/15"
                : "border-white/15 bg-[var(--panel)]"
          }`}
        >
          {toast.result === "won" ? (
            <CheckCircle className="size-5 shrink-0 text-green-400" />
          ) : toast.result === "lost" ? (
            <XCircle className="size-5 shrink-0 text-[var(--accent)]" />
          ) : (
            <MinusCircle className="size-5 shrink-0 text-[var(--muted-foreground)]" />
          )}
          <div>
            <div className="text-sm font-semibold">
              {toast.result === "won" && `Your slip WON - +${formatCurrency(toast.payoutCents)}`}
              {toast.result === "lost" && "Your slip LOST"}
              {toast.result === "push" && "Your slip PUSHED - stake returned"}
              {toast.result === "void" && "Your slip was voided - stake returned"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
