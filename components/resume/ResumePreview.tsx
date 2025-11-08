// components/resume/ResumePreview.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Profile = {
  personal: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    birthDate: string; // ISO yyyy-mm-dd o ""
    linkedin: string;
    github: string;
  };
  about: string;
  education: Array<{
    institution: string;
    program: string;
    level: string | null;
    status: "ONGOING" | "COMPLETED" | "INCOMPLETE" | string | null;
    startDate: string; // ISO yyyy-mm-dd o ""
    endDate: string;   // ISO yyyy-mm-dd o ""
  }>;
  experience: Array<{
    company: string;
    role: string;
    startDate: string; // ISO yyyy-mm-dd o ""
    endDate: string;   // ISO yyyy-mm-dd o ""
    isCurrent: boolean;
  }>;
  skills: Array<{ name: string; level: number | null }>;
  languages: Array<{ name: string; level: string }>;
  certifications: Array<{
    name: string;
    issuer: string | null;
    date: string; // ISO yyyy-mm-dd o ""
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

type Props = {
  /** Opcional: si lo pasas, no hace fetch. Si no, hace GET /api/profile */
  profile?: Profile | null;
  /** Ancho en pantalla para la previsualización (ej. "w-[900px]"). Por defecto A4 ~ 794px */
  widthClassName?: string;
};

export default function ResumePreview({ profile, widthClassName }: Props) {
  const [data, setData] = useState<Profile | null>(profile ?? null);
  const [loading, setLoading] = useState(!profile);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (profile) return;
    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch("/api/profile", { signal: ac.signal });
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
  }, [profile]);

  const totalYears = useMemo(() => {
    if (!data) return null;
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
  }, [data]);

  if (loading) {
    return (
      <div className="w-full flex justify-center">
        <div className="animate-pulse w-[794px] max-w-full glass-card p-4 md:p-6">
          <div className="h-7 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-24 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }
  if (err) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 p-4">
        {err}
      </div>
    );
  }
  if (!data) return null;

  const p = data.personal;

  return (
    <div className="w-full flex justify-center">
      {/* Lienzo A4 aproximado (794px ~ 210mm a 96dpi). En impresión, Tailwind no afecta, pero sirve para vista previa */}
      <article
        className={`glass-card p-4 md:p-6"w-[794px]"} max-w-full`}
      >
        {/* Encabezado */}
        <header className="border-b pb-4 mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">{p.fullName || "Tu nombre"}</h1>
          <div className="mt-2 text-sm text-zinc-700 flex flex-wrap gap-x-3 gap-y-1">
            {p.email && <span>{p.email}</span>}
            {p.phone && (
              <>
                <span className="text-zinc-400">•</span>
                <span>{p.phone}</span>
              </>
            )}
            {p.location && (
              <>
                <span className="text-zinc-400">•</span>
                <span>{p.location}</span>
              </>
            )}
            {p.linkedin && (
              <>
                <span className="text-zinc-400">•</span>
                <a className="underline" href={safeLink(p.linkedin)} target="_blank">
                  LinkedIn
                </a>
              </>
            )}
            {p.github && (
              <>
                <span className="text-zinc-400">•</span>
                <a className="underline" href={safeLink(p.github)} target="_blank">
                  GitHub
                </a>
              </>
            )}
          </div>
          {p.birthDate && (
            <p className="mt-1 text-xs text-zinc-500">
              Nacimiento: {fmtISOToDMY(p.birthDate)}
            </p>
          )}
          {typeof totalYears === "number" && (
            <p className="mt-1 text-xs text-zinc-500">
              ~{totalYears} años de experiencia total
            </p>
          )}
        </header>

        {/* Resumen / About */}
        {data.about && (
          <section className="mb-6">
            <h2 className="text-base font-semibold uppercase tracking-wide text-zinc-700">
              Resumen
            </h2>
            <p className="mt-2 text-sm text-zinc-800 whitespace-pre-line leading-6">
              {data.about}
            </p>
          </section>
        )}

        {/* Experiencia */}
        {data.experience?.length > 0 && (
          <section className="mb-6">
            <h2 className="text-base font-semibold uppercase tracking-wide text-zinc-700">
              Experiencia
            </h2>
            <ul className="mt-2 space-y-3">
              {data.experience.map((exp, i) => (
                <li key={i} className="text-sm">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium">{exp.role}</span>
                    <span className="text-zinc-600">· {exp.company}</span>
                    <span className="ml-auto text-xs text-zinc-500">
                      {fmtISOToMonthYear(exp.startDate)} —{" "}
                      {exp.isCurrent ? "Actual" : fmtISOToMonthYear(exp.endDate) || "—"}
                    </span>
                  </div>
                  {/* Si más adelante agregas "description" solo para builder (no DB), podrías inyectarla aquí */}
                  {/* <p className="mt-1 text-zinc-700">• Logro destacado...</p> */}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Educación */}
        {data.education?.length > 0 && (
          <section className="mb-6">
            <h2 className="text-base font-semibold uppercase tracking-wide text-zinc-700">
              Educación
            </h2>
            <ul className="mt-2 space-y-2">
              {data.education.map((ed, i) => (
                <li key={i} className="text-sm">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium">
                      {ed.program || ed.level || "—"}
                    </span>
                    <span className="text-zinc-600">· {ed.institution}</span>
                    <span className="ml-auto text-xs text-zinc-500">
                      {fmtISOToMonthYear(ed.startDate)} —{" "}
                      {ed.status === "ONGOING"
                        ? "En curso"
                        : fmtISOToMonthYear(ed.endDate) || "—"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Skills */}
        {data.skills?.length > 0 && (
          <section className="mb-6">
            <h2 className="text-base font-semibold uppercase tracking-wide text-zinc-700">
              Skills
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {data.skills.map((s, i) => (
                <span
                  key={i}
                  className="text-xs border rounded-full px-3 py-1 bg-gray-50 text-zinc-700"
                  title={s.level ? `Nivel: ${s.level}/5` : undefined}
                >
                  {s.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Idiomas */}
        {data.languages?.length > 0 && (
          <section className="mb-6">
            <h2 className="text-base font-semibold uppercase tracking-wide text-zinc-700">
              Idiomas
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {data.languages.map((l, i) => (
                <li key={i} className="border rounded-full px-3 py-1 bg-gray-50">
                  {l.name} — {l.level}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Certificaciones */}
        {data.certifications?.length > 0 && (
          <section className="mb-2">
            <h2 className="text-base font-semibold uppercase tracking-wide text-zinc-700">
              Certificaciones
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              {data.certifications.map((c, i) => (
                <li key={i}>
                  {c.url ? (
                    <a
                      href={safeLink(c.url)}
                      target="_blank"
                      className="text-blue-600 underline"
                    >
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
      </article>
    </div>
  );
}
