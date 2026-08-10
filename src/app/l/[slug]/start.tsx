"use client";

import { useActionState } from "react";
import { orderFromLink } from "@/lib/actions";
import { ErrorNote, Field, inputClass } from "@/components/ui";

export function StartPayment({ slug, needsAmount }: { slug: string; needsAmount: boolean }) {
  const [state, action, pending] = useActionState(orderFromLink, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />

      {needsAmount && (
        <Field label="Amount (₹)">
          <input
            name="amount"
            type="number"
            step="0.01"
            min="1"
            max="200000"
            required
            autoFocus
            className={inputClass}
          />
        </Field>
      )}

      {state?.error && <ErrorNote>{state.error}</ErrorNote>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-ink px-4 py-3 text-[15px] text-paper transition-colors hover:bg-black disabled:opacity-50"
      >
        {pending ? "Preparing…" : "Continue to pay"}
      </button>
    </form>
  );
}
