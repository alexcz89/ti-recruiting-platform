// /app/api/candidate/resume/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LanguageProficiency } from "@prisma/client";

// 👇 fuerza a que esta ruta sea dinámica (no se prerenderiza)
export const dynamic = "force-dynamic";
export const revalidate = 0;

function fromLangLevel(l: LanguageProficiency | null): string {
  return l ?? "CONVERSATIONAL";
}

function parseDate(input?: string | null): Date | null {
  if (!input) return null;
  const normalized = /^\d{4}-\d{2}$/.test(input) ? `${input}-01` : input;
  const dt = new Date(normalized);
  return isNaN(dt.getTime()) ? null : dt;
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
        birthdate: true,
        linkedin: true,
        github: true,
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
            description: true,
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
        birthDate: user.birthdate
          ? new Date(user.birthdate).toISOString().slice(0, 10)
          : "",
        linkedin: user.linkedin ?? "",
        github: user.github ?? "",
      },
      about: "",
      education: (user.education || []).map((e) => ({
        institution: e.institution ?? "",
        program: e.program ?? "",
        level: e.level ?? null,
        status: e.status ?? null,
        country: e.country ?? null,
        city: e.city ?? null,
        startDate: e.startDate
          ? new Date(e.startDate).toISOString().slice(0, 7)
          : "",
        endDate: e.endDate ? new Date(e.endDate).toISOString().slice(0, 7) : "",
        grade: e.grade ?? null,
        description: e.description ?? null,
        sortIndex: typeof e.sortIndex === "number" ? e.sortIndex : 0,
      })),
      experience: (user.experiences || []).map((w) => ({
        company: w.company ?? "",
        role: w.role ?? "",
        startDate: w.startDate
          ? new Date(w.startDate).toISOString().slice(0, 7)
          : "",
        endDate: w.endDate ? new Date(w.endDate).toISOString().slice(0, 7) : "",
        isCurrent: !!w.isCurrent,
        description: w.description ?? "",
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
        date: c.issuedAt ? new Date(c.issuedAt).toISOString().slice(0, 7) : "",
        expiresAt: c.expiresAt
          ? new Date(c.expiresAt).toISOString().slice(0, 7)
          : "",
        credentialId: c.credentialId ?? null,
        url: c.url ?? null,
      })),
    });
  } catch (e) {
    console.error("[GET /api/candidate/resume] error", e);
    return NextResponse.json({ error: "Error al obtener CV" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
    }

    const rawExperiences = Array.isArray((body as any).experiences)
      ? (body as any).experiences
      : Array.isArray((body as any).experience)
      ? (body as any).experience
      : [];

    if (!Array.isArray(rawExperiences)) {
      return NextResponse.json(
        { error: "Experiencias invalidas" },
        { status: 400 }
      );
    }

    const experiences = rawExperiences
      .map((w: any) => ({
        company: typeof w?.company === "string" ? w.company.trim() : "",
        role: typeof w?.role === "string" ? w.role.trim() : "",
        startDate: parseDate(w?.startDate) ?? new Date(),
        endDate: parseDate(w?.endDate) ?? null,
        isCurrent: !!w?.isCurrent,
        description:
          typeof w?.description === "string" && w.description.trim()
            ? w.description
            : null,
      }))
      .filter((w) => w.company && w.role);

    await prisma.workExperience.deleteMany({ where: { userId } });
    if (experiences.length) {
      await prisma.workExperience.createMany({
        data: experiences.map((w) => ({ ...w, userId })),
      });
    }

    return NextResponse.json({
      ok: true,
      counts: { experience: experiences.length },
    });
  } catch (e) {
    console.error("[POST /api/candidate/resume] error", e);
    return NextResponse.json({ error: "Error al guardar CV" }, { status: 500 });
  }
}
