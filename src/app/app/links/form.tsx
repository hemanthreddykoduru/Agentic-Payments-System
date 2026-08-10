"use client";

import { useActionState } from "react";
import { createLink } from "@/lib/actions";
import { ErrorNote, Field, inputClass } from "@/components/ui";

export function LinkForm({ canCreate }: { canCreate: boolean }) {
  const [state, action, pending] = useActionState(createLink, null);
  if (!canCreate) return null;

  return (
    <form action={action} className="rounded border border-line bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
        <Field label="What it's for">
          <input name="description" required maxLength={140} placeholder="Birthday cake, 1kg" className={inputClass} />
        </Field>
        <Field label="Amount (₹)" hint="Leave blank to let them choose.">
          <input name="amount" type="number" step="0.01" min="1" placeholder="any" className={inputClass} />
        </Field>
      </div>

      <label className="mt-4 flex items-center gap-2 text-[13.5px]">
        <input type="checkbox" name="reusable" className="size-4 accent-[#437A4D]" />
        Reusable — many people can pay this link
      </label>

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
        {pending ? "Creating…" : "Create link"}
      </button>
    </form>
  );
}
