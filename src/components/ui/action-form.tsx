"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useToast } from "./use-toast";

export type ActionResult = { success: boolean; message: string } | null;

export function ActionForm({
  action,
  children,
  resetOnSuccess = true,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: (pending: boolean) => ReactNode;
  resetOnSuccess?: boolean;
}) {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const lastResultRef = useRef<ActionResult>(null);

  const [result, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (result && result !== lastResultRef.current) {
      lastResultRef.current = result;
      toast(result.message, result.success ? "success" : "error");
      if (result.success && resetOnSuccess) {
        formRef.current?.reset();
      }
    }
  }, [result, toast, resetOnSuccess]);

  return (
    <form ref={formRef} action={formAction}>
      {children(pending)}
    </form>
  );
}
