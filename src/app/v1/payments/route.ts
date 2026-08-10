import { prisma } from "@/lib/prisma";
import { authenticate, serializePayment, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return unauthorized();

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const count = Math.min(100, Math.max(1, Number(url.searchParams.get("count") ?? 25) || 25));
  const skip = Math.max(0, Number(url.searchParams.get("skip") ?? 0) || 0);

  const where = { merchantId: auth.merchantId, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    prisma.payment.findMany({ where, orderBy: { createdAt: "desc" }, take: count, skip }),
    prisma.payment.count({ where }),
  ]);

  return Response.json({ count: items.length, total, items: items.map(serializePayment) });
}
