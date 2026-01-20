// app/dashboard/admin/taxonomy/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { redirect } from "next/navigation";
import { prisma } from '@/lib/server/prisma';
import { revalidatePath } from "next/cache";
import { getSkillsFromDB, getCertificationsFromDB } from "@/lib/skills";
import { fromNow } from "@/lib/dates";
import {
  SkillsFormClient,
  CertsFormClient,
} from "./TaxonomyFormsClient";

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

function slugify(label: string): string {
  return label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default async function TaxonomyAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/signin?callbackUrl=/dashboard/admin/taxonomy`);
  const role = (session.user as any)?.role;
  if (role !== "ADMIN") redirect("/");

  // Lee valores actuales (desde lib/skills, ya adaptado a taxonomyTerm)
  const skills = await getSkillsFromDB();
  const certs = await getCertificationsFromDB();

  // Timestamps: tomamos el último taxonomyTerm de cada kind
  const skillsMeta = await prisma.taxonomyTerm.findFirst({
    where: { kind: "SKILL" },
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });
  const certsMeta = await prisma.taxonomyTerm.findFirst({
    where: { kind: "CERTIFICATION" },
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });

  /** ---------------- Server Actions ---------------- */
  async function updateSkillsAction(fd: FormData) {
    "use server";
    const s = await getServerSession(authOptions);
    if (!s?.user) return { error: "No autenticado" };
    if ((s.user as any)?.role !== "ADMIN") return { error: "Sin permisos" };

    const items = parseList(String(fd.get("skills") || ""));

    // Obtenemos skills existentes para no duplicar por label
    const existing = await prisma.taxonomyTerm.findMany({
      where: { kind: "SKILL" },
      select: { id: true, label: true },
    });
    const existingSet = new Set(
      existing.map((t) => t.label.trim().toLowerCase())
    );

    const toCreate = items.filter(
      (label) => !existingSet.has(label.trim().toLowerCase())
    );

    if (toCreate.length) {
      await prisma.taxonomyTerm.createMany({
        data: toCreate.map((label) => ({
          kind: "SKILL",
          label,
          slug: slugify(label),
        })),
        skipDuplicates: true,
      });
    }

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

    const existing = await prisma.taxonomyTerm.findMany({
      where: { kind: "CERTIFICATION" },
      select: { id: true, label: true },
    });
    const existingSet = new Set(
      existing.map((t) => t.label.trim().toLowerCase())
    );

    const toCreate = items.filter(
      (label) => !existingSet.has(label.trim().toLowerCase())
    );

    if (toCreate.length) {
      await prisma.taxonomyTerm.createMany({
        data: toCreate.map((label) => ({
          kind: "CERTIFICATION",
          label,
          slug: slugify(label),
        })),
        skipDuplicates: true,
      });
    }

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
            <span
              className="text-xs text-zinc-500"
              title={new Date(skillsMeta.updatedAt).toLocaleString()}
            >
              Actualizado: {fromNow(skillsMeta.updatedAt)}
            </span>
          )}
        </div>

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
            <span
              className="text-xs text-zinc-500"
              title={new Date(certsMeta.updatedAt).toLocaleString()}
            >
              Actualizado: {fromNow(certsMeta.updatedAt)}
            </span>
          )}
        </div>

        <CertsFormClient
          defaultValue={listToTextarea(certs)}
          onAction={updateCertsAction}
        />
      </section>
    </main>
  );
}
