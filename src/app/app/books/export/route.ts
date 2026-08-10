import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  // Escape quotes, and wrap anything a spreadsheet would mis-split.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The same ledger rows the Books page totals — one source, so they cannot disagree. */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const entries = await prisma.ledgerEntry.findMany({
    where: { merchantId: session.merchantId },
    orderBy: { createdAt: "desc" },
  });

  const header = ["date", "account", "amount_paise", "amount_inr", "source_type", "source_id", "description"];
  const body = entries.map((e) => [
    e.createdAt.toISOString(),
    e.account,
    e.amount,
    (e.amount / 100).toFixed(2),
    e.sourceType,
    e.sourceId,
    e.description,
  ]);

  const csv = [header, ...body].map((r) => r.map(cell).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ledger-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
