import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const ROLE_NOTE: Record<string, string> = {
  owner: "Everything, including settings and the UPI ID.",
  staff: "Creates orders and confirms payments. Cannot change the UPI ID.",
  view_only: "Reads everything, changes nothing.",
};

export default async function TeamPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const users = await prisma.user.findMany({
    where: { merchantId: session.merchantId },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="max-w-[640px]">
      <p className="eyebrow">Team</p>
      <h1 className="mt-2 text-[28px]">
        {users.length} {users.length === 1 ? "person" : "people"}
      </h1>

      <ul className="mt-8 border-t border-line">
        {users.map((u) => (
          <li key={u.id} className="border-b border-line py-4">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-[15px]">{u.name}</span>
              {u.id === session.userId && (
                <span className="ui text-[10px] uppercase tracking-[0.08em] text-accent-deep">you</span>
              )}
              <span className="ui ml-auto rounded-full border border-line px-2.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-muted">
                {u.role.replace(/_/g, " ")}
              </span>
            </div>
            <p className="ui mt-1 text-[11px] text-muted">{u.email}</p>
            <p className="mt-1 text-[12.5px] text-muted">{ROLE_NOTE[u.role] ?? ""}</p>
          </li>
        ))}
      </ul>

      <p className="ui mt-6 text-[11px] leading-relaxed text-muted">
        Inviting people needs email delivery, which is not wired up yet. Add a row to the User table
        with a bcrypt hash until then.
      </p>
    </div>
  );
}
