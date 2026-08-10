# AGENTIC PAYMENT — MASTER PROJECT FILE (v1.0)
> Single source of truth for building the Agentic Payment platform with an AI coding CLI (Claude Code / Cursor / Cline).

---

## 0. HOW TO USE THIS FILE
1. Create an **empty** directory for this project and `cd` into it. P0 runs `create-next-app`,
   which needs a clean root — do not run it inside an existing Node project.
2. Save this file as `AGENTIC_PAYMENT_MASTER.md` in that directory.
3. Copy **Section 4** into `CLAUDE.md` (auto-loaded by the CLI).
4. Feed the CLI the phase prompts in **Section 8**, following the BUILD ORDER at the top of
   that section — **not** the order the phases are written in. One phase at a time.
5. After each phase: run `npm run build`, verify the ACCEPTANCE list, then say "next phase".
6. Never skip a phase. Never start the next until acceptance passes.

---

## 1. VISION & STRATEGY
- **Name:** Agentic Payment
- **What:** Multi-tenant SaaS payment gateway (competitor to Razorpay / Stripe / Cashfree). Merchants sign up, get API keys, embed checkout, accept payments.
- **Differentiators:** AI-agent-native (MCP server, Agent Console, agentic automations) · orchestration layer over licensed processors · migration-friendly · sandbox-first.
- **Business model:** Orchestration + experience layer. Real money moves through licensed processors the merchant connects (Razorpay/Cashfree/Stripe adapters) + built-in **Sandbox PSP** for test mode.
- **Out of scope (the last 10%):** real acquiring/banking rails, RBI PA licence, PCI-DSS production card handling, real settlements, legal/compliance, mobile apps.

---

## 2. PRD (CONDENSED)
**Personas:** Merchant Owner · Developer · Finance/Auditor (view-only) · AI Agent.

**Priorities**
- **P0:** Auth+Onboarding, App Shell, API Keys, Orders/Payments API, Hosted Checkout, Webhooks, Transactions, Test Mode, Sandbox PSP.
- **P1:** Settlements, Reports, Payment Links, Payment Pages, QR Codes, Invoices, Subscriptions, Customers, Settings, Team Roles.
- **P2:** Payment Buttons, Smart Collect, Disputes, Agent Console, MCP Server, Migration Wizard, NL Queries, Offers.

**Data model:** Merchant, User, Role, ApiKey, Webhook, WebhookEvent, Customer, Order, Payment, Refund, Dispute, Settlement, LedgerEntry, PaymentLink, PaymentPage, PaymentButton, QRCode, Invoice, InvoiceItem, Plan, Subscription, Report, Agent, AgentAction, Balance.

**Public API:** Basic auth `key_id:key_secret` · `Idempotency-Key` on POSTs · webhook header `X-AgenticPay-Signature` (HMAC-SHA256).
Endpoints: `/v1/orders` · `/v1/payments` (+capture, refund) · `/v1/refunds` · `/v1/customers` · `/v1/payment_links` · `/v1/invoices` · `/v1/subscriptions` · `/v1/plans` · `/v1/qr_codes` · `GET /v1/settlements` · `/v1/events`.

**NFRs:** every row has `merchant_id`; amounts = integer paise; idempotency; audit log for agent actions; skeleton/empty/error/pagination on every table; no dead buttons.

---

## 3. TECH STACK
Next.js 16 App Router · TypeScript strict · Tailwind · Framer Motion · Recharts · Zustand · Prisma + CockroachDB Cloud (Postgres wire protocol) · lucide-react · zod · qrcode.

---

## 4. GLOBAL RULES  →  SAVE AS `CLAUDE.md`
```
# AGENTIC PAYMENT — GLOBAL RULES
- Always read AGENTIC_PAYMENT_MASTER.md before any task.
- Stack: Next.js 16 App Router, TS strict, Tailwind, Framer Motion, Recharts,
  Zustand, Prisma+CockroachDB, lucide-react, zod, qrcode.
- Multi-tenant: every query filters by merchant_id from session/key.
- Amounts in integer paise. IDs prefixed (ord_, pay_, refl_, setl_, inv_,
  sub_, plink_, qr_, cust_, wh_, agt_).
- Dark glass aesthetic per Section 5. No dead buttons: wire every control
  to a real handler, mock action, or toast.
- Every list: skeleton, empty, error, pagination. Details in side drawer.
- SCOPE: build only pages listed in Section 6. The Appendix is reference
  material for making mocks believable — never a build list. If a feature
  is not in Section 6 or Section 9, do not build it; ask first.
- Prefer the smallest change that passes ACCEPTANCE. No abstraction with
  one caller, no config for a value that never changes.
- After each phase: run `npm run build`, fix errors, summarize what to
  click to verify. Never start the next phase until I say GO.
```

---

## 5. DESIGN SYSTEM (TestSprite-inspired)
- bg `#0A0A0F`; glass cards `bg-white/5 + backdrop-blur-xl + border-white/10`.
- Primary electric blue; **purple = agent features**; emerald success; amber pending; crimson failure.
- Inter/Geist; bento grids; staggered fade-up reveals; animated self-drawing charts; Cmd+K palette; side drawers; copyable IDs; status pills; magnetic buttons; noise overlay; blurred neon orbs.
- **Component library (build first):** GlassCard, BentoGrid, Button, Input/Select/DateRange, StatusPill, CopyId, SideDrawer, Tabs, Chips, DataTable, AccordionStepModal (left progress rail), Toggle, MetricCard (count-up), Sparkline/AreaChart, CommandPalette, Toast, EmptyState, DurationChips, DragDropColumnList, AddressBlock, LockedTierCard, EmbedCodeModal, LogChartCard, CatalogCard.

---

## 6. PAGE-BY-PAGE SPECS (from Razorpay parity analysis)
**Global chrome:** top product switcher · global search · Test/Live toggle (amber banner in Live) · avatar · floating Help pill.
**Sidebar groups:** Home; Transactions; Settlements; Reports; PAYMENT PRODUCTS (Links, Pages, Buttons, QR, Invoices, Subscriptions, Smart Collect, Offers); CUSTOMERS; DEVELOPERS (API Keys, Webhooks, Logs, Docs, MCP); ACCOUNT (Settings, Team).

1. **Home:** AI assistant bar; MetricCards (Collected, Refunds, Orders, Success rate); payment-method split pie; activity feed incl. purple agent actions; product recommendation cards.
2. **Transactions:** tabs Payments|Orders|Refunds|Disputes|Success Rate. Payments chips All/Created/Captured/Refunded/Failed; scoped search "in Payment ID"; filters Date/Status/Method; columns Payment ID|Bank RRN|Customer|Created|Amount|Status; row → drawer (timeline created→authorized→captured, Capture/Refund actions, settlement link). Orders chips All/Created/Attempted/Paid; columns Order ID|Amount|Attempts|Receipt|Created|Status.
3. **Settlements:** overview (Previous/Today's/Next + Available balance, holiday note); schedule strip Domestic T+2 / International T+7; chips All/Created/Processed/Failed/Initiated; search "in UTR Number"; columns Created|Settlement ID(copy)|UTR(copy)|Net|Status. Preferences sub-page: T+0 0.15% locked / T+1 0.09% locked / T+2 0% selected (LockedTierCard) + educational right rail.
4. **Reports:** tabs Overview|Downloads|Schedules. Overview = CatalogCards grouped (SETTLEMENTS, PAYMENTS, TRANSACTIONS, ORDERS, REFUNDS, PAYMENTS LINKS, SUBSCRIPTIONS, CUSTOM REPORTS). Download = AccordionStepModal (report type → duration incl. FY shortcuts, 95-day cap → email toggle). Custom builder: base type, name, drag-drop columns (max 50), rename, max 15 reports. Downloads: max 3 concurrent, Processing→Ready.
5. **Payment Links:** list + AccordionStepModal create (amount, description, expiry, partial payments, reminders, customer); detail drawer QR + share + payments; states Active/Expired/Cancelled; Duplicate/Cancel.
6. **Payment Pages:** card grid + builder (title ≤40 chars, rich text, price-field types Item-with-Quantity/Fixed/Customer-Decides with conditional params, drag-reorder, pay-button label ≤16, theme, custom slug, post-payment radio message|redirect) + live preview; Publish.
7. **Payment Buttons:** wizard (title, amount, label ≤20, theme Dark/Light/Outline/Brand) → EmbedCodeModal (HTML/JS snippet + test widget).
8. **QR Codes:** create (Single-payment fixed-amount | Multiple; close-by disabled for multiple; customer optional) → QR render + PNG download + payments list.
9. **Invoices:** states draft/issued/partially_paid/paid/overdue/expired; builder with customer select-or-create, line items (GST rate, HSN 6-8 / SAC 2-6, inclusive/exclusive, CGST+SGST vs IGST by place-of-supply), notes/terms ≤2048, partial payments; live PDF preview; Issue/Resend/Download/Cancel.
10. **Subscriptions:** tabs Plans|Subscriptions; plan builder (interval, trial, upfront); subscription states Active/Paused/Cancelled/Halted; pause/resume/cancel + payment history + retry.
11. **Smart Collect:** VA/UPI-ID list, create identifier, payments-by-UTR, close.
12. **Customers:** table + create/edit modal + profile drawer (payments/invoices/subs/notes).
13. **Developers:** API Keys (Key ID visible, secret shown ONCE, regenerate w/ 2FA, owner/admin only); Webhooks (max 30 URLs, HTTPS, secret, events grid, 2XX-in-5s, backoff 24h then auto-disable, Edit/View Logs); API Logs (2xx–5xx chips, 15min/Hourly/Daily, columns Log ID|Method & Endpoint|Time|Response, request/response drawer); Docs (interactive explorer, error catalog, Postman button); MCP page (server status, tools reference, connected agents, permissions, "Copy MCP config").
14. **Account & Settings:** sections Website&app (website details + policy pages, API keys, webhooks) · Business (details, GST, support, activation, tickets, team) · Payments&refunds (credits 3-level alerts, balances segregated Online/In-Person/APM-Intl + reserve, limits, capture 12min–3days & refund speed) · Bank&settlements · Notifications (email/SMS/WhatsApp) · Checkout (styling: brand ≥80% similar, bg RGB/HSL/HEX, border rounded/sharp, font, sidebar graphic, trusted badge; features: language, collect email optional/mandatory, flash checkout, banner, mandate summary, order banner; payment configuration: show/hide + drag reorder, custom blocks, UPI QR/apps/ID toggles, bank visibility, card type/provider/issuer/BIN filters, EMI filters, wallets, pay later, COD, save-as-default, Configuration ID) · International (FIRS, purpose/IEC/HS codes) · Payment Methods (request states Under Review→Requested→Pending→Action Required→Re-initiated→Activated/Rejected/Cancelled).
   **Roles:** Owner · Pseudo Owner (max 2, audit) · Admin · Manager · Operations · Finance · ePos · Dispute Manager · Support · View-Only (Auditor).
15. **Offers:** Standard | No Cost EMI | Low Cost EMI; eligibility (min order, methods, usage caps); no international/CFB.
16. **Test Mode:** toggle; test UPI `success@…`/`failure@…`; test cards; mock bank Success/Failure page; separate test/live keys.
17. **Landing:** hero with animated routing visual + live agent ticker; bento features; code-snippet card (curl/node/python); pricing; docs CTA.

---

## 7. REFERENCE KNOWLEDGE (encode as mock behavior)
- Payment lifecycle: created → authorized → captured → refunded / failed; authorized auto-refunds if not captured in 3 days; late authorization (<0.5%).
- Order states: created / attempted / paid (paid blocks further attempts).
- KYC states: under_review / needs_clarification / activated / suspended / rejected; CKYC instant path; DigiLocker/manual fallback; video KYC; ₹1 penny-drop bank check.
- Webhook events: order.paid · payment.authorized · payment.captured · payment.failed · refund.processed · settlement.created · subscription.charged · payment_link.paid · dispute.created …
- Settlements: T+2 domestic / T+7 international; segregated balances; no cross-channel transfers; reserve balance = max negative limit.
- Currency exponents: INR paise (2), JPY 0, KWD 3.
- Report schema columns: Payments (Payment ID, Amount, Currency, Status, Method, Customer Email/Contact, Created/Captured At, Fee, Tax, Net, Order ID, VPA, RRN, Error…), Refunds, Settlements (UTR, Fees, Tax), Orders (Amount Paid/Due, Attempts), Customers, Cards (Network, Issuer, Last 4).

---

## 8. PHASE PROMPTS

> The phase blocks below are summaries. The long-form prompts live in `prompts/NN.md`
> (`00.md` = P0), extracted from the origin transcript — feed those, gate on the
> ACCEPTANCE lines here.

### BUILD ORDER (follow this, not the numbering below)
`P0 → P10 → P1 → P3 → P4 → P8 → P5 → P6 → P7 → P9 → P2 → P11 → P12`

Phase IDs are stable so the acceptance lists stay quotable; only the order changed.
The reasoning:
- **P10 is the product.** Sandbox PSP, `/v1` API, webhook dispatcher and the state machine
  are what make this a payment gateway. Section 9's definition of 90% is essentially
  P0 + P10 + part of P8. Building it second means every screen after it is wired to a real
  engine instead of seed rows, and stopping early still leaves something that works.
- **P2 (landing page) moves late.** It sells a product that does not exist yet at position 3.
- **P8 (Developers Hub) moves up**, right after the first data screens — it is the natural
  place to see the P10 engine's webhook signatures and API logs.

**Stop-early checkpoints.** After `P0 → P10` you have a working headless gateway.
After `+ P1 → P3 → P4` you have one a demo can be given on. Both are legitimate places
to stop; only continue past them if the remaining phases earn their time.

### P0 — Bootstrap, Schema, Seed
Read CLAUDE.md + master file. Init Next.js 16 (TS strict, src/), Tailwind, Prisma+SQLite; install framer-motion, recharts, zustand, lucide-react, zod, qrcode. Write `prisma/schema.prisma` implementing Section 2 entities with enums (PaymentStatus created/authorized/captured/failed/refunded; OrderStatus created/attempted/paid; SettlementStatus created/processed/failed; Subscription states; Invoice states), indexes on merchant_id, LedgerEntry double-entry. Migrate. Write `prisma/seed.ts`: demo merchant "Acme Stores", 3 users (owner/admin/auditor), test+live ApiKeys (`ap_test_…`/`ap_live_…`), 2 webhooks, 40 customers, 300 payments/90 days (~6% failed, few refunds/disputes), 12 settlements (T+2), 6 links, 3 pages, 2 QR, 8 invoices, 2 plans, 4 subs, 3 agents + 20 agent_actions. Deterministic. ACCEPTANCE: migrate+seed+build green; Prisma Studio shows data.

### P1 — Design System + UI Kit
Build Section 5 tokens + all listed components; demo route `/design` showing every component. ACCEPTANCE: `/design` renders; build green.

### P2 — Landing Page
Section 6.17 with Framer Motion scroll reveals + parallax orbs; routes `/`, `/pricing`, `/docs` stub. ACCEPTANCE: responsive; build green.

### P3 — Auth + Onboarding + App Shell
Login/signup (bcrypt + JWT session cookie); onboarding wizard (business type → PAN → GST optional → bank penny-drop → review) with KYC states; shell: sidebar groups, topbar search, Test/Live toggle, avatar, Help pill; Cmd+K routes; auditor read-only. ACCEPTANCE: seeded owner login works; shell navigates; toggle swaps datasets.

### P4 — Home + Transactions
Section 6.1–2 with seed data; drawer actions mutate DB. ACCEPTANCE: every filter works; drawer Capture/Refund mutate.

### P5 — Settlements + Reports
Section 6.3–4; CSV downloads real; schedule persists. ACCEPTANCE: CSV opens; 3-concurrent banner shows.

### P6 — Links, Pages, Buttons, QR
Section 6.5–8; publishing creates working hosted routes `/pay/l/:slug`, `/pay/p/:slug`. ACCEPTANCE: hosted routes render checkout.

### P7 — Invoices, Subscriptions, Customers, Smart Collect
Section 6.9–12; issuing invoice creates pay link; paying it in sandbox flips to paid. ACCEPTANCE: flow works end-to-end.

### P8 — Developers Hub + MCP
Section 6.13; webhook resend verifies signature in logs; Try-it creates real sandbox order. ACCEPTANCE: signature check visible; order appears.

### P9 — Settings, Team, Checkout Styling
Section 6.14; styling changes reflect on `/pay/*`; roles enforced. ACCEPTANCE: auditor blocked from writes.

### P10 — Sandbox PSP + Public API + Webhooks (logic phase) — **BUILD THIS SECOND, right after P0**
`/v1` routes with Basic auth, tenant-scoped, zod-validated, idempotent. Hosted checkout `/checkout/:orderId` (UPI/card/netbanking tabs; success@/failure@ UPI; 4111… success, 4000…0002 decline; mock bank Success/Failure). State machine honors auto-capture. Webhook dispatcher: HMAC sign, backoff retries, delivery logs. Settlement simulator on simulated clock (T+2) creating Settlement + LedgerEntries + balances. Refunds normal/instant. ACCEPTANCE (the 90% loop): `scripts/e2e-sandbox.sh` → create order → pay → webhook 200 → captured → settlement after T+2 → CSV includes it.

### P11 — Agent Console + NL Queries + Migration Wizard
Agents list/scopes/status; activity timeline; permission editor; pause agent; dunning agent (retry at simulated optimal times); dispute agent drafts evidence (template NL, editable, one-click submit). NL bar parses canned intents ("failed UPI payments last 7 days", "top 5 customers by volume") → Prisma → table+chart. Migration wizard: source (Razorpay/Stripe) → paste keys (encrypted, mock-validate) → preview import → code-diff snippets → go-live checklist. ACCEPTANCE: 5 canned NL queries correct.

### P12 — Polish, E2E, README, PRD Audit
Run e2e; a11y + responsive pass; route-level code splitting; `npm run seed:reset`; README (ASCII architecture, runbook, env vars, "the last 10%"); walk Section 10 checklist → table DONE/PARTIAL/MISSING → fix PARTIALs; lint+build green; conventional commits per phase.

---

## 9. DEFINITION OF 90% (final acceptance)
- [ ] All P0+P1+P2 pages render with seed data, responsive.
- [ ] Sandbox loop: order → checkout pay → signed webhook → captured → settlement T+2 → report exports.
- [ ] MCP endpoint lists tools; Agent Console shows agent actions.
- [ ] Roles enforced; test/live toggle swaps data; no dead buttons.
- [ ] `npm run build` + `npm run lint` green; README runbook present.



### APPENDIX — 100% PAGE & OPTION INVENTORY
> **REFERENCE ONLY — NOT A BUILD LIST.** This is a map of what a mature gateway contains,
> here so mocked screens use plausible states, labels and edge cases. Building it is years
> of work for a large team. Section 6 is the scope; Section 9 is the finish line.
> If you are an agent reading this file: do not create pages from this appendix.

[0] GLOBAL & SUPPORT
- Top bar: switcher Payments|Banking Plus|Payroll|Partners; global search; alerts; profile; Switch Merchant.
- Test/Live toggle (separate keys). Help float: tickets (last 3 open), chat/callback, escalate on SLA breach, docs.

[1] ONBOARDING & KYC
- Signup OTP→password→business type; Basic (name, mobile OTP, platforms, website/app links add-later, socials, review);
  Business (registered/unregistered→subtype, PAN auto-fetch confirm/edit, brand, DOI, review);
  Documents (GSTIN+cert, UDYAM, additional SEC/IEC/postpaid); KYC paths CKYC-OTP | DigiLocker | manual
  (Aadhaar/Voter/Passport), category/sub-category, delivery time, bank ₹1 penny-drop (fallback cancelled-cheque
  video/manager letter); Video KYC fallback (original PAN, 8am–7pm); states under_review/needs_clarification/
  activated/suspended/rejected; assisted onboarding; multi-account; entity-change rule (PAN immutable→new MID);
  Re-KYC banner + statuses (2y/8y; 30d hold; 60d live-disabled).

[2] HOME
- Unified: quick actions; Your Business (Received online+POS, Paid-out API/bulk/S2P/vendor/payroll, balances breakup);
  insights (collected, SR, refunds + weekly Δ).
- Payments home: AI assistant; account overview; key updates; payments overview (collected/refunds/orders/chart/
  range); top insights; method-split pie; products-for-you.

[3] TRANSACTIONS — Payments (capture/refund/details/settlement breakup, late-auth), Refunds (batch, speeds),
Orders (created/attempted/paid), Disputes (accept/contest/evidence/reports), Success Rate (method tabs,
network/bank filters, failure reasons, downtime overlay).

[4] SETTLEMENTS — list+breakup+on-hold; Instant/on-demand; cycle, available/negative/reserve, segregated
(Online/In-Person/APM-Intl), next settlement.

[5] REPORTS — download (type/format/range incl FY/95d/email); schedule (T+1, frequency, time, recipients, edit);
custom (drag-drop ≤50 cols, ≤15 reports, CSV/Excel/Txt); downloads tracker; 3-concurrent limit.

[6] LINKS — standard/UPI, batch, edit/duplicate/cancel/resend, reminders, partial, offers, transfer, customise,
WhatsApp bot, states.
[7] PAGES — builder (title≤40, rich text, socials, T&C; price fields qty/fixed/customer-decides +stock/min/max,
img≤500KB; custom inputs; reorder; pay≤16; 80G; custom URL, theme, expiry, post-pay msg|redirect, hyperlink code;
domain link; goal tracker; plugins).
[8] BUTTONS + .ME — templates Quick/Buy/Donations/Custom/Subscription; label≤20; themes; embed+test widget;
redirect+msg; 80G; pixel; prefill; stock; platform plugins; razorpay.me manage.
[9] INVOICES — full create (addresses, place-of-supply IGST vs CGST+SGST, items+HSN/SAC/cess/incl-excl,
notes≤2048, partial); draft/issue/update/cancel/delete/duplicate/resend/PDF; items dashboard; intl currency.
[10] ROUTE — linked accounts/stakeholders, transfers(+idempotent), reversals, schedule/hold, account codes, reports.
[11] SUBSCRIPTIONS — plans, subs (pause/resume/cancel/update/add-ons/QR-autopay), offers, retries, states.
[12] SMART COLLECT — VA/VPA/QR (+TPV, batch, vanity, custom nos), expiry, close, UTR fetch, refunds.
[13] QR — single|multiple, fixed yes/no, close-by, customer tag, GST QR, image download, refunds.
[14] OFFERS+EMI² — standard/No-Cost/Low-Cost; eligibility check; affordability widget.
[15] OPTIMIZER — providers, rules+priority+default, dynamic routing, CVV-less, SR analytics, single recon, roles.
[16] MAGIC/COD — COD blocklist, shipping, coupons, RTO intelligence+logistics, prepay conversion, analytics.
[17] CHECKOUT INTEGRATION — Standard/Custom/Hosted/S2S/Quick; all SDKs+plugins; QuickBuy, saved cards,
native OTP, rain-day, UPI intent/collect/QR, turbo UPI, TPV.
[18] WEBSTORE/WIDGETS/WHATSAPP — store CRUD; buyer protection; trusted badge; WhatsApp integration.
[19] POS+BILLME — devices, orders, payments, refunds, settlements; bills, campaigns, surveys, feedback,
complaints, profiling, media bank, store mgmt, user access, Digi Printer.
[20] INTERNATIONAL — cards activation, non-3DS, AVS; virtual accounts (ACH/FPS/SEPA/EFT/SWIFT…), invoice+buyer
upload, platform connect, savings calculator; local methods; purpose/IEC/HS; FIRS; forex calendar.
[21] TPV/TPAP/WALLET/RECURRING — TPV flows; TPAP (onboarding, UPI Lite, mandates, UPI numbers); wallet ops;
recurring auth flows (card/emandate/NACH/UPI/wallet), reserve pay, batch.
[22] BANKING X — payouts (bank/VPA/card, batch+approvals, scheduled, thresholds, multi-bank routing);
payout links; vendor payments (invoices/GRN/PO/advances/TDS/portal/multi-branch); payroll (full HR+statutory+
payslips+Form16+integrations); tax (advance/TDS/GST); current a/c+statement SFTP; contacts; fund accounts;
escrow; cost centers; CA portal; capital (LoC, cash advance, corporate cards, B2B financing).
[23] CUSTOMERS & ENGAGE — CRUD+profile; refund tracker; loyalty/wallet campaigns.
[24] PARTNERS — aggregator onboarding (API/bulk/xpress, partner auth), service (client KYC), technology
(embedded, control-of-funds, OAuth, co-brand), capital/POS, commissions, earnings.
[25] DEVELOPERS — keys (2FA regen, deactivate now/24h); webhooks (≤30, secret, alert email, 2XX-5s, 24h backoff);
API/webhook logs viewer; MCP (local/remote, OAuth, tools ref); n8n; app store; SDKs; CLI; Postman; sandbox.
[26] ACCOUNT & SETTINGS — account details+2FA; business/GST/support/activation/tickets; team (10 roles+matrix);
credits (3 types+3-level alerts); balances (reserve+segregated); limits (≥100 words+invoice); capture&refund
(12min–3d); bank change (statement+cheque video); notifications; checkout styling (7 opts); checkout features
(6 opts); payment configuration (blocks, BIN, UPI toggles, save-default, config ID); FIRS; intl codes;
payment methods (Action Required flow); website (primary+5, BVS+agent review).
[27] TEST/SANDBOX — test cards/UPI, mock bank, sandbox setup.