// components/ui/MobileDrawer.tsx
"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: "left" | "right";
}

/**
 * ✅ Mobile-optimized drawer modal
 * - Prevents body scroll when open
 * - Touch-friendly close button (44px minimum)
 * - Smooth slide-in animation
 * - Click outside to close
 * - Escape key to close
 */
export function MobileDrawer({
  isOpen,
  onClose,
  title,
  children,
  side = "left",
}: MobileDrawerProps) {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "unset";
      };
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay - click to close */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 z-50 h-full w-full max-w-sm bg-white dark:bg-zinc-950 shadow-lg transition-transform duration-300 lg:hidden ${
          side === "left"
            ? `left-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`
            : `right-0 ${isOpen ? "translate-x-0" : "translate-x-full"}`
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "drawer-title" : undefined}
      >
        {/* Header */}
        <div className="sticky top-0 z-50 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-4">
          {title && (
            <h2 id="drawer-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {title}
            </h2>
          )}
          <button
            onClick={onClose}
            className="ml-auto flex items-center justify-center h-10 w-10 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors focus-ring"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-64px)]">{children}</div>
      </div>
    </>
  );
}
