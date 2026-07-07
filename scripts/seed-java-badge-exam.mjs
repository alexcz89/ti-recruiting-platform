// scripts/seed-java-badge-exam.mjs
// Crea el examen de badge "Certificación Java · Básico" clonando las 34
// preguntas MCQ del template NFQ - Java Junior (contenido ya validado).
// Idempotente: si el template de badge ya existe con preguntas, no duplica.
//
// Uso: node scripts/seed-java-badge-exam.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SOURCE_SLUG = "JAVA_JUNIOR_NFQ";
const BADGE_SLUG = "badge-java-basico";
const BADGE_LEVEL = 1; // Básico

async function main() {
  const source = await prisma.assessmentTemplate.findUnique({
    where: { slug: SOURCE_SLUG },
    include: { questions: { where: { isActive: true } } },
  });
  if (!source) throw new Error(`Template fuente ${SOURCE_SLUG} no encontrado`);
  if (source.questions.length === 0)
    throw new Error(`Template fuente ${SOURCE_SLUG} sin preguntas activas`);

  const javaTerm = await prisma.taxonomyTerm.findFirst({
    where: { kind: "SKILL", slug: "java" },
    select: { id: true, label: true },
  });
  if (!javaTerm) throw new Error("TaxonomyTerm SKILL 'java' no encontrado");

  // sections con name Y title: el scoring por sección usa `name`,
  // los seeds históricos usan `title`.
  const sections = (Array.isArray(source.sections) ? source.sections : []).map(
    (s) => ({
      name: s?.name ?? s?.title ?? "General",
      title: s?.title ?? s?.name ?? "General",
      ...(s?.weight != null ? { weight: s.weight } : {}),
    })
  );

  const template = await prisma.assessmentTemplate.upsert({
    where: { slug: BADGE_SLUG },
    create: {
      slug: BADGE_SLUG,
      title: "Certificación Java · Básico",
      description:
        "Demuestra tus fundamentos de Java: sintaxis, POO, colecciones, Java 8 (streams y lambdas) y nociones de Git y HTTP. Al aprobar obtienes el badge verificado Java · Básico en tu perfil.",
      type: "MCQ",
      difficulty: "JUNIOR",
      totalQuestions: 15, // se sortean 15 del pool de 34 por intento
      passingScore: 70,
      timeLimit: 25,
      sections,
      shuffleQuestions: true,
      allowRetry: true,
      maxAttempts: 99, // el flujo de badge se gobierna por cooldown, no por maxAttempts
      isActive: true,
      isGlobal: true,
      companyId: null,
      language: "es",
      baseCreditCost: 0,
      isBadgeExam: true,
      badgeTermId: javaTerm.id,
      badgeLevel: BADGE_LEVEL,
    },
    update: {
      isBadgeExam: true,
      badgeTermId: javaTerm.id,
      badgeLevel: BADGE_LEVEL,
      isActive: true,
      isGlobal: true,
    },
  });

  const existingQuestions = await prisma.assessmentQuestion.count({
    where: { templateId: template.id },
  });

  if (existingQuestions > 0) {
    console.log(
      `Template ${BADGE_SLUG} ya tiene ${existingQuestions} preguntas — no se duplican.`
    );
  } else {
    await prisma.assessmentQuestion.createMany({
      data: source.questions.map((q) => ({
        templateId: template.id,
        section: q.section,
        difficulty: q.difficulty,
        tags: q.tags,
        questionText: q.questionText,
        codeSnippet: q.codeSnippet,
        options: q.options,
        allowMultiple: q.allowMultiple,
        explanation: q.explanation,
        type: q.type,
        language: q.language,
        isActive: true,
      })),
    });
    console.log(
      `Copiadas ${source.questions.length} preguntas de ${SOURCE_SLUG} → ${BADGE_SLUG}`
    );
  }

  console.log(
    `Listo: "${template.title}" (${template.id}) — badge ${javaTerm.label} · nivel ${BADGE_LEVEL}, examen de ${template.totalQuestions} preguntas sorteadas de un pool de ${source.questions.length}.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
