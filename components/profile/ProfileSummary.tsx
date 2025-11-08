"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Pencil } from "lucide-react";
import DownloadPdfButton from "@/components/resume/DownloadPdfButton";

type Profile = {
  personal: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    birthDate: string;
    linkedin: string;
    github: string;
  };
  about: string;
  education: Array<{
    institution: string;
    program: string;
    level: string | null;
    status: "ONGOING" | "COMPLETED" | "INCOMPLETE" | string | null;
    startDate: string;
    endDate: string;
  }>;
  experience: Array<{
    company: string;
    role: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    description?: string | null;
  }>;
  skills: Array<{ name: string; level: number | null }>;
  languages: Array<{ name: string; level: string }>;
  certifications: Array<{
    name: string;
    issuer: string | null;
    date: string;
    url: string | null;
  }>;
};

function safeLink(u?: string | null) {
  const v = (u || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

function fmtISOToMonthYear(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", { year: "numeric", month: "short" }).replace(".", "");
}

function fmtISOToDMY(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default function ProfileSummary() {
  const [data, setData] = useState<Profile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch("/api/profile", { signal: ac.signal });
        if (r.status === 401) {
          setErr("Necesitas iniciar sesión para ver tu perfil.");
          return;
        }
        if (!r.ok) throw new Error("No se pudo cargar el perfil");
        const j = (await r.json()) as Profile;
        setData(j);
      } catch (e: any) {
        if (e?.name !== "AbortError") setErr(e?.message || "Error al cargar");
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 rounded-md bg-zinc-200/60 dark:bg-zinc-700/50" />
          <div className="h-5 w-1/4 rounded-md bg-zinc-200/60 dark:bg-zinc-700/50" />
          <div className="h-24 w-full rounded-md bg-zinc-200/60 dark:bg-zinc-700/50" />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <main className="max-w-3xl mx-auto py-8 px-4">
        <div className="rounded-xl border border-red-200/60 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200 p-4">
          {err}
        </div>
        <div className="mt-3">
          <Link
            href="/signin?callbackUrl=/profile/summary"
            className="text-sm text-blue-600 dark:text-blue-400 underline"
          >
            Iniciar sesión
          </Link>
        </div>
      </main>
    );
  }

  if (!data) return null;

  const p = data.personal;

  const totalYears = useMemo(() => {
    try {
      const ranges = data.experience.map((e) => {
        const s = e.startDate ? new Date(e.startDate) : null;
        const t = e.isCurrent || !e.endDate ? new Date() : new Date(e.endDate);
        if (!s || Number.isNaN(s.getTime()) || Number.isNaN(t.getTime())) return 0;
        const ms = Math.max(0, t.getTime() - s.getTime());
        return ms / (1000 * 60 * 60 * 24 * 365.25);
      });
      const sum = ranges.reduce((a, b) => a + b, 0);
      return Math.round(sum * 10) / 10;
    } catch {
      return null;
    }
  }, [data.experience]);

  return (
    <main className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {p.fullName || "Tu perfil"}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{p.email}</p>
          {typeof totalYears === "number" && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              ~{totalYears} años de experiencia total
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/profile/edit" className="btn-ghost">
            <Pencil className="w-4 h-4" />
            Editar perfil
          </Link>

          <DownloadPdfButton className="btn btn-primary">
            <Download className="w-4 h-4" />
            Descargar PDF
          </DownloadPdfButton>
        </div>
      </div>

      {/* Contacto */}
      <section className="border rounded-2xl glass-card p-4 md:p-6">
        <h2 className="font-semibold text-lg mb-3 text-zinc-800 dark:text-zinc-100">Contacto</h2>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          <p className="text-zinc-700 dark:text-zinc-200">
            <strong className="text-zinc-800 dark:text-zinc-100">Teléfono:</strong> {p.phone || "—"}
          </p>
          <p className="text-zinc-700 dark:text-zinc-200">
            <strong className="text-zinc-800 dark:text-zinc-100">Ubicación:</strong> {p.location || "—"}
          </p>
          <p className="text-zinc-700 dark:text-zinc-200">
            <strong className="text-zinc-800 dark:text-zinc-100">Fecha de nacimiento:</strong>{" "}
            {fmtISOToDMY(p.birthDate) || "—"}
          </p>
          <p className="text-zinc-700 dark:text-zinc-200">
            <strong className="text-zinc-800 dark:text-zinc-100">LinkedIn:</strong>{" "}
            {p.linkedin ? (
              <a href={safeLink(p.linkedin)} target="_blank" className="text-blue-600 dark:text-blue-400 underline">
                {p.linkedin}
              </a>
            ) : "—"}
          </p>
          <p className="text-zinc-700 dark:text-zinc-200">
            <strong className="text-zinc-800 dark:text-zinc-100">GitHub:</strong>{" "}
            {p.github ? (
              <a href={safeLink(p.github)} target="_blank" className="text-blue-600 dark:text-blue-400 underline">
                {p.github}
              </a>
            ) : "—"}
          </p>
        </div>
      </section>

      {/* Resumen */}
      {data.about && (
        <section className="border rounded-2xl glass-card p-4 md:p-6">
          <h2 className="font-semibold text-lg mb-2 text-zinc-800 dark:text-zinc-100">Resumen</h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-line">
            {data.about}
          </p>
        </section>
      )}

      {/* Experiencia */}
      {data.experience?.length > 0 && (
        <section className="border rounded-2xl glass-card p-4 md:p-6">
          <h2 className="font-semibold text-lg mb-2 text-zinc-800 dark:text-zinc-100">Experiencia</h2>
          <ul className="space-y-2 text-sm">
            {data.experience.map((exp, i) => (
              <li key={i} className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <p className="font-medium text-zinc-800 dark:text-zinc-100">{exp.role}</p>
                <p className="text-zinc-600 dark:text-zinc-300">{exp.company}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {fmtISOToMonthYear(exp.startDate)} — {exp.isCurrent ? "Actual" : fmtISOToMonthYear(exp.endDate) || "—"}
                </p>
                {(exp as any).description ? (
                  <p className="mt-1 text-zinc-700 dark:text-zinc-200 whitespace-pre-line">
                    {(exp as any).description}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Educación */}
      {data.education?.length > 0 && (
        <section className="border rounded-2xl glass-card p-4 md:p-6">
          <h2 className="font-semibold text-lg mb-2 text-zinc-800 dark:text-zinc-100">Educación</h2>
          <ul className="space-y-2 text-sm">
            {data.education.map((ed, i) => (
              <li key={i} className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <p className="font-medium text-zinc-800 dark:text-zinc-100">
                  {ed.program || ed.level || "—"}
                </p>
                <p className="text-zinc-600 dark:text-zinc-300">{ed.institution}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {fmtISOToMonthYear(ed.startDate)} — {ed.status === "ONGOING" ? "En curso" : fmtISOToMonthYear(ed.endDate) || "—"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Skills */}
      {data.skills?.length > 0 && (
        <section className="border rounded-2xl glass-card p-4 md:p-6">
          <h2 className="font-semibold text-lg mb-3 text-zinc-800 dark:text-zinc-100">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {data.skills.map((s, i) => (
              <span key={i} className="badge" title={s.level ? `Nivel: ${s.level}/5` : undefined}>
                {s.name}
                {s.level != null && <span className="ml-1 text-xs opacity-70">({s.level}/5)</span>}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Idiomas */}
      {data.languages?.length > 0 && (
        <section className="border rounded-2xl glass-card p-4 md:p-6">
          <h2 className="font-semibold text-lg mb-3 text-zinc-800 dark:text-zinc-100">Idiomas</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {data.languages.map((l, i) => (
              <li key={i} className="badge">
                {l.name} — {l.level}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Certificaciones */}
      {data.certifications?.length > 0 && (
        <section className="border rounded-2xl glass-card p-4 md:p-6">
          <h2 className="font-semibold text-lg mb-3 text-zinc-800 dark:text-zinc-100">Certificaciones</h2>
          <ul className="space-y-1 text-sm">
            {data.certifications.map((c, i) => (
              <li key={i} className="text-zinc-800 dark:text-zinc-100">
                {c.url ? (
                  <a href={safeLink(c.url)} target="_blank" className="text-blue-600 dark:text-blue-400 underline">
                    {c.name}
                  </a>
                ) : (
                  c.name
                )}
                {c.issuer ? ` · ${c.issuer}` : ""}
                {c.date ? ` (${fmtISOToMonthYear(c.date)})` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
