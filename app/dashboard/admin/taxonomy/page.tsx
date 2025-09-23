// app/dashboard/admin/taxonomy/page.tsx
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getSkillsFromDB, getCertificationsFromDB } from "@/lib/skills"

export const metadata = { title: "Admin · Taxonomía" }

export default async function TaxonomyAdminPage() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session) redirect(`/signin?callbackUrl=/dashboard/admin/taxonomy`)
  if (role !== "ADMIN") redirect("/")

  const skills = await getSkillsFromDB()
  const certs  = await getCertificationsFromDB()

  async function updateSkillsAction(fd: FormData) {
    "use server"
    const raw = String(fd.get("skills") || "")
    const items = raw
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean)

    await prisma.taxonomy.upsert({
      where: { kind: "SKILLS" },
      update: { items },
      create: { kind: "SKILLS", items },
    })
    revalidatePath("/dashboard/admin/taxonomy")
  }

  async function updateCertsAction(fd: FormData) {
    "use server"
    const raw = String(fd.get("certs") || "")
    const items = raw
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean)

    await prisma.taxonomy.upsert({
      where: { kind: "CERTIFICATIONS" },
      update: { items },
      create: { kind: "CERTIFICATIONS", items },
    })
    revalidatePath("/dashboard/admin/taxonomy")
  }

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-8">
      <h1 className="text-2xl font-bold">Taxonomía (Admin)</h1>
      <p className="text-sm text-zinc-600">
        Edita el vocabulario base que se usa en la creación de vacantes y perfiles de candidatos.
      </p>

      {/* Skills */}
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">Skills / Tecnologías</h2>
        <form action={updateSkillsAction} className="space-y-3">
          <textarea
            name="skills"
            className="w-full h-64 border rounded-xl p-3 font-mono text-sm"
            defaultValue={skills.join("\n")}
            aria-label="Lista de skills, una por línea"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">Una por línea. Se guarda exactamente como se escriba.</p>
            <button className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">
              Guardar skills
            </button>
          </div>
        </form>
      </section>

      {/* Certificaciones */}
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">Certificaciones</h2>
        <form action={updateCertsAction} className="space-y-3">
          <textarea
            name="certs"
            className="w-full h-48 border rounded-xl p-3 font-mono text-sm"
            defaultValue={certs.join("\n")}
            aria-label="Lista de certificaciones, una por línea"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">Una por línea.</p>
            <button className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">
              Guardar certificaciones
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
