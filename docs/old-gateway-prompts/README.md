# Phase prompts

Extracted verbatim from `chat-Payment_Gateway_Setup.md`. These are the long-form
versions of the phases that Section 8 of `AGENTIC_PAYMENT_MASTER.md` summarises in
a paragraph each — feed these, use Section 8 for the acceptance criteria.

File `NN.md` is phase `PNN` (`00.md` = P0).

## Feed in this order

| # | File | Phase | Why here |
|---|------|-------|----------|
| 1 | `00.md` | P0 | Schema + seed. Everything needs it. |
| 2 | `10.md` | P10 | **The engine.** Sandbox PSP, `/v1` API, webhooks, settlement sim. |
| 3 | `01.md` | P1 | Design system, so every later screen has parts to build from. |
| 4 | `03.md` | P3 | Auth + app shell. |
| 5 | `04.md` | P4 | Home + Transactions, now backed by a real engine. |
| 6 | `08.md` | P8 | Developers hub — surfaces the P10 webhook logs and signatures. |
| 7 | `05.md` | P5 | Settlements + Reports. |
| 8 | `06.md` | P6 | Links, Pages, Buttons, QR. |
| 9 | `07.md` | P7 | Invoices, Subscriptions, Customers, Smart Collect. |
| 10 | `09.md` | P9 | Settings, Team, Checkout styling. |
| 11 | `02.md` | P2 | Landing page last — it advertises a product that now exists. |
| 12 | `11.md` | P11 | Agent Console, NL queries, Migration wizard. |
| 13 | `12.md` | P12 | Polish, E2E, README, audit. |

Stop-early checkpoints: after `00 → 10` you have a working headless gateway.
After `+ 01 → 03 → 04` you have something demoable.
