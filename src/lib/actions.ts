"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { buildUpiIntent, ID_PREFIX, isValidUtr } from "@/lib/enums";
import { createSession, destroySession, getSession } from "@/lib/session";

const newId = (kind: keyof typeof ID_PREFIX) =>
  `${ID_PREFIX[kind]}_${randomBytes(6).toString("hex")}`;

async function requireSession() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/* ── auth ──────────────────────────────────────────────────────────────── */

export async function login(_prev: unknown, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  // Compare against a dummy hash when the user is missing so a wrong email and a
  // wrong password take the same time to answer.
  const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok) return { error: "Email or password is wrong." };

  await createSession({ userId: user.id, merchantId: user.merchantId, role: user.role });
  redirect("/app");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

/* ── orders ────────────────────────────────────────────────────────────── */

const OrderInput = z.object({
  // Rupees in, paise stored. Two decimals max — a third would silently round.
  amount: z.coerce.number().positive().max(200000).refine(
    (n) => Math.round(n * 100) === n * 100,
    "Amount cannot have more than two decimal places.",
  ),
  description: z.string().trim().min(1, "Say what this is for.").max(140),
  customerId: z.string().trim().optional(),
});

export async function createOrder(_prev: unknown, form: FormData) {
  const session = await requireSession();
  if (session.role === "view_only") return { error: "View-only users cannot create orders." };

  const parsed = OrderInput.safeParse({
    amount: form.get("amount"),
    description: form.get("description"),
    customerId: form.get("customerId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const merchant = await prisma.merchant.findUnique({ where: { id: session.merchantId } });
  if (!merchant?.vpa) return { error: "Add your UPI ID in settings before creating an order." };

  const orderId = newId("order");
  const amountPaise = Math.round(parsed.data.amount * 100);

  await prisma.order.create({
    data: {
      id: orderId,
      merchantId: session.merchantId,
      customerId: parsed.data.customerId || null,
      amount: amountPaise,
      description: parsed.data.description,
      status: "created",
      upiIntent: buildUpiIntent({
        vpa: merchant.vpa,
        payeeName: merchant.payeeName ?? merchant.name,
        amountPaise,
        orderId,
      }),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    },
  });

  redirect(`/app/orders/${orderId}`);
}

/* ── the payer submits what their UPI app showed them ──────────────────── */

export async function submitUtr(_prev: unknown, form: FormData) {
  const orderId = String(form.get("orderId") ?? "");
  const utr = String(form.get("utr") ?? "").trim();
  const payerVpa = String(form.get("payerVpa") ?? "").trim() || null;

  if (!isValidUtr(utr)) return { error: "A UPI reference number is exactly 12 digits." };

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: "That order does not exist." };
  if (order.status === "paid") return { error: "This order is already paid." };
  if (order.expiresAt && order.expiresAt < new Date() && order.status === "created") {
    return { error: "This payment link has expired. Ask the merchant for a new one." };
  }

  // The unique index on (merchantId, utr) is the real guard — two payers cannot
  // claim the same reference, and one payer cannot reuse it across orders.
  try {
    await prisma.$transaction([
      prisma.payment.create({
        data: {
          id: newId("payment"),
          merchantId: order.merchantId,
          orderId: order.id,
          customerId: order.customerId,
          amount: order.amount,
          status: "awaiting_confirmation",
          method: "upi",
          payerVpa,
          utr,
          utrSubmittedAt: new Date(),
        },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { status: "awaiting_confirmation" },
      }),
    ]);
  } catch {
    return { error: "That reference number has already been submitted." };
  }

  revalidatePath(`/pay/${orderId}`);
  return { ok: true };
}

/* ── the merchant is the authority on whether money arrived ────────────── */

export async function confirmPayment(form: FormData) {
  const session = await requireSession();
  if (session.role === "view_only") return;

  const paymentId = String(form.get("paymentId") ?? "");
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Scoped by merchantId and status: another tab confirming first makes this a
    // no-op rather than a second set of ledger legs.
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, merchantId: session.merchantId, status: "awaiting_confirmation" },
      data: { status: "paid", confirmedByUserId: session.userId, confirmedAt: now },
    });
    if (count === 0) return;

    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });

    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: "paid", paidAt: now },
    });

    // Dr bank_upi / Cr sales. Two legs, summing to zero.
    await tx.ledgerEntry.createMany({
      data: [
        { id: newId("ledger"), merchantId: session.merchantId, account: "bank_upi", amount: payment.amount, sourceType: "payment", sourceId: payment.id, description: "Received", createdAt: now },
        { id: newId("ledger"), merchantId: session.merchantId, account: "sales", amount: -payment.amount, sourceType: "payment", sourceId: payment.id, description: "Sale", createdAt: now },
      ],
    });
  });

  revalidatePath("/app");
  revalidatePath("/app/orders");
}

export async function rejectPayment(form: FormData) {
  const session = await requireSession();
  if (session.role === "view_only") return;

  const paymentId = String(form.get("paymentId") ?? "");
  const reason = String(form.get("reason") ?? "").trim() || "No credit found in bank statement";

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, merchantId: session.merchantId, status: "awaiting_confirmation" },
  });
  if (!payment) return;

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: paymentId },
      data: { status: "rejected", rejectedReason: reason, confirmedByUserId: session.userId, confirmedAt: new Date() },
    }),
    // Back to created, not cancelled — the payer can try again with a real reference.
    prisma.order.update({ where: { id: payment.orderId }, data: { status: "created" } }),
  ]);

  revalidatePath("/app");
  revalidatePath("/app/orders");
}
