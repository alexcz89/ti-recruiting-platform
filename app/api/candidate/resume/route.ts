// /app/api/candidate/resume/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LanguageProficiency } from "@prisma/client";

function fromLangLevel(l: LanguageProficiency | null): string {
  return l ?? "CONVERSATIONAL";
}

async function requireUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.id ?? null;
}

export async function GET() {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        location: true,
        birthdate: true, // 👈 columna correcta en Prisma
        linkedin: true,
        github: true,
        summary: true,
        highestEducationLevel: true,
        education: {
          orderBy: [{ sortIndex: "asc" }, { endDate: "desc" }],
          select: {
            institution: true,
            program: true,
            level: true,
            status: true,
            country: true,
            city: true,
            startDate: true,
            endDate: true,
            grade: true,
            description: true,
            sortIndex: true,
          },
        },
        experiences: {
          orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
          select: {
            company: true,
            role: true,
            startDate: true,
            endDate: true,
            isCurrent: true,
            // Nota: no existe description en la tabla
          },
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
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      personal: {
        fullName: user.name ?? "",
        email: user.email ?? "",
        phone: user.phone ?? "",
        location: user.location ?? "",
        // Para birthdate sí devolvemos YYYY-MM-DD (el wizard lo transforma a dd/mm/aaaa)
        birthDate: user.birthdate ? new Date(user.birthdate).toISOString().slice(0, 10) : "",
        linkedin: user.linkedin ?? "",
        github: user.github ?? "",
      },
      about: user.summary ?? "",
      education: (user.education || []).map((e) => ({
        institution: e.institution ?? "",
        program: e.program ?? "",
        level: e.level ?? null,
        status: e.status ?? null,
        country: e.country ?? null,
        city: e.city ?? null,
        // 👇 ResumeWizard usa <input type="month">, le sirve YYYY-MM
        startDate: e.startDate ? new Date(e.startDate).toISOString().slice(0, 7) : "",
        endDate: e.endDate ? new Date(e.endDate).toISOString().slice(0, 7) : "",
        grade: e.grade ?? null,
        description: e.description ?? null,
        sortIndex: typeof e.sortIndex === "number" ? e.sortIndex : 0,
      })),
      experience: (user.experiences || []).map((w) => ({
        company: w.company ?? "",
        role: w.role ?? "",
        // 👇 YYYY-MM para inputs type="month"
        startDate: w.startDate ? new Date(w.startDate).toISOString().slice(0, 7) : "",
        endDate: w.endDate ? new Date(w.endDate).toISOString().slice(0, 7) : "",
        isCurrent: !!w.isCurrent,
        // El builder la necesita, aunque no se almacene en DB
        description: "",
      })),
      skills: (user.candidateSkills || []).map((s) => ({
        name: s.term.label,
        level: s.level ?? null,
      })),
      languages: (user.candidateLanguages || []).map((l) => ({
        name: l.term.label,
        level: fromLangLevel(l.level),
      })),
      certifications: (user.candidateCredentials || []).map((c) => ({
        name: c.term.label,
        issuer: c.issuer ?? null,
        // Para certificados mejor YYYY-MM (coincide con input type="month")
        date: c.issuedAt ? new Date(c.issuedAt).toISOString().slice(0, 7) : "",
        expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 7) : "",
        credentialId: c.credentialId ?? null,
        url: c.url ?? null,
      })),
    });
  } catch (e) {
    console.error("[GET /api/candidate/resume] error", e);
    return NextResponse.json({ error: "Error al obtener CV" }, { status: 500 });
  }
}
