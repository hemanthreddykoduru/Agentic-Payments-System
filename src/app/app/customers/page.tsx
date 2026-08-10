import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { EmptyState, Money } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const customers = await prisma.customer.findMany({
    where: { merchantId: session.merchantId },
    include: {
      _count: { select: { orders: true } },
      payments: { where: { status: "paid" }, select: { amount: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const withTotals = customers
    .map((c) => ({ ...c, paid: c.payments.reduce((s, p) => s + p.amount, 0) }))
    .sort((a, b) => b.paid - a.paid);

  return (
    <div className="max-w-[760px]">
      <p className="eyebrow">Customers</p>
      <h1 className="mt-2 text-[28px]">
        {customers.length} customer{customers.length === 1 ? "" : "s"}
      </h1>

      <div className="mt-8">
        {withTotals.length === 0 ? (
          <EmptyState
            title="No customers yet"
            hint="Attach a customer to an order and they will appear here with everything they have paid."
          />
        ) : (
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="ui border-y border-line text-[10px] uppercase tracking-[0.1em] text-muted">
                <th className="py-2.5 text-left font-normal">Name</th>
                <th className="hidden py-2.5 text-left font-normal sm:table-cell">Contact</th>
                <th className="py-2.5 text-right font-normal">Orders</th>
                <th className="py-2.5 text-right font-normal">Paid</th>
              </tr>
            </thead>
            <tbody>
              {withTotals.map((c) => (
                <tr key={c.id} className="border-b border-line hover:bg-accent-soft/40">
                  <td className="py-3">
                    <Link href={`/app/customers/${c.id}`} className="hover:text-accent-deep">
                      {c.name}
                    </Link>
                    <span className="ui block text-[10.5px] text-muted">{c.email}</span>
                  </td>
                  <td className="ui hidden py-3 text-[12px] text-muted sm:table-cell">
                    {c.contact ?? "—"}
                  </td>
                  <td className="ui py-3 text-right tabular-nums">{c._count.orders}</td>
                  <td className="py-3 text-right">
                    <Money paise={c.paid} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
