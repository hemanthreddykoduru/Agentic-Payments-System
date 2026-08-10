import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { EmptyState, Money, StatusPill } from "@/components/ui";
import { CopyLink } from "@/components/copy-link";
import { LinkForm } from "./form";

export const dynamic = "force-dynamic";

export default async function LinksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const links = await prisma.paymentLink.findMany({
    where: { merchantId: session.merchantId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-[760px]">
      <p className="eyebrow">Payment links</p>
      <h1 className="mt-2 text-[28px]">Share a link, get paid</h1>
      <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-muted">
        Send one over WhatsApp. Opening it creates a fresh order, so each payer gets their own QR and
        their own reference for you to confirm.
      </p>

      <div className="mt-8">
        <LinkForm canCreate={session.role !== "view_only"} />
      </div>

      <div className="mt-10">
        {links.length === 0 ? (
          <EmptyState title="No links yet" hint="Create one above and share it." />
        ) : (
          <ul className="border-t border-line">
            {links.map((l) => (
              <li key={l.id} className="grid gap-3 border-b border-line py-4 sm:grid-cols-[1fr_260px] sm:items-center">
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    {l.amount === null ? (
                      <span className="ui text-[17px]">Any amount</span>
                    ) : (
                      <Money paise={l.amount} className="text-[17px] font-medium" />
                    )}
                    <span className="text-[14px] text-muted">{l.description}</span>
                    <StatusPill status={l.status} />
                  </div>
                  <p className="ui mt-1 text-[10.5px] text-muted">
                    {l.reusable ? "Reusable" : "Single use"} ·{" "}
                    {l.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <CopyLink path={`/l/${l.slug}`} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
