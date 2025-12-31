// app/api/assessments/[templateId]/start/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

function getClientIp(req: Request) {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  const xr = req.headers.get("x-real-ip");
  return xr?.trim() || "unknown";
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sanitizeOptions(raw: unknown) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((opt: any) => {
    if (opt && typeof opt === "object" && !Array.isArray(opt)) {
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(opt)) {
        const key = k.toLowerCase();
        if (
          key.includes("correct") ||
          key.includes("iscorrect") ||
          key.includes("answer") ||
          key.includes("score") ||
          key.includes("points")
        ) {
          continue;
        }
        clean[k] = v;
      }
      return clean;
    }
    return opt;
  });
}

function buildQuestionsPayload(questionsRaw: any[], meta: any | null) {
  let questions = questionsRaw.map((q) => ({
    ...q,
    options: sanitizeOptions(q.options),
  }));

  const questionOrder: string[] = Array.isArray(meta?.questionOrder)
    ? meta.questionOrder
    : [];

  if (questionOrder.length) {
    const map = new Map(questions.map((q) => [q.id, q]));
    const ordered = questionOrder.map((id) => map.get(id)).filter(Boolean) as any[];
    const leftovers = questions.filter((q) => !questionOrder.includes(q.id));
    questions = [...ordered, ...leftovers];
  }

  const optionOrderByQ = meta?.optionOrderByQuestion || {};
  questions = questions.map((q: any) => {
    const ord = optionOrderByQ[q.id];
    if (Array.isArray(ord) && Array.isArray(q.options)) {
      const keyOf = (o: any) => o?.id ?? o?.value ?? JSON.stringify(o);
      const optMap = new Map(q.options.map((o: any) => [keyOf(o), o]));
      const ordered = ord.map((k: any) => optMap.get(k)).filter(Boolean);
      const leftovers = q.options.filter((o: any) => !ord.includes(keyOf(o)));
      return { ...q, options: [...ordered, ...leftovers] };
    }
    return q;
  });

  return questions;
}

// POST /api/assessments/[templateId]/start
// Body esperado (recomendado): { applicationId?: string, token?: string }
export async function POST(
  request: Request,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const now = new Date();

    // Body opcional
    let applicationId: string | null = null;
    let token: string | null = null;

    try {
      const body = await request.json();
      applicationId = (body?.applicationId as string) || null;
      token = (body?.token as string) || null;
    } catch {
      applicationId = null;
      token = null;
    }

    // Verificar template existe y está activo
    const template = await prisma.assessmentTemplate.findUnique({
      where: { id: params.templateId },
      select: {
        id: true,
        isActive: true,
        allowRetry: true,
        maxAttempts: true,
        timeLimit: true,
        shuffleQuestions: true,
      },
    });

    if (!template || !template.isActive) {
      return NextResponse.json(
        { error: "Template no encontrado o inactivo" },
        { status: 404 }
      );
    }

    // Si viene token: debe existir invite y debe corresponder a este usuario+template
    let invite:
      | {
          id: string;
          status: any;
          expiresAt: Date | null;
          applicationId: string;
          jobId: string;
          candidateId: string;
          templateId: string;
        }
      | null = null;

    if (token) {
      invite = await prisma.assessmentInvite.findUnique({
        where: { token },
        select: {
          id: true,
          status: true,
          expiresAt: true,
          applicationId: true,
          jobId: true,
          candidateId: true,
          templateId: true,
        },
      });

      if (!invite) {
        return NextResponse.json({ error: "Invitación inválida" }, { status: 400 });
      }

      if (invite.candidateId !== user.id) {
        return NextResponse.json({ error: "Invitación no autorizada" }, { status: 403 });
      }

      if (invite.templateId !== params.templateId) {
        return NextResponse.json(
          { error: "Invitación no corresponde a este assessment" },
          { status: 400 }
        );
      }

      if (invite.expiresAt && invite.expiresAt <= now) {
        return NextResponse.json({ error: "Invitación expirada" }, { status: 410 });
      }

      if (invite.status === "CANCELLED") {
        return NextResponse.json({ error: "Invitación cancelada" }, { status: 410 });
      }

      if (invite.status === "SUBMITTED" || invite.status === "EVALUATED") {
        return NextResponse.json(
          { error: "Esta invitación ya fue completada" },
          { status: 400 }
        );
      }

      // El applicationId “real” sale del invite
      applicationId = invite.applicationId;
    }

    // Validar applicationId (si existe) y que el template está asignado a la vacante
    let jobIdFromApp: string | null = null;

    if (applicationId) {
      const app = await prisma.application.findFirst({
        where: { id: applicationId, candidateId: user.id },
        select: {
          id: true,
          jobId: true,
          job: {
            select: {
              id: true,
              assessments: {
                where: { templateId: params.templateId },
                select: { id: true },
              },
            },
          },
        },
      });

      if (!app) {
        return NextResponse.json({ error: "applicationId inválido" }, { status: 400 });
      }

      if (!app.job.assessments.length) {
        return NextResponse.json(
          { error: "Este assessment no está asignado a la vacante" },
          { status: 400 }
        );
      }

      jobIdFromApp = app.jobId;

      // Si viene invite, además amarra jobId del invite = jobId del application
      if (invite && invite.jobId !== jobIdFromApp) {
        return NextResponse.json(
          { error: "Invitación no corresponde a esta postulación" },
          { status: 400 }
        );
      }
    }

    // 1) Reusar IN_PROGRESS (incluye expiresAt NULL para intentos viejos)
    const inProgress = await prisma.assessmentAttempt.findFirst({
      where: {
        candidateId: user.id,
        templateId: params.templateId,
        status: "IN_PROGRESS",
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
        ...(applicationId ? { OR: [{ applicationId }, { applicationId: null }] } : {}),
      },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        expiresAt: true,
        startedAt: true,
        flagsJson: true,
        applicationId: true,
      },
    });

    if (inProgress) {
      // si le falta applicationId, lo amarramos
      if (applicationId && !inProgress.applicationId) {
        await prisma.assessmentAttempt.update({
          where: { id: inProgress.id },
          data: { applicationId },
        });
      }

      // si le falta expiresAt (viejo), lo setea
      let finalExpiresAt = inProgress.expiresAt;
      if (!finalExpiresAt) {
        finalExpiresAt = new Date(now.getTime() + (template.timeLimit ?? 0) * 60 * 1000);
        await prisma.assessmentAttempt.update({
          where: { id: inProgress.id },
          data: { expiresAt: finalExpiresAt, startedAt: inProgress.startedAt ?? now },
        });
      }

      // Si el invite estaba SENT, lo marcamos STARTED
      if (invite && invite.status === "SENT") {
        await prisma.assessmentInvite.update({
          where: { id: invite.id },
          data: { status: "STARTED" as any },
        });
      }

      const meta = (inProgress.flagsJson as any) || null;

      const questionsRaw = await prisma.assessmentQuestion.findMany({
        where: { templateId: params.templateId, isActive: true },
        select: {
          id: true,
          section: true,
          difficulty: true,
          tags: true,
          questionText: true,
          codeSnippet: true,
          options: true,
          allowMultiple: true,
        },
      });

      const questions = buildQuestionsPayload(questionsRaw, meta);

      // Rehidratar respuestas
      const saved = await prisma.attemptAnswer.findMany({
        where: { attemptId: inProgress.id },
        select: { questionId: true, selectedOptions: true, timeSpent: true },
      });

      const savedAnswers: Record<string, string[]> = {};
      const savedTimeSpent: Record<string, number> = {};

      for (const a of saved) {
        savedAnswers[a.questionId] = (a.selectedOptions as any) ?? [];
        if (typeof a.timeSpent === "number") savedTimeSpent[a.questionId] = a.timeSpent;
      }

      return NextResponse.json(
        {
          attemptId: inProgress.id,
          questions,
          expiresAt: finalExpiresAt,
          timeLimit: template.timeLimit,
          reused: true,
          savedAnswers,
          savedTimeSpent,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // 2) Reusar NOT_STARTED (creado al mandar invite) y “arrancarlo”
    const notStarted = await prisma.assessmentAttempt.findFirst({
      where: {
        candidateId: user.id,
        templateId: params.templateId,
        status: "NOT_STARTED",
        ...(applicationId ? { OR: [{ applicationId }, { applicationId: null }] } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        applicationId: true,
        flagsJson: true,
      },
    });

    // Contar intentos consumidos (SUBMITTED/EVALUATED)
    const attemptsUsed = await prisma.assessmentAttempt.count({
      where: {
        candidateId: user.id,
        templateId: params.templateId,
        status: { in: ["SUBMITTED", "EVALUATED"] as any },
      },
    });

    if (!template.allowRetry && attemptsUsed > 0) {
      return NextResponse.json(
        { error: "Ya completaste esta evaluación" },
        { status: 400 }
      );
    }

    const maxAttempts = template.maxAttempts ?? 1;
    if (attemptsUsed >= maxAttempts) {
      return NextResponse.json(
        { error: "Límite de intentos alcanzado" },
        { status: 400 }
      );
    }

    const expiresAt = new Date(now.getTime() + (template.timeLimit ?? 0) * 60 * 1000);

    // Obtener preguntas “base”
    const questionsRaw = await prisma.assessmentQuestion.findMany({
      where: { templateId: params.templateId, isActive: true },
      select: {
        id: true,
        section: true,
        difficulty: true,
        tags: true,
        questionText: true,
        codeSnippet: true,
        options: true,
        allowMultiple: true,
      },
    });

    // Meta: si el NOT_STARTED ya la tiene, úsala; si no, genérala
    let meta = (notStarted?.flagsJson as any) || null;

    if (!meta?.questionOrder || !Array.isArray(meta.questionOrder) || meta.questionOrder.length === 0) {
      let q = questionsRaw.map((qq) => ({ ...qq, options: sanitizeOptions(qq.options) })) as any[];
      if (template.shuffleQuestions) shuffleInPlace(q);

      const optionOrderByQuestion: Record<string, any[]> = {};
      q = q.map((qq: any) => {
        const opts = Array.isArray(qq.options) ? [...qq.options] : [];
        shuffleInPlace(opts);
        const keys = opts.map((o: any) => o?.id ?? o?.value ?? JSON.stringify(o));
        optionOrderByQuestion[qq.id] = keys;
        return { ...qq, options: opts };
      });

      meta = {
        questionOrder: q.map((qq) => qq.id),
        optionOrderByQuestion,
      };
    }

    const questions = buildQuestionsPayload(questionsRaw, meta);

    let attemptId: string;

    if (notStarted) {
      const updated = await prisma.assessmentAttempt.update({
        where: { id: notStarted.id },
        data: {
          applicationId: applicationId || notStarted.applicationId || null,
          status: "IN_PROGRESS" as any,
          startedAt: now,
          expiresAt,
          ipAddress: getClientIp(request),
          userAgent: request.headers.get("user-agent") || "unknown",
          flagsJson: meta,
          attemptNumber: attemptsUsed + 1,
        },
        select: { id: true },
      });

      attemptId = updated.id;
    } else {
      const created = await prisma.assessmentAttempt.create({
        data: {
          candidateId: user.id,
          templateId: params.templateId,
          applicationId: applicationId || null,
          status: "IN_PROGRESS" as any,
          attemptNumber: attemptsUsed + 1,
          startedAt: now,
          expiresAt,
          ipAddress: getClientIp(request),
          userAgent: request.headers.get("user-agent") || "unknown",
          flagsJson: meta,
        },
        select: { id: true },
      });

      attemptId = created.id;
    }

    // Si viene invite (token), marcarlo STARTED
    if (invite && invite.status === "SENT") {
      await prisma.assessmentInvite.update({
        where: { id: invite.id },
        data: { status: "STARTED" as any },
      });
    }

    return NextResponse.json(
      {
        attemptId,
        questions,
        expiresAt,
        timeLimit: template.timeLimit,
        reused: Boolean(notStarted),
        savedAnswers: {},
        savedTimeSpent: {},
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error starting attempt:", error);
    return NextResponse.json(
      { error: "Error al iniciar evaluación" },
      { status: 500 }
    );
  }
}
