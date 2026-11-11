import { describe, expect, it } from "vitest";
import { InterviewBlueprintSchema, INTERVIEW_BLUEPRINT_LIMITS, type InterviewBlueprint } from "@/lib/ai/ai-interview-blueprint-contract";

function blueprint(): InterviewBlueprint {
  return {
    plan: {
      roleTitle: "Backend Developer", seniority: "MID", techStack: ["Java", "SQL"],
      competencies: [
        { id: "java", name: "Java", criteria: ["Explica concurrencia"], weight: 50 },
        { id: "sql", name: "SQL", criteria: ["Justifica índices"], weight: 50 },
      ], timeLimitMinutes: 20, maxQuestions: 4, maxFollowUpsPerQuestion: 2,
    },
    questions: [
      { id: "q-1", competencyId: "java", text: "¿Cómo evitarías una condición de carrera?", order: 0 },
      { id: "q-2", competencyId: "sql", text: "¿Cómo elegirías un índice?", order: 1 },
      { id: "q-3", competencyId: "java", text: "¿Cómo probarías código concurrente?", order: 2 },
    ],
  };
}
describe("interview blueprint contract", () => {
  it("reuses the plan and keeps a fixed ordered set of main questions", () => {
    expect(InterviewBlueprintSchema.parse(blueprint())).toEqual(blueprint());
  });
  it("trims strings without mutating configuration", () => {
    const input = blueprint(); input.questions[0].text = "  Pregunta técnica  "; input.questions[0].id = "  q-1  ";
    const before = structuredClone(input);
    expect(InterviewBlueprintSchema.parse(input).questions[0]).toMatchObject({ id: "q-1", text: "Pregunta técnica" });
    expect(input).toEqual(before);
  });
  it("permits fewer questions than maxQuestions without requiring coverage of every competency", () => {
    const input = blueprint(); input.questions = input.questions.slice(0, 1);
    expect(InterviewBlueprintSchema.safeParse(input).success).toBe(true);
  });
  it("accepts exact text/ID and count boundaries from the existing plan", () => {
    const input = blueprint(); input.plan.maxQuestions = 20;
    input.questions = Array.from({ length: 20 }, (_, index) => ({ id: String(index).padStart(80, "q"), competencyId: "java", text: "T".repeat(8000), order: index }));
    expect(InterviewBlueprintSchema.parse(input)).toEqual(input);
    expect(INTERVIEW_BLUEPRINT_LIMITS.questionLength).toBe(8000);
  });
  it.each([null, "plan", [], {}, { plan: blueprint().plan }].map(input => ({ input })))("rejects incomplete or malformed blueprint $input", ({ input }) => {
    expect(InterviewBlueprintSchema.safeParse(input).success).toBe(false);
  });
  it("rejects a plan invalid under the original weight contract", () => {
    const input = blueprint(); input.plan.competencies[0].weight = 49;
    expect(InterviewBlueprintSchema.safeParse(input).success).toBe(false);
  });
  it.each([
    { id: "" }, { id: " " }, { id: 1 }, { id: "q".repeat(81) },
    { competencyId: "" }, { competencyId: "other" }, { competencyId: "JAVA" }, { competencyId: null },
    { text: "" }, { text: " \t " }, { text: "q".repeat(8001) }, { text: 42 },
    { order: -1 }, { order: 1.5 }, { order: NaN }, { order: Infinity }, { order: "0" }, { order: 20 },
  ])("rejects invalid question fields %j", patch => {
    const input = blueprint();
    expect(InterviewBlueprintSchema.safeParse({ ...input, questions: [{ ...input.questions[0], ...patch }, ...input.questions.slice(1)] }).success).toBe(false);
  });
  it.each(["id", "competencyId", "text", "order"])("requires question field %s", field => {
    const input = blueprint(); const question: Record<string, unknown> = { ...input.questions[0] }; delete question[field];
    expect(InterviewBlueprintSchema.safeParse({ ...input, questions: [question] }).success).toBe(false);
  });
  it.each(["q-1", " Q-1 "])("rejects duplicate IDs %j", id => {
    const input = blueprint(); input.questions[1].id = id;
    const result = InterviewBlueprintSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["questions", 1, "id"] }));
  });
  it.each(["empty", "excess-plan", "excess-global", "duplicate-order", "gap", "reversed", "wrong-type"])("rejects question collection %s", kind => {
    const input = blueprint();
    if (kind === "empty") input.questions = [];
    if (kind === "excess-plan") { input.plan.maxQuestions = 3; input.questions.push({ ...input.questions[0], id: "q-4", order: 3 }); }
    if (kind === "excess-global") input.questions = Array.from({ length: 21 }, (_, order) => ({ ...input.questions[0], id: `q-${order}`, order }));
    if (kind === "duplicate-order") input.questions[1].order = 0;
    if (kind === "gap") input.questions[1].order = 2;
    if (kind === "reversed") input.questions.reverse();
    expect(InterviewBlueprintSchema.safeParse(kind === "wrong-type" ? { ...input, questions: "q-1" } : input).success).toBe(false);
  });
  it("rejects unknown properties and does not treat an approved flag as authorization", () => {
    const input = blueprint();
    expect(InterviewBlueprintSchema.safeParse({ ...input, approved: true }).success).toBe(false);
    expect(InterviewBlueprintSchema.safeParse({ ...input, questions: [{ ...input.questions[0], solution: "secret" }] }).success).toBe(false);
  });
});
