"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions";
import { ErrorNote, Field, inputClass } from "@/components/ui";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);

  return (
    <main className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center px-6 py-16">
      <p className="eyebrow">Agentic Payment</p>
      <h1 className="mt-3 text-[28px]">Sign in</h1>

      <form action={action} className="mt-8 space-y-4">
        <Field label="Email">
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </Field>
        <Field label="Password">
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </Field>

        {state?.error && <ErrorNote>{state.error}</ErrorNote>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-ink px-4 py-3 text-[15px] text-paper transition-colors hover:bg-black disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="ui mt-8 border-t border-line pt-4 text-[11px] leading-relaxed text-muted">
        Seeded demo account:
        <br />
        owner@sunrisebakery.test / password123
      </p>
    </main>
  );
}
