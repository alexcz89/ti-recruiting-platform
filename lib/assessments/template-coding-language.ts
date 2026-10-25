import { isCodingLanguage } from "@/lib/code-execution/languages";

type QuestionLanguage = {
  type?: unknown;
  language?: unknown;
  allowedLanguages?: unknown;
};

export function parseQuestionLanguages(raw: unknown): string[] | null {
  if (raw == null || raw === "") return [];
  let value: unknown = raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return null; }
  }
  return Array.isArray(value) && value.every(
    (language): language is string => typeof language === "string" && isCodingLanguage(language)
  ) ? value : null;
}

/** Missing question metadata inherits the template language (legacy builder contract). */
export function getTemplateCodingLanguageError(
  language: unknown,
  questions: readonly QuestionLanguage[],
  previous?: { language: string | null; questions: readonly QuestionLanguage[] }
): string | null {
  const coding = questions.filter(q => q.type === "CODING");
  if (!coding.length) return null;
  if (typeof language !== "string" || !isCodingLanguage(language)) {
    return "Selecciona un lenguaje compatible con Judge0 para las preguntas de código.";
  }
  if (previous?.questions.length && previous.language && previous.language !== language) {
    return "No puedes cambiar el lenguaje mientras el template contiene preguntas de código.";
  }
  for (const question of [...coding, ...(previous?.questions ?? [])]) {
    const allowed = parseQuestionLanguages(question.allowedLanguages);
    if ((question.language != null && question.language !== "" && question.language !== language) ||
        allowed === null || (allowed.length > 0 && !allowed.includes(language))) {
      return "El lenguaje del template debe coincidir con el de todas las preguntas de código.";
    }
  }
  return null;
}
