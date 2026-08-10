import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { formatPaise } from "@/lib/enums";
import { UtrForm } from "./utr-form";

export const dynamic = "force-dynamic";

/** The only page a customer ever sees. No login, no account, no app to install. */
export default async function PayPage({ params }: PageProps<"/pay/[orderId]"> ) {
  const { orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { merchant: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) notFound();

  const latest = order.payments[0];
  const qr = await QRCode.toDataURL(order.upiIntent, { margin: 1, width: 400 });
  const expired =
    order.status === "expired" ||
    (order.status === "created" && order.expiresAt !== null && order.expiresAt < new Date());

  return (
    <main className="mx-auto w-full max-w-[420px] flex-1 px-6 py-12">
      <p className="eyebrow">{order.merchant.payeeName ?? order.merchant.name}</p>
      <h1 className="mt-3 text-[34px]">{formatPaise(order.amount)}</h1>
      <p className="mt-1 text-[15px] text-muted">{order.description}</p>

      {order.status === "paid" ? (
        <div className="mt-8 rounded border border-ok/40 bg-[#EAF5EE] p-6 text-center">
          <p className="tight text-[20px] text-ok">Payment confirmed</p>
          <p className="mt-2 text-[13.5px] text-muted">
            {order.merchant.name} has confirmed this payment arrived. Nothing more to do.
          </p>
        </div>
      ) : expired ? (
        <div className="mt-8 rounded border border-line bg-card p-6 text-center">
          <p className="tight text-[18px]">This link has expired</p>
          <p className="mt-2 text-[13.5px] text-muted">
            Ask {order.merchant.name} for a fresh payment link.
          </p>
        </div>
      ) : latest?.status === "awaiting_confirmation" ? (
        <div className="mt-8 rounded border border-accent/40 bg-accent-soft p-6">
          <p className="tight text-[18px] text-accent-deep">Waiting on {order.merchant.name}</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            We&apos;ve recorded reference <code className="ui text-ink">{latest.utr}</code>. They
            check their bank and confirm — usually within a few minutes. You can close this page.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-7 rounded border border-line bg-card p-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URI, no loader needed */}
            <img src={qr} alt="Scan to pay with any UPI app" className="w-full rounded" />
            <p className="ui mt-3 text-center text-[11px] text-muted">
              Scan with any UPI app · pays {order.merchant.vpa}
            </p>
            <a
              href={order.upiIntent}
              className="mt-4 block rounded bg-ink px-4 py-3 text-center text-[15px] text-paper transition-colors hover:bg-accent sm:hidden"
            >
              Open a UPI app
            </a>
          </div>

          {latest?.status === "rejected" && (
            <p className="mt-5 rounded border border-no/40 bg-no-soft px-3 py-2 text-[13px] text-no">
              {order.merchant.name} could not find that payment: {latest.rejectedReason}. Check the
              reference and try again.
            </p>
          )}

          <div className="mt-7">
            <p className="text-[14px] font-semibold">After you pay</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
              Your UPI app shows a 12-digit reference number — sometimes called UTR or transaction
              ID. Paste it here so {order.merchant.name} can match your payment.
            </p>
            <div className="mt-4">
              <UtrForm orderId={order.id} />
            </div>
          </div>
        </>
      )}

      <p className="ui mt-10 border-t border-line pt-4 text-[10.5px] leading-relaxed text-muted">
        Money goes directly to {order.merchant.name}&apos;s bank account. Agentic Payment never holds
        it and never sees your bank details.
      </p>
    </main>
  );
}
