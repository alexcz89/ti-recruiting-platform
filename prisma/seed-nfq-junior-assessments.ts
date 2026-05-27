// prisma/seed-nfq-junior-assessments.ts

import { PrismaClient } from "@prisma/client"
import { nfqJuniorAssessments } from "./seeds/nfq-junior-assessments"

const prisma = new PrismaClient()

async function upsertTemplate(
  template: (typeof nfqJuniorAssessments)[number],
  companyId: string | null,
) {
  // Templates no-globales se asignan a la empresa del recruiter que corre el seed
  const ownership = template.isGlobal
    ? { isGlobal: true, companyId: null }
    : { isGlobal: false, companyId }

  return prisma.assessmentTemplate.upsert({
    where: { slug: template.slug },
    update: {
      title: template.title,
      description: template.description,
      type: template.type as any,
      difficulty: template.difficulty as any,
      totalQuestions: template.questions.length,
      passingScore: template.passingScore,
      timeLimit: template.timeLimit,
      sections: template.sections as any,
      allowRetry: template.allowRetry,
      maxAttempts: template.maxAttempts,
      shuffleQuestions: template.shuffleQuestions,
      penalizeWrong: template.penalizeWrong,
      isActive: template.isActive,
      language: template.language,
      ...ownership,
    },
    create: {
      title: template.title,
      slug: template.slug,
      description: template.description,
      type: template.type as any,
      difficulty: template.difficulty as any,
      totalQuestions: template.questions.length,
      passingScore: template.passingScore,
      timeLimit: template.timeLimit,
      sections: template.sections as any,
      allowRetry: template.allowRetry,
      maxAttempts: template.maxAttempts,
      shuffleQuestions: template.shuffleQuestions,
      penalizeWrong: template.penalizeWrong,
      isActive: template.isActive,
      language: template.language,
      ...ownership,
    },
    select: { id: true, title: true, slug: true },
  })
}

async function replaceQuestions(
  templateId: string,
  template: (typeof nfqJuniorAssessments)[number],
) {
  await prisma.assessmentQuestion.deleteMany({
    where: { templateId },
  })

  for (const q of template.questions) {
    await prisma.assessmentQuestion.create({
    data: {
        templateId,
        section: q.section,
        difficulty: q.difficulty as any,
        tags: q.tags,
        questionText: q.questionText,
        codeSnippet: null,
        options: q.options as any,
        allowMultiple: q.allowMultiple,
        explanation: q.explanation ?? null,
        isActive: true,
        type: "MULTIPLE_CHOICE" as any,
        language: null,
        starterCode: null,
        solutionCode: null,
        allowedLanguages: null,
    },
    })
  }
}

async function main() {
  // Buscar la primera empresa disponible para asignar los templates no-globales
  const company = await prisma.company.findFirst({
    select: { id: true, name: true },
  })

  if (!company) {
    console.warn("⚠️  No se encontró ninguna empresa. Los templates no-globales quedarán sin companyId.")
  } else {
    console.log(`🏢 Usando empresa: ${company.name} (${company.id})`)
  }

  for (const template of nfqJuniorAssessments) {
    const savedTemplate = await upsertTemplate(template, company?.id ?? null)
    await replaceQuestions(savedTemplate.id, template)
    const scope = template.isGlobal ? "global" : `empresa: ${company?.name ?? "sin empresa"}`
    console.log(`✅ Seeded: ${savedTemplate.title} (${savedTemplate.slug}) [${scope}]`)
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error("Error seeding NFQ junior assessments:", error)
    await prisma.$disconnect()
    process.exit(1)
  })