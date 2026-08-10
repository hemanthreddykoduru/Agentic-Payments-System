import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { EmptyState, Money, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: PageProps<"/app/customers/[customerId]">) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { customerId } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, merchantId: session.merchantId },
    include: { orders: { orderBy: { createdAt: "desc" }, take: 50 } },
  });
  if (!customer) notFound();

  const paid = customer.orders.filter((o) => o.status === "paid");
  const total = paid.reduce((s, o) => s + o.amount, 0);

  return (
    <div className="max-w-[720px]">
      <Link href="/app/customers" className="ui text-[11px] text-muted hover:text-ink">
        ← Customers
      </Link>

      <h1 className="mt-4 text-[28px]">{customer.name}</h1>
      <p className="ui mt-1 flex flex-wrap gap-x-4 text-[12px] text-muted">
        {customer.email && <span>{customer.email}</span>}
        {customer.contact && <span>{customer.contact}</span>}
      </p>

      <dl className="mt-7 grid gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-3">
        {[
          ["Paid", <Money key="p" paise={total} />],
          ["Orders", customer.orders.length],
          ["Since", customer.createdAt.toLocaleDateString("en-IN", { month: "short", year: "numeric" })],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-card px-5 py-4">
            <dt className="ui text-[10px] uppercase tracking-[0.1em] text-muted">{label as string}</dt>
            <dd className="tight mt-1 text-[20px] tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-9">
        <p className="ui text-[10.5px] uppercase tracking-[0.1em] text-muted">Orders</p>
        {customer.orders.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No orders yet" hint="Orders you attach to this customer show up here." />
          </div>
        ) : (
          <ul className="mt-3 border-t border-line">
            {customer.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 border-b border-line py-3">
                <Link href={`/app/orders/${o.id}`} className="ui text-[12px] hover:text-accent-deep">
                  {o.id}
                </Link>
                <span className="text-[13.5px] text-muted">{o.description}</span>
                <Money paise={o.amount} className="ml-auto" />
                <StatusPill status={o.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
