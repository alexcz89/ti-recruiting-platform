import "server-only";
import type { Prisma } from "@prisma/client";

export class AssessmentTemplateMutationError extends Error {
  constructor(
    readonly status: 404 | 409,
    readonly code: "ASSESSMENT_TEMPLATE_NOT_FOUND" | "ASSESSMENT_TEMPLATE_IN_USE",
    message: string,
  ) { super(message); }
}

/** Authorization, locking and usage checks must share the mutation's transaction. */
export async function assertAssessmentTemplateEditableTx(
  tx: Prisma.TransactionClient,
  id: string,
  managementWhere: Prisma.AssessmentTemplateWhereInput,
) {
  // Authorize before inspecting usage, then recheck after waiting for the lock.
  const where = { id, isActive: true, ...managementWhere };
  if (!await tx.assessmentTemplate.findFirst({ where, select: { id: true } })) {
    throw new AssessmentTemplateMutationError(404, "ASSESSMENT_TEMPLATE_NOT_FOUND", "Template no encontrado o sin permisos");
  }
  // FOR UPDATE (not NO KEY UPDATE) conflicts with the KEY SHARE acquired by
  // PostgreSQL FK inserts for invites, attempts, assignments and contest tracks.
  await tx.$queryRaw`SELECT id FROM "AssessmentTemplate" WHERE id = ${id} FOR UPDATE`;
  const template = await tx.assessmentTemplate.findFirst({
    where,
    select: {
      isBadgeExam: true,
      _count: { select: { invites: true, attempts: true, jobAssessments: true, contestTracks: true } },
      // Also protect evidence whose question/template link predates current invariants.
      questions: {
        where: { OR: [{ answers: { some: {} } }, { executions: { some: {} } }, { timesUsed: { gt: 0 } }] },
        select: { id: true }, take: 1,
      },
      codingChallenges: { where: { submissions: { some: {} } }, select: { id: true }, take: 1 },
    },
  });
  if (!template) {
    throw new AssessmentTemplateMutationError(404, "ASSESSMENT_TEMPLATE_NOT_FOUND", "Template no encontrado o sin permisos");
  }
  if (template.isBadgeExam || Object.values(template._count).some(count => count > 0) || template.questions.length || template.codingChallenges.length) {
    throw new AssessmentTemplateMutationError(409, "ASSESSMENT_TEMPLATE_IN_USE",
      "Esta evaluación ya tiene invitaciones, intentos o está publicada en un proceso. Para proteger los resultados históricos, no puedes modificarla ni desactivarla.");
  }
}

/** Reject a stale question snapshot before persisting a new attempt's ordering. */
export async function assertAssessmentQuestionSnapshotTx(
  tx: Prisma.TransactionClient,
  templateId: string,
  questionIds: string[],
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "AssessmentTemplate" WHERE id = ${templateId} AND "isActive" = true FOR KEY SHARE`;
  const current = await tx.assessmentQuestion.findMany({
    where: { templateId, isActive: true }, select: { id: true },
  });
  const expected = new Set(questionIds);
  if (!rows.length || current.length !== expected.size || current.some(question => !expected.has(question.id))) {
    throw Object.assign(new Error("La evaluación cambió. Vuelve a iniciarla para cargar las preguntas actuales."), {
      code: "ASSESSMENT_TEMPLATE_CHANGED",
    });
  }
}
