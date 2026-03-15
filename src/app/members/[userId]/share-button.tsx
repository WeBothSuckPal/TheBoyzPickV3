"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ShareButton() {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("failed");
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  const label = status === "copied" ? "Copied!" : status === "failed" ? "Copy failed" : "Share";

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleCopy}
      aria-label="Copy profile link to clipboard"
    >
      <span aria-live="polite">{label}</span>
    </Button>
  );
}
