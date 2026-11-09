import { describe, expect, expectTypeOf, it } from "vitest";
import { AIInterviewPlanSchema, AI_INTERVIEW_PLAN_LIMITS, type AIInterviewPlan } from "@/lib/ai/ai-interview-plan-contract";

function validPlan(): AIInterviewPlan {
  return {
    roleTitle: "Backend Developer",
    seniority: "MID",
    techStack: ["Java", "Spring Boot", "PostgreSQL"],
    competencies: [
      { id: "java-concurrency", name: "Java y concurrencia", criteria: ["Explica mecanismos de sincronización", "Identifica condiciones de carrera", "Justifica decisiones de concurrencia"], weight: 35 },
      { id: "rest-apis", name: "Diseño de APIs REST", criteria: ["Explica el uso adecuado de métodos HTTP", "Diseña contratos de API", "Considera validación y manejo de errores"], weight: 30 },
      { id: "databases", name: "SQL y bases de datos", criteria: ["Comprende consultas SQL", "Identifica problemas de rendimiento", "Explica índices y transacciones"], weight: 20 },
      { id: "testing", name: "Testing y calidad", criteria: ["Propone pruebas unitarias", "Identifica escenarios de error", "Explica estrategias de mantenimiento"], weight: 15 },
    ],
    timeLimitMinutes: 30,
    maxQuestions: 8,
    maxFollowUpsPerQuestion: 2,
  };
}

function expectIssue(input: unknown, path: Array<string | number>, message?: RegExp) {
  const result = AIInterviewPlanSchema.safeParse(input);
  expect(result.success).toBe(false);
  if (result.success) throw new Error("Expected an invalid interview plan");
  expect(result.error.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ path, ...(message ? { message: expect.stringMatching(message) } : {}) }),
  ]));
  return result.error;
}

describe("AI interview plan: pure configuration contract", () => {
  it("accepts the complete product example with inferred types and weights 35+30+20+15", () => {
    const input = validPlan();
    const plan: AIInterviewPlan = AIInterviewPlanSchema.parse(input);
    expect(plan).toEqual(input);
    expectTypeOf(plan.seniority).toEqualTypeOf<"JUNIOR" | "MID" | "SENIOR">();
    expectTypeOf(plan.competencies[0].weight).toEqualTypeOf<number>();
    expect(plan.competencies.reduce((sum, competency) => sum + competency.weight, 0)).toBe(100);
    expect(AIInterviewPlanSchema.safeParse(input)).toEqual({ success: true, data: input });
  });

  it("trims declared strings without mutating even frozen input or normalizing stored content", () => {
    const input = validPlan();
    input.roleTitle = "  Backend Developer  "; input.techStack[1] = "  Spring  Boot  ";
    input.competencies[0].id = "  Java-Concurrency  "; input.competencies[0].name = "  Java y concurrencia  ";
    input.competencies[0].criteria[0] = "  Explica  sincronización  ";
    const before = structuredClone(input);
    for (const competency of input.competencies) { Object.freeze(competency.criteria); Object.freeze(competency); }
    Object.freeze(input.competencies); Object.freeze(input.techStack); Object.freeze(input);
    const plan = AIInterviewPlanSchema.parse(input);
    expect(input).toEqual(before);
    expect(plan).not.toBe(input); expect(plan.competencies).not.toBe(input.competencies);
    expect(plan.roleTitle).toBe("Backend Developer"); expect(plan.techStack[1]).toBe("Spring  Boot");
    expect(plan.competencies[0]).toMatchObject({ id: "Java-Concurrency", name: "Java y concurrencia" });
    expect(plan.competencies[0].criteria[0]).toBe("Explica  sincronización");
  });

  it.each(["JUNIOR", "MID", "SENIOR"] as const)("accepts seniority %s", seniority => {
    expect(AIInterviewPlanSchema.parse({ ...validPlan(), seniority }).seniority).toBe(seniority);
  });
  it("allows more competencies than questions and shared criteria between distinct competencies", () => {
    const input = validPlan(); input.maxQuestions = 3;
    input.competencies[1].criteria = [...input.competencies[0].criteria];
    expect(AIInterviewPlanSchema.safeParse(input).success).toBe(true);
  });

  it.each(Object.keys(validPlan()))("requires the field %s, without silent defaults", key => {
    const input: Record<string, unknown> = validPlan(); delete input[key];
    expectIssue(input, [key]);
  });
  it.each(["", "   ", "AB", "x".repeat(121), null, 7])("rejects invalid role titles: %j", roleTitle => {
    expectIssue({ ...validPlan(), roleTitle }, ["roleTitle"]);
  });
  it.each(["LEAD", "mid", "", 1, null])("rejects unknown seniority %j", seniority => {
    expectIssue({ ...validPlan(), seniority }, ["seniority"]);
  });
  it.each([null, [], "Backend", 42, true].map(input => ({ input })))("rejects a non-object plan $input", ({ input }) => {
    expectIssue(input, []);
  });
  it.each([[], "Java", null, [5], [false], [null], [""], [" \t "], ["x".repeat(81)]].map(techStack => ({ techStack })))("rejects invalid tech stacks $techStack", ({ techStack }) => {
    expect(AIInterviewPlanSchema.safeParse({ ...validPlan(), techStack }).success).toBe(false);
  });
  it.each([["Java", "Java"], ["Java", " java "], ["Spring Boot", " SPRING  \tBoot "]].map(techStack => ({ techStack })))("rejects duplicate technologies $techStack", ({ techStack }) => {
    expectIssue({ ...validPlan(), techStack }, ["techStack", 1], /duplicados/);
  });
  it("rejects more than 15 technologies", () => {
    expectIssue({ ...validPlan(), techStack: Array.from({ length: 16 }, (_, index) => `Technology ${index}`) }, ["techStack"]);
  });

  it.each([[], null, "Java", [null], ["Java"]].map(competencies => ({ competencies })))("rejects an invalid competency collection $competencies", ({ competencies }) => {
    expect(AIInterviewPlanSchema.safeParse({ ...validPlan(), competencies }).success).toBe(false);
  });
  it("rejects more than 10 competencies even when the total weight is valid", () => {
    const competencies = Array.from({ length: 11 }, (_, index) => ({ id: `competency-${index}`, name: "Skill", criteria: ["Explica el criterio"], weight: index === 0 ? 10 : 9 }));
    expectIssue({ ...validPlan(), competencies }, ["competencies"]);
  });
  it.each(["java-concurrency", " Java-Concurrency "])("rejects duplicate competency IDs %j with a precise issue path", id => {
    const input = validPlan(); input.competencies[1].id = id;
    expectIssue(input, ["competencies", 1, "id"], /IDs.*únicos/);
  });
  it.each([
    { id: "" }, { id: "  " }, { id: "x".repeat(81) }, { id: 5 },
    { name: "" }, { name: "  " }, { name: "x".repeat(121) }, { name: null },
    { criteria: [] }, { criteria: null }, { criteria: "Explains" }, { criteria: [""] }, { criteria: [" \t "] },
    { criteria: [4] }, { criteria: ["x".repeat(501)] },
  ])("rejects invalid competency content %j", patch => {
    const input = validPlan();
    expect(AIInterviewPlanSchema.safeParse({ ...input, competencies: [{ ...input.competencies[0], ...patch }, ...input.competencies.slice(1)] }).success).toBe(false);
  });
  it.each(["Explica SQL", " explica  SQL "])("rejects duplicate criteria %j within one competency", criterion => {
    const input = validPlan(); input.competencies[0].criteria = ["Explica SQL", criterion];
    expectIssue(input, ["competencies", 0, "criteria", 1], /duplicados/);
  });
  it("rejects more than eight criteria per competency", () => {
    const input = validPlan(); input.competencies[0].criteria = Array.from({ length: 9 }, (_, index) => `Explica criterio ${index}`);
    expectIssue(input, ["competencies", 0, "criteria"]);
  });
  it.each([99, 101])("rejects weight sum %s without normalization and reports the collection", total => {
    const input = validPlan(); input.competencies[3].weight += total - 100;
    const before = structuredClone(input);
    expectIssue(input, ["competencies"], /sumar exactamente 100/);
    expect(input).toEqual(before);
  });
  it.each([-1, 0, 1.5, NaN, Infinity, -Infinity, 101, "35", null])("rejects invalid individual weight %j", weight => {
    const input = validPlan();
    expectIssue({ ...input, competencies: [{ ...input.competencies[0], weight }, ...input.competencies.slice(1)] }, ["competencies", 0, "weight"]);
  });

  it("accepts all minimum boundaries and one competency with weight 100", () => {
    const input = { ...validPlan(), roleTitle: "Dev", techStack: ["C"],
      competencies: [{ id: "c", name: "C", criteria: ["Explica C"], weight: 100 }],
      timeLimitMinutes: 10, maxQuestions: 3, maxFollowUpsPerQuestion: 0 };
    expect(AIInterviewPlanSchema.parse(input)).toEqual(input);
  });
  it("accepts all maximum lengths and counts without changing configured limits", () => {
    const input = { ...validPlan(), roleTitle: "R".repeat(120),
      techStack: Array.from({ length: 15 }, (_, index) => String(index).padStart(80, "T")),
      competencies: Array.from({ length: 10 }, (_, index) => ({ id: String(index).padStart(80, "i"), name: "N".repeat(120),
        criteria: Array.from({ length: 8 }, (_, criterion) => String(criterion).padStart(500, "C")), weight: 10 })),
      timeLimitMinutes: 90, maxQuestions: 20, maxFollowUpsPerQuestion: 3 };
    expect(AIInterviewPlanSchema.parse(input)).toEqual(input);
    expect(AI_INTERVIEW_PLAN_LIMITS.totalWeight).toBe(100);
  });
  it.each([
    ["timeLimitMinutes", 9], ["timeLimitMinutes", 91], ["maxQuestions", 2], ["maxQuestions", 21],
    ["maxFollowUpsPerQuestion", -1], ["maxFollowUpsPerQuestion", 4],
  ] as const)("rejects out-of-range %s=%s", (field, value) => {
    expectIssue({ ...validPlan(), [field]: value }, [field]);
  });
  describe.each(["timeLimitMinutes", "maxQuestions", "maxFollowUpsPerQuestion"] as const)("strict operational integer %s", field => {
    it.each([1.5, NaN, Infinity, -Infinity, "10", null, true])("rejects %j without coercion", value => {
      expectIssue({ ...validPlan(), [field]: value }, [field]);
    });
  });

  it("rejects unknown properties at both levels rather than silently stripping metadata", () => {
    const input = validPlan();
    expectIssue({ ...input, companyId: "untrusted-company" }, []);
    expectIssue({ ...input, competencies: [{ ...input.competencies[0], automaticHire: true }, ...input.competencies.slice(1)] }, ["competencies", 0]);
  });
  it.each(["id", "name", "criteria", "weight"])("requires competency field %s", field => {
    const input = validPlan(); const competency: Record<string, unknown> = { ...input.competencies[0] }; delete competency[field];
    expectIssue({ ...input, competencies: [competency, ...input.competencies.slice(1)] }, ["competencies", 0, field]);
  });
});
