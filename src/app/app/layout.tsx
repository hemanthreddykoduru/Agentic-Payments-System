import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { logout } from "@/lib/actions";
import { NAV } from "@/lib/nav";
import { SidebarLink } from "@/components/sidebar-link";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [merchant, waiting] = await Promise.all([
    prisma.merchant.findUnique({ where: { id: session.merchantId } }),
    prisma.payment.count({
      where: { merchantId: session.merchantId, status: "awaiting_confirmation" },
    }),
  ]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-md">
        <div className="flex items-center gap-4 px-5 py-3">
          <Link href="/app" className="tight flex items-center gap-2.5 text-[15px]">
            <svg viewBox="0 0 32 32" aria-hidden className="size-7">
              <rect width="32" height="32" rx="7" fill="#171412" />
              <g stroke="#FBF9F6" strokeWidth="1.6" strokeLinecap="round">
                <path d="M9 11h14M9 16h14M9 21h9" />
              </g>
              <path d="M8 16h16" stroke="#F26522" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Agentic Payment
          </Link>

          <span className="ui hidden rounded-full border border-accent/40 bg-accent-soft px-2.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-accent-deep sm:inline">
            Test mode
          </span>

          <div className="ml-auto flex items-center gap-4">
            <Link
              href="/app/orders/new"
              className="ui rounded bg-ink px-3.5 py-2 text-[11px] text-paper transition-colors hover:bg-accent"
            >
              New order
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-[13px] leading-tight">{merchant?.name}</p>
              <code className="ui text-[10px] text-muted">{merchant?.vpa ?? "no UPI ID set"}</code>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="ui cursor-pointer text-[11px] uppercase tracking-[0.09em] text-muted transition-colors hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-line px-3 py-6 lg:block">
          <nav className="sticky top-24 space-y-6">
            {NAV.map((section, i) => (
              <div key={section.group ?? i}>
                {section.group && (
                  <p className="ui mb-2 px-3 text-[9.5px] uppercase tracking-[0.12em] text-muted">
                    {section.group}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {section.items.map((item) => (
                    <li key={item.label}>
                      <SidebarLink item={item} queueCount={waiting} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-5 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
