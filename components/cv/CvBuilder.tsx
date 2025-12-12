// components/cv/CvBuilder.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import PhoneInputField from "@/components/PhoneInputField";
import CvExperienceEditor from "@/components/cv/CvExperienceEditor";

/* ==================== Tipos ==================== */
type CvIdentity = {
  firstName: string;
  lastName1: string;
  lastName2: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  birthdate?: string; // YYYY-MM-DD
};

type CvExperience = {
  id?: string;
  role: string;
  company: string;
  startDate: string;
  endDate?: string | null;
  isCurrent?: boolean;
  bullets?: string[];
  bulletsText?: string;
  /** HTML del editor enriquecido (para no perder formato de bullets) */
  descriptionHtml?: string;
};

type CvEducation = {
  id?: string;
  institution: string;
  program?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};
type CvSkill = { termId: string; label: string; level: 1 | 2 | 3 | 4 | 5 };
type CvLanguage = {
  termId: string;
  label: string;
  level: "NATIVE" | "PROFESSIONAL" | "CONVERSATIONAL" | "BASIC";
};

type SkillOption = { termId: string; label: string };
type LanguageOption = { termId: string; label: string };

type Props = {
  initial: {
    identity: CvIdentity;
    experiences: CvExperience[];
    education: CvEducation[];
    skills: CvSkill[];
    languages: CvLanguage[];
    certifications: string[];
  };
  /** Opciones globales para autocompletar skills */
  skillOptions: SkillOption[];
  /** Opciones globales para autocompletar idiomas */
  languageOptions: LanguageOption[];
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
  const yy = Number(y),
    mm = Number(m) - 1,
    dd = Number(d);
  if ([yy, mm, dd].some(Number.isNaN)) return null;
  return new Date(yy, mm, dd);
};
const joinName = (i: CvIdentity) =>
  [i.firstName, i.lastName1, i.lastName2].filter(Boolean).join(" ");
const prettyBirth = (birth?: string) => {
  const d = parseYMDToLocal(birth);
  if (!d) return "";
  try {
    return d.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  } catch {
    return birth || "";
  }
};

// claves de orden (más reciente primero)
const roleSortKey = (e: CvExperience) =>
  e.isCurrent
    ? `Z-9999-99-${e.startDate || ""}`
    : e.endDate
    ? `Y-${e.endDate}-${e.startDate || ""}`
    : `X-${e.startDate || ""}`;
const companySortKey = (roles: CvExperience[]) => {
  const sorted = [...roles].sort((a, b) =>
    roleSortKey(b).localeCompare(roleSortKey(a))
  );
  return roleSortKey(sorted[0]!);
};

/* ==================== UI helpers ==================== */
const labelCls =
  "block text-xs font-medium text-zinc-800 dark:text-zinc-100 mb-1";

const inputBase =
  "block w-full rounded-lg border border-zinc-300 bg-white/90 px-3 py-2 text-[13px] text-zinc-900 shadow-sm " +
  "placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 " +
  "focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-50 " +
  "dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-50 dark:placeholder:text-zinc-500 " +
  "dark:focus-visible:ring-offset-zinc-900";

const inputCls = inputBase; // full (URLs largas)
const inputMdCls = inputBase + " md:max-w-sm"; // mediano
const inputSmCls = inputBase + " md:max-w-xs"; // corto

/* ==================== LocalStorage key ==================== */
const LS_KEY = "cv_builder_draft_v1";

/* ==================== Helpers para autocomplete ==================== */
function filterSkillOptions(all: SkillOption[], query: string): SkillOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts = all.filter((o) => o.label.toLowerCase().startsWith(q));
  const contains = all.filter(
    (o) =>
      !o.label.toLowerCase().startsWith(q) &&
      o.label.toLowerCase().includes(q)
  );
  return [...starts, ...contains].slice(0, 8);
}

function filterLanguageOptions(
  all: LanguageOption[],
  query: string
): LanguageOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts = all.filter((o) => o.label.toLowerCase().startsWith(q));
  const contains = all.filter(
    (o) =>
      !o.label.toLowerCase().startsWith(q) &&
      o.label.toLowerCase().includes(q)
  );
  return [...starts, ...contains].slice(0, 8);
}

/* ==================== Componente ==================== */
export default function CvBuilder({
  initial,
  skillOptions,
  languageOptions,
}: Props) {
  const { data: session } = useSession();
  const user = session?.user as any | undefined;
  const role = user?.role as "ADMIN" | "RECRUITER" | "CANDIDATE" | undefined;
  const isCandidate = role === "CANDIDATE";

  const [identity, setIdentity] = useState<CvIdentity>({
    ...initial.identity,
    birthdate: initial.identity.birthdate || "",
  });
  const [experiences, setExperiences] = useState<CvExperience[]>(
    (initial.experiences || []).map((e) => ({
      ...e,
      bulletsText: e.bullets?.join("\n") || "",
      descriptionHtml: e.descriptionHtml || "",
    }))
  );
  const [education, setEducation] = useState<CvEducation[]>(
    initial.education || []
  );
  const [skills, setSkills] = useState<CvSkill[]>(initial.skills || []);
  const [languages, setLanguages] = useState<CvLanguage[]>(
    initial.languages || []
  );
  const [certifications, setCertifications] = useState<string[]>(
    initial.certifications || []
  );
  const [saving, setSaving] = useState(false);

  // control de apertura de combos
  const [openSkillIndex, setOpenSkillIndex] = useState<number | null>(null);
  const [openLanguageIndex, setOpenLanguageIndex] = useState<number | null>(
    null
  );

  const fullName = useMemo(() => joinName(identity), [identity]);

  // ====== Cargar borrador desde localStorage (para uso sin registro) ======
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        identity: CvIdentity;
        experiences: CvExperience[];
        education: CvEducation[];
        skills: CvSkill[];
        languages: CvLanguage[];
        certifications: string[];
      }>;

      if (parsed.identity) {
        setIdentity((prev) => ({
          ...prev,
          ...parsed.identity,
        }));
      }
      if (Array.isArray(parsed.experiences)) {
        setExperiences(
          parsed.experiences.map((e) => ({
            ...e,
            bulletsText: e.bulletsText || e.bullets?.join("\n") || "",
            descriptionHtml: e.descriptionHtml || "",
          }))
        );
      }
      if (Array.isArray(parsed.education)) {
        setEducation(parsed.education);
      }
      if (Array.isArray(parsed.skills)) {
        setSkills(parsed.skills);
      }
      if (Array.isArray(parsed.languages)) {
        setLanguages(parsed.languages);
      }
      if (Array.isArray(parsed.certifications)) {
        setCertifications(parsed.certifications);
      }
    } catch (err) {
      console.error("Error al cargar borrador de CV desde localStorage", err);
    }
    // solo al montar
  }, []);

  // ====== Guardar borrador en localStorage en cada cambio ======
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const draft = {
        identity,
        experiences,
        education,
        skills,
        languages,
        certifications,
      };
      window.localStorage.setItem(LS_KEY, JSON.stringify(draft));
    } catch (err) {
      console.error("Error al guardar borrador de CV en localStorage", err);
    }
  }, [identity, experiences, education, skills, languages, certifications]);

  // Editor -> preview
  const previewExperiences = experiences.map((e) => ({
    ...e,
    bullets: (e.bulletsText || "")
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean),
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
      arr.sort((a, b) => roleSortKey(b).localeCompare(roleSortKey(a)));
      map.set(company, arr);
    }
    const entries = Array.from(map.entries());
    entries.sort(([, a], [, b]) =>
      companySortKey(b).localeCompare(companySortKey(a))
    );
    return entries;
  }, [previewExperiences]);

  const duplicateInSameCompany = (idx: number) => {
    const e = experiences[idx];
    const clone: CvExperience = {
      role: "",
      company: e.company,
      startDate: "",
      endDate: "",
      isCurrent: false,
      bulletsText: "",
      descriptionHtml: "",
    };
    setExperiences((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  };

  // Construye el PDF del CV (recorta blancos y usa letra negra)
  const buildCvPdf = async () => {
    // Forzamos que la vista imprimible se renderice sola
    document.body.setAttribute("data-exporting", "1");
    await new Promise(requestAnimationFrame);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const el = document.querySelector(".cv-sheet") as HTMLElement | null;
      if (!el) throw new Error("No se encontró la hoja del CV para exportar.");

      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#ffffff",
      });

      // ==== Recortar espacio blanco arriba/abajo ====
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo obtener el contexto del canvas");

      const { width, height } = canvas;
      const data = ctx.getImageData(0, 0, width, height).data;

      const isRowEmpty = (y: number) => {
        const offset = y * width * 4;
        for (let x = 0; x < width; x++) {
          const i = offset + x * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Si hay tinta (no blanco puro), la fila NO está vacía
          if (a > 0 && (r < 250 || g < 250 || b < 250)) {
            return false;
          }
        }
        return true;
      };

      let top = 0;
      let bottom = height - 1;

      // Buscar primera y última fila con contenido
      while (top < height && isRowEmpty(top)) top++;
      while (bottom > top && isRowEmpty(bottom)) bottom--;

      // 👇 deja un poco de margen extra arriba (ajustable)
      const EXTRA_TOP_PX = 70; // prueba con 50–90 según lo que te guste
      top = Math.max(0, top - EXTRA_TOP_PX);

      let finalCanvas = canvas;

      if (bottom > top) {
        const cropHeight = bottom - top + 1;
        const cropped = document.createElement("canvas");
        cropped.width = width;
        cropped.height = cropHeight;
        const dst = cropped.getContext("2d")!;
        dst.drawImage(
          canvas,
          0,
          top,
          width,
          cropHeight,
          0,
          0,
          width,
          cropHeight
        );
        finalCanvas = cropped;
      }

      const imgData = finalCanvas.toDataURL("image/jpeg", 0.95);

      const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      let imgWmm = pageW;
      let imgHmm = (finalCanvas.height / finalCanvas.width) * imgWmm;

      if (imgHmm > pageH) {
        imgHmm = pageH;
        imgWmm = (finalCanvas.width / finalCanvas.height) * imgHmm;
      }

      pdf.addImage(imgData, "JPEG", 0, 0, imgWmm, imgHmm, undefined, "FAST");

      return pdf;
    } finally {
      document.body.removeAttribute("data-exporting");
    }
  };

  const handlePrint = async () => {
    try {
      const pdf = await buildCvPdf();
      pdf.save(`CV-${fullName || "candidato"}.pdf`);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Hubo un problema al generar el PDF.");
    }
  };

  // ===== Guardar versión en el perfil (solo CANDIDATE) =====
  const saveVersion = async () => {
    if (!isCandidate) {
      alert(
        "Para guardar este CV en tu perfil y reemplazar tu archivo actual, crea una cuenta de candidato e inicia sesión."
      );
      return;
    }

    try {
      setSaving(true);

      // 1) ¿ya existe un resumeUrl?
      const existing = (await fetch("/api/profile/resume", {
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : { resumeUrl: null }))) as {
        resumeUrl?: string | null;
      };

      if (existing?.resumeUrl) {
        const ok = window.confirm(
          "Ya tienes un CV guardado en tu perfil.\n\n¿Quieres REEMPLAZAR el archivo actual?"
        );
        if (!ok) {
          setSaving(false);
          return;
        }
      }

      // 2) Construir PDF (misma lógica que para descargar)
      const pdf = await buildCvPdf();
      const blob = pdf.output("blob");
      const file = new File([blob], `CV-${fullName || "candidato"}.pdf`, {
        type: "application/pdf",
      });

      // 3) Subir al servidor
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/profile/upload-resume", {
        method: "POST",
        body: fd,
      });
      if (!up.ok) throw new Error("No se pudo subir el archivo del CV.");
      const { url } = (await up.json()) as { url: string };
      if (!url) throw new Error("El servidor no regresó la URL del CV.");

      // 4) Guardar URL en perfil
      const save = await fetch("/api/profile/set-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeUrl: url }),
      });
      if (!save.ok)
        throw new Error("No se pudo actualizar tu perfil con la URL del CV.");

      alert(
        existing?.resumeUrl
          ? "CV reemplazado con éxito."
          : "CV agregado a tu perfil con éxito."
      );
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Hubo un problema al guardar el CV.");
    } finally {
      setSaving(false);
    }
  };

  // ======================= JSX =======================
  return (
    <div className="space-y-10">
      {/* ====== EDITOR (oculto en impresión) ====== */}
      <div className="print:hidden">
        {/* Barra superior: acciones principales */}
        <div className="flex flex-wrap items-center gap-3">
          {isCandidate && (
            <button
              type="button"
              onClick={saveVersion}
              disabled={saving}
              className="inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Guardando..." : "Guardar versión en mi perfil"}
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Guardar como PDF (print)
          </button>
        </div>

        {/* Datos personales */}
        <section className="rounded-2xl border glass-card p-3 md:p-4 mt-4">
          <div className="mb-3">
            <h2 className="text-lg font-semibold">Datos personales</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Email principal: {identity.email || "—"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Nombre / apellidos */}
            <div className="md:col-span-4">
              <div className={labelCls}>Nombre(s)</div>
              <input
                className={inputMdCls}
                placeholder="Alejandro"
                value={identity.firstName}
                onChange={(e) =>
                  setIdentity({ ...identity, firstName: e.target.value })
                }
              />
            </div>

            <div className="md:col-span-4">
              <div className={labelCls}>Apellido paterno</div>
              <input
                className={inputMdCls}
                placeholder="Cerda"
                value={identity.lastName1}
                onChange={(e) =>
                  setIdentity({ ...identity, lastName1: e.target.value })
                }
              />
            </div>

            <div className="md:col-span-4">
              <div className={labelCls}>Apellido materno</div>
              <input
                className={inputMdCls}
                placeholder="Zertuche"
                value={identity.lastName2}
                onChange={(e) =>
                  setIdentity({ ...identity, lastName2: e.target.value })
                }
              />
            </div>

            {/* Ubicación */}
            <div className="md:col-span-6">
              <div className={labelCls}>Ubicación</div>
              <LocationAutocomplete
                value={identity.location}
                onChange={(v) =>
                  setIdentity({
                    ...identity,
                    location: v,
                  })
                }
                countries={["mx"]}
                className={inputMdCls}
              />
            </div>

            {/* Teléfono + fecha */}
            <div className="md:col-span-3 cv-phone-input">
              <PhoneInputField
                value={identity.phone}
                onChange={(val) =>
                  setIdentity({ ...identity, phone: val || "" })
                }
                label="Teléfono"
                helperText=""
              />
            </div>

            <div className="md:col-span-3">
              <div className={labelCls}>Fecha de nacimiento</div>
              <input
                type="date"
                className={inputSmCls}
                value={identity.birthdate || ""}
                onChange={(e) =>
                  setIdentity({ ...identity, birthdate: e.target.value })
                }
              />
            </div>

            {/* Email */}
            <div className="md:col-span-6">
              <div className={labelCls}>Email</div>
              <input
                className={inputMdCls}
                placeholder="tu@email.com"
                value={identity.email}
                onChange={(e) =>
                  setIdentity({ ...identity, email: e.target.value })
                }
              />
            </div>

            {/* LinkedIn + GitHub misma fila */}
            <div className="md:col-span-6">
              <div className={labelCls}>LinkedIn</div>
              <input
                className={inputMdCls}
                placeholder="https://www.linkedin.com/in/usuario"
                value={identity.linkedin}
                onChange={(e) =>
                  setIdentity({ ...identity, linkedin: e.target.value })
                }
              />
            </div>

            <div className="md:col-span-6">
              <div className={labelCls}>GitHub</div>
              <input
                className={inputMdCls}
                placeholder="https://github.com/usuario"
                value={identity.github}
                onChange={(e) =>
                  setIdentity({ ...identity, github: e.target.value })
                }
              />
            </div>
          </div>
        </section>

        {/* Experiencia */}
        <section>
          <div className="flex items-center justify-between mb-2 mt-6">
            <h2 className="text-lg font-semibold">Experiencia</h2>
            <button
              className="text-sm border rounded-lg px-3 py-1 hover:bg-gray-50"
              onClick={() =>
                setExperiences((a) => [
                  ...a,
                  {
                    role: "",
                    company: "",
                    startDate: "",
                    endDate: "",
                    isCurrent: false,
                    bulletsText: "",
                    descriptionHtml: "",
                  },
                ])
              }
            >
              + Añadir
            </button>
          </div>

          {experiences.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Aún no agregas experiencia.
            </p>
          ) : (
            // 👉 menos separación entre tarjetas
            <div className="space-y-2">
              {experiences.map((exp, idx) => (
                <div
                  key={idx}
                  className="border rounded-lg glass-card p-3 md:p-3"
                >
                  {/* fila de inputs MUY compacta */}
                  <div className="grid md:grid-cols-2 gap-x-4 gap-y-1">
                    {/* Puesto */}
                    <div className="flex items-center gap-3">
                      <label className="w-24 text-sm font-medium text-zinc-700 dark:text-zinc-100">
                        Puesto
                      </label>
                      <input
                        className={`${inputCls} flex-1`}
                        placeholder="Scrum Master"
                        value={exp.role}
                        onChange={(e) =>
                          setExperiences((a) =>
                            a.map((x, i) =>
                              i === idx ? { ...x, role: e.target.value } : x
                            )
                          )
                        }
                      />
                    </div>

                    {/* Empresa */}
                    <div className="flex items-center gap-3">
                      <label className="w-24 text-sm font-medium text-zinc-700 dark:text-zinc-100">
                        Empresa
                      </label>
                      <input
                        className={`${inputCls} flex-1`}
                        placeholder="Google"
                        value={exp.company}
                        onChange={(e) =>
                          setExperiences((a) =>
                            a.map((x, i) =>
                              i === idx ? { ...x, company: e.target.value } : x
                            )
                          )
                        }
                      />
                    </div>

                    {/* Inicio */}
                    <div className="flex items-center gap-3">
                      <label className="w-24 text-sm font-medium text-zinc-700 dark:text-zinc-100">
                        Inicio
                      </label>
                      <input
                        type="month"
                        className={`${inputCls} max-w-[11rem] flex-1`}
                        value={exp.startDate || ""}
                        onChange={(e) =>
                          setExperiences((a) =>
                            a.map((x, i) =>
                              i === idx
                                ? { ...x, startDate: e.target.value }
                                : x
                            )
                          )
                        }
                      />
                    </div>

                    {/* Fin + Actual */}
                    <div className="flex items-center gap-3">
                      <label className="w-24 text-sm font-medium text-zinc-700 dark:text-zinc-100">
                        Fin
                      </label>
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="month"
                          className={`${inputCls} max-w-[11rem] flex-1`}
                          value={exp.endDate || ""}
                          disabled={!!exp.isCurrent}
                          onChange={(e) =>
                            setExperiences((a) =>
                              a.map((x, i) =>
                                i === idx
                                  ? { ...x, endDate: e.target.value }
                                  : x
                              )
                            )
                          }
                        />
                        <label className="text-xs inline-flex items-center gap-1 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={!!exp.isCurrent}
                            onChange={(e) =>
                              setExperiences((a) =>
                                a.map((x, i) =>
                                  i === idx
                                    ? {
                                        ...x,
                                        isCurrent: e.target.checked,
                                        endDate: e.target.checked
                                          ? ""
                                          : x.endDate || "",
                                      }
                                    : x
                                )
                              )
                            }
                          />
                          Actual
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* 👇 Aquí bajamos fuerte el espacio: mt-3 -> mt-1 */}
                  <div className="mt-1">
                    <label className="text-sm block mb-1 text-zinc-700 dark:text-zinc-100">
                      Descripción (un punto por línea)
                    </label>
                    <CvExperienceEditor
                      valueHtml={exp.descriptionHtml || ""}
                      onChangeHtml={(html, plain) =>
                        setExperiences((a) =>
                          a.map((x, i) =>
                            i === idx
                              ? {
                                  ...x,
                                  descriptionHtml: html,
                                  bulletsText: plain,
                                }
                              : x
                          )
                        )
                      }
                    />
                  </div>

                  <div className="flex justify-between mt-2">
                    <button
                      className="text-sm text-emerald-700 hover:underline"
                      onClick={() => duplicateInSameCompany(idx)}
                    >
                      + Añadir puesto en esta empresa
                    </button>
                    <button
                      className="text-sm text-red-600 hover:underline"
                      onClick={() =>
                        setExperiences((a) => a.filter((_, i) => i !== idx))
                      }
                    >
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
          {/* ↓ menos margen arriba: mt-4 en lugar de mt-6 */}
          <div className="flex items-center justify-between mb-2 mt-4">
            <h2 className="text-lg font-semibold">Educación</h2>
            <button
              className="text-sm border rounded-lg px-3 py-1 hover:bg-gray-50"
              onClick={() =>
                setEducation((a) => [
                  ...a,
                  {
                    institution: "",
                    program: "",
                    startDate: "",
                    endDate: "",
                  },
                ])
              }
            >
              + Añadir
            </button>
          </div>

          {education.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Aún no agregas educación.
            </p>
          ) : (
            // menos espacio entre tarjetas
            <div className="space-y-2">
              {education.map((ed, idx) => (
                <div
                  key={idx}
                  className="border rounded-lg glass-card p-3 md:p-3"
                >
                  <div className="grid md:grid-cols-2 gap-x-4 gap-y-1">
                    {/* Institución */}
                    <div className="flex items-center gap-3">
                      <label className="w-28 text-sm font-medium text-zinc-700 dark:text-zinc-100">
                        Institución
                      </label>
                      <input
                        className={`${inputCls} flex-1`}
                        placeholder="Tec de Monterrey"
                        value={ed.institution}
                        onChange={(e) =>
                          setEducation((a) =>
                            a.map((x, i) =>
                              i === idx
                                ? { ...x, institution: e.target.value }
                                : x
                            )
                          )
                        }
                      />
                    </div>

                    {/* Programa */}
                    <div className="flex items-center gap-3">
                      <label className="w-28 text-sm font-medium text-zinc-700 dark:text-zinc-100">
                        Programa
                      </label>
                      <input
                        className={`${inputCls} flex-1`}
                        placeholder="Ingeniería, licenciatura, etc."
                        value={ed.program || ""}
                        onChange={(e) =>
                          setEducation((a) =>
                            a.map((x, i) =>
                              i === idx ? { ...x, program: e.target.value } : x
                            )
                          )
                        }
                      />
                    </div>

                    {/* Inicio */}
                    <div className="flex items-center gap-3">
                      <label className="w-28 text-sm font-medium text-zinc-700 dark:text-zinc-100">
                        Inicio
                      </label>
                      <input
                        type="month"
                        className={`${inputCls} max-w-[11rem] flex-1`}
                        value={ed.startDate || ""}
                        onChange={(e) =>
                          setEducation((a) =>
                            a.map((x, i) =>
                              i === idx
                                ? { ...x, startDate: e.target.value }
                                : x
                            )
                          )
                        }
                      />
                    </div>

                    {/* Fin */}
                    <div className="flex items-center gap-3">
                      <label className="w-28 text-sm font-medium text-zinc-700 dark:text-zinc-100">
                        Fin
                      </label>
                      <input
                        type="month"
                        className={`${inputCls} max-w-[11rem] flex-1`}
                        value={ed.endDate || ""}
                        onChange={(e) =>
                          setEducation((a) =>
                            a.map((x, i) =>
                              i === idx
                                ? { ...x, endDate: e.target.value }
                                : x
                            )
                          )
                        }
                      />
                    </div>
                  </div>

                  {/* menos espacio antes del botón */}
                  <div className="mt-2 flex justify-end">
                    <button
                      className="text-sm text-red-600 hover:underline"
                      onClick={() =>
                        setEducation((a) => a.filter((_, i) => i !== idx))
                      }
                    >
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
            <button
              className="text-sm border rounded-lg px-3 py-1 hover:bg-gray-50"
              onClick={() =>
                setSkills((a) => [
                  ...a,
                  {
                    termId: crypto.randomUUID(),
                    label: "",
                    level: 3,
                  },
                ])
              }
            >
              + Añadir
            </button>
          </div>
          {skills.length === 0 ? (
            <p className="text-sm text-zinc-500">Aún no agregas skills.</p>
          ) : (
            <div className="space-y-2">
              {skills.map((s, idx) => {
                const showSuggestions =
                  openSkillIndex === idx && s.label.trim().length >= 2;
                const suggestions = showSuggestions
                  ? filterSkillOptions(skillOptions, s.label)
                  : [];
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_140px_auto] gap-2 items-start"
                  >
                    <div className="relative">
                      <input
                        className={inputCls}
                        placeholder="Skill"
                        value={s.label}
                        onFocus={() => {
                          if (s.label.trim().length >= 2) {
                            setOpenSkillIndex(idx);
                          }
                        }}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSkills((a) =>
                            a.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    label: value,
                                    termId: value === s.label ? x.termId : "",
                                  }
                                : x
                            )
                          );
                          setOpenSkillIndex(
                            value.trim().length >= 2 ? idx : null
                          );
                        }}
                        onBlur={() => {
                          // Cerramos el dropdown un poquito después
                          setTimeout(() => {
                            setOpenSkillIndex((prev) =>
                              prev === idx ? null : prev
                            );
                          }, 150);
                        }}
                      />
                      {suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 rounded-xl border border-zinc-200 bg-white shadow-lg text-xs max-h-48 overflow-auto z-20 dark:bg-zinc-900 dark:border-zinc-700">
                          {suggestions.map((opt) => (
                            <button
                              key={opt.termId}
                              type="button"
                              className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setSkills((a) =>
                                  a.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          label: opt.label,
                                          termId: opt.termId,
                                        }
                                      : x
                                  )
                                );
                                setOpenSkillIndex(null);
                              }}
                            >
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <select
                      className={inputCls}
                      value={s.level}
                      onChange={(e) =>
                        setSkills((a) =>
                          a.map((x, i) =>
                            i === idx
                              ? {
                                  ...x,
                                  level: parseInt(e.target.value, 10) as
                                    | 1
                                    | 2
                                    | 3
                                    | 4
                                    | 5,
                                }
                              : x
                          )
                        )
                      }
                    >
                      <option value={1}>Básico</option>
                      <option value={2}>Junior</option>
                      <option value={3}>Intermedio</option>
                      <option value={4}>Avanzado</option>
                      <option value={5}>Experto</option>
                    </select>
                    <button
                      className="text-sm text-red-600 hover:underline"
                      onClick={() =>
                        setSkills((a) => a.filter((_, i) => i !== idx))
                      }
                    >
                      Eliminar
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2 mt-6">
            <h2 className="text-lg font-semibold">Idiomas</h2>
            <button
              className="text-sm border rounded-lg px-3 py-1 hover:bg-gray-50"
              onClick={() =>
                setLanguages((a) => [
                  ...a,
                  {
                    termId: crypto.randomUUID(),
                    label: "",
                    level: "CONVERSATIONAL",
                  },
                ])
              }
            >
              + Añadir
            </button>
          </div>
          {languages.length === 0 ? (
            <p className="text-sm text-zinc-500">Aún no agregas idiomas.</p>
          ) : (
            <div className="space-y-2">
              {languages.map((l, idx) => {
                const showSuggestions =
                  openLanguageIndex === idx && l.label.trim().length >= 1;
                const suggestions = showSuggestions
                  ? filterLanguageOptions(languageOptions, l.label)
                  : [];
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_220px_auto] gap-2 items-start"
                  >
                    <div className="relative">
                      <input
                        className={inputCls}
                        placeholder="Idioma"
                        value={l.label}
                        onFocus={() => {
                          if (l.label.trim().length >= 1) {
                            setOpenLanguageIndex(idx);
                          }
                        }}
                        onChange={(e) => {
                          const value = e.target.value;
                          setLanguages((a) =>
                            a.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    label: value,
                                    termId: value === l.label ? x.termId : "",
                                  }
                                : x
                            )
                          );
                          setOpenLanguageIndex(
                            value.trim().length >= 1 ? idx : null
                          );
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setOpenLanguageIndex((prev) =>
                              prev === idx ? null : prev
                            );
                          }, 150);
                        }}
                      />
                      {suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 rounded-xl border border-zinc-200 bg-white shadow-lg text-xs max-h-48 overflow-auto z-20 dark:bg-zinc-900 dark:border-zinc-700">
                          {suggestions.map((opt) => (
                            <button
                              key={opt.termId}
                              type="button"
                              className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setLanguages((a) =>
                                  a.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          label: opt.label,
                                          termId: opt.termId,
                                        }
                                      : x
                                  )
                                );
                                setOpenLanguageIndex(null);
                              }}
                            >
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <select
                      className={inputCls}
                      value={l.level}
                      onChange={(e) =>
                        setLanguages((a) =>
                          a.map((x, i) =>
                            i === idx
                              ? {
                                  ...x,
                                  level: e.target.value as CvLanguage["level"],
                                }
                              : x
                          )
                        )
                      }
                    >
                      <option value="BASIC">Básico</option>
                      <option value="CONVERSATIONAL">Conversacional</option>
                      <option value="PROFESSIONAL">Profesional</option>
                      <option value="NATIVE">Nativo</option>
                    </select>
                    <button
                      className="text-sm text-red-600 hover:underline"
                      onClick={() =>
                        setLanguages((a) => a.filter((_, i) => i !== idx))
                      }
                    >
                      Eliminar
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2 mt-6">
            <h2 className="text-lg font-semibold">Certificaciones</h2>
            <button
              className="text-sm border rounded-lg px-3 py-1 hover:bg-gray-50"
              onClick={() => setCertifications((a) => [...a, ""])}
            >
              + Añadir
            </button>
          </div>
          {certifications.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Aún no agregas certificaciones.
            </p>
          ) : (
            <div className="space-y-2">
              {certifications.map((c, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_auto] gap-2 items-center"
                >
                  <input
                    className={inputCls}
                    placeholder="Ej. AWS SAA, CKA, ITIL Foundation"
                    value={c}
                    onChange={(e) =>
                      setCertifications((a) =>
                        a.map((x, i) => (i === idx ? e.target.value : x))
                      )
                    }
                  />
                  <button
                    className="text-sm text-red-600 hover:underline"
                    onClick={() =>
                      setCertifications((a) =>
                        a.filter((_, i) => i !== idx)
                      )
                    }
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Hook / CTA final para registro */}
        {!isCandidate && (
          <section className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-50/80 p-4 md:p-5">
            <h3 className="text-sm font-semibold text-emerald-900">
              Guarda tu CV y postúlate en un clic
            </h3>
            <p className="mt-1 text-xs md:text-sm text-emerald-900/80">
              Crea una cuenta gratis en Bolsa TI para conservar tu CV, editarlo
              cuando quieras y postularte a vacantes sin volver a llenar todo.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/auth/signup/candidate?from=cv-builder"
                className="btn btn-primary"
              >
                Crear cuenta y guardar CV
              </Link>
              <Link
                href="/auth/signin?role=CANDIDATE&from=cv-builder"
                className="btn btn-ghost"
              >
                Ya tengo cuenta
              </Link>
              <button
                type="button"
                className="rounded-lg border px-4 py-2 text-xs md:text-sm hover:bg-gray-50"
                onClick={handlePrint}
              >
                Descargar sin registrarme
              </button>
            </div>
          </section>
        )}
      </div>

      {/* ====== PREVISUALIZACIÓN / EXPORT (solo para print y export) ====== */}
      <div className="cv-print-root hidden print:block">
        <section className="cv-sheet mx-auto">
          {/* El padding para pantalla/export está en cv-sheet-inner.
              En impresión, se desactiva y manda @page. */}
          <div className="cv-sheet-inner">
            <header className="cv-header text-center">
              <h1 className="cv-name">{fullName || "Tu Nombre"}</h1>

              <div className="cv-meta-row">
                {identity.location && <span>{identity.location}</span>}
                {identity.email && <span>{identity.email}</span>}
                {identity.phone && <span>{identity.phone}</span>}
              </div>

              {(identity.linkedin ||
                identity.github ||
                identity.birthdate) && (
                <div className="cv-meta-row">
                  {identity.linkedin && <span>{identity.linkedin}</span>}
                  {identity.github && <span>{identity.github}</span>}
                  {identity.birthdate && (
                    <span>F. Nac.: {prettyBirth(identity.birthdate)}</span>
                  )}
                </div>
              )}
            </header>

            {/* EDUCACIÓN */}
            {education.length > 0 && (
              <section className="mb-6">
                <h2 className="text-[11px] font-extrabold tracking-wider border-b pb-1">
                  EDUCACIÓN
                </h2>
                <ul className="mt-3 space-y-2">
                  {education.map((ed, i) => {
                    const grad = fmtMonthShort(ed.endDate);
                    return (
                      <li key={i}>
                        <div className="flex justify-between text-[14px] font-semibold">
                          <span>{ed.institution}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <div className="italic text-[12px]">
                            {ed.program || ""}
                          </div>
                          <div className="text-[12px] whitespace-nowrap">
                            {grad}
                          </div>
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
                <h2 className="text-[11px] font-extrabold tracking-wider border-b pb-1">
                  EXPERIENCIA
                </h2>
                <div className="mt-3 space-y-4">
                  {groupedByCompany.map(([company, roles], i) => (
                    <div key={i}>
                      <div className="font-semibold text-[14px]">
                        {company}
                      </div>
                      <div className="mt-1 space-y-2">
                        {roles.map((e, idx) => {
                          const startS = fmtMonthShort(e.startDate);
                          const endS = e.isCurrent
                            ? "Actual"
                            : fmtMonthShort(e.endDate);
                          return (
                            <div key={idx}>
                              <div className="flex justify-between">
                                <div className="italic text-[12px]">
                                  {e.role}
                                </div>
                                <div className="text-[12px] whitespace-nowrap">
                                  {startS}
                                  {(startS || endS) ? " – " : ""}
                                  {endS}
                                </div>
                              </div>
                              {e.bullets && e.bullets.length > 0 && (
                                <ul className="list-disc pl-5 mt-1 text-[12px] leading-6">
                                  {e.bullets.map((b, j) => (
                                    <li key={j}>{b}</li>
                                  ))}
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
            {(skills.length > 0 ||
              certifications.filter(Boolean).length > 0) && (
              <section>
                <h2 className="text-[11px] font-extrabold tracking-wider border-b pb-1">
                  SKILLS &amp; CERTIFICATIONS
                </h2>
                {skills.length > 0 && (
                  <p className="mt-3 text-[12px]">
                    <span className="font-semibold">Skills: </span>
                    {skills
                      .map((s) => s.label)
                      .filter(Boolean)
                      .join(", ")}
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

      {/* Estilos específicos para el phone input */}
      <style jsx global>{`
        .cv-phone-input label {
          font-size: 0.875rem;
          font-weight: 500;
          color: rgb(39 39 42); /* text-zinc-800 */
          margin-bottom: 0.375rem;
        }

        .cv-phone-input input {
          font-size: 0.875rem; /* igual que los demás inputs */
        }
      `}</style>

      {/* ====== Estilos impresión/global ====== */}
      <style jsx global>{`
        /* Mostrar la hoja oculta durante la exportación a canvas */
        body[data-exporting="1"] .cv-print-root {
          display: block !important;
          position: fixed;
          left: -10000px;
          top: 0;
        }
        body[data-exporting="1"] .cv-print-root .cv-sheet {
          box-shadow: none !important;
        }

        /* Hoja del CV en pantalla / export */
        .cv-sheet {
          width: 210mm; /* todo el ancho A4 */
          min-height: 297mm;
          background: #ffffff;
          margin: 0 auto;
        }

        /* Contenido interno del CV */
        .cv-sheet-inner {
          padding: 0 12mm 12mm !important; /* sin padding arriba */
        }

        /* Fuente y color base en la hoja del CV */
        .cv-sheet,
        .cv-sheet * {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
        }

        .cv-header h1,
        .cv-header .cv-meta-row span,
        .cv-sheet section {
          color: #000000 !important;
        }

        /* Header con un poco de aire superior */
        .cv-header {
          margin-top: 8mm !important; /* aire arriba */
          margin-bottom: 6mm !important;
          padding-top: 0 !important;
        }

        .cv-name {
          font-size: 18pt;
          font-weight: 700;
          margin: 0 0 2mm;
        }

        .cv-meta-row {
          margin: 0;
          font-size: 10pt;
          line-height: 1.4;
        }

        .cv-meta-row span + span::before {
          content: " · ";
          margin: 0 2px;
        }

        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          body * {
            visibility: hidden !important;
          }
          .cv-print-root,
          .cv-print-root * {
            visibility: visible !important;
          }
          .cv-print-root {
            position: fixed;
            inset: 0;
            margin: 0;
            padding: 0;
          }

          .cv-sheet {
            box-shadow: none !important;
            border: 0 !important;
            background: #ffffff !important;
            margin: 0 auto;
          }

          .cv-sheet-inner {
            padding: 0 12mm 12mm !important; /* mismo padding en print */
          }

          .cv-sheet,
          .cv-sheet * {
            color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .cv-header {
            margin-top: 8mm !important;
            margin-bottom: 6mm !important;
            padding-top: 0 !important;
          }

          @page {
            size: A4;
            margin: 0; /* sin margen extra del navegador */
          }

          .cv-sheet section,
          .cv-sheet header {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
