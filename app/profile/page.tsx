// app/profile/page.tsx
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import ProfileForm from "./ProfileForm"

export const metadata = { title: "Editar perfil | Bolsa TI" }

/**
 * Split robusto de un teléfono E.164 en partes (country/local).
 * - Para MX (+52): siempre toma los ÚLTIMOS 10 dígitos como local.
 * - Genérico: país = 1–3 dígitos, local = resto (6–15).
 */
function parseE164ToParts(e164?: string | null) {
  if (!e164) return { phoneCountry: "52", phoneLocal: "" }
  const digits = e164.replace(/\D+/g, "")
  if (digits.startsWith("52")) {
    return { phoneCountry: "52", phoneLocal: digits.slice(-10) }
  }
  let countryLen = 1
  if (digits.length > 9) countryLen = 3
  else if (digits.length > 8) countryLen = 2
  const phoneCountry = digits.slice(0, countryLen) || "52"
  const phoneLocal = digits.slice(countryLen)
  return { phoneCountry, phoneLocal }
}

// ---- Server Action: guardar cambios y volver al resumen ----
async function saveProfileAction(fd: FormData) {
  "use server"
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return { error: "No autenticado" }

  // Asegura existencia del usuario (primer login) y que sea CANDIDATE
  const dbUser = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: session.user?.name ?? email.split("@")[0],
      passwordHash: "demo",
      role: "CANDIDATE",
    },
    select: { id: true },
  })

  const toList = (k: string) =>
    String(fd.get(k) || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)

  // Teléfono separado -> E.164 con validaciones
  let phoneCountry = String(fd.get("phoneCountry") || "52").replace(/\D+/g, "")
  let phoneLocalDigits = String(fd.get("phoneLocal") || "").replace(/\D+/g, "")

  if (phoneCountry === "52") {
    if (phoneLocalDigits.length > 10) phoneLocalDigits = phoneLocalDigits.slice(-10)
    if (phoneLocalDigits && phoneLocalDigits.length !== 10) {
      return { error: "Para México (+52), el número local debe tener exactamente 10 dígitos." }
    }
  } else {
    if (phoneLocalDigits && (phoneLocalDigits.length < 6 || phoneLocalDigits.length > 15)) {
      return { error: "El número local debe tener entre 6 y 15 dígitos." }
    }
  }
  const phone = phoneLocalDigits ? `+${phoneCountry}${phoneLocalDigits}` : null

  await prisma.user.update({
    where: { id: dbUser.id },
    data: {
      name: String(fd.get("name") || "") || null,
      location: String(fd.get("location") || "") || null,
      birthdate: fd.get("birthdate") ? new Date(String(fd.get("birthdate"))) : null,
      linkedin: String(fd.get("linkedin") || "") || null,
      github: String(fd.get("github") || "") || null,
      resumeUrl: String(fd.get("resumeUrl") || "") || null,
      phone,
      frontend: toList("frontend"),
      backend: toList("backend"),
      mobile: toList("mobile"),
      cloud: toList("cloud"),
      database: toList("database"),
      cybersecurity: toList("cybersecurity"),
      testing: toList("testing"),
      ai: toList("ai"),
      certifications: toList("certifications"),
    },
  })

  redirect("/profile/summary?updated=1")
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/signin?role=CANDIDATE&callbackUrl=/profile")

  // Solo candidatos pueden editar aquí
  const me = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: {
      role: true, name: true, email: true, phone: true, location: true,
      birthdate: true, linkedin: true, github: true, resumeUrl: true,
      frontend: true, backend: true, mobile: true, cloud: true, database: true,
      cybersecurity: true, testing: true, ai: true, certifications: true,
    },
  })

  if (!me) {
    // Si no existe aún, creamos entrada mínima y recargamos
    await prisma.user.create({
      data: {
        email: session.user.email!,
        name: session.user.name ?? session.user.email!.split("@")[0],
        passwordHash: "demo",
        role: "CANDIDATE",
      },
    })
    redirect("/profile") // vuelve ya con registro creado
  }

  if (me.role !== "CANDIDATE") {
    // Reclutadores/Admins no editan aquí
    redirect("/dashboard/overview")
  }

  const parts = parseE164ToParts(me.phone)
  const initial = {
    name: me.name ?? "",
    email: session.user.email!,
    phoneCountry: parts.phoneCountry || "52",
    phoneLocal: parts.phoneCountry === "52"
      ? (parts.phoneLocal || "").replace(/\D+/g, "").slice(-10)
      : (parts.phoneLocal || "").replace(/\D+/g, "").slice(0, 15),
    location: me.location ?? "",
    birthdate: me.birthdate ? new Date(me.birthdate).toISOString().slice(0, 10) : "",
    linkedin: me.linkedin ?? "",
    github: me.github ?? "",
    resumeUrl: me.resumeUrl ?? "",
    frontend: me.frontend ?? [],
    backend: me.backend ?? [],
    mobile: me.mobile ?? [],
    cloud: me.cloud ?? [],
    database: me.database ?? [],
    cybersecurity: me.cybersecurity ?? [],
    testing: me.testing ?? [],
    ai: me.ai ?? [],
    certifications: me.certifications ?? [],
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mi perfil</h1>
        <div className="flex items-center gap-2">
          <a href="/profile/summary" className="border rounded px-3 py-1 text-sm">
            Ver resumen
          </a>
          <a href="/jobs" className="border rounded px-3 py-1 text-sm">
            Ver vacantes
          </a>
        </div>
      </div>
      <ProfileForm initial={initial} onSubmit={saveProfileAction} />
    </main>
  )
}
