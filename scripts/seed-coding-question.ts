// scripts/seed-coding-question.ts
/**
 * Script para crear una pregunta de CODING de prueba
 * 
 * Ejecutar con: npx tsx scripts/seed-coding-question.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Creando pregunta de CODING de prueba...');

  // 1. Buscar un template existente (o crear uno nuevo)
  let template = await prisma.assessmentTemplate.findFirst({
    where: { type: 'MIXED' },
  });

  if (!template) {
    console.log('📝 No hay templates MIXED, creando uno...');
    template = await prisma.assessmentTemplate.create({
      data: {
        title: 'Evaluación Full-Stack (con Coding)',
        slug: 'fullstack-coding-test',
        description: 'Evaluación que incluye preguntas de opción múltiple y coding challenges',
        type: 'MIXED',
        difficulty: 'MID',
        totalQuestions: 5,
        passingScore: 70,
        timeLimit: 60, // 60 minutos
        sections: [
          { name: 'JavaScript', questions: 2, weight: 40 },
          { name: 'Coding', questions: 1, weight: 60 },
        ],
        allowRetry: false,
        maxAttempts: 1,
        shuffleQuestions: false,
        penalizeWrong: false,
        isActive: true,
      },
    });
    console.log(`✅ Template creado: ${template.id}`);
  } else {
    console.log(`✅ Usando template existente: ${template.id} - ${template.title}`);
  }

  // 2. Crear pregunta de CODING
  const codingQuestion = await prisma.assessmentQuestion.create({
    data: {
      templateId: template.id,
      section: 'Coding',
      difficulty: 'JUNIOR',
      tags: ['javascript', 'functions', 'strings'],
      
      // 🆕 Campos específicos de CODING
      type: 'CODING',
      language: 'javascript',
      allowedLanguages: JSON.stringify(['javascript', 'python']),
      
      questionText: `# Invertir una Cadena

Implementa una función que tome un string como entrada y retorne el string invertido.

## Ejemplos:

- Input: "hello" → Output: "olleh"
- Input: "world" → Output: "dlrow"
- Input: "a" → Output: "a"
- Input: "" → Output: ""

## Restricciones:

- No uses métodos built-in como \`.reverse()\`
- La solución debe funcionar para strings vacíos
- Considera mayúsculas y minúsculas`,

      starterCode: `function reverseString(input) {
  // Tu código aquí
  
  return result;
}

// No modifiques esta línea
console.log(reverseString(require('fs').readFileSync(0, 'utf-8').trim()));`,

      solutionCode: `function reverseString(input) {
  let result = '';
  for (let i = input.length - 1; i >= 0; i--) {
    result += input[i];
  }
  return result;
}

console.log(reverseString(require('fs').readFileSync(0, 'utf-8').trim()));`,

      // Campos requeridos por el schema
      options: [],
      allowMultiple: false,
      isActive: true,
      timesUsed: 0,
    },
  });

  console.log(`✅ Pregunta CODING creada: ${codingQuestion.id}`);

  // 3. Crear test cases
  const testCases = [
    // Tests públicos (el candidato los ve)
    {
      input: 'hello',
      expectedOutput: 'olleh',
      isHidden: false,
      points: 2,
      orderIndex: 0,
    },
    {
      input: 'world',
      expectedOutput: 'dlrow',
      isHidden: false,
      points: 2,
      orderIndex: 1,
    },
    // Tests privados (ocultos para el candidato)
    {
      input: '',
      expectedOutput: '',
      isHidden: true,
      points: 2,
      orderIndex: 2,
    },
    {
      input: 'a',
      expectedOutput: 'a',
      isHidden: true,
      points: 2,
      orderIndex: 3,
    },
    {
      input: 'JavaScript',
      expectedOutput: 'tpircSavaJ',
      isHidden: true,
      points: 2,
      orderIndex: 4,
    },
  ];

  for (const tc of testCases) {
    await prisma.codeTestCase.create({
      data: {
        questionId: codingQuestion.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden,
        points: tc.points,
        orderIndex: tc.orderIndex,
        timeoutMs: 5000,
        memoryLimitMb: 256,
      },
    });
  }

  console.log(`✅ ${testCases.length} test cases creados (2 públicos, 3 privados)`);

  // 4. Mostrar resumen
  console.log('\n🎉 ¡Listo! Pregunta de CODING creada exitosamente\n');
  console.log('📊 Resumen:');
  console.log(`   Template ID: ${template.id}`);
  console.log(`   Template: ${template.title}`);
  console.log(`   Question ID: ${codingQuestion.id}`);
  console.log(`   Tipo: CODING`);
  console.log(`   Lenguajes: JavaScript, Python`);
  console.log(`   Tests: ${testCases.length} (2 públicos, 3 privados)`);
  console.log(`   Puntos totales: ${testCases.reduce((sum, tc) => sum + tc.points, 0)}`);
  console.log('\n🔗 Para probar:');
  console.log(`   1. Ve a: http://localhost:3000/assessments/${template.id}`);
  console.log(`   2. Inicia el assessment`);
  console.log(`   3. Deberías ver el CodeEditor con Monaco`);
  console.log(`   4. Prueba ejecutar el código con los tests públicos`);
  console.log(`   5. Envía la solución para ver todos los tests (incluyendo privados)`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });