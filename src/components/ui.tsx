import { formatPaise } from "@/lib/enums";

const PILL: Record<string, string> = {
  paid: "bg-[#E8F2EA] text-ok border-ok/40",
  awaiting_confirmation: "bg-accent-soft text-accent-deep border-accent/40",
  created: "bg-line/50 text-muted border-line",
  rejected: "bg-no-soft text-no border-no/40",
  expired: "bg-line/50 text-muted border-line",
  cancelled: "bg-line/50 text-muted border-line",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`ui inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.08em] ${PILL[status] ?? PILL.created}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function Money({ paise, className = "" }: { paise: number; className?: string }) {
  return <span className={`ui tabular-nums ${className}`}>{formatPaise(paise)}</span>;
}

/** Every list needs one of these. An empty screen is an instruction, not a shrug. */
export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded border border-dashed border-line px-6 py-14 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-[46ch] text-[13.5px] text-muted">{hint}</p>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="ui block text-[10.5px] uppercase tracking-[0.1em] text-muted">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1.5 block text-[12px] text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded border border-line bg-card px-3 py-2.5 text-[15px] outline-none transition-colors focus:border-accent";

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded border border-no/40 bg-no-soft px-3 py-2 text-[13px] text-no">
      {children}
    </p>
  );
}
