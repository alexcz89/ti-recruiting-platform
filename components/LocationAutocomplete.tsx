"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CityItem = { id: string; label: string; value: string };

type Props = {
  value: string;
  onChange: (v: string) => void;
  countries?: string[];                 // ej: ["mx"]
  placeholder?: string;
  className?: string;                   // se aplica al <input>
  /** Evita buscar al montar aunque haya valor inicial (default: true = NO busca) */
  fetchOnMount?: boolean;
  /** Abrir la lista al hacer foco (default: false) */
  openOnFocus?: boolean;
  /** Mínimo de caracteres para buscar (default: 3) */
  minChars?: number;
  /** Debounce en ms (default: 350) */
  debounceMs?: number;
};

export default function LocationAutocomplete({
  value,
  onChange,
  countries,
  placeholder = "Ciudad (ej. CDMX, Monterrey) o Remoto",
  className = "border rounded-xl p-3 w-full",
  fetchOnMount = false,
  openOnFocus = false,
  minChars = 3,
  debounceMs = 350,
}: Props) {
  const [input, setInput] = useState(value ?? "");
  const [options, setOptions] = useState<CityItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false); // usuario ya interactuó
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincroniza cuando el valor externo cambia
  useEffect(() => setInput(value ?? ""), [value]);

  // Cierra lista si se hace click fuera
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const canSearch = useMemo(() => {
    const q = input.trim();
    if (!q) return false;
    if (!dirty && !fetchOnMount) return false; // 👈 no buscar al montar
    return q.length >= minChars;
  }, [input, dirty, fetchOnMount, minChars]);

  // Buscar con debounce
  useEffect(() => {
    if (!canSearch) {
      if (!dirty && !fetchOnMount) setOptions([]);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("q", input.trim());
        if (countries?.length) params.set("country", countries.join(","));

        const res = await fetch(`/api/geo/cities?${params.toString()}`, {
          signal: ac.signal,
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || "Error de red");
        }
        const data = await res.json();

        // Compatibilidad con varios formatos:
        // - Array<{ id, fullName }>
        // - { results: Array<{ id?, name | fullName }> }
        const raw: any[] = Array.isArray(data) ? data : (data?.results ?? []);
        const items: CityItem[] = raw.map((r: any, i: number) => {
          const label = String(r.fullName ?? r.name ?? "");
          return { id: String(r.id ?? i), label, value: label };
        });

        setOptions(items.slice(0, 10));
        setOpen(true);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setOptions([]);
        setError("No se pudo buscar la ciudad.");
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [canSearch, input, countries, debounceMs, dirty, fetchOnMount]);

  return (
    <div className="relative" ref={containerRef}>
      <input
        className={className}
        placeholder={placeholder}
        value={input}
        onChange={(e) => {
          setDirty(true);
          setInput(e.target.value);
          // No llamamos onChange aquí para evitar “ensuciar” el valor hasta seleccionar.
        }}
        onBlur={() => {
          // Si el usuario escribió libremente (ej. "Remoto"), propaga al salir.
          if (input !== value) onChange(input);
        }}
        onFocus={() => {
          if (openOnFocus && (input || "").trim().length >= minChars) {
            setDirty(true);
            setOpen(true);
          }
        }}
        aria-autocomplete="list"
        aria-expanded={open}
        autoComplete="off"
        spellCheck={false}
      />

      {/* Helper pequeño */}
      <p className={`mt-1 text-xs ${error ? "text-red-600" : "text-zinc-500"}`}>
        {error
          ? error
          : !dirty && !fetchOnMount
          ? "Escribe para buscar."
          : input.trim().length < minChars
          ? `Escribe al menos ${minChars} caracteres.`
          : loading
          ? "Buscando…"
          : options.length === 0
          ? "Sin resultados."
          : "Selecciona una opción de la lista."}
      </p>

      {/* Lista */}
      {open && (loading || options.length > 0) && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border bg-white shadow-md max-h-64 overflow-auto">
          {loading && (
            <div className="px-3 py-2 text-sm text-zinc-500">Buscando…</div>
          )}
          {!loading &&
            options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="block w-full text-left px-3 py-2 text-sm hover:bg-zinc-50"
                onMouseDown={(e) => e.preventDefault()} // evita blur antes del click
                onClick={() => {
                  onChange(opt.value);
                  setInput(opt.value);
                  setOpen(false);
                }}
                title={opt.label}
              >
                {opt.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
