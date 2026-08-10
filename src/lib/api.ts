import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * Basic auth over `key_id:key_secret`, the same shape every payment API uses.
 *
 * ponytail: bcrypt-compares against every active key for the given keyId, which is
 * one row. If a merchant ever holds hundreds of keys, index on keyId (already unique)
 * still makes this a single lookup — the cost here is the bcrypt round, ~80ms.
 * Cache verified keys in memory if that ever shows up in a profile.
 */
export async function authenticate(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return null;

  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  } catch {
    return null;
  }

  const sep = decoded.indexOf(":");
  if (sep < 0) return null;
  const keyId = decoded.slice(0, sep);
  const secret = decoded.slice(sep + 1);

  const key = await prisma.apiKey.findUnique({ where: { keyId } });
  // Compare against a dummy hash when the key is unknown so a bad id and a bad
  // secret cost the same time.
  const hash = key?.secretHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";
  const ok = await bcrypt.compare(secret, hash);
  if (!key || !key.active || !ok) return null;

  // Best-effort; a failed write here must not fail the request.
  prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { merchantId: key.merchantId, mode: key.mode, keyId: key.keyId };
}

export const unauthorized = () =>
  Response.json(
    { error: { code: "unauthorized", description: "Send Basic auth with key_id:key_secret." } },
    { status: 401, headers: { "www-authenticate": 'Basic realm="api"' } },
  );

export const badRequest = (description: string) =>
  Response.json({ error: { code: "bad_request", description } }, { status: 400 });

export const notFound = () =>
  Response.json({ error: { code: "not_found", description: "No such resource." } }, { status: 404 });

/** Public shape of an order. Nothing internal leaks — no merchantId, no ids of
 *  other tenants' rows, and no payer contact details. */
export function serializeOrder(o: {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  receipt: string | null;
  upiIntent: string;
  expiresAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: o.id,
    amount: o.amount,
    currency: o.currency,
    status: o.status,
    description: o.description,
    receipt: o.receipt,
    upi_intent: o.upiIntent,
    pay_url: `/pay/${o.id}`,
    expires_at: o.expiresAt?.toISOString() ?? null,
    paid_at: o.paidAt?.toISOString() ?? null,
    created_at: o.createdAt.toISOString(),
  };
}

export function serializePayment(p: {
  id: string;
  orderId: string;
  amount: number;
  status: string;
  method: string;
  utr: string | null;
  confirmedAt: Date | null;
  rejectedReason: string | null;
  createdAt: Date;
}) {
  return {
    id: p.id,
    order_id: p.orderId,
    amount: p.amount,
    status: p.status,
    method: p.method,
    utr: p.utr,
    confirmed_at: p.confirmedAt?.toISOString() ?? null,
    rejected_reason: p.rejectedReason,
    created_at: p.createdAt.toISOString(),
  };
}
