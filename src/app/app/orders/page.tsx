import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { EmptyState, Money, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function OrdersPage({ searchParams }: PageProps<"/app/orders">) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where = { merchantId: session.merchantId, ...(status ? { status } : {}) };
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { customer: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);

  const pages = Math.ceil(total / PAGE_SIZE);
  const chips = ["all", "created", "awaiting_confirmation", "paid", "expired", "cancelled"];

  return (
    <>
      <p className="eyebrow">Orders</p>
      <h1 className="mt-2 text-[28px]">
        {total.toLocaleString("en-IN")} order{total === 1 ? "" : "s"}
      </h1>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {chips.map((c) => {
          const active = c === "all" ? !status : status === c;
          return (
            <Link
              key={c}
              href={c === "all" ? "/app/orders" : `/app/orders?status=${c}`}
              className={`ui rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
                active
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-card text-ink hover:border-accent hover:text-accent-deep"
              }`}
            >
              {c.replace(/_/g, " ")}
            </Link>
          );
        })}
      </div>

      <div className="mt-8">
        {orders.length === 0 ? (
          <EmptyState
            title={status ? `No ${status.replace(/_/g, " ")} orders` : "No orders yet"}
            hint="Create one and share the payment link — the customer scans, pays, and submits their UPI reference."
          />
        ) : (
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="ui border-y border-line text-[10px] uppercase tracking-[0.1em] text-muted">
                <th className="py-2.5 text-left font-normal">Order</th>
                <th className="py-2.5 text-left font-normal">For</th>
                <th className="hidden py-2.5 text-left font-normal sm:table-cell">Customer</th>
                <th className="py-2.5 text-right font-normal">Amount</th>
                <th className="py-2.5 text-right font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-line hover:bg-accent-soft/40">
                  <td className="py-3">
                    <Link href={`/app/orders/${o.id}`} className="ui text-[12px] hover:text-accent-deep">
                      {o.id}
                    </Link>
                    <span className="ui block text-[10.5px] text-muted">
                      {o.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </td>
                  <td className="max-w-[24ch] truncate py-3">{o.description}</td>
                  <td className="hidden py-3 text-muted sm:table-cell">{o.customer?.name ?? "—"}</td>
                  <td className="py-3 text-right">
                    <Money paise={o.amount} />
                  </td>
                  <td className="py-3 text-right">
                    <StatusPill status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="ui mt-6 flex items-center justify-between text-[11px] text-muted">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/app/orders?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page - 1) })}`}
                className="rounded border border-line px-3 py-1.5 hover:border-accent"
              >
                Previous
              </Link>
            )}
            {page < pages && (
              <Link
                href={`/app/orders?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page + 1) })}`}
                className="rounded border border-line px-3 py-1.5 hover:border-accent"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
