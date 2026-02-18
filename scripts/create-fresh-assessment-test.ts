// scripts/create-fresh-assessment-test.ts
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🎯 Creando nuevo assessment test para Armando Mendez...\n');

  // 1. Buscar el candidato (usuario con rol CANDIDATE)
  const candidate = await prisma.user.findFirst({
    where: {
      email: { contains: 'amendez', mode: 'insensitive' },
      role: 'CANDIDATE'
    },
    select: { id: true, email: true, name: true }
  });

  if (!candidate) {
    console.error('❌ No se encontró el candidato Armando Mendez');
    process.exit(1);
  }

  console.log(`✅ Candidato: ${candidate.name} (${candidate.email})`);

  // 2. Buscar la compañía IT Test Solutions
  const company = await prisma.company.findFirst({
    where: {
      name: { contains: 'IT Test Solutions', mode: 'insensitive' }
    },
    select: { id: true, name: true }
  });

  if (!company) {
    console.error('❌ No se encontró la compañía IT Test Solutions');
    process.exit(1);
  }

  console.log(`✅ Company: ${company.name}\n`);

  // 3. Crear un nuevo template de assessment
  console.log('📝 Creando nuevo template de assessment...');

  const slug = `fizzbuzz-test-${Date.now()}`;
  
  const template = await prisma.assessmentTemplate.create({
    data: {
      title: 'FizzBuzz Challenge - Fresh',
      slug,
      description: 'Prueba de programación FizzBuzz',
      type: 'CODING',
      difficulty: 'MID', // Cambiado de EASY a MID
      timeLimit: 30,
      passingScore: 70,
      totalQuestions: 1,
      isActive: true,
      allowRetry: true,
      maxAttempts: 3,
      sections: ['Coding'], // Campo requerido
    }
  });

  console.log(`✅ Template creado: ${template.id}`);

  // 4. Crear la pregunta de coding con test cases
  console.log('📝 Creando pregunta de coding...');

  const question = await prisma.assessmentQuestion.create({
    data: {
      templateId: template.id,
      type: 'CODING',
      questionText: `Implementa la función fizzBuzz(n) que retorne un array donde:
- Para números divisibles por 3: "Fizz"
- Para números divisibles por 5: "Buzz"  
- Para números divisibles por 3 y 5: "FizzBuzz"
- Para otros números: el número como string

Ejemplo: fizzBuzz(15) debe retornar:
["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]`,
      difficulty: 'MID', // Cambiado de EASY a MID
      section: 'Coding',
      language: 'javascript',
      allowedLanguages: JSON.stringify(['javascript', 'python', 'typescript']),
      starterCode: `function fizzBuzz(n) {
  // Tu código aquí
  const result = [];
  
  return result;
}

// No modifiques esta línea
const n = parseInt(require('fs').readFileSync(0, 'utf-8').trim());
console.log(JSON.stringify(fizzBuzz(n)));`,
      options: [], // Campo requerido (vacío para preguntas de coding)
      isActive: true,
    }
  });

  console.log(`✅ Pregunta creada: ${question.id}`);

  // 5. Crear test cases
  console.log('📝 Creando test cases...');

  const testCases = [
    // Públicos
    { input: '3', expected: '["1","2","Fizz"]', hidden: false },
    { input: '5', expected: '["1","2","Fizz","4","Buzz"]', hidden: false },
    // Privados
    { input: '15', expected: '["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]', hidden: true },
    { input: '1', expected: '["1"]', hidden: true },
    { input: '30', expected: '["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz","16","17","Fizz","19","Buzz","Fizz","22","23","Fizz","Buzz","26","Fizz","28","29","FizzBuzz"]', hidden: true },
  ];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    await prisma.codeTestCase.create({
      data: {
        questionId: question.id,
        input: tc.input,
        expectedOutput: tc.expected,
        isHidden: tc.hidden,
        orderIndex: i,
      }
    });
  }

  console.log(`✅ ${testCases.length} test cases creados (2 públicos, 3 privados)`);

  // 6. Crear un nuevo job
  console.log('📝 Creando job...');

  const job = await prisma.job.create({
    data: {
      title: 'Software Engineer - FizzBuzz Test',
      description: 'Posición para desarrollador con prueba de programación',
      status: 'OPEN', // Cambiado a OPEN
      companyId: company.id,
      location: 'Remote',
      employmentType: 'FULL_TIME', // Campo requerido
    }
  });

  console.log(`✅ Job creado: ${job.title}`);

  // 7. Asignar assessment al job
  await prisma.jobAssessment.create({
    data: {
      jobId: job.id,
      templateId: template.id,
      isRequired: true,
      minScore: 70,
    }
  });

  console.log(`✅ Assessment asignado al job`);

  // 8. Crear application
  const application = await prisma.application.create({
    data: {
      jobId: job.id,
      candidateId: candidate.id,
    }
  });

  console.log(`✅ Application creada`);

  // 9. Crear invite
  const token = crypto.randomBytes(32).toString('hex');
  
  const invite = await prisma.assessmentInvite.create({
    data: {
      applicationId: application.id,
      jobId: job.id,
      candidateId: candidate.id,
      templateId: template.id,
      token,
      status: 'SENT',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
    }
  });

  console.log(`✅ Invite creado\n`);

  // Resumen
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 ¡Assessment test creado exitosamente!\n');
  console.log('📊 RESUMEN:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📝 Template: ${template.title}`);
  console.log(`   ID: ${template.id}`);
  console.log(`   Tiempo: ${template.timeLimit} minutos`);
  console.log(`   Puntaje mínimo: ${template.passingScore}%\n`);
  console.log(`💻 Pregunta: FizzBuzz Challenge`);
  console.log(`   Test cases públicos: 2`);
  console.log(`   Test cases privados: 3`);
  console.log(`   Puntos totales: 10\n`);
  console.log(`👤 Candidato: ${candidate.name}`);
  console.log(`   Email: ${candidate.email}\n`);
  console.log(`💼 Job: ${job.title}`);
  console.log(`   Company: ${company.name}\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔗 URL PARA PROBAR:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`http://localhost:3000/assessments/${template.id}?token=${token}\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ PASOS PARA PROBAR:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('1. Reinicia el servidor Next.js (Ctrl+C y npm run dev)');
  console.log('2. Abre la URL en tu navegador');
  console.log('3. Verás el CodeEditor con los test cases públicos');
  console.log('4. Pega la solución del FizzBuzz');
  console.log('5. Click "Ejecutar Tests" → Verás 2 tests públicos');
  console.log('6. Click "Enviar Solución" → Ejecutará los 5 tests\n');
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
}

const n = parseInt(require('fs').readFileSync(0, 'utf-8').trim());
console.log(JSON.stringify(fizzBuzz(n)));`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });