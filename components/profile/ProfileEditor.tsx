// components/profile/ProfileEditor.tsx
"use client";

import { useEffect, useState } from "react";
import LockEmailNote from "./LockEmailNote";
import { toastSuccess, toastError, toastInfo, toastWarning } from "@/lib/ui/toast";

type ExperienceItem = {
  role: string;
  company: string;
  startDate: string; // YYYY-MM
  endDate: string;   // YYYY-MM o ""
  isCurrent: boolean;
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  location: string;
  birthdate: string; // YYYY-MM-DD
  linkedin: string;
  github: string;
  experiences: ExperienceItem[];
};

function isoToMonth(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function ensureMonth(v: string) {
  // Acepta "YYYY-MM" o vacío
  if (!v) return "";
  const m = v.match(/^\d{4}-(0[1-9]|1[0-2])$/);
  return m ? v : "";
}

export default function ProfileEditor() {
  const [f, setF] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    location: "",
    birthdate: "",
    linkedin: "",
    github: "",
    experiences: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch("/api/profile", { signal: ac.signal });
        if (!r.ok) throw new Error("No se pudo cargar el perfil");
        const j = await r.json();
        const experiences: ExperienceItem[] = Array.isArray(j.experience)
          ? j.experience.map((e: any) => ({
              role: e.role || "",
              company: e.company || "",
              startDate: ensureMonth(isoToMonth(e.startDate)),
              endDate: e.isCurrent ? "" : ensureMonth(isoToMonth(e.endDate)),
              isCurrent: !!e.isCurrent,
            }))
          : [];
        setF({
          name: j.personal?.fullName || "",
          email: j.personal?.email || "",
          phone: j.personal?.phone || "",
          location: j.personal?.location || "",
          birthdate: j.personal?.birthDate || "",
          linkedin: j.personal?.linkedin || "",
          github: j.personal?.github || "",
          experiences,
        });
      } catch (e: any) {
        toastError(e?.message || "Error al cargar");
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  function addExperience() {
    setF((s) => ({
      ...s,
      experiences: [
        ...s.experiences,
        { role: "", company: "", startDate: "", endDate: "", isCurrent: false },
      ],
    }));
  }

  function removeExperience(idx: number) {
    setF((s) => ({
      ...s,
      experiences: s.experiences.filter((_, i) => i !== idx),
    }));
  }

  function updateExp<K extends keyof ExperienceItem>(
    idx: number,
    key: K,
    value: ExperienceItem[K]
  ) {
    setF((s) => {
      const copy = s.experiences.slice();
      const item = { ...copy[idx], [key]: value };
      // Si marcan "Actualmente aquí", limpiamos endDate
      if (key === "isCurrent" && value === true) {
        item.endDate = "";
      }
      copy[idx] = item;
      return { ...s, experiences: copy };
    });
  }

  async function onSave() {
    setSaving(true);
    try {
      // Normaliza experiencias (validación ligera aquí, lo fuerte lo hace el backend)
      const experiences = f.experiences
        .map((e) => ({
          role: (e.role || "").trim(),
          company: (e.company || "").trim(),
          startDate: ensureMonth(e.startDate),
          endDate: e.isCurrent ? "" : ensureMonth(e.endDate),
          isCurrent: !!e.isCurrent,
        }))
        .filter((e) => e.role && e.company && e.startDate);

      const r = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // datos básicos
          location: f.location || null,
          phone: f.phone || null,
          birthdate: f.birthdate || null,
          linkedin: f.linkedin || null,
          github: f.github || null,
          // experiencia laboral
          experiences,
          // (educación y demás se pueden enviar en futuras fases)
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.detail || err?.error || "No se pudo guardar");
      }
      toastSuccess("Perfil actualizado");
    } catch (e: any) {
      toastError(e?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-zinc-600">Cargando…</div>;

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      {/* Datos básicos */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="block text-sm">Nombre completo *</label>
          <input
            value={f.name}
            onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))}
            className="w-full rounded-md border p-2"
            placeholder="Tu nombre"
          />
          <p className="text-xs text-zinc-500 mt-1">
            (Por ahora solo lectura: el nombre se muestra aquí pero no se
            actualiza desde este formulario)
          </p>
        </div>

        <div className="md:col-span-2">
          <LockEmailNote />
          <label className="block text-sm mt-2">Email</label>
          <input
            value={f.email}
            readOnly
            className="w-full rounded-md border p-2 glass-card p-4 md:p-6"
          />
        </div>

        <div>
          <label className="block text-sm">Teléfono</label>
          <input
            value={f.phone}
            onChange={(e) => setF((s) => ({ ...s, phone: e.target.value }))}
            className="w-full rounded-md border p-2"
          />
        </div>
        <div>
          <label className="block text-sm">Ubicación</label>
          <input
            value={f.location}
            onChange={(e) => setF((s) => ({ ...s, location: e.target.value }))}
            className="w-full rounded-md border p-2"
          />
        </div>
        <div>
          <label className="block text-sm">Nacimiento (YYYY-MM-DD)</label>
          <input
            type="date"
            value={f.birthdate}
            onChange={(e) =>
              setF((s) => ({ ...s, birthdate: e.target.value }))
            }
            className="w-full rounded-md border p-2"
          />
        </div>
        <div>
          <label className="block text-sm">LinkedIn</label>
          <input
            value={f.linkedin}
            onChange={(e) =>
              setF((s) => ({ ...s, linkedin: e.target.value }))
            }
            className="w-full rounded-md border p-2"
            placeholder="linkedin.com/in/usuario"
          />
        </div>
        <div>
          <label className="block text-sm">GitHub</label>
          <input
            value={f.github}
            onChange={(e) => setF((s) => ({ ...s, github: e.target.value }))}
            className="w-full rounded-md border p-2"
            placeholder="github.com/usuario"
          />
        </div>
      </div>

      {/* Experiencia laboral */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Experiencia laboral</h2>
          <button
            type="button"
            onClick={addExperience}
            className="rounded-md border px-3 py-1.5 hover:bg-gray-50"
          >
            + Agregar experiencia
          </button>
        </div>

        <div className="space-y-6">
          {f.experiences.length === 0 && (
            <p className="text-sm text-neutral-500">
              Aún no agregas experiencia.
            </p>
          )}

          {f.experiences.map((exp, idx) => (
            <div key={idx} className="rounded-xl border border-neutral-200 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm text-neutral-600">
                    Puesto
                  </label>
                  <input
                    value={exp.role}
                    onChange={(e) => updateExp(idx, "role", e.target.value)}
                    className="w-full rounded-md border border-neutral-300 p-2"
                    placeholder="Ej. Desarrollador Frontend"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-600">
                    Empresa
                  </label>
                  <input
                    value={exp.company}
                    onChange={(e) => updateExp(idx, "company", e.target.value)}
                    className="w-full rounded-md border border-neutral-300 p-2"
                    placeholder="Empresa S.A. de C.V."
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-600">
                    Inicio
                  </label>
                  <input
                    type="month"
                    value={exp.startDate}
                    onChange={(e) =>
                      updateExp(idx, "startDate", ensureMonth(e.target.value))
                    }
                    className="w-full rounded-md border border-neutral-300 p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-600">Fin</label>
                  <input
                    type="month"
                    value={exp.isCurrent ? "" : exp.endDate}
                    disabled={exp.isCurrent}
                    onChange={(e) =>
                      updateExp(idx, "endDate", ensureMonth(e.target.value))
                    }
                    className="w-full rounded-md border border-neutral-300 p-2 disabled:glass-card p-4 md:p-6"
                  />
                </div>
                <div className="sm:col-span-2 flex items-center gap-2">
                  <input
                    id={`current-${idx}`}
                    type="checkbox"
                    checked={exp.isCurrent}
                    onChange={(e) =>
                      updateExp(idx, "isCurrent", e.target.checked)
                    }
                  />
                  <label
                    htmlFor={`current-${idx}`}
                    className="text-sm select-none"
                  >
                    Actualmente aquí
                  </label>
                </div>
              </div>

              <div className="mt-3 text-right">
                <button
                  type="button"
                  onClick={() => removeExperience(idx)}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-red-600 hover:bg-red-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-emerald-600 text-white px-4 py-2 hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
