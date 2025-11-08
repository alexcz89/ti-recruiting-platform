// components/cv/CvBuilder.tsx
"use client";
import { useMemo, useState } from "react";

/* ==================== Tipos ==================== */
type CvIdentity = {
  firstName: string; lastName1: string; lastName2: string;
  email: string; phone: string; location: string;
  linkedin: string; github: string; birthdate?: string; // YYYY-MM-DD
};
type CvExperience = {
  id?: string; role: string; company: string;
  startDate: string; endDate?: string | null; isCurrent?: boolean;
  bullets?: string[]; bulletsText?: string;
};
type CvEducation = {
  id?: string; institution: string; program?: string | null;
  startDate?: string | null; endDate?: string | null;
};
type CvSkill = { termId: string; label: string; level: 1|2|3|4|5 };
type CvLanguage = { termId: string; label: string; level: "NATIVE"|"PROFESSIONAL"|"CONVERSATIONAL"|"BASIC" };

type Props = {
  initial: {
    identity: CvIdentity;
    experiences: CvExperience[];
    education: CvEducation[];
    skills: CvSkill[];
    languages: CvLanguage[];
    certifications: string[];
  };
};

/* ==================== Utils ==================== */
const fmtMonthShort = (ym?: string | null) => {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  if (!y || !m) return ym;
  return `${m.padStart(2, "0")}/${y}`;
};
const parseYMDToLocal = (ymd?: string) => {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-");
  const yy = Number(y), mm = Number(m) - 1, dd = Number(d);
  if ([yy, mm, dd].some(Number.isNaN)) return null;
  return new Date(yy, mm, dd);
};
const joinName = (i: CvIdentity) => [i.firstName, i.lastName1, i.lastName2].filter(Boolean).join(" ");
const prettyBirth = (birth?: string) => {
  const d = parseYMDToLocal(birth);
  if (!d) return "";
  try { return d.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "2-digit" }); }
  catch { return birth || ""; }
};

// claves de orden (más reciente primero)
const roleSortKey = (e: CvExperience) => e.isCurrent
  ? `Z-9999-99-${e.startDate || ""}`
  : e.endDate ? `Y-${e.endDate}-${e.startDate || ""}` : `X-${e.startDate || ""}`;
const companySortKey = (roles: CvExperience[]) => {
  const sorted = [...roles].sort((a,b)=>roleSortKey(b).localeCompare(roleSortKey(a)));
  return roleSortKey(sorted[0]!);
};

/* ==================== UI helpers ==================== */
const labelCls = "text-[13px] font-medium text-zinc-700 mb-1.5";
const inputCls = "block w-full rounded-xl border border-zinc-200 glass-card p-4 md:p-6";

/* ==================== Componente ==================== */
export default function CvBuilder({ initial }: Props) {
  const [identity, setIdentity] = useState<CvIdentity>({ ...initial.identity, birthdate: initial.identity.birthdate || "" });
  const [experiences, setExperiences] = useState<CvExperience[]>(
    (initial.experiences || []).map(e => ({ ...e, bulletsText: (e.bullets?.join("\n")) || "" }))
  );
  const [education, setEducation] = useState<CvEducation[]>(initial.education || []);
  const [skills, setSkills] = useState<CvSkill[]>(initial.skills || []);
  const [languages, setLanguages] = useState<CvLanguage[]>(initial.languages || []);
  const [certifications, setCertifications] = useState<string[]>(initial.certifications || []);
  const [saving, setSaving] = useState(false);

  const fullName = useMemo(() => joinName(identity), [identity]);
  const handlePrint = () => window.print();

  // Editor -> preview
  const previewExperiences = experiences.map((e) => ({
    ...e,
    bullets: (e.bulletsText || "").split("\n").map(b => b.trim()).filter(Boolean),
  }));

  // Agrupar/ordenar por empresa y roles (reciente -> antiguo)
  const groupedByCompany = useMemo(() => {
    const map = new Map<string, CvExperience[]>();
    for (const e of previewExperiences) {
      const key = e.company || "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    for (const [company, arr] of map) {
      arr.sort((a,b)=>roleSortKey(b).localeCompare(roleSortKey(a)));
      map.set(company, arr);
    }
    const entries = Array.from(map.entries());
    entries.sort(([,a],[,b])=>companySortKey(b).localeCompare(companySortKey(a)));
    return entries;
  }, [previewExperiences]);

  const duplicateInSameCompany = (idx: number) => {
    const e = experiences[idx];
    const clone: CvExperience = { role:"", company:e.company, startDate:"", endDate:"", isCurrent:false, bulletsText:"" };
    setExperiences(prev => { const next = [...prev]; next.splice(idx+1,0,clone); return next; });
  };

  // ===== Guardar versión: confirma reemplazo si ya existe, genera PDF, sube y guarda URL =====
  const saveVersion = async () => {
    try {
      setSaving(true);

      // 1) ¿ya existe un resumeUrl?
      const existing = await fetch("/api/profile/resume", { cache: "no-store" })
        .then(r => r.ok ? r.json() : { resumeUrl: null }) as { resumeUrl?: string | null };

      if (existing?.resumeUrl) {
        const ok = window.confirm("Ya tienes un CV guardado en tu perfil.\n\n¿Quieres REEMPLAZAR el archivo actual?");
        if (!ok) { setSaving(false); return; }
      }

      // 2) Forzar render de la vista imprimible para capturarla
      document.body.setAttribute("data-exporting", "1");
      await new Promise(requestAnimationFrame);

      // 3) Capturar a PDF (solo el CV)
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf")
      ]);
      const el = document.querySelector(".cv-sheet") as HTMLElement | null;
      if (!el) throw new Error("No se encontró la hoja del CV para exportar.");
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgWmm = pageW;
      const imgHmm = (canvas.height / canvas.width) * imgWmm;
      const y = Math.max(0, (pageH - imgHmm) / 2);
      pdf.addImage(imgData, "JPEG", 0, y, imgWmm, imgHmm, undefined, "FAST");

      const blob = pdf.output("blob");
      const file = new File([blob], `CV-${fullName || "candidato"}.pdf`, { type: "application/pdf" });

      // 4) Subir al servidor
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/profile/upload-resume", { method: "POST", body: fd });
      if (!up.ok) throw new Error("No se pudo subir el archivo del CV.");
      const { url } = await up.json() as { url: string };
      if (!url) throw new Error("El servidor no regresó la URL del CV.");

      // 5) Guardar URL en perfil
      const save = await fetch("/api/profile/set-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeUrl: url }),
      });
      if (!save.ok) throw new Error("No se pudo actualizar tu perfil con la URL del CV.");

      alert(existing?.resumeUrl ? "CV reemplazado con éxito." : "CV agregado a tu perfil con éxito.");
    } catch (err:any) {
      console.error(err);
      alert(err?.message || "Hubo un problema al guardar el CV.");
    } finally {
      document.body.removeAttribute("data-exporting");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* ====== EDITOR (oculto en impresión) ====== */}
      <div className="print:hidden">
        {/* Barra superior: solo acciones */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
            onClick={saveVersion}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar versión"}
          </button>
          <button type="button" className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50" onClick={handlePrint}>
            Guardar como PDF (print)
          </button>
        </div>

        {/* Datos personales */}
        <section className="rounded-2xl border glass-card p-4 md:p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Datos personales</h2>
            <span className="text-xs text-zinc-500">Sesión: {identity.email || "—"}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><div className={labelCls}>Nombre(s)</div>
              <input className={inputCls} placeholder="Alejandro" value={identity.firstName} onChange={(e)=> setIdentity({...identity, firstName: e.target.value})}/>
            </div>
            <div><div className={labelCls}>Apellido paterno</div>
              <input className={inputCls} placeholder="Cerda" value={identity.lastName1} onChange={(e)=> setIdentity({...identity, lastName1: e.target.value})}/>
            </div>
            <div><div className={labelCls}>Apellido materno</div>
              <input className={inputCls} placeholder="Zertuche" value={identity.lastName2} onChange={(e)=> setIdentity({...identity, lastName2: e.target.value})}/>
            </div>
            <div><div className={labelCls}>Ubicación</div>
              <input className={inputCls} placeholder="Monterrey, Nuevo León, México" value={identity.location} onChange={(e)=> setIdentity({...identity, location: e.target.value})}/>
            </div>
            <div><div className={labelCls}>Email</div>
              <input className={inputCls} placeholder="tu@email.com" value={identity.email} onChange={(e)=> setIdentity({...identity, email: e.target.value})}/>
            </div>
            <div><div className={labelCls}>Teléfono</div>
              <input className={inputCls} placeholder="+52 81 0000 0000" value={identity.phone} onChange={(e)=> setIdentity({...identity, phone: e.target.value})}/>
            </div>
            <div><div className={labelCls}>Fecha de nacimiento</div>
              <input type="date" className={inputCls} value={identity.birthdate || ""} onChange={(e)=> setIdentity({...identity, birthdate: e.target.value})}/>
            </div>
            <div><div className={labelCls}>LinkedIn</div>
              <input className={inputCls} placeholder="https://www.linkedin.com/in/usuario" value={identity.linkedin} onChange={(e)=> setIdentity({...identity, linkedin: e.target.value})}/>
            </div>
            <div className="md:col-span-2"><div className={labelCls}>GitHub</div>
              <input className={inputCls} placeholder="https://github.com/usuario" value={identity.github} onChange={(e)=> setIdentity({...identity, github: e.target.value})}/>
            </div>
          </div>
        </section>

        {/* Experiencia */}
        <section>
          <div className="flex items-center justify-between mb-2 mt-6">
            <h2 className="text-lg font-semibold">Experiencia</h2>
            <button className="text-sm border rounded-lg px-3 py-1 hover:bg-gray-50"
              onClick={()=> setExperiences(a => [...a, { role:"", company:"", startDate:"", endDate:"", isCurrent:false, bulletsText:"" }])}>
              + Añadir
            </button>
          </div>
          {experiences.length === 0 ? (
            <p className="text-sm text-zinc-500">Aún no agregas experiencia.</p>
          ) : (
            <div className="space-y-3">
              {experiences.map((exp, idx) => (
                <div key={idx} className="border rounded-lg p-3 glass-card p-4 md:p-6">
                  <div className="grid md:grid-cols-2 gap-3">
                    <input className={inputCls} placeholder="Puesto" value={exp.role}
                      onChange={(e)=> setExperiences(a=> a.map((x,i)=> i===idx?{...x, role:e.target.value}:x))}/>
                    <input className={inputCls} placeholder="Empresa" value={exp.company}
                      onChange={(e)=> setExperiences(a=> a.map((x,i)=> i===idx?{...x, company:e.target.value}:x))}/>
                    <input type="month" className={inputCls} value={exp.startDate || ""}
                      onChange={(e)=> setExperiences(a=> a.map((x,i)=> i===idx?{...x, startDate:e.target.value}:x))}/>
                    <div className="flex gap-2 items-center">
                      <input type="month" className={inputCls} value={exp.endDate || ""} disabled={!!exp.isCurrent}
                        onChange={(e)=> setExperiences(a=> a.map((x,i)=> i===idx?{...x, endDate:e.target.value}:x))}/>
                      <label className="text-xs inline-flex items-center gap-1">
                        <input type="checkbox" checked={!!exp.isCurrent}
                          onChange={(e)=> setExperiences(a=> a.map((x,i)=> i===idx?{...x, isCurrent:e.target.checked, endDate:e.target.checked ? "" : x.endDate || ""}:x))}/>
                        Actual
                      </label>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="text-sm block mb-1 text-zinc-700">Descripción (un punto por línea)</label>
                    <textarea className="border rounded-lg p-3 w-full min-h-[110px] focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500"
                      placeholder={`• Coordinar proyectos...\n• Generar reportes en Power BI...\n• Dar soporte a usuarios...`}
                      value={exp.bulletsText || ""}
                      onChange={(e)=> setExperiences(a=> a.map((x,i)=> i===idx?{...x, bulletsText:e.target.value}:x))}
                    />
                  </div>

                  <div className="flex justify-between mt-2">
                    <button className="text-sm text-emerald-700 hover:underline" onClick={() => duplicateInSameCompany(idx)}>
                      + Añadir puesto en esta empresa
                    </button>
                    <button className="text-sm text-red-600 hover:underline" onClick={()=> setExperiences(a=> a.filter((_,i)=> i!==idx))}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Educación */}
        <section>
          <div className="flex items-center justify-between mb-2 mt-6">
            <h2 className="text-lg font-semibold">Educación</h2>
            <button className="text-sm border rounded-lg px-3 py-1 hover:bg-gray-50"
              onClick={()=> setEducation(a=> [...a, { institution:"", program:"", startDate:"", endDate:"" }])}>
              + Añadir
            </button>
          </div>
          {education.length === 0 ? (
            <p className="text-sm text-zinc-500">Aún no agregas educación.</p>
          ) : (
            <div className="space-y-3">
              {education.map((ed, idx) => (
                <div key={idx} className="border rounded-lg p-3 glass-card p-4 md:p-6">
                  <input className={inputCls} placeholder="Institución" value={ed.institution}
                    onChange={(e)=> setEducation(a=> a.map((x,i)=> i===idx?{...x, institution:e.target.value}:x))}/>
                  <input className={inputCls} placeholder="Programa (opcional)" value={ed.program || ""}
                    onChange={(e)=> setEducation(a=> a.map((x,i)=> i===idx?{...x, program:e.target.value}:x))}/>
                  <input type="month" className={inputCls} value={ed.startDate || ""}
                    onChange={(e)=> setEducation(a=> a.map((x,i)=> i===idx?{...x, startDate:e.target.value}:x))}/>
                  <input type="month" className={inputCls} value={ed.endDate || ""}
                    onChange={(e)=> setEducation(a=> a.map((x,i)=> i===idx?{...x, endDate:e.target.value}:x))}/>
                  <div className="md:col-span-2 flex justify-end">
                    <button className="text-sm text-red-600 hover:underline" onClick={()=> setEducation(a=> a.filter((_,i)=> i!==idx))}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Skills / Idiomas / Certificaciones */}
        <section>
          <div className="flex items-center justify-between mb-2 mt-6">
            <h2 className="text-lg font-semibold">Skills</h2>
            <button className="text-sm border rounded-lg px-3 py-1 hover:bg-gray-50"
              onClick={()=> setSkills(a=> [...a, { termId: crypto.randomUUID(), label: "", level: 3 }])}>+ Añadir</button>
          </div>
          {skills.length === 0 ? <p className="text-sm text-zinc-500">Aún no agregas skills.</p> : (
            <div className="space-y-2">
              {skills.map((s, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_140px_auto] gap-2 items-center">
                  <input className={inputCls} placeholder="Skill" value={s.label}
                    onChange={(e)=> setSkills(a=> a.map((x,i)=> i===idx?{...x, label:e.target.value}:x))}/>
                  <select className={inputCls} value={s.level}
                    onChange={(e)=> setSkills(a=> a.map((x,i)=> i===idx?{...x, level: parseInt(e.target.value,10) as 1|2|3|4|5}:x))}>
                    <option value={1}>Básico</option><option value={2}>Junior</option><option value={3}>Intermedio</option><option value={4}>Avanzado</option><option value={5}>Experto</option>
                  </select>
                  <button className="text-sm text-red-600 hover:underline" onClick={()=> setSkills(a=> a.filter((_,i)=> i!==idx))}>Eliminar</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2 mt-6">
            <h2 className="text-lg font-semibold">Idiomas</h2>
            <button className="text-sm border rounded-lg px-3 py-1 hover:bg-gray-50"
              onClick={()=> setLanguages(a=> [...a, { termId: crypto.randomUUID(), label: "", level: "CONVERSATIONAL" }])}>+ Añadir</button>
          </div>
          {languages.length === 0 ? <p className="text-sm text-zinc-500">Aún no agregas idiomas.</p> : (
            <div className="space-y-2">
              {languages.map((l, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_220px_auto] gap-2 items-center">
                  <input className={inputCls} placeholder="Idioma" value={l.label}
                    onChange={(e)=> setLanguages(a=> a.map((x,i)=> i===idx?{...x, label:e.target.value}:x))}/>
                  <select className={inputCls} value={l.level}
                    onChange={(e)=> setLanguages(a=> a.map((x,i)=> i===idx?{...x, level: e.target.value as CvLanguage["level"]}:x))}>
                    <option value="BASIC">Básico</option><option value="CONVERSATIONAL">Conversacional</option>
                    <option value="PROFESSIONAL">Profesional</option><option value="NATIVE">Nativo</option>
                  </select>
                  <button className="text-sm text-red-600 hover:underline" onClick={()=> setLanguages(a=> a.filter((_,i)=> i!==idx))}>Eliminar</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2 mt-6">
            <h2 className="text-lg font-semibold">Certificaciones</h2>
            <button className="text-sm border rounded-lg px-3 py-1 hover:bg-gray-50"
              onClick={()=> setCertifications(a=> [...a, ""])}>+ Añadir</button>
          </div>
          {certifications.length === 0 ? <p className="text-sm text-zinc-500">Aún no agregas certificaciones.</p> : (
            <div className="space-y-2">
              {certifications.map((c, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                  <input className={inputCls} placeholder="Ej. AWS SAA, CKA, ITIL Foundation" value={c}
                    onChange={(e)=> setCertifications(a=> a.map((x,i)=> i===idx?e.target.value:x))}/>
                  <button className="text-sm text-red-600 hover:underline" onClick={()=> setCertifications(a=> a.filter((_,i)=> i!==idx))}>
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Botón imprimir */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <button type="button" className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50" onClick={handlePrint}>
            Guardar como PDF (print)
          </button>
        </div>
      </div>

      {/* ====== PREVISUALIZACIÓN / EXPORT ====== */}
      <div className="cv-print-root hidden print:block">
        <section className="cv-sheet mx-auto">
          {/* El padding para pantalla/export está en cv-sheet-inner.
              En impresión, se desactiva y manda @page. */}
          <div className="cv-sheet-inner">
            <header className="text-center pt-0 pb-4 m-0">
              <h1 className="text-[22px] font-bold tracking-wide m-0">{fullName || "Tu Nombre"}</h1>
              <div className="text-[12px] mt-1">
                {identity.location && <span>{identity.location} · </span>}
                {identity.phone && <span>{identity.phone} · </span>}
                <span>{identity.email}</span>
              </div>
              {(identity.linkedin || identity.github || identity.birthdate) && (
                <div className="text-[12px] mt-1">
                  {identity.linkedin && <span>{identity.linkedin}</span>}
                  {identity.linkedin && identity.github && <span> · </span>}
                  {identity.github && <span>{identity.github}</span>}
                  {(identity.linkedin || identity.github) && identity.birthdate && <span> · </span>}
                  {identity.birthdate && <span>F. Nac.: {prettyBirth(identity.birthdate)}</span>}
                </div>
              )}
            </header>

            {/* EDUCACIÓN */}
            {education.length > 0 && (
              <section className="mb-6">
                <h2 className="text-[11px] font-extrabold tracking-wider border-b pb-1">EDUCACIÓN</h2>
                <ul className="mt-3 space-y-2">
                  {education.map((ed, i) => {
                    const grad = fmtMonthShort(ed.endDate);
                    return (
                      <li key={i}>
                        <div className="flex justify-between text-[14px] font-semibold">
                          <span>{ed.institution}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <div className="italic text-[12px]">{ed.program || ""}</div>
                          <div className="text-[12px] whitespace-nowrap">{grad}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* EXPERIENCIA */}
            {groupedByCompany.length > 0 && (
              <section className="mb-6">
                <h2 className="text-[11px] font-extrabold tracking-wider border-b pb-1">EXPERIENCIA</h2>
                <div className="mt-3 space-y-4">
                  {groupedByCompany.map(([company, roles], i) => (
                    <div key={i}>
                      <div className="font-semibold text-[14px]">{company}</div>
                      <div className="mt-1 space-y-2">
                        {roles.map((e, idx) => {
                          const startS = fmtMonthShort(e.startDate);
                          const endS   = e.isCurrent ? "Actual" : fmtMonthShort(e.endDate);
                          return (
                            <div key={idx}>
                              <div className="flex justify-between">
                                <div className="italic text-[12px]">{e.role}</div>
                                <div className="text-[12px] whitespace-nowrap">{startS}{(startS || endS) ? " – " : ""}{endS}</div>
                              </div>
                              {e.bullets && e.bullets.length > 0 && (
                                <ul className="list-disc pl-5 mt-1 text-[12px] leading-6">
                                  {e.bullets.map((b, j) => <li key={j}>{b}</li>)}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SKILLS & CERTIFICATIONS */}
            {(skills.length > 0 || certifications.length > 0) && (
              <section>
                <h2 className="text-[11px] font-extrabold tracking-wider border-b pb-1">SKILLS & CERTIFICATIONS</h2>
                {skills.length > 0 && (
                  <p className="mt-3 text-[12px]">
                    <span className="font-semibold">Skills: </span>
                    {skills.map((s) => s.label).filter(Boolean).join(", ")}
                  </p>
                )}
                {certifications.filter(Boolean).length > 0 && (
                  <p className="text-[12px] mt-1">
                    <span className="font-semibold">Certifications: </span>
                    {certifications.filter(Boolean).join(", ")}
                  </p>
                )}
              </section>
            )}
          </div>
        </section>
      </div>

      {/* ====== Estilos impresión/global ====== */}
      <style jsx global>{`
        /* Mostrar la hoja oculta durante la exportación a canvas */
        body[data-exporting="1"] .cv-print-root { display:block !important; position:fixed; left:-10000px; top:0; }
        body[data-exporting="1"] .cv-print-root .cv-sheet { box-shadow:none !important; }

        /* Tamaño exacto A4; márgenes visuales en pantalla/export con .cv-sheet-inner */
        .cv-sheet { width: 210mm; min-height: 297mm; background: white; margin: 0 auto; }
        .cv-sheet-inner { padding: 6mm 12mm 12mm; } /* top 6mm, lados 12mm, bottom 12mm */

        @media print {
          /* Solo CV visible en impresión */
          body * { visibility: hidden !important; }
          .cv-print-root, .cv-print-root * { visibility: visible !important; }
          .cv-print-root { position: fixed; inset: 0; margin: 0; padding: 0; }

          /* Ajuste clave: ancho imprimible = 210mm - (12mm + 12mm) */
          .cv-sheet {
            box-shadow: none !important;
            border: 0 !important;
            background: white !important;
            width: calc(210mm - 24mm);
            margin: 0 auto;
          }

          /* En impresión, el padding lo controla @page */
          .cv-sheet-inner { padding: 0; }
          @page { size: A4; margin: 6mm 12mm 12mm; }

          .cv-sheet section, .cv-sheet header { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
