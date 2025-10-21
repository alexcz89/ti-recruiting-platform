"use client";

import * as React from "react";
import clsx from "clsx";
import { useRouter } from "next/navigation";

/** =========================
 *  Tipos
 *  ========================= */
type ResumeData = {
  basics: {
    firstName: string;
    lastName: string;
    headline?: string;
    email?: string;
    phone?: string;
    location?: string;
    website?: string;
    linkedin?: string;
    github?: string;
  };
  summary?: string;
  experience: Array<{
    company: string;
    role: string;
    start?: string | null; // YYYY-MM
    end?: string | null;   // YYYY-MM | "Actual"
    location?: string | null;
    achievements?: string[];
  }>;
  education: Array<{
    school: string;
    degree?: string | null;
    field?: string | null;
    start?: string | null;
    end?: string | null;
  }>;
  skills: string[];
  certs: string[];
  projects: Array<{
    name: string;
    link?: string | null;
    summary?: string | null;
    highlights?: string[];
  }>;
};

type UserProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  headline?: string | null;
  phone?: string | null;
  location?: string | null;
  website?: string | null;
  linkedin?: string | null;
  github?: string | null;
  skills?: string[];
  summary?: string | null;
  experience?: ResumeData["experience"];
  education?: ResumeData["education"];
  projects?: ResumeData["projects"];
  certs?: string[];
};

const EMPTY: ResumeData = {
  basics: {
    firstName: "",
    lastName: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    website: "",
    linkedin: "",
    github: "",
  },
  summary: "",
  experience: [],
  education: [],
  skills: [],
  certs: [],
  projects: [],
};

const LSK = "bolsati.resume.builder.v1";

/** =========================
 *  Helpers UI
 *  ========================= */
function Section({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <section className="rounded-xl border p-4 space-y-3">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </section>
  );
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const { label, className, ...rest } = props;
  return (
    <label className="grid gap-1 text-sm">
      {label && <span>{label}</span>}
      <input {...rest} className={clsx("rounded-md border p-2", className)} />
    </label>
  );
}
function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const { label, className, ...rest } = props;
  return (
    <label className="grid gap-1 text-sm">
      {label && <span>{label}</span>}
      <textarea {...rest} className={clsx("rounded-md border p-2", className)} />
    </label>
  );
}
function Month({ value, onChange }: { value?: string | null; onChange: (v: string) => void }) {
  return <input type="month" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="rounded-md border p-2" />;
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[11px]">{children}</span>;
}

/** =========================
 *  Preview limpio (ATS-friendly)
 *  ========================= */
function Preview({ data }: { data: ResumeData }) {
  const b = data.basics;
  return (
    <div className="rounded-xl border bg-white p-5 text-sm leading-relaxed">
      <div className="border-b pb-2">
        <h1 className="text-2xl font-bold">{b.firstName} {b.lastName}</h1>
        {b.headline && <p className="text-zinc-600">{b.headline}</p>}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600">
          {b.email && <span>{b.email}</span>}
          {b.phone && <span>{b.phone}</span>}
          {b.location && <span>{b.location}</span>}
          {b.website && <span>{b.website}</span>}
          {b.linkedin && <span>LinkedIn: {b.linkedin}</span>}
          {b.github && <span>GitHub: {b.github}</span>}
        </div>
      </div>

      {data.summary && (
        <div className="mt-3">
          <h2 className="font-semibold text-[13px]">Resumen</h2>
          <p className="text-zinc-700 whitespace-pre-wrap">{data.summary}</p>
        </div>
      )}

      {!!data.experience.length && (
        <div className="mt-3">
          <h2 className="font-semibold text-[13px]">Experiencia</h2>
          <div className="space-y-2">
            {data.experience.map((x, i) => (
              <div key={i}>
                <div className="font-medium">{x.role} — {x.company}</div>
                <div className="text-xs text-zinc-500">
                  {(x.start || "—")} – {(x.end || "Actual")} {x.location ? `· ${x.location}` : ""}
                </div>
                {!!x.achievements?.length && (
                  <ul className="list-disc ml-5 text-zinc-700">
                    {x.achievements!.map((a, j) => <li key={j}>{a}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!!data.education.length && (
        <div className="mt-3">
          <h2 className="font-semibold text-[13px]">Educación</h2>
          <div className="space-y-1.5">
            {data.education.map((e, i) => (
              <div key={i}>
                <div className="font-medium">{e.school}</div>
                <div className="text-xs text-zinc-600">
                  {[e.degree, e.field].filter(Boolean).join(" · ")} {e.start || e.end ? `— ${(e.start || "—")} – ${(e.end || "Actual")}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(data.skills.length || data.certs.length) && (
        <div className="mt-3 flex flex-wrap gap-6">
          {!!data.skills.length && (
            <div>
              <h2 className="font-semibold text-[13px]">Skills</h2>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {data.skills.map((s) => <Chip key={s}>{s}</Chip>)}
              </div>
            </div>
          )}
          {!!data.certs.length && (
            <div>
              <h2 className="font-semibold text-[13px]">Certificaciones</h2>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {data.certs.map((c) => <Chip key={c}>{c}</Chip>)}
              </div>
            </div>
          )}
        </div>
      )}

      {!!data.projects.length && (
        <div className="mt-3">
          <h2 className="font-semibold text-[13px]">Proyectos</h2>
          <div className="space-y-1.5">
            {data.projects.map((p, i) => (
              <div key={i}>
                <div className="font-medium">
                  {p.name} {p.link && <span className="text-xs text-zinc-500">({p.link})</span>}
                </div>
                {p.summary && <p className="text-zinc-700">{p.summary}</p>}
                {!!p.highlights?.length && (
                  <ul className="list-disc ml-5 text-zinc-700">
                    {p.highlights!.map((h, j) => <li key={j}>{h}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** =========================
 *  TagEditor (Enter / pegar columnas)
 *  ========================= */
function TagEditor({
  items, onChange, placeholder,
}: { items: string[]; onChange: (items: string[]) => void; placeholder?: string; }) {
  const [q, setQ] = React.useState("");
  function add(val: string) {
    const n = val.trim();
    if (!n) return;
    if (items.some((x) => x.toLowerCase() === n.toLowerCase())) return;
    onChange([...items, n]);
    setQ("");
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <span key={it} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs">
            {it}
            <button className="text-red-600" onClick={() => onChange(items.filter((x) => x !== it))}>×</button>
          </span>
        ))}
      </div>
      <input
        className="mt-2 w-full rounded-md border p-2 text-sm"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); add(q); } }}
        onPaste={(e) => {
          const raw = e.clipboardData.getData("text");
          if (!raw.includes("\n")) return;
          e.preventDefault();
          const lines = Array.from(new Set(raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)));
          onChange([...items, ...lines.filter((l) => !items.includes(l))]);
          setQ("");
        }}
      />
    </div>
  );
}

/** =========================
 *  Página pública
 *  ========================= */
export default function PublicResumeBuilderPage() {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [data, setData] = React.useState<ResumeData>(EMPTY);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [isAuthed, setIsAuthed] = React.useState(false); // cambia según tu auth
  const [showSignup, setShowSignup] = React.useState(false);

  // Prefill: si usuario logueado -> /api/me; si no -> localStorage
  React.useEffect(() => {
    (async () => {
      try {
        // Detecta sesión (ajusta tu endpoint)
        const ses = await fetch("/api/session", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
        const authed = Boolean(ses?.user);
        setIsAuthed(authed);

        if (authed) {
          const meRes = await fetch("/api/me", { cache: "no-store" });
          if (meRes.ok) {
            const me: UserProfile = await meRes.json();
            setData((d) => ({
              ...d,
              basics: {
                firstName: me.firstName || "",
                lastName: me.lastName || "",
                headline: me.headline || "",
                email: me.email || "",
                phone: me.phone || "",
                location: me.location || "",
                website: me.website || "",
                linkedin: me.linkedin || "",
                github: me.github || "",
              },
              summary: me.summary || "",
              skills: me.skills || [],
              certs: me.certs || [],
              experience: me.experience || [],
              education: me.education || [],
              projects: me.projects || [],
            }));
          }
        } else {
          const cached = localStorage.getItem(LSK);
          if (cached) setData(JSON.parse(cached));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Autosave para invitados
  React.useEffect(() => {
    if (!isAuthed) localStorage.setItem(LSK, JSON.stringify(data));
  }, [data, isAuthed]);

  // Mutadores básicos
  const setBasics = <K extends keyof ResumeData["basics"]>(k: K, v: ResumeData["basics"][K]) =>
    setData((d) => ({ ...d, basics: { ...d.basics, [k]: v } }));

  const push = <T,>(arr: T[], item: T) => [...arr, item];
  const removeAt = <T,>(arr: T[], idx: number) => arr.filter((_, i) => i !== idx);
  const updateAt = <T,>(arr: T[], idx: number, patch: Partial<T>) =>
    arr.map((it, i) => (i === idx ? { ...it, ...patch } : it));

  async function handleSaveToAccount() {
    // Si no está autenticado, mostramos CTA
    if (!isAuthed) {
      setShowSignup(true);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "CV creado con el Builder", payload: data }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.error || "No se pudo guardar");
      localStorage.removeItem(LSK);
      router.push(`/candidate/resume/${out.id}`); // o /perfil si prefieres
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="max-w-5xl mx-auto p-6 text-sm text-zinc-600">Cargando…</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 grid lg:grid-cols-[1fr_420px] gap-6">
      {/* Hero (para atraer) */}
      <header className="lg:col-span-2">
        <h1 className="text-2xl md:text-3xl font-bold">Crea un CV limpio y profesional</h1>
        <p className="text-zinc-600 mt-1">
          Sin registro obligatorio. Completa tu CV en minutos y descárgalo — si quieres guardarlo y postularte en un
          click, crea tu cuenta gratis.
        </p>
      </header>

      {/* Formulario (wizard) */}
      <div className="space-y-6">
        <ol className="flex items-center gap-2 text-xs">
          {["Perfil", "Resumen", "Experiencia", "Educación", "Skills", "Proyectos", "Listo"].map((label, i) => (
            <li key={label} className={clsx("px-2 py-1 rounded-full", i + 1 <= step ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-700")}>
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        {/* Paso 1: Perfil */}
        {step === 1 && (
          <Section title="1) Perfil">
            <div className="grid md:grid-cols-2 gap-3">
              <Input label="Nombre" value={data.basics.firstName} onChange={(e) => setBasics("firstName", e.target.value)} />
              <Input label="Apellido" value={data.basics.lastName} onChange={(e) => setBasics("lastName", e.target.value)} />
              <Input label="Headline (ej. Backend Engineer)" value={data.basics.headline} onChange={(e) => setBasics("headline", e.target.value)} className="md:col-span-2" />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Input label="Email" value={data.basics.email} onChange={(e) => setBasics("email", e.target.value)} />
              <Input label="Teléfono" value={data.basics.phone} onChange={(e) => setBasics("phone", e.target.value)} />
              <Input label="Ubicación" value={data.basics.location} onChange={(e) => setBasics("location", e.target.value)} />
              <Input label="Website" value={data.basics.website} onChange={(e) => setBasics("website", e.target.value)} />
              <Input label="LinkedIn" value={data.basics.linkedin} onChange={(e) => setBasics("linkedin", e.target.value)} />
              <Input label="GitHub" value={data.basics.github} onChange={(e) => setBasics("github", e.target.value)} />
            </div>
            <div className="flex justify-end"><button className="rounded-md bg-emerald-600 px-4 py-2 text-white" onClick={() => setStep(2)}>Siguiente</button></div>
          </Section>
        )}

        {/* Paso 2: Resumen */}
        {step === 2 && (
          <Section title="2) Resumen">
            <Textarea
              label="Resumen profesional (3–5 líneas)"
              value={data.summary}
              onChange={(e) => setData((d) => ({ ...d, summary: e.target.value }))}
              rows={6}
              placeholder="Cuenta tu impacto, stack y logros clave…"
            />
            <div className="flex justify-between">
              <button className="rounded-md border px-4 py-2" onClick={() => setStep(1)}>Atrás</button>
              <button className="rounded-md bg-emerald-600 px-4 py-2 text-white" onClick={() => setStep(3)}>Siguiente</button>
            </div>
          </Section>
        )}

        {/* Paso 3: Experiencia */}
        {step === 3 && (
          <Section title="3) Experiencia">
            <div className="space-y-3">
              {data.experience.map((x, i) => (
                <div key={i} className="rounded-md border p-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <Input label="Empresa" value={x.company} onChange={(e) => setData((d) => ({ ...d, experience: updateAt(d.experience, i, { company: e.target.value }) }))} />
                    <Input label="Rol" value={x.role} onChange={(e) => setData((d) => ({ ...d, experience: updateAt(d.experience, i, { role: e.target.value }) }))} />
                    <Input label="Ubicación" value={x.location || ""} onChange={(e) => setData((d) => ({ ...d, experience: updateAt(d.experience, i, { location: e.target.value }) }))} />
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs">Inicio</label>
                      <label className="text-xs">Fin</label>
                      <Month value={x.start} onChange={(v) => setData((d) => ({ ...d, experience: updateAt(d.experience, i, { start: v }) }))} />
                      <div className="flex items-center gap-2">
                        <Month value={x.end} onChange={(v) => setData((d) => ({ ...d, experience: updateAt(d.experience, i, { end: v }) }))} />
                        <button className="text-xs rounded border px-2 py-1" onClick={() => setData((d) => ({ ...d, experience: updateAt(d.experience, i, { end: "Actual" }) }))}>Actual</button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2">
                    <label className="text-sm">Logros (bullets)</label>
                    <div className="space-y-1 mt-1">
                      {(x.achievements || []).map((a, j) => (
                        <div key={j} className="flex gap-2">
                          <input className="flex-1 rounded-md border p-2 text-sm" value={a}
                            onChange={(e) => setData((d) => {
                              const arr = [...(x.achievements || [])]; arr[j] = e.target.value;
                              return { ...d, experience: updateAt(d.experience, i, { achievements: arr }) };
                            })}
                          />
                          <button className="text-sm rounded border px-2"
                            onClick={() => setData((d) => {
                              const arr = [...(x.achievements || [])]; arr.splice(j, 1);
                              return { ...d, experience: updateAt(d.experience, i, { achievements: arr }) };
                            })}
                          >×</button>
                        </div>
                      ))}
                      <button className="text-xs rounded border px-2 py-1"
                        onClick={() => setData((d) => ({ ...d, experience: updateAt(d.experience, i, { achievements: [...(x.achievements || []), ""] }) }))}>
                        + Agregar bullet
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex justify-end gap-2">
                    <button className="text-xs rounded border px-2 py-1" onClick={() => setData((d) => ({ ...d, experience: push(d.experience, { ...x }) }))}>Duplicar</button>
                    <button className="text-xs rounded border px-2 py-1 text-red-600" onClick={() => setData((d) => ({ ...d, experience: removeAt(d.experience, i) }))}>Eliminar</button>
                  </div>
                </div>
              ))}
              <button className="rounded-md border px-3 py-2 text-sm"
                onClick={() => setData((d) => ({ ...d, experience: push(d.experience, { company: "", role: "", start: "", end: "", location: "", achievements: [] }) }))}>
                + Agregar experiencia
              </button>
            </div>

            <div className="flex justify-between mt-3">
              <button className="rounded-md border px-4 py-2" onClick={() => setStep(2)}>Atrás</button>
              <button className="rounded-md bg-emerald-600 px-4 py-2 text-white" onClick={() => setStep(4)}>Siguiente</button>
            </div>
          </Section>
        )}

        {/* Paso 4: Educación */}
        {step === 4 && (
          <Section title="4) Educación">
            <div className="space-y-3">
              {data.education.map((e, i) => (
                <div key={i} className="rounded-md border p-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <Input label="Institución" value={e.school} onChange={(ev) => setData((d) => ({ ...d, education: updateAt(d.education, i, { school: ev.target.value }) }))} />
                    <Input label="Grado" value={e.degree || ""} onChange={(ev) => setData((d) => ({ ...d, education: updateAt(d.education, i, { degree: ev.target.value }) }))} />
                    <Input label="Área / Carrera" value={e.field || ""} onChange={(ev) => setData((d) => ({ ...d, education: updateAt(d.education, i, { field: ev.target.value }) }))} />
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs">Inicio</label>
                      <label className="text-xs">Fin</label>
                      <Month value={e.start} onChange={(v) => setData((d) => ({ ...d, education: updateAt(d.education, i, { start: v }) }))} />
                      <Month value={e.end} onChange={(v) => setData((d) => ({ ...d, education: updateAt(d.education, i, { end: v }) }))} />
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end gap-2">
                    <button className="text-xs rounded border px-2 py-1" onClick={() => setData((d) => ({ ...d, education: push(d.education, { ...e }) }))}>Duplicar</button>
                    <button className="text-xs rounded border px-2 py-1 text-red-600" onClick={() => setData((d) => ({ ...d, education: removeAt(d.education, i) }))}>Eliminar</button>
                  </div>
                </div>
              ))}
              <button className="rounded-md border px-3 py-2 text-sm"
                onClick={() => setData((d) => ({ ...d, education: push(d.education, { school: "", degree: "", field: "", start: "", end: "" }) }))}>
                + Agregar formación
              </button>
            </div>
            <div className="flex justify-between mt-3">
              <button className="rounded-md border px-4 py-2" onClick={() => setStep(3)}>Atrás</button>
              <button className="rounded-md bg-emerald-600 px-4 py-2 text-white" onClick={() => setStep(5)}>Siguiente</button>
            </div>
          </Section>
        )}

        {/* Paso 5: Skills / Certs */}
        {step === 5 && (
          <Section title="5) Skills y Certificaciones">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm">Skills (Enter para agregar / pega una columna)</label>
                <TagEditor items={data.skills} onChange={(items) => setData((d) => ({ ...d, skills: items }))} placeholder="Ej. Python, React, AWS…" />
              </div>
              <div>
                <label className="text-sm">Certificaciones</label>
                <TagEditor items={data.certs} onChange={(items) => setData((d) => ({ ...d, certs: items }))} placeholder="Ej. AWS SAA, CCNA…" />
              </div>
            </div>
            <div className="flex justify-between mt-3">
              <button className="rounded-md border px-4 py-2" onClick={() => setStep(4)}>Atrás</button>
              <button className="rounded-md bg-emerald-600 px-4 py-2 text-white" onClick={() => setStep(6)}>Siguiente</button>
            </div>
          </Section>
        )}

        {/* Paso 6: Proyectos */}
        {step === 6 && (
          <Section title="6) Proyectos">
            <div className="space-y-3">
              {data.projects.map((p, i) => (
                <div key={i} className="rounded-md border p-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <Input label="Nombre" value={p.name} onChange={(e) => setData((d) => ({ ...d, projects: updateAt(d.projects, i, { name: e.target.value }) }))} />
                    <Input label="Link" value={p.link || ""} onChange={(e) => setData((d) => ({ ...d, projects: updateAt(d.projects, i, { link: e.target.value }) }))} />
                  </div>
                  <Textarea label="Resumen" value={p.summary || ""} onChange={(e) => setData((d) => ({ ...d, projects: updateAt(d.projects, i, { summary: e.target.value }) }))} />
                  <div className="space-y-1">
                    <label className="text-sm">Highlights</label>
                    {(p.highlights || []).map((h, j) => (
                      <div key={j} className="flex gap-2">
                        <input className="flex-1 rounded-md border p-2 text-sm" value={h}
                          onChange={(e) => setData((d) => {
                            const arr = [...(p.highlights || [])]; arr[j] = e.target.value;
                            return { ...d, projects: updateAt(d.projects, i, { highlights: arr }) };
                          })}
                        />
                        <button className="text-sm rounded border px-2"
                          onClick={() => setData((d) => {
                            const arr = [...(p.highlights || [])]; arr.splice(j, 1);
                            return { ...d, projects: updateAt(d.projects, i, { highlights: arr }) };
                          })}
                        >×</button>
                      </div>
                    ))}
                    <button className="text-xs rounded border px-2 py-1"
                      onClick={() => setData((d) => ({ ...d, projects: updateAt(d.projects, i, { highlights: [...(p.highlights || []), ""] }) }))}>
                      + Agregar highlight
                    </button>
                  </div>
                  <div className="mt-2 flex justify-end gap-2">
                    <button className="text-xs rounded border px-2 py-1" onClick={() => setData((d) => ({ ...d, projects: push(d.projects, { ...p }) }))}>Duplicar</button>
                    <button className="text-xs rounded border px-2 py-1 text-red-600" onClick={() => setData((d) => ({ ...d, projects: removeAt(d.projects, i) }))}>Eliminar</button>
                  </div>
                </div>
              ))}
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setData((d) => ({ ...d, projects: push(d.projects, { name: "", link: "", summary: "", highlights: [] }) }))}>
                + Agregar proyecto
              </button>
            </div>
            <div className="flex justify-between mt-3">
              <button className="rounded-md border px-4 py-2" onClick={() => setStep(5)}>Atrás</button>
              <button className="rounded-md bg-emerald-600 px-4 py-2 text-white" onClick={() => setStep(7)}>Siguiente</button>
            </div>
          </Section>
        )}

        {/* Paso 7: Listo */}
        {step === 7 && (
          <Section title="¡Listo!">
            <p className="text-sm text-zinc-600">
              Ya puedes descargar tu CV. Si creas una cuenta gratis, lo guardamos y podrás postularte en 1 clic, duplicar
              versiones y generar PDF optimizado.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md border px-3 py-2 text-sm"
                onClick={() => {
                  const html = document.querySelector("#preview-wrap")?.innerHTML || "";
                  const blob = new Blob([html], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  window.open(url, "_blank");
                }}
              >
                Descargar (HTML)
              </button>
              <button
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                disabled={saving}
                onClick={handleSaveToAccount}
              >
                Guardar en mi cuenta
              </button>
              {!isAuthed && (
                <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setShowSignup(true)}>
                  Crear cuenta gratis
                </button>
              )}
            </div>
          </Section>
        )}
      </div>

      {/* Preview sticky */}
      <aside className="lg:sticky lg:top-4 h-fit" id="preview-wrap">
        <Preview data={data} />
      </aside>

      {/* Modal de registro suave */}
      {showSignup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-5 max-w-md w-full space-y-3">
            <h3 className="font-semibold">Crea tu cuenta gratis</h3>
            <p className="text-sm text-zinc-600">
              Guardaremos tu CV y podrás postularte a vacantes en 1 clic. Tu contenido ya se quedó en esta sesión.
            </p>
            <div className="flex gap-2">
              <a
                href={`/auth/register?next=${encodeURIComponent("/resume/builder")}`}
                className="rounded-md bg-emerald-600 px-4 py-2 text-white text-sm text-center flex-1"
              >
                Continuar
              </a>
              <button className="rounded-md border px-4 py-2 text-sm" onClick={() => setShowSignup(false)}>
                Ahora no
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
