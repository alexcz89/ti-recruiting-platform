// lib/assessments/invites.ts
import { prisma } from '@/lib/server/prisma';
import { sendAssessmentInviteEmail } from '@/lib/server/mailer';
import crypto from "crypto";
import {
  computeInviteExpiresAt,
  inviteResendAction,
} from "@/lib/assessments/expiration";

type EnsureInviteParams = {
  applicationId: string;
  candidateId: string;
  templateId: string;

  // ✅ agrega jobId (por tu schema/flujo)
  jobId?: string;

  // opcionales
  expiresInDays?: number; // default 7
  baseUrl?: string; // para construir inviteUrl
  sendEmail?: boolean;

  // si sendEmail=true, pásame lo necesario (así evitamos queries extra)
  email?: {
    to: string;
    candidateName: string | null;
    jobTitle: string | null;
    companyName: string | null;
    templateTitle: string;
    timeLimit: number | null;
  };
};

export async function ensureAssessmentInviteForApplication(params: EnsureInviteParams) {
  const {
    applicationId,
    candidateId,
    templateId,
    jobId,
    expiresInDays = 7,
    baseUrl,
    sendEmail = true,
    email,
  } = params;

  const now = new Date();
  const newExpiresAt = computeInviteExpiresAt(now, expiresInDays);

  let didRotate = false;

  // 1) Busca invite existente por (applicationId, templateId)
  let invite = await prisma.assessmentInvite.findFirst({
    where: { applicationId, templateId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      token: true,
      status: true,
      expiresAt: true,
      sentAt: true,
    },
  });

  // 2) Si no existe, créalo (idempotente por @@unique([applicationId, templateId]))
  if (!invite) {
    const token = crypto.randomBytes(32).toString("hex");

    try {
      invite = await prisma.assessmentInvite.create({
        data: {
          application: { connect: { id: applicationId } },
          job: jobId ? { connect: { id: jobId } } : undefined,
          candidate: { connect: { id: candidateId } },
          template: { connect: { id: templateId } },

          token,
          status: "SENT" as any,
          expiresAt: newExpiresAt,
          sentAt: null,
        } as any,
        select: {
          id: true,
          token: true,
          status: true,
          expiresAt: true,
          sentAt: true,
        },
      });
    } catch (e: any) {
      if (String(e?.code || "") !== "P2002") throw e;

      invite = await prisma.assessmentInvite.findFirst({
        where: { applicationId, templateId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          token: true,
          status: true,
          expiresAt: true,
          sentAt: true,
        },
      });
    }
  }

  if (!invite) throw new Error("No se pudo crear/releer la invitación");

  const activeAttempt = await prisma.assessmentAttempt.findFirst({
    where: {
      applicationId,
      candidateId,
      templateId,
      status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });
  const linkedAttempt = await prisma.assessmentAttempt.findFirst({
    where: { inviteId: invite.id },
    select: { id: true },
  });
  const resendAction = inviteResendAction(
    invite,
    {
      hasActiveAttempt: Boolean(activeAttempt),
      hasLinkedAttempt: Boolean(linkedAttempt),
    },
    now
  );

  // 3) Sin attempt activo, rota ciclos terminados/expirados o renueva el pendiente.
  if (resendAction === "ROTATE") {
    didRotate = true;

    const rotatedToken = crypto.randomBytes(32).toString("hex");
    await prisma.assessmentAttempt.updateMany({
      where: { inviteId: invite.id },
      data: { inviteId: null },
    });
    invite = await prisma.assessmentInvite.update({
      where: { id: invite.id },
      data: {
        token: rotatedToken,
        status: "SENT" as any,
        expiresAt: newExpiresAt,
        sentAt: null, // se setea después si email ok/skipped
      } as any,
      select: {
        id: true,
        token: true,
        status: true,
        expiresAt: true,
        sentAt: true,
      },
    });
  } else if (resendAction === "RENEW") {
    invite = await prisma.assessmentInvite.update({
      where: { id: invite.id },
      data: { expiresAt: newExpiresAt } as any,
      select: {
        id: true,
        token: true,
        status: true,
        expiresAt: true,
        sentAt: true,
      },
    });
  }

  // 4) Email opcional (✅ evita spam: solo si no se había enviado antes o si rotó token)
  const shouldEmail =
    Boolean(sendEmail) &&
    Boolean(email?.to) &&
    Boolean(baseUrl) &&
    (!invite.sentAt || didRotate);

  if (shouldEmail) {
    const inviteUrl = new URL(`/assessments/${templateId}`, baseUrl!);
    inviteUrl.searchParams.set("token", invite.token);

    try {
      const r = await sendAssessmentInviteEmail({
        to: email!.to,
        candidateName: email!.candidateName,
        jobTitle: email!.jobTitle,
        companyName: email!.companyName,
        templateTitle: email!.templateTitle,
        timeLimit: email!.timeLimit,
        expiresAt: invite.expiresAt ?? null,
        inviteUrl: inviteUrl.toString(),
        dedupeKey: invite.id,
      } as any);

      if ((r as any)?.ok || (r as any)?.skipped) {
        invite = await prisma.assessmentInvite.update({
          where: { id: invite.id },
          data: { sentAt: now } as any,
          select: {
            id: true,
            token: true,
            status: true,
            expiresAt: true,
            sentAt: true,
          },
        });
      }
    } catch (err) {
      console.warn("[ensureAssessmentInviteForApplication] email failed", err);
    }
  } else if (sendEmail && email?.to && !baseUrl) {
    console.warn(
      "[ensureAssessmentInviteForApplication] sendEmail=true pero falta baseUrl; no se envió correo"
    );
  }

  return invite;
}
