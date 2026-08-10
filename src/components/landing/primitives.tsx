"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const reduced = () =>
  typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Reading progress drawn down the outer margin, like a pen tracking down a page.
 *  Lives outside the sheet, so it never sits on the first character of a line. */
export function ScrollRule() {
  const fill = useRef<HTMLSpanElement>(null);
  const nib = useRef<HTMLSpanElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      if (fill.current) fill.current.style.height = `${p * 100}%`;
      if (nib.current) nib.current.style.top = `${p * 100}%`;
      setScrolled(window.scrollY > 600);
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div
        aria-hidden
        className="fixed top-[76px] bottom-6 z-40 hidden w-0.5 bg-line pointer-events-none min-[1260px]:block"
        style={{ left: "calc(50vw - 590px - 26px)" }}
      >
        <span ref={fill} className="absolute inset-x-0 top-0 block h-0 bg-accent" />
        <span
          ref={nib}
          className="absolute -left-[3px] size-2 -translate-y-1 rounded-full bg-accent"
        />
      </div>
      <button
        onClick={() => scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        className={`fixed bottom-6 right-6 z-50 grid size-11 place-items-center rounded-full bg-ink text-paper transition-all hover:bg-black cursor-pointer ${
          scrolled ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
        ↑
      </button>
    </>
  );
}

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    // Under reduced motion the observer still runs — it just has nothing to
    // animate, since the transition durations are already collapsed in CSS.
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && (setOn(true), io.disconnect()),
      { threshold: 0.15, rootMargin: "0px 0px -40px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-[opacity,transform] duration-[550ms] ease-out ${
        on ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3.5"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ── The signature: a payment posts itself ────────────────────────────────────
   The inspiration struck words out of a contract. The equivalent act here is
   posting: an amount arrives and the ledger writes legs that must sum to zero.
   Legs stamp in one at a time, then the balance line proves itself. */

type Leg = { account: string; amount: number };
type Doc = {
  ref: string;
  title: string;
  lines: [string, string][];
  legs: Leg[];
  verdict: [string, "ok" | "no" | "neutral"];
  note: [string, string];
};

const inr = (paise: number) =>
  (paise < 0 ? "−" : "") +
  "₹" +
  Math.abs(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DOCS: Record<string, Doc> = {
  confirmed: {
    ref: "ord_000412 · sunrisebakery@ybl · utr 418293770021",
    title: "Confirmed",
    lines: [
      ["ORDER", "₹950.00 — birthday cake, 1kg. QR pays the bakery's own VPA."],
      ["PAYER", "Scanned, paid, pasted UTR 418293770021"],
      ["MERCHANT", "Saw the credit in her bank app and tapped Confirm"],
    ],
    legs: [
      { account: "bank_upi", amount: 95000 },
      { account: "sales", amount: -95000 },
    ],
    verdict: ["PAID", "ok"],
    note: ["Posted", "Two legs, and the books balance. No fee leg — the money never passed through us, so there is nothing to take a cut of."],
  },
  waiting: {
    ref: "ord_000418 · sunrisebakery@ybl · utr 771820034115",
    title: "Awaiting confirmation",
    lines: [
      ["ORDER", "₹420.00 — assorted pastries, box of 6"],
      ["PAYER", "Submitted a UTR four minutes ago"],
      ["MERCHANT", "Hasn't checked her bank app yet"],
    ],
    legs: [],
    verdict: ["WAITING ON A HUMAN", "neutral"],
    note: ["Held", "Nothing posts until the merchant confirms. A payer claiming they paid is not evidence that money arrived."],
  },
  rejected: {
    ref: "ord_000421 · sunrisebakery@ybl · utr 118273640092",
    title: "Rejected",
    lines: [
      ["ORDER", "₹3,800.00 — custom order, office event"],
      ["PAYER", "Submitted a UTR"],
      ["MERCHANT", "Rejected: no credit found in bank statement"],
    ],
    legs: [],
    verdict: ["NOT PAID", "no"],
    note: ["Withheld", "The rejection and its reason stay on the record. That is how a repeated excuse becomes visible."],
  },
};

const CHIP = {
  ok: "bg-[#E8F2EA] text-ok border-ok",
  no: "bg-no-soft text-no border-no",
  neutral: "bg-accent-soft text-accent-deep border-accent",
} as const;

export function Statement() {
  const [key, setKey] = useState<keyof typeof DOCS>("confirmed");

  return (
    <div className="overflow-hidden rounded border border-line bg-card shadow-[0_1px_2px_rgba(23,20,18,.05),0_26px_52px_-26px_rgba(23,20,18,.22)]">
      {/* Keyed, so switching tabs remounts and the posting animation restarts
          from zero without an effect reaching back to reset state. */}
      <Posting key={key} doc={DOCS[key]} />

      <div className="flex flex-wrap gap-1.5 border-t border-line px-4 py-3">
        {(Object.keys(DOCS) as (keyof typeof DOCS)[]).map((k) => (
          <button
            key={k}
            onClick={() => setKey(k)}
            className={`ui cursor-pointer rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
              k === key
                ? "border-ink bg-ink text-paper"
                : "border-line bg-card text-ink hover:border-accent hover:text-accent-deep"
            }`}
          >
            {DOCS[k].title}
          </button>
        ))}
      </div>
    </div>
  );
}

function Posting({ doc }: { doc: Doc }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    // Reduced motion collapses every delay to zero rather than taking a different
    // path — same sequence, no waiting, and no setState called straight from here.
    const [base, step, tail] = reduced() ? [0, 0, 0] : [420, 380, 260];
    const timers = doc.legs.map((_, i) => setTimeout(() => setShown(i + 1), base + i * step));
    timers.push(setTimeout(() => setShown(doc.legs.length + 1), base + doc.legs.length * step + tail));
    return () => timers.forEach(clearTimeout);
  }, [doc]);

  const sum = doc.legs.slice(0, shown).reduce((s, l) => s + l.amount, 0);
  const settled = shown > doc.legs.length;

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <span className="ui truncate text-[11px] text-muted">{doc.ref}</span>
        <span
          className={`ui shrink-0 rounded-full border px-2.5 py-1 text-[10px] tracking-[0.1em] transition-opacity duration-300 ${CHIP[doc.verdict[1]]} ${settled ? "opacity-100" : "opacity-0"}`}
        >
          {doc.verdict[0]}
        </span>
      </div>

      <div className="min-h-[330px] px-5 py-5">
        {doc.lines.map(([label, text]) => (
          <p key={label} className="mb-4 text-[13.5px] leading-relaxed">
            <span className="ui mb-0.5 block text-[10px] tracking-[0.12em] text-muted">{label}</span>
            {text}
          </p>
        ))}

        <div className="mt-6 border-t border-line pt-4">
          <span className="ui mb-2.5 block text-[10px] tracking-[0.12em] text-muted">
            LEDGER · the merchant\u2019s books
          </span>
          {doc.legs.length === 0 ? (
            <p className="ui py-3 text-[12px] text-muted">— no rows —</p>
          ) : (
            <>
              {doc.legs.slice(0, shown).map((l, i) => (
                <div
                  key={l.account}
                  className="stamp flex items-baseline justify-between border-b border-line/70 py-1.5"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <span className="ui text-[12px] text-muted">{l.account}</span>
                  <span className={`ui text-[12.5px] tabular-nums ${l.amount < 0 ? "text-no" : "text-ink"}`}>
                    {inr(l.amount)}
                  </span>
                </div>
              ))}
              <div className="flex items-baseline justify-between pt-2.5">
                <span className="ui text-[12px] text-ink">balance</span>
                <span
                  className={`ui text-[12.5px] tabular-nums ${settled && sum === 0 ? "text-ok" : "text-muted"}`}
                >
                  {settled && sum === 0 ? "0.00 ✓" : inr(sum)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div
        className={`min-h-[52px] border-t border-line bg-accent-soft px-4 py-3 text-[12.5px] transition-opacity duration-300 ${settled ? "opacity-100" : "opacity-0"}`}
      >
        <span className="ui mr-2 text-[10px] uppercase tracking-[0.08em] text-accent-deep">
          {doc.note[0]}
        </span>
        {doc.note[1]}
      </div>
    </>
  );
}

/** Runs the real balance query against CockroachDB and shows whatever comes back. */
export function LedgerCheck() {
  const [state, setState] = useState<
    { status: "idle" | "running" } | { status: "done"; sum: number; rows: number; ms: number } | { status: "error"; message: string }
  >({ status: "idle" });

  async function run() {
    setState({ status: "running" });
    const t0 = performance.now();
    try {
      const res = await fetch("/api/ledger-check");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setState({ status: "done", sum: d.sum, rows: d.rows, ms: Math.round(performance.now() - t0) });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "unknown error" });
    }
  }

  return (
    <div className="mt-8 overflow-hidden rounded border border-line bg-card">
      <div className="flex flex-wrap items-center gap-4 border-b border-line bg-accent-soft px-5 py-4">
        <p className="mr-auto max-w-[44ch] text-[13px] text-muted">
          Don&apos;t take the page&apos;s word for it — sum every ledger row in the database right now.
        </p>
        <button
          onClick={run}
          disabled={state.status === "running"}
          className="ui cursor-pointer rounded bg-ink px-4 py-2 text-[11px] text-paper transition-colors hover:bg-black disabled:opacity-50"
        >
          {state.status === "running" ? "Summing…" : state.status === "done" ? "Run it again" : "Sum the ledger"}
        </button>
      </div>

      <div className="grid min-h-[150px] md:grid-cols-[190px_minmax(0,1fr)]">
        {state.status === "done" ? (
          <>
            <div className="border-b border-line p-6 text-center md:border-b-0 md:border-r">
              <b className={`tight block text-6xl leading-none ${state.sum === 0 ? "text-ok" : "text-no"}`}>
                {state.sum}
              </b>
              <span className="ui mt-2 block text-[10.5px] uppercase tracking-[0.14em] text-ok">
                {state.sum === 0 ? "balanced" : "out of balance"}
              </span>
            </div>
            <dl className="grid content-center gap-2 p-6 text-[13px]">
              <div className="flex justify-between border-b border-line pb-2">
                <dt className="text-muted">Rows summed</dt>
                <dd className="ui tabular-nums">{state.rows.toLocaleString("en-IN")}</dd>
              </div>
              <div className="flex justify-between border-b border-line pb-2">
                <dt className="text-muted">Sum of all legs, in paise</dt>
                <dd className="ui tabular-nums">{state.sum}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Round trip to ap-south-1</dt>
                <dd className="ui tabular-nums">{state.ms} ms</dd>
              </div>
            </dl>
          </>
        ) : (
          <p
            className={`col-span-full self-center p-12 text-center text-[14px] ${
              state.status === "error" ? "text-no" : "text-muted"
            }`}
          >
            {state.status === "error"
              ? `Could not reach the database: ${state.message}`
              : state.status === "running"
                ? "Summing every row…"
                : "Press the button. Every LedgerEntry row is summed in CockroachDB and the total comes back here."}
          </p>
        )}
      </div>

      <p className="ui border-t border-line px-5 py-3 text-[10.5px] text-muted">
        {state.status === "error"
          ? "The failure is shown rather than a canned result."
          : "SELECT count(*), sum(amount) FROM \"LedgerEntry\" — a healthy double-entry ledger sums to exactly zero."}
      </p>
    </div>
  );
}

/** Commands that actually run in this repo today. Nothing aspirational. */
export function Terminal({ lines }: { lines: string[] }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="overflow-hidden rounded border border-line bg-card">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-line" />
        <span className="size-2.5 rounded-full bg-line" />
        <span className="size-2.5 rounded-full bg-line" />
        <span className="ui ml-2 text-[10.5px] text-muted">bash</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(lines.join("\n"));
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="ui ml-auto cursor-pointer text-[10.5px] text-muted transition-colors hover:text-accent-deep"
        >
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>
      <pre className="ui overflow-x-auto px-4 py-3.5 text-[12px] leading-[1.9]">
        {lines.map((l) => (
          <div key={l}>
            <span className="select-none text-accent">$ </span>
            <span className="text-ink">{l}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="mt-8 max-w-3xl">
      {items.map((it, i) => (
        <details key={i} className="group border-b border-line">
          <summary className="tight flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[16.5px] font-semibold marker:hidden">
            {it.q}
            <span className="ui shrink-0 text-accent transition-transform duration-300 group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="max-w-[70ch] pb-5 text-[14px] leading-relaxed text-muted">{it.a}</p>
        </details>
      ))}
    </div>
  );
}
