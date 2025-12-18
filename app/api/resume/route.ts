// app/api/resume/route.ts
import { NextRequest, NextResponse } from "next/server"
import { Prisma, TaxonomyKind, LanguageProficiency, EducationLevel } from "@prisma/client"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ------------------------------
// Helpers
// ------------------------------
function slugify(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
}

function parseDate(d?: string | null) {
  if (!d) return null
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? null : dt
}

const levelRank: Record<EducationLevel, number> = {
  NONE: 0,
  PRIMARY: 1,
  SECONDARY: 2,
  HIGH_SCHOOL: 3,
  TECHNICAL: 4,
  BACHELOR: 5,
  MASTER: 6,
  DOCTORATE: 7,
  OTHER: 4,
}

function highestLevel(levels: (EducationLevel | null | undefined)[]): EducationLevel {
  let best: EducationLevel = "NONE"
  for (const l of levels) {
    if (!l) continue
    if (levelRank[l] > levelRank[best]) best = l
  }
  return best
}

function toLangLevel(input?: string): LanguageProficiency {
  const s = (input || "").toUpperCase()
  if (s.includes("NATIVE") || s.includes("NATIVO")) return "NATIVE"
  if (s.includes("PROF")) return "PROFESSIONAL"
  if (s.includes("CONVER")) return "CONVERSATIONAL"
  if (s.includes("BASIC") || s.includes("BÁSIC")) return "BASIC"
  return "CONVERSATIONAL"
}

function fromLangLevel(l: LanguageProficiency | null): string {
  return l ?? "CONVERSATIONAL"
}

async function ensureTerm(kind: TaxonomyKind, label: string) {
  const slug = slugify(label)
  const existing = await prisma.taxonomyTerm.findFirst({
    where: { kind, slug },
    select: { id: true },
  })
  if (existing) return existing.id

  const created = await prisma.taxonomyTerm.create({
    data: { kind, slug, label },
    select: { id: true },
  })
  return created.id
}

// ------------------------------
// GET - Obtener CV normalizado
// ------------------------------
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        location: true,
        birthdate: true, // 👈 campo real en User
        linkedin: true,
        github: true,
        highestEducationLevel: true,
        education: {
          orderBy: [{ sortIndex: "asc" }, { endDate: "desc" }],
        },
        experiences: {
          orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
        },
        candidateSkills: {
          include: { term: true },
          orderBy: { level: "desc" },
        },
        candidateLanguages: {
          include: { term: true },
          orderBy: { level: "desc" },
        },
        candidateCredentials: {
          include: { term: true },
          orderBy: { issuedAt: "desc" },
        },
      },
    })

    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })

    const payload = {
      personal: {
        fullName: user.name ?? "",
        email: user.email ?? "",
        phone: user.phone ?? "",
        location: user.location ?? "",
        birthDate: user.birthdate ? new Date(user.birthdate).toISOString().slice(0, 10) : "",
        linkedin: user.linkedin ?? "",
        github: user.github ?? "",
      },
      // Tu modelo User no tiene summary; por ahora dejamos about vacío
      about: "",
      education: user.education.map((e) => ({
        id: e.id,
        institution: e.institution ?? "",
        program: e.program ?? "",
        level: e.level ?? null,
        status: e.status ?? null,
        country: (e as any).country ?? null,
        city: (e as any).city ?? null,
        startDate: e.startDate ? new Date(e.startDate).toISOString().slice(0, 10) : "",
        endDate: e.endDate ? new Date(e.endDate).toISOString().slice(0, 10) : "",
        grade: (e as any).grade ?? null,
        description: (e as any).description ?? null,
        sortIndex: (e as any).sortIndex ?? 0,
      })),
      experience: user.experiences.map((w) => ({
        id: w.id,
        company: w.company ?? "",
        role: w.role ?? "",
        startDate: w.startDate ? new Date(w.startDate).toISOString().slice(0, 10) : "",
        endDate: w.endDate ? new Date(w.endDate).toISOString().slice(0, 10) : "",
        isCurrent: w.isCurrent ?? false,
        description: (w as any).description ?? null,
      })),
      skills: user.candidateSkills.map((s) => ({
        name: s.term.label,
        level: s.level ?? null,
      })),
      languages: user.candidateLanguages.map((l) => ({
        name: l.term.label,
        level: fromLangLevel(l.level),
      })),
      certifications: user.candidateCredentials.map((c) => ({
        name: c.term.label,
        issuer: c.issuer ?? null,
        date: c.issuedAt ? new Date(c.issuedAt).toISOString().slice(0, 10) : "",
        expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 10) : "",
        credentialId: c.credentialId ?? null,
        url: c.url ?? null,
      })),
    }

    return NextResponse.json(payload)
  } catch (err) {
    console.error("[RESUME GET] Error:", err)
    return NextResponse.json({ error: "Error al obtener CV" }, { status: 500 })
  }
}

// ------------------------------
// POST - Guardar/actualizar CV completo
// ------------------------------
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const payload = await req.json()

    const {
      personal = {},
      about,
      education = [],
      experience = [],
      skills = [],
      languages = [],
      certifications = [],
    } = payload || {}

    if (!Array.isArray(education) || !Array.isArray(experience)) {
      return NextResponse.json({ error: "Formato inválido" }, { status: 400 })
    }

    const txResult = await prisma.$transaction(async (tx) => {
      // 1) USER: datos personales
      const userUpdate: any = {
        name: typeof personal.fullName === "string" ? personal.fullName : undefined,
        phone: personal.phone ?? null,
        location: personal.location ?? null,
        birthdate: personal.birthDate ? parseDate(personal.birthDate) : null, // 👈 corregido
        linkedin: personal.linkedin ?? null,
        github: personal.github ?? null,
        // OJO: tu modelo no tiene summary, así que no lo seteamos
        // summary: typeof about === "string" ? about : undefined,
      }

      await tx.user.update({
        where: { id: userId },
        data: userUpdate as Prisma.UserUpdateInput,
      })

      // 2) EDUCATION — reemplazo completo
      await tx.education.deleteMany({ where: { userId } })
      if (education.length) {
        await tx.education.createMany({
          data: education.map((e: any, idx: number) => ({
            userId,
            institution: String(e.institution || "").trim(),
            program: e.program ? String(e.program).trim() : null,
            level: e.level || null,
            status: e.status || "ONGOING",
            country: e.country || null,
            city: e.city || null,
            startDate: parseDate(e.startDate) ?? undefined,
            endDate: parseDate(e.endDate) ?? undefined,
            grade: e.grade || null,
            description: e.description || null,
            sortIndex: idx,
          })),
        })

        const levels = education.map((e: any) => e.level as EducationLevel | null | undefined)
        await tx.user.update({
          where: { id: userId },
          data: { highestEducationLevel: highestLevel(levels) },
        })
      } else {
        await tx.user.update({
          where: { id: userId },
          data: { highestEducationLevel: "NONE" },
        })
      }

      // 3) EXPERIENCES — reemplazo completo
      await tx.workExperience.deleteMany({ where: { userId } })
      if (experience.length) {
        await tx.workExperience.createMany({
          data: experience.map((w: any) => ({
            userId,
            role: String(w.role || "").trim(),
            company: String(w.company || "").trim(),
            startDate: parseDate(w.startDate) ?? new Date(),
            endDate: parseDate(w.endDate) ?? null,
            isCurrent: Boolean(w.isCurrent),
            description: w.description || null,
          })),
        })
      }

      // 4) SKILLS
      await tx.candidateSkill.deleteMany({ where: { userId } })
      for (const s of skills as Array<{ name: string; level?: number }>) {
        const name = (s?.name || "").trim()
        if (!name) continue
        const termId = await ensureTerm(TaxonomyKind.SKILL, name)
        await tx.candidateSkill.create({
          data: {
            userId,
            termId,
            level: typeof s.level === "number" ? s.level : null,
          },
        })
      }

      // 5) LANGUAGES
      await tx.candidateLanguage.deleteMany({ where: { userId } })
      for (const l of languages as Array<{ name: string; level: string }>) {
        const name = (l?.name || "").trim()
        if (!name) continue
        const termId = await ensureTerm(TaxonomyKind.LANGUAGE, name)
        await tx.candidateLanguage.create({
          data: {
            userId,
            termId,
            level: toLangLevel(l?.level),
          },
        })
      }

      // 6) CERTIFICATIONS
      await tx.candidateCredential.deleteMany({ where: { userId } })
      for (const c of certifications as Array<{
        name: string
        issuer?: string
        date?: string
        expiresAt?: string
        credentialId?: string
        url?: string
      }>) {
        const name = (c?.name || "").trim()
        if (!name) continue
        const termId = await ensureTerm(TaxonomyKind.CERTIFICATION, name)
        await tx.candidateCredential.create({
          data: {
            userId,
            termId,
            issuer: c.issuer || null,
            issuedAt: parseDate(c.date) ?? null,
            expiresAt: parseDate(c.expiresAt) ?? null,
            credentialId: c.credentialId || null,
            url: c.url || null,
          },
        })
      }

      const [expCount, eduCount, skillCount, langCount, certCount] =
        await Promise.all([
          tx.workExperience.count({ where: { userId } }),
          tx.education.count({ where: { userId } }),
          tx.candidateSkill.count({ where: { userId } }),
          tx.candidateLanguage.count({ where: { userId } }),
          tx.candidateCredential.count({ where: { userId } }),
        ])

      return {
        ok: true,
        counts: {
          experience: expCount,
          education: eduCount,
          skills: skillCount,
          languages: langCount,
          certifications: certCount,
        },
      }
    })

    return NextResponse.json(txResult)
  } catch (err) {
    console.error("[RESUME POST] Error:", err)
    return NextResponse.json({ error: "Error al guardar CV" }, { status: 500 })
  }
}
