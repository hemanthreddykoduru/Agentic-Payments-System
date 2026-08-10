import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { logout } from "@/lib/actions";

const NAV = [
  ["To confirm", "/app"],
  ["Orders", "/app/orders"],
] as const;

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
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="sheet flex items-center gap-5 py-3.5">
          <Link href="/app" className="tight text-[15px]">
            {merchant?.name ?? "Agentic Payment"}
          </Link>
          {merchant?.vpa && (
            <code className="ui hidden text-[11px] text-muted sm:block">{merchant.vpa}</code>
          )}

          <nav className="ml-auto flex items-center gap-5">
            {NAV.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="ui relative text-[11px] uppercase tracking-[0.09em] text-muted transition-colors hover:text-ink"
              >
                {label}
                {href === "/app" && waiting > 0 && (
                  <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-white">
                    {waiting}
                  </span>
                )}
              </Link>
            ))}
            <Link
              href="/app/orders/new"
              className="ui rounded bg-ink px-3 py-1.5 text-[11px] text-paper transition-colors hover:bg-accent"
            >
              New order
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="ui cursor-pointer text-[11px] uppercase tracking-[0.09em] text-muted transition-colors hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="sheet flex-1 py-10">{children}</main>
    </>
  );
}
