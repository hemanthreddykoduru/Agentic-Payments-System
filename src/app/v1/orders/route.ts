import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticate, badRequest, serializeOrder, unauthorized } from "@/lib/api";
import { buildUpiIntent } from "@/lib/enums";

export const dynamic = "force-dynamic";

const CreateOrder = z.object({
  // Paise, like every other amount in this system. Sending rupees here is the
  // classic 100x bug, so a fractional value is rejected rather than rounded.
  amount: z.number().int().positive().max(20000000),
  description: z.string().trim().min(1).max(140),
  receipt: z.string().trim().max(60).optional(),
  customer_id: z.string().trim().optional(),
});

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON.");
  }

  const parsed = CreateOrder.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }

  const merchant = await prisma.merchant.findUniqueOrThrow({ where: { id: auth.merchantId } });
  if (!merchant.vpa) return badRequest("This merchant has not set a UPI ID yet.");

  if (parsed.data.customer_id) {
    const owned = await prisma.customer.count({
      where: { id: parsed.data.customer_id, merchantId: auth.merchantId },
    });
    if (!owned) return badRequest("Unknown customer_id.");
  }

  // ponytail: no Idempotency-Key support, so a retried POST creates a second
  // order. Add a unique (merchantId, idempotencyKey) column when duplicate
  // orders from network retries start showing up.
  const orderId = "ord_" + randomBytes(6).toString("hex");
  const order = await prisma.order.create({
    data: {
      id: orderId,
      merchantId: auth.merchantId,
      customerId: parsed.data.customer_id || null,
      amount: parsed.data.amount,
      description: parsed.data.description,
      receipt: parsed.data.receipt || null,
      status: "created",
      upiIntent: buildUpiIntent({
        vpa: merchant.vpa,
        payeeName: merchant.payeeName ?? merchant.name,
        amountPaise: parsed.data.amount,
        orderId,
      }),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    },
  });

  return Response.json(serializeOrder(order), { status: 201 });
}

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return unauthorized();

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const count = Math.min(100, Math.max(1, Number(url.searchParams.get("count") ?? 25) || 25));
  const skip = Math.max(0, Number(url.searchParams.get("skip") ?? 0) || 0);

  const where = { merchantId: auth.merchantId, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, take: count, skip }),
    prisma.order.count({ where }),
  ]);

  return Response.json({ count: items.length, total, items: items.map(serializeOrder) });
}
