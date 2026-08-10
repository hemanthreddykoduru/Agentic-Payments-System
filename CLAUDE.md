@AGENTS.md

# AGENTIC PAYMENT — GLOBAL RULES
- Always read AGENTIC_PAYMENT_MASTER.md before any task. Build phases in order.
- What this is: the order and reconciliation layer on top of a merchant's OWN
  UPI ID, for small businesses who cannot get a Razorpay/Cashfree account.
  It is not a payment gateway and never will be.
- MONEY NEVER TOUCHES US. The QR always pays the merchant's own VPA. No
  escrow, no platform VPA, no routing, no splitting, no refunds through us.
  This is what keeps the project outside RBI PA/PG licensing — do not break
  it, not even in test mode.
- Never claim automatic payment confirmation. A human confirms: the payer
  submits the UTR, the merchant taps Confirm. Say so in UI, docs and copy.
- Never read bank SMS or email, never ask for bank credentials, card numbers,
  UPI PINs or OTPs. Account Aggregator is the only automatic route, later.
- Stack: Next.js 16 App Router, TS strict, Tailwind v4, Prisma + CockroachDB,
  framer-motion, recharts, zustand, lucide-react, zod, qrcode.
- Multi-tenant: every query filters by merchantId from session or API key.
- Amounts in integer paise. IDs prefixed (ord_, pay_, cust_, plink_, qr_,
  inv_, wh_, agt_, ldgr_).
- Ledger is double-entry and must sum to zero. It is the merchant's books.
- Design: paper-and-ink — paper #FBF9F6, ink #171412, orange accent #F26522,
  hairline borders, numbered clause sections, mono for labels and amounts.
  Dark band only for payoff sections and the footer.
- Every list: skeleton, empty, error, pagination. No dead buttons.
- Numbers shown to a user come from the database. If it is unreachable, show
  blank — never a placeholder that looks like data.
- Prefer the smallest change that passes ACCEPTANCE. No abstraction with one
  caller, no config for a value that never changes.
- SCOPE: build only what the current phase names. `docs/` holds archived
  Razorpay-parity material — reference only, never a build list.
- `legacy/upi-mock/` is the working prototype of the core loop. Port from it
  in P2 rather than rewriting the UPI link and QR logic.
- After each phase: run lint + build, list what to click to verify, then stop
  and wait for GO.

## CockroachDB migration workflow (v26 locks new tables)
`prisma migrate dev` fails — it replays migrations into a shadow database whose
tables come back schema_locked. The working sequence is:
1. `npm run db:unlock`
2. `npx prisma db push` (add `--force-reset` if a required column has no default)
3. `npm run db:unlock` again — the push creates new locked tables mid-run
4. `npx prisma db push` to finish, then `npx prisma generate`
5. Re-baseline: delete `prisma/migrations/0_init`, then
   `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script -o prisma/migrations/0_init/migration.sql`
   and `npx prisma migrate resolve --applied 0_init`
Schema pushes take 3–5 minutes against the cloud cluster. That is normal.
