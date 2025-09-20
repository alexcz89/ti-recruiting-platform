// app/components/SkillsPicker.tsx
"use client"

import * as React from "react"
import { ALL_SKILLS } from "@/lib/skills"

type Props = {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  label?: string
}

export default function SkillsPicker({ value, onChange, placeholder = "Busca y selecciona skills…", label = "Skills" }: Props) {
  const [q, setQ] = React.useState("")
  const [open, setOpen] = React.useState(false)

  const lower = q.toLowerCase()
  const filtered = React.useMemo(() => {
    const base = ALL_SKILLS.filter(s => s.toLowerCase().includes(lower) && !value.includes(s))
    return base.slice(0, 12) // limita sugerencias
  }, [q, value])

  function addSkill(s: string) {
    if (!value.includes(s)) onChange([...value, s])
    setQ("")
    setOpen(false)
  }
  function removeSkill(s: string) {
    onChange(value.filter(v => v !== s))
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && filtered[0]) {
      e.preventDefault()
      addSkill(filtered[0])
    }
  }

  return (
    <div className="grid gap-2">
      {label && <label className="text-sm">{label}</label>}

      {/* input + dropdown */}
      <div className="relative">
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          className="w-full border rounded-xl px-3 py-2"
          placeholder={placeholder}
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow">
            {filtered.map(s => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addSkill(s)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* chips */}
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map(s => (
            <span key={s} className="inline-flex items-center gap-1 border rounded-full px-2 py-1 text-xs bg-gray-50">
              {s}
              <button
                type="button"
                onClick={() => removeSkill(s)}
                className="rounded-full px-1 hover:bg-gray-100"
                aria-label={`Quitar ${s}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">No has seleccionado skills todavía.</p>
      )}

      {/* Campo oculto para server action (CSV) */}
      <input type="hidden" name="skills" value={value.join(",")} />
    </div>
  )
}
