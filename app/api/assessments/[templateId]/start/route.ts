// app/api/assessments/[templateId]/start/route.ts
import { NextResponse } from "next/server";
import { prisma } from '@/lib/server/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonNoStore(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

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
        const key = String(k).toLowerCase();
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

  const questionOrder: string[] = Array.isArray(meta?.questionOrder) ? meta.questionOrder : [];
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

async function ensureMeta(templateId: string, shuffleQuestions: boolean) {
  const base = await prisma.assessmentQuestion.findMany({
    where: { templateId, isActive: true },
    select: { id: true, options: true },
  });

  let q = base.map((qq) => ({
    id: qq.id,
    options: sanitizeOptions(qq.options),
  })) as any[];

  if (shuffleQuestions) shuffleInPlace(q);

  const optionOrderByQuestion: Record<string, any[]> = {};
  q = q.map((qq: any) => {
    const opts = Array.isArray(qq.options) ? [...qq.options] : [];
    shuffleInPlace(opts);
    const keys = opts.map((o: any) => o?.id ?? o?.value ?? JSON.stringify(o));
    optionOrderByQuestion[qq.id] = keys;
    return { ...qq, options: opts };
  });

  return {
    questionOrder: q.map((qq: any) => qq.id),
    optionOrderByQuestion,
  };
}

function computeExpiresAt(now: Date, timeLimit?: number | null) {
  const tl =
    typeof timeLimit === "number" && Number.isFinite(timeLimit) && timeLimit > 0
      ? Math.floor(timeLimit)
      : null;
  return tl ? new Date(now.getTime() + tl * 60 * 1000) : null;
}

type DbClient = Prisma.TransactionClient;

async function markInviteStartedTx(tx: DbClient, inviteId: string, now: Date) {
  await tx.assessmentInvite.updateMany({
    where: { id: inviteId, status: "SENT" as any },
    data: { status: "STARTED" as any, startedAt: now },
  });
}

function isAttemptFinal(status: any) {
  const s = String(status ?? "").toUpperCase();
  return s === "SUBMITTED" || s === "EVALUATED" || s === "COMPLETED";
}

function isExpired(expiresAt: Date | null, now: Date) {
  return Boolean(expiresAt && expiresAt <= now);
}

async function buildSaved(attemptId: string) {
  const saved = await prisma.attemptAnswer.findMany({
    where: { attemptId },
    select: { questionId: true, selectedOptions: true, timeSpent: true },
  });

  const savedAnswers: Record<string, string[]> = {};
  const savedTimeSpent: Record<string, number> = {};

  for (const a of saved) {
    savedAnswers[a.questionId] = (a.selectedOptions as any) ?? [];
    if (typeof a.timeSpent === "number") savedTimeSpent[a.questionId] = a.timeSpent;
  }

  return { savedAnswers, savedTimeSpent };
}

export async function POST(request: Request, { params }: { params: { templateId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return jsonNoStore({ error: "No autorizado" }, 401);

    const user = session.user as any;
    const role = String(user?.role ?? "").toUpperCase();
    if (role !== "CANDIDATE") return jsonNoStore({ error: "Forbidden" }, 403);

    const now = new Date();

    // Body opcional: { applicationId?: string, token?: string, attemptId?: string }
    let applicationId: string | null = null;
    let token: string | null = null;
    let resumeAttemptId: string | null = null;

    try {
      const body = await request.json();
      applicationId = body?.applicationId ? String(body.applicationId) : null;
      token = body?.token ? String(body.token) : null;
      resumeAttemptId = body?.attemptId ? String(body.attemptId) : null;
    } catch {
      applicationId = null;
      token = null;
      resumeAttemptId = null;
    }

    if (!token && !applicationId && !resumeAttemptId) {
      return jsonNoStore({ error: "Falta invitación o contexto (token/applicationId/attemptId)" }, 400);
    }

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
      return jsonNoStore({ error: "Template no encontrado o inactivo" }, 404);
    }

    // ✅ Congelar primitivos para evitar "template possibly null" dentro de closures
    const tmplTimeLimit = template.timeLimit ?? null;
    const tmplShuffleQuestions = Boolean(template.shuffleQuestions);
    const tmplAllowRetry = Boolean(template.allowRetry);
    const tmplMaxAttempts = template.maxAttempts ?? 1;

    const questionsRaw = await prisma.assessmentQuestion.findMany({
      where: { templateId: params.templateId, isActive: true },
      select: {
        id: true,
        section: true,
        difficulty: true,
        questionText: true,
        codeSnippet: true,
        options: true,
        allowMultiple: true,
      },
    });

    // 1) Si viene token: valida invite y fija applicationId real
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

      if (!invite) return jsonNoStore({ error: "Invitación inválida" }, 400);
      if (invite.candidateId !== user.id) return jsonNoStore({ error: "Invitación no autorizada" }, 403);
      if (invite.templateId !== params.templateId) {
        return jsonNoStore({ error: "Invitación no corresponde a este assessment" }, 400);
      }
      if (invite.expiresAt && invite.expiresAt <= now) return jsonNoStore({ error: "Invitación expirada" }, 410);

      const invStatus = String(invite.status ?? "").toUpperCase();
      if (invStatus === "CANCELLED") return jsonNoStore({ error: "Invitación cancelada" }, 410);
      if (invStatus === "SUBMITTED" || invStatus === "EVALUATED" || invStatus === "COMPLETED") {
        return jsonNoStore({ error: "Esta invitación ya fue completada" }, 400);
      }

      applicationId = invite.applicationId;
      resumeAttemptId = null;
    }

    // 2) Validar applicationId (si existe)
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

      if (!app) return jsonNoStore({ error: "applicationId inválido" }, 400);

      if (!app.job.assessments.length) {
        return jsonNoStore({ error: "Este assessment no está asignado a la vacante" }, 400);
      }

      if (invite && invite.jobId !== app.jobId) {
        return jsonNoStore({ error: "Invitación no corresponde a esta postulación" }, 400);
      }
    }

    // límites (por template a nivel candidato)
    const attemptsUsed = await prisma.assessmentAttempt.count({
      where: {
        candidateId: user.id,
        templateId: params.templateId,
        status: { in: ["SUBMITTED", "EVALUATED", "COMPLETED"] as any },
      },
    });

    if (!tmplAllowRetry && attemptsUsed > 0) {
      return jsonNoStore({ error: "Ya completaste esta evaluación" }, 400);
    }

    const maxAttempts = tmplMaxAttempts;
    if (attemptsUsed >= maxAttempts) {
      return jsonNoStore({ error: "Límite de intentos alcanzado" }, 400);
    }

    // Helper para crear intento nuevo (y liberar inviteId si venía ocupado)
    async function createFreshAttempt(params2: {
      oldAttemptId?: string | null;
      oldInviteId?: string | null;
      applicationIdToUse: string | null;
    }) {
      const metaNew = await ensureMeta(params.templateId, tmplShuffleQuestions);
      const newExpiresAt = computeExpiresAt(now, tmplTimeLimit);

      const created = await prisma.$transaction(async (tx) => {
        if (params2.oldAttemptId && params2.oldInviteId) {
          // liberar unique inviteId
          await tx.assessmentAttempt.update({
            where: { id: params2.oldAttemptId },
            data: { inviteId: null },
          });
        }

        const fresh = await tx.assessmentAttempt.create({
          data: {
            candidateId: user.id,
            templateId: params.templateId,
            applicationId: params2.applicationIdToUse,
            inviteId: params2.oldInviteId || (invite ? invite.id : null),
            status: "IN_PROGRESS" as any,
            attemptNumber: attemptsUsed + 1,
            startedAt: now,
            expiresAt: newExpiresAt,
            ipAddress: getClientIp(request),
            userAgent: request.headers.get("user-agent") || "unknown",
            flagsJson: metaNew,
          },
          select: { id: true },
        });

        const inviteIdToMark = params2.oldInviteId || (invite ? invite.id : null);
        if (inviteIdToMark) {
          await markInviteStartedTx(tx, inviteIdToMark, now);
        }

        return { fresh, metaNew, newExpiresAt };
      });

      const questions = buildQuestionsPayload(questionsRaw, created.metaNew);
      const { savedAnswers, savedTimeSpent } = await buildSaved(created.fresh.id);

      return jsonNoStore({
        attemptId: created.fresh.id,
        questions,
        expiresAt: created.newExpiresAt,
        timeLimit: tmplTimeLimit,
        reused: false,
        savedAnswers,
        savedTimeSpent,
      });
    }

    // 2.5) Si viene token: si ya existe un attempt ligado a ese invite:
    // - si está final => bloquear
    // - si está expirado => crear uno nuevo (liberando inviteId)
    // - si está activo => reusar
    if (invite) {
      const attemptByInvite = await prisma.assessmentAttempt.findFirst({
        where: { inviteId: invite.id, candidateId: user.id, templateId: params.templateId },
        select: {
          id: true,
          status: true,
          applicationId: true,
          expiresAt: true,
          startedAt: true,
          flagsJson: true,
        },
      });

      if (attemptByInvite) {
        if (isAttemptFinal(attemptByInvite.status)) {
          return jsonNoStore({ error: "El intento ya fue completado" }, 400);
        }

        if (isExpired(attemptByInvite.expiresAt, now)) {
          return createFreshAttempt({
            oldAttemptId: attemptByInvite.id,
            oldInviteId: invite.id,
            applicationIdToUse: applicationId || attemptByInvite.applicationId || null,
          });
        }

        const finalExpiresAt = attemptByInvite.expiresAt ?? computeExpiresAt(now, tmplTimeLimit);

        let meta = (attemptByInvite.flagsJson as any) || null;
        const hasMeta = Array.isArray(meta?.questionOrder) && meta.questionOrder.length > 0;
        if (!hasMeta) meta = await ensureMeta(params.templateId, tmplShuffleQuestions);

        await prisma.$transaction(async (tx) => {
          const atStatus = String(attemptByInvite.status ?? "").toUpperCase();

          const data: any = {};
          if (applicationId && attemptByInvite.applicationId !== applicationId) data.applicationId = applicationId;
          if (!attemptByInvite.expiresAt && finalExpiresAt) data.expiresAt = finalExpiresAt;
          if (!hasMeta) data.flagsJson = meta;

          if (atStatus === "NOT_STARTED") {
            data.status = "IN_PROGRESS" as any;
            data.startedAt = now;
            data.ipAddress = getClientIp(request);
            data.userAgent = request.headers.get("user-agent") || "unknown";
          }

          if (Object.keys(data).length) {
            await tx.assessmentAttempt.update({ where: { id: attemptByInvite.id }, data });
          }

          await markInviteStartedTx(tx, invite.id, now);
        });

        const questions = buildQuestionsPayload(questionsRaw, meta);
        const { savedAnswers, savedTimeSpent } = await buildSaved(attemptByInvite.id);

        return jsonNoStore({
          attemptId: attemptByInvite.id,
          questions,
          expiresAt: finalExpiresAt,
          timeLimit: tmplTimeLimit,
          reused: true,
          savedAnswers,
          savedTimeSpent,
        });
      }
    }

    // 3) resumeAttemptId sin token
    if (resumeAttemptId) {
      const attempt = await prisma.assessmentAttempt.findUnique({
        where: { id: resumeAttemptId },
        select: {
          id: true,
          candidateId: true,
          templateId: true,
          applicationId: true,
          inviteId: true,
          status: true,
          expiresAt: true,
          startedAt: true,
          flagsJson: true,
        },
      });

      if (!attempt) return jsonNoStore({ error: "Attempt no encontrado" }, 404);
      if (attempt.candidateId !== user.id) return jsonNoStore({ error: "No autorizado" }, 403);
      if (attempt.templateId !== params.templateId) {
        return jsonNoStore({ error: "Attempt no corresponde a este template" }, 400);
      }
      if (isAttemptFinal(attempt.status)) {
        return jsonNoStore({ error: "El intento ya fue completado" }, 400);
      }

      // ✅ si el attempt que intentan reanudar ya expiró, crear uno nuevo
      if (isExpired(attempt.expiresAt, now)) {
        return createFreshAttempt({
          oldAttemptId: attempt.inviteId ? attempt.id : null,
          oldInviteId: attempt.inviteId ? String(attempt.inviteId) : null,
          applicationIdToUse: applicationId || attempt.applicationId || null,
        });
      }

      const finalExpiresAt = attempt.expiresAt ?? computeExpiresAt(now, tmplTimeLimit);

      let meta = (attempt.flagsJson as any) || null;
      const hasMeta = Array.isArray(meta?.questionOrder) && meta.questionOrder.length > 0;
      if (!hasMeta) meta = await ensureMeta(params.templateId, tmplShuffleQuestions);

      const atStatus = String(attempt.status ?? "").toUpperCase();

      await prisma.$transaction(async (tx) => {
        const upd: any = {};

        if (atStatus === "NOT_STARTED") {
          upd.status = "IN_PROGRESS" as any;
          upd.startedAt = now;
          upd.ipAddress = getClientIp(request);
          upd.userAgent = request.headers.get("user-agent") || "unknown";
          upd.flagsJson = meta;
          if (!attempt.expiresAt && finalExpiresAt) upd.expiresAt = finalExpiresAt;
        } else {
          if (!attempt.expiresAt && finalExpiresAt) upd.expiresAt = finalExpiresAt;
          if (!hasMeta) upd.flagsJson = meta;
        }

        if (Object.keys(upd).length) {
          await tx.assessmentAttempt.update({ where: { id: attempt.id }, data: upd });
        }

        if (attempt.inviteId) {
          await markInviteStartedTx(tx, attempt.inviteId as any, now);
        }
      });

      const questions = buildQuestionsPayload(questionsRaw, meta);
      const { savedAnswers, savedTimeSpent } = await buildSaved(attempt.id);

      return jsonNoStore({
        attemptId: attempt.id,
        questions,
        expiresAt: finalExpiresAt,
        timeLimit: tmplTimeLimit,
        reused: true,
        savedAnswers,
        savedTimeSpent,
      });
    }

    // 4) fallback: crear intento nuevo
    const expiresAt = computeExpiresAt(now, tmplTimeLimit);
    const meta = await ensureMeta(params.templateId, tmplShuffleQuestions);
    const questions = buildQuestionsPayload(questionsRaw, meta);

    const created = await prisma.assessmentAttempt.create({
      data: {
        candidateId: user.id,
        templateId: params.templateId,
        applicationId: applicationId || null,
        inviteId: invite ? invite.id : null,
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

    if (invite) {
      await prisma.$transaction(async (tx) => {
        await markInviteStartedTx(tx, invite.id, now);
      });
    }

    const { savedAnswers, savedTimeSpent } = await buildSaved(created.id);

    return jsonNoStore({
      attemptId: created.id,
      questions,
      expiresAt,
      timeLimit: tmplTimeLimit,
      reused: false,
      savedAnswers,
      savedTimeSpent,
    });
  } catch (error: any) {
    console.error("Error starting attempt:", error);
    return jsonNoStore({ error: "Error al iniciar evaluación", detail: error?.message ?? String(error) }, 500);
  }
}
