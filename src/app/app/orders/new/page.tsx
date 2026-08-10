"use client";

import { useActionState } from "react";
import { createOrder } from "@/lib/actions";
import { ErrorNote, Field, inputClass } from "@/components/ui";

export default function NewOrderPage() {
  const [state, action, pending] = useActionState(createOrder, null);

  return (
    <div className="max-w-[440px]">
      <p className="eyebrow">New order</p>
      <h1 className="mt-2 text-[28px]">What are they paying for?</h1>

      <form action={action} className="mt-8 space-y-5">
        <Field label="Amount (₹)" hint="The QR will ask for exactly this.">
          <input
            name="amount"
            type="number"
            step="0.01"
            min="1"
            max="200000"
            required
            autoFocus
            placeholder="950.00"
            className={inputClass}
          />
        </Field>

        <Field label="What it's for" hint="The customer sees this on the payment page.">
          <input
            name="description"
            type="text"
            maxLength={140}
            required
            placeholder="Birthday cake, 1kg"
            className={inputClass}
          />
        </Field>

        {state?.error && <ErrorNote>{state.error}</ErrorNote>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-ink px-4 py-3 text-[15px] text-paper transition-colors hover:bg-black disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create payment link"}
        </button>
      </form>

      <p className="ui mt-6 border-t border-line pt-4 text-[11px] leading-relaxed text-muted">
        The link expires in 30 minutes. Money goes straight to your UPI ID — we never hold it, so you
        confirm each payment against your own bank app.
      </p>
    </div>
  );
}
