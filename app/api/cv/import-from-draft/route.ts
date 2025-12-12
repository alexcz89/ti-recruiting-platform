// app/api/cv/import-from-draft/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseMonthToDate(ym?: string | null): Date | null {
  if (!ym) return null;
  const [y, m] = ym.split("-");
  const yy = Number(y);
  const mm = Number(m);
  if (!yy || !mm) return null;
  // guardamos como día 1 del mes
  return new Date(yy, mm - 1, 1);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { ok: false, error: "No autenticado" },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => null)) as any;
  const draft = body?.draft as any;

  if (!draft) {
    return NextResponse.json(
      { ok: false, error: "Falta draft" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Usuario no encontrado" },
      { status: 404 }
    );
  }

  if (user.role !== "CANDIDATE") {
    return NextResponse.json(
      { ok: false, error: "Solo candidatos pueden importar CV" },
      { status: 403 }
    );
  }

  // Para no duplicar si ya llenó el perfil de otra forma
  const [
    existingExpCount,
    existingEduCount,
    existingSkillCount,
    existingLangCount,
  ] = await Promise.all([
    prisma.workExperience.count({ where: { userId: user.id } }),
    prisma.education.count({ where: { userId: user.id } }),
    prisma.candidateSkill.count({ where: { userId: user.id } }),
    prisma.candidateLanguage.count({ where: { userId: user.id } }),
  ]);

  const {
    identity,
    experiences = [],
    education = [],
    skills = [],
    languages = [],
    certifications = [],
  } = draft || {};

  const tx: any[] = [];

  // ===== User (datos personales + certificaciones) =====
  if (identity || (certifications && certifications.length > 0)) {
    const fullName =
      identity &&
      [identity.firstName, identity.lastName1, identity.lastName2]
        .filter(Boolean)
        .join(" ");

    tx.push(
      prisma.user.update({
        where: { id: user.id },
        data: {
          ...(fullName ? { name: fullName } : {}),
          ...(identity?.phone ? { phone: identity.phone } : {}),
          ...(identity?.location ? { location: identity.location } : {}),
          ...(identity?.linkedin ? { linkedin: identity.linkedin } : {}),
          ...(identity?.github ? { github: identity.github } : {}),
          ...(identity?.birthdate
            ? { birthdate: new Date(identity.birthdate) }
            : {}),
          ...(certifications && certifications.length
            ? { certifications }
            : {}),
          // NO tocamos el email para no romper login
        },
      })
    );
  }

  // ===== Experiencia =====
  if (Array.isArray(experiences) && experiences.length && existingExpCount === 0) {
    tx.push(
      prisma.workExperience.createMany({
        data: experiences
          .filter(
            (e: any) =>
              (e.role && e.role.trim()) || (e.company && e.company.trim())
          )
          .map((e: any) => {
            const start = parseMonthToDate(e.startDate);
            const end = e.isCurrent ? null : parseMonthToDate(e.endDate);

            return {
              userId: user.id,
              role: e.role || "",
              company: e.company || "",
              // si no hay fecha de inicio, simplemente no pasamos nada
              ...(start && { startDate: start }),
              endDate: end,
              isCurrent: !!e.isCurrent,
            };
          }) as any, // 👈 cast para evitar el conflicto de tipos con startDate
      })
    );
  }

  // ===== Educación =====
  if (Array.isArray(education) && education.length && existingEduCount === 0) {
    tx.push(
      prisma.education.createMany({
        data: education
          .filter((ed: any) => ed.institution && ed.institution.trim())
          .map((ed: any, index: number) => ({
            userId: user.id,
            institution: ed.institution || "",
            program: ed.program || null,
            startDate: parseMonthToDate(ed.startDate) ?? null,
            endDate: parseMonthToDate(ed.endDate) ?? null,
            level: "OTHER", // heurística: no sabemos el nivel real
            status: ed.endDate ? "COMPLETED" : "ONGOING",
            sortIndex: index,
          })),
      })
    );
  }

  // ===== Skills =====
  if (Array.isArray(skills) && skills.length && existingSkillCount === 0) {
    tx.push(
      prisma.candidateSkill.createMany({
        data: skills
          .filter((s: any) => s.termId && s.label && s.label.trim())
          .map((s: any) => ({
            userId: user.id,
            termId: s.termId,
            level: s.level ?? 3,
          })),
        skipDuplicates: true,
      })
    );
  }

  // ===== Idiomas =====
  if (Array.isArray(languages) && languages.length && existingLangCount === 0) {
    tx.push(
      prisma.candidateLanguage.createMany({
        data: languages
          .filter((l: any) => l.termId && l.label && l.label.trim())
          .map((l: any) => ({
            userId: user.id,
            termId: l.termId,
            level: l.level ?? "CONVERSATIONAL",
          })),
        skipDuplicates: true,
      })
    );
  }

  if (!tx.length) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  await prisma.$transaction(tx);

  return NextResponse.json({ ok: true });
}
