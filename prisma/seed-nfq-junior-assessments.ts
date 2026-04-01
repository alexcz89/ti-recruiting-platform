// prisma/seed-nfq-junior-assessments.ts

import { PrismaClient } from "@prisma/client"
import { nfqJuniorAssessments } from "./seeds/nfq-junior-assessments"

const prisma = new PrismaClient()

async function upsertTemplate(template: (typeof nfqJuniorAssessments)[number]) {
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
      isGlobal: template.isGlobal,
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
      isGlobal: template.isGlobal,
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
  for (const template of nfqJuniorAssessments) {
    const savedTemplate = await upsertTemplate(template)
    await replaceQuestions(savedTemplate.id, template)
    console.log(`Seeded template: ${savedTemplate.title} (${savedTemplate.slug})`)
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