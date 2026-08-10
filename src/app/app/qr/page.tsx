import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { closeQr } from "@/lib/actions";
import { EmptyState, Money, StatusPill } from "@/components/ui";
import { QrForm } from "./form";

export const dynamic = "force-dynamic";

export default async function QrPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const codes = await prisma.qRCode.findMany({
    where: { merchantId: session.merchantId },
    orderBy: { createdAt: "desc" },
  });

  const withImages = await Promise.all(
    codes.map(async (c) => ({ ...c, png: await QRCode.toDataURL(c.payload, { margin: 1, width: 260 }) })),
  );

  const readOnly = session.role === "view_only";

  return (
    <div className="max-w-[760px]">
      <p className="eyebrow">QR codes</p>
      <h1 className="mt-2 text-[28px]">Print one, stick it on the counter</h1>
      <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-muted">
        A fixed-amount QR carries a reference we can match. An open QR lets the payer type any
        amount — convenient at a counter, but there is nothing for us to match it to afterwards.
      </p>

      <div className="mt-8">
        <QrForm canCreate={!readOnly} />
      </div>

      <div className="mt-10">
        {withImages.length === 0 ? (
          <EmptyState title="No QR codes yet" hint="Create one above, download the PNG, print it." />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2">
            {withImages.map((c) => (
              <li key={c.id} className="rounded border border-line bg-card p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[15px] font-semibold">{c.name}</p>
                  <StatusPill status={c.status === "active" ? "paid" : "expired"} />
                </div>
                <p className="ui mt-1 text-[11px] text-muted">
                  {c.fixedAmount ? <Money paise={c.fixedAmount} /> : "Any amount"}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element -- data URI, no loader needed */}
                <img src={c.png} alt={`QR code for ${c.name}`} className="mt-3 w-full rounded" />
                <div className="mt-3 flex gap-2">
                  <a
                    href={c.png}
                    download={`${c.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`}
                    className="ui flex-1 rounded border border-line px-3 py-1.5 text-center text-[11px] transition-colors hover:border-accent hover:text-accent-deep"
                  >
                    Download PNG
                  </a>
                  {c.status === "active" && !readOnly && (
                    <form action={closeQr}>
                      <input type="hidden" name="qrId" value={c.id} />
                      <button className="ui rounded border border-line px-3 py-1.5 text-[11px] transition-colors hover:border-no hover:text-no">
                        Close
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
