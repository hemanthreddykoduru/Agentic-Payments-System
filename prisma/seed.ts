import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ID_PREFIX, buildUpiIntent } from "../src/lib/enums";
import bcrypt from "bcryptjs";
import assert from "node:assert/strict";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Deterministic: same input -> same database, every run.
// ponytail: anchored to today's midnight so the dashboard never looks stale.
// Set SEED_NOW=2026-01-01 for byte-identical reruns when you need to diff.
const NOW = process.env.SEED_NOW ? new Date(process.env.SEED_NOW) : new Date(new Date().setHours(0, 0, 0, 0));

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260809);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400_000);

const counters: Record<string, number> = {};
const id = (kind: keyof typeof ID_PREFIX) => {
  counters[kind] = (counters[kind] ?? 0) + 1;
  return `${ID_PREFIX[kind]}_${String(counters[kind]).padStart(6, "0")}`;
};

// A real small business: a bakery that takes UPI at the counter and on WhatsApp.
const MERCHANT = {
  name: "Sunrise Bakery",
  email: "owner@sunrisebakery.test",
  vpa: "sunrisebakery@ybl",
  payeeName: "Sunrise Bakery",
};

const FIRST = ["Aarav", "Diya", "Vihaan", "Ananya", "Arjun", "Ishita", "Kabir", "Meera", "Rohan", "Sara"];
const LAST = ["Sharma", "Reddy", "Iyer", "Patel", "Nair", "Gupta", "Rao", "Menon", "Bose", "Khan"];
const ITEMS = [
  ["Birthday cake, 1kg", 95000],
  ["Assorted pastries, box of 6", 42000],
  ["Bread and buns", 18000],
  ["Cookies, 500g", 32000],
  ["Custom order — office event", 380000],
  ["Coffee and croissant", 24000],
] as const;
const REJECT_REASONS = [
  "No credit found in bank statement",
  "Amount received was less than the order",
  "UTR already used on an earlier order",
];

async function main() {
  console.log("Resetting…");
  await prisma.$transaction([
    prisma.agentAction.deleteMany(), prisma.agent.deleteMany(),
    prisma.report.deleteMany(), prisma.subscription.deleteMany(), prisma.plan.deleteMany(),
    prisma.invoiceItem.deleteMany(), prisma.invoice.deleteMany(),
    prisma.qRCode.deleteMany(), prisma.paymentLink.deleteMany(),
    prisma.ledgerEntry.deleteMany(),
    prisma.payment.deleteMany(), prisma.order.deleteMany(),
    prisma.customer.deleteMany(), prisma.webhookEvent.deleteMany(),
    prisma.webhook.deleteMany(), prisma.apiKey.deleteMany(),
    prisma.user.deleteMany(), prisma.merchant.deleteMany(),
  ]);

  const merchantId = id("merchant");
  await prisma.merchant.create({
    data: {
      id: merchantId, ...MERCHANT,
      vpaVerifiedAt: daysAgo(88), gstin: null,
      website: "https://sunrisebakery.test", createdAt: daysAgo(90),
    },
  });

  // Password for both is "password123". Test fixtures, never a real account.
  const passwordHash = await bcrypt.hash("password123", 10);
  const ownerId = id("user");
  const staffId = id("user");
  await prisma.user.createMany({
    data: [
      { id: ownerId, merchantId, email: MERCHANT.email, name: "Lakshmi Rao", passwordHash, role: "owner", createdAt: daysAgo(90) },
      { id: staffId, merchantId, email: "counter@sunrisebakery.test", name: "Vikram Das", passwordHash, role: "staff", createdAt: daysAgo(60) },
    ],
  });

  const secret = "test_secret_do_not_use_in_production";
  await prisma.apiKey.create({
    data: {
      id: id("apiKey"), merchantId, mode: "test",
      keyId: "ap_test_8Kd92mNqPx4Lz1",
      secretHash: await bcrypt.hash(secret, 10),
      secretLast4: secret.slice(-4), createdAt: daysAgo(88),
    },
  });

  await prisma.webhook.create({
    data: {
      id: id("webhook"), merchantId, url: "https://sunrisebakery.test/hooks/paid",
      secret: "whsec_test_2Kd8Lm",
      events: JSON.stringify(["order.paid", "order.rejected"]),
      alertEmail: MERCHANT.email, createdAt: daysAgo(85),
    },
  });

  const customerIds: string[] = [];
  const customerRows = Array.from({ length: 24 }, (_, i) => {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const cid = id("customer");
    customerIds.push(cid);
    return {
      id: cid, merchantId, name,
      email: `${name.toLowerCase().replace(" ", ".")}${i}@example.test`,
      contact: `+9198${between(10000000, 99999999)}`,
      createdAt: daysAgo(between(20, 85)),
    };
  });
  await prisma.customer.createMany({ data: customerRows });

  console.log("Seeding orders and payments…");
  const orderRows: Prisma.OrderCreateManyInput[] = [];
  const paymentRows: Prisma.PaymentCreateManyInput[] = [];
  const ledger: Prisma.LedgerEntryCreateManyInput[] = [];
  const usedUtr = new Set<string>();

  // 180 orders over 90 days — a bakery pace, not a gateway's.
  for (let i = 0; i < 180; i++) {
    const dayOffset = between(0, 89);
    const at = new Date(daysAgo(dayOffset).getTime() + between(8, 20) * 3600_000);
    const [description, amount] = pick(ITEMS);
    const customerId = pick(customerIds);
    const orderId = id("order");

    // The realistic mix: most confirmed, a few still waiting on the owner, a few
    // rejected because no credit showed up, a few abandoned before paying.
    const roll = rand();
    const outcome =
      dayOffset < 2 && roll < 0.5 ? "awaiting_confirmation"
      : roll < 0.86 ? "paid"
      : roll < 0.92 ? "rejected"
      : roll < 0.97 ? "created"
      : "expired";

    orderRows.push({
      id: orderId, merchantId, customerId, amount, description,
      status: outcome === "rejected" ? "cancelled" : outcome,
      receipt: `SB-${String(i + 1).padStart(4, "0")}`,
      upiIntent: buildUpiIntent({
        vpa: MERCHANT.vpa, payeeName: MERCHANT.payeeName,
        amountPaise: amount, orderId,
      }),
      expiresAt: new Date(at.getTime() + 30 * 60_000),
      paidAt: outcome === "paid" ? new Date(at.getTime() + between(2, 25) * 60_000) : null,
      createdAt: at,
    });

    // An order nobody attempted has no payment row at all.
    if (outcome === "created" || outcome === "expired") continue;

    let utr: string;
    do {
      utr = String(between(100000000000, 999999999999));
    } while (usedUtr.has(utr));
    usedUtr.add(utr);

    const payId = id("payment");
    const submittedAt = new Date(at.getTime() + between(1, 8) * 60_000);
    const confirmedAt = outcome === "awaiting_confirmation" ? null : new Date(at.getTime() + between(9, 40) * 60_000);

    paymentRows.push({
      id: payId, merchantId, orderId, customerId, amount,
      status: outcome === "awaiting_confirmation" ? "awaiting_confirmation" : outcome,
      method: "upi",
      payerVpa: `${pick(FIRST).toLowerCase()}@${pick(["okhdfcbank", "ybl", "paytm", "okaxis", "apl"])}`,
      utr, utrSubmittedAt: submittedAt,
      confirmedByUserId: confirmedAt ? (rand() < 0.7 ? ownerId : staffId) : null,
      confirmedAt,
      rejectedReason: outcome === "rejected" ? pick(REJECT_REASONS) : null,
      createdAt: at,
    });

    // Only a confirmed payment touches the books. Dr bank_upi / Cr sales.
    if (outcome === "paid") {
      ledger.push(
        { id: id("ledger"), merchantId, account: "bank_upi", amount, sourceType: "payment", sourceId: payId, description: `Received — ${description}`, createdAt: confirmedAt! },
        { id: id("ledger"), merchantId, account: "sales", amount: -amount, sourceType: "payment", sourceId: payId, description: `Sale — ${description}`, createdAt: confirmedAt! },
      );
    }
  }

  await prisma.order.createMany({ data: orderRows });
  await prisma.payment.createMany({ data: paymentRows });
  await prisma.ledgerEntry.createMany({ data: ledger });

  console.log("Seeding links, QR and the rest…");
  await prisma.paymentLink.createMany({
    data: [
      { id: id("paymentLink"), merchantId, slug: "birthday-cake-1kg", amount: 95000, description: "Birthday cake, 1kg", status: "active", createdAt: daysAgo(30) },
      { id: id("paymentLink"), merchantId, slug: "office-event-order", amount: 380000, description: "Custom order — office event", status: "paid", createdAt: daysAgo(18) },
      { id: id("paymentLink"), merchantId, slug: "pay-any-amount", amount: null, description: "Pay any amount", status: "active", reusable: true, createdAt: daysAgo(45) },
    ],
  });

  await prisma.qRCode.createMany({
    data: [
      {
        id: id("qrCode"), merchantId, name: "Counter QR", fixedAmount: null,
        payload: `upi://pay?pa=${encodeURIComponent(MERCHANT.vpa)}&pn=${encodeURIComponent(MERCHANT.payeeName)}&cu=INR`,
        status: "active", createdAt: daysAgo(80),
      },
      {
        id: id("qrCode"), merchantId, name: "Coffee & croissant ₹240", fixedAmount: 24000,
        payload: buildUpiIntent({ vpa: MERCHANT.vpa, payeeName: MERCHANT.payeeName, amountPaise: 24000, orderId: "qr_counter_240" }),
        status: "active", createdAt: daysAgo(40),
      },
    ],
  });

  const agentIds = [id("agent"), id("agent")];
  await prisma.agent.createMany({
    data: [
      { id: agentIds[0], merchantId, name: "Order Taker", kind: "collections", status: "active", scopes: JSON.stringify(["orders.create", "orders.read"]), description: "Creates payment links from WhatsApp orders and sends them to the customer.", createdAt: daysAgo(35) },
      { id: agentIds[1], merchantId, name: "Books Agent", kind: "bookkeeping", status: "active", scopes: JSON.stringify(["payments.read", "ledger.read"]), description: "Answers 'what did I earn last week' from the ledger. Read-only.", createdAt: daysAgo(20) },
    ],
  });

  const ACTIONS = [
    ["Created payment link for WhatsApp order", "success"],
    ["Sent reminder for unpaid order", "success"],
    ["Summarised last week's revenue", "success"],
    ["Flagged order awaiting confirmation for 2 days", "needs_approval"],
  ] as const;
  await prisma.agentAction.createMany({
    data: Array.from({ length: 16 }, (_, i) => {
      const [action, outcome] = ACTIONS[i % ACTIONS.length];
      return {
        id: id("agentAction"), merchantId, agentId: agentIds[i % 2], action,
        detail: JSON.stringify({ reviewed: between(1, 20), changed: between(0, 3) }),
        outcome, createdAt: new Date(daysAgo(between(0, 30)).getTime() + between(0, 23) * 3600_000),
      };
    }),
  });

  // --- Self-check. A seed that silently produces a broken fixture is worse than none.
  const counts = {
    merchants: await prisma.merchant.count(), users: await prisma.user.count(),
    customers: await prisma.customer.count(), orders: await prisma.order.count(),
    payments: await prisma.payment.count(), ledger: await prisma.ledgerEntry.count(),
    links: await prisma.paymentLink.count(), qr: await prisma.qRCode.count(),
    agents: await prisma.agent.count(), agentActions: await prisma.agentAction.count(),
  };

  assert.equal(counts.merchants, 1);
  assert.equal(counts.users, 2);
  assert.equal(counts.customers, 24);
  assert.equal(counts.orders, 180);
  assert.equal(counts.agents, 2);
  assert.equal(counts.agentActions, 16);

  const paid = await prisma.payment.count({ where: { status: "paid" } });
  const waiting = await prisma.payment.count({ where: { status: "awaiting_confirmation" } });
  assert.ok(paid > 100, `too few paid payments: ${paid}`);
  assert.ok(waiting > 0, "the confirmation queue must not be empty — it is the app's home screen");

  // The one that matters: the merchant's books must balance.
  const sum = (await prisma.ledgerEntry.findMany({ select: { amount: true } }))
    .reduce((s, e) => s + e.amount, 0);
  assert.equal(sum, 0, `ledger does not balance: off by ${sum} paise`);
  assert.equal(counts.ledger, paid * 2, "every paid payment writes exactly two legs");

  // No unconfirmed payment may have touched the books.
  const unconfirmedIds = (
    await prisma.payment.findMany({ where: { status: { not: "paid" } }, select: { id: true } })
  ).map((p) => p.id);
  const leaked = await prisma.ledgerEntry.count({ where: { sourceId: { in: unconfirmedIds } } });
  assert.equal(leaked, 0, "a payment nobody confirmed wrote to the ledger");

  // Every QR and intent must pay the merchant's own VPA. This is the licensing boundary.
  const intents = await prisma.order.findMany({ select: { upiIntent: true }, take: 500 });
  const qrs = await prisma.qRCode.findMany({ select: { payload: true } });
  for (const { upiIntent } of intents) {
    assert.ok(upiIntent.includes(encodeURIComponent(MERCHANT.vpa)), `intent does not pay the merchant: ${upiIntent}`);
  }
  for (const { payload } of qrs) {
    assert.ok(payload.includes(encodeURIComponent(MERCHANT.vpa)), `QR does not pay the merchant: ${payload}`);
  }

  const revenue = (await prisma.ledgerEntry.aggregate({
    where: { account: "bank_upi" }, _sum: { amount: true },
  }))._sum.amount ?? 0;

  console.table(counts);
  console.log(`\nPaid ${paid} · awaiting confirmation ${waiting} · ledger balances across ${counts.ledger} legs.`);
  console.log(`90-day revenue: ₹${(revenue / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`);
  console.log(`Every QR pays ${MERCHANT.vpa}. Login: ${MERCHANT.email} / password123`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
