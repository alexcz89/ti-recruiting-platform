// app/dashboard/layout.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  ClipboardCheck,
  CreditCard,
  FileText,
  Receipt,
  BookOpen,
  Shield,
  ChevronDown,
  Plus,
} from "lucide-react";
import { useSession } from "next-auth/react";

// ── Tipos ────────────────────────────────────────────────────────────────────

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match: "exact" | "prefix";
};

type NavGroup = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match: "exact" | "prefix";
  children?: NavItem[];
};

// ── Estructura de navegación ──────────────────────────────────────────────────

const NAV: NavGroup[] = [
  {
    href: "/dashboard/overview",
    label: "Panel",
    icon: LayoutDashboard,
    match: "exact",
  },
  {
    href: "/dashboard/jobs",
    label: "Vacantes",
    icon: Briefcase,
    match: "prefix",
  },
  {
    href: "/dashboard/assessments",
    label: "Evaluaciones",
    icon: ClipboardCheck,
    match: "exact",
    children: [
      { href: "/dashboard/assessments",           label: "Evaluaciones",  icon: ClipboardCheck, match: "exact"  },
      { href: "/dashboard/assessments/templates", label: "Templates",     icon: BookOpen,       match: "prefix" },
    ],
  },
  {
    href: "/dashboard/billing",
    label: "Facturación",
    icon: CreditCard,
    match: "exact",
    children: [
      { href: "/dashboard/billing",           label: "Plan y facturación", icon: CreditCard, match: "exact"  },
      { href: "/dashboard/billing/taxdata",   label: "Datos fiscales",     icon: FileText,   match: "exact"  },
      { href: "/dashboard/invoices",          label: "Facturas",           icon: Receipt,    match: "prefix" },
    ],
  },
];

// ── Helper: is active ─────────────────────────────────────────────────────────

function isActive(pathname: string, item: { href: string; match: "exact" | "prefix" }) {
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function isGroupActive(pathname: string, group: NavGroup): boolean {
  if (isActive(pathname, group)) return true;
  return group.children?.some((c) => isActive(pathname, c)) ?? false;
}

// ── Dropdown item ─────────────────────────────────────────────────────────────

function DropdownGroup({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = isGroupActive(pathname, group);
  const Icon = group.icon;

  // Cierra al hacer clic fuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Cierra cuando cambia la ruta
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
          ${active
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
          }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {group.label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        {/* Indicador activo — underline */}
        {active && (
          <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-emerald-500" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[180px] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1.5">
          {group.children?.map((child) => {
            const childActive = isActive(pathname, child);
            const ChildIcon = child.icon;
            return (
              <Link
                key={child.href}
                href={child.href}
                className={`flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors
                  ${childActive
                    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 font-medium"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                  }`}
              >
                <ChildIcon className="h-4 w-4 shrink-0 opacity-70" />
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Nav item simple ───────────────────────────────────────────────────────────

function NavLink({ item, pathname }: { item: NavGroup; pathname: string }) {
  const active = isActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
        ${active
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
        }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
      {active && (
        <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-emerald-500" />
      )}
    </Link>
  );
}

// ── Dashboard Layout ──────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-0">

      {/* ── Sub-nav desktop ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1720px] px-4 sm:px-6 lg:px-8">

          {/* Desktop */}
          <div className="hidden lg:flex items-center justify-between h-12">
            {/* Nav items */}
            <div className="flex items-center gap-0.5">
              {NAV.map((group) =>
                group.children ? (
                  <DropdownGroup key={group.href} group={group} pathname={pathname} />
                ) : (
                  <NavLink key={group.href} item={group} pathname={pathname} />
                )
              )}
              {isAdmin && (
                <Link
                  href="/dashboard/admin"
                  aria-current={pathname.startsWith("/dashboard/admin") ? "page" : undefined}
                  className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                    ${pathname.startsWith("/dashboard/admin")
                      ? "text-red-600 dark:text-red-400"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10"
                    }`}
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  Admin
                  {pathname.startsWith("/dashboard/admin") && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-red-500" />
                  )}
                </Link>
              )}
            </div>

            {/* CTA derecha */}
            <Link
              href="/dashboard/jobs/new"
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Publicar vacante
            </Link>
          </div>

          {/* Mobile — scroll horizontal */}
          <nav className="lg:hidden flex items-center gap-1.5 h-12 overflow-x-auto scrollbar-none">
            {NAV.map((group) => {
              // En mobile mostramos todos los items aplanados
              const items = group.children ?? [group];
              return items.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors
                      ${active
                        ? "bg-emerald-600 text-white"
                        : "text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/60 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              });
            })}
            {isAdmin && (
              <Link
                href="/dashboard/admin"
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors
                  ${pathname.startsWith("/dashboard/admin")
                    ? "bg-red-600 text-white"
                    : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
                  }`}
              >
                <Shield className="h-4 w-4 shrink-0" />
                Admin
              </Link>
            )}
          </nav>
        </div>
      </div>

      {/* ── Contenido full-width ─────────────────────────────────────────────── */}
      <main className="mx-auto max-w-[1720px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
