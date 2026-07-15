import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const VERSION_TAG = "sql-practical-v1";
const dryRun = process.argv.includes("--dry-run");

const questions = [
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

async function main() {
  const term = await prisma.taxonomyTerm.findFirst({
    where: { kind: "SKILL", slug: "sql" },
    select: { id: true, label: true },
  });

  if (!term) throw new Error("No se encontro el skill SQL en TaxonomyTerm.");

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
    throw new Error("No se encontro el template badge-sql-basico. Ejecuta primero el seed base de badges.");
  }

  if (dryRun) {
    const [totalQuestions, practicalQuestions] = await Promise.all([
      prisma.assessmentQuestion.count({ where: { templateId: template.id } }),
      prisma.assessmentQuestion.count({
        where: { templateId: template.id, tags: { has: VERSION_TAG } },
      }),
    ]);

    console.log(JSON.stringify({
      mode: "dry-run",
      term,
      template,
      totalQuestions,
      practicalQuestions,
      questionsToCreate: questions.length,
    }, null, 2));
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.assessmentTemplate.update({
      where: { id: template.id },
      data: {
        title: "Certificacion SQL - Practica basica",
        description: "Cinco consultas SQL escritas desde cero sobre datasets aislados. Evalua filtros, joins, agregaciones y analisis basico.",
        type: "CODING",
        difficulty: "JUNIOR",
        totalQuestions: questions.length,
        passingScore: 80,
        timeLimit: 35,
        sections: [{ name: "SQL practico", title: "SQL practico" }],
        shuffleQuestions: false,
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
        NOT: { tags: { has: VERSION_TAG } },
      },
      data: { isActive: false },
    });

    for (const [index, question] of questions.entries()) {
      const existing = await tx.assessmentQuestion.findFirst({
        where: { templateId: template.id, tags: { has: question.marker } },
        select: { id: true },
      });

      if (existing) {
        await tx.assessmentQuestion.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
        continue;
      }

      await tx.assessmentQuestion.create({
        data: {
          templateId: template.id,
          section: "SQL practico",
          difficulty: "JUNIOR",
          tags: ["sql", "practico", VERSION_TAG, question.marker],
          questionText: `${index + 1}. ${question.title}\n\n${question.text}`,
          options: [],
          allowMultiple: false,
          explanation: "La solucion debe producir exactamente las columnas y el orden solicitados.",
          type: "CODING",
          language: "sql",
          allowedLanguages: JSON.stringify(["sql"]),
          starterCode: question.starter,
          solutionCode: question.solution,
          codingConfig: { dialect: "sqlite", readOnly: true },
          isActive: true,
          testCases: {
            create: question.tests.map((test, testIndex) => ({
              input: test.setup,
              expectedOutput: test.expected,
              isHidden: test.hidden,
              points: 1,
              timeoutMs: 5000,
              memoryLimitMb: 128,
              orderIndex: testIndex,
            })),
          },
        },
      });
    }
  });

  const activePractical = await prisma.assessmentQuestion.count({
    where: {
      templateId: template.id,
      isActive: true,
      tags: { has: VERSION_TAG },
    },
  });

  if (activePractical !== questions.length) {
    throw new Error(`Se esperaban ${questions.length} preguntas practicas activas y hay ${activePractical}.`);
  }

  console.log(`SQL practico listo: ${template.slug} con ${activePractical} preguntas CODING en Judge0/SQLite.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
