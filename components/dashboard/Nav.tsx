// components/dashboard/Nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`px-3 py-2 rounded-md text-sm border transition
        ${
          active
            ? "bg-emerald-600 text-white border-emerald-600"
            : "border-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70"
        }`}
    >
      {label}
    </Link>
  );
}

export default function Nav() {
  return (
    <nav className="flex gap-2">
      <NavItem href="/dashboard/overview" label="Overview" />
      <NavItem href="/dashboard/jobs" label="Vacantes" />
    </nav>
  );
}
