"use client";
// app/onboarding/candidate/StepSkills.tsx

import { useState, useMemo } from "react";
import { X } from "lucide-react";

const POPULAR = [
  "JavaScript","TypeScript","React","Vue","Angular","Next.js",
  "Node.js","Python","Java","Go","Rust","PHP",
  "AWS","Azure","GCP","Docker","Kubernetes",
  "PostgreSQL","MongoDB","MySQL","GraphQL","REST APIs",
  "Git","CI/CD","Figma","Salesforce","Apex",
];

interface Props {
  skills: string[];
  onChange: (skills: string[]) => void;
  skillOptions?: string[]; // ← opciones de DB para autocomplete
}

export function StepSkills({ skills, onChange, skillOptions = [] }: Props) {
  const [input, setInput] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Combinar populares + opciones de DB sin duplicados
  const allOptions = useMemo(() => {
    const seen = new Set(POPULAR.map((s) => s.toLowerCase()));
    const extra = skillOptions.filter((s) => !seen.has(s.toLowerCase()));
    return [...POPULAR, ...extra];
  }, [skillOptions]);

  // Filtrar por query — igual que ProfileForm
  const filtered = useMemo(() => {
    const q = input.trim().toLowerCase();
    const chosen = new Set(skills.map((s) => s.toLowerCase()));
    return (q ? allOptions.filter((s) => s.toLowerCase().includes(q)) : allOptions)
      .filter((s) => !chosen.has(s.toLowerCase()))
      .slice(0, 20);
  }, [input, allOptions, skills]);

  function toggle(sk: string) {
    if (skills.includes(sk)) {
      onChange(skills.filter((s) => s !== sk));
    } else {
      onChange([...skills, sk]);
    }
  }

  function addFromInput() {
    const val = input.trim();
    if (val && !skills.map((s) => s.toLowerCase()).includes(val.toLowerCase())) {
      onChange([...skills, val]);
    }
    setInput("");
    setDropdownOpen(false);
  }

  function selectFromDropdown(sk: string) {
    if (!skills.map((s) => s.toLowerCase()).includes(sk.toLowerCase())) {
      onChange([...skills, sk]);
    }
    setInput("");
    setDropdownOpen(false);
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        Tus skills
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
        Los reclutadores filtran por tecnología. Sé específico.
      </p>

      {/* Selected */}
      <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
        Seleccionadas
      </p>
      <div className="min-h-[44px] bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-2.5 flex flex-wrap gap-1.5 mb-4">
        {skills.length === 0 ? (
          <span className="text-xs text-zinc-400 dark:text-zinc-500 self-center px-1">
            Toca una skill para agregarla
          </span>
        ) : (
          skills.map((sk) => (
            <span
              key={sk}
              className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-medium"
            >
              {sk}
              <button type="button" onClick={() => toggle(sk)} className="text-emerald-400 hover:text-emerald-600 transition">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Pool de populares — solo si no hay query */}
      {!input && (
        <>
          <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
            Populares en TI
          </p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {POPULAR.filter((sk) => !skills.map((s) => s.toLowerCase()).includes(sk.toLowerCase())).map((sk) => (
              <button
                key={sk}
                type="button"
                onClick={() => toggle(sk)}
                className="px-3 py-1.5 rounded-full text-xs border transition border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-emerald-300 hover:text-emerald-600"
              >
                {sk}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Input con autocomplete — igual que ProfileForm */}
      <div className="relative mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setDropdownOpen(true);
              }}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addFromInput(); }
                if (e.key === "Escape") setDropdownOpen(false);
              }}
              placeholder="Buscar skill (ej. React, Kubernetes…)"
              className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />

            {/* Dropdown predictivo */}
            {dropdownOpen && filtered.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
                {filtered.map((sk) => (
                  <li key={sk}>
                    <button
                      type="button"
                      onMouseDown={() => selectFromDropdown(sk)}
                      className="w-full px-3 py-2 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                    >
                      {sk}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={addFromInput}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
          >
            + Agregar
          </button>
        </div>
      </div>
    </div>
  );
}