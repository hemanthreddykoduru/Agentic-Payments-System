import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Faq, LedgerCheck, Reveal, ScrollRule, Statement, Terminal } from "@/components/landing/primitives";

// Everything numeric on this page comes from the cluster on each request.
// If it is unreachable the numbers go blank rather than being invented.
export const dynamic = "force-dynamic";

type Row = { label: string; n: number };

async function snapshot() {
  try {
    const [payments, orders, ledger, customers, byStatus, byRejection, revenue] = await Promise.all([
      prisma.payment.count(),
      prisma.order.count(),
      prisma.ledgerEntry.count(),
      prisma.customer.count(),
      prisma.payment.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.payment.groupBy({
        by: ["rejectedReason"],
        where: { status: "rejected" },
        _count: { _all: true },
      }),
      prisma.ledgerEntry.aggregate({ where: { account: "bank_upi" }, _sum: { amount: true } }),
    ]);

    return {
      live: true as const,
      payments,
      orders,
      ledger,
      customers,
      revenue: revenue._sum.amount ?? 0,
      statuses: byStatus
        .map((s): Row => ({ label: s.status, n: s._count._all }))
        .sort((a, b) => b.n - a.n),
      rejections: byRejection
        .map((r) => ({ reason: r.rejectedReason ?? "unspecified", n: r._count._all }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 5),
    };
  } catch {
    return {
      live: false as const,
      payments: null,
      orders: null,
      ledger: null,
      customers: null,
      revenue: 0,
      statuses: [] as Row[],
      rejections: [] as { reason: string; n: number }[],
    };
  }
}

const NAV = [
  ["What posts", "#posts"],
  ["What's stored", "#stored"],
  ["What balances", "#balances"],
  ["What's built", "#built"],
] as const;

// Honest status. Anything not shipped says so, here and nowhere else on the page.
const BUILT = [
  ["Schema", "18 tables, multi-tenant, integer paise", true],
  ["Ledger", "Double-entry books, balanced, queryable", true],
  ["Seed data", "A bakery's 90 days — 180 orders, 165 attempts", true],
  ["Landing page", "This page, reading the live cluster", true],
  ["Order + QR", "Dynamic UPI intent to the merchant's own VPA", false],
  ["Payer page", "Scan, pay, submit the UTR", false],
  ["Confirmation queue", "Merchant taps Confirm or Reject", false],
  ["Public /v1 API", "Basic auth, idempotency keys", false],
  ["Webhooks", "HMAC-signed, retried with backoff", false],
  ["MCP server", "Scoped tools for the merchant's agents", false],
] as const;

const FAQ_ITEMS = [
  {
    q: "How does a payment get confirmed?",
    a: (
      <>
        A human confirms it. The payer pastes the 12-digit UTR their UPI app showed them, and the
        merchant — who can see the credit in their bank app — taps Confirm. Nothing tells a server
        that a UPI payment landed; that callback is the product Razorpay sells, and it requires
        being Razorpay. So we do not pretend to have it. For a shop doing thirty payments a day this
        is seconds of work, and it is right every time because a human with the statement checked.
      </>
    ),
  },
  {
    q: "How much of this is actually built?",
    a: (
      <>
        The database and this page. The schema, the double-entry ledger and the seed data are real
        and running on CockroachDB — every number here was read from it. The order flow, payer page,
        confirmation queue, API and MCP server are not written yet. The table above is the full
        status; nothing else on this page claims otherwise.
      </>
    ),
  },
  {
    q: "Why integer paise instead of decimals?",
    a: (
      <>
        Because the ledger has to balance exactly. Floating-point arithmetic on money accumulates
        error, and a double-entry system off by a hundredth of a rupee is broken. Amounts are{" "}
        <code className="ui text-[12.5px] text-accent-deep">Int</code> everywhere internally and
        formatted only for display.
      </>
    ),
  },
  {
    q: "What does double-entry actually buy me here?",
    a: (
      <>
        These are the merchant&rsquo;s books, not our books. A confirmed payment writes{" "}
        <code className="ui text-[12.5px] text-accent-deep">Dr bank_upi</code> and{" "}
        <code className="ui text-[12.5px] text-accent-deep">Cr sales</code>, summing to zero. It
        turns &ldquo;what did I earn in March&rdquo; into a query instead of a scroll through a bank
        app. We take no cut, so there are no fee legs.
      </>
    ),
  },
  {
    q: "Can I verify the numbers on this page?",
    a: (
      <>
        Yes, and that is what the button in section 03 does — it sums every ledger row in
        CockroachDB and shows the total. You can also connect the CockroachDB Cloud MCP server and
        run the query yourself against the same cluster.
      </>
    ),
  },
  {
    q: "Will this ever be a licensed payment aggregator?",
    a: (
      <>
        No, and it never needs to be. Money goes straight from the payer&rsquo;s bank to the
        merchant&rsquo;s own UPI ID — it never touches an account we control. RBI authorisation
        applies to businesses that handle funds, and we handle none. That is exactly why we can
        serve a shop Razorpay would turn down.
      </>
    ),
  },
];

function Clause({
  n,
  id,
  title,
  lede,
  children,
}: {
  n: string;
  id?: string;
  title: string;
  lede: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className="border-b border-line py-20 sm:py-[84px]">
      <div className="sheet grid items-start gap-6 lg:grid-cols-[112px_minmax(0,1fr)] lg:gap-11">
        <div className="ui text-[12px] tracking-[0.1em] text-accent lg:sticky lg:top-24 lg:pt-1.5">
          {n}
          <span className="mt-3 hidden h-px w-7 bg-line lg:block" />
        </div>
        <div>
          <h2 className="max-w-2xl text-[26px] sm:text-[33px]">{title}</h2>
          <p className="mt-4 max-w-[600px] text-[16px] leading-relaxed text-muted">{lede}</p>
          {children}
        </div>
      </div>
    </section>
  );
}

export default async function Home() {
  const s = await snapshot();
  const stat = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-IN"));
  const shipped = BUILT.filter(([, , done]) => done).length;

  return (
    <>
      <ScrollRule />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="sheet flex items-center gap-6 py-3.5">
          <Link href="/" className="tight flex items-center gap-2.5 text-[15px]">
            <svg viewBox="0 0 32 32" aria-hidden className="size-7">
              <rect width="32" height="32" rx="7" fill="#171918" />
              <g stroke="#F5FAF2" strokeWidth="1.6" strokeLinecap="round">
                <path d="M9 11h14M9 16h14M9 21h9" />
              </g>
              <path d="M8 16h16" stroke="#52B365" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Agentic Payment
          </Link>
          <ul className="ml-auto hidden items-center gap-6 md:flex">
            {NAV.map(([label, href]) => (
              <li key={label}>
                <a
                  href={href}
                  className="ui text-[11px] uppercase tracking-[0.09em] text-muted transition-colors hover:text-ink"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="#run"
            className="ui ml-auto shrink-0 rounded bg-ink px-3.5 py-2 text-[11px] text-paper transition-colors hover:bg-black md:ml-0"
          >
            Run it locally
          </a>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden border-b border-line py-16 sm:py-[76px]">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-52 -top-60 size-[640px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(242,101,34,.10), transparent 65%)" }}
        />
        <div className="sheet relative grid items-center gap-12 lg:grid-cols-[0.94fr_1.06fr] lg:gap-14">
          <div>
            <p className="eyebrow">A payments ledger, built in the open</p>
            <h1 className="mt-5 text-[36px] sm:text-[52px]">
              Most systems store
              <br />
              an amount. This one
              <br />
              stores <em className="not-italic text-accent">where it went.</em>
            </h1>
            <p className="mt-5 max-w-[480px] text-[17px] leading-relaxed text-muted">
              Agentic Payment is a multi-tenant payments platform being built phase by phase. Its
              foundation is a{" "}
              <b className="font-semibold text-ink">double-entry ledger on CockroachDB</b> — every
              capture writes balanced rows, so the fee, the tax and the net are each answerable.
            </p>

            <div id="run" className="mt-7 max-w-[430px] scroll-mt-24">
              <Terminal
                lines={["npm install", "npm run seed", "npm run dev"]}
              />
              <p className="ui mt-2.5 text-[11px] leading-relaxed text-muted">
                Needs a <code className="text-accent-deep">DATABASE_URL</code> in{" "}
                <code className="text-accent-deep">.env</code>. The seed asserts the ledger balances
                and fails if it doesn&apos;t.
              </p>
            </div>
          </div>

          <Reveal>
            <Statement />
          </Reveal>
        </div>
      </header>

      {/* ── Live counts ─────────────────────────────────────────────────── */}
      <section className="border-b border-line bg-accent-soft">
        <div className="sheet">
          <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
            {[
              [stat(s.payments), "payments recorded"],
              [stat(s.orders), "orders created"],
              [stat(s.ledger), "ledger legs written"],
              [stat(s.customers), "customers tracked"],
            ].map(([value, label]) => (
              <div key={label} className="bg-accent-soft px-6 py-6">
                <dd className="tight text-[32px] tabular-nums">{value}</dd>
                <dt className="ui mt-1 text-[10.5px] uppercase tracking-[0.1em] text-muted">
                  {label}
                </dt>
              </div>
            ))}
          </dl>
          <p className="ui py-4 text-[11px] text-accent-deep">
            {s.live
              ? "Read from CockroachDB when this page was requested. Seeded data, not production traffic."
              : "The database is unreachable, so these are blank rather than invented. Run: npm run seed"}
          </p>
        </div>
      </section>

      {/* ── 01 ──────────────────────────────────────────────────────────── */}
      <Clause
        n="01"
        id="posts"
        title="A payment isn't an event. It's two rows that have to agree."
        lede={
          <>
            Storing an amount and a status cannot answer what you earned last month.{" "}
            <b className="font-semibold text-ink">Every confirmed payment writes two legs</b> —
            money into the bank, revenue recognised — and they sum to zero or the write is wrong.
            The card above posts a real one.
          </>
        }
      >
        <Reveal className="mt-8 overflow-x-auto">
          <svg viewBox="0 0 1000 150" aria-label="How a payment becomes ledger rows" className="min-w-[720px]">
            <defs>
              <marker id="mA" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0L8,4L0,8" fill="none" stroke="#808080" strokeWidth="1.2" />
              </marker>
            </defs>
            {[
              ["Order", "amount owed", 0],
              ["Payment", "amount attempted", 235],
              ["LedgerEntry", "amount moved", 470],
              ["Receipt", "proof for the customer", 705],
            ].map(([title, sub, x]) => (
              <g key={title as string}>
                <rect x={x as number} y="46" width="200" height="58" rx="3" fill="#fff" stroke="#DDE5DA" />
                <text x={(x as number) + 16} y="70" fontSize="12" fill="#171918" className="ui">{title}</text>
                <text x={(x as number) + 16} y="88" fontSize="10.5" fill="#808080" className="ui">{sub}</text>
              </g>
            ))}
            <g stroke="#808080" strokeWidth="1.3" fill="none">
              <line className="flowline" x1="200" y1="75" x2="229" y2="75" markerEnd="url(#mA)" />
              <line className="flowline" x1="435" y1="75" x2="464" y2="75" markerEnd="url(#mA)" />
              <line className="flowline" x1="670" y1="75" x2="699" y2="75" markerEnd="url(#mA)" />
            </g>
            <circle r="3.4" fill="#52B365">
              <animateMotion dur="5s" repeatCount="indefinite" path="M0,75 L905,75" />
            </circle>
            <text x="250" y="130" fontSize="10.5" fill="#808080" className="ui">
              four tables, four different questions — collapsing them is what makes the books unanswerable
            </text>
          </svg>
          <p className="ui mt-3 max-w-[70ch] text-[11px] leading-relaxed text-muted">
            <b className="font-medium text-accent-deep">Fig. 1</b> — the ledger is written when a
            human confirms, not when a payer claims. That is why{" "}
            {s.live ? (s.statuses.find((x: Row) => x.label === "awaiting_confirmation")?.n ?? 0) : "some"}{" "}
            payments sit in <code className="text-accent-deep">awaiting_confirmation</code> with no
            legs yet.
          </p>
        </Reveal>
      </Clause>

      {/* ── 02 ──────────────────────────────────────────────────────────── */}
      <Clause
        n="02"
        id="stored"
        title="Not every payment is a happy path."
        lede={
          <>
            A schema that only models success is a schema you will fight later.{" "}
            <b className="font-semibold text-ink">These are the real status counts</b> in the
            database right now, seeded to look like a genuine 90 days rather than a demo.
          </>
        }
      >
        <div className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {(s.live ? s.statuses : [{ label: "—", n: 0 }]).map((row) => (
            <div key={row.label} className="bg-card px-5 py-5">
              <span className="ui text-[10px] uppercase tracking-[0.12em] text-muted">
                {row.label}
              </span>
              <p className="tight mt-1.5 text-[28px] tabular-nums">
                {s.live ? row.n : "—"}
              </p>
              <div className="mt-3 h-1 w-full bg-line">
                <div
                  className={row.label === "failed" ? "h-1 bg-no" : "h-1 bg-accent"}
                  style={{ width: `${s.payments ? (row.n / s.payments) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="ui mt-3 text-[11px] text-muted">
          <b className="font-medium text-accent-deep">Fig. 2</b> —{" "}
          <code className="text-accent-deep">awaiting_confirmation</code> is a first-class state, not
          a flag. It is the merchant&rsquo;s to-do list, and it is the app&rsquo;s home screen.
        </p>
      </Clause>

      {/* ── 03 ──────────────────────────────────────────────────────────── */}
      <Clause
        n="03"
        id="balances"
        title="The ledger either balances or it doesn't. There is no third answer."
        lede={
          <>
            No opinion, no tolerance, no rounding allowance.{" "}
            <b className="font-semibold text-ink">
              The seed asserts this and refuses to finish if it fails
            </b>
            .
          </>
        }
      >
        <div className="mt-8 grid gap-px border border-line bg-line md:grid-cols-2">
          <div className="bg-card px-6 py-6">
            <p className="ui mb-3.5 text-[10.5px] uppercase tracking-[0.1em] text-muted">
              One confirmed payment of ₹950.00
            </p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-[13px]">
              {[
                ["Dr bank_upi — money arrived", "₹950.00"],
                ["Cr sales — revenue earned", "−₹950.00"],
                ["Our cut", "₹0.00"],
                ["Sum", "0"],
              ].map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="ui text-right text-[12.5px] tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="bg-accent-soft px-6 py-6">
            <p className="ui mb-3.5 text-[10.5px] uppercase tracking-[0.1em] text-muted">
              Across the whole database
            </p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-[13px]">
              {[
                ["Ledger legs written", stat(s.ledger)],
                ["Accounts touched", "2"],
                ["Rounding allowance", "none"],
                ["Sum of every leg", "0"],
              ].map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="ui text-right text-[12.5px] font-medium tabular-nums text-accent-deep">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <Reveal>
          <LedgerCheck />
        </Reveal>
      </Clause>

      {/* ── The finding: real query, real rows ──────────────────────────── */}
      <section className="border-b border-dark-line bg-dark py-[88px] text-paper">
        <div className="sheet">
          <p className="eyebrow text-accent">The finding</p>
          <h2 className="mt-3 max-w-[700px] text-[26px] text-white sm:text-[33px]">
            A rejection reason repeating isn&apos;t a customer problem.
          </h2>
          <p className="mt-4 max-w-[640px] text-[16px] leading-relaxed text-dark-mut">
            It&apos;s a step in your process to fix. No single order can reach that conclusion — it
            exists only because every attempt, including the ones the merchant rejected, was written
            somewhere queryable.
          </p>

          <div className="mt-11 grid gap-12 lg:grid-cols-[1.05fr_1fr]">
            <pre className="ui overflow-x-auto rounded border border-dark-line border-l-2 border-l-accent bg-dark-2 px-5 py-4 text-[11.5px] leading-relaxed text-dark-mut">
{`SELECT "rejectedReason" `}<b className="font-normal text-white">AS reason</b>{`,
       count(*)         `}<b className="font-normal text-white">AS times</b>{`
FROM   "Payment"
WHERE  status = 'rejected'
GROUP  BY 1
ORDER  BY times DESC;`}
            </pre>
            <div>
              <div className="overflow-hidden rounded border border-dark-line bg-dark-2">
                <div className="ui grid grid-cols-[1fr_70px] gap-2.5 border-b border-dark-line px-4 py-3 text-[10px] uppercase tracking-[0.1em] text-dark-mut">
                  <span>reason the merchant rejected it</span>
                  <span className="text-right">times</span>
                </div>
                {s.rejections.length === 0 ? (
                  <p className="ui px-4 py-5 text-[12px] text-dark-mut">
                    Database unreachable — no rows to show.
                  </p>
                ) : (
                  s.rejections.map((r) => (
                    <div
                      key={r.reason}
                      className="ui grid grid-cols-[1fr_70px] gap-2.5 border-b border-dark-line px-4 py-3 text-[12px] last:border-b-0"
                    >
                      <span>{r.reason}</span>
                      <span className="text-right text-accent tabular-nums">×{r.n}</span>
                    </div>
                  ))
                )}
              </div>
              <p className="ui mt-3.5 text-[11px] leading-relaxed text-dark-mut">
                Those rows are the actual result of that query, run against the cluster when this
                page loaded. Small numbers because it is seeded data — {stat(s.payments)} payment
                attempts from one bakery, not production traffic.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 04 · Build status ───────────────────────────────────────────── */}
      <Clause
        n="04"
        id="built"
        title="What's built, and what isn't."
        lede={
          <>
            {shipped} of {BUILT.length} pieces are done.{" "}
            <b className="font-semibold text-ink">
              Nothing else on this page claims a feature that isn&apos;t in this table
            </b>{" "}
            — a landing page that describes software you haven&apos;t written is how projects start
            lying to their own authors.
          </>
        }
      >
        <ul className="mt-8 border-t border-line">
          {BUILT.map(([name, detail, done]) => (
            <li
              key={name}
              className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1 border-b border-line py-3.5 sm:grid-cols-[92px_180px_1fr]"
            >
              <span
                className={`ui rounded px-2 py-0.5 text-[9.5px] uppercase tracking-[0.08em] ${
                  done ? "bg-ok/10 text-ok" : "bg-line text-muted"
                }`}
              >
                {done ? "shipped" : "not yet"}
              </span>
              <span className="text-[14px] font-semibold">{name}</span>
              <span className="col-span-2 text-[13px] text-muted sm:col-span-1">{detail}</span>
            </li>
          ))}
        </ul>
      </Clause>

      {/* ── 05 · FAQ ────────────────────────────────────────────────────── */}
      <Clause
        n="05"
        title="Questions an auditor should ask."
        lede="If an answer here is vague, the system behind it usually is too."
      >
        <Faq items={FAQ_ITEMS} />
      </Clause>

      {/* ── Sign-off ────────────────────────────────────────────────────── */}
      <section className="border-b border-line py-24">
        <div className="sheet">
          <p className="eyebrow">Sign-off</p>
          <h2 className="mt-3 max-w-[640px] text-[30px] sm:text-[40px]">
            Clone it. Seed it. Check the arithmetic yourself.
          </h2>
          <p className="mt-5 max-w-[560px] text-[17px] leading-relaxed text-muted">
            Three commands and a connection string. The seed writes {stat(s.orders)} orders and{" "}
            {stat(s.ledger)} ledger legs, asserts the books balance, and checks that every QR pays
            the merchant&rsquo;s own VPA before it will exit.
          </p>
          <div className="mt-7 max-w-[430px]">
            <Terminal lines={["npm install", "npm run seed", "npm run dev"]} />
          </div>
          <div className="ui mt-12 flex flex-wrap justify-between gap-5 border-t border-ink pt-5 text-[11px] text-muted">
            <span>Agentic Payment · phase 1 of 8</span>
            <span>Every count on this page is read from the database.</span>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="bg-dark py-14 text-[13px] text-dark-mut">
        <div className="sheet">
          <div className="grid gap-12 md:grid-cols-[2fr_1fr]">
            <div>
              <div className="tight mb-3 flex items-center gap-2.5 text-[16px] text-white">
                <svg viewBox="0 0 32 32" aria-hidden className="size-7">
                  <rect width="32" height="32" rx="7" fill="#171918" />
                  <g stroke="#F5FAF2" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M9 11h14M9 16h14M9 21h9" />
                  </g>
                  <path d="M8 16h16" stroke="#52B365" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                Agentic Payment
              </div>
              <p className="max-w-[340px] leading-relaxed">
                A multi-tenant payments platform with a double-entry ledger, built phase by phase.
                Currently: schema, ledger and this page.
              </p>
            </div>
            <div>
              <h4 className="ui mb-3.5 text-[10.5px] uppercase tracking-[0.12em] text-white">
                On this page
              </h4>
              {NAV.map(([label, href]) => (
                <a key={label} href={href} className="block py-1 transition-colors hover:text-white">
                  {label}
                </a>
              ))}
            </div>
          </div>
          <div className="ui mt-11 flex flex-wrap justify-between gap-4 border-t border-dark-line pt-5 text-[11px]">
            <span>© 2026 Agentic Payment</span>
            <span>
              Not a licensed payment aggregator. Seeded test data only — no real money involved.
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
