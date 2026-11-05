import type { ComponentType } from "react";
import { LayoutDashboard, Briefcase, ClipboardCheck, CreditCard, FileText, Receipt, BookOpen } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  match: "exact" | "prefix";
};
export type NavGroup = NavItem & { children?: NavItem[] };

// Presentation only: destinations already available in the dashboard. Not an access guard.
export const DASHBOARD_NAV: NavGroup[] = [
  { href: "/dashboard/overview", label: "Panel", icon: LayoutDashboard, match: "exact" },
  { href: "/dashboard/jobs", label: "Vacantes", icon: Briefcase, match: "prefix" },
  { href: "/dashboard/assessments", label: "Evaluaciones", icon: ClipboardCheck, match: "exact", children: [
    { href: "/dashboard/assessments", label: "Evaluaciones", icon: ClipboardCheck, match: "exact" },
    { href: "/dashboard/assessments/templates", label: "Templates", icon: BookOpen, match: "prefix" },
  ] },
  { href: "/dashboard/billing", label: "Facturación", icon: CreditCard, match: "exact", children: [
    { href: "/dashboard/billing", label: "Plan y facturación", icon: CreditCard, match: "exact" },
    { href: "/dashboard/billing/taxdata", label: "Datos fiscales", icon: FileText, match: "exact" },
    { href: "/dashboard/invoices", label: "Facturas", icon: Receipt, match: "prefix" },
  ] },
];

export function isActive(pathname: string, item: Pick<NavItem, "href" | "match">) {
  return pathname === item.href || (item.match === "prefix" && pathname.startsWith(item.href + "/"));
}
export function isGroupActive(pathname: string, group: NavGroup) {
  return isActive(pathname, group) || (group.children?.some(child => isActive(pathname, child)) ?? false);
}

export function isRecruiterDashboard(pathname: string, role?: string) {
  return role === "RECRUITER" && isDashboardPath(pathname);
}

export function isDashboardPath(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

// A visual loading state, not authentication or authorization. Server guards remain authoritative.
export function isDashboardSessionPending(status: string, role?: string) {
  return status !== "authenticated" || !role;
}
