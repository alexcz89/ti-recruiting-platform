// components/Header.tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0B2E36]/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 font-semibold text-white">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400 text-[#0B2E36]">
            TI
          </span>
          <span className="hidden sm:inline">Bolsa TI</span>
        </Link>

        {/* Nav izquierda (puedes agregar más links si quieres) */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-white/80">
          <Link href="/jobs" className="hover:text-white">Vacantes</Link>
          <Link href="/codex" className="hover:text-white">Codex</Link>
        </nav>

        {/* Auth menu (derecha) */}
        <AuthHoverMenu />
      </div>
    </header>
  );
}

function AuthHoverMenu() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef<HTMLAnchorElement[]>([]);

  // Cerrar al click fuera
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Teclado básico: ESC cierra, flechas navegan
  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    const idx = itemsRef.current.findIndex((el) => el === document.activeElement);
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = itemsRef.current[(idx + 1 + itemsRef.current.length) % itemsRef.current.length];
      next?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = itemsRef.current[(idx - 1 + itemsRef.current.length) % itemsRef.current.length];
      prev?.focus();
    }
  }

  // helpers para refs
  function setItemRef(el: HTMLAnchorElement | null, i: number) {
    if (!el) return;
    itemsRef.current[i] = el;
  }

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Trigger */}
      <button
        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400 md:px-4"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)} // para mobile
      >
        Login / Sign up
      </button>

      {/* Dropdown */}
      <div
        className={clsx(
          "absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-white/10 bg-white/95 shadow-xl outline-none",
          open ? "opacity-100 translate-y-0 visible" : "pointer-events-none invisible -translate-y-1 opacity-0",
          "transition"
        )}
        role="menu"
        aria-label="Autenticación"
      >
        <div className="p-2">
          <span className="block px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-[#0B2E36]/60">
            Candidatos
          </span>
          <MenuItem
            href="/signin?role=CANDIDATE"
            label="Iniciar sesión"
            refCb={(el) => setItemRef(el, 0)}
            onActivate={() => setOpen(false)}
          />
          <MenuItem
            href="/signin?role=CANDIDATE&signup=1"
            label="Crear cuenta"
            refCb={(el) => setItemRef(el, 1)}
            onActivate={() => setOpen(false)}
          />
        </div>

        <div className="border-t border-[#0B2E36]/10 p-2">
          <span className="block px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-[#0B2E36]/60">
            Employers
          </span>
          <MenuItem
            href="/signin?role=RECRUITER"
            label="Employers: Iniciar sesión"
            refCb={(el) => setItemRef(el, 2)}
            onActivate={() => setOpen(false)}
          />
          <MenuItem
            href="/signin?role=RECRUITER&signup=1"
            label="Employers: Crear cuenta"
            refCb={(el) => setItemRef(el, 3)}
            onActivate={() => setOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  href,
  label,
  refCb,
  onActivate,
}: {
  href: string;
  label: string;
  refCb: (el: HTMLAnchorElement | null) => void;
  onActivate: () => void;
}) {
  return (
    <Link
      href={href}
      ref={refCb}
      onClick={onActivate}
      className="block rounded-xl px-3 py-2 text-sm text-[#0B2E36] hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
      role="menuitem"
    >
      {label}
    </Link>
  );
}
