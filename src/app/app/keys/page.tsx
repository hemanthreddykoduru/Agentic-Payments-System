import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revokeApiKey } from "@/lib/actions";
import { EmptyState } from "@/components/ui";
import { KeyForm } from "./form";

export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const keys = await prisma.apiKey.findMany({
    where: { merchantId: session.merchantId },
    orderBy: { createdAt: "desc" },
  });
  const isOwner = session.role === "owner";

  return (
    <div className="max-w-[760px]">
      <p className="eyebrow">API keys</p>
      <h1 className="mt-2 text-[28px]">Let your code create orders</h1>
      <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-muted">
        Basic auth over <code className="ui text-ink">key_id:key_secret</code>. The secret is shown
        once, at creation — we store only a hash, so there is no page that can show it again.
      </p>

      <div className="mt-8">
        <KeyForm canCreate={isOwner} />
      </div>

      <div className="mt-10">
        {keys.length === 0 ? (
          <EmptyState title="No API keys yet" hint="Create one above to call the API." />
        ) : (
          <ul className="border-t border-line">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3 border-b border-line py-4">
                <code className="ui text-[12.5px]">{k.keyId}</code>
                <span className="ui rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-muted">
                  {k.mode}
                </span>
                {!k.active && (
                  <span className="ui rounded-full border border-no/40 bg-no-soft px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-no">
                    revoked
                  </span>
                )}
                <span className="ui text-[10.5px] text-muted">
                  secret ends ····{k.secretLast4} ·{" "}
                  {k.lastUsedAt
                    ? `used ${k.lastUsedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                    : "never used"}
                </span>
                {k.active && isOwner && (
                  <form action={revokeApiKey} className="ml-auto">
                    <input type="hidden" name="keyId" value={k.id} />
                    <button className="ui rounded border border-line px-3 py-1.5 text-[11px] transition-colors hover:border-no hover:text-no">
                      Revoke
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-10 rounded border border-line bg-card p-5">
        <p className="text-[14px] font-semibold">Create an order</p>
        <pre className="ui mt-3 overflow-x-auto rounded bg-ink px-4 py-3 text-[11.5px] leading-relaxed text-paper">
{`curl -u ap_test_xxx:SECRET \\
  -H 'content-type: application/json' \\
  -d '{"amount": 95000, "description": "Birthday cake, 1kg"}' \\
  ${"https://your-host"}/v1/orders`}
        </pre>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          <b className="font-semibold text-ink">amount is in paise</b> — 95000 is ₹950.00. The
          response carries <code className="ui">upi_intent</code> and{" "}
          <code className="ui">pay_url</code>; send the customer to the pay_url.
        </p>
        <p className="ui mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">
          GET /v1/orders · GET /v1/orders/:id · GET /v1/payments — all filter by{" "}
          <code>status</code>, and page with <code>count</code> and <code>skip</code>.
        </p>
      </div>
    </div>
  );
}
