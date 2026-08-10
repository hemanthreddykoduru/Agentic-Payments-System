"use client";

import { useActionState } from "react";
import { saveSettings } from "@/lib/actions";
import { ErrorNote, Field, inputClass } from "@/components/ui";

export function SettingsForm({
  merchant,
  canEdit,
}: {
  merchant: { name: string; payeeName: string; vpa: string; verified: boolean };
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(saveSettings, null);

  return (
    <>
      <form action={action} className="mt-8 space-y-5">
        <Field label="Your UPI ID" hint="Every QR and payment link pays this. Nothing else.">
          <input
            name="vpa"
            defaultValue={merchant.vpa}
            required
            disabled={!canEdit}
            placeholder="yourshop@ybl"
            className={`${inputClass} ui disabled:opacity-60`}
          />
        </Field>

        <Field label="Business name" hint="Shown on the payment page your customer opens.">
          <input name="name" defaultValue={merchant.name} required disabled={!canEdit} className={`${inputClass} disabled:opacity-60`} />
        </Field>

        <Field label="Payee name" hint="A hint for the UPI app. Your bank decides the name it actually shows.">
          <input name="payeeName" defaultValue={merchant.payeeName} required disabled={!canEdit} maxLength={50} className={`${inputClass} disabled:opacity-60`} />
        </Field>

        {state?.error && <ErrorNote>{state.error}</ErrorNote>}
        {state?.ok && (
          <p className="rounded border border-ok/40 bg-accent-soft px-3 py-2 text-[13px] text-ok">
            Saved.
          </p>
        )}

        {canEdit ? (
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-ink px-5 py-2.5 text-[15px] text-paper transition-colors hover:bg-black disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        ) : (
          <p className="ui text-[11px] text-muted">Only the owner can change these.</p>
        )}
      </form>

      <div className="mt-10 rounded border border-line bg-card p-5">
        <p className="text-[14px] font-semibold">
          {merchant.verified ? "UPI ID verified" : "Verify your UPI ID"}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          {merchant.verified
            ? "You have confirmed a test payment reached this UPI ID. Change the ID and you will need to verify again."
            : "Create a ₹1 order, pay it from your own phone, and confirm it. That proves the QR reaches your bank — the same loop your customers will use, for one rupee."}
        </p>
      </div>

      <div className="mt-6 rounded border border-accent/40 bg-accent-soft p-5">
        <p className="text-[14px] font-semibold text-accent-deep">Use a business UPI ID if you can</p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Most banks do not allow personal UPI IDs for business volume. Heavy inflow into a personal
          account can get it restricted and complicates your tax filing. A current-account or
          merchant VPA avoids both — and many shops can get one even when a payment gateway turns
          them down.
        </p>
      </div>
    </>
  );
}
