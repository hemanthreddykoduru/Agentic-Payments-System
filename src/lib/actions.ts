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

/* ── settings ──────────────────────────────────────────────────────────── */

// A VPA is handle@psp. Getting this wrong means every QR pays nobody, so it is
// validated here rather than trusted from the form.
const VPA = /^[\w.\-]{2,64}@[a-zA-Z]{2,32}$/;

const SettingsInput = z.object({
  name: z.string().trim().min(1).max(80),
  payeeName: z.string().trim().min(1).max(50),
  vpa: z.string().trim().toLowerCase().regex(VPA, "That doesn't look like a UPI ID. Example: yourname@ybl"),
});

export async function saveSettings(_prev: unknown, form: FormData) {
  const session = await requireSession();
  if (session.role !== "owner") return { error: "Only the owner can change these." };

  const parsed = SettingsInput.safeParse({
    name: form.get("name"),
    payeeName: form.get("payeeName"),
    vpa: form.get("vpa"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const current = await prisma.merchant.findUniqueOrThrow({ where: { id: session.merchantId } });

  await prisma.merchant.update({
    where: { id: session.merchantId },
    data: {
      ...parsed.data,
      // Changing where the money goes invalidates the ₹1 verification.
      vpaVerifiedAt: parsed.data.vpa === current.vpa ? current.vpaVerifiedAt : null,
    },
  });

  revalidatePath("/app/settings");
  revalidatePath("/app");
  return { ok: true as const };
}

/* ── payment links: one link, many payers ──────────────────────────────── */

const LinkInput = z.object({
  description: z.string().trim().min(1, "Say what this is for.").max(140),
  amount: z.string().trim().optional(),
  reusable: z.coerce.boolean().optional(),
});

export async function createLink(_prev: unknown, form: FormData) {
  const session = await requireSession();
  if (session.role === "view_only") return { error: "View-only users cannot create links." };

  const parsed = LinkInput.safeParse({
    description: form.get("description"),
    amount: form.get("amount"),
    reusable: form.get("reusable") ? "true" : "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const raw = parsed.data.amount?.trim();
  let amount: number | null = null;
  if (raw) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0 || Math.round(n * 100) !== n * 100) {
      return { error: "Amount must be a positive number with at most two decimals." };
    }
    amount = Math.round(n * 100);
  }

  const slug =
    parsed.data.description.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28) +
    "-" + randomBytes(3).toString("hex");

  await prisma.paymentLink.create({
    data: {
      id: newId("paymentLink"),
      merchantId: session.merchantId,
      slug,
      amount,
      description: parsed.data.description,
      reusable: Boolean(parsed.data.reusable) || amount === null,
      status: "active",
    },
  });

  revalidatePath("/app/links");
  redirect("/app/links");
}

/** A visitor turns a link into an order. Deliberately an action, not a GET —
 *  otherwise every crawler that touches the URL mints an order. */
export async function orderFromLink(_prev: unknown, form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const link = await prisma.paymentLink.findUnique({ where: { slug }, include: { merchant: true } });

  if (!link || link.status !== "active") return { error: "This link is no longer active." };
  if (link.expiresAt && link.expiresAt < new Date()) return { error: "This link has expired." };
  if (!link.merchant.vpa) return { error: "This merchant has not set up their UPI ID yet." };

  let amountPaise = link.amount;
  if (amountPaise === null) {
    const n = Number(String(form.get("amount") ?? ""));
    if (!Number.isFinite(n) || n <= 0 || n > 200000 || Math.round(n * 100) !== n * 100) {
      return { error: "Enter an amount with at most two decimals." };
    }
    amountPaise = Math.round(n * 100);
  }

  const orderId = newId("order");
  await prisma.order.create({
    data: {
      id: orderId,
      merchantId: link.merchantId,
      amount: amountPaise,
      description: link.description,
      status: "created",
      upiIntent: buildUpiIntent({
        vpa: link.merchant.vpa,
        payeeName: link.merchant.payeeName ?? link.merchant.name,
        amountPaise,
        orderId,
      }),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    },
  });

  // A single-use link closes once it has produced an order.
  if (!link.reusable) {
    await prisma.paymentLink.update({ where: { id: link.id }, data: { status: "paid" } });
  }

  redirect(`/pay/${orderId}`);
}

/* ── QR codes ──────────────────────────────────────────────────────────── */

export async function createQr(_prev: unknown, form: FormData) {
  const session = await requireSession();
  if (session.role === "view_only") return { error: "View-only users cannot create QR codes." };

  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 60) return { error: "Give the QR a name, up to 60 characters." };

  const raw = String(form.get("amount") ?? "").trim();
  let fixedAmount: number | null = null;
  if (raw) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0 || Math.round(n * 100) !== n * 100) {
      return { error: "Amount must be a positive number with at most two decimals." };
    }
    fixedAmount = Math.round(n * 100);
  }

  const merchant = await prisma.merchant.findUniqueOrThrow({ where: { id: session.merchantId } });
  if (!merchant.vpa) return { error: "Add your UPI ID in settings first." };

  const qrId = newId("qrCode");
  const payee = encodeURIComponent(merchant.payeeName ?? merchant.name);
  // A counter QR carries no order id — the payer types the amount, so there is
  // nothing for us to match it against later. That is the trade-off of an open QR.
  const payload = fixedAmount
    ? buildUpiIntent({ vpa: merchant.vpa, payeeName: merchant.payeeName ?? merchant.name, amountPaise: fixedAmount, orderId: qrId })
    : `upi://pay?pa=${encodeURIComponent(merchant.vpa)}&pn=${payee}&cu=INR`;

  await prisma.qRCode.create({
    data: { id: qrId, merchantId: session.merchantId, name, fixedAmount, payload, status: "active" },
  });

  revalidatePath("/app/qr");
  return { ok: true as const };
}

export async function closeQr(form: FormData) {
  const session = await requireSession();
  if (session.role === "view_only") return;
  await prisma.qRCode.updateMany({
    where: { id: String(form.get("qrId") ?? ""), merchantId: session.merchantId },
    data: { status: "closed" },
  });
  revalidatePath("/app/qr");
}
