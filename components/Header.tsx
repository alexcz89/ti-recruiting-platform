// components/Header.tsx
"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import ThemeToggle from "@/components/ThemeToggle";
import SignOutButton from "@/components/SignOutButton";

export default function Header() {
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
          <Link href="/" className="flex items-center gap-2 font-semibold shrink-0">
            <span className="inline-flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
              TI
            </span>
            <span className="text-zinc-900 dark:text-zinc-100">Bolsa TI</span>
          </Link>

          {/* Nav + acciones */}
          <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
            <nav className="hidden md:flex items-center gap-1.5">
              <NavLink href="/jobs">Vacantes</NavLink>
            </nav>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <AuthArea />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/* -------- Subcomponentes -------- */

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

function AuthArea() {
  const { data: session, status } = useSession();
  const user = session?.user as any | undefined;
  const role = user?.role as "ADMIN" | "RECRUITER" | "CANDIDATE" | undefined;

  if (status !== "authenticated" || !session) return <AuthHoverMenu />;

  const isRecruiter = role === "RECRUITER" || role === "ADMIN";
  const isCandidate = role === "CANDIDATE";

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {isRecruiter && (
        <>
          <Link
            href="/dashboard/jobs/new"
            className="btn btn-primary h-9 px-3 md:h-9 md:px-3.5"
          >
            Publicar vacante
          </Link>

          <Link
            href="/dashboard/overview"
            className="
              btn btn-ghost h-9 px-3 md:h-9
              text-zinc-700 dark:text-zinc-300
            "
          >
            Panel
          </Link>

          <Link
            href="/dashboard/profile"
            className="
              btn btn-ghost h-9 px-3 md:h-9
              text-zinc-700 dark:text-zinc-300
            "
          >
            Mi perfil
          </Link>
        </>
      )}

      {isCandidate && (
        <Link
          href="/profile/summary"
          className="
            btn btn-ghost h-9 px-3 md:h-9
            text-zinc-700 dark:text-zinc-300
          "
        >
          Perfil
        </Link>
      )}

      <span className="hidden lg:inline text-[12px] text-zinc-500 dark:text-zinc-400">
        {user?.email}
      </span>

      <SignOutButton />
    </div>
  );
}

/** Menú de login/signup con hover (fix: “puente” anti-gap + focus-within) */
function AuthHoverMenu() {
  return (
    <div
      className="
        group relative
        before:absolute before:inset-x-0 before:top-full before:h-2 before:content-['']
      "
    >
      <button
        className="
          btn btn-ghost h-9 px-3
          border border-zinc-200/70 dark:border-zinc-800/70
        "
        aria-haspopup="menu"
        aria-expanded="false"
      >
        Acceder
      </button>

      {/* Panel */}
      <div
        role="menu"
        className="
          invisible absolute right-0 top-full mt-1 z-50 w-64
          translate-y-1 opacity-0 transition
          group-hover:visible group-hover:translate-y-0 group-hover:opacity-100
          group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100
        "
      >
        <div
          className="
            soft-panel shadow-md
            border border-zinc-200 dark:border-zinc-800
            bg-white dark:bg-zinc-900
          "
        >
          <div className="p-2">
            <HeaderTiny>Candidatos</HeaderTiny>
            <MenuItem href="/auth/signin?role=CANDIDATE" label="Iniciar sesión" />
            {/* 👉 lleva directo al signup de candidato */}
            <MenuItem href="/auth/signup/candidate" label="Crear cuenta" />
          </div>

          <div className="border-t border-zinc-200/70 dark:border-zinc-800/70 p-2">
            <HeaderTiny>Employers</HeaderTiny>
            <MenuItem href="/auth/signin?role=RECRUITER" label="Iniciar sesión (Employers)" />
            {/* 👉 lleva directo al signup de reclutador */}
            <MenuItem
              href="/auth/signup/recruiter"
              label="Crear cuenta (Employers)"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderTiny({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
      {children}
    </p>
  );
}

function MenuItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="
        block rounded-lg px-3 py-2 text-sm
        text-zinc-800 dark:text-zinc-100
        hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70
      "
    >
      {label}
    </Link>
  );
}
