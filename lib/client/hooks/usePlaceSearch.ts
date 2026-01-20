// lib/hooks/usePlaceSearch.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type Place = {
  label: string; city?: string; admin1?: string; country?: string;
  countryCode?: string; lat?: number; lng?: number; placeId?: string;
  precision?: string;
};

export function usePlaceSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Debounce 250 ms
  const debouncedQuery = useDebounce(query, 250);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      setResults([]);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    (async () => {
      try {
        setLoading(true);
        const url = `/api/geo/search?q=${encodeURIComponent(q)}&limit=6&countries=mx,us,es`;
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as Place[];
        setResults(data);
      } catch {
        if (!ctrl.signal.aborted) setResults([]);
      } finally {
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [debouncedQuery]);

  return { query, setQuery, results, loading };
}

function useDebounce<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
