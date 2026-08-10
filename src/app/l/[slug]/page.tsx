import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPaise } from "@/lib/enums";
import { StartPayment } from "./start";

export const dynamic = "force-dynamic";

/** The public link. It does not mint an order on GET — a crawler touching the URL
 *  would create one every time. The payer presses a button first. */
export default async function LinkPage({ params }: PageProps<"/l/[slug]">) {
  const { slug } = await params;
  const link = await prisma.paymentLink.findUnique({
    where: { slug },
    include: { merchant: true },
  });
  if (!link) notFound();

  const dead =
    link.status !== "active" || (link.expiresAt !== null && link.expiresAt < new Date());

  return (
    <main className="mx-auto w-full max-w-[420px] flex-1 px-6 py-14">
      <p className="eyebrow">{link.merchant.payeeName ?? link.merchant.name}</p>
      <h1 className="mt-3 text-[32px]">
        {link.amount === null ? "Pay what you like" : formatPaise(link.amount)}
      </h1>
      <p className="mt-1 text-[15px] text-muted">{link.description}</p>

      {dead ? (
        <div className="mt-8 rounded border border-line bg-card p-6 text-center">
          <p className="tight text-[18px]">This link is closed</p>
          <p className="mt-2 text-[13.5px] text-muted">
            Ask {link.merchant.name} for a new one.
          </p>
        </div>
      ) : (
        <div className="mt-8">
          <StartPayment slug={link.slug} needsAmount={link.amount === null} />
        </div>
      )}

      <p className="ui mt-10 border-t border-line pt-4 text-[10.5px] leading-relaxed text-muted">
        Money goes directly to {link.merchant.name}&apos;s bank account. Agentic Payment never holds
        it and never sees your bank details.
      </p>
    </main>
  );
}
