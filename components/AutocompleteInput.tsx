// components/AutocompleteInput.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createStringFuse, searchStrings } from "@/lib/search/fuse";

type Props = {
  /** Valor controlado del input */
  query: string;
  /** Setter para el valor del input */
  setQuery: (v: string) => void;

  /** Lista total de opciones (strings) */
  options: string[];

  /** Límite de resultados mostrados */
  maxResults?: number;

  /** Placeholder del input */
  placeholder?: string;

  /** Callback cuando el usuario elige una opción o confirma el texto actual */
  onPick: (value: string) => void;

  /** ID para aria-controls (opcional, útil si renderizas varios en pantalla) */
  listId?: string;

  /** Clase extra para el input */
  inputClassName?: string;

  /** Clase extra para el contenedor del dropdown */
  dropdownClassName?: string;
};

export default function AutocompleteInput({
  query,
  setQuery,
  options,
  onPick,
  maxResults = 30,
  placeholder,
  listId = "ac-list",
  inputClassName,
  dropdownClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const fuse = useMemo(() => createStringFuse(options), [options]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return options.slice(0, Math.min(20, maxResults));
    return searchStrings(fuse, q, maxResults);
  }, [query, options, maxResults, fuse]);

  useEffect(() => {
    setActive(0);
  }, [query, results.length]);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (!listRef.current && !inputRef.current) return;
      const t = e.target as Node;
      if (listRef.current?.contains(t) || inputRef.current?.contains(t)) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, []);

  function confirmPick(value?: string) {
    const val = (value ?? results[active] ?? query).trim();
    if (!val) return;
    onPick(val);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.max(i - 1, 0));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      confirmPick();
      return;
    }

    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
  }

  const activeDescendant =
    open && results[active] ? `${listId}-option-${active}` : undefined;

  return (
    <div
      className="relative"
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={listId}
    >
      <input
        ref={inputRef}
        className={[
          "w-full rounded-xl border p-3 text-base sm:text-sm",
          "min-h-[44px]",
          inputClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={activeDescendant}
      />

      {open && query && (
        <div
          ref={listRef}
          id={listId}
          className={[
            "absolute z-10 mt-1 w-full overflow-auto rounded-xl border glass-card",
            "max-h-72 p-2 shadow-lg",
            dropdownClassName,
          ]
            .filter(Boolean)
            .join(" ")}
          role="listbox"
        >
          {results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-zinc-500">Sin resultados</div>
          ) : (
            results.map((s, idx) => (
              <button
                id={`${listId}-option-${idx}`}
                type="button"
                key={`${s}-${idx}`}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors active:bg-gray-100 hover:bg-gray-50 ${
                  idx === active ? "bg-gray-50" : ""
                }`}
                onMouseEnter={() => setActive(idx)}
                onClick={() => confirmPick(s)}
                role="option"
                aria-selected={idx === active}
              >
                {s}
              </button>
            ))
          )}
        </div>
      )}

      <p className="mt-1 text-xs text-zinc-500">
        Escribe para buscar. Usa ↑/↓ para navegar y Enter para agregar.
      </p>
    </div>
  );
}