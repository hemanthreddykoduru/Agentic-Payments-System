import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { confirmPayment, rejectPayment } from "@/lib/actions";
import { EmptyState, Money } from "@/components/ui";
import { formatPaise } from "@/lib/enums";

export const dynamic = "force-dynamic";

/** The confirmation queue. This is the app's whole job, so it is the home screen. */
export default async function QueuePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [pending, todayReceived] = await Promise.all([
    prisma.payment.findMany({
      where: { merchantId: session.merchantId, status: "awaiting_confirmation" },
      include: { order: true, customer: true },
      orderBy: { utrSubmittedAt: "asc" },
    }),
    prisma.ledgerEntry.aggregate({
      where: {
        merchantId: session.merchantId,
        account: "bank_upi",
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      _sum: { amount: true },
    }),
  ]);

  const readOnly = session.role === "view_only";

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="eyebrow">To confirm</p>
          <h1 className="mt-2 text-[28px]">
            {pending.length === 0
              ? "Nothing waiting"
              : `${pending.length} payment${pending.length === 1 ? "" : "s"} to check`}
          </h1>
        </div>
        <div className="text-right">
          <p className="ui text-[10.5px] uppercase tracking-[0.1em] text-muted">Received today</p>
          <p className="tight mt-1 text-[24px] tabular-nums">
            {formatPaise(todayReceived._sum.amount ?? 0)}
          </p>
        </div>
      </div>

      <p className="mt-4 max-w-[62ch] text-[14px] leading-relaxed text-muted">
        Open your bank app and check each credit below. We cannot see your bank, so nothing is marked
        paid until you say it arrived.
      </p>

      <div className="mt-8">
        {pending.length === 0 ? (
          <EmptyState
            title="No payments waiting on you"
            hint="When a customer pays and submits their UPI reference, it appears here for you to confirm against your bank app."
          />
        ) : (
          <ul className="border-t border-line">
            {pending.map((p) => (
              <li
                key={p.id}
                className="grid gap-4 border-b border-line py-5 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <Money paise={p.amount} className="text-[20px] font-medium" />
                    <span className="text-[14px] text-muted">{p.order.description}</span>
                  </div>
                  <div className="ui mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                    <span>
                      UTR <b className="font-medium text-ink">{p.utr}</b>
                    </span>
                    {p.payerVpa && <span>from {p.payerVpa}</span>}
                    {p.customer && <span>{p.customer.name}</span>}
                    <span>
                      {p.utrSubmittedAt?.toLocaleString("en-IN", {
                        day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {readOnly ? (
                  <span className="ui text-[11px] text-muted">view only</span>
                ) : (
                  <div className="flex gap-2">
                    <form action={confirmPayment}>
                      <input type="hidden" name="paymentId" value={p.id} />
                      <button
                        type="submit"
                        className="rounded bg-ok px-4 py-2 text-[14px] text-white transition-opacity hover:opacity-90"
                      >
                        It arrived
                      </button>
                    </form>
                    <form action={rejectPayment}>
                      <input type="hidden" name="paymentId" value={p.id} />
                      <button
                        type="submit"
                        className="rounded border border-line px-4 py-2 text-[14px] transition-colors hover:border-no hover:text-no"
                      >
                        Not found
                      </button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
