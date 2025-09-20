"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + "/")
  return (
    <Link
      href={href}
      className={`px-3 py-2 rounded-md text-sm border transition
        ${active ? "bg-gray-100 border-gray-300" : "hover:bg-gray-50 border-transparent"}`}
    >
      {label}
    </Link>
  )
}

export default function Nav() {
  return (
    <nav className="flex gap-2">
      <NavItem href="/dashboard/overview" label="Overview" />
      <NavItem href="/dashboard/jobs" label="Vacantes" />
      <NavItem href="/dashboard/codex" label="Codex" />
    </nav>
  )
}
