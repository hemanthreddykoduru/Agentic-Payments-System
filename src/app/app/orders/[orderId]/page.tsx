import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { confirmPayment, rejectPayment } from "@/lib/actions";
import { Money, StatusPill } from "@/components/ui";
import { CopyLink } from "@/components/copy-link";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: PageProps<"/app/orders/[orderId]">) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { orderId } = await params;
  const order = await prisma.order.findFirst({
    // merchantId in the where clause, not checked after — a tenant cannot read
    // another tenant's order by guessing an id.
    where: { id: orderId, merchantId: session.merchantId },
    include: { payments: { orderBy: { createdAt: "desc" } }, customer: true },
  });
  if (!order) notFound();

  const qr = await QRCode.toDataURL(order.upiIntent, { margin: 1, width: 320 });
  const readOnly = session.role === "view_only";

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <div>
        <Link href="/app/orders" className="ui text-[11px] text-muted hover:text-ink">
          ← Orders
        </Link>

        <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h1 className="text-[32px]">
            <Money paise={order.amount} />
          </h1>
          <StatusPill status={order.status} />
        </div>
        <p className="mt-1 text-[15px] text-muted">{order.description}</p>
        <code className="ui mt-3 block text-[11px] text-muted">{order.id}</code>

        <div className="mt-8">
          <p className="ui text-[10.5px] uppercase tracking-[0.1em] text-muted">Share this link</p>
          <div className="mt-2">
            <CopyLink path={`/pay/${order.id}`} />
          </div>
        </div>

        <div className="mt-10">
          <p className="ui text-[10.5px] uppercase tracking-[0.1em] text-muted">Attempts</p>
          {order.payments.length === 0 ? (
            <p className="mt-3 text-[13.5px] text-muted">
              Nobody has submitted a payment reference yet.
            </p>
          ) : (
            <ul className="mt-3 border-t border-line">
              {order.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 border-b border-line py-3.5">
                  <code className="ui text-[12px]">{p.utr}</code>
                  <StatusPill status={p.status} />
                  <span className="ui text-[11px] text-muted">
                    {p.utrSubmittedAt?.toLocaleString("en-IN", {
                      day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
                    })}
                  </span>
                  {p.rejectedReason && (
                    <span className="text-[12px] text-no">{p.rejectedReason}</span>
                  )}
                  {p.status === "awaiting_confirmation" && !readOnly && (
                    <span className="ml-auto flex gap-2">
                      <form action={confirmPayment}>
                        <input type="hidden" name="paymentId" value={p.id} />
                        <button className="rounded bg-ok px-3 py-1.5 text-[13px] text-white">
                          It arrived
                        </button>
                      </form>
                      <form action={rejectPayment}>
                        <input type="hidden" name="paymentId" value={p.id} />
                        <button className="rounded border border-line px-3 py-1.5 text-[13px] hover:border-no hover:text-no">
                          Not found
                        </button>
                      </form>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <aside className="rounded border border-line bg-card p-5">
        <p className="ui text-[10.5px] uppercase tracking-[0.1em] text-muted">Customer scans this</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URI, no loader needed */}
        <img src={qr} alt="UPI QR code for this order" className="mt-3 w-full rounded" />
        <p className="ui mt-3 break-all text-[10px] leading-relaxed text-muted">{order.upiIntent}</p>
      </aside>
    </div>
  );
}
