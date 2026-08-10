# Agentic Payment

**The order and reconciliation layer on top of a merchant's own UPI ID.**

For small Indian businesses — a bakery, a tutor, a print shop — who already take UPI on a phone but
cannot get a Razorpay or Cashfree account: rejected for business category, no GST, no registered
entity, or unwilling to do the paperwork for ₹40,000 a month of turnover.

They can take money. They cannot run a business on it: no order IDs, no per-order amounts, no record
of who paid for what, no way for their website or their AI agent to know a payment arrived.

This gives them everything a payment gateway gives **except custody of the money**.

---

## How it works

```
merchant sets their VPA          sunrisebakery@ybl
        ↓
order created (API / CLI / MCP)  ₹950.00 — birthday cake, 1kg
        ↓
dynamic UPI QR                   upi://pay?pa=sunrisebakery@ybl&am=950.00&tr=ord_000412
        ↓
payer scans, pays, submits UTR   418293770021
        ↓
merchant taps Confirm            they can see the credit in their bank app
        ↓
ledger posts two legs            Dr bank_upi ₹950.00 / Cr sales −₹950.00
```

Money goes **payer's bank → merchant's own VPA, directly.** It never enters an account this project
controls. No escrow, no pooling, no settlement obligation — which is what keeps it outside RBI
payment-aggregator authorisation. *(Get that confirmed by a lawyer before taking paying customers.)*

## A human confirms the payment

Nothing tells a server that a UPI payment landed. A QR is a one-way instruction to the payer's app;
that callback is the actual product Razorpay sells, and having it means being Razorpay.

So two signals combine: the **payer submits the UTR**, and the **merchant confirms** from a queue
showing amount, UTR and time. For a shop doing thirty payments a day that is seconds of work, and
it is right every time, because a human with the bank statement checked.

**This project never claims automatic confirmation.** The Account Aggregator framework is the
legitimate route to that later; bank SMS and mailbox scraping are not, and are out of scope
permanently.

## Status

Phase 1 of 8. The database and the landing page are real; the payment flow is not written yet.

| | |
|---|---|
| Schema — 18 tables, multi-tenant, integer paise | shipped |
| Double-entry ledger — balanced, queryable | shipped |
| Seed data — a bakery's 90 days | shipped |
| Landing page — reads the live cluster | shipped |
| Order + dynamic UPI QR | not yet |
| Payer page — scan, pay, submit UTR | not yet |
| Merchant confirmation queue | not yet |
| Public `/v1` API, webhooks, MCP server | not yet |

`legacy/upi-mock/` is a working standalone prototype of the core loop — plain Express, no database.
It runs today and is what the real flow gets ported from.

## Running it

```bash
cp .env.example .env      # add your CockroachDB connection string
npm install
npm run seed              # 180 orders, 165 payment attempts, balanced books
npm run dev               # http://localhost:3000
```

Seeded login: `owner@sunrisebakery.test` / `password123`

### Scripts

| | |
|---|---|
| `npm run seed` | Reset and reseed. Asserts the ledger balances before exiting. |
| `npm run db:studio` | Prisma Studio |
| `npm run db:unlock` | Clears CockroachDB `schema_locked` before a migration — see `CLAUDE.md` |

## Design decisions worth knowing

**Money is `Int` paise, everywhere.** Floating-point arithmetic on money accumulates error, and a
double-entry ledger off by a hundredth of a rupee is broken.

**The ledger is the merchant's books, not ours.** A confirmed payment writes `Dr bank_upi` /
`Cr sales` summing to zero. No fee legs — we take no cut of money that never passes through us. It
turns "what did I earn in March" into a query.

**There is no `authorized` or `captured` state.** Those are custody concepts, and there is no
custody. A payment is `created → awaiting_confirmation → paid | rejected | expired`.

**The seed tests itself.** It asserts the ledger sums to zero, that every paid payment wrote exactly
two legs, that no unconfirmed payment touched the books, and that **every generated QR pays the
merchant's own VPA** — that last one is the licensing boundary, so it is a test rather than a
comment.

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind v4 · Prisma 7 + CockroachDB · zod · qrcode

`AGENTIC_PAYMENT_MASTER.md` is the spec and `CLAUDE.md` the working rules. `docs/` holds an archived
Razorpay-parity spec from an earlier, wider version of this idea — reference only.

## Out of scope, permanently

Holding or routing funds · settlements · refunds through us · disputes · card or netbanking
acceptance · PA/PG licensing · PCI scope · bank SMS or mailbox scraping · payouts · lending.

If a feature requires touching the money, the answer is no.
