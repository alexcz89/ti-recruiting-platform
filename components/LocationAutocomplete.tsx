"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Item = { id: string; fullName: string };

export default function LocationAutocomplete({
  value,
  onChange,
  countries,
  placeholder = "Ciudad (ej. CDMX, Monterrey)",
  minLength = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  countries?: string[]; // ISO2 en minúsculas (ej. ["mx"])
  placeholder?: string;
  minLength?: number;
}) {
  const [q, setQ] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const acRef = useRef<AbortController | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Cierra lista si se hace click fuera
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Mantén controlado el valor externo
  useEffect(() => {
    setQ(value || "");
  }, [value]);

  // Debounce de 250 ms
  const debouncedQ = useDebounce(q, 250);

  useEffect(() => {
    if (debouncedQ.trim().length < minLength) {
      setItems([]);
      setError(null); // no es error; solo muy corto
      return;
    }

    acRef.current?.abort();
    const ac = new AbortController();
    acRef.current = ac;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("q", debouncedQ.trim());
        countries?.forEach((c) => params.append("country", c));

        const res = await fetch(`/api/geo/cities?${params.toString()}`, {
          signal: ac.signal,
          headers: { Accept: "application/json" },
        });

        // Si el servidor responde con texto (p. ej. error html), evita .json()
        const ct = res.headers.get("content-type") || "";
        if (!res.ok || !ct.includes("application/json")) {
          // intenta leer mensaje de error breve
          let msg = "No se pudo buscar la ciudad.";
          try {
            const txt = await res.text();
            if (txt) msg = msg + (": " + txt.slice(0, 120));
          } catch {}
          setItems([]);
          setError(msg);
          return;
        }

        const data = (await res.json()) as any[];
        setItems((data || []).map((d) => ({ id: String(d.id), fullName: String(d.fullName) })));
        setError(null); // ✅ respuesta OK, aunque sea []
      } catch (err: any) {
        if (err?.name === "AbortError") return; // typing fast: cancelado
        setItems([]);
        setError("No se pudo buscar la ciudad.");
      } finally {
        setLoading(false);
        setOpen(true);
      }
    })();

    return () => ac.abort();
  }, [debouncedQ, countries, minLength]);

  return (
    <div className="relative" ref={boxRef}>
      <input
        className="mt-2 w-full rounded-md border p-2"
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          onChange(e.target.value); // burbujea al form
        }}
        onFocus={() => setOpen(true)}
        aria-autocomplete="list"
        aria-expanded={open}
      />

      {/* Mensaje informativo o error */}
      <p className={`mt-1 text-xs ${error ? "text-red-600" : "text-zinc-500"}`}>
        {error
          ? error
          : q.trim().length < minLength
          ? `Escribe al menos ${minLength} caracteres para buscar.`
          : loading
          ? "Buscando…"
          : items.length === 0
          ? "Sin resultados."
          : "Selecciona una opción de la lista."}
      </p>

      {/* Lista de sugerencias */}
      {open && (loading || items.length > 0) && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-white shadow">
          {loading ? (
            <div className="px-3 py-2 text-sm text-zinc-500">Buscando…</div>
          ) : (
            items.map((it) => (
              <button
                key={it.id}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                onClick={() => {
                  onChange(it.fullName);
                  setQ(it.fullName);
                  setOpen(false);
                }}
              >
                {it.fullName}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function useDebounce<T>(val: T, delay = 250) {
  const [v, setV] = useState<T>(val);
  useEffect(() => {
    const t = setTimeout(() => setV(val), delay);
    return () => clearTimeout(t);
  }, [val, delay]);
  return v;
}
