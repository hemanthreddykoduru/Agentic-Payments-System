import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Sums every ledger leg. A correct double-entry ledger returns exactly 0. */
export async function GET() {
  try {
    const [{ rows, sum }] = await prisma.$queryRaw<{ rows: bigint; sum: bigint | null }[]>`
      SELECT count(*) AS rows, coalesce(sum(amount), 0) AS sum FROM "LedgerEntry"
    `;
    return Response.json({ rows: Number(rows), sum: Number(sum ?? 0) });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "query failed" },
      { status: 503 },
    );
  }
}
