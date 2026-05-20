// components/Header.tsx
"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import ThemeToggle from "@/components/ThemeToggle";
import LogoTaskio from "@/components/LogoTaskio";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import {
  ClipboardList,
  Menu,
  X,
  User,
  LogOut,
} from "lucide-react";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header
      className="
        sticky top-0 z-50 border-b
        border-zinc-200/60 dark:border-zinc-800/60
        bg-white/80 dark:bg-zinc-950/60 backdrop-blur
      "
    >
      <div className="mx-auto max-w-7xl 2xl:max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 md:h-16 items-center justify-between gap-3">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0"
            onClick={() => setMobileMenuOpen(false)}
          >
            <LogoTaskio />
            <span className="sr-only">TaskIO</span>
          </Link>

          {/* Desktop Nav + Actions */}
          <div className="hidden md:flex flex-1 items-center justify-end gap-2 sm:gap-3">
            <DesktopNav />
            <div className="flex items-center gap-1.5 sm:gap-2">
              <AuthArea />
              <ThemeToggle />
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="
                btn btn-ghost h-9 w-9 p-0
                text-zinc-700 dark:text-zinc-300
              "
              aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && <MobileMenu onClose={() => setMobileMenuOpen(false)} />}
      </div>
    </header>
  );
}

/* -------- Desktop Navigation -------- */
function DesktopNav() {
  return (
    <nav className="flex items-center gap-1.5">
      <NavLink href="/jobs">Vacantes</NavLink>
    </nav>
  );
}

/* -------- Avatar Dropdown -------- */
function AvatarMenu({ user, role }: { user: any; role?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="
          flex h-8 w-8 shrink-0 items-center justify-center
          rounded-full bg-emerald-600 text-white text-[13px] font-bold
          hover:bg-emerald-500 transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
        "
        aria-label="Menú de usuario"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          className="
            absolute right-0 top-full mt-2 z-50 w-56
            rounded-xl border border-zinc-200 dark:border-zinc-700
            bg-white dark:bg-zinc-900 shadow-lg
            animate-in fade-in slide-in-from-top-2 duration-150
          "
        >
          {/* User info */}
          <div className="px-3.5 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
            {user?.name && (
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {user.name}
              </p>
            )}
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {user?.email}
            </p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href={role === "CANDIDATE" ? "/profile/summary" : "/dashboard/profile"}
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
            >
              <User className="h-4 w-4 opacity-60 shrink-0" />
              Mi perfil
            </Link>
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800 py-1">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              role="menuitem"
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
            >
              <LogOut className="h-4 w-4 opacity-60 shrink-0" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------- Mobile Menu -------- */
function MobileMenu({ onClose }: { onClose: () => void }) {
  const { data: session, status } = useSession();
  const user = session?.user as any | undefined;
  const role =
    (user?.role as "ADMIN" | "RECRUITER" | "CANDIDATE" | undefined) ?? undefined;

  const isRecruiter = role === "RECRUITER" || role === "ADMIN";
  const isCandidate = role === "CANDIDATE";
  const isAuthenticated = status === "authenticated" && session;

  return (
    <div className="md:hidden border-t border-zinc-200/60 dark:border-zinc-800/60 py-4">
      <nav className="flex flex-col gap-2">
        <MobileNavLink href="/jobs" onClick={onClose}>
          Vacantes
        </MobileNavLink>

        {isAuthenticated ? (
          <>
            {isRecruiter && (
              <>
                <MobileNavLink href="/dashboard/overview" onClick={onClose}>
                  Panel
                </MobileNavLink>
                <MobileNavLink href="/dashboard/profile" onClick={onClose}>
                  Mi perfil
                </MobileNavLink>
              </>
            )}

            {isCandidate && (
              <>
                <MobileNavLink href="/assessments" onClick={onClose}>
                  Evaluaciones
                </MobileNavLink>
                <MobileNavLink href="/profile/summary" onClick={onClose}>
                  Perfil
                </MobileNavLink>
              </>
            )}

            <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
              {user?.name && (
                <p className="px-3 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  {user.name}
                </p>
              )}
              <p className="px-3 py-1 text-xs text-zinc-500 dark:text-zinc-400">
                {user?.email}
              </p>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full flex items-center gap-2 px-3 py-2.5 mt-1 text-sm rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Cerrar sesión
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
            <MobileNavLink href="/auth/signin" onClick={onClose}>
              Iniciar sesión
            </MobileNavLink>
            <MobileNavLink href="/auth/signup" onClick={onClose}>
              Crear cuenta
            </MobileNavLink>
          </div>
        )}
      </nav>
    </div>
  );
}

function MobileNavLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="
        px-3 py-2.5 text-sm rounded-md
        text-zinc-700 dark:text-zinc-300
        hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70
        transition
      "
    >
      {children}
    </Link>
  );
}

/* -------- Nav Links -------- */
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="
        px-2.5 py-1.5 text-sm rounded-md
        text-zinc-700 dark:text-zinc-300
        hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70
        transition
      "
    >
      {children}
    </Link>
  );
}

/* -------- Auth Area -------- */
function AuthArea() {
  const { data: session, status } = useSession();

  const authData = useMemo(() => {
    if (status !== "authenticated" || !session) {
      return { isAuthenticated: false as const };
    }

    const user = session.user as any | undefined;
    const role =
      (user?.role as "ADMIN" | "RECRUITER" | "CANDIDATE" | undefined) ?? undefined;

    return {
      isAuthenticated: true as const,
      user,
      role,
      isRecruiter: role === "RECRUITER" || role === "ADMIN",
      isCandidate: role === "CANDIDATE",
    };
  }, [session, status]);

  if (!authData.isAuthenticated) {
    return <AuthButtons />;
  }

  const { user, isCandidate } = authData;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Assessments link — solo para candidatos */}
      {isCandidate && <CandidateAssessmentsNav />}

      {/* 🔔 Notificaciones */}
      <NotificationBell />

      {/* Avatar dropdown */}
      <AvatarMenu user={user} role={authData.role} />
    </div>
  );
}

/* -------- Assessment Badge (candidatos) -------- */
function CandidateAssessmentsNav() {
  const { data: session, status } = useSession();
  const [badgeCount, setBadgeCount] = useState<number>(0);

  const shouldFetch = useMemo(() => {
    if (status !== "authenticated") return false;
    const user = session?.user as any | undefined;
    const role = String(user?.role ?? "").toUpperCase();
    return role === "CANDIDATE";
  }, [status, session]);

  const fetchBadge = useCallback(async (signal: AbortSignal) => {
    try {
      const res = await fetch("/api/candidate/assessment-invites?mode=count", {
        cache: "no-store",
        signal,
      });

      if (res.ok) {
        const data = await res.json();
        const count = Number(data?.badge ?? 0);
        setBadgeCount(Number.isFinite(count) ? count : 0);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.warn("Error fetching assessment badge:", err);
      }
    }
  }, []);

  useEffect(() => {
    if (!shouldFetch) return;

    const controller = new AbortController();

    fetchBadge(controller.signal);
    const interval = setInterval(() => fetchBadge(controller.signal), 60_000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [shouldFetch, fetchBadge]);

  const badgeText = badgeCount > 99 ? "99+" : String(badgeCount);

  return (
    <Link
      href="/assessments"
      className="
        btn btn-ghost h-9 px-3
        text-zinc-700 dark:text-zinc-300
        inline-flex items-center gap-2
      "
      title="Evaluaciones"
    >
      <ClipboardList className="h-4 w-4" />
      <span className="hidden sm:inline">Evaluaciones</span>

      {badgeCount > 0 && (
        <span
          className="
            inline-flex items-center justify-center
            min-w-[18px] h-[18px] px-1
            rounded-full text-[11px] font-semibold
            bg-emerald-600 text-white
          "
          aria-label={`${badgeCount} evaluaciones pendientes`}
        >
          {badgeText}
        </span>
      )}
    </Link>
  );
}

/* -------- Auth Buttons (unauthenticated) -------- */
function AuthButtons() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-auth-menu]")) setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative" data-auth-menu>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          btn btn-ghost h-9 px-3
          border border-zinc-200/70 dark:border-zinc-800/70
        "
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        Acceder
      </button>

      {isOpen && (
        <div
          role="menu"
          className="
            absolute right-0 top-full mt-2 z-50 w-52
            animate-in fade-in slide-in-from-top-2 duration-200
          "
        >
          <div
            className="
              soft-panel shadow-lg
              border border-zinc-200 dark:border-zinc-800
              bg-white dark:bg-zinc-900
              rounded-lg overflow-hidden
            "
          >
            <div className="p-2 space-y-1">
              <MenuItem href="/auth/signin" label="Iniciar sesión" onClick={() => setIsOpen(false)} />
              <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-2" />
              <MenuItem href="/auth/signup" label="Crear cuenta" onClick={() => setIsOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------- Menu Item -------- */
function MenuItem({
  href,
  label,
  onClick,
}: {
  href: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      role="menuitem"
      className="
        block rounded-lg px-3 py-2 text-sm
        text-zinc-800 dark:text-zinc-100
        hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70
        transition-colors
      "
    >
      {label}
    </Link>
  );
}
