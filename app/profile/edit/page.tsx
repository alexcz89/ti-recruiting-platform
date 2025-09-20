// app/profile/edit/page.tsx
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import ProfileForm from "../ProfileForm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
// para distinguir el redirect de errores reales
import { isRedirectError } from "next/dist/client/components/redirect"
// 👇 para guardar el CV localmente en /public/uploads (dev/local)
import path from "node:path"
import fs from "node:fs/promises"

export const metadata = { title: "Mi perfil | Bolsa TI" }

/** Split E.164 a partes (MX forzado a 10 dígitos locales) */
function parseE164ToParts(e164?: string | null) {
  if (!e164) return { phoneCountry: "52", phoneLocal: "" }
  const digits = e164.replace(/\D+/g, "")
  if (digits.startsWith("52")) {
    const local10 = digits.slice(-10)
    return { phoneCountry: "52", phoneLocal: local10 }
  }
  let countryLen = 1
  if (digits.length > 9) countryLen = 3
  else if (digits.length > 8) countryLen = 2
  const phoneCountry = digits.slice(0, countryLen) || "52"
  const phoneLocal = digits.slice(countryLen)
  return { phoneCountry, phoneLocal }
}

/** Divide un nombre completo en {firstName, lastName1, lastName2} de forma sencilla */
function splitName(full?: string | null) {
  const parts = (full ?? "").trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return { firstName: "", lastName1: "", lastName2: "" }
  if (parts.length === 1) return { firstName: parts[0], lastName1: "", lastName2: "" }
  if (parts.length === 2) return { firstName: parts[0], lastName1: parts[1], lastName2: "" }
  // 3+ → nombre(s) + 2 apellidos (toma el último como materno, el penúltimo como paterno)
  const lastName2 = parts.pop() as string
  const lastName1 = parts.pop() as string
  const firstName = parts.join(" ")
  return { firstName, lastName1, lastName2 }
}

export default async function ProfileEditPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/signin?callbackUrl=/profile/edit")

  const me = session.user as any
  if (me.role === "RECRUITER" || me.role === "ADMIN") {
    redirect("/dashboard")
  }

  // Asegura registro (MVP)
  const dbUser = await prisma.user.upsert({
    where: { email: me.email! },
    update: {},
    create: {
      email: me.email!,
      name: me.name ?? me.email!.split("@")[0],
      passwordHash: "demo",
      role: "CANDIDATE",
    },
  })

  // ---------- Server Action: actualizar perfil ----------
  async function updateAction(fd: FormData) {
    "use server"
    try {
      const s = await getServerSession(authOptions)
      if (!s?.user?.email) return { error: "No autenticado" }

      // ---------- Nombre (validación) ----------
      const firstName = String(fd.get("firstName") ?? "").trim()
      const lastName1 = String(fd.get("lastName1") ?? "").trim()
      const lastName2 = String(fd.get("lastName2") ?? "").trim()
      if (!firstName || !lastName1) {
        return { error: "Nombre y Apellido paterno son obligatorios." }
      }
      const fullName = lastName2 ? `${firstName} ${lastName1} ${lastName2}` : `${firstName} ${lastName1}`

      const val = (k: string) => {
        if (!fd.has(k)) return undefined
        const v = fd.get(k)
        if (v === null) return ""
        const str = String(v).trim()
        return str.length ? str : ""
      }

      // Teléfono (country + local → E.164)
      let phone: string | null | undefined = undefined
      if (fd.has("phoneCountry") || fd.has("phoneLocal")) {
        const phoneCountry = String(fd.get("phoneCountry") ?? "52").replace(/\D+/g, "")
        let phoneLocalDigits = String(fd.get("phoneLocal") ?? "").replace(/\D+/g, "")
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
        phone = phoneLocalDigits ? `+${phoneCountry}${phoneLocalDigits}` : null
      }

      // Fecha segura
      let safeBirthdate: Date | null | undefined = undefined
      if (fd.has("birthdate")) {
        const raw = String(fd.get("birthdate") ?? "")
        if (!raw) {
          safeBirthdate = null
        } else {
          const d = new Date(raw)
          safeBirthdate = Number.isNaN(d.getTime()) ? null : d
        }
      }

      // Helper listas CSV si existen; si no llegan, no tocar
      const toList = (k: string) => {
        if (!fd.has(k)) return undefined
        const raw = fd.get(k)
        if (raw === null) return []
        const txt = String(raw).trim()
        if (!txt) return []
        return txt.split(",").map(s => s.trim()).filter(Boolean)
      }

      // Construye payload solo con campos presentes
      const data: any = {}

      // nombre (obligatorio con validación)
      data.name = fullName

      if (typeof phone !== "undefined") data.phone = phone

      const location = val("location");   if (typeof location !== "undefined") data.location = location
      if (typeof safeBirthdate !== "undefined") data.birthdate = safeBirthdate
      const linkedin = val("linkedin");   if (typeof linkedin !== "undefined") data.linkedin = linkedin
      const github = val("github");       if (typeof github !== "undefined") data.github = github

      // ----- CV: si viene un archivo, lo guardamos en /public/uploads y guardamos la URL relativa
      if (fd.has("resume") && fd.get("resume") instanceof File) {
        const file = fd.get("resume") as File
        if (file && file.size > 0) {
          const arrayBuffer = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          const safeName = file.name.replace(/[^\w.\-]+/g, "_")
          const filename = `cv-${dbUser.id}-${Date.now()}-${safeName}`
          const uploadsDir = path.join(process.cwd(), "public", "uploads")
          await fs.mkdir(uploadsDir, { recursive: true })
          const outPath = path.join(uploadsDir, filename)
          await fs.writeFile(outPath, buffer)
          data.resumeUrl = `/uploads/${filename}`
        }
      } else {
        // fallback: si vino resumeUrl como texto (opcional)
        const resumeUrl = val("resumeUrl")
        if (typeof resumeUrl !== "undefined") data.resumeUrl = resumeUrl
      }

      // Compat: categorías antiguas (si las mandaras)
      const frontend = toList("frontend");         if (typeof frontend !== "undefined") data.frontend = frontend
      const backend = toList("backend");           if (typeof backend !== "undefined") data.backend = backend
      const mobile = toList("mobile");             if (typeof mobile !== "undefined") data.mobile = mobile
      const cloud = toList("cloud");               if (typeof cloud !== "undefined") data.cloud = cloud
      const database = toList("database");         if (typeof database !== "undefined") data.database = database
      const cybersecurity = toList("cybersecurity"); if (typeof cybersecurity !== "undefined") data.cybersecurity = cybersecurity
      const testing = toList("testing");           if (typeof testing !== "undefined") data.testing = testing
      const ai = toList("ai");                     if (typeof ai !== "undefined") data.ai = ai

      const certifications = toList("certifications")
      if (typeof certifications !== "undefined") data.certifications = certifications

      // Skills unificadas
      if (fd.has("skills")) {
        const skillsCsv = String(fd.get("skills") ?? "")
        const skills = skillsCsv.split(",").map(s => s.trim()).filter(Boolean)
        data.skills = skills
      }

      await prisma.user.update({ where: { id: dbUser.id }, data })

      // refresca summary y redirige
      revalidatePath("/profile/summary")
      redirect("/profile/summary?updated=1")
    } catch (err) {
      if (isRedirectError(err)) throw err
      console.error("[profile:update] error", err)
      return { error: "No se pudo guardar tu perfil. Inténtalo de nuevo." }
    }
  }

  // Iniciales para el formulario
  const parts = parseE164ToParts(dbUser.phone)
  const isMX = parts.phoneCountry === "52"
  const initialPhoneLocal = isMX
    ? (parts.phoneLocal || "").replace(/\D+/g, "").slice(-10)
    : (parts.phoneLocal || "").replace(/\D+/g, "").slice(0, 15)

  const { firstName, lastName1, lastName2 } = splitName(dbUser.name)

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Mi perfil</h1>
      <ProfileForm
        initial={{
          // nombre separado
          firstName,
          lastName1,
          lastName2,
          // demás campos
          email: dbUser.email,
          phoneCountry: parts.phoneCountry || "52",
          phoneLocal: initialPhoneLocal,
          location: dbUser.location ?? "",
          birthdate: dbUser.birthdate ? dbUser.birthdate.toISOString().slice(0, 10) : "",
          linkedin: dbUser.linkedin ?? "",
          github: dbUser.github ?? "",
          resumeUrl: dbUser.resumeUrl ?? "",
          skills: dbUser.skills ?? [],
          certifications: dbUser.certifications ?? [],
        }}
        onSubmit={updateAction}
      />
    </main>
  )
}
