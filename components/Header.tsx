// components/Header.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import ThemeToggle from "@/components/ThemeToggle";
import SignOutButton from "@/components/SignOutButton";
import LogoTaskit from "@/components/LogoTaskit";
import { ClipboardList, Menu, X } from "lucide-react";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    const handleRouteChange = () => setMobileMenuOpen(false);
    // Si usas Next.js 13+ con App Router, esto podría no ser necesario
    return () => {};
  }, []);

  return (
    <header
      className="
        sticky top-0 z-50 border-b
        border-zinc-200/60 dark:border-zinc-800/60
        bg-white/80 dark:bg-zinc-950/60 backdrop-blur
      "
    >
      <div className="mx-auto max-w-7xl 2xl:max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-12 md:h-14 items-center justify-between gap-3">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center gap-2 shrink-0"
            onClick={() => setMobileMenuOpen(false)}
          >
            <LogoTaskit className="h-7 md:h-8 w-auto" />
            <span className="sr-only">TaskIT / Bolsa TI</span>
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
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <MobileMenu onClose={() => setMobileMenuOpen(false)} />
        )}
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

/* -------- Mobile Menu -------- */
function MobileMenu({ onClose }: { onClose: () => void }) {
  const { data: session, status } = useSession();
  const user = session?.user as any | undefined;
  const role = (user?.role as "ADMIN" | "RECRUITER" | "CANDIDATE" | undefined) ?? undefined;

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
                <MobileNavLink href="/dashboard/jobs/new" onClick={onClose}>
                  Publicar vacante
                </MobileNavLink>
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
              <div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                {user?.email}
              </div>
              <div className="px-3">
                <SignOutButton />
              </div>
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
  
  // Memoizar para evitar re-renders innecesarios
  const authData = useMemo(() => {
    if (status !== "authenticated" || !session) {
      return { isAuthenticated: false };
    }

    const user = session.user as any | undefined;
    const role = (user?.role as "ADMIN" | "RECRUITER" | "CANDIDATE" | undefined) ?? undefined;

    return {
      isAuthenticated: true,
      user,
      role,
      isRecruiter: role === "RECRUITER" || role === "ADMIN",
      isCandidate: role === "CANDIDATE",
    };
  }, [session, status]);

  if (!authData.isAuthenticated) {
    return <AuthButtons />;
  }

  const { user, isRecruiter, isCandidate } = authData;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {isRecruiter && <RecruiterNav />}
      {isCandidate && <CandidateNav />}

      <span className="hidden lg:inline text-[12px] text-zinc-500 dark:text-zinc-400">
        {user?.email}
      </span>

      <SignOutButton />
    </div>
  );
}

/* -------- Recruiter Navigation -------- */
function RecruiterNav() {
  return (
    <>
      <Link href="/dashboard/jobs/new" className="btn btn-primary h-9 px-3 md:px-3.5">
        Publicar vacante
      </Link>

      <Link
        href="/dashboard/overview"
        className="btn btn-ghost h-9 px-3 text-zinc-700 dark:text-zinc-300"
      >
        Panel
      </Link>

      <Link
        href="/dashboard/profile"
        className="btn btn-ghost h-9 px-3 text-zinc-700 dark:text-zinc-300"
      >
        Mi perfil
      </Link>
    </>
  );
}

/* -------- Candidate Navigation -------- */
function CandidateNav() {
  return (
    <>
      <CandidateAssessmentsNav />

      <Link
        href="/profile/summary"
        className="btn btn-ghost h-9 px-3 text-zinc-700 dark:text-zinc-300"
      >
        Perfil
      </Link>
    </>
  );
}

/* -------- Assessment Badge (optimizado) -------- */
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
      // Silenciar errores de abort
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

/* -------- Auth Buttons (simplificado) -------- */
function AuthButtons() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-auth-menu]')) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
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
              <MenuItem
                href="/auth/signin"
                label="Iniciar sesión"
                onClick={() => setIsOpen(false)}
              />
              <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-2" />
              <MenuItem
                href="/auth/signup"
                label="Crear cuenta"
                onClick={() => setIsOpen(false)}
              />
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