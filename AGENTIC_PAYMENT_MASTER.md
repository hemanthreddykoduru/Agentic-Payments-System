# AGENTIC PAYMENT — MASTER PROJECT FILE (v2.0)

> Single source of truth. v1.0 aimed at Razorpay parity and is archived at
> `docs/razorpay-parity-reference.md` — useful as a feature inventory, **not** as a build list.

---

## 0. HOW TO USE THIS FILE
1. Read this file and `CLAUDE.md` before any task.
2. Build the phases in Section 7 **in order, one at a time**.
3. After each phase: `npm run lint && npm run build`, verify the ACCEPTANCE list, then stop and
   wait for "GO".
4. Never build anything not named in this file. If it seems needed, ask first.

---

## 1. WHAT THIS IS

**The user:** a small Indian business — a bakery, a tutor, a print shop, a freelancer — who
already accepts UPI on a phone and **cannot or will not get a Razorpay / Cashfree / Stripe
account.** Rejected for business category, no GST, no registered entity, no website, or simply
unwilling to do the paperwork for ₹40,000 a month of turnover.

**The problem:** they can take money, but they cannot run a business on it. No order IDs, no
per-order amounts, no record of who paid for what, no receipts, no way for their website or their
AI agent to know a payment arrived.

**What we give them:** everything a payment gateway gives, *except custody of the money*.
Orders, exact-amount QRs, a confirmation queue, a real ledger, receipts, an API, webhooks, and an
MCP server so their agents can create payment links and read what got paid.

**One sentence:** *Agentic Payment is the order and reconciliation layer on top of a merchant's own
UPI ID.*

---

## 2. THE LEGAL SHAPE (why this is allowed)

Money moves **payer's bank → merchant's own VPA, directly.** It never enters an account we
control. No escrow, no nodal account, no pooling, no settlement obligation.

That makes this a **technology service provider**, not a payment aggregator. RBI's PA/PG
authorisation applies to entities that handle funds. We do not.

**Consequences that must hold in the code, forever:**
- We never hold, route, split or disburse money. Not in test mode either.
- The QR always pays the merchant's own VPA. There is no platform VPA.
- We never ask for or store bank credentials, card numbers, UPI PINs or OTPs.
- We can be wrong about whether a payment happened. The merchant is the authority.

**Get this confirmed by a lawyer before onboarding paying customers.** Not before building.

---

## 3. THE HARD PROBLEM, AND OUR ANSWER

Nothing tells our server that a UPI payment landed. A UPI QR is a one-way instruction to the
payer's app. That callback is the actual product Razorpay sells, and we cannot have it without
being them.

**So a human confirms.** Two signals, combined:

1. **The payer submits the UTR** — the 12-digit reference their UPI app shows after paying.
   Costs one paste. Gives us something auditable to match against.
2. **The merchant confirms** — the pending payment appears in a queue with amount, UTR and time.
   They glance at their bank notification and tap Confirm or Reject.

For a shop doing thirty payments a day this is seconds of work and is **100% accurate, because a
human with the bank statement verified it.**

**We never claim automatic confirmation.** The marketing, the docs and the UI all say a human
confirms. This is the one thing that would destroy trust if we faked it.

**Upgrade path, not now:** the Account Aggregator framework (Finvu, Setu) gives RBI-sanctioned
read-only access to bank transactions with merchant consent. That is the legitimate route to
automatic confirmation. Bank SMS scraping and mailbox parsing are not — they are fragile,
credential-adjacent, and break without warning.

---

## 4. MERCHANT SAFETY (must appear in onboarding)

Most banks prohibit **personal** VPAs for business volume. Heavy inflow to a personal account can
get it frozen and complicates tax. Onboarding must tell the merchant, in plain words, to use a
current-account or business VPA where they can — many of our users can get one even when they
cannot get a Razorpay account.

---

## 5. DATA MODEL

Keep from v1: `Merchant`, `User`, `Customer`, `Order`, `Payment`, `LedgerEntry`, `ApiKey`,
`Webhook`, `WebhookEvent`, `Agent`, `AgentAction`, `PaymentLink`, `QRCode`, `Invoice`,
`InvoiceItem`, `Plan`, `Subscription`, `Report`.

Drop: `Settlement`, `Balance`, `Dispute`, `Refund`, `PaymentPage`, `PaymentButton`.
We never settle (money is already with the merchant), never hold a balance, never arbitrate a
dispute, and never process a refund — the merchant refunds from their own UPI app.

Change:
- `Merchant` gains `vpa` (e.g. `9966659900@ybl`), `vpaVerifiedAt`, `payeeName`.
- `Payment` gains `utr`, `utrSubmittedAt`, `confirmedByUserId`, `confirmedAt`, `rejectedReason`.
- `Payment.status`: `created → awaiting_confirmation → paid | rejected | expired`.
  No `authorized` or `captured` — those are custody concepts and we have no custody.
- `Payment.fee` and `tax` stay but default to 0. We do not take a cut of a payment we never touch.

**Ledger stays double-entry**, and becomes genuinely useful: it is the merchant's books.
A confirmed receipt writes `Dr bank_upi` / `Cr sales`, summing to zero. That is what makes
"what did I earn in March" a query instead of a guess.

**NFRs:** every row carries `merchantId`; POSTs honour `Idempotency-Key`; agent actions are
audited; every list has skeleton / empty / error / pagination.

**Money:** integer minor units, always. INR and USD have exponent 2, JPY 0, KWD 3 — store the
exponent with the currency rather than assuming 100. v1 is INR only; the map exists so adding a
currency is not a migration.

**Webhook delivery contract:** HMAC-SHA256 over the raw body in `X-AgenticPay-Signature`. The
merchant's endpoint must answer 2XX within 5 seconds. Failures retry with exponential backoff for
24 hours, then the endpoint is auto-disabled and the alert email fires. Every attempt including the
response body is kept and replayable.

---

## 6. SURFACES

- **Merchant dashboard** — orders, the confirmation queue, the ledger, receipts, settings.
- **Payer page** — `/pay/:orderId`: amount, QR, UPI-app deep link on mobile, UTR box.
- **Public API** — `/v1/orders`, `/v1/payments`, `/v1/payment_links`. Basic auth on API keys.
- **Webhooks** — HMAC-SHA256 `X-AgenticPay-Signature`, fired on `order.paid` and `order.rejected`
  to the merchant's own site. Retried with backoff.
- **MCP server** — scoped tools so a merchant's agent can create a payment link, check status, and
  list what got paid. This is the differentiator; no incumbent serves this user with it.

---

## 7. PHASES

### P1 — Reshape the schema
Apply Section 5 to `prisma/schema.prisma`. Migrate. Rewrite `prisma/seed.ts` for the new statuses
and the `Dr bank_upi / Cr sales` ledger, with one demo merchant on a test VPA.
**ACCEPTANCE:** migrate + seed + build green; seed still asserts the ledger sums to zero.

### P2 — The core loop, headless
`POST /v1/orders` → dynamic UPI intent for the merchant's VPA → payer page at `/pay/:orderId`
with QR and UTR box → `POST /v1/orders/:id/utr` → merchant confirm/reject → ledger legs written.
Port the UPI link building and QR generation from `legacy/upi-mock/server.js` — it already works.
**ACCEPTANCE:** `scripts/e2e.sh` walks create → QR → UTR → confirm → paid → ledger balanced.

### P3 — Merchant dashboard
Auth (bcrypt + JWT cookie), app shell, orders list, and the confirmation queue as the home screen —
that queue is the app's primary job, so it is the first thing a merchant sees.
**ACCEPTANCE:** seeded merchant logs in, confirms a pending payment, sees it move to paid.

### P4 — Onboarding and settings
Signup, VPA entry with the Section 4 warning shown plainly, payee name, receipt branding.
**ACCEPTANCE:** a new merchant reaches a working payment link in under two minutes.

### P5 — API keys and webhooks
Show-once secrets, HMAC-signed delivery to the merchant's site, delivery log with replay.
**ACCEPTANCE:** a webhook to a local listener verifies its signature; a failed delivery retries.

### P6 — MCP server
Scoped tools: `create_payment_link`, `get_order`, `list_payments`, `revenue_summary`.
Read scopes and write scopes separate. Every call lands in `AgentAction`.
**ACCEPTANCE:** the MCP config connects, tools list, and an agent creates a working link.

### P7 — Books
Receipts (PDF or print view), CSV export, revenue by period, customer history.
**ACCEPTANCE:** exported CSV totals equal the ledger for the same range.

### P8 — Landing page rewrite
The current page sells a gateway. Rewrite for the merchant in Section 1, keeping the paper-and-ink
design system and the live-database honesty (blank over invented).
**ACCEPTANCE:** every claim on the page maps to something shipped.

---

## 8. DEFINITION OF DONE

- [ ] A merchant signs up, enters their `@ybl` VPA, and gets a payment link in under two minutes.
- [ ] A payer opens the link on a phone, pays, submits the UTR.
- [ ] The merchant confirms it in one tap and the ledger balances.
- [ ] Their website receives a signed webhook; their agent can query it over MCP.
- [ ] Nowhere does the product claim to confirm payments automatically.
- [ ] `npm run lint` and `npm run build` green.

---

## 9. TEST MODE

There is no sandbox PSP, because there is no PSP. A merchant tests by paying **₹1 to their own
VPA** from their own phone and confirming it — the real loop, one rupee, no simulation to diverge
from production. `vpaVerifiedAt` is set by exactly that.

Seeded fixtures are marked `test` and excluded from revenue totals.

---

## 10. ADOPTED AND REJECTED FROM THE RAZORPAY-PARITY SPEC

The v1.0 spec (`docs/razorpay-parity-reference.md`) described a licensed gateway. Four things in it
survive contact with this product:

| Adopted | Where |
|---|---|
| Money and tenancy rules — merchant_id everywhere, integer minor units, Idempotency-Key | §5 |
| Webhook delivery contract — HMAC, 5s, 24h backoff, auto-disable | §5, P5 |
| API key handling — show the secret once, never store it | P5 |
| UI component set — DataTable with skeleton/empty/error, SideDrawer, CommandPalette, StatusPill, CopyId, Toast, EmptyState | P3 |

Everything else is rejected, and for one reason: **it requires holding money.**

Settlements, refunds, disputes, Route transfers and reversals, Optimizer routing, Banking X payouts,
payroll, escrow, capital, partner sub-merchant onboarding, credits and reserve balances, checkout
styling, card BIN filters, EMI offers, video KYC, penny-drop verification — every one of these
presumes funds pass through us. They do not. Building any of them would either be theatre or would
require the RBI licence this project exists to avoid.

The design system is also rejected: dark glass was for a developer-tools brand. This product is
paper-and-ink, aimed at a baker.

---

## 11. OUT OF SCOPE — PERMANENTLY

Holding or routing funds · settlements · refunds through us · disputes · card or netbanking
acceptance · PA/PG licensing · PCI scope · bank SMS or mailbox scraping · payouts · payroll ·
lending. If a feature requires us to touch money, the answer is no.
