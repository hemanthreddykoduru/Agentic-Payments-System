"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";

/** Built items link. Unbuilt items are labels, not buttons — nothing here is clickable
 *  and inert. */
export function SidebarLink({ item, queueCount }: { item: NavItem; queueCount: number }) {
  const pathname = usePathname();

  if (!item.href) {
    return (
      <span className="flex items-center gap-2 rounded px-3 py-1.5 text-[13.5px] text-muted/60">
        {item.label}
        <span className="ui ml-auto text-[9px] uppercase tracking-[0.08em] text-muted/50">soon</span>
      </span>
    );
  }

  const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2 rounded px-3 py-1.5 text-[13.5px] transition-colors ${
        active ? "bg-accent-soft font-medium text-accent-deep" : "hover:bg-line/40"
      }`}
    >
      {item.label}
      {item.href === "/app" && queueCount > 0 && (
        <span className="ui ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-white">
          {queueCount}
        </span>
      )}
    </Link>
  );
}
