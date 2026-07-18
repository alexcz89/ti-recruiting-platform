import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PRACTICAL_VERSION_TAG = "sql-practical-v1";
const CONCEPT_VERSION_TAG = "sql-concept-v1";
const EXAM_VERSION_TAG = "sql-basic-mixed-v2";
const dryRun = process.argv.includes("--dry-run");

const practicalQuestions = [
  {
    marker: "sql-practical-v1:q1",
    title: "Filtra y ordena empleados activos",
    text: `## Empleados activos con salario objetivo

Escribe una consulta que devuelva las columnas \`nombre\` y \`salario\` de \`empleados\` que:

- tengan \`activo = 1\`;
- tengan un salario mayor o igual a \`35000\`;
- se ordenen por salario descendente y, en caso de empate, por nombre ascendente.

**Esquema:** \`empleados(id, nombre, area, salario, activo)\``,
    starter: `SELECT
  -- columnas
FROM empleados
WHERE -- condiciones
ORDER BY -- orden;`,
    solution: `SELECT nombre, salario
FROM empleados
WHERE activo = 1 AND salario >= 35000
ORDER BY salario DESC, nombre ASC;`,
    tests: [
      {
        hidden: false,
        setup: `CREATE TABLE empleados (id INTEGER, nombre TEXT, area TEXT, salario INTEGER, activo INTEGER);
INSERT INTO empleados VALUES
  (1, 'Ana', 'Datos', 42000, 1),
  (2, 'Luis', 'Desarrollo', 35000, 1),
  (3, 'Marta', 'QA', 28000, 1),
  (4, 'Omar', 'Datos', 50000, 0),
  (5, 'Zoe', 'Soporte', 35000, 1);`,
        expected: "Ana|42000\nLuis|35000\nZoe|35000\n",
      },
      {
        hidden: true,
        setup: `CREATE TABLE empleados (id INTEGER, nombre TEXT, area TEXT, salario INTEGER, activo INTEGER);
INSERT INTO empleados VALUES
  (10, 'Diego', 'Datos', 60000, 1),
  (11, 'Bea', 'QA', 35000, 1),
  (12, 'Carla', 'Desarrollo', 41000, 0),
  (13, 'Eva', 'Soporte', 34000, 1),
  (14, 'Alan', 'Datos', 35000, 1);`,
        expected: "Diego|60000\nAlan|35000\nBea|35000\n",
      },
    ],
  },
  {
    marker: "sql-practical-v1:q2",
    title: "Relaciona clientes y pedidos",
    text: `## Pedidos entregados de alto valor

Devuelve \`cliente\`, \`pedido_id\` y \`total\` para pedidos con estado \`ENTREGADO\` y total mayor o igual a \`1000\`.

Ordena el resultado por total descendente y luego por ID del pedido ascendente.

**Esquema:**
- \`clientes(id, nombre, ciudad)\`
- \`pedidos(id, cliente_id, total, estado)\``,
    starter: `SELECT
  -- cliente, pedido_id, total
FROM clientes c
-- relaciona pedidos
WHERE -- filtros
ORDER BY -- orden;`,
    solution: `SELECT c.nombre AS cliente, p.id AS pedido_id, p.total
FROM clientes c
INNER JOIN pedidos p ON p.cliente_id = c.id
WHERE p.estado = 'ENTREGADO' AND p.total >= 1000
ORDER BY p.total DESC, p.id ASC;`,
    tests: [
      {
        hidden: false,
        setup: `CREATE TABLE clientes (id INTEGER, nombre TEXT, ciudad TEXT);
CREATE TABLE pedidos (id INTEGER, cliente_id INTEGER, total INTEGER, estado TEXT);
INSERT INTO clientes VALUES (1, 'Acme', 'CDMX'), (2, 'Nova', 'Monterrey'), (3, 'Pixel', 'Guadalajara');
INSERT INTO pedidos VALUES
  (101, 1, 1500, 'ENTREGADO'),
  (102, 2, 900, 'ENTREGADO'),
  (103, 1, 2500, 'CANCELADO'),
  (104, 3, 2200, 'ENTREGADO');`,
        expected: "Pixel|104|2200\nAcme|101|1500\n",
      },
      {
        hidden: true,
        setup: `CREATE TABLE clientes (id INTEGER, nombre TEXT, ciudad TEXT);
CREATE TABLE pedidos (id INTEGER, cliente_id INTEGER, total INTEGER, estado TEXT);
INSERT INTO clientes VALUES (1, 'Delta', 'Puebla'), (2, 'Orbit', 'Merida'), (3, 'Nube', 'Queretaro');
INSERT INTO pedidos VALUES
  (201, 1, 4000, 'ENTREGADO'),
  (202, 2, 1000, 'ENTREGADO'),
  (203, 3, 5000, 'PENDIENTE'),
  (204, 1, 1200, 'ENTREGADO');`,
        expected: "Delta|201|4000\nDelta|204|1200\nOrbit|202|1000\n",
      },
    ],
  },
  {
    marker: "sql-practical-v1:q3",
    title: "Agrupa ventas por vendedor",
    text: `## Vendedores con al menos 1000 en ventas

Agrupa la tabla \`ventas\` por vendedor y devuelve:

- \`vendedor\`;
- la suma de \`monto\` como \`total_ventas\`;
- el numero de ventas como \`operaciones\`.

Incluye solo vendedores con \`total_ventas >= 1000\`. Ordena por total descendente y vendedor ascendente.

**Esquema:** \`ventas(id, vendedor, monto)\``,
    starter: `SELECT
  vendedor,
  -- total_ventas,
  -- operaciones
FROM ventas
GROUP BY -- agrupacion
HAVING -- filtro agregado
ORDER BY -- orden;`,
    solution: `SELECT vendedor, SUM(monto) AS total_ventas, COUNT(*) AS operaciones
FROM ventas
GROUP BY vendedor
HAVING SUM(monto) >= 1000
ORDER BY total_ventas DESC, vendedor ASC;`,
    tests: [
      {
        hidden: false,
        setup: `CREATE TABLE ventas (id INTEGER, vendedor TEXT, monto INTEGER);
INSERT INTO ventas VALUES
  (1, 'Ana', 600), (2, 'Ana', 500),
  (3, 'Luis', 700), (4, 'Luis', 200),
  (5, 'Mara', 1500);`,
        expected: "Mara|1500|1\nAna|1100|2\n",
      },
      {
        hidden: true,
        setup: `CREATE TABLE ventas (id INTEGER, vendedor TEXT, monto INTEGER);
INSERT INTO ventas VALUES
  (1, 'Pepe', 400), (2, 'Pepe', 600),
  (3, 'Zoe', 2000), (4, 'Zoe', 500),
  (5, 'Leo', 999);`,
        expected: "Zoe|2500|2\nPepe|1000|2\n",
      },
    ],
  },
  {
    marker: "sql-practical-v1:q4",
    title: "Encuentra clientes sin pedidos",
    text: `## Clientes que aun no compran

Devuelve solamente el \`nombre\` de cada cliente que no tenga ningun pedido. Ordena alfabeticamente por nombre.

Puedes resolverlo con \`LEFT JOIN\` o \`NOT EXISTS\`.

**Esquema:**
- \`clientes(id, nombre)\`
- \`pedidos(id, cliente_id)\``,
    starter: `SELECT c.nombre
FROM clientes c
-- relacion o subconsulta
WHERE -- clientes sin pedidos
ORDER BY c.nombre ASC;`,
    solution: `SELECT c.nombre
FROM clientes c
LEFT JOIN pedidos p ON p.cliente_id = c.id
WHERE p.id IS NULL
ORDER BY c.nombre ASC;`,
    tests: [
      {
        hidden: false,
        setup: `CREATE TABLE clientes (id INTEGER, nombre TEXT);
CREATE TABLE pedidos (id INTEGER, cliente_id INTEGER);
INSERT INTO clientes VALUES (1, 'Acme'), (2, 'Nova'), (3, 'Pixel'), (4, 'Zen');
INSERT INTO pedidos VALUES (10, 1), (11, 1), (12, 3);`,
        expected: "Nova\nZen\n",
      },
      {
        hidden: true,
        setup: `CREATE TABLE clientes (id INTEGER, nombre TEXT);
CREATE TABLE pedidos (id INTEGER, cliente_id INTEGER);
INSERT INTO clientes VALUES (1, 'Alpha'), (2, 'Beta'), (3, 'Gamma');
INSERT INTO pedidos VALUES (20, 1), (21, 3);`,
        expected: "Beta\n",
      },
    ],
  },
  {
    marker: "sql-practical-v1:q5",
    title: "Calcula ingresos por categoria",
    text: `## Ingresos y unidades por categoria

Calcula, para cada categoria:

- \`categoria\`;
- \`SUM(precio * cantidad)\` como \`ingreso_total\`;
- \`SUM(cantidad)\` como \`unidades\`.

Incluye solo categorias con ingreso total mayor o igual a \`1000\`. Ordena por ingreso descendente y categoria ascendente.

**Esquema:**
- \`productos(id, nombre, categoria, precio)\`
- \`detalle_pedido(id, producto_id, cantidad)\``,
    starter: `SELECT
  p.categoria,
  -- ingreso_total,
  -- unidades
FROM productos p
-- relaciona detalle_pedido
GROUP BY -- categoria
HAVING -- ingreso minimo
ORDER BY -- orden;`,
    solution: `SELECT p.categoria,
       SUM(p.precio * d.cantidad) AS ingreso_total,
       SUM(d.cantidad) AS unidades
FROM productos p
INNER JOIN detalle_pedido d ON d.producto_id = p.id
GROUP BY p.categoria
HAVING SUM(p.precio * d.cantidad) >= 1000
ORDER BY ingreso_total DESC, p.categoria ASC;`,
    tests: [
      {
        hidden: false,
        setup: `CREATE TABLE productos (id INTEGER, nombre TEXT, categoria TEXT, precio INTEGER);
CREATE TABLE detalle_pedido (id INTEGER, producto_id INTEGER, cantidad INTEGER);
INSERT INTO productos VALUES
  (1, 'Laptop', 'Hardware', 1000),
  (2, 'Mouse', 'Hardware', 100),
  (3, 'Licencia', 'Software', 500),
  (4, 'Curso', 'Servicios', 800);
INSERT INTO detalle_pedido VALUES (1, 1, 1), (2, 2, 2), (3, 3, 3), (4, 4, 1);`,
        expected: "Software|1500|3\nHardware|1200|3\n",
      },
      {
        hidden: true,
        setup: `CREATE TABLE productos (id INTEGER, nombre TEXT, categoria TEXT, precio INTEGER);
CREATE TABLE detalle_pedido (id INTEGER, producto_id INTEGER, cantidad INTEGER);
INSERT INTO productos VALUES
  (1, 'Monitor', 'Hardware', 300),
  (2, 'Teclado', 'Hardware', 50),
  (3, 'SaaS', 'Software', 250),
  (4, 'Consultoria', 'Servicios', 500);
INSERT INTO detalle_pedido VALUES (1, 1, 2), (2, 2, 4), (3, 3, 5), (4, 4, 3);`,
        expected: "Servicios|1500|3\nSoftware|1250|5\n",
      },
    ],
  },
];

const conceptualQuestions = [
  {
    marker: "sql-concept-v1:q1",
    title: "Filtrado antes y después de agrupar",
    text: "¿Qué cláusula filtra grupos después de aplicar funciones como SUM o COUNT?",
    options: ["HAVING", "WHERE", "ORDER BY", "DISTINCT"],
    correctIndex: 0,
    explanation: "HAVING filtra los grupos después de la agregación; WHERE filtra filas antes de agrupar.",
  },
  {
    marker: "sql-concept-v1:q2",
    title: "Comportamiento de LEFT JOIN",
    text: "¿Qué devuelve un LEFT JOIN entre clientes y pedidos?",
    options: [
      "Todos los clientes y los pedidos coincidentes; usa NULL cuando no hay pedido",
      "Solo clientes que tienen al menos un pedido",
      "Todos los pedidos aunque no tengan cliente",
      "El producto cartesiano de ambas tablas",
    ],
    correctIndex: 0,
    explanation: "LEFT JOIN conserva todas las filas de la tabla izquierda y completa con NULL cuando no existe coincidencia.",
  },
  {
    marker: "sql-concept-v1:q3",
    title: "Conteo de valores no nulos",
    text: "¿Qué cuenta COUNT(columna) en SQL?",
    options: [
      "Los valores no nulos de la columna",
      "Todas las filas, incluidas las que contienen NULL",
      "Solo los valores distintos",
      "La suma de los valores numéricos",
    ],
    correctIndex: 0,
    explanation: "COUNT(columna) ignora NULL; COUNT(*) cuenta todas las filas.",
  },
  {
    marker: "sql-concept-v1:q4",
    title: "Comparación con NULL",
    text: "¿Cuál es la forma correcta de encontrar filas donde fecha_baja no tiene valor?",
    options: [
      "WHERE fecha_baja IS NULL",
      "WHERE fecha_baja = NULL",
      "WHERE fecha_baja == NULL",
      "WHERE fecha_baja = 'NULL'",
    ],
    correctIndex: 0,
    explanation: "NULL representa un valor desconocido y se comprueba con IS NULL o IS NOT NULL.",
  },
  {
    marker: "sql-concept-v1:q5",
    title: "Columnas en GROUP BY",
    text: "En una consulta agregada, ¿qué debe hacerse con una columna seleccionada que no usa una función de agregación?",
    options: [
      "Incluirla en GROUP BY",
      "Incluirla en HAVING",
      "Convertirla siempre a texto",
      "Moverla a ORDER BY",
    ],
    correctIndex: 0,
    explanation: "Las columnas no agregadas del SELECT deben formar parte de GROUP BY en SQL estándar.",
  },
  {
    marker: "sql-concept-v1:q6",
    title: "Propósito de una llave primaria",
    text: "¿Qué garantiza una PRIMARY KEY?",
    options: [
      "Identifica cada fila con un valor único y no nulo",
      "Ordena físicamente todas las filas",
      "Evita cualquier valor duplicado en toda la tabla",
      "Crea automáticamente una relación con otra tabla",
    ],
    correctIndex: 0,
    explanation: "Una llave primaria identifica de manera única cada fila y no admite valores NULL.",
  },
  {
    marker: "sql-concept-v1:q7",
    title: "Prevención de SQL injection",
    text: "¿Cuál es la práctica más efectiva para evitar SQL injection al recibir datos del usuario?",
    options: [
      "Usar consultas parametrizadas",
      "Escapar espacios manualmente",
      "Ocultar los errores de la base de datos",
      "Convertir la consulta a mayúsculas",
    ],
    correctIndex: 0,
    explanation: "Las consultas parametrizadas separan los datos de la estructura SQL y evitan que la entrada se interprete como código.",
  },
  {
    marker: "sql-concept-v1:q8",
    title: "Atomicidad de una transacción",
    text: "Si una operación falla dentro de una transacción y se ejecuta ROLLBACK, ¿qué sucede?",
    options: [
      "Se deshacen los cambios de la transacción no confirmada",
      "Se conservan solo los INSERT",
      "Se elimina la tabla afectada",
      "Se confirma automáticamente el resto de operaciones",
    ],
    correctIndex: 0,
    explanation: "ROLLBACK revierte los cambios pendientes desde el inicio de la transacción o desde el punto de guardado aplicable.",
  },
  {
    marker: "sql-concept-v1:q9",
    title: "Costo de los índices",
    text: "¿Cuál es un efecto secundario común de agregar demasiados índices?",
    options: [
      "Aumenta el costo de escrituras y el uso de almacenamiento",
      "Impide usar WHERE",
      "Convierte todas las columnas en únicas",
      "Elimina la necesidad de optimizar consultas",
    ],
    correctIndex: 0,
    explanation: "Los índices pueden acelerar lecturas, pero deben mantenerse en INSERT, UPDATE y DELETE y consumen espacio.",
  },
  {
    marker: "sql-concept-v1:q10",
    title: "Eliminación de duplicados",
    text: "¿Qué palabra clave elimina filas duplicadas del resultado de una consulta?",
    options: ["DISTINCT", "UNIQUE", "DEDUP", "GROUP"],
    correctIndex: 0,
    explanation: "SELECT DISTINCT devuelve combinaciones únicas de las columnas seleccionadas.",
  },
];

const optionIds = ["a", "b", "c", "d"];

function buildOptions(question) {
  return question.options.map((text, index) => ({
    id: optionIds[index],
    text,
    isCorrect: index === question.correctIndex,
  }));
}

async function main() {
  if (practicalQuestions.length !== 5 || conceptualQuestions.length !== 10) {
    throw new Error("La certificación SQL debe tener 5 ejercicios prácticos y 10 preguntas conceptuales.");
  }

  for (const question of conceptualQuestions) {
    if (question.options.length !== 4 || question.correctIndex < 0 || question.correctIndex > 3) {
      throw new Error(`Configuración inválida en ${question.marker}.`);
    }
  }

  const term = await prisma.taxonomyTerm.findFirst({
    where: { kind: "SKILL", slug: "sql" },
    select: { id: true, label: true },
  });

  if (!term) throw new Error("No se encontró el skill SQL en TaxonomyTerm.");

  const template = await prisma.assessmentTemplate.findFirst({
    where: {
      OR: [
        { slug: "badge-sql-basico" },
        { badgeTermId: term.id, badgeLevel: 1 },
      ],
    },
    select: { id: true, slug: true, title: true },
  });

  if (!template) {
    throw new Error("No se encontró el template badge-sql-basico. Ejecuta primero el seed base de badges.");
  }

  if (dryRun) {
    const [totalQuestions, practicalQuestionsInDb, conceptualQuestionsInDb] = await Promise.all([
      prisma.assessmentQuestion.count({ where: { templateId: template.id } }),
      prisma.assessmentQuestion.count({
        where: { templateId: template.id, tags: { has: PRACTICAL_VERSION_TAG } },
      }),
      prisma.assessmentQuestion.count({
        where: { templateId: template.id, tags: { has: CONCEPT_VERSION_TAG } },
      }),
    ]);

    console.log(JSON.stringify({
      mode: "dry-run",
      term,
      template,
      current: {
        totalQuestions,
        practicalQuestions: practicalQuestionsInDb,
        conceptualQuestions: conceptualQuestionsInDb,
      },
      target: {
        totalQuestions: practicalQuestions.length + conceptualQuestions.length,
        practicalQuestions: practicalQuestions.length,
        conceptualQuestions: conceptualQuestions.length,
      },
    }, null, 2));
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.assessmentTemplate.update({
      where: { id: template.id },
      data: {
        title: "Certificación SQL - Práctica básica",
        description: "Evaluación mixta con 10 preguntas conceptuales y 5 consultas SQL prácticas sobre filtros, joins, agregaciones, seguridad y transacciones.",
        type: "MIXED",
        difficulty: "JUNIOR",
        totalQuestions: practicalQuestions.length + conceptualQuestions.length,
        passingScore: 80,
        timeLimit: 50,
        sections: [
          {
            name: "Fundamentos SQL",
            title: "Fundamentos SQL",
            questions: conceptualQuestions.length,
            sampleSize: conceptualQuestions.length,
            timeLimit: 20,
          },
          {
            name: "SQL práctico",
            title: "SQL práctico",
            questions: practicalQuestions.length,
            sampleSize: practicalQuestions.length,
            minimumCorrect: 3,
            timeLimit: 30,
          },
        ],
        shuffleQuestions: true,
        allowRetry: true,
        maxAttempts: 99,
        isActive: true,
        isGlobal: true,
        companyId: null,
        language: "sql",
        baseCreditCost: 0,
        isBadgeExam: true,
        badgeTermId: term.id,
        badgeLevel: 1,
      },
    });

    await tx.assessmentQuestion.updateMany({
      where: {
        templateId: template.id,
        NOT: { tags: { has: EXAM_VERSION_TAG } },
      },
      data: { isActive: false },
    });

    for (const question of practicalQuestions) {
      const testCases = question.tests.map((test, testIndex) => ({
        input: test.setup,
        expectedOutput: test.expected,
        isHidden: test.hidden,
        points: 1,
        timeoutMs: 5000,
        memoryLimitMb: 128,
        orderIndex: testIndex,
      }));
      const practicalData = {
        section: "SQL práctico",
        difficulty: "JUNIOR",
        tags: ["sql", "práctico", EXAM_VERSION_TAG, PRACTICAL_VERSION_TAG, question.marker],
        questionText: `${question.title}\n\n${question.text}`,
        codeSnippet: null,
        options: [],
        allowMultiple: false,
        explanation: "La solución debe producir exactamente las columnas y el orden solicitados.",
        type: "CODING",
        language: "sql",
        allowedLanguages: JSON.stringify(["sql"]),
        starterCode: question.starter,
        solutionCode: question.solution,
        codingConfig: { dialect: "sqlite", readOnly: true },
        isActive: true,
      };

      const existing = await tx.assessmentQuestion.findFirst({
        where: { templateId: template.id, tags: { has: question.marker } },
        select: { id: true },
      });

      if (existing) {
        await tx.assessmentQuestion.update({
          where: { id: existing.id },
          data: {
            ...practicalData,
            testCases: {
              deleteMany: {},
              create: testCases,
            },
          },
        });
      } else {
        await tx.assessmentQuestion.create({
          data: {
            templateId: template.id,
            ...practicalData,
            testCases: { create: testCases },
          },
        });
      }
    }

    for (const question of conceptualQuestions) {
      const conceptualData = {
        section: "Fundamentos SQL",
        difficulty: "JUNIOR",
        tags: ["sql", "conceptual", EXAM_VERSION_TAG, CONCEPT_VERSION_TAG, question.marker],
        questionText: `${question.title}\n\n${question.text}`,
        codeSnippet: null,
        options: buildOptions(question),
        allowMultiple: false,
        explanation: question.explanation,
        type: "MULTIPLE_CHOICE",
        language: null,
        allowedLanguages: null,
        starterCode: null,
        solutionCode: null,
        codingConfig: null,
        isActive: true,
      };

      const existing = await tx.assessmentQuestion.findFirst({
        where: { templateId: template.id, tags: { has: question.marker } },
        select: { id: true },
      });

      if (existing) {
        await tx.assessmentQuestion.update({
          where: { id: existing.id },
          data: {
            ...conceptualData,
            testCases: { deleteMany: {} },
          },
        });
      } else {
        await tx.assessmentQuestion.create({
          data: {
            templateId: template.id,
            ...conceptualData,
          },
        });
      }
    }
  }, {
    maxWait: 15_000,
    timeout: 120_000,
  });

  const [activeTotal, activePractical, activeConceptual] = await Promise.all([
    prisma.assessmentQuestion.count({
      where: { templateId: template.id, isActive: true, tags: { has: EXAM_VERSION_TAG } },
    }),
    prisma.assessmentQuestion.count({
      where: { templateId: template.id, isActive: true, tags: { has: PRACTICAL_VERSION_TAG } },
    }),
    prisma.assessmentQuestion.count({
      where: { templateId: template.id, isActive: true, tags: { has: CONCEPT_VERSION_TAG } },
    }),
  ]);

  if (
    activeTotal !== 15 ||
    activePractical !== practicalQuestions.length ||
    activeConceptual !== conceptualQuestions.length
  ) {
    throw new Error(
      `Configuración incompleta: total=${activeTotal}, prácticas=${activePractical}, conceptuales=${activeConceptual}.`
    );
  }

  console.log(
    `Certificación SQL lista: ${template.slug} con ${activeConceptual} preguntas conceptuales y ${activePractical} ejercicios prácticos.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
