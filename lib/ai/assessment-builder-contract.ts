import { z } from "zod";
import { isCodingLanguage } from "@/lib/code-execution/languages";

export const MAX_GENERATION_PROMPT_LENGTH = 6_000;
export const MAX_GENERATION_BODY_BYTES = 24_000;

// MCQs can cover languages that Judge0 cannot execute.
const topicLanguages = [
  "", "javascript", "typescript", "python", "java", "cpp", "c", "csharp",
  "go", "rust", "kotlin", "swift", "sql", "php", "ruby", "scala", "r",
  "bash", "perl", "lua", "haskell", "elixir", "erlang", "clojure", "fsharp",
  "ocaml", "commonlisp", "objectivec", "pascal", "prolog", "cobol", "fortran",
  "d", "groovy", "nim", "octave", "vbnet", "assembly", "basic", "javafx",
] as const;

export const GenerationInputSchema = z.object({
  prompt: z.string().trim().min(1).max(MAX_GENERATION_PROMPT_LENGTH),
  questionType: z.enum(["MULTIPLE_CHOICE", "CODING"]),
  language: z.enum(topicLanguages).default(""),
  difficulty: z.enum(["JUNIOR", "MID", "SENIOR"]).default("MID"),
  count: z.number().int().min(1).max(5).default(1),
}).strict().refine(
  (input) => input.questionType !== "CODING" || isCodingLanguage(input.language),
  { path: ["language"], message: "Selecciona un lenguaje compatible con Judge0" }
);

const questionFields = {
  questionText: z.string().trim().min(1).max(8_000),
  section: z.string().trim().min(1).max(100),
  difficulty: z.enum(["JUNIOR", "MID", "SENIOR"]),
  explanation: z.string().trim().min(1).max(12_000),
};

export const GeneratedMCQSchema = z.object({
  ...questionFields,
  type: z.literal("MULTIPLE_CHOICE"),
  options: z.array(z.object({
    text: z.string().trim().min(1).max(2_000),
    isCorrect: z.boolean(),
  }).strict()).length(4),
}).strict();

export const GeneratedCodingSchema = z.object({
  ...questionFields,
  type: z.literal("CODING"),
  codeSnippet: z.string().min(1).max(12_000),
  allowedLanguages: z.array(z.string().min(1).max(30)).length(1),
  testCases: z.array(z.object({
    input: z.string().min(1).max(10_000),
    expectedOutput: z.string().min(1).max(4_000),
    isHidden: z.boolean(),
  }).strict()).min(2).max(10),
}).strict();

export type GenerationInput = z.infer<typeof GenerationInputSchema>;
export type GeneratedQuestion = z.infer<typeof GeneratedMCQSchema> | z.infer<typeof GeneratedCodingSchema>;
