// app/dashboard/admin/taxonomy/TaxonomyFormsClient.tsx
"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toastSuccess, toastError } from "@/lib/ui/toast";

/** --------- Schemas Zod (cliente) --------- */
const SkillsSchema = z.object({
  skills: z
    .string()
    .min(1, "Ingresa al menos un skill")
    .max(10000, "Texto demasiado largo"),
});
type SkillsFormData = z.infer<typeof SkillsSchema>;

const CertsSchema = z.object({
  certs: z
    .string()
    .min(1, "Ingresa al menos una certificación")
    .max(10000, "Texto demasiado largo"),
});
type CertsFormData = z.infer<typeof CertsSchema>;

/** --------- Skills Form (client) --------- */
export function SkillsFormClient({
  defaultValue,
  onAction,
}: {
  defaultValue: string;
  onAction: (fd: FormData) => Promise<{ ok?: boolean; error?: string }>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SkillsFormData>({
    resolver: zodResolver(SkillsSchema),
    defaultValues: { skills: defaultValue },
  });

  const onSubmit = async (data: SkillsFormData) => {
    const fd = new FormData();
    fd.set("skills", data.skills);
    const res = await onAction(fd);
    if (res?.error) {
      toastError(res.error);
      return;
    }
    toastSuccess("Skills guardadas");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-2 space-y-3">
      <p className="text-xs text-zinc-500">
        Un skill por línea o separados por comas. Se guardan tal cual los
        escribas.
      </p>
      <textarea
        className="h-72 w-full rounded-xl border p-3 font-mono text-sm"
        aria-label="Lista de skills"
        {...register("skills")}
      />
      {errors.skills && (
        <p className="text-xs text-red-600">{errors.skills.message}</p>
      )}
      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
        >
          {isSubmitting ? "Guardando..." : "Guardar skills"}
        </button>
      </div>
    </form>
  );
}

/** --------- Certs Form (client) --------- */
export function CertsFormClient({
  defaultValue,
  onAction,
}: {
  defaultValue: string;
  onAction: (fd: FormData) => Promise<{ ok?: boolean; error?: string }>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CertsFormData>({
    resolver: zodResolver(CertsSchema),
    defaultValues: { certs: defaultValue },
  });

  const onSubmit = async (data: CertsFormData) => {
    const fd = new FormData();
    fd.set("certs", data.certs);
    const res = await onAction(fd);
    if (res?.error) {
      toastError(res.error);
      return;
    }
    toastSuccess("Certificaciones guardadas");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-2 space-y-3">
      <p className="text-xs text-zinc-500">
        Una certificación por línea o separadas por comas.
      </p>
      <textarea
        className="h-60 w-full rounded-xl border p-3 font-mono text-sm"
        aria-label="Lista de certificaciones"
        {...register("certs")}
      />
      {errors.certs && (
        <p className="text-xs text-red-600">{errors.certs.message}</p>
      )}
      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
        >
          {isSubmitting ? "Guardando..." : "Guardar certificaciones"}
        </button>
      </div>
    </form>
  );
}
