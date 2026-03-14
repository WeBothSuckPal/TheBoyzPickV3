"use client";

import { useMemo } from "react";

export function IdempotencyField() {
  const key = useMemo(() => crypto.randomUUID(), []);
  return <input type="hidden" name="idempotencyKey" value={key} />;
}
