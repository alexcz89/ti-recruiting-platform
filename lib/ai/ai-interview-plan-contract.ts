import { z } from "zod";

export const AI_INTERVIEW_PLAN_LIMITS = {
  roleTitle: { min: 3, max: 120 },
  techStack: { min: 1, max: 15, itemMaxLength: 80 },
  competencies: { min: 1, max: 10, idMaxLength: 80, nameMaxLength: 120 },
  criteria: { min: 1, max: 8, itemMaxLength: 500 },
  totalWeight: 100,
  timeLimitMinutes: { min: 10, max: 90 },
  maxQuestions: { min: 3, max: 20 },
  maxFollowUpsPerQuestion: { min: 0, max: 3 },
} as const;

// Normalize comparisons only; parsed values retain their spelling and internal spaces.
function duplicateIndices(values: string[]): number[] {
  const seen = new Set<string>();
  const duplicates: number[] = [];
  values.forEach((value, index) => {
    const key = value.trim().replace(/\s+/g, " ").toLowerCase();
    if (seen.has(key)) duplicates.push(index);
    seen.add(key);
  });
  return duplicates;
}

function rejectDuplicateStrings(values: string[], context: z.RefinementCtx) {
  for (const index of duplicateIndices(values)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [index],
      message: "No se permiten valores duplicados, ignorando mayúsculas y espacios redundantes.",
    });
  }
}

const CompetencySchema = z.object({
  id: z.string().trim().min(1).max(AI_INTERVIEW_PLAN_LIMITS.competencies.idMaxLength),
  name: z.string().trim().min(1).max(AI_INTERVIEW_PLAN_LIMITS.competencies.nameMaxLength),
  // Observable criteria are authored/reviewed as text; this contract does not score answers.
  criteria: z.array(z.string().trim().min(1).max(AI_INTERVIEW_PLAN_LIMITS.criteria.itemMaxLength))
    .min(AI_INTERVIEW_PLAN_LIMITS.criteria.min)
    .max(AI_INTERVIEW_PLAN_LIMITS.criteria.max)
    .superRefine(rejectDuplicateStrings),
  weight: z.number().finite().int().positive().max(AI_INTERVIEW_PLAN_LIMITS.totalWeight),
}).strict();

// Configuration only: no persistence identifiers, provider settings or hiring decisions.
export const AIInterviewPlanSchema = z.object({
  roleTitle: z.string().trim()
    .min(AI_INTERVIEW_PLAN_LIMITS.roleTitle.min)
    .max(AI_INTERVIEW_PLAN_LIMITS.roleTitle.max),
  seniority: z.enum(["JUNIOR", "MID", "SENIOR"]),
  techStack: z.array(z.string().trim().min(1).max(AI_INTERVIEW_PLAN_LIMITS.techStack.itemMaxLength))
    .min(AI_INTERVIEW_PLAN_LIMITS.techStack.min)
    .max(AI_INTERVIEW_PLAN_LIMITS.techStack.max)
    .superRefine(rejectDuplicateStrings),
  competencies: z.array(CompetencySchema)
    .min(AI_INTERVIEW_PLAN_LIMITS.competencies.min)
    .max(AI_INTERVIEW_PLAN_LIMITS.competencies.max),
  timeLimitMinutes: z.number().finite().int()
    .min(AI_INTERVIEW_PLAN_LIMITS.timeLimitMinutes.min)
    .max(AI_INTERVIEW_PLAN_LIMITS.timeLimitMinutes.max),
  maxQuestions: z.number().finite().int()
    .min(AI_INTERVIEW_PLAN_LIMITS.maxQuestions.min)
    .max(AI_INTERVIEW_PLAN_LIMITS.maxQuestions.max),
  maxFollowUpsPerQuestion: z.number().finite().int()
    .min(AI_INTERVIEW_PLAN_LIMITS.maxFollowUpsPerQuestion.min)
    .max(AI_INTERVIEW_PLAN_LIMITS.maxFollowUpsPerQuestion.max),
}).strict().superRefine((plan, context) => {
  for (const index of duplicateIndices(plan.competencies.map(competency => competency.id))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["competencies", index, "id"],
      message: "Los IDs de las competencias deben ser únicos, ignorando mayúsculas y espacios redundantes.",
    });
  }
  if (plan.competencies.reduce((total, competency) => total + competency.weight, 0) !== AI_INTERVIEW_PLAN_LIMITS.totalWeight) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["competencies"],
      message: "Las ponderaciones de las competencias deben sumar exactamente 100.",
    });
  }
});

export type AIInterviewPlan = z.infer<typeof AIInterviewPlanSchema>;
