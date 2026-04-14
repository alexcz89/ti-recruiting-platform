// components/LocationAutocomplete.tsx
"use client";

import React, { useEffect, useId, useRef, useState } from "react";
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
  inputId?: string;
  listId?: string;
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
  inputId,
  listId,
}: Props) {
  const reactId = useId();
  const resolvedInputId = inputId ?? `location-${reactId}`;
  const resolvedListId = listId ?? `location-listbox-${reactId}`;

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
    const viewportPadding = 8;
    const viewportWidth = window.innerWidth;
    const desiredWidth = r.width;
    const maxWidth = Math.max(280, viewportWidth - viewportPadding * 2);
    const width = Math.min(desiredWidth, maxWidth);
    const left = Math.min(
      Math.max(viewportPadding, r.left + window.scrollX),
      window.scrollX + viewportWidth - width - viewportPadding
    );

    setAnchor({
      x: left,
      y: r.bottom + window.scrollY + 4,
      w: width,
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

  function parseCitiesPayload(data: any): City[] {
    const rootArr = pickArray(data);
    if (!rootArr) return [];

    return rootArr
      .map((r: any, i: number) => mapOne(r, i))
      .filter((x: City | null): x is City => !!x && String(x.label).trim().length > 0);
  }

  function pickArray(x: any): any[] | null {
    if (Array.isArray(x)) return x;

    const cand =
      x?.items ??
      x?.results ??
      x?.cities ??
      x?.data ??
      x?.features ??
      x?.places ??
      x?.payload;

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
      obj.label,
      obj.name,
      obj.text,
      obj.title,
      obj.full_name,
      obj.display_name,
      obj.place_name,
      obj.city,
      obj.municipio,
      obj.locality,
      obj.town,
      obj.village,
      obj.state,
      obj.state_name,
      obj.admin1,
      obj.admin_name,
      obj.region,
      obj.country,
      obj.country_name,
      obj.countryCode,
      obj.description,
      obj.formatted,
    ];

    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
    }

    const SKIP_KEYS = new Set([
      "id",
      "_id",
      "woeid",
      "osm_id",
      "wikidata",
      "place_type",
      "short_code",
      "type",
      "feature_type",
    ]);

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

    let idCandidate: string | number | undefined =
      r?.id ?? r?.value ?? r?.place_id ?? r?.woeid ?? r?.properties?.id;

    if (idCandidate === undefined) {
      const lat =
        r?.lat ??
        r?.latitude ??
        r?.properties?.lat ??
        r?.properties?.latitude ??
        "";
      const lon =
        r?.lon ??
        r?.lng ??
        r?.longitude ??
        r?.properties?.lon ??
        r?.properties?.lng ??
        r?.properties?.longitude ??
        "";

      if (String(lat) !== "" || String(lon) !== "") {
        idCandidate = `${lat},${lon}`;
      }
    }

    const id = String(idCandidate !== undefined ? idCandidate : i);

    let label: string | undefined =
      r?.label ??
      r?.full_name ??
      r?.display_name ??
      r?.place_name ??
      r?.formatted ??
      r?.properties?.full_name ??
      r?.properties?.display_name;

    if (!label && (r?.text || r?.properties?.name)) {
      const head = r?.text || r?.properties?.name;
      const ctx = Array.isArray(r?.context)
        ? r.context
            .map((c: any) => c?.text || c?.properties?.name || c?.short_code)
            .filter(Boolean)
        : [];
      const parts = [head, ...ctx].filter(
        (p) => typeof p === "string" && p.trim()
      );
      if (parts.length) label = parts.slice(0, 3).join(", ");
    }

    const city =
      r?.city ??
      r?.name ??
      r?.text ??
      r?.title ??
      r?.properties?.name ??
      r?.municipio ??
      r?.locality ??
      r?.town ??
      r?.village;

    const admin1 =
      r?.state ??
      r?.state_name ??
      r?.admin1 ??
      r?.admin_name ??
      r?.region ??
      r?.properties?.state ??
      r?.properties?.admin1;

    const country =
      (
        r?.country_code ||
        r?.properties?.country_code ||
        r?.countryCode ||
        r?.country
      )
        ?.toString()
        ?.toUpperCase() ||
      r?.properties?.country_name ||
      r?.country_name;

    if (!label) {
      const parts = [city, admin1, country].filter(
        (p) => typeof p === "string" && p.trim()
      );
      if (parts.length) label = parts.join(", ");
    }

    if (!label) label = firstNonEmptyString(r);

    if (label && /^[a-z]+\.\d+$/i.test(label)) {
      const head = r?.text || r?.properties?.name || city;
      const ctx = Array.isArray(r?.context)
        ? r.context
            .map((c: any) => c?.text || c?.properties?.name || c?.short_code)
            .filter(Boolean)
        : [];
      const parts = [head, ...ctx].filter(
        (p) => typeof p === "string" && p.trim()
      );
      if (parts.length) label = parts.slice(0, 3).join(", ");
    }

    if (!label) return null;

    const latRaw =
      r?.lat ??
      r?.latitude ??
      r?.properties?.lat ??
      r?.properties?.latitude ??
      null;
    const lngRaw =
      r?.lon ??
      r?.lng ??
      r?.longitude ??
      r?.properties?.lon ??
      r?.properties?.lng ??
      r?.properties?.longitude ??
      null;

    const lat = latRaw != null ? Number(latRaw) : undefined;
    const lng = lngRaw != null ? Number(lngRaw) : undefined;

    return {
      id,
      label: String(label),
      city: city || undefined,
      admin1: admin1 || undefined,
      country: (typeof country === "string" ? country : undefined) || undefined,
      lat,
      lng,
    };
  }

  const doSearch = async (term: string) => {
    const q = normalize(term).trim();

    if (q.length < minChars) {
      setItems([]);
      setHoverIdx(-1);
      setLoading(false);
      return;
    }

    const cached = cacheRef.current.get(q);
    if (cached) {
      setItems(cached);
      setHoverIdx(cached.length ? 0 : -1);
      return;
    }

    if (abortRef.current) abortRef.current.abort();

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const thisReq = ++reqSeq.current;

    setLoading(true);

    try {
      const params = new URLSearchParams({ q });
      countries.forEach((c) => params.append("country", c));

      const res = await fetch(`/api/geo/cities?${params.toString()}`, {
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      if (debug) {
        console.log("[LocationAutocomplete] raw response", data);
      }

      if (thisReq > lastHandled.current) {
        lastHandled.current = thisReq;
        const parsed = parseCitiesPayload(data);
        cacheRef.current.set(q, parsed);
        setItems(parsed);
        setHoverIdx(parsed.length ? 0 : -1);
      }
    } catch (err: any) {
      if (err?.name !== "AbortError" && thisReq >= lastHandled.current) {
        if (debug) {
          console.warn("[LocationAutocomplete] search failed", err);
        }
        setItems([]);
        setHoverIdx(-1);
      }
    } finally {
      if (thisReq >= lastHandled.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (composingRef.current) return;
    if (!fetchOnMount && query === (value || "")) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);

    timerRef.current = window.setTimeout(() => {
      void doSearch(query);
    }, debounceMs);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, countries.join(","), debounceMs, fetchOnMount]);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      const insideInput = wrapperRef.current?.contains(t);
      const insidePortal =
        (t as HTMLElement)?.closest?.("[data-la-portal]") != null;

      if (!insideInput && !insidePortal) {
        setFocused(false);
      }
    }

    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
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

    onChange(item.label);
    onPlace?.(place);
    committed.current = item.label;
    setQuery(item.label);
    setItems([]);
    setHoverIdx(-1);
    setFocused(false);
  };

  const canShowPanel =
    focused &&
    query.trim().length >= minChars &&
    (!usePortal || (mounted && !!anchor));

  const activeDescendant =
    canShowPanel && hoverIdx >= 0 ? `${resolvedListId}-option-${hoverIdx}` : undefined;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!canShowPanel) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHoverIdx((i) => {
        if (items.length === 0) return -1;
        return Math.min(i + 1, items.length - 1);
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHoverIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = items[hoverIdx];
      if (sel) pick(sel);
    } else if (e.key === "Escape") {
      setFocused(false);
      setItems([]);
      setHoverIdx(-1);
    }
  };

  const dropdown = (
    <ul
      id={resolvedListId}
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
              maxWidth: "calc(100vw - 16px)",
              zIndex: 99999,
            }
          : undefined
      }
      className={[
        "w-full max-h-72 overflow-y-auto overflow-x-hidden rounded-xl border border-zinc-200 bg-white shadow-xl",
        "dark:border-zinc-700 dark:bg-zinc-900",
        "animate-in fade-in-0 zoom-in-95 duration-100",
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
            id={`${resolvedListId}-option-${i}`}
            key={it.id ?? i}
            role="option"
            aria-selected={i === hoverIdx}
            className={[
              "flex min-h-[44px] cursor-pointer items-center gap-3 px-4 py-2 transition-colors",
              i < items.length - 1
                ? "border-b border-zinc-100 dark:border-zinc-800"
                : "",
              i === hoverIdx
                ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                : "text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/60 dark:active:bg-zinc-800",
            ].join(" ")}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(it)}
          >
            <MapPin
              className={[
                "h-4 w-4 shrink-0",
                i === hoverIdx
                  ? "text-emerald-500"
                  : "text-zinc-400 dark:text-zinc-500",
              ].join(" ")}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">
                {it.city && it.city !== it.label ? it.city : it.label.split(",")[0]}
              </p>
              {(it.admin1 || it.country) && (
                <p className="mt-0.5 truncate text-xs leading-tight text-zinc-500 dark:text-zinc-400">
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
      <div
        ref={wrapperRef}
        className="relative"
        role="combobox"
        aria-expanded={canShowPanel}
        aria-haspopup="listbox"
        aria-controls={resolvedListId}
      >
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <MapPin className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
        </div>

        <input
          ref={inputRef}
          id={resolvedInputId}
          name="location"
          className={[className ?? "", "min-h-[44px] pl-9 text-base sm:text-sm"].filter(Boolean).join(" ")}
          value={query}
          placeholder={placeholder ?? "Ciudad o estado"}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="search"
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            setFocused(true);

            if (!next.trim()) {
              onChange("");
              setItems([]);
              setHoverIdx(-1);
            }
          }}
          onFocus={() => {
            setFocused(true);
            updateAnchor();
            const v = (inputRef.current?.value || "").trim();
            if (v.length >= minChars) {
              void doSearch(v);
            }
          }}
          onKeyDown={onKeyDown}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            setQuery((e.target as HTMLInputElement).value);
          }}
          aria-autocomplete="list"
          aria-controls={resolvedListId}
          aria-activedescendant={activeDescendant}
        />

        {loading && (
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
          </div>
        )}

        {!usePortal && canShowPanel && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1">{dropdown}</div>
        )}
      </div>

      {usePortal && canShowPanel && mounted && anchor && createPortal(dropdown, document.body)}
    </>
  );
}