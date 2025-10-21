// components/ActiveFilterChips.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

type ET = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
type SR = "JUNIOR" | "MID" | "SENIOR" | "LEAD";
type SORT = "relevance" | "recent";

const EMPLOYMENT_LABEL: Record<ET, string> = {
  FULL_TIME: "Tiempo completo",
  PART_TIME: "Medio tiempo",
  CONTRACT: "Contrato",
  INTERNSHIP: "Prácticas",
};

const SENIORITY_LABEL: Record<SR, string> = {
  JUNIOR: "Junior",
  MID: "Mid",
  SENIOR: "Senior",
  LEAD: "Lead",
};

const SORT_LABEL: Record<SORT, string> = {
  relevance: "Relevancia",
  recent: "Recientes",
};

function Chip({
  children,
  onClear,
  title,
}: {
  children: React.ReactNode;
  onClear: () => void;
  title?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 shadow-sm"
      title={title}
    >
      {children}
      <button
        type="button"
        onClick={onClear}
        className="rounded-full p-0.5 hover:bg-zinc-100"
        aria-label="Quitar filtro"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

export default function ActiveFilterChips() {
  const router = useRouter();
  const sp = useSearchParams();

  const q = sp.get("q")?.trim() || "";
  const location = sp.get("location")?.trim() || sp.get("loc")?.trim() || "";
  const remoteParam = sp.get("remote");
  const remote =
    remoteParam === "true" ? true : remoteParam === "false" ? false : undefined;
  const employmentType = sp.get("employmentType") as ET | null;
  const seniority = sp.get("seniority") as SR | null;
  const sort = (sp.get("sort") as SORT | null) || null;

  const chips: Array<{ key: string; label: string; clear: () => void }> = [];

  const removeParam = (key: string) => {
    const next = new URLSearchParams(sp.toString());
    next.delete(key);
    // reset de paginación
    next.set("page", "1");
    router.push(`/jobs?${next.toString()}`);
  };

  if (q) {
    chips.push({
      key: "q",
      label: `Búsqueda: “${q}”`,
      clear: () => removeParam("q"),
    });
  }

  if (location) {
    chips.push({
      key: "location",
      label: `Ubicación: ${location}`,
      clear: () => {
        const next = new URLSearchParams(sp.toString());
        next.delete("location");
        next.delete("loc");
        next.set("page", "1");
        router.push(`/jobs?${next.toString()}`);
      },
    });
  }

  if (remote !== undefined) {
    chips.push({
      key: "remote",
      label: remote ? "Remoto" : "No remoto",
      clear: () => removeParam("remote"),
    });
  }

  if (employmentType && EMPLOYMENT_LABEL[employmentType as ET]) {
    chips.push({
      key: "employmentType",
      label: EMPLOYMENT_LABEL[employmentType as ET],
      clear: () => removeParam("employmentType"),
    });
  }

  if (seniority && SENIORITY_LABEL[seniority as SR]) {
    chips.push({
      key: "seniority",
      label: `Nivel: ${SENIORITY_LABEL[seniority as SR]}`,
      clear: () => removeParam("seniority"),
    });
  }

  if (sort && SORT_LABEL[sort as SORT] && sort !== "recent") {
    // Solo mostramos si no es el default (recent)
    chips.push({
      key: "sort",
      label: `Orden: ${SORT_LABEL[sort as SORT]}`,
      clear: () => removeParam("sort"),
    });
  }

  if (chips.length === 0) return null;

  const clearAll = () => {
    const keep: string[] = []; // si quisieras preservar algo, agrégalo aquí
    const next = new URLSearchParams(sp.toString());
    for (const k of Array.from(next.keys())) {
      if (!keep.includes(k)) next.delete(k);
    }
    router.push("/jobs?page=1");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <Chip key={c.key} onClear={c.clear} title={`Quitar ${c.key}`}>
          {c.label}
        </Chip>
      ))}
      <button
        type="button"
        onClick={clearAll}
        className="text-xs text-zinc-600 underline underline-offset-2 hover:text-zinc-800"
      >
        Limpiar todo
      </button>
    </div>
  );
}
