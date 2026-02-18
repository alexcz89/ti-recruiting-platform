// scripts/check-coding-question.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando estructura de preguntas de coding...\n');

  // Buscar el template de JavaScript Developer Test
  const template = await prisma.assessmentTemplate.findFirst({
    where: {
      title: { contains: 'JavaScript Developer', mode: 'insensitive' }
    },
    include: {
      questions: {
        include: {
          testCases: true
        }
      },
      codingChallenges: true
    }
  });

  if (!template) {
    console.error('❌ No se encontró el template');
    return;
  }

  console.log(`✅ Template: ${template.title} (${template.id})\n`);

  console.log('📝 Questions:', template.questions.length);
  for (const q of template.questions) {
    const questionText = q.questionText || 'Sin título';
    console.log(`  - ${questionText.substring(0, 50)}... (${q.type})`);
    if (q.type === 'CODING') {
      console.log(`    Test cases: ${q.testCases?.length || 0}`);
      for (const tc of q.testCases || []) {
        console.log(`      ${tc.isHidden ? '🔒' : '👁️ '} ${tc.input} → ${tc.expectedOutput}`);
      }
    }
  }

  console.log('\n💻 Coding Challenges:', template.codingChallenges.length);
  for (const cc of template.codingChallenges) {
    console.log(`  - ${cc.title}`);
    
    // Buscar test cases manualmente
    const testCases = await prisma.codeTestCase.findMany({
      where: { questionId: cc.id }
    });
    
    console.log(`    Test cases: ${testCases.length}`);
    for (const tc of testCases) {
      console.log(`      ${tc.isHidden ? '🔒' : '👁️ '} ${tc.input} → ${tc.expectedOutput}`);
    }
  }

// Ver si hay test cases "huérfanos" (sin pregunta asociada)
const orphanTestCases = await prisma.codeTestCase.findMany({
  where: {
    questionId: ''  // String vacío en lugar de null
  }
});

  if (orphanTestCases.length > 0) {
    console.log(`\n⚠️  Test cases huérfanos (sin pregunta): ${orphanTestCases.length}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });