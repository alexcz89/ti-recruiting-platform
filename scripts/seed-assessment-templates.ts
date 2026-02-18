// scripts/seed-assessment-templates.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding assessment templates...\n');

  // Obtener el primer recruiter/admin de la BD
  const recruiter = await prisma.user.findFirst({
    where: {
      OR: [
        { role: 'RECRUITER' },
        { role: 'ADMIN' }
      ]
    },
    select: { id: true, email: true, role: true }
  });

  if (!recruiter) {
    console.error('❌ No se encontró ningún recruiter o admin en la BD');
    console.log('💡 Crea un usuario con rol RECRUITER o ADMIN primero');
    process.exit(1);
  }

  console.log(`✅ Usando usuario: ${recruiter.email} (${recruiter.role})\n`);

  // 1. Frontend Assessment
  const frontend = await prisma.assessmentTemplate.upsert({
    where: { id: 'frontend-react-2024' },
    update: {},
    create: {
      id: 'frontend-react-2024',
      title: 'Frontend Developer - React',
      description: 'Evaluación de conocimientos en React, TypeScript y desarrollo frontend moderno',
      type: 'MIXED',
      difficulty: 'MID',
      timeLimit: 60,
      passingScore: 70,
      totalQuestions: 15,
      isActive: true,
      createdById: recruiter.id,
      questions: {
        create: [
          {
            text: '¿Cuál es la diferencia entre `useMemo` y `useCallback`?',
            type: 'MULTIPLE_CHOICE',
            points: 5,
            orderIndex: 0,
            options: JSON.stringify([
              'useMemo cachea valores, useCallback cachea funciones',
              'useMemo es para componentes, useCallback es para hooks',
              'No hay diferencia, son alias',
              'useMemo es async, useCallback es sync'
            ]),
            correctAnswer: '0',
          },
          {
            text: '¿Qué es el Virtual DOM en React?',
            type: 'MULTIPLE_CHOICE',
            points: 5,
            orderIndex: 1,
            options: JSON.stringify([
              'Una representación en memoria del DOM real',
              'Un servidor virtual para desarrollo',
              'Una librería de testing',
              'Un componente de React'
            ]),
            correctAnswer: '0',
          },
          {
            text: 'Explica qué son los Custom Hooks y cuándo usarlos',
            type: 'OPEN_ENDED',
            points: 10,
            orderIndex: 2,
          },
        ]
      }
    }
  });

  console.log(`✅ Creado: ${frontend.title}`);

  // 2. Backend Assessment
  const backend = await prisma.assessmentTemplate.upsert({
    where: { id: 'backend-nodejs-2024' },
    update: {},
    create: {
      id: 'backend-nodejs-2024',
      title: 'Backend Developer - Node.js',
      description: 'Evaluación de conocimientos en Node.js, APIs REST y bases de datos',
      type: 'MIXED',
      difficulty: 'MID',
      timeLimit: 60,
      passingScore: 70,
      totalQuestions: 12,
      isActive: true,
      createdById: recruiter.id,
      questions: {
        create: [
          {
            text: '¿Qué es el Event Loop en Node.js?',
            type: 'MULTIPLE_CHOICE',
            points: 5,
            orderIndex: 0,
            options: JSON.stringify([
              'Un mecanismo que gestiona operaciones asíncronas',
              'Un bucle infinito que bloquea el proceso',
              'Una función de Express.js',
              'Un patrón de diseño'
            ]),
            correctAnswer: '0',
          },
          {
            text: 'Explica la diferencia entre SQL y NoSQL',
            type: 'OPEN_ENDED',
            points: 10,
            orderIndex: 1,
          },
        ]
      }
    }
  });

  console.log(`✅ Creado: ${backend.title}`);

  // 3. FullStack Assessment
  const fullstack = await prisma.assessmentTemplate.upsert({
    where: { id: 'fullstack-complete-2024' },
    update: {},
    create: {
      id: 'fullstack-complete-2024',
      title: 'FullStack Developer - Complete',
      description: 'Evaluación completa de frontend, backend y arquitectura',
      type: 'MIXED',
      difficulty: 'HARD',
      timeLimit: 90,
      passingScore: 75,
      totalQuestions: 20,
      isActive: true,
      createdById: recruiter.id,
      questions: {
        create: [
          {
            text: '¿Qué es REST?',
            type: 'MULTIPLE_CHOICE',
            points: 5,
            orderIndex: 0,
            options: JSON.stringify([
              'Un estilo arquitectónico para APIs',
              'Un framework de Node.js',
              'Una base de datos',
              'Un protocolo de red'
            ]),
            correctAnswer: '0',
          },
          {
            text: 'Diseña la arquitectura de un sistema de autenticación con JWT',
            type: 'OPEN_ENDED',
            points: 15,
            orderIndex: 1,
          },
        ]
      }
    }
  });

  console.log(`✅ Creado: ${fullstack.title}`);

  // 4. Coding Assessment (FizzBuzz ya existe, crear otro)
  const codingAlgo = await prisma.assessmentTemplate.upsert({
    where: { id: 'coding-algorithms-2024' },
    update: {},
    create: {
      id: 'coding-algorithms-2024',
      title: 'Algoritmos y Estructuras de Datos',
      description: 'Evaluación práctica de algoritmos y resolución de problemas',
      type: 'CODING',
      difficulty: 'HARD',
      timeLimit: 75,
      passingScore: 80,
      totalQuestions: 3,
      isActive: true,
      createdById: recruiter.id,
      questions: {
        create: [
          {
            text: `Implementa una función que encuentre el elemento más frecuente en un array.

Ejemplo:
Input: [1, 3, 2, 1, 4, 1]
Output: 1

Input: ['a', 'b', 'a', 'c', 'a', 'b']
Output: 'a'`,
            type: 'CODING',
            points: 30,
            orderIndex: 0,
            language: 'javascript',
            allowedLanguages: JSON.stringify(['javascript', 'python', 'typescript']),
            starterCode: `function findMostFrequent(arr) {
  // Tu código aquí
  
  return result;
}

const input = require('fs').readFileSync(0, 'utf-8').trim();
const arr = JSON.parse(input);
console.log(JSON.stringify(findMostFrequent(arr)));`,
            testCases: {
              create: [
                {
                  input: '[1, 3, 2, 1, 4, 1]',
                  expectedOutput: '1',
                  isHidden: false,
                  points: 10,
                  orderIndex: 0,
                },
                {
                  input: '["a", "b", "a", "c", "a", "b"]',
                  expectedOutput: '"a"',
                  isHidden: false,
                  points: 10,
                },
                {
                  input: '[5, 5, 5, 1, 1, 2]',
                  expectedOutput: '5',
                  isHidden: true,
                  points: 10,
                },
              ]
            }
          }
        ]
      }
    }
  });

  console.log(`✅ Creado: ${codingAlgo.title}`);

  // 5. Entry Level Assessment
  const entryLevel = await prisma.assessmentTemplate.upsert({
    where: { id: 'entry-level-junior-2024' },
    update: {},
    create: {
      id: 'entry-level-junior-2024',
      title: 'Junior Developer - Fundamentos',
      description: 'Evaluación de conceptos básicos de programación',
      type: 'MULTIPLE_CHOICE',
      difficulty: 'EASY',
      timeLimit: 30,
      passingScore: 60,
      totalQuestions: 10,
      isActive: true,
      createdById: recruiter.id,
      questions: {
        create: [
          {
            text: '¿Qué es una variable?',
            type: 'MULTIPLE_CHOICE',
            points: 5,
            orderIndex: 0,
            options: JSON.stringify([
              'Un espacio en memoria para almacenar datos',
              'Una función especial',
              'Un tipo de archivo',
              'Un comando de terminal'
            ]),
            correctAnswer: '0',
          },
          {
            text: '¿Qué es Git?',
            type: 'MULTIPLE_CHOICE',
            points: 5,
            orderIndex: 1,
            options: JSON.stringify([
              'Un sistema de control de versiones',
              'Un lenguaje de programación',
              'Una base de datos',
              'Un editor de código'
            ]),
            correctAnswer: '0',
          },
        ]
      }
    }
  });

  console.log(`✅ Creado: ${entryLevel.title}`);

  console.log('\n🎉 ¡Seeding completado!\n');
  console.log('📊 Assessments creados:');
  console.log('  1. Frontend Developer - React (60 min, MID)');
  console.log('  2. Backend Developer - Node.js (60 min, MID)');
  console.log('  3. FullStack Developer - Complete (90 min, HARD)');
  console.log('  4. Algoritmos y Estructuras de Datos (75 min, HARD)');
  console.log('  5. Junior Developer - Fundamentos (30 min, EASY)');
  console.log('\n💡 Ahora puedes asignarlos a tus jobs desde /dashboard/assessments\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });