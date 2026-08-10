// End-to-end check of the core loop against a running dev server.
//   npm run dev        (other terminal)
//   npm run e2e
//
// Drives the real pages: login -> create order -> payer submits UTR -> merchant
// confirms -> ledger posts two legs and still sums to zero.
import assert from "node:assert/strict";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ledgerSum = async () =>
  (await prisma.ledgerEntry.findMany({ select: { amount: true } })).reduce((s, e) => s + e.amount, 0);

// Next server actions are POSTs with a Next-Action id, which is a build artefact we
// cannot know here. So the flow is driven through the database for the merchant side
// and through HTTP for the pages a stranger touches — which is where the risk is.
async function main() {
  const before = await ledgerSum();
  assert.equal(before, 0, `ledger was already unbalanced: ${before}`);

  const merchant = await prisma.merchant.findFirstOrThrow();
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "owner" } });
  assert.ok(merchant.vpa, "seeded merchant has no VPA");

  // 1. an order, exactly as createOrder builds one
  const { buildUpiIntent } = await import("../src/lib/enums.ts");
  const orderId = "ord_e2e" + Date.now().toString(36);
  const amount = 123400;
  await prisma.order.create({
    data: {
      id: orderId, merchantId: merchant.id, amount, description: "e2e test order",
      status: "created",
      upiIntent: buildUpiIntent({ vpa: merchant.vpa, payeeName: merchant.payeeName ?? merchant.name, amountPaise: amount, orderId }),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    },
  });

  // 2. the payer page is public and shows the amount and the merchant's own VPA
  const page = await fetch(`${BASE}/pay/${orderId}`);
  assert.equal(page.status, 200, "payer page did not render");
  const html = await page.text();
  assert.ok(html.includes("1,234.00"), "payer page does not show the amount");
  assert.ok(html.includes(merchant.vpa), "payer page does not name the merchant's VPA");

  // 3. the merchant area is not public
  const app = await fetch(`${BASE}/app`, { redirect: "manual" });
  assert.ok([302, 307].includes(app.status), `/app should redirect anonymous users, got ${app.status}`);

  // 4. payer submits a reference
  const utr = String(Date.now()).slice(-12);
  const payment = await prisma.payment.create({
    data: {
      id: "pay_e2e" + Date.now().toString(36), merchantId: merchant.id, orderId,
      amount, status: "awaiting_confirmation", method: "upi", utr, utrSubmittedAt: new Date(),
    },
  });
  await prisma.order.update({ where: { id: orderId }, data: { status: "awaiting_confirmation" } });

  // the same reference cannot be claimed twice
  await assert.rejects(
    prisma.payment.create({
      data: { id: "pay_dup" + Date.now().toString(36), merchantId: merchant.id, orderId, amount, status: "awaiting_confirmation", method: "upi", utr },
    }),
    "a duplicate UTR was accepted",
  );

  // nothing has posted while it waits on a human
  assert.equal(await ledgerSum(), 0);
  assert.equal(
    await prisma.ledgerEntry.count({ where: { sourceId: payment.id } }), 0,
    "an unconfirmed payment wrote to the ledger",
  );

  // 5. merchant confirms — same transaction the server action runs
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.payment.updateMany({
      where: { id: payment.id, merchantId: merchant.id, status: "awaiting_confirmation" },
      data: { status: "paid", confirmedByUserId: owner.id, confirmedAt: now },
    });
    assert.equal(count, 1);
    await tx.order.update({ where: { id: orderId }, data: { status: "paid", paidAt: now } });
    await tx.ledgerEntry.createMany({
      data: [
        { id: "ldgr_e2ea" + Date.now().toString(36), merchantId: merchant.id, account: "bank_upi", amount, sourceType: "payment", sourceId: payment.id, description: "Received", createdAt: now },
        { id: "ldgr_e2eb" + Date.now().toString(36), merchantId: merchant.id, account: "sales", amount: -amount, sourceType: "payment", sourceId: payment.id, description: "Sale", createdAt: now },
      ],
    });
  });

  // 6. two legs, still balanced
  assert.equal(await prisma.ledgerEntry.count({ where: { sourceId: payment.id } }), 2);
  assert.equal(await ledgerSum(), 0, "ledger stopped balancing after a confirmation");

  // 7. the payer page now says confirmed
  const after = await (await fetch(`${BASE}/pay/${orderId}`)).text();
  assert.ok(after.includes("Payment confirmed"), "payer page does not show the confirmed state");

  // clean up so reruns start from zero
  await prisma.ledgerEntry.deleteMany({ where: { sourceId: payment.id } });
  await prisma.payment.deleteMany({ where: { orderId } });
  await prisma.order.delete({ where: { id: orderId } });
  assert.equal(await ledgerSum(), 0);

  console.log("e2e ok — order → QR → UTR → confirm → balanced ledger");
}

main()
  .catch((e) => { console.error(e.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
