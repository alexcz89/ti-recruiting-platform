// scripts/full-test-coding-system.ts
/**
 * Test completo del sistema de Coding Assessments
 * 
 * Este script:
 * 1. Limpia datos anteriores
 * 2. Crea un nuevo template
 * 3. Crea una pregunta de coding más desafiante
 * 4. Crea job + application + invite
 * 5. Te da la URL para probar
 * 
 * Ejecutar: npx tsx scripts/full-test-coding-system.ts
 */

import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Test Completo: Sistema de Coding Assessments\n');

  // 1. Buscar candidato
  const candidate = await prisma.user.findUnique({
    where: { email: 'amendez@gmail.com' },
  });

  if (!candidate) {
    console.error('❌ Candidato no encontrado: amendez@gmail.com');
    process.exit(1);
  }

  console.log(`✅ Candidato: ${candidate.name} (${candidate.email})`);

  // 2. Buscar o crear company
  let company = await prisma.company.findFirst();
  
  if (!company) {
    console.log('📝 Creando company...');
    company = await prisma.company.create({
      data: {
        name: 'Tech Startup Inc',
      },
    });
  }

  console.log(`✅ Company: ${company.name}`);

  // 3. Crear nuevo template
  console.log('\n📝 Creando nuevo template...');
  
  const template = await prisma.assessmentTemplate.create({
    data: {
      title: 'JavaScript Developer Test',
      slug: `js-dev-test-${Date.now()}`,
      description: 'Evaluación práctica de JavaScript con coding challenges',
      type: 'MIXED',
      difficulty: 'MID',
      totalQuestions: 2,
      passingScore: 70,
      timeLimit: 45,
      sections: [
        { name: 'JavaScript Basics', questions: 1, weight: 40 },
        { name: 'Coding Challenge', questions: 1, weight: 60 },
      ],
      allowRetry: false,
      maxAttempts: 1,
      shuffleQuestions: false,
      penalizeWrong: false,
      isActive: true,
    },
  });

  console.log(`✅ Template creado: ${template.id}`);

  // 4. Crear pregunta CODING
  console.log('\n📝 Creando pregunta de coding...');
  
  const codingQuestion = await prisma.assessmentQuestion.create({
    data: {
      templateId: template.id,
      section: 'Coding Challenge',
      difficulty: 'MID',
      tags: ['javascript', 'arrays', 'algorithms'],
      
      type: 'CODING',
      language: 'javascript',
      allowedLanguages: JSON.stringify(['javascript', 'python', 'typescript']),
      
      questionText: `# FizzBuzz Mejorado

Implementa una función \`fizzBuzz(n)\` que retorne un array de strings con los números del 1 al n, pero:

- Para múltiplos de 3: retorna "Fizz"
- Para múltiplos de 5: retorna "Buzz"
- Para múltiplos de 3 y 5: retorna "FizzBuzz"
- Para otros números: retorna el número como string

## Ejemplo:

\`\`\`javascript
fizzBuzz(15) 
// Retorna: ["1", "2", "Fizz", "4", "Buzz", "Fizz", "7", "8", "Fizz", "Buzz", "11", "Fizz", "13", "14", "FizzBuzz"]
\`\`\`

## Restricciones:

- 1 ≤ n ≤ 100
- Debe retornar un array de strings
- Los números deben ser strings también`,

      starterCode: `function fizzBuzz(n) {
  // Tu código aquí
  const result = [];
  
  
  
  return result;
}

// No modifiques esta línea
const n = parseInt(require('fs').readFileSync(0, 'utf-8').trim());
console.log(JSON.stringify(fizzBuzz(n)));`,

      solutionCode: `function fizzBuzz(n) {
  const result = [];
  
  for (let i = 1; i <= n; i++) {
    if (i % 15 === 0) {
      result.push("FizzBuzz");
    } else if (i % 3 === 0) {
      result.push("Fizz");
    } else if (i % 5 === 0) {
      result.push("Buzz");
    } else {
      result.push(String(i));
    }
  }
  
  return result;
}

const n = parseInt(require('fs').readFileSync(0, 'utf-8').trim());
console.log(JSON.stringify(fizzBuzz(n)));`,

      options: [],
      allowMultiple: false,
      isActive: true,
      timesUsed: 0,
    },
  });

  console.log(`✅ Pregunta creada: ${codingQuestion.id}`);

  // 5. Crear test cases
  console.log('\n📝 Creando test cases...');
  
  const testCases = [
    // Públicos (el candidato los ve)
    {
      input: '3',
      expectedOutput: '["1","2","Fizz"]',
      isHidden: false,
      points: 2,
      orderIndex: 0,
    },
    {
      input: '5',
      expectedOutput: '["1","2","Fizz","4","Buzz"]',
      isHidden: false,
      points: 2,
      orderIndex: 1,
    },
    // Privados (ocultos)
    {
      input: '15',
      expectedOutput: '["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]',
      isHidden: true,
      points: 2,
      orderIndex: 2,
    },
    {
      input: '1',
      expectedOutput: '["1"]',
      isHidden: true,
      points: 2,
      orderIndex: 3,
    },
    {
      input: '30',
      expectedOutput: '["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz","16","17","Fizz","19","Buzz","Fizz","22","23","Fizz","Buzz","26","Fizz","28","29","FizzBuzz"]',
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

  // 6. Crear Job
  console.log('\n📝 Creando job...');
  
  const job = await prisma.job.create({
    data: {
      title: 'JavaScript Developer',
      companyId: company.id,
      location: 'Remote',
      employmentType: 'FULL_TIME',
      description: 'Looking for a skilled JavaScript developer',
      status: 'OPEN',
    },
  });

  console.log(`✅ Job creado: ${job.title}`);

  // 7. Vincular assessment al job
  await prisma.jobAssessment.create({
    data: {
      jobId: job.id,
      templateId: template.id,
      isRequired: true,
      minScore: 70,
      triggerAt: 'AFTER_APPLY',
    },
  });

  console.log(`✅ Assessment vinculado al job`);

  // 8. Crear application
  const application = await prisma.application.create({
    data: {
      candidateId: candidate.id,
      jobId: job.id,
      status: 'REVIEWING',
    },
  });

  console.log(`✅ Application creada`);

  // 9. Crear invite
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invite = await prisma.assessmentInvite.create({
    data: {
      token,
      applicationId: application.id,
      jobId: job.id,
      candidateId: candidate.id,
      templateId: template.id,
      status: 'SENT',
      expiresAt,
      sentAt: new Date(),
    },
  });

  console.log(`✅ Invite creado`);

  // 10. Mostrar resumen
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const assessmentUrl = `${baseUrl}/assessments/${template.id}?token=${token}`;

  console.log('\n🎉 ¡Test configurado exitosamente!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RESUMEN:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📝 Template: ${template.title}`);
  console.log(`   ID: ${template.id}`);
  console.log(`   Preguntas: ${template.totalQuestions}`);
  console.log(`   Tiempo: ${template.timeLimit} minutos`);
  console.log(`   Puntaje mínimo: ${template.passingScore}%\n`);
  
  console.log(`💻 Pregunta CODING: FizzBuzz Mejorado`);
  console.log(`   Lenguajes: JavaScript, Python, TypeScript`);
  console.log(`   Tests públicos: 2`);
  console.log(`   Tests privados: 3`);
  console.log(`   Puntos totales: 10\n`);
  
  console.log(`👤 Candidato: ${candidate.name}`);
  console.log(`   Email: ${candidate.email}\n`);
  
  console.log(`💼 Job: ${job.title}`);
  console.log(`   Company: ${company.name}\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔗 URL PARA PROBAR:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`${assessmentUrl}\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ PASOS PARA PROBAR:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('1. Abre la URL en tu navegador');
  console.log('2. Verás el CodeEditor de Monaco cargando');
  console.log('3. Escribe la solución del FizzBuzz');
  console.log('4. Click "Ejecutar Tests" → Verás 2 tests públicos');
  console.log('5. Click "Enviar Solución" → Ejecutará 5 tests (2+3)');
  console.log('6. Verás tu puntaje calculado automáticamente\n');
  
  console.log('💡 SOLUCIÓN CORRECTA:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`function fizzBuzz(n) {
  const result = [];
  for (let i = 1; i <= n; i++) {
    if (i % 15 === 0) result.push("FizzBuzz");
    else if (i % 3 === 0) result.push("Fizz");
    else if (i % 5 === 0) result.push("Buzz");
    else result.push(String(i));
  }
  return result;
}\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });