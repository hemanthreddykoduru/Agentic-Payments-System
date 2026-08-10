"use client";

import { useActionState } from "react";
import { submitUtr } from "@/lib/actions";
import { ErrorNote, inputClass } from "@/components/ui";

export function UtrForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(submitUtr, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input
        name="utr"
        inputMode="numeric"
        pattern="\d{12}"
        maxLength={12}
        required
        placeholder="12-digit reference"
        aria-label="UPI reference number"
        className={`${inputClass} ui tracking-[0.08em]`}
      />
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-ink px-4 py-3 text-[15px] text-paper transition-colors hover:bg-accent disabled:opacity-50"
      >
        {pending ? "Submitting…" : "I've paid"}
      </button>
    </form>
  );
}
