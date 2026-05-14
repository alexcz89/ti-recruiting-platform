// scripts/create-java-coding-assessment.mjs
// Crea evaluación de CODING en Java para la vacante Desarrollador Java APX Junior
// Ejecutar: node scripts/create-java-coding-assessment.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const JOB_ID = "cmoucus1n0002z6gw92kiyelm"; // Desarrollador Java APX Junior

// ─────────────────────────────────────────────────────────────────────────────
// 5 preguntas de Coding Java — nivel Junior / Entry
// Cada pregunta: 5 test cases × 4 pts = 20 pts → total 100 pts
// ─────────────────────────────────────────────────────────────────────────────
const QUESTIONS = [
  // ── 1. Suma de Gauss ──────────────────────────────────────────────────────
  {
    orderIndex: 0,
    difficulty: "JUNIOR",
    tags: ["java", "math", "loops"],
    questionText: `# Suma de 1 a N

Dado un entero positivo **N**, calcula la suma de todos los enteros del 1 al N (inclusive).

## Entrada
Una sola línea con el entero \`N\` (1 ≤ N ≤ 10 000).

## Salida
Un entero: el resultado de \`1 + 2 + 3 + ... + N\`.

## Ejemplos

| Entrada | Salida |
|---------|--------|
| 5       | 15     |
| 10      | 55     |
| 100     | 5050   |

## Hint
Puedes resolverlo con un ciclo \`for\`, o con la fórmula de Gauss \`n*(n+1)/2\`.`,

    starterCode: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();

        // TODO: calcula la suma de 1 a n
        int suma = 0;

        System.out.println(suma);
    }
}`,

    solutionCode: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        System.out.println((long) n * (n + 1) / 2);
    }
}`,

    testCases: [
      { input: "5",    expectedOutput: "15",     isHidden: false, points: 4, orderIndex: 0 },
      { input: "10",   expectedOutput: "55",     isHidden: false, points: 4, orderIndex: 1 },
      { input: "1",    expectedOutput: "1",      isHidden: true,  points: 4, orderIndex: 2 },
      { input: "100",  expectedOutput: "5050",   isHidden: true,  points: 4, orderIndex: 3 },
      { input: "1000", expectedOutput: "500500", isHidden: true,  points: 4, orderIndex: 4 },
    ],
  },

  // ── 2. ¿Es palíndromo? ───────────────────────────────────────────────────
  {
    orderIndex: 1,
    difficulty: "JUNIOR",
    tags: ["java", "strings", "palindrome"],
    questionText: `# ¿Es Palíndromo?

Un palíndromo es una palabra que se lee igual de izquierda a derecha que de derecha a izquierda (ignorando mayúsculas).

Dado un string, imprime \`SI\` si es palíndromo, \`NO\` en caso contrario.

## Entrada
Una sola línea con el string (sin espacios, solo letras).

## Salida
\`SI\` o \`NO\`.

## Ejemplos

| Entrada  | Salida |
|----------|--------|
| racecar  | SI     |
| java     | NO     |
| Aba      | SI     |
| a        | SI     |

> La comparación debe ignorar mayúsculas/minúsculas.`,

    starterCode: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.next().toLowerCase();

        // TODO: verifica si s es palíndromo
        boolean esPalindromo = false;

        System.out.println(esPalindromo ? "SI" : "NO");
    }
}`,

    solutionCode: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.next().toLowerCase();
        String rev = new StringBuilder(s).reverse().toString();
        System.out.println(s.equals(rev) ? "SI" : "NO");
    }
}`,

    testCases: [
      { input: "racecar",  expectedOutput: "SI", isHidden: false, points: 4, orderIndex: 0 },
      { input: "java",     expectedOutput: "NO", isHidden: false, points: 4, orderIndex: 1 },
      { input: "Aba",      expectedOutput: "SI", isHidden: true,  points: 4, orderIndex: 2 },
      { input: "a",        expectedOutput: "SI", isHidden: true,  points: 4, orderIndex: 3 },
      { input: "kayak",    expectedOutput: "SI", isHidden: true,  points: 4, orderIndex: 4 },
    ],
  },

  // ── 3. Número de Fibonacci ────────────────────────────────────────────────
  {
    orderIndex: 2,
    difficulty: "JUNIOR",
    tags: ["java", "fibonacci", "recursion", "loops"],
    questionText: `# N-ésimo Número de Fibonacci

La secuencia de Fibonacci comienza: **0, 1, 1, 2, 3, 5, 8, 13, 21, 34, ...**

Cada número es la suma de los dos anteriores. Los índices comienzan en 0:
- F(0) = 0
- F(1) = 1
- F(n) = F(n-1) + F(n-2)

Dado **N**, imprime el N-ésimo número de Fibonacci.

## Entrada
Una sola línea con el entero \`N\` (0 ≤ N ≤ 40).

## Salida
Un entero: F(N).

## Ejemplos

| Entrada | Salida |
|---------|--------|
| 0       | 0      |
| 7       | 13     |
| 10      | 55     |`,

    starterCode: `import java.util.Scanner;

public class Main {

    // Puedes implementar fib de forma iterativa o recursiva
    static long fib(int n) {
        // TODO: implementa aquí
        return 0;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        System.out.println(fib(n));
    }
}`,

    solutionCode: `import java.util.Scanner;

public class Main {
    static long fib(int n) {
        if (n <= 1) return n;
        long a = 0, b = 1;
        for (int i = 2; i <= n; i++) {
            long c = a + b;
            a = b;
            b = c;
        }
        return b;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        System.out.println(fib(n));
    }
}`,

    testCases: [
      { input: "0",  expectedOutput: "0",       isHidden: false, points: 4, orderIndex: 0 },
      { input: "7",  expectedOutput: "13",      isHidden: false, points: 4, orderIndex: 1 },
      { input: "1",  expectedOutput: "1",       isHidden: true,  points: 4, orderIndex: 2 },
      { input: "10", expectedOutput: "55",      isHidden: true,  points: 4, orderIndex: 3 },
      { input: "20", expectedOutput: "6765",    isHidden: true,  points: 4, orderIndex: 4 },
    ],
  },

  // ── 4. Máximo de una lista ────────────────────────────────────────────────
  {
    orderIndex: 3,
    difficulty: "JUNIOR",
    tags: ["java", "arrays", "iteration"],
    questionText: `# Valor Máximo de una Lista

Dada una lista de enteros separados por espacios en una sola línea, encuentra e imprime el valor máximo.

## Entrada
Una sola línea con enteros separados por espacios (al menos 1 número).
Los valores pueden ser negativos.

## Salida
Un entero: el valor máximo de la lista.

## Ejemplos

| Entrada           | Salida |
|-------------------|--------|
| 3 7 2 9 1         | 9      |
| -5 -1 -3          | -1     |
| 42                | 42     |
| 0 0 0             | 0      |`,

    starterCode: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String[] tokens = sc.nextLine().trim().split("\\\\s+");

        // TODO: encuentra el valor máximo en el arreglo
        int max = Integer.MIN_VALUE;

        System.out.println(max);
    }
}`,

    solutionCode: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String[] tokens = sc.nextLine().trim().split("\\s+");
        int max = Integer.MIN_VALUE;
        for (String t : tokens) {
            int val = Integer.parseInt(t);
            if (val > max) max = val;
        }
        System.out.println(max);
    }
}`,

    testCases: [
      { input: "3 7 2 9 1",      expectedOutput: "9",  isHidden: false, points: 4, orderIndex: 0 },
      { input: "-5 -1 -3",       expectedOutput: "-1", isHidden: false, points: 4, orderIndex: 1 },
      { input: "42",             expectedOutput: "42", isHidden: true,  points: 4, orderIndex: 2 },
      { input: "0 0 0",          expectedOutput: "0",  isHidden: true,  points: 4, orderIndex: 3 },
      { input: "100 200 50 175", expectedOutput: "200",isHidden: true,  points: 4, orderIndex: 4 },
    ],
  },

  // ── 5. FizzBuzz unitario ──────────────────────────────────────────────────
  {
    orderIndex: 4,
    difficulty: "JUNIOR",
    tags: ["java", "conditionals", "fizzbuzz"],
    questionText: `# FizzBuzz Unitario

Dado un número entero positivo **N**, aplica las reglas de FizzBuzz para ese único número:

- Si N es divisible entre 3 y entre 5: imprime \`FizzBuzz\`
- Si N es divisible solo entre 3: imprime \`Fizz\`
- Si N es divisible solo entre 5: imprime \`Buzz\`
- En cualquier otro caso: imprime el número tal cual

## Entrada
Una sola línea con el entero \`N\` (1 ≤ N ≤ 10 000).

## Salida
Una sola línea: \`Fizz\`, \`Buzz\`, \`FizzBuzz\`, o el número.

## Ejemplos

| Entrada | Salida   |
|---------|----------|
| 3       | Fizz     |
| 5       | Buzz     |
| 15      | FizzBuzz |
| 7       | 7        |`,

    starterCode: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();

        // TODO: aplica las reglas de FizzBuzz para n

    }
}`,

    solutionCode: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        if (n % 15 == 0) System.out.println("FizzBuzz");
        else if (n % 3 == 0) System.out.println("Fizz");
        else if (n % 5 == 0) System.out.println("Buzz");
        else System.out.println(n);
    }
}`,

    testCases: [
      { input: "3",  expectedOutput: "Fizz",     isHidden: false, points: 4, orderIndex: 0 },
      { input: "15", expectedOutput: "FizzBuzz", isHidden: false, points: 4, orderIndex: 1 },
      { input: "5",  expectedOutput: "Buzz",     isHidden: true,  points: 4, orderIndex: 2 },
      { input: "7",  expectedOutput: "7",        isHidden: true,  points: 4, orderIndex: 3 },
      { input: "30", expectedOutput: "FizzBuzz", isHidden: true,  points: 4, orderIndex: 4 },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Creando evaluación de CODING Java...\n");

  // 1. Buscar compañía TaskIO
  const company = await prisma.company.findFirst({
    where: { name: { contains: "Task", mode: "insensitive" } },
    select: { id: true, name: true },
  });

  if (!company) {
    throw new Error("No se encontró la compañía TaskIO en la base de datos.");
  }
  console.log(`✅ Compañía: ${company.name} (${company.id})`);

  // 2. Verificar que la vacante existe
  const job = await prisma.job.findUnique({
    where: { id: JOB_ID },
    select: { id: true, title: true },
  });
  if (!job) throw new Error(`Vacante ${JOB_ID} no encontrada.`);
  console.log(`✅ Vacante: ${job.title}`);

  // 3. Limpiar template anterior de este script si existe
  const existingTemplate = await prisma.assessmentTemplate.findFirst({
    where: {
      slug: "java-coding-junior-apx",
      companyId: company.id,
    },
    select: { id: true },
  });
  if (existingTemplate) {
    console.log("🗑  Eliminando template anterior...");
    await prisma.assessmentTemplate.delete({ where: { id: existingTemplate.id } });
  }

  // 4. Crear el template de CODING
  const template = await prisma.assessmentTemplate.create({
    data: {
      title: "Java Coding Challenge — APX Junior",
      slug: "java-coding-junior-apx",
      description:
        "Evaluación de programación en Java para candidatos Junior/Entry. " +
        "5 problemas que evalúan lógica, manejo de cadenas, arreglos y estructuras de control.",
      type: "CODING",
      difficulty: "JUNIOR",
      totalQuestions: 5,
      passingScore: 60,        // 60% para aprobar
      timeLimit: 60,           // 60 minutos
      sections: [{ name: "Java Fundamentals", questions: 5, weight: 100 }],
      allowRetry: false,
      maxAttempts: 1,
      shuffleQuestions: false,  // orden fijo para evaluación justa
      penalizeWrong: false,
      isActive: true,
      isGlobal: false,          // ← NO es pública
      companyId: company.id,    // ← Solo para TaskIO
      language: "java",
    },
  });

  console.log(`\n✅ Template creado: ${template.id} — "${template.title}"`);
  console.log(`   isGlobal: ${template.isGlobal} (privada a ${company.name})`);

  // 5. Crear preguntas y test cases
  console.log("\n📝 Creando preguntas y test cases...\n");

  let totalTestCases = 0;

  for (const q of QUESTIONS) {
    const question = await prisma.assessmentQuestion.create({
      data: {
        templateId: template.id,
        section: "Java Fundamentals",
        difficulty: q.difficulty,
        tags: q.tags,
        type: "CODING",
        language: "java",
        allowedLanguages: JSON.stringify(["java"]),
        questionText: q.questionText,
        starterCode: q.starterCode,
        solutionCode: q.solutionCode,
        options: [],
        allowMultiple: false,
        isActive: true,
        timesUsed: 0,
      },
    });

    for (const tc of q.testCases) {
      await prisma.codeTestCase.create({
        data: {
          questionId: question.id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden,
          points: tc.points,
          orderIndex: tc.orderIndex,
          timeoutMs: 8000,     // 8s por test (Java arranca más lento que Node)
          memoryLimitMb: 256,
        },
      });
    }

    const pts = q.testCases.reduce((s, t) => s + t.points, 0);
    const pub = q.testCases.filter((t) => !t.isHidden).length;
    const hid = q.testCases.filter((t) => t.isHidden).length;
    console.log(
      `   ✓ Q${q.orderIndex + 1}: ${q.tags.slice(1).join(", ")}` +
        ` | ${pts} pts | ${pub} públicos + ${hid} ocultos`
    );
    totalTestCases += q.testCases.length;
  }

  // 6. Asignar a la vacante
  const jobAssessment = await prisma.jobAssessment.create({
    data: {
      jobId: JOB_ID,
      templateId: template.id,
    },
  });
  console.log(`\n✅ Asignada a vacante "${job.title}" (JobAssessment: ${jobAssessment.id})`);

  // 7. Resumen final
  const totalPoints = QUESTIONS.flatMap((q) => q.testCases).reduce(
    (s, t) => s + t.points,
    0
  );

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║          EVALUACIÓN JAVA CODING — CREADA CON ÉXITO          ║
╠══════════════════════════════════════════════════════════════╣
║  Template ID   : ${template.id.padEnd(42)}║
║  Título        : Java Coding Challenge — APX Junior          ║
║  Tipo          : CODING (Judge0 — Java 17, lang ID 62)       ║
║  Empresa       : ${company.name.padEnd(42)}║
║  Vacante       : ${job.title.slice(0, 42).padEnd(42)}║
║  Visibilidad   : PRIVADA (isGlobal = false)                  ║
╠══════════════════════════════════════════════════════════════╣
║  Preguntas     : 5                                           ║
║  Test cases    : ${String(totalTestCases).padEnd(42)}║
║  Puntos totales: ${String(totalPoints).padEnd(42)}║
║  Score mínimo  : 60%                                         ║
║  Tiempo límite : 60 minutos                                  ║
╠══════════════════════════════════════════════════════════════╣
║  Q1: Suma de 1 a N        (loops / math)                     ║
║  Q2: ¿Es palíndromo?      (strings)                          ║
║  Q3: N-ésimo Fibonacci    (recursión / iteración)            ║
║  Q4: Máximo de una lista  (arrays)                           ║
║  Q5: FizzBuzz unitario    (condicionales)                    ║
╚══════════════════════════════════════════════════════════════╝

🔗 Panel de evaluaciones:
   https://taskio.com.mx/dashboard/assessments
`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
