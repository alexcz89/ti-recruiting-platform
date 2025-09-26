// app/dashboard/jobs/JobForm.tsx
"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

const EMPLOYMENT_TYPES = ["FULL_TIME","PART_TIME","CONTRACT","INTERNSHIP"] as const;
const SENIORITIES = ["JUNIOR","MID","SENIOR","LEAD"] as const;

// Esquema específico de este form (independiente de lib/validation.ts)
const JobFormSchema = z.object({
  title: z.string().min(3, "Título requerido"),
  company: z.string().min(2, "Empresa requerida"),
  location: z.string().min(2, "Ubicación requerida"),
  employmentType: z.enum(EMPLOYMENT_TYPES, { required_error: "Tipo de contrato requerido" }),
  seniority: z.enum(SENIORITIES, { required_error: "Seniority requerido" }),
  description: z.string().min(10, "Descripción muy corta"),
  skillsCsv: z.string().optional().default(""), // se transforma a array en el submit
  salaryMin: z.coerce.number().min(0, "No negativo").optional().nullable(),
  salaryMax: z.coerce.number().min(0, "No negativo").optional().nullable(),
  currency: z.string().optional().default("MXN"),
  remote: z.boolean().optional().default(false),
});

type FormShape = z.infer<typeof JobFormSchema>;

export type JobInitial = {
  title?: string;
  company?: string;
  location?: string;
  employmentType?: string;
  seniority?: string;
  description?: string;
  skills?: string[];
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  remote?: boolean;
};

export default function JobForm({
  initial,
  onSubmit,
  submitLabel = "Guardar vacante",
}: {
  initial?: JobInitial;
  onSubmit: (fd: FormData) => Promise<void>;
  submitLabel?: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<FormShape>({
    resolver: zodResolver(JobFormSchema),
    defaultValues: {
      title: initial?.title ?? "",
      company: initial?.company ?? "",
      location: initial?.location ?? "",
      employmentType: (initial?.employmentType as FormShape["employmentType"]) ?? "FULL_TIME",
      seniority: (initial?.seniority as FormShape["seniority"]) ?? "MID",
      description: initial?.description ?? "",
      skillsCsv: (initial?.skills ?? []).join(", "),
      salaryMin: initial?.salaryMin ?? undefined,
      salaryMax: initial?.salaryMax ?? undefined,
      currency: initial?.currency ?? "MXN",
      remote: initial?.remote ?? false,
    },
  });

  const onSubmitRHF = async (vals: FormShape) => {
    // Valida rango salario (opcional)
    if ((vals.salaryMin ?? 0) > (vals.salaryMax ?? 0)) {
      toast.error("El salario mínimo no puede ser mayor que el máximo");
      return;
    }

    const skills = (vals.skillsCsv || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const fd = new FormData();
    fd.set("title", vals.title);
    fd.set("company", vals.company);
    fd.set("location", vals.location);
    fd.set("employmentType", vals.employmentType);
    fd.set("seniority", vals.seniority);
    fd.set("description", vals.description);
    fd.set("skills", skills.join(", "));
    if (vals.salaryMin != null && !Number.isNaN(vals.salaryMin)) fd.set("salaryMin", String(vals.salaryMin));
    if (vals.salaryMax != null && !Number.isNaN(vals.salaryMax)) fd.set("salaryMax", String(vals.salaryMax));
    fd.set("currency", vals.currency || "");
    fd.set("remote", String(!!vals.remote));

    await onSubmit(fd);
    toast.success("Vacante guardada");
  };

  return (
    <form onSubmit={handleSubmit(onSubmitRHF)} className="space-y-4 max-w-3xl">
      <div className="grid md:grid-cols-2 gap-3">
        <div className="grid gap-2">
          <label className="text-sm">Título *</label>
          <input className="border rounded-xl p-3" {...register("title")} />
          {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
        </div>
        <div className="grid gap-2">
          <label className="text-sm">Empresa *</label>
          <input className="border rounded-xl p-3" {...register("company")} />
          {errors.company && <p className="text-xs text-red-600">{errors.company.message}</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="grid gap-2">
          <label className="text-sm">Ubicación *</label>
          <input className="border rounded-xl p-3" {...register("location")} />
          {errors.location && <p className="text-xs text-red-600">{errors.location.message}</p>}
        </div>
        <div className="grid gap-2">
          <label className="text-sm">Tipo de contrato *</label>
          <select className="border rounded-xl p-3" {...register("employmentType")}>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {errors.employmentType && <p className="text-xs text-red-600">{errors.employmentType.message}</p>}
        </div>
        <div className="grid gap-2">
          <label className="text-sm">Seniority *</label>
          <select className="border rounded-xl p-3" {...register("seniority")}>
            {SENIORITIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {errors.seniority && <p className="text-xs text-red-600">{errors.seniority.message}</p>}
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm">Descripción *</label>
        <textarea className="border rounded-xl p-3" rows={8} {...register("description")} />
        {errors.description && <p className="text-xs text-red-600">{errors.description.message}</p>}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="grid gap-2">
          <label className="text-sm">Skills (separadas por coma)</label>
          <input className="border rounded-xl p-3" placeholder="react, node, sql" {...register("skillsCsv")} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-2">
            <label className="text-sm">Salario mín.</label>
            <input type="number" className="border rounded-xl p-3" {...register("salaryMin")} />
            {errors.salaryMin && <p className="text-xs text-red-600">{errors.salaryMin.message}</p>}
          </div>
          <div className="grid gap-2">
            <label className="text-sm">Salario máx.</label>
            <input type="number" className="border rounded-xl p-3" {...register("salaryMax")} />
            {errors.salaryMax && <p className="text-xs text-red-600">{errors.salaryMax.message}</p>}
          </div>
          <div className="grid gap-2">
            <label className="text-sm">Moneda</label>
            <input className="border rounded-xl p-3" placeholder="MXN" {...register("currency")} />
          </div>
        </div>
      </div>

      <label className="inline-flex items-center gap-2">
        <input type="checkbox" {...register("remote")} />
        <span className="text-sm">Remoto</span>
      </label>

      <div>
        <button type="submit" disabled={isSubmitting} className="border rounded-xl px-4 py-2">
          {isSubmitting ? "Guardando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
