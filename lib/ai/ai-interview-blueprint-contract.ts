import { z } from "zod";
import { AIInterviewPlanSchema, AI_INTERVIEW_PLAN_LIMITS } from "./ai-interview-plan-contract";

export const INTERVIEW_BLUEPRINT_LIMITS = { idLength: 80, questionLength: 8_000 } as const;

const MainQuestionSchema = z.object({
  id: z.string().trim().min(1).max(INTERVIEW_BLUEPRINT_LIMITS.idLength),
  competencyId: z.string().trim().min(1).max(AI_INTERVIEW_PLAN_LIMITS.competencies.idMaxLength),
  text: z.string().trim().min(1).max(INTERVIEW_BLUEPRINT_LIMITS.questionLength),
  order: z.number().finite().int().min(0).max(AI_INTERVIEW_PLAN_LIMITS.maxQuestions.max - 1),
}).strict();

// A blueprint is configuration, not proof of recruiter approval or authorization.
// The ordered array is authoritative: order must equal its zero-based position.
export const InterviewBlueprintSchema = z.object({
  plan: AIInterviewPlanSchema,
  questions: z.array(MainQuestionSchema).min(1).max(AI_INTERVIEW_PLAN_LIMITS.maxQuestions.max),
}).strict().superRefine((blueprint, context) => {
  if (blueprint.questions.length > blueprint.plan.maxQuestions) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["questions"], message: "Las preguntas exceden maxQuestions del plan." });
  }
  const competencies = new Set(blueprint.plan.competencies.map(item => item.id));
  const ids = new Set<string>();
  blueprint.questions.forEach((question, index) => {
    const key = question.id.toLowerCase().replace(/\s+/g, " ");
    if (ids.has(key)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["questions", index, "id"], message: "Los IDs de preguntas deben ser únicos." });
    ids.add(key);
    if (!competencies.has(question.competencyId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["questions", index, "competencyId"], message: "La competencia no existe en el plan." });
    if (question.order !== index) context.addIssue({ code: z.ZodIssueCode.custom, path: ["questions", index, "order"], message: "El orden debe coincidir con la posición consecutiva desde cero." });
  });
});

export type InterviewBlueprint = z.infer<typeof InterviewBlueprintSchema>;
