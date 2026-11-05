"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: "left" | "right";
  id?: string;
  desktopBreakpoint?: "lg" | "xl";
}

export function MobileDrawer({ isOpen, onClose, title, children, side = "left", id, desktopBreakpoint = "lg" }: MobileDrawerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  const titleId = useId();
  useEffect(() => { close.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (element && typeof element.showModal === "function") element.showModal();
    else if (element) element.open = true;
    closeButton.current?.focus();
    const desktop = window.matchMedia(`(min-width: ${desktopBreakpoint === "xl" ? 1280 : 1024}px)`);
    const closeOnDesktop = () => { if (desktop.matches) close.current(); };
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      if (element?.open && typeof element.close === "function") element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen, desktopBreakpoint]);

  if (!isOpen) return null;
  return <dialog ref={dialog} id={id} aria-modal="true" aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : "Navegación"}
    onCancel={event => { event.preventDefault(); close.current(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close.current();
    }}
    onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); return; }
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'));
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    className={`fixed inset-y-0 m-0 flex h-dvh max-h-none w-full max-w-sm flex-col border-0 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-black/50 dark:bg-zinc-950 dark:text-zinc-100 ${side === "left" ? "left-0 mr-auto" : "right-0 ml-auto"}`}>
    <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      {title && <h2 id={titleId} className="text-base font-semibold">{title}</h2>}
      <button ref={closeButton} type="button" onClick={onClose} aria-label="Cerrar menú" className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:outline-emerald-300"><X aria-hidden="true" className="h-5 w-5" /></button>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
  </dialog>;
}
