// app/api/profile/export/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import ResumePDF from "@/components/resume/ResumePDF";
import { profileToResume } from "@/lib/mappers/profileToResume";

/** Normaliza string -> ASCII seguro para filename */
function slugifyFilename(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-zA-Z0-9\-_.\s]/g, "") // quita caracteres raros
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

/** Crea el PDF del perfil autenticado */
async function buildProfilePdfBuffer(userId: string) {
  // Obtiene datos completos del usuario desde Prisma
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      phone: true,
      location: true,
      birthdate: true,
      linkedin: true,
      github: true,
      summary: true,
      highestEducationLevel: true,
      education: {
        orderBy: [{ sortIndex: "asc" }, { startDate: "desc" }],
        select: {
          institution: true,
          program: true,
          level: true,
          status: true,
          startDate: true,
          endDate: true,
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
        },
      },
      candidateSkills: {
        include: { term: { select: { label: true } } },
        orderBy: { level: "desc" },
      },
      candidateLanguages: {
        include: { term: { select: { label: true } } },
        orderBy: { level: "desc" },
      },
      candidateCredentials: {
        include: { term: { select: { label: true } } },
        orderBy: { issuedAt: "desc" },
      },
    },
  });

  if (!user) throw new Error("Usuario no encontrado");

  // Arma objeto en formato ProfileApiResponse
  const apiProfile = {
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
    about: user.summary ?? "",
    experience: (user.experiences || []).map((w) => ({
      company: w.company ?? "",
      role: w.role ?? "",
      startDate: w.startDate
        ? new Date(w.startDate).toISOString().slice(0, 10)
        : "",
      endDate: w.endDate ? new Date(w.endDate).toISOString().slice(0, 10) : "",
      isCurrent: w.isCurrent ?? false,
      description: null,
    })),
    education: (user.education || []).map((e) => ({
      institution: e.institution ?? "",
      program: e.program ?? "",
      level: e.level ?? null,
      status: e.status ?? null,
      startDate: e.startDate
        ? new Date(e.startDate).toISOString().slice(0, 10)
        : "",
      endDate: e.endDate ? new Date(e.endDate).toISOString().slice(0, 10) : "",
    })),
    skills: (user.candidateSkills || []).map((s) => ({
      name: s.term.label,
      level: s.level ?? null,
    })),
    languages: (user.candidateLanguages || []).map((l) => ({
      name: l.term.label,
      level: l.level ?? "CONVERSATIONAL",
    })),
    certifications: (user.candidateCredentials || []).map((c) => ({
      name: c.term.label,
      issuer: c.issuer ?? null,
      date: c.issuedAt
        ? new Date(c.issuedAt).toISOString().slice(0, 10)
        : "",
      expiresAt: c.expiresAt
        ? new Date(c.expiresAt).toISOString().slice(0, 10)
        : "",
      url: c.url ?? null,
    })),
  };

  // Convierte a formato ResumeDoc
  const resumeData = profileToResume(apiProfile);

  // Renderiza con @react-pdf/renderer
  const pdfBuffer = await renderToBuffer(<ResumePDF data={resumeData} />);
  return pdfBuffer;
}

/** Endpoint principal */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const baseName =
      (user.name && String(user.name).trim()) ||
      (user.email && String(user.email).split("@")[0]) ||
      "CV";
    const safe = slugifyFilename(baseName);
    const filename = `CV-${safe || "Perfil"}.pdf`;

    const pdfBytes = await buildProfilePdfBuffer(user.id);

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(
          filename
        )}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[POST /api/profile/export] error", err);
    return NextResponse.json(
      { error: "Error al generar el PDF" },
      { status: 500 }
    );
  }
}
