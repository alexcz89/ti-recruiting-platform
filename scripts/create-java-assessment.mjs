import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const JOB_ID = 'cmoucus1n0002z6gw92kiyelm';

// Each question: text + options array + index of correct option
const QUESTIONS = [
  {
    text: '¿Cuál de estos NO es un tipo primitivo en Java?',
    options: ['int', 'boolean', 'String', 'char'],
    correctIndex: 2,
    explanation: 'String es una clase, no un tipo primitivo.',
  },
  {
    text: '¿Qué modificador permite acceso solo dentro de la misma clase?',
    options: ['public', 'protected', 'private', 'default'],
    correctIndex: 2,
    explanation: 'private restringe el acceso únicamente a la propia clase.',
  },
  {
    text: 'En Java, ¿de cuántas clases puede heredar una clase?',
    options: ['Una sola', 'Dos', 'Ilimitadas', 'Ninguna'],
    correctIndex: 0,
    explanation: 'Java solo soporta herencia simple de clases.',
  },
  {
    text: '¿Cuál es la principal ventaja de ArrayList sobre un array?',
    options: ['Es más rápido', 'Tamaño dinámico', 'Solo acepta String', 'No permite null'],
    correctIndex: 1,
    explanation: 'ArrayList puede crecer o reducirse dinámicamente.',
  },
  {
    text: '¿Cuál es la complejidad temporal de ArrayList.get(i)?',
    options: ['O(1)', 'O(n)', 'O(log n)', 'O(n²)'],
    correctIndex: 0,
    explanation: 'Acceso por índice en array interno es tiempo constante.',
  },
  {
    text: '¿Cuál puede tener campos de estado (instancia) en Java?',
    options: ['Interface', 'Clase abstracta', 'Ambas', 'Ninguna'],
    correctIndex: 1,
    explanation: 'Las interfaces solo pueden tener constantes (static final).',
  },
  {
    text: '¿Cuál es una checked exception en Java?',
    options: ['NullPointerException', 'IOException', 'ArrayIndexOutOfBoundsException', 'ClassCastException'],
    correctIndex: 1,
    explanation: 'IOException debe declararse o capturarse obligatoriamente.',
  },
  {
    text: '¿Qué retorna: int x = (5 > 3) ? 10 : 20;?',
    options: ['10', '20', 'true', 'Error de compilación'],
    correctIndex: 0,
    explanation: '5 > 3 es true, por lo que retorna 10.',
  },
  {
    text: '¿Los objetos String en Java son?',
    options: ['Mutables', 'Inmutables', 'Depende del JDK', 'Solo mutables con new'],
    correctIndex: 1,
    explanation: 'String es inmutable; cada modificación crea un nuevo objeto.',
  },
  {
    text: '¿Qué compara String.equals() en Java?',
    options: ['Referencia de memoria', 'Contenido del string', 'Hash del objeto', 'Longitud'],
    correctIndex: 1,
    explanation: 'equals() compara el contenido carácter por carácter.',
  },
  {
    text: '¿Qué hace final en una variable local?',
    options: ['La hace estática', 'No puede reasignarse', 'La elimina al salir del método', 'La hace pública'],
    correctIndex: 1,
    explanation: 'final impide reasignar la variable una vez asignada.',
  },
  {
    text: '¿Cuál es la complejidad promedio de HashMap.get(key)?',
    options: ['O(1)', 'O(n)', 'O(log n)', 'O(n²)'],
    correctIndex: 0,
    explanation: 'HashMap usa hashing; el acceso promedio es O(1).',
  },
  {
    text: '¿Para qué sirve el for-each en Java?',
    options: ['Solo para arrays', 'Iterar sobre Iterable y arrays', 'Reemplaza while', 'Solo para listas'],
    correctIndex: 1,
    explanation: 'for-each funciona con cualquier clase que implemente Iterable y con arrays.',
  },
  {
    text: 'Method overloading significa:',
    options: ['Mismo nombre, diferente firma', 'Heredar método del padre', 'Reescribir método del padre', 'Llamar super()'],
    correctIndex: 0,
    explanation: 'Overloading = mismo nombre con diferentes parámetros.',
  },
  {
    text: 'Un método static en Java puede:',
    options: ['Acceder a this', 'Acceder a campos de instancia', 'Llamarse sin instanciar la clase', 'Ser abstracto'],
    correctIndex: 2,
    explanation: 'Los métodos static pertenecen a la clase, no a instancias.',
  },
  {
    text: 'Si no defines ningún constructor, ¿qué agrega el compilador?',
    options: ['Un constructor privado', 'Un constructor sin argumentos', 'Nada', 'Un constructor estático'],
    correctIndex: 1,
    explanation: 'Java agrega un constructor por defecto solo si no defines ninguno.',
  },
  {
    text: '¿Qué tipo de retorno tiene un constructor en Java?',
    options: ['void', 'El tipo de la clase', 'Ninguno', 'Object'],
    correctIndex: 2,
    explanation: 'Los constructores no tienen tipo de retorno declarado.',
  },
  {
    text: 'Method overriding es un ejemplo de:',
    options: ['Polimorfismo en tiempo de compilación', 'Polimorfismo en tiempo de ejecución', 'Encapsulamiento', 'Abstracción'],
    correctIndex: 1,
    explanation: 'Override se resuelve en runtime según el tipo real del objeto.',
  },
  {
    text: '¿Cuándo ocurre NullPointerException?',
    options: ['Al dividir entre cero', 'Al acceder a un miembro de null', 'Al desbordar un array', 'Al castear tipos incompatibles'],
    correctIndex: 1,
    explanation: 'NPE ocurre cuando se intenta usar una referencia que vale null.',
  },
  {
    text: '¿Quién gestiona la memoria de objetos en Java?',
    options: ['El programador con free()', 'El Garbage Collector de la JVM', 'El sistema operativo', 'El compilador'],
    correctIndex: 1,
    explanation: 'Java tiene GC automático; el programador no libera memoria manualmente.',
  },
];

function buildOptions(options, correctIndex) {
  return options.map((text, i) => ({
    id: String(i),
    text,
    isCorrect: i === correctIndex,
  }));
}

async function main() {
  // Clean up any orphaned templates from failed previous runs
  const orphaned = await prisma.assessmentTemplate.findMany({
    where: { slug: { startsWith: 'eval-java-junior-' } },
    select: { id: true, slug: true },
  });
  if (orphaned.length > 0) {
    console.log(`🧹 Limpiando ${orphaned.length} template(s) huérfanos...`);
    for (const t of orphaned) {
      await prisma.assessmentTemplate.delete({ where: { id: t.id } });
      console.log(`   Eliminado: ${t.slug}`);
    }
  }

  const sections = [{ id: 'main', title: 'Fundamentos Java', description: '', questionIds: [] }];

  const template = await prisma.assessmentTemplate.create({
    data: {
      title: 'Evaluación Java Junior',
      slug: 'eval-java-junior-' + Date.now(),
      description: 'Examen de 20 preguntas de opción múltiple sobre fundamentos de Java para nivel Junior.',
      type: 'MCQ',
      difficulty: 'JUNIOR',
      timeLimit: 30,
      passingScore: 70,
      totalQuestions: 20,
      isGlobal: false,
      sections,
    },
  });
  console.log('✅ Template creado:', template.id);

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    await prisma.assessmentQuestion.create({
      data: {
        templateId: template.id,
        type: 'MULTIPLE_CHOICE',
        section: 'main',
        difficulty: 'JUNIOR',
        tags: [],
        questionText: q.text,
        options: buildOptions(q.options, q.correctIndex),
        explanation: q.explanation,
      },
    });
    process.stdout.write(`  Pregunta ${i + 1}/20 creada\n`);
  }

  const ja = await prisma.jobAssessment.create({
    data: {
      jobId: JOB_ID,
      templateId: template.id,
      isRequired: true,
      minScore: 70,
    },
  });

  console.log('\n✅ Asignado a vacante "Desarrollador Java APX (Nivel Junior / Entry)"');
  console.log('JobAssessment ID:', ja.id);
  console.log('Template ID:', template.id);
  console.log('\n🔗 Ver examen en: /assessments/' + template.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e.message); prisma.$disconnect(); process.exit(1); });
