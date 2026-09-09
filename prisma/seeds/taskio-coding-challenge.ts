import type { PrismaClient } from "@prisma/client";
import type { ContestRegistrationLanguage } from "../../lib/contests/domain";

type LanguageSeed = {
  enumValue: ContestRegistrationLanguage;
  runner: string;
  title: string;
  starterCode: string;
  buildInput: (records: CandidateFixture[], topN: number) => string;
};

type CandidateFixture = { name?: unknown; score?: unknown; experience?: unknown; english?: unknown };
type Fixture = { records: CandidateFixture[]; topN: number; expected: string };

const description = `## Objetivo
Implementa una solución que valide solicitudes de candidatos, elimine duplicados y devuelva los perfiles mejor clasificados.

## Entrada
Una lista de registros con name, score, experience e english, además de un entero topN.

## Reglas
Descarta nombres vacíos, valores no numéricos, experiencia negativa, niveles de inglés desconocidos y scores menores a 70. Compara nombres sin distinguir mayúsculas.

## Fórmula
- evaluación técnica: score × 0.70
- experiencia: 4 puntos por año, máximo 5 años
- inglés: A1=0, A2=2, B1=4, B2=6, C1=8, C2=10

## Ordenamiento
Conserva el duplicado con mayor puntaje final. Ordena por puntaje final descendente, luego score descendente y finalmente nombre ascendente.

## Salida
Devuelve como máximo topN nombres. Si topN es 0 o no hay registros válidos, devuelve una lista vacía.

## Ejemplo
Para topN=2 y dos registros válidos, devuelve los nombres en el orden calculado. El ejemplo público de práctica no forma parte de los casos puntuables.

## Casos inválidos
Devuelve una lista vacía cuando topN es 0. Ignora registros con nombre vacío, datos no numéricos, experiencia negativa, nivel de inglés desconocido o score menor a 70.

## Restricciones
No uses servicios externos. La solución se evaluará con listas vacías, empates, duplicados, campos inválidos, topN fuera de rango y límites.`;

const fixtures: Fixture[] = [
  { records: [{ name: "Ada", score: 80, experience: 2, english: "B1" }, { name: "Bruno", score: 90, experience: 0, english: "A1" }], topN: 2, expected: "Ada,Bruno" },
  { records: [{ name: "Mara", score: 69, experience: 5, english: "C2" }, { name: "Joel", score: 70, experience: 0, english: "A1" }], topN: 5, expected: "Joel" },
  { records: [{ name: "", score: 95, experience: 5, english: "C2" }, { name: "Rui", score: "oops", experience: 2, english: "B2" }, { name: "Sara", score: 82, experience: 2, english: "B2" }], topN: 3, expected: "Sara" },
  { records: [{ name: "Eva", score: 80, experience: 2, english: "B1" }, { name: "eva", score: 90, experience: 1, english: "B2" }], topN: 5, expected: "eva" },
  { records: [{ name: "Zoe", score: 100, experience: 10, english: "C2" }, { name: "Ian", score: 100, experience: 5, english: "C2" }], topN: 2, expected: "Ian,Zoe" },
  { records: [{ name: "Beto", score: 80, experience: 1, english: "B2" }, { name: "Alma", score: 80, experience: 1, english: "B2" }], topN: 2, expected: "Alma,Beto" },
  { records: [{ name: "Nora", score: 75, experience: 5, english: "C1" }, { name: "Omar", score: 95, experience: 0, english: "A1" }, { name: "Pia", score: 88, experience: 2, english: "B2" }], topN: 2, expected: "Nora,Pia" },
  { records: [{ name: "Leo", score: 70, experience: 5, english: "C2" }], topN: 0, expected: "" },
  { records: [{ name: "Sol", score: 70, experience: 0, english: "C2" }, { name: "Teo", score: 80, experience: 0, english: "A1" }], topN: 1, expected: "Sol" },
  { records: [{ name: "Uma", score: 90, experience: 6, english: "B1" }, { name: "Val", score: 90, experience: 5, english: "B1" }], topN: 2, expected: "Uma,Val" },
  { records: [{ name: "Ximena", score: 72, experience: 1, english: "A2" }, { name: "Yuri", score: 71, experience: 2, english: "A1" }], topN: 10, expected: "Yuri,Ximena" },
  { records: [{ name: "Ada", score: 99, experience: 4, english: "C2" }, { name: "Bob", score: 98, experience: 5, english: "C2" }, { name: "Cid", score: 97, experience: 5, english: "C2" }], topN: 2, expected: "Bob,Cid" },
  { records: [{ name: "Nia", score: 90, experience: -1, english: "B2" }, { name: "Ori", score: 80, experience: 0, english: "B2" }], topN: 2, expected: "Ori" },
  { records: [{ name: "Tere", score: 90, experience: 3, english: "Z9" }, { name: "Sara", score: 80, experience: 0, english: "A1" }], topN: 2, expected: "Sara" },
  { records: [{ name: "Luz", score: 88, experience: 3, english: "B2" }, { name: "luz", score: 88, experience: 4, english: "B2" }, { name: "Max", score: 89, experience: 2, english: "B2" }], topN: 2, expected: "luz,Max" },
];

function lineInput(records: CandidateFixture[], topN: number) {
  return [String(topN), ...records.map((r) => `${r.name ?? ""}|${r.score ?? ""}|${r.experience ?? ""}|${r.english ?? ""}`)].join("\n");
}

function jsInput(records: CandidateFixture[], topN: number) {
  return `console.log(rankCandidates(${JSON.stringify(records)}, ${topN}).join(","));`;
}

const languages: LanguageSeed[] = [
  {
    enumValue: "PYTHON",
    runner: "python",
    title: "Python",
    starterCode: `import sys

def rank_candidates(records, top_n):
    # Implementa tu solución
    return []

def main():
    lines = sys.stdin.read().splitlines()
    top_n = int(lines[0]) if lines else 0
    records = []
    for line in lines[1:]:
        parts = (line.split("|") + ["", "", "", ""])[:4]
        name, score, experience, english = parts
        try:
            parsed_score = int(score)
        except ValueError:
            parsed_score = None
        try:
            parsed_experience = int(experience)
        except ValueError:
            parsed_experience = None
        records.append({"name": name or None, "score": parsed_score, "experience": parsed_experience, "english": english or None})
    print(",".join(rank_candidates(records, top_n)))

if __name__ == "__main__":
    main()`,
    buildInput: lineInput,
  },
  {
    enumValue: "JAVASCRIPT",
    runner: "javascript",
    title: "JavaScript",
    starterCode: `function rankCandidates(records, topN) {
  // Implementa tu solución
  return [];
}`,
    buildInput: jsInput,
  },
  {
    enumValue: "JAVA",
    runner: "java",
    title: "Java",
    starterCode: `import java.util.*;

public class Main {
  static class Candidate {
    String name, english;
    int score, experience;
    Candidate(String line) {
      String[] p = (line + "||||").split("\\\\|", -1);
      name = p[0]; english = p[3];
      try { score = Integer.parseInt(p[1]); } catch (NumberFormatException error) { score = -1; }
      try { experience = Integer.parseInt(p[2]); } catch (NumberFormatException error) { experience = -1; }
    }
  }

  static List<String> rankCandidates(List<Candidate> records, int topN) {
    // Implementa tu solución
    return new ArrayList<>();
  }

  public static void main(String[] args) {
    Scanner scanner = new Scanner(System.in);
    int topN = scanner.hasNextLine() ? Integer.parseInt(scanner.nextLine()) : 0;
    List<Candidate> records = new ArrayList<>();
    while (scanner.hasNextLine()) records.add(new Candidate(scanner.nextLine()));
    System.out.println(String.join(",", rankCandidates(records, topN)));
  }
}`,
    buildInput: lineInput,
  },
];

export async function seedTaskioCodingChallenge(prisma: PrismaClient) {
  const contest = await prisma.contest.upsert({
    where: { slug: "taskio-coding-challenge-2026" },
    update: {
      title: "TaskIO Coding Challenge 2026 — Edición Junior",
      subtitle: "Resuelve un reto práctico de programación, demuestra cómo estructuras una solución y obtén una credencial verificable de TaskIO.",
      description,
      status: "REGISTRATION_OPEN",
      registrationOpens: new Date("2026-08-01T06:00:00.000Z"),
      registrationCloses: new Date("2026-09-26T05:59:59.000Z"),
      challengeOpens: new Date("2026-09-28T06:00:00.000Z"),
      challengeCloses: new Date("2026-10-01T06:00:00.000Z"),
      finalStartsAt: new Date("2026-10-15T23:00:00.000Z"),
      maxParticipants: 150,
      rulesJson: { durationMinutes: 60, attempts: 1, finalists: 10, windowHours: 72, audience: "JUNIOR_MAX_2_YEARS", country: "MX", mode: "REMOTE", timezone: "America/Mexico_City", aiPolicy: "DECLARE_AND_DEFEND" },
      prizesJson: { status: "TO_BE_ANNOUNCED", top3Prize: true, top10Certificate: true },
    },
    create: {
      slug: "taskio-coding-challenge-2026",
      title: "TaskIO Coding Challenge 2026 — Edición Junior",
      subtitle: "Resuelve un reto práctico de programación, demuestra cómo estructuras una solución y obtén una credencial verificable de TaskIO.",
      description,
      status: "REGISTRATION_OPEN",
      registrationOpens: new Date("2026-08-01T06:00:00.000Z"),
      registrationCloses: new Date("2026-09-26T05:59:59.000Z"),
      challengeOpens: new Date("2026-09-28T06:00:00.000Z"),
      challengeCloses: new Date("2026-10-01T06:00:00.000Z"),
      finalStartsAt: new Date("2026-10-15T23:00:00.000Z"),
      maxParticipants: 150,
      rulesJson: { durationMinutes: 60, attempts: 1, finalists: 10, windowHours: 72, audience: "JUNIOR_MAX_2_YEARS", country: "MX", mode: "REMOTE", timezone: "America/Mexico_City", aiPolicy: "DECLARE_AND_DEFEND" },
      prizesJson: { status: "TO_BE_ANNOUNCED", top3Prize: true, top10Certificate: true },
    },
  });

  for (const language of languages) {
    const slug = `taskio-coding-challenge-2026-${language.runner}`;
    const template = await prisma.assessmentTemplate.upsert({
      where: { slug },
      update: {
        title: `TaskIO Coding Challenge 2026 · ${language.title}`,
        description,
        type: "CODING",
        difficulty: "JUNIOR",
        totalQuestions: 1,
        passingScore: 70,
        timeLimit: 60,
        sections: [{ name: "Procesamiento de solicitudes", questions: 1, weight: 100 }],
        allowRetry: false,
        maxAttempts: 1,
        shuffleQuestions: false,
        isActive: true,
        language: language.runner,
      },
      create: {
        title: `TaskIO Coding Challenge 2026 · ${language.title}`,
        slug,
        description,
        type: "CODING",
        difficulty: "JUNIOR",
        totalQuestions: 1,
        passingScore: 70,
        timeLimit: 60,
        sections: [{ name: "Procesamiento de solicitudes", questions: 1, weight: 100 }],
        allowRetry: false,
        maxAttempts: 1,
        shuffleQuestions: false,
        penalizeWrong: false,
        isActive: true,
        isGlobal: true,
        language: language.runner,
      },
    });

    const existingQuestion = await prisma.assessmentQuestion.findFirst({ where: { templateId: template.id } });
    const questionData = {
      section: "Procesamiento de solicitudes",
      difficulty: "JUNIOR" as const,
      tags: ["arreglos", "validacion", "ordenamiento", "casos-limite"],
      questionText: `# Procesamiento de solicitudes\n\n${description}`,
      type: "CODING" as const,
      language: language.runner,
      allowedLanguages: JSON.stringify([language.runner]),
      starterCode: language.starterCode,
      options: [],
      allowMultiple: false,
      isActive: true,
    };

    const question = existingQuestion
      ? await prisma.assessmentQuestion.update({ where: { id: existingQuestion.id }, data: questionData })
      : await prisma.assessmentQuestion.create({ data: { ...questionData, templateId: template.id } });

    await prisma.codeTestCase.deleteMany({ where: { questionId: question.id } });
    await prisma.codeTestCase.createMany({
      data: fixtures.map((fixture, index) => ({
        questionId: question.id,
        input: language.buildInput(fixture.records, fixture.topN),
        expectedOutput: fixture.expected,
        isHidden: index >= 3,
        points: 5,
        timeoutMs: 5000,
        memoryLimitMb: 256,
        orderIndex: index,
      })),
    });

    await prisma.contestTrack.upsert({
      where: { contestId_language: { contestId: contest.id, language: language.enumValue } },
      update: { templateId: template.id, isActive: true },
      create: { contestId: contest.id, templateId: template.id, language: language.enumValue, isActive: true },
    });
  }

  await prisma.contestTrack.updateMany({
    where: { contestId: contest.id, language: "TYPESCRIPT" },
    data: { isActive: false },
  });

  console.log("✅ TaskIO Coding Challenge 2026 Junior listo (3 lenguajes, 15 casos por pista)");
}