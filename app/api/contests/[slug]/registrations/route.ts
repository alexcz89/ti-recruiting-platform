import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import {
  challengeAvailability,
  contestLanguageRunner,
  contestRegistrationSchema,
  registrationAvailability,
} from "@/lib/contests/domain";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!user?.id) return json({ error: "Inicia sesión para registrarte" }, 401);
  if (String(user.role).toUpperCase() !== "CANDIDATE") {
    return json({ error: "El concurso está disponible para candidatos" }, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "El formulario no es válido" }, 400);
  }

  const parsed = contestRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "Revisa los datos del registro", fields: parsed.error.flatten().fieldErrors },
      400
    );
  }

  const contest = await prisma.contest.findUnique({
    where: { slug: params.slug },
    include: {
      tracks: { where: { isActive: true } },
      _count: { select: { registrations: true } },
    },
  });

  if (!contest) return json({ error: "Concurso no encontrado" }, 404);

  const availability = registrationAvailability({
    ...contest,
    registrationCount: contest._count.registrations,
  });
  if (!availability.open) return json({ error: availability.reason }, 409);
  const challenge = challengeAvailability(contest);

  const existing = await prisma.contestRegistration.findUnique({
    where: {
      contestId_candidateId: { contestId: contest.id, candidateId: user.id },
    },
    include: { track: true, attempt: true },
  });

  if (existing) {
    const runner = contestLanguageRunner(existing.track.language);
    return json({
      error: "Ya estás registrado en este concurso",
      registrationId: existing.id,
      challengeMessage: challenge.reason,
      assessmentUrl: existing.attemptId && challenge.open
        ? `/assessments/${existing.track.templateId}?attemptId=${existing.attemptId}&language=${runner}`
        : null,
    }, 409);
  }

  const track = contest.tracks.find((item) => item.language === parsed.data.language);
  if (!track) return json({ error: "Ese lenguaje no está disponible" }, 400);

  const candidate = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isActive: true, yearsExperience: true },
  });
  if (!candidate?.isActive) return json({ error: "La cuenta de candidato no está activa" }, 403);
  if (candidate.yearsExperience != null && candidate.yearsExperience > 2) {
    return json({ error: "Esta edición está dirigida a perfiles con máximo dos años de experiencia" }, 403);
  }

  try {
    const registration = await prisma.$transaction(async (tx) => {
      const attempt = await tx.assessmentAttempt.create({
        data: {
          candidateId: user.id!,
          templateId: track.templateId,
          status: "NOT_STARTED",
          attemptNumber: 1,
        },
      });

      await tx.user.update({
        where: { id: user.id! },
        data: {
          country: parsed.data.countryCode,
          timezone: parsed.data.timezone,
          yearsExperience: parsed.data.yearsExperience,
        },
      });

      return tx.contestRegistration.create({
        data: {
          contestId: contest.id,
          trackId: track.id,
          candidateId: user.id!,
          attemptId: attempt.id,
          city: parsed.data.city,

          experienceLevel: parsed.data.experienceLevel,
          linkedinUrl: parsed.data.linkedinUrl,
          githubUrl: parsed.data.githubUrl || null,
          rankingConsent: parsed.data.rankingConsent,
          jobInterest: parsed.data.jobInterest,
          aiToolDisclosure: parsed.data.aiToolDisclosure || null,
          aiFreeCategory: parsed.data.aiFreeCategory,
        },
      });
    });

    const runner = contestLanguageRunner(track.language);
    return json({
      success: true,
      registrationId: registration.id,
      challengeMessage: challenge.reason,
      assessmentUrl: challenge.open ? `/assessments/${track.templateId}?attemptId=${registration.attemptId}&language=${runner}` : null,
    }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return json({ error: "Ya estás registrado en este concurso" }, 409);
    }
    console.error("[contest registration]", error);
    return json({ error: "No pudimos completar el registro" }, 500);
  }
}