"use client";

import { useActionState, useState } from "react";
import { createApiKey } from "@/lib/actions";
import { ErrorNote } from "@/components/ui";

export function KeyForm({ canCreate }: { canCreate: boolean }) {
  const [state, action, pending] = useActionState(createApiKey, null);
  const [copied, setCopied] = useState(false);

  if (!canCreate) {
    return <p className="ui text-[11px] text-muted">Only the owner can create API keys.</p>;
  }

  return (
    <>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="ui block text-[10.5px] uppercase tracking-[0.1em] text-muted">Mode</span>
          <select
            name="mode"
            defaultValue="test"
            className="mt-1.5 rounded border border-line bg-card px-3 py-2.5 text-[15px] outline-none focus:border-accent"
          >
            <option value="test">test</option>
            <option value="live">live</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-ink px-5 py-2.5 text-[15px] text-paper transition-colors hover:bg-black disabled:opacity-50"
        >
          {pending ? "Generating…" : "Generate key"}
        </button>
      </form>

      {state && "error" in state && state.error && (
        <div className="mt-4">
          <ErrorNote>{state.error}</ErrorNote>
        </div>
      )}

      {state && "secret" in state && (
        <div className="mt-5 rounded border border-accent bg-accent-soft p-5">
          <p className="text-[14px] font-semibold text-accent-deep">
            Copy this now — it will not be shown again
          </p>
          <pre className="ui mt-3 overflow-x-auto rounded border border-line bg-card px-4 py-3 text-[12px]">
            {state.keyId}:{state.secret}
          </pre>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${state.keyId}:${state.secret}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="ui mt-3 cursor-pointer rounded border border-line bg-card px-3 py-1.5 text-[11px] transition-colors hover:border-accent hover:text-accent-deep"
          >
            {copied ? "copied ✓" : "Copy key:secret"}
          </button>
        </div>
      )}
    </>
  );
}
