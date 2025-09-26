// components/JobSearchBar.tsx
"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export default function JobSearchBar() {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [loc, setLoc] = useState("")

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (loc) params.set("loc", loc)
    router.push(`/jobs?${params.toString()}`)
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur md:grid-cols-[1fr_320px_auto]"
      aria-label="Buscador de empleos"
    >
      <div className="flex items-center gap-2 rounded-xl bg-white/90 px-3 py-2 text-[#082B33]">
        <span className="text-lg">🔎</span>
        <input
          className="w-full bg-transparent text-sm outline-none placeholder:text-[#608089]"
          placeholder="Puesto, skill o empresa"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Puesto, skill o empresa"
        />
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-white/90 px-3 py-2 text-[#082B33]">
        <span className="text-lg">📍</span>
        <input
          className="w-full bg-transparent text-sm outline-none placeholder:text-[#608089]"
          placeholder="Ubicación (p. ej., Remoto, CDMX)"
          value={loc}
          onChange={(e) => setLoc(e.target.value)}
          aria-label="Ubicación"
        />
      </div>

      <button
        type="submit"
        className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-[#042229] hover:bg-emerald-300"
        aria-label="Buscar empleos"
      >
        Buscar empleos
      </button>
    </form>
  )
}
