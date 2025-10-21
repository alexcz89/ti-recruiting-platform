// components/JobSearchBar.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, MapPin } from "lucide-react";

export default function JobSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Lee valores iniciales desde la URL
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [location, setLocation] = useState(() => {
    return searchParams.get("location") ?? searchParams.get("loc") ?? "";
  });

  // Mantén los valores sincronizados si cambia la URL
  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
    setLocation(searchParams.get("location") ?? searchParams.get("loc") ?? "");
  }, [searchParams]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const params = new URLSearchParams(searchParams.toString());

    // Normaliza q/location
    if (q && q.trim()) params.set("q", q.trim());
    else params.delete("q");

    if (location && location.trim()) params.set("location", location.trim());
    else {
      params.delete("location");
      params.delete("loc"); // limpia legacy
    }

    // Reinicia la paginación
    params.set("page", "1");

    router.push(`/jobs?${params.toString()}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="
        grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 
        backdrop-blur-md md:grid-cols-[1fr_280px_auto] shadow-lg
        transition-all duration-300 hover:border-emerald-400/30
      "
      aria-label="Buscador de empleos"
    >
      {/* Campo principal: Puesto o skill */}
      <div className="flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-[#082B33] shadow-sm focus-within:ring-2 focus-within:ring-emerald-400">
        <Search className="h-4 w-4 text-emerald-600" />
        <input
          className="w-full bg-transparent text-sm outline-none placeholder:text-[#608089]"
          placeholder="Puesto, skill o empresa"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Puesto, skill o empresa"
        />
      </div>

      {/* Campo de ubicación */}
      <div className="flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-[#082B33] shadow-sm focus-within:ring-2 focus-within:ring-emerald-400">
        <MapPin className="h-4 w-4 text-emerald-600" />
        <input
          className="w-full bg-transparent text-sm outline-none placeholder:text-[#608089]"
          placeholder="Ubicación (p. ej., Remoto, CDMX)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          aria-label="Ubicación"
        />
      </div>

      {/* Botón buscar */}
      <button
        type="submit"
        className="
          rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white 
          shadow hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2
          transition-all duration-200
        "
        aria-label="Buscar empleos"
      >
        Buscar empleos
      </button>
    </form>
  );
}
