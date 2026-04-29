// app/dashboard/layout.tsx
"use client";

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
} from "lucide-react";
import { useSession } from "next-auth/react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  sub?: boolean;
  // "exact"  → activo solo si pathname === href
  // "prefix" → activo si pathname === href || pathname.startsWith(href + "/")
  match: "exact" | "prefix";
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard/overview",              label: "Panel",              icon: LayoutDashboard, match: "exact"  },
  { href: "/dashboard/jobs",                  label: "Vacantes",           icon: Briefcase,       match: "prefix" },
  { href: "/dashboard/assessments",           label: "Evaluaciones",       icon: ClipboardCheck,  match: "exact"  },
  { href: "/dashboard/assessments/templates", label: "Templates",          icon: BookOpen,        match: "prefix", sub: true },
  // Facturación: "exact" — no activa sus sub-rutas
  { href: "/dashboard/billing",               label: "Facturación y plan", icon: CreditCard,      match: "exact"  },
  { href: "/dashboard/billing/taxdata",       label: "Datos fiscales",     icon: FileText,        match: "exact",  sub: true },
  // Ruta real confirmada en el build: /dashboard/invoices
  { href: "/dashboard/invoices",              label: "Facturas",           icon: Receipt,         match: "prefix", sub: true },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  // ✅ BUG FIX: usa el campo "match" de cada item en lugar de siempre startsWith
  function isActive(item: NavItem): boolean {
    if (item.match === "exact") return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <main className="max-w-[1720px] 2xl:max-w-[1840px] mx-auto px-0 sm:px-4 lg:px-6 py-0 sm:py-4 lg:py-6">

      {/* ── Nav mobile: scroll horizontal en una sola línea ── */}
      <nav className="lg:hidden mb-4 overflow-x-auto scrollbar-none -mx-0 px-3 sm:px-0">
        <div className="flex items-center gap-1.5 py-3 w-max">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition shrink-0
                  ${item.sub ? "text-xs opacity-90" : ""}
                  ${active
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-700 dark:text-zinc-300 bg-white/80 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
              >
                <Icon className={`shrink-0 ${item.sub ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/dashboard/admin"
              aria-current={pathname.startsWith("/dashboard/admin") ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition shrink-0
                ${pathname.startsWith("/dashboard/admin")
                  ? "bg-red-600 text-white shadow-sm"
                  : "border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 bg-white/80 dark:bg-zinc-900/60 hover:bg-red-50 dark:hover:bg-red-900/20"
                }`}
            >
              <Shield className="shrink-0 h-4 w-4" />
              Admin
            </Link>
          )}
        </div>
      </nav>

      {/* ── Grid desktop ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6 lg:gap-8 px-3 sm:px-0">
        <aside className="hidden lg:block">
          <div className="sticky top-12 space-y-4">

            {/* Header Card */}
            <div className="rounded-2xl border glass-card p-4 md:p-6">
              <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Panel</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Administra vacantes, evaluaciones, facturación y postulaciones.
              </p>
            </div>

            {/* Navigation */}
            <nav aria-label="Secciones del panel" className="rounded-2xl border glass-card p-2">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                const isFirstBilling = item.href === "/dashboard/billing";

                return (
                  <div key={item.href}>
                    {/* Separador antes de la sección de facturación */}
                    {isFirstBilling && (
                      <div className="my-1.5 mx-2 h-px bg-zinc-200 dark:bg-zinc-700/70" />
                    )}
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition
                        ${item.sub ? "ml-4 text-[13px]" : "font-medium"}
                        ${active
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70"
                        }`}
                    >
                      <Icon className={`flex-shrink-0 ${item.sub ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
                      <span className="flex-1">{item.label}</span>
                      {active && (
                        <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-white/90" />
                      )}
                    </Link>
                  </div>
                );
              })}
              {/* Admin link — solo visible para ADMIN */}
              {isAdmin && (
                <div>
                  <div className="my-1.5 mx-2 h-px bg-zinc-200 dark:bg-zinc-700/70" />
                  <Link
                    href="/dashboard/admin"
                    aria-current={pathname.startsWith("/dashboard/admin") ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition
                      ${pathname.startsWith("/dashboard/admin")
                        ? "bg-red-600 text-white shadow-sm"
                        : "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      }`}
                  >
                    <Shield className="flex-shrink-0 h-4 w-4" />
                    <span className="flex-1">Admin</span>
                    {pathname.startsWith("/dashboard/admin") && (
                      <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-white/90" />
                    )}
                  </Link>
                </div>
              )}
            </nav>

          </div>
        </aside>

        <section className="space-y-8 min-w-0">{children}</section>
      </div>
    </main>
  );
}