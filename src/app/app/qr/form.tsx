"use client";

import { useActionState } from "react";
import { createQr } from "@/lib/actions";
import { ErrorNote, Field, inputClass } from "@/components/ui";

export function QrForm({ canCreate }: { canCreate: boolean }) {
  const [state, action, pending] = useActionState(createQr, null);
  if (!canCreate) return null;

  return (
    <form action={action} className="rounded border border-line bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
        <Field label="Name">
          <input name="name" required maxLength={60} placeholder="Counter 1" className={inputClass} />
        </Field>
        <Field label="Amount (₹)" hint="Blank = any amount.">
          <input name="amount" type="number" step="0.01" min="1" placeholder="any" className={inputClass} />
        </Field>
      </div>

      {state?.error && (
        <div className="mt-4">
          <ErrorNote>{state.error}</ErrorNote>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded bg-ink px-5 py-2.5 text-[15px] text-paper transition-colors hover:bg-black disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create QR"}
      </button>
    </form>
  );
}
