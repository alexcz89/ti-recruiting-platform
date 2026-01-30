// app/dashboard/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { 
  LayoutDashboard, 
  Briefcase, 
  ClipboardCheck, 
  CreditCard, 
  FileText, 
  Receipt 
} from "lucide-react";

type NavItem = { 
  href: string; 
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard/overview", label: "Panel", icon: LayoutDashboard },
  { href: "/dashboard/jobs", label: "Vacantes", icon: Briefcase },
  { href: "/dashboard/assessments", label: "Evaluaciones", icon: ClipboardCheck },
  { href: "/dashboard/billing", label: "Facturación y plan", icon: CreditCard },
  { href: "/dashboard/billing/taxdata", label: "Datos fiscales", icon: FileText },
  { href: "/dashboard/invoices", label: "Facturas", icon: Receipt },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <main className="max-w-[1720px] 2xl:max-w-[1840px] mx-auto px-4 lg:px-6 py-4 lg:py-6">
      {/* Toaster global - Fixed duplicate toasts */}
      <Toaster 
        richColors 
        position="top-center" 
        closeButton 
        visibleToasts={3}
        expand={false}
        duration={3000}
      />

      {/* Tabs móviles */}
      <nav className="lg:hidden mb-6 flex flex-wrap gap-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm border transition
                ${
                  active
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "border-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70"
                }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6 lg:gap-8">
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
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition
                      ${
                        active
                          ? "bg-emerald-600 text-white"
                          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70"
                      }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {active && (
                      <span
                        aria-hidden
                        className="inline-block h-2 w-2 rounded-full bg-white/90"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* ✅ BOTONES ELIMINADOS - Ya no se duplican con el botón de la página */}
          </div>
        </aside>

        <section className="space-y-8 min-w-0">{children}</section>
      </div>
    </main>
  );
}