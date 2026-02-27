// components/LocationAutocomplete.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, Loader2, SearchX } from "lucide-react";

export type PlaceResult = {
  label: string;
  city?: string;
  admin1?: string;
  country?: string;
  cityNorm?: string;
  admin1Norm?: string;
  lat?: number;
  lng?: number;
};

type City = {
  id: string;
  label: string;
  city?: string;
  admin1?: string;
  country?: string;
  lat?: number;
  lng?: number;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  onPlace?: (p: PlaceResult) => void;
  countries?: string[];
  className?: string;
  placeholder?: string;
  fetchOnMount?: boolean;
  minChars?: number;
  debounceMs?: number;
  debug?: boolean;
  usePortal?: boolean;
};

export default function LocationAutocomplete({
  value,
  onChange,
  onPlace,
  countries = ["mx"],
  className,
  placeholder,
  fetchOnMount = false,
  minChars = 3,
  debounceMs = 250,
  debug = false,
  usePortal = true,
}: Props) {
  const [query, setQuery] = useState<string>(value || "");
  const [loading, setLoading] = useState<boolean>(false);
  const [items, setItems] = useState<City[]>([]);
  const [hoverIdx, setHoverIdx] = useState<number>(-1);
  const [focused, setFocused] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const committed = useRef<string>(value || "");
  const timerRef = useRef<number | null>(null);
  const reqSeq = useRef(0);
  const lastHandled = useRef(0);

  const [anchor, setAnchor] = useState<{ x: number; y: number; w: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  const composingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, City[]>>(new Map());

  useEffect(() => {
    setQuery(value || "");
    committed.current = value || "";
  }, [value]);

  function normalize(s: string) {
    return (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  }

  function slugify(x?: string | null) {
    if (!x) return "";
    return x
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function updateAnchor() {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchor({
      x: r.left + window.scrollX,
      y: r.bottom + window.scrollY + 4,
      w: r.width,
    });
  }

  useEffect(() => {
    setMounted(true);
    updateAnchor();
    const onScroll = () => updateAnchor();
    const onResize = () => updateAnchor();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    updateAnchor();
  }, [focused, query, items.length]);

  // ── Parser ──
  function parseCitiesPayload(data: any): City[] {
    const rootArr = pickArray(data);
    if (!rootArr) return [];
    return rootArr
      .map((r: any, i: number) => mapOne(r, i))
      .filter((x: City | null): x is City => !!x && String(x.label).trim().length > 0);
  }

  function pickArray(x: any): any[] | null {
    if (Array.isArray(x)) return x;
    const cand = x?.items ?? x?.results ?? x?.cities ?? x?.data ?? x?.features ?? x?.places ?? x?.payload;
    if (Array.isArray(cand)) return cand;
    if (x && typeof x === "object") {
      for (const k of Object.keys(x)) {
        const v = (x as any)[k];
        if (Array.isArray(v)) return v;
      }
    }
    return null;
  }

  function firstNonEmptyString(obj: any): string | undefined {
    if (!obj || typeof obj !== "object") return undefined;
    const candidates = [
      obj.label, obj.name, obj.text, obj.title, obj.full_name, obj.display_name,
      obj.place_name, obj.city, obj.municipio, obj.locality, obj.town, obj.village,
      obj.state, obj.state_name, obj.admin1, obj.admin_name, obj.region,
      obj.country, obj.country_name, obj.countryCode, obj.description, obj.formatted,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
    }
    const SKIP_KEYS = new Set(["id", "_id", "woeid", "osm_id", "wikidata", "place_type", "short_code", "type", "feature_type"]);
    for (const k of Object.keys(obj)) {
      if (SKIP_KEYS.has(k)) continue;
      const v = (obj as any)[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (k === "properties" && v && typeof v === "object") {
        const deep = firstNonEmptyString(v);
        if (deep) return deep;
      }
    }
    return undefined;
  }

  function mapOne(r: any, i: number): City | null {
    if (typeof r === "string") return { id: String(i), label: r };

    let idCandidate: string | number | undefined = r?.id ?? r?.value ?? r?.place_id ?? r?.woeid ?? r?.properties?.id;
    if (idCandidate === undefined) {
      const lat = r?.lat ?? r?.latitude ?? r?.properties?.lat ?? r?.properties?.latitude ?? "";
      const lon = r?.lon ?? r?.lng ?? r?.longitude ?? r?.properties?.lon ?? r?.properties?.lng ?? r?.properties?.longitude ?? "";
      if (String(lat) !== "" || String(lon) !== "") idCandidate = `${lat},${lon}`;
    }
    const id = String(idCandidate !== undefined ? idCandidate : i);

    let label: string | undefined =
      r?.label ?? r?.full_name ?? r?.display_name ?? r?.place_name ?? r?.formatted ??
      r?.properties?.full_name ?? r?.properties?.display_name;

    if (!label && (r?.text || r?.properties?.name)) {
      const head = r?.text || r?.properties?.name;
      const ctx = Array.isArray(r?.context)
        ? r.context.map((c: any) => c?.text || c?.properties?.name || c?.short_code).filter(Boolean)
        : [];
      const parts = [head, ...ctx].filter((p) => typeof p === "string" && p.trim());
      if (parts.length) label = parts.slice(0, 3).join(", ");
    }

    const city = r?.city ?? r?.name ?? r?.text ?? r?.title ?? r?.properties?.name ?? r?.municipio ?? r?.locality ?? r?.town ?? r?.village;
    const admin1 = r?.state ?? r?.state_name ?? r?.admin1 ?? r?.admin_name ?? r?.region ?? r?.properties?.state ?? r?.properties?.admin1;
    const country =
      (r?.country_code || r?.properties?.country_code || r?.countryCode || r?.country)?.toString()?.toUpperCase() ||
      r?.properties?.country_name || r?.country_name;

    if (!label) {
      const parts = [city, admin1, country].filter((p) => typeof p === "string" && p.trim());
      if (parts.length) label = parts.join(", ");
    }
    if (!label) label = firstNonEmptyString(r);
    if (label && /^[a-z]+\.\d+$/i.test(label)) {
      const head = r?.text || r?.properties?.name || city;
      const ctx = Array.isArray(r?.context)
        ? r.context.map((c: any) => c?.text || c?.properties?.name || c?.short_code).filter(Boolean)
        : [];
      const parts = [head, ...ctx].filter((p) => typeof p === "string" && p.trim());
      if (parts.length) label = parts.slice(0, 3).join(", ");
    }
    if (!label) return null;

    const latRaw = r?.lat ?? r?.latitude ?? r?.properties?.lat ?? r?.properties?.latitude ?? null;
    const lngRaw = r?.lon ?? r?.lng ?? r?.longitude ?? r?.properties?.lon ?? r?.properties?.lng ?? r?.properties?.longitude ?? null;
    const lat = latRaw != null ? Number(latRaw) : undefined;
    const lng = lngRaw != null ? Number(lngRaw) : undefined;

    return { id, label: String(label), city: city || undefined, admin1: admin1 || undefined, country: (typeof country === "string" ? country : undefined) || undefined, lat, lng };
  }

  // ── Fetch ──
  const doSearch = async (term: string) => {
    const q = normalize(term).trim();
    if (q.length < minChars) { setItems([]); return; }

    const cached = cacheRef.current.get(q);
    if (cached) { setItems(cached); setHoverIdx(cached.length ? 0 : -1); return; }

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const thisReq = ++reqSeq.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ q });
      countries.forEach((c) => params.append("country", c));
      const res = await fetch(`/api/geo/cities?${params.toString()}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (thisReq > lastHandled.current) {
        lastHandled.current = thisReq;
        const parsed = parseCitiesPayload(data);
        cacheRef.current.set(q, parsed);
        setItems(parsed);
        setHoverIdx(parsed.length ? 0 : -1);
      }
    } catch (err: any) {
      if (err?.name !== "AbortError" && thisReq >= lastHandled.current) setItems([]);
    } finally {
      if (thisReq >= lastHandled.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (composingRef.current) return;
    if (!fetchOnMount && query === (value || "")) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => doSearch(query), debounceMs);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, countries.join(","), debounceMs, fetchOnMount]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      const insideInput = wrapperRef.current?.contains(t);
      const insidePortal = (t as HTMLElement)?.closest?.("[data-la-portal]") != null;
      if (!insideInput && !insidePortal) setFocused(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const pick = (item: City) => {
    const place: PlaceResult = {
      label: item.label,
      city: item.city,
      admin1: item.admin1,
      country: item.country,
      cityNorm: slugify(item.city),
      admin1Norm: slugify(item.admin1),
      lat: item.lat,
      lng: item.lng,
    };
    // onChange siempre recibe string (label) para compatibilidad
    onChange(item.label);
    onPlace?.(place);
    committed.current = item.label;
    setQuery(item.label);
    setItems([]);
    setFocused(false);
  };

  const showList =
    focused &&
    query.trim().length >= minChars &&
    (loading || items.length > 0) &&
    (!usePortal || (mounted && !!anchor));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHoverIdx((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHoverIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const sel = items[hoverIdx]; if (sel) pick(sel); }
    else if (e.key === "Escape") { setFocused(false); setItems([]); }
  };

  // ── Dropdown ──
  const dropdown = (
    <ul
      id="location-listbox"
      data-la-portal={usePortal ? "" : undefined}
      role="listbox"
      aria-label="Sugerencias de ubicación"
      style={
        usePortal
          ? {
              position: "absolute",
              top: anchor?.y ?? 0,
              left: anchor?.x ?? 0,
              width: anchor?.w ?? undefined,
              zIndex: 99999,
            }
          : undefined
      }
      className={[
        // Base
        "overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl",
        "dark:border-zinc-700 dark:bg-zinc-900",
        // Animación sutil
        "animate-in fade-in-0 zoom-in-95 duration-100",
        // Mobile: ancho completo y más padding táctil
        "w-full",
      ].join(" ")}
    >
      {loading ? (
        <li className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
          <span>Buscando...</span>
        </li>
      ) : items.length === 0 ? (
        <li className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
          <SearchX className="h-4 w-4" />
          <span>Sin coincidencias</span>
        </li>
      ) : (
        items.map((it, i) => (
          <li
            key={it.id ?? i}
            role="option"
            aria-selected={i === hoverIdx}
            className={[
              // Base — tamaño táctil mínimo 44px para mobile
              "flex items-center gap-3 px-4 cursor-pointer transition-colors",
              "min-h-[44px] py-2",
              // Separador entre items (excepto último)
              i < items.length - 1 ? "border-b border-zinc-100 dark:border-zinc-800" : "",
              // Estado hover/activo
              i === hoverIdx
                ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60",
            ].join(" ")}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(it)}
          >
            <MapPin
              className={[
                "h-4 w-4 shrink-0",
                i === hoverIdx ? "text-emerald-500" : "text-zinc-400 dark:text-zinc-500",
              ].join(" ")}
            />
            <div className="min-w-0 flex-1">
              {/* Ciudad principal */}
              <p className="truncate text-sm font-medium leading-tight">
                {it.city && it.city !== it.label ? it.city : it.label.split(",")[0]}
              </p>
              {/* Estado / País como subtítulo */}
              {(it.admin1 || it.country) && (
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400 leading-tight mt-0.5">
                  {[it.admin1, it.country].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </li>
        ))
      )}
    </ul>
  );

  return (
    <>
      <div ref={wrapperRef} className="relative">
        {/* Ícono de pin dentro del input */}
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <MapPin className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
        </div>

        <input
          ref={inputRef}
          id="location"
          name="location"
          // Heredar className del padre + padding-left para el ícono
          className={[
            className ?? "",
            "pl-9", // espacio para el ícono
          ]
            .filter(Boolean)
            .join(" ")}
          value={query}
          placeholder={placeholder ?? "Ciudad o estado"}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          // mobile: abre el teclado en modo texto, no numérico
          inputMode="text"
          enterKeyHint="search"
          onChange={(e) => {
            setQuery(e.target.value);
            // Si el usuario borra, notificar al padre
            if (!e.target.value.trim()) onChange("");
          }}
          onFocus={() => {
            setFocused(true);
            updateAnchor();
            const v = (inputRef.current?.value || "").trim();
            if (v.length >= minChars) doSearch(v);
          }}
          onBlur={() => {
            setTimeout(() => setFocused(false), 150);
          }}
          onKeyDown={onKeyDown}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            setQuery((e.target as HTMLInputElement).value);
          }}
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls="location-listbox"
        />

        {/* Spinner inline cuando carga */}
        {loading && (
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
          </div>
        )}

        {/* Dropdown sin portal (fallback) */}
        {!usePortal && showList && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1">{dropdown}</div>
        )}
      </div>

      {/* Dropdown con portal */}
      {usePortal && showList && mounted && anchor && createPortal(dropdown, document.body)}
    </>
  );
}