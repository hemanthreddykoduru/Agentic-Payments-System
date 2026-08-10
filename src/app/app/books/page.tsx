import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { EmptyState } from "@/components/ui";
import { formatPaise } from "@/lib/enums";

export const dynamic = "force-dynamic";

/** Revenue by month, straight off the ledger. Not a separate tally that can drift. */
export default async function BooksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const rows = await prisma.$queryRaw<{ month: Date; received: bigint; payments: bigint }[]>`
    SELECT date_trunc('month', "createdAt") AS month,
           sum(amount)::bigint             AS received,
           count(*)::bigint                AS payments
    FROM   "LedgerEntry"
    WHERE  "merchantId" = ${session.merchantId} AND account = 'bank_upi'
    GROUP  BY 1
    ORDER  BY 1 DESC
  `;

  const total = rows.reduce((s, r) => s + Number(r.received), 0);
  const balanced = await prisma.ledgerEntry.aggregate({
    where: { merchantId: session.merchantId },
    _sum: { amount: true },
  });

  return (
    <div className="max-w-[720px]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">Books</p>
          <h1 className="mt-2 text-[28px]">{formatPaise(total)} received</h1>
        </div>
        <a
          href="/app/books/export"
          className="ui rounded border border-line px-3.5 py-2 text-[11px] transition-colors hover:border-accent hover:text-accent-deep"
        >
          Download CSV
        </a>
      </div>

      <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-muted">
        Every confirmed payment writes two rows — money in, revenue earned. These totals are the
        ledger itself, so they cannot drift from what you actually confirmed.
      </p>

      <div className="mt-8">
        {rows.length === 0 ? (
          <EmptyState
            title="Nothing in the books yet"
            hint="Confirm a payment and it appears here, in the month it arrived."
          />
        ) : (
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="ui border-y border-line text-[10px] uppercase tracking-[0.1em] text-muted">
                <th className="py-2.5 text-left font-normal">Month</th>
                <th className="py-2.5 text-right font-normal">Payments</th>
                <th className="py-2.5 text-right font-normal">Received</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month.toISOString()} className="border-b border-line">
                  <td className="py-3">
                    {r.month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                  </td>
                  <td className="ui py-3 text-right tabular-nums">{Number(r.payments)}</td>
                  <td className="ui py-3 text-right tabular-nums">
                    {formatPaise(Number(r.received))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="ui mt-6 border-t border-line pt-4 text-[11px] text-muted">
        Ledger check: every leg sums to{" "}
        <b className={balanced._sum.amount === 0 ? "text-ok" : "text-no"}>
          {balanced._sum.amount ?? 0}
        </b>
        . A healthy double-entry ledger is exactly zero.
      </p>
    </div>
  );
}
