// components/resume/ResumeWizard.tsx
"use client";

import { useEffect } from "react";
import { useForm, useFieldArray, FormProvider } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toastSuccess, toastError, toastInfo, toastWarning } from "@/lib/ui/toast";

/* =============== Helpers =============== */
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function ymToISO(ym?: string | null) {
  if (!ym) return "";
  return MONTH_RE.test(ym) ? `${ym}-01` : "";
}

function dmyToISO(dmy?: string | null): string | "" {
  if (!dmy) return "";
  const m = dmy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm}-${dd}`;
  const dt = new Date(iso);
  return isNaN(dt.getTime()) ? "" : iso;
}

function normalizeUrl(u?: string | null) {
  const v = (u || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

/* =============== Schema =============== */
const EducationLevelEnum = z.enum([
  "NONE","PRIMARY","SECONDARY","HIGH_SCHOOL","TECHNICAL","BACHELOR","MASTER","DOCTORATE","OTHER",
]);

const PersonalSchema = z.object({
  fullName: z.string().min(1, "Nombre requerido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  birthDateDMY: z.string().regex(/^$|^\d{2}\/\d{2}\/\d{4}$/, "Usa formato dd/mm/aaaa").optional().or(z.literal("")),
  linkedin: z.string().optional().or(z.literal("")),
  github: z.string().optional().or(z.literal("")),
});

const EducationItem = z.object({
  institution: z.string().min(1, "Institución requerida"),
  program: z.string().optional().or(z.literal("")),
  level: EducationLevelEnum.nullable().optional(),
  startDate: z.string().optional().or(z.literal("")), // YYYY-MM
  endDate: z.string().optional().or(z.literal("")),   // YYYY-MM
});

const WorkItem = z.object({
  company: z.string().min(1, "Empresa requerida"),
  role: z.string().min(1, "Puesto requerido"),
  startDate: z.string().optional().or(z.literal("")), // YYYY-MM
  endDate: z.string().optional().or(z.literal("")),   // YYYY-MM
  isCurrent: z.boolean().optional(),
  // ⬇️ Solo UI (no se persiste)
  description: z.string().optional().or(z.literal("")),
});

const SkillItem = z.object({
  name: z.string().min(1, "Skill requerido"),
  level: z.number().int().min(1).max(5).optional(), // 1–5
});

const LanguageItem = z.object({
  name: z.string().min(1, "Idioma requerido"),
  level: z.enum(["NATIVE","PROFESSIONAL","CONVERSATIONAL","BASIC"]),
});

const CertificationItem = z.object({
  name: z.string().min(1, "Nombre requerido"),
  issuer: z.string().optional().or(z.literal("")),
  date: z.string().optional().or(z.literal("")), // YYYY-MM
  url: z.string().optional().or(z.literal("")),
});

const ResumeSchema = z.object({
  personal: PersonalSchema,
  about: z.string().optional().or(z.literal("")),
  experience: z.array(WorkItem).default([]),
  education: z.array(EducationItem).default([]),
  skills: z.array(SkillItem).default([]),
  languages: z.array(LanguageItem).default([]),
  certifications: z.array(CertificationItem).default([]),
});

type ResumeForm = z.infer<typeof ResumeSchema>;

const EDUCATION_LEVEL_OPTIONS = [
  { value: "HIGH_SCHOOL" as const, label: "Preparatoria / Bachillerato" },
  { value: "TECHNICAL" as const,   label: "Técnico / TSU" },
  { value: "BACHELOR" as const,    label: "Licenciatura / Ingeniería" },
  { value: "MASTER" as const,      label: "Maestría" },
  { value: "DOCTORATE" as const,   label: "Doctorado" },
  { value: "OTHER" as const,       label: "Diplomado / Curso" },
];

const SKILL_LEVELS = [
  { value: 1 as const, label: "Básico" },
  { value: 2 as const, label: "Junior" },
  { value: 3 as const, label: "Intermedio" },
  { value: 4 as const, label: "Avanzado" },
  { value: 5 as const, label: "Experto" },
];

type Props = { initialData?: Partial<ResumeForm> };

export default function ResumeWizard({ initialData }: Props) {
  const methods = useForm<ResumeForm>({
    resolver: zodResolver(ResumeSchema),
    defaultValues: {
      personal: {
        fullName: initialData?.personal?.fullName ?? "",
        email: initialData?.personal?.email ?? "",
        phone: initialData?.personal?.phone ?? "",
        location: initialData?.personal?.location ?? "",
        birthDateDMY: (() => {
          const iso = (initialData?.personal as any)?.birthDate ?? "";
          if (!iso) return "";
          const [y, m, d] = String(iso).split("-");
          return y && m && d ? `${d}/${m}/${y}` : "";
        })(),
        linkedin: initialData?.personal?.linkedin ?? "",
        github: initialData?.personal?.github ?? "",
      },
      about: initialData?.about ?? "",
      experience: initialData?.experience ?? [],
      education: initialData?.education ?? [],
      skills: initialData?.skills ?? [],
      languages: initialData?.languages ?? [],
      certifications: initialData?.certifications ?? [],
    },
  });

  const { control, register, handleSubmit, reset, formState: { isSubmitting, errors } } = methods;

  const expFA   = useFieldArray({ control, name: "experience" });
  const eduFA   = useFieldArray({ control, name: "education" });
  const skillFA = useFieldArray({ control, name: "skills" });
  const langFA  = useFieldArray({ control, name: "languages" });
  const certFA  = useFieldArray({ control, name: "certifications" });

  useEffect(() => {
    if (!initialData) return;
    reset({
      personal: {
        fullName: initialData.personal?.fullName ?? "",
        email: initialData.personal?.email ?? "",
        phone: initialData.personal?.phone ?? "",
        location: initialData.personal?.location ?? "",
        birthDateDMY: (() => {
          const iso = (initialData?.personal as any)?.birthDate ?? "";
          if (!iso) return "";
          const [y, m, d] = String(iso).split("-");
          return y && m && d ? `${d}/${m}/${y}` : "";
        })(),
        linkedin: initialData.personal?.linkedin ?? "",
        github: initialData.personal?.github ?? "",
      },
      about: initialData.about ?? "",
      experience: initialData.experience ?? [],
      education: initialData.education ?? [],
      skills: initialData.skills ?? [],
      languages: initialData.languages ?? [],
      certifications: initialData.certifications ?? [],
    });
  }, [initialData, reset]);

  async function onSubmit(values: ResumeForm) {
    try {
      const payload = {
        personal: {
          fullName: values.personal.fullName,
          email: values.personal.email || "",
          phone: values.personal.phone || "",
          location: values.personal.location || "",
          birthDate: dmyToISO(values.personal.birthDateDMY) || "",
          linkedin: normalizeUrl(values.personal.linkedin) || "",
          github: normalizeUrl(values.personal.github) || "",
        },
        about: values.about || "",
        // ⛔ NO enviar description al backend (solo se usa en UI/PDF)
        experience: (values.experience || []).map((w) => ({
          company: w.company,
          role: w.role,
          startDate: ymToISO(w.startDate) || "",
          endDate: w.isCurrent ? "" : (ymToISO(w.endDate) || ""),
          isCurrent: !!w.isCurrent,
        })),
        education: (values.education || []).map((e, idx) => ({
          institution: e.institution,
          program: e.program || "",
          level: e.level ?? "",
          status: e.endDate ? "COMPLETED" : "ONGOING",
          country: "",
          city: "",
          startDate: ymToISO(e.startDate) || "",
          endDate: e.endDate ? ymToISO(e.endDate) : "",
          grade: "",
          description: "",
          sortIndex: idx,
        })),
        skills: (values.skills || []).map((s) => ({ name: s.name, level: s.level ?? 3 })),
        languages: (values.languages || []).map((l) => ({ name: l.name, level: l.level })),
        certifications: (values.certifications || []).map((c) => ({
          name: c.name,
          issuer: c.issuer || "",
          date: ymToISO(c.date) || "",
          url: normalizeUrl(c.url) || "",
        })),
      };

      const res = await fetch("/api/candidate/resume/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "No se pudo guardar el CV");
      }

      const data = await res.json();
      toastSuccess("CV guardado correctamente", {
        description: `Experiencia: ${data.counts?.experience ?? 0} · Educación: ${data.counts?.education ?? 0} · Skills: ${data.counts?.skills ?? 0}`,
      });
    } catch (e: any) {
      toastError("Error al guardar", { description: e?.message ?? "Intenta de nuevo" });
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
        {/* Datos personales */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Datos personales y contacto</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm text-neutral-600">Nombre completo *</label>
              <input {...register("personal.fullName")} className="w-full rounded-md border border-neutral-300 p-2" />
              {errors.personal?.fullName && <p className="mt-1 text-sm text-red-600">{String(errors.personal.fullName.message)}</p>}
            </div>
            <div>
              <label className="block text-sm text-neutral-600">Email</label>
              <input type="email" {...register("personal.email")} className="w-full rounded-md border border-neutral-300 p-2" />
            </div>
            <div>
              <label className="block text-sm text-neutral-600">Teléfono</label>
              <input {...register("personal.phone")} className="w-full rounded-md border border-neutral-300 p-2" />
            </div>
            <div>
              <label className="block text-sm text-neutral-600">Lugar de residencia</label>
              <input {...register("personal.location")} className="w-full rounded-md border border-neutral-300 p-2" />
            </div>
            <div>
              <label className="block text-sm text-neutral-600">Fecha de nacimiento (dd/mm/aaaa)</label>
              <input {...register("personal.birthDateDMY")} className="w-full rounded-md border border-neutral-300 p-2" placeholder="27/06/1989" />
              {errors.personal?.birthDateDMY && <p className="mt-1 text-sm text-red-600">{String(errors.personal.birthDateDMY.message)}</p>}
            </div>
            <div>
              <label className="block text-sm text-neutral-600">LinkedIn</label>
              <input {...register("personal.linkedin")} className="w-full rounded-md border border-neutral-300 p-2" placeholder="linkedin.com/in/tu-usuario" />
            </div>
            <div>
              <label className="block text-sm text-neutral-600">GitHub</label>
              <input {...register("personal.github")} className="w-full rounded-md border border-neutral-300 p-2" placeholder="github.com/tu-usuario" />
            </div>
          </div>
        </section>

        {/* About */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Acerca de ti</h2>
          <textarea {...register("about")} rows={4} className="w-full rounded-lg border border-neutral-300 p-3 outline-none focus:ring-2 focus:ring-emerald-400" />
        </section>

        {/* Experiencia */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Experiencia laboral</h2>
            <button
              type="button"
              onClick={() => expFA.append({ company: "", role: "", startDate: "", endDate: "", isCurrent: false, description: "" })}
              className="rounded-md border px-3 py-1.5 hover:bg-gray-50"
            >
              + Agregar experiencia
            </button>
          </div>
          <div className="space-y-6">
            {expFA.fields.map((f, idx) => (
              <div key={f.id} className="rounded-xl border border-neutral-200 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm text-neutral-600">Empresa</label>
                    <input {...register(`experience.${idx}.company` as const)} className="w-full rounded-md border border-neutral-300 p-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-600">Puesto</label>
                    <input {...register(`experience.${idx}.role` as const)} className="w-full rounded-md border border-neutral-300 p-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-600">Inicio</label>
                    <input type="month" {...register(`experience.${idx}.startDate` as const)} className="w-full rounded-md border border-neutral-300 p-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-600">Fin</label>
                    <input type="month" {...register(`experience.${idx}.endDate` as const)} className="w-full rounded-md border border-neutral-300 p-2" />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <input type="checkbox" {...register(`experience.${idx}.isCurrent` as const)} />
                    <span className="text-sm">Actualmente aquí</span>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm text-neutral-600">Descripción / logros</label>
                    <textarea rows={3} {...register(`experience.${idx}.description` as const)} className="w-full rounded-md border border-neutral-300 p-2" />
                  </div>
                </div>
                <div className="mt-3 text-right">
                  <button type="button" onClick={() => expFA.remove(idx)} className="rounded-md border border-red-200 px-3 py-1.5 text-red-600 hover:bg-red-50">
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
            {expFA.fields.length === 0 && <p className="text-sm text-neutral-500">Aún no agregas experiencia.</p>}
          </div>
        </section>

        {/* Educación */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Educación</h2>
            <button
              type="button"
              onClick={() => eduFA.append({ institution: "", program: "", level: null, startDate: "", endDate: "" })}
              className="rounded-md border px-3 py-1.5 hover:bg-gray-50"
            >
              + Agregar educación
            </button>
          </div>
          <div className="space-y-6">
            {eduFA.fields.map((f, idx) => (
              <div key={f.id} className="rounded-xl border border-neutral-200 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm text-neutral-600">Nivel</label>
                    <select {...register(`education.${idx}.level` as const)} className="w-full rounded-md border border-neutral-300 p-2">
                      <option value="">—</option>
                      {EDUCATION_LEVEL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-600">Institución *</label>
                    <input {...register(`education.${idx}.institution` as const)} className="w-full rounded-md border border-neutral-300 p-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-600">Programa</label>
                    <input {...register(`education.${idx}.program` as const)} className="w-full rounded-md border border-neutral-300 p-2" placeholder="Ej. Ingeniería en Sistemas" />
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-600">Inicio</label>
                    <input type="month" {...register(`education.${idx}.startDate` as const)} className="w-full rounded-md border border-neutral-300 p-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-600">Fin</label>
                    <input type="month" {...register(`education.${idx}.endDate` as const)} className="w-full rounded-md border border-neutral-300 p-2" />
                    <p className="text-[11px] text-neutral-500 mt-1">Déjalo vacío si sigues cursando.</p>
                  </div>
                </div>
                <div className="mt-3 text-right">
                  <button type="button" onClick={() => eduFA.remove(idx)} className="rounded-md border border-red-200 px-3 py-1.5 text-red-600 hover:bg-red-50">
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
            {eduFA.fields.length === 0 && <p className="text-sm text-neutral-500">Aún no agregas educación.</p>}
          </div>
        </section>

        {/* Skills */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Skills</h2>
            <button
              type="button"
              onClick={() => skillFA.append({ name: "", level: 3 })}
              className="rounded-md border px-3 py-1.5 hover:bg-gray-50"
            >
              + Agregar skill
            </button>
          </div>
          <div className="space-y-4">
            {skillFA.fields.map((f, idx) => (
              <div key={f.id} className="grid items-end gap-3 sm:grid-cols-6">
                <div className="sm:col-span-4">
                  <label className="block text-sm text-neutral-600">Nombre</label>
                  <input {...register(`skills.${idx}.name` as const)} className="w-full rounded-md border border-neutral-300 p-2" />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm text-neutral-600">Nivel (1–5)</label>
                  <select {...register(`skills.${idx}.level` as const, { valueAsNumber: true })} className="w-full rounded-md border border-neutral-300 p-2">
                    {SKILL_LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => skillFA.remove(idx)}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-red-600 hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
            {skillFA.fields.length === 0 && <p className="text-sm text-neutral-500">Aún no agregas skills.</p>}
          </div>
        </section>

        {/* Idiomas */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Idiomas</h2>
            <button
              type="button"
              onClick={() => langFA.append({ name: "", level: "CONVERSATIONAL" })}
              className="rounded-md border px-3 py-1.5 hover:bg-gray-50"
            >
              + Agregar idioma
            </button>
          </div>
          <div className="space-y-4">
            {langFA.fields.map((f, idx) => (
              <div key={f.id} className="grid items-end gap-3 sm:grid-cols-6">
                <div className="sm:col-span-4">
                  <label className="block text-sm text-neutral-600">Idioma</label>
                  <input
                    {...register(`languages.${idx}.name` as const)}
                    className="w-full rounded-md border border-neutral-300 p-2"
                    placeholder="Ej. Inglés, Español…"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm text-neutral-600">Nivel</label>
                  <select {...register(`languages.${idx}.level` as const)} className="w-full rounded-md border border-neutral-300 p-2">
                    <option value="NATIVE">Nativo</option>
                    <option value="PROFESSIONAL">Profesional</option>
                    <option value="CONVERSATIONAL">Conversacional</option>
                    <option value="BASIC">Básico</option>
                  </select>
                </div>
                <div className="sm:col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => langFA.remove(idx)}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-red-600 hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
            {langFA.fields.length === 0 && <p className="text-sm text-neutral-500">Aún no agregas idiomas.</p>}
          </div>
        </section>

        {/* Certificaciones */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Certificaciones</h2>
            <button
              type="button"
              onClick={() => certFA.append({ name: "", issuer: "", date: "", url: "" })}
              className="rounded-md border px-3 py-1.5 hover:bg-gray-50"
            >
              + Agregar certificación
            </button>
          </div>
          <div className="space-y-4">
            {certFA.fields.map((f, idx) => (
              <div key={f.id} className="grid items-end gap-3 sm:grid-cols-6">
                <div className="sm:col-span-2">
                  <label className="block text-sm text-neutral-600">Nombre</label>
                  <input {...register(`certifications.${idx}.name` as const)} className="w-full rounded-md border border-neutral-300 p-2" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-neutral-600">Emisor</label>
                  <input {...register(`certifications.${idx}.issuer` as const)} className="w-full rounded-md border border-neutral-300 p-2" />
                </div>
                <div>
                  <label className="block text-sm text-neutral-600">Fecha</label>
                  <input type="month" {...register(`certifications.${idx}.date` as const)} className="w-full rounded-md border border-neutral-300 p-2" />
                </div>
                <div>
                  <label className="block text-sm text-neutral-600">URL</label>
                  <input
                    {...register(`certifications.${idx}.url` as const)}
                    className="w-full rounded-md border border-neutral-300 p-2"
                    placeholder="tu-cert.org/credencial/123"
                  />
                </div>
                <div className="sm:col-span-6 text-right">
                  <button
                    type="button"
                    onClick={() => certFA.remove(idx)}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-red-600 hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
            {certFA.fields.length === 0 && <p className="text-sm text-neutral-500">Aún no agregas certificaciones.</p>}
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {isSubmitting ? "Guardando..." : "Guardar CV"}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
