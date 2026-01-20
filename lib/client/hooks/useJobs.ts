// lib/hooks/useJobs.ts
"use client";

import useSWRInfinite from "swr/infinite";

export type Job = {
  id: string;
  title: string;
  company?: string | null;
  location?: string | null;
  countryCode?: string | null;
  city?: string | null;
  seniority: string;
  employmentType: string;
  description?: string | null;
  skills: string[];
  remote: boolean;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  createdAt: string;
  updatedAt?: string;
};

type JobsPage = {
  items: Job[];            // 👈 coincide con tu API: { items, nextCursor }
  nextCursor: string | null;
};

const fetcher = async (url: string): Promise<JobsPage> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Error al cargar vacantes");
  return res.json();
};

export function useJobs(filters: {
  q?: string;
  /** Texto libre de ubicación (ej. "CDMX", "Remoto", "Monterrey") */
  location?: string;
  /** Opcionales si filtras por país/ciudad normalizados */
  countryCode?: string;
  city?: string;
  remote?: boolean;
  seniority?: string;
  employmentType?: string;
  minSalary?: number;
  maxSalary?: number;
  sort?: "recent" | "relevance";
  /** Tamaño de página del API (default 12) */
  limit?: number;
}) {
  const limit = filters.limit ?? 12;

  const getKey = (pageIndex: number, previousPageData: JobsPage | null) => {
    // Si ya no hay cursor, no pedir más páginas
    if (previousPageData && !previousPageData.nextCursor) return null;

    const params = new URLSearchParams();

    if (filters.q) params.set("q", filters.q);
    if (filters.location) params.set("location", filters.location);
    if (filters.countryCode) params.set("countryCode", filters.countryCode);
    if (filters.city) params.set("city", filters.city);
    if (filters.remote !== undefined) params.set("remote", String(filters.remote));
    if (filters.seniority) params.set("seniority", filters.seniority);
    if (filters.employmentType) params.set("employmentType", filters.employmentType);
    if (filters.minSalary != null) params.set("minSalary", String(filters.minSalary));
    if (filters.maxSalary != null) params.set("maxSalary", String(filters.maxSalary));
    if (filters.sort) params.set("sort", filters.sort);
    params.set("limit", String(limit));

    if (pageIndex > 0 && previousPageData?.nextCursor) {
      params.set("cursor", previousPageData.nextCursor);
    }

    return `/api/jobs?${params.toString()}`;
  };

  const { data, error, size, setSize, isValidating } = useSWRInfinite(getKey, fetcher);

  // La API devuelve { items }, los aplanamos
  const jobs: Job[] = data ? data.flatMap((page) => page.items) : [];
  const hasMore = data ? Boolean(data[data.length - 1]?.nextCursor) : true;

  return {
    jobs,
    isLoading: !data && !error,
    isError: !!error,
    isValidating,
    size,
    setSize,
    hasMore,
  };
}
