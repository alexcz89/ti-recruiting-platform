// app/dashboard/admin/taxonomy/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSkillsFromDB, getCertificationsFromDB } from "@/lib/skills";
import { fromNow } from "@/lib/dates";

export const metadata = { title: "Admin · Taxonomía" };

/** Utilidades servidor */
function parseList(input: string): string[] {
  // Acepta comas o saltos de línea, limpia, quita duplicados y ordena
  const items = (input || "")
    .split(/[\n,]/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(items)).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}
function listToTextarea(items?: string[] | null): string {
  return (items ?? []).join("\n");
}

export default async function TaxonomyAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/signin?callbackUrl=/dashboard/admin/taxonomy`);
  const role = (session.user as any)?.role;
  if (role !== "ADMIN") redirect("/");

  // Lee valores actuales
  const skills = await getSkillsFromDB();
  const certs = await getCertificationsFromDB();

  // Timestamps (opcional)
  const skillsMeta = await prisma.taxonomy.findUnique({
    where: { kind: "SKILLS" },
    select: { updatedAt: true },
  });
  const certsMeta = await prisma.taxonomy.findUnique({
    where: { kind: "CERTIFICATIONS" },
    select: { updatedAt: true },
  });

  /** ---------------- Server Actions ---------------- */
  async function updateSkillsAction(fd: FormData) {
    "use server";
    const s = await getServerSession(authOptions);
    if (!s?.user) return { error: "No autenticado" };
    if ((s.user as any)?.role !== "ADMIN") return { error: "Sin permisos" };

    const items = parseList(String(fd.get("skills") || ""));
    await prisma.taxonomy.upsert({
      where: { kind: "SKILLS" },
      update: { items },
      create: { kind: "SKILLS", items },
    });

    revalidatePath("/dashboard/admin/taxonomy");
    revalidatePath("/dashboard/jobs/new");
    revalidatePath("/dashboard/jobs/wizard");
    revalidatePath("/profile/edit");
    return { ok: true };
  }

  async function updateCertsAction(fd: FormData) {
    "use server";
    const s = await getServerSession(authOptions);
    if (!s?.user) return { error: "No autenticado" };
    if ((s.user as any)?.role !== "ADMIN") return { error: "Sin permisos" };

    const items = parseList(String(fd.get("certs") || ""));
    await prisma.taxonomy.upsert({
      where: { kind: "CERTIFICATIONS" },
      update: { items },
      create: { kind: "CERTIFICATIONS", items },
    });

    revalidatePath("/dashboard/admin/taxonomy");
    revalidatePath("/dashboard/jobs/new");
    revalidatePath("/dashboard/jobs/wizard");
    revalidatePath("/profile/edit");
    return { ok: true };
  }

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Taxonomía (Admin)</h1>
          <p className="text-sm text-zinc-600">
            Edita el vocabulario base usado en vacantes y perfiles.
          </p>
        </div>
      </header>

      {/* Skills */}
      <section className="rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Skills / Tecnologías</h2>
          {skillsMeta?.updatedAt && (
            <span className="text-xs text-zinc-500" title={new Date(skillsMeta.updatedAt).toLocaleString()}>
              Actualizado: {fromNow(skillsMeta.updatedAt)}
            </span>
          )}
        </div>

        {/* Client Form con RHF + Zod */}
        <SkillsFormClient
          defaultValue={listToTextarea(skills)}
          onAction={updateSkillsAction}
        />
      </section>

      {/* Certificaciones */}
      <section className="rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Certificaciones</h2>
          {certsMeta?.updatedAt && (
            <span className="text-xs text-zinc-500" title={new Date(certsMeta.updatedAt).toLocaleString()}>
              Actualizado: {fromNow(certsMeta.updatedAt)}
            </span>
          )}
        </div>

        {/* Client Form con RHF + Zod */}
        <CertsFormClient
          defaultValue={listToTextarea(certs)}
          onAction={updateCertsAction}
        />
      </section>
    </main>
  );
}

/** ================= Client Forms ================== */
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
function SkillsFormClient({
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
function CertsFormClient({
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
