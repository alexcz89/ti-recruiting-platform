// lib/assessments/invites.ts
import { prisma } from '@/lib/server/prisma';
import { sendAssessmentInviteEmail } from '@/lib/server/mailer';
import crypto from "crypto";

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

function computeExpiresAt(days: number) {
  return new Date(Date.now() + 1000 * 60 * 60 * 24 * days);
}

function isInviteReusable(inv: { status: any; expiresAt: Date | null }, now: Date) {
  // Reusable si está en flujo activo (SENT/STARTED) y no expiró
  if (inv.status !== "SENT" && inv.status !== "STARTED") return false;
  if (inv.expiresAt && inv.expiresAt <= now) return false;
  return true;
}

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
  const newExpiresAt = computeExpiresAt(expiresInDays);

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

  // 3) Si NO es reusable, rota token y reinicia a SENT
  if (!isInviteReusable(invite, now)) {
    didRotate = true;

    const rotatedToken = crypto.randomBytes(32).toString("hex");
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
  } else {
    // Reusable: si está SENT, puedes extender expiración (opcional)
    if (invite.status === "SENT") {
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
