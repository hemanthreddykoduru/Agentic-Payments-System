import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { confirmPayment, rejectPayment } from "@/lib/actions";
import { EmptyState, Money } from "@/components/ui";
import { formatPaise } from "@/lib/enums";
import { NEVER } from "@/lib/nav";

export const dynamic = "force-dynamic";

const startOfToday = () => new Date(new Date().setHours(0, 0, 0, 0));
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000);

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const merchantId = session.merchantId;

  const [pending, today, week, month, unconfirmedValue, merchant] = await Promise.all([
    prisma.payment.findMany({
      where: { merchantId, status: "awaiting_confirmation" },
      include: { order: true, customer: true },
      orderBy: { utrSubmittedAt: "asc" },
    }),
    prisma.ledgerEntry.aggregate({
      where: { merchantId, account: "bank_upi", createdAt: { gte: startOfToday() } },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { merchantId, account: "bank_upi", createdAt: { gte: daysAgo(7) } },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { merchantId, account: "bank_upi", createdAt: { gte: daysAgo(30) } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { merchantId, status: "awaiting_confirmation" },
      _sum: { amount: true },
    }),
    prisma.merchant.findUnique({ where: { id: merchantId } }),
  ]);

  const readOnly = session.role === "view_only";

  return (
    <>
      {/* Razorpay opens with Settlement Overview. We have nothing to settle — the money
          is already in their bank — so the equivalent strip is what actually arrived. */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-[22px]">Received overview</h1>
          <Link href="/app/orders" className="ui text-[11px] text-muted hover:text-accent-deep">
            View all orders →
          </Link>
        </div>

        <dl className="mt-4 grid gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Today", today._sum.amount ?? 0, null],
            ["Last 7 days", week._sum.amount ?? 0, null],
            ["Last 30 days", month._sum.amount ?? 0, null],
            [
              "Awaiting your confirmation",
              unconfirmedValue._sum.amount ?? 0,
              `${pending.length} payment${pending.length === 1 ? "" : "s"}`,
            ],
          ].map(([label, value, note]) => (
            <div key={label as string} className="bg-card px-5 py-5">
              <dt className="ui text-[10px] uppercase tracking-[0.1em] text-muted">
                {label as string}
              </dt>
              <dd className="tight mt-1.5 text-[26px] tabular-nums">
                {formatPaise(value as number)}
              </dd>
              {note && <p className="ui mt-1 text-[10.5px] text-accent-deep">{note as string}</p>}
            </div>
          ))}
        </dl>

        <p className="ui mt-3 text-[11px] text-muted">
          Confirmed receipts into {merchant?.vpa ?? "your UPI ID"}. Money reaches your bank directly
          — there is no balance held here, and nothing to settle.
        </p>
      </section>

      {/* The confirmation queue: the one thing this app exists to do. */}
      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[22px]">
            {pending.length === 0
              ? "Nothing waiting on you"
              : `${pending.length} payment${pending.length === 1 ? "" : "s"} to check`}
          </h2>
          {pending.length > 0 && (
            <p className="ui text-[11px] text-muted">Open your bank app and match each credit</p>
          )}
        </div>

        <div className="mt-5">
          {pending.length === 0 ? (
            <EmptyState
              title="No payments waiting"
              hint="When a customer pays and submits their UPI reference, it lands here for you to confirm against your bank app."
            />
          ) : (
            <ul className="border-t border-line">
              {pending.map((p) => (
                <li
                  key={p.id}
                  className="grid gap-3 border-b border-line py-4 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <Money paise={p.amount} className="text-[19px] font-medium" />
                      <span className="text-[14px] text-muted">{p.order.description}</span>
                    </div>
                    <div className="ui mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                      <span>
                        UTR <b className="font-medium text-ink">{p.utr}</b>
                      </span>
                      {p.payerVpa && <span>{p.payerVpa}</span>}
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
                        <button className="rounded bg-ok px-4 py-2 text-[14px] text-white transition-opacity hover:opacity-90">
                          It arrived
                        </button>
                      </form>
                      <form action={rejectPayment}>
                        <input type="hidden" name="paymentId" value={p.id} />
                        <button className="rounded border border-line px-4 py-2 text-[14px] transition-colors hover:border-no hover:text-no">
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
      </section>

      {/* Stated once, here, so it never has to be argued again in a planning session. */}
      <section className="mt-14 rounded border border-line bg-card p-6">
        <h2 className="text-[16px]">What this dashboard will never have</h2>
        <p className="mt-2 max-w-[62ch] text-[13.5px] leading-relaxed text-muted">
          Every one of these needs us to hold your money first. We don&apos;t, which is why you can
          use this without a payment-aggregator account.
        </p>
        <dl className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {NEVER.map(([name, why]) => (
            <div key={name} className="border-t border-line pt-3">
              <dt className="text-[13.5px] font-semibold">{name}</dt>
              <dd className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{why}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
