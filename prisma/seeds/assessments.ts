// prisma/seeds/assessments.ts
// Ejecutar directo:  npx ts-node prisma/seeds/assessments.ts
// Importar desde seed.ts: import { seedAssessmentTemplates } from './seeds/assessments'

import { PrismaClient, AssessmentType, AssessmentDifficulty, QuestionType } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================
// TIPOS
// ============================================================
type QuestionSeed = {
  section: string;
  difficulty: AssessmentDifficulty;
  tags: string[];
  questionText: string;
  codeSnippet?: string;
  options: { id: string; text: string; isCorrect: boolean }[];
  allowMultiple?: boolean;
  explanation?: string;
  type?: QuestionType;
};

type TemplateSeed = {
  title: string;
  slug: string;
  description: string;
  type: AssessmentType;
  difficulty: AssessmentDifficulty;
  passingScore: number;
  timeLimit: number; // minutos
  sections: { name: string; questions: number }[];
  questions: QuestionSeed[];
};

// ============================================================
// TEMPLATE 1: JAVASCRIPT JUNIOR
// ============================================================
const javascriptJunior: TemplateSeed = {
  title: "JavaScript Fundamentos",
  slug: "javascript-fundamentos",
  description: "Evalúa conocimientos básicos e intermedios de JavaScript: tipos de datos, funciones, arrays, objetos, asincronía y ES6+.",
  type: "MCQ",
  difficulty: "JUNIOR",
  passingScore: 70,
  timeLimit: 25,
  sections: [
    { name: "Fundamentos", questions: 5 },
    { name: "Arrays y Objetos", questions: 5 },
    { name: "ES6+ y Asincronía", questions: 5 },
  ],
  questions: [
    // ── SECCIÓN: Fundamentos ──
    {
      section: "Fundamentos",
      difficulty: "JUNIOR",
      tags: ["tipos", "javascript"],
      questionText: "¿Cuál es el resultado de `typeof null` en JavaScript?",
      options: [
        { id: "a", text: '"null"', isCorrect: false },
        { id: "b", text: '"object"', isCorrect: true },
        { id: "c", text: '"undefined"', isCorrect: false },
        { id: "d", text: '"boolean"', isCorrect: false },
      ],
      explanation: "Es un bug histórico de JavaScript. `typeof null` devuelve 'object' aunque null no sea un objeto.",
    },
    {
      section: "Fundamentos",
      difficulty: "JUNIOR",
      tags: ["scope", "hoisting"],
      questionText: "¿Cuál es la diferencia principal entre `var`, `let` y `const`?",
      options: [
        { id: "a", text: "No hay diferencia, son intercambiables", isCorrect: false },
        { id: "b", text: "`var` tiene scope de función, `let` y `const` tienen scope de bloque", isCorrect: true },
        { id: "c", text: "`const` no puede almacenar objetos", isCorrect: false },
        { id: "d", text: "`let` no puede reasignarse", isCorrect: false },
      ],
      explanation: "`var` tiene function scope y sufre hoisting. `let` y `const` tienen block scope. `const` no permite reasignación del binding, pero el objeto al que apunta sí puede mutar.",
    },
    {
      section: "Fundamentos",
      difficulty: "JUNIOR",
      tags: ["coercion", "tipos"],
      questionText: "¿Qué imprime el siguiente código?\n\n```js\nconsole.log(1 + '2' + 3);\n```",
      codeSnippet: "console.log(1 + '2' + 3);",
      options: [
        { id: "a", text: "6", isCorrect: false },
        { id: "b", text: '"123"', isCorrect: true },
        { id: "c", text: '"15"', isCorrect: false },
        { id: "d", text: "NaN", isCorrect: false },
      ],
      explanation: "JavaScript evalúa de izquierda a derecha. `1 + '2'` convierte 1 a string → `'12'`. Luego `'12' + 3` → `'123'`.",
    },
    {
      section: "Fundamentos",
      difficulty: "JUNIOR",
      tags: ["igualdad", "coercion"],
      questionText: "¿Cuál es la diferencia entre `==` y `===` en JavaScript?",
      options: [
        { id: "a", text: "Son idénticos, solo cambia el estilo", isCorrect: false },
        { id: "b", text: "`==` compara valor con coerción de tipos, `===` compara valor Y tipo sin coerción", isCorrect: true },
        { id: "c", text: "`===` es más lento que `==`", isCorrect: false },
        { id: "d", text: "`==` solo funciona con strings", isCorrect: false },
      ],
      explanation: "`==` realiza type coercion (0 == '0' es true). `===` no hace coerción (0 === '0' es false). Se recomienda siempre usar `===`.",
    },
    {
      section: "Fundamentos",
      difficulty: "JUNIOR",
      tags: ["closures", "scope"],
      questionText: "¿Qué imprime este código?\n\n```js\nfor (var i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i), 0);\n}\n```",
      codeSnippet: "for (var i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i), 0);\n}",
      options: [
        { id: "a", text: "0, 1, 2", isCorrect: false },
        { id: "b", text: "3, 3, 3", isCorrect: true },
        { id: "c", text: "0, 0, 0", isCorrect: false },
        { id: "d", text: "Error de ejecución", isCorrect: false },
      ],
      explanation: "Con `var`, `i` tiene function scope. Cuando los callbacks se ejecutan, el loop ya terminó y `i` es 3. Con `let` imprimiría 0, 1, 2 porque cada iteración crea un nuevo binding.",
    },

    // ── SECCIÓN: Arrays y Objetos ──
    {
      section: "Arrays y Objetos",
      difficulty: "JUNIOR",
      tags: ["arrays", "métodos"],
      questionText: "¿Cuál método de array devuelve un nuevo array con los elementos transformados?",
      options: [
        { id: "a", text: "forEach()", isCorrect: false },
        { id: "b", text: "map()", isCorrect: true },
        { id: "c", text: "filter()", isCorrect: false },
        { id: "d", text: "reduce()", isCorrect: false },
      ],
      explanation: "`map()` transforma cada elemento y retorna un nuevo array. `forEach()` itera pero retorna undefined. `filter()` filtra elementos. `reduce()` acumula a un solo valor.",
    },
    {
      section: "Arrays y Objetos",
      difficulty: "JUNIOR",
      tags: ["arrays", "métodos"],
      questionText: "¿Qué devuelve `[1, 2, 3].filter(x => x > 1)`?",
      options: [
        { id: "a", text: "[1]", isCorrect: false },
        { id: "b", text: "[2, 3]", isCorrect: true },
        { id: "c", text: "true", isCorrect: false },
        { id: "d", text: "[1, 2, 3]", isCorrect: false },
      ],
      explanation: "`filter()` retorna un nuevo array con los elementos que cumplen la condición. Solo 2 y 3 son mayores a 1.",
    },
    {
      section: "Arrays y Objetos",
      difficulty: "MID",
      tags: ["objetos", "destructuring"],
      questionText: "¿Cuál es el output de este código?\n\n```js\nconst obj = { a: 1, b: 2 };\nconst { a, ...rest } = obj;\nconsole.log(rest);\n```",
      codeSnippet: "const obj = { a: 1, b: 2 };\nconst { a, ...rest } = obj;\nconsole.log(rest);",
      options: [
        { id: "a", text: "{ a: 1 }", isCorrect: false },
        { id: "b", text: "{ b: 2 }", isCorrect: true },
        { id: "c", text: "{ a: 1, b: 2 }", isCorrect: false },
        { id: "d", text: "undefined", isCorrect: false },
      ],
      explanation: "El rest operator `...rest` recoge todas las propiedades restantes después de destructurar `a`. Como `a` ya fue extraída, `rest` contiene solo `{ b: 2 }`.",
    },
    {
      section: "Arrays y Objetos",
      difficulty: "MID",
      tags: ["arrays", "reduce"],
      questionText: "¿Qué devuelve `[1, 2, 3, 4].reduce((acc, val) => acc + val, 0)`?",
      options: [
        { id: "a", text: "[1, 2, 3, 4]", isCorrect: false },
        { id: "b", text: "10", isCorrect: true },
        { id: "c", text: "4", isCorrect: false },
        { id: "d", text: "0", isCorrect: false },
      ],
      explanation: "`reduce` acumula: 0+1=1, 1+2=3, 3+3=6, 6+4=10. El segundo argumento (0) es el valor inicial del acumulador.",
    },
    {
      section: "Arrays y Objetos",
      difficulty: "MID",
      tags: ["objetos", "referencias"],
      questionText: "¿Qué imprime este código?\n\n```js\nconst a = { x: 1 };\nconst b = a;\nb.x = 99;\nconsole.log(a.x);\n```",
      codeSnippet: "const a = { x: 1 };\nconst b = a;\nb.x = 99;\nconsole.log(a.x);",
      options: [
        { id: "a", text: "1", isCorrect: false },
        { id: "b", text: "99", isCorrect: true },
        { id: "c", text: "undefined", isCorrect: false },
        { id: "d", text: "Error", isCorrect: false },
      ],
      explanation: "Los objetos se asignan por referencia. `b = a` no crea una copia, ambas variables apuntan al mismo objeto en memoria. Modificar `b.x` también modifica `a.x`.",
    },

    // ── SECCIÓN: ES6+ y Asincronía ──
    {
      section: "ES6+ y Asincronía",
      difficulty: "MID",
      tags: ["promises", "async"],
      questionText: "¿Cuál es la forma correcta de manejar errores con async/await?",
      options: [
        { id: "a", text: "Con `.catch()` encadenado al await", isCorrect: false },
        { id: "b", text: "Con un bloque `try/catch` alrededor del await", isCorrect: true },
        { id: "c", text: "async/await no puede lanzar errores", isCorrect: false },
        { id: "d", text: "Con `window.onerror`", isCorrect: false },
      ],
      explanation: "Con async/await se usa `try/catch` para manejar errores. Si la promise rechaza, el error es capturado por el `catch`. También se puede usar `.catch()` en la función async invocada.",
    },
    {
      section: "ES6+ y Asincronía",
      difficulty: "MID",
      tags: ["promises", "microtasks"],
      questionText: "¿En qué orden se imprime?\n\n```js\nconsole.log('1');\nPromise.resolve().then(() => console.log('2'));\nconsole.log('3');\n```",
      codeSnippet: "console.log('1');\nPromise.resolve().then(() => console.log('2'));\nconsole.log('3');",
      options: [
        { id: "a", text: "1, 2, 3", isCorrect: false },
        { id: "b", text: "1, 3, 2", isCorrect: true },
        { id: "c", text: "2, 1, 3", isCorrect: false },
        { id: "d", text: "3, 1, 2", isCorrect: false },
      ],
      explanation: "El código síncrono se ejecuta primero (1, 3). Las callbacks de promesas van a la microtask queue y se ejecutan después del código síncrono actual (2).",
    },
    {
      section: "ES6+ y Asincronía",
      difficulty: "MID",
      tags: ["arrow-functions", "this"],
      questionText: "¿Cuál es una diferencia clave entre arrow functions y funciones regulares?",
      options: [
        { id: "a", text: "Las arrow functions son más lentas", isCorrect: false },
        { id: "b", text: "Las arrow functions no tienen su propio `this`, heredan el del contexto léxico", isCorrect: true },
        { id: "c", text: "Las arrow functions no pueden recibir parámetros", isCorrect: false },
        { id: "d", text: "Las arrow functions siempre son async", isCorrect: false },
      ],
      explanation: "Las arrow functions capturan el `this` del scope donde fueron definidas (léxico). Las funciones regulares tienen su propio `this` que depende de cómo son invocadas.",
    },
    {
      section: "ES6+ y Asincronía",
      difficulty: "JUNIOR",
      tags: ["template-literals", "ES6"],
      questionText: "¿Cuál es la sintaxis correcta de un template literal?",
      options: [
        { id: "a", text: "'Hola ' + nombre", isCorrect: false },
        { id: "b", text: "`Hola ${nombre}`", isCorrect: true },
        { id: "c", text: '"Hola {nombre}"', isCorrect: false },
        { id: "d", text: "'Hola #{nombre}'", isCorrect: false },
      ],
      explanation: "Los template literals usan backticks (`) y expresiones entre `${}`. Permiten interpolación de variables y strings multilínea.",
    },
    {
      section: "ES6+ y Asincronía",
      difficulty: "MID",
      tags: ["modules", "ES6"],
      questionText: "¿Cuál es la diferencia entre `export default` y `export` (named export)?",
      options: [
        { id: "a", text: "No hay diferencia", isCorrect: false },
        { id: "b", text: "Solo puede haber un `export default` por archivo, pero múltiples named exports", isCorrect: true },
        { id: "c", text: "`export default` es más lento", isCorrect: false },
        { id: "d", text: "Named exports no se pueden importar con destructuring", isCorrect: false },
      ],
      explanation: "Cada archivo puede tener solo un `export default`. Se importa como `import Foo from './foo'`. Los named exports son múltiples y se importan con destructuring: `import { bar, baz } from './foo'`.",
    },
  ],
};

// ============================================================
// TEMPLATE 2: SQL FUNDAMENTOS
// ============================================================
const sqlFundamentos: TemplateSeed = {
  title: "SQL Fundamentos",
  slug: "sql-fundamentos",
  description: "Evalúa conocimientos de SQL: consultas básicas, JOINs, agregaciones, subconsultas y optimización.",
  type: "MCQ",
  difficulty: "JUNIOR",
  passingScore: 70,
  timeLimit: 20,
  sections: [
    { name: "Consultas Básicas", questions: 4 },
    { name: "JOINs", questions: 4 },
    { name: "Agregaciones y Subconsultas", questions: 4 },
  ],
  questions: [
    // ── Consultas Básicas ──
    {
      section: "Consultas Básicas",
      difficulty: "JUNIOR",
      tags: ["select", "where"],
      questionText: "¿Cuál query selecciona todos los empleados con salario mayor a 50,000?",
      options: [
        { id: "a", text: "SELECT * FROM empleados WHERE salario > 50000", isCorrect: true },
        { id: "b", text: "SELECT * FROM empleados HAVING salario > 50000", isCorrect: false },
        { id: "c", text: "SELECT empleados WHERE salario > 50000", isCorrect: false },
        { id: "d", text: "GET * FROM empleados IF salario > 50000", isCorrect: false },
      ],
      explanation: "`WHERE` filtra filas antes de la agregación. `HAVING` filtra después de `GROUP BY`. La sintaxis correcta es `SELECT columnas FROM tabla WHERE condición`.",
    },
    {
      section: "Consultas Básicas",
      difficulty: "JUNIOR",
      tags: ["order", "limit"],
      questionText: "¿Cómo seleccionas los 5 productos más caros de una tabla `productos`?",
      options: [
        { id: "a", text: "SELECT * FROM productos ORDER BY precio LIMIT 5", isCorrect: false },
        { id: "b", text: "SELECT * FROM productos ORDER BY precio DESC LIMIT 5", isCorrect: true },
        { id: "c", text: "SELECT TOP 5 * FROM productos ORDER BY precio", isCorrect: false },
        { id: "d", text: "SELECT * FROM productos WHERE precio = MAX(precio) LIMIT 5", isCorrect: false },
      ],
      explanation: "`ORDER BY precio DESC` ordena de mayor a menor. `LIMIT 5` toma los primeros 5. `TOP` es sintaxis de SQL Server, no estándar.",
    },
    {
      section: "Consultas Básicas",
      difficulty: "JUNIOR",
      tags: ["distinct", "select"],
      questionText: "¿Qué hace `SELECT DISTINCT departamento FROM empleados`?",
      options: [
        { id: "a", text: "Selecciona solo el primer departamento", isCorrect: false },
        { id: "b", text: "Retorna departamentos únicos, sin duplicados", isCorrect: true },
        { id: "c", text: "Ordena los departamentos alfabéticamente", isCorrect: false },
        { id: "d", text: "Selecciona departamentos que no son NULL", isCorrect: false },
      ],
      explanation: "`DISTINCT` elimina filas duplicadas del resultado. Si 10 empleados pertenecen a 'Ventas', solo aparece 'Ventas' una vez.",
    },
    {
      section: "Consultas Básicas",
      difficulty: "JUNIOR",
      tags: ["null", "is null"],
      questionText: "¿Cuál es la forma correcta de filtrar registros donde `email` es NULL?",
      options: [
        { id: "a", text: "WHERE email = NULL", isCorrect: false },
        { id: "b", text: "WHERE email IS NULL", isCorrect: true },
        { id: "c", text: "WHERE email == NULL", isCorrect: false },
        { id: "d", text: "WHERE NOT email", isCorrect: false },
      ],
      explanation: "NULL no puede compararse con `=` porque NULL no es igual a nada, ni siquiera a sí mismo. Se usa `IS NULL` o `IS NOT NULL`.",
    },

    // ── JOINs ──
    {
      section: "JOINs",
      difficulty: "MID",
      tags: ["inner-join", "joins"],
      questionText: "¿Qué tipo de JOIN retorna solo las filas que tienen coincidencia en AMBAS tablas?",
      options: [
        { id: "a", text: "LEFT JOIN", isCorrect: false },
        { id: "b", text: "INNER JOIN", isCorrect: true },
        { id: "c", text: "FULL OUTER JOIN", isCorrect: false },
        { id: "d", text: "CROSS JOIN", isCorrect: false },
      ],
      explanation: "`INNER JOIN` solo retorna filas donde existe la condición de join en ambas tablas. `LEFT JOIN` incluye todas las filas de la izquierda aunque no tengan match.",
    },
    {
      section: "JOINs",
      difficulty: "MID",
      tags: ["left-join", "joins"],
      questionText: "Tienes tablas `clientes` y `pedidos`. Quieres todos los clientes, incluso los que no tienen pedidos. ¿Qué JOIN usas?",
      options: [
        { id: "a", text: "INNER JOIN", isCorrect: false },
        { id: "b", text: "LEFT JOIN de clientes a pedidos", isCorrect: true },
        { id: "c", text: "RIGHT JOIN de clientes a pedidos", isCorrect: false },
        { id: "d", text: "CROSS JOIN", isCorrect: false },
      ],
      explanation: "`LEFT JOIN` retorna todos los registros de la tabla izquierda (clientes) y los registros coincidentes de la derecha (pedidos). Si un cliente no tiene pedidos, las columnas de pedidos serán NULL.",
    },
    {
      section: "JOINs",
      difficulty: "MID",
      tags: ["joins", "multiple"],
      questionText: "¿Es válido hacer JOIN de más de dos tablas en una sola query?",
      options: [
        { id: "a", text: "No, SQL solo permite JOIN entre dos tablas", isCorrect: false },
        { id: "b", text: "Sí, se pueden encadenar múltiples JOINs", isCorrect: true },
        { id: "c", text: "Solo con UNION", isCorrect: false },
        { id: "d", text: "Solo en stored procedures", isCorrect: false },
      ],
      explanation: "Se pueden encadenar múltiples JOINs: `FROM a JOIN b ON ... JOIN c ON ... JOIN d ON ...`. Cada JOIN agrega una tabla al resultado.",
    },
    {
      section: "JOINs",
      difficulty: "MID",
      tags: ["self-join"],
      questionText: "¿Para qué sirve un SELF JOIN?",
      options: [
        { id: "a", text: "Para unir una tabla consigo misma", isCorrect: true },
        { id: "b", text: "Para mejorar el rendimiento de queries", isCorrect: false },
        { id: "c", text: "Para eliminar duplicados", isCorrect: false },
        { id: "d", text: "Es lo mismo que INNER JOIN", isCorrect: false },
      ],
      explanation: "Un SELF JOIN une una tabla con ella misma usando aliases. Útil para relaciones jerárquicas como empleados y sus managers en la misma tabla.",
    },

    // ── Agregaciones y Subconsultas ──
    {
      section: "Agregaciones y Subconsultas",
      difficulty: "MID",
      tags: ["group-by", "having"],
      questionText: "¿Cuál query cuenta empleados por departamento y muestra solo los que tienen más de 5?",
      options: [
        { id: "a", text: "SELECT departamento, COUNT(*) FROM empleados WHERE COUNT(*) > 5 GROUP BY departamento", isCorrect: false },
        { id: "b", text: "SELECT departamento, COUNT(*) FROM empleados GROUP BY departamento HAVING COUNT(*) > 5", isCorrect: true },
        { id: "c", text: "SELECT departamento, COUNT(*) FROM empleados GROUP BY departamento WHERE COUNT > 5", isCorrect: false },
        { id: "d", text: "SELECT departamento FROM empleados HAVING COUNT(*) > 5", isCorrect: false },
      ],
      explanation: "`HAVING` filtra grupos después de `GROUP BY`. No se puede usar `WHERE` con funciones de agregación como `COUNT()`. La secuencia correcta es: WHERE → GROUP BY → HAVING.",
    },
    {
      section: "Agregaciones y Subconsultas",
      difficulty: "MID",
      tags: ["aggregate-functions"],
      questionText: "¿Qué función SQL devuelve el promedio de una columna numérica?",
      options: [
        { id: "a", text: "SUM()", isCorrect: false },
        { id: "b", text: "AVG()", isCorrect: true },
        { id: "c", text: "MEAN()", isCorrect: false },
        { id: "d", text: "MEDIAN()", isCorrect: false },
      ],
      explanation: "`AVG()` calcula el promedio ignorando NULLs. `SUM()` suma, `COUNT()` cuenta, `MIN()`/`MAX()` obtienen extremos. `MEAN()` y `MEDIAN()` no son funciones estándar de SQL.",
    },
    {
      section: "Agregaciones y Subconsultas",
      difficulty: "SENIOR",
      tags: ["subquery", "in"],
      questionText: "¿Qué hace esta query?\n```sql\nSELECT nombre FROM clientes\nWHERE id IN (SELECT cliente_id FROM pedidos WHERE total > 1000)\n```",
      codeSnippet: "SELECT nombre FROM clientes\nWHERE id IN (SELECT cliente_id FROM pedidos WHERE total > 1000)",
      options: [
        { id: "a", text: "Selecciona clientes con promedio de pedidos mayor a 1000", isCorrect: false },
        { id: "b", text: "Selecciona nombres de clientes que tienen al menos un pedido mayor a 1000", isCorrect: true },
        { id: "c", text: "Selecciona todos los pedidos mayores a 1000", isCorrect: false },
        { id: "d", text: "Genera un error de sintaxis", isCorrect: false },
      ],
      explanation: "La subconsulta obtiene los `cliente_id` con pedidos > 1000. El `IN` filtra clientes cuyo `id` esté en ese conjunto. Retorna nombres de clientes que hicieron al menos un pedido grande.",
    },
    {
      section: "Agregaciones y Subconsultas",
      difficulty: "MID",
      tags: ["index", "performance"],
      questionText: "¿Para qué sirven los índices en una base de datos?",
      options: [
        { id: "a", text: "Para ordenar los datos automáticamente", isCorrect: false },
        { id: "b", text: "Para acelerar las búsquedas y queries de lectura a costa de mayor uso de almacenamiento", isCorrect: true },
        { id: "c", text: "Para evitar datos duplicados (eso es UNIQUE constraint)", isCorrect: false },
        { id: "d", text: "Para reducir el tamaño de la base de datos", isCorrect: false },
      ],
      explanation: "Los índices crean estructuras de datos (B-tree, hash) que permiten buscar filas sin escanear toda la tabla. Aceleran SELECT pero ralentizan INSERT/UPDATE/DELETE porque el índice debe actualizarse.",
    },
  ],
};

// ============================================================
// TEMPLATE 3: LÓGICA Y RESOLUCIÓN DE PROBLEMAS
// ============================================================
const logicaProgramacion: TemplateSeed = {
  title: "Lógica y Resolución de Problemas",
  slug: "logica-resolucion-problemas",
  description: "Evalúa capacidad de análisis, pensamiento lógico y resolución de problemas aplicados a programación.",
  type: "MCQ",
  difficulty: "JUNIOR",
  passingScore: 65,
  timeLimit: 20,
  sections: [
    { name: "Lógica Básica", questions: 4 },
    { name: "Algoritmos", questions: 4 },
    { name: "Complejidad y Estructuras", questions: 4 },
  ],
  questions: [
    // ── Lógica Básica ──
    {
      section: "Lógica Básica",
      difficulty: "JUNIOR",
      tags: ["lógica", "booleanos"],
      questionText: "¿Cuál de estas expresiones es verdadera si `x = 5` y `y = 10`?",
      options: [
        { id: "a", text: "x > y && x > 0", isCorrect: false },
        { id: "b", text: "x < y && y > 0", isCorrect: true },
        { id: "c", text: "x === y || x < 0", isCorrect: false },
        { id: "d", text: "x >= y", isCorrect: false },
      ],
      explanation: "`x < y` (5 < 10) es true. `y > 0` (10 > 0) es true. `true && true` = true.",
    },
    {
      section: "Lógica Básica",
      difficulty: "JUNIOR",
      tags: ["recursión"],
      questionText: "¿Qué devuelve esta función con `factorial(4)`?\n```js\nfunction factorial(n) {\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}\n```",
      codeSnippet: "function factorial(n) {\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}",
      options: [
        { id: "a", text: "8", isCorrect: false },
        { id: "b", text: "24", isCorrect: true },
        { id: "c", text: "16", isCorrect: false },
        { id: "d", text: "Infinite loop", isCorrect: false },
      ],
      explanation: "4! = 4 × 3! = 4 × 3 × 2! = 4 × 3 × 2 × 1! = 4 × 3 × 2 × 1 = 24.",
    },
    {
      section: "Lógica Básica",
      difficulty: "JUNIOR",
      tags: ["loops", "lógica"],
      questionText: "¿Cuántas veces se imprime 'hola'?\n```js\nfor (let i = 0; i < 5; i += 2) {\n  console.log('hola');\n}\n```",
      codeSnippet: "for (let i = 0; i < 5; i += 2) {\n  console.log('hola');\n}",
      options: [
        { id: "a", text: "5 veces", isCorrect: false },
        { id: "b", text: "3 veces", isCorrect: true },
        { id: "c", text: "2 veces", isCorrect: false },
        { id: "d", text: "4 veces", isCorrect: false },
      ],
      explanation: "i toma valores 0, 2, 4 (3 iteraciones). Cuando i=6, la condición i<5 es falsa y el loop termina.",
    },
    {
      section: "Lógica Básica",
      difficulty: "MID",
      tags: ["binary", "lógica"],
      questionText: "¿Cuál es el valor decimal del número binario `1010`?",
      options: [
        { id: "a", text: "8", isCorrect: false },
        { id: "b", text: "10", isCorrect: true },
        { id: "c", text: "12", isCorrect: false },
        { id: "d", text: "6", isCorrect: false },
      ],
      explanation: "1010 en binario = 1×2³ + 0×2² + 1×2¹ + 0×2⁰ = 8 + 0 + 2 + 0 = 10.",
    },

    // ── Algoritmos ──
    {
      section: "Algoritmos",
      difficulty: "JUNIOR",
      tags: ["búsqueda", "algoritmos"],
      questionText: "¿Cuál es la complejidad temporal de buscar un elemento en un array no ordenado?",
      options: [
        { id: "a", text: "O(log n)", isCorrect: false },
        { id: "b", text: "O(n)", isCorrect: true },
        { id: "c", text: "O(1)", isCorrect: false },
        { id: "d", text: "O(n²)", isCorrect: false },
      ],
      explanation: "En el peor caso hay que revisar todos los elementos (búsqueda lineal). O(n) significa que el tiempo crece proporcionalmente al tamaño del array.",
    },
    {
      section: "Algoritmos",
      difficulty: "MID",
      tags: ["ordenamiento", "algoritmos"],
      questionText: "¿Cuál algoritmo de ordenamiento tiene mejor complejidad promedio?",
      options: [
        { id: "a", text: "Bubble Sort — O(n²)", isCorrect: false },
        { id: "b", text: "Quick Sort / Merge Sort — O(n log n)", isCorrect: true },
        { id: "c", text: "Selection Sort — O(n²)", isCorrect: false },
        { id: "d", text: "Insertion Sort — O(n²)", isCorrect: false },
      ],
      explanation: "Quick Sort y Merge Sort tienen complejidad promedio O(n log n), que es óptima para comparaciones. Bubble, Selection e Insertion Sort son O(n²) y solo son eficientes para datasets pequeños.",
    },
    {
      section: "Algoritmos",
      difficulty: "MID",
      tags: ["búsqueda-binaria", "algoritmos"],
      questionText: "¿Cuál es el prerrequisito para usar búsqueda binaria?",
      options: [
        { id: "a", text: "El array debe tener longitud par", isCorrect: false },
        { id: "b", text: "El array debe estar ordenado", isCorrect: true },
        { id: "c", text: "Los elementos deben ser numéricos", isCorrect: false },
        { id: "d", text: "El array no debe tener duplicados", isCorrect: false },
      ],
      explanation: "La búsqueda binaria divide el problema a la mitad en cada paso (O(log n)), pero requiere que el array esté ordenado para poder descartar la mitad correcta.",
    },
    {
      section: "Algoritmos",
      difficulty: "MID",
      tags: ["strings", "algoritmos"],
      questionText: "¿Cómo verificarías si un string es un palíndromo (se lee igual al revés)?",
      options: [
        { id: "a", text: "Comparar el string con su reverso", isCorrect: true },
        { id: "b", text: "Contar las vocales", isCorrect: false },
        { id: "c", text: "Verificar que todos los caracteres sean únicos", isCorrect: false },
        { id: "d", text: "Comprobar que tenga longitud par", isCorrect: false },
      ],
      explanation: "La forma más directa es `str === str.split('').reverse().join('')`. Alternativamente, usar dos punteros desde los extremos comparando caracteres hacia el centro.",
    },

    // ── Complejidad y Estructuras ──
    {
      section: "Complejidad y Estructuras",
      difficulty: "MID",
      tags: ["estructuras-datos", "stack"],
      questionText: "¿Qué estructura de datos sigue el principio LIFO (Last In, First Out)?",
      options: [
        { id: "a", text: "Queue (Cola)", isCorrect: false },
        { id: "b", text: "Stack (Pila)", isCorrect: true },
        { id: "c", text: "Linked List", isCorrect: false },
        { id: "d", text: "Binary Tree", isCorrect: false },
      ],
      explanation: "Una Stack/Pila sigue LIFO: el último elemento en entrar es el primero en salir. Como una pila de platos. Una Queue sigue FIFO (primero en entrar, primero en salir).",
    },
    {
      section: "Complejidad y Estructuras",
      difficulty: "MID",
      tags: ["hash-map", "complejidad"],
      questionText: "¿Cuál es la complejidad promedio para buscar un elemento en un HashMap/objeto?",
      options: [
        { id: "a", text: "O(n)", isCorrect: false },
        { id: "b", text: "O(1)", isCorrect: true },
        { id: "c", text: "O(log n)", isCorrect: false },
        { id: "d", text: "O(n²)", isCorrect: false },
      ],
      explanation: "Los HashMaps usan una función hash para mapear claves a índices directamente. En promedio, buscar/insertar/eliminar es O(1). En el peor caso (colisiones) puede degradarse a O(n).",
    },
    {
      section: "Complejidad y Estructuras",
      difficulty: "SENIOR",
      tags: ["complejidad", "big-o"],
      questionText: "¿Qué complejidad tiene este algoritmo?\n```js\nfor (let i = 0; i < n; i++) {\n  for (let j = 0; j < n; j++) {\n    console.log(i, j);\n  }\n}\n```",
      codeSnippet: "for (let i = 0; i < n; i++) {\n  for (let j = 0; j < n; j++) {\n    console.log(i, j);\n  }\n}",
      options: [
        { id: "a", text: "O(n)", isCorrect: false },
        { id: "b", text: "O(n²)", isCorrect: true },
        { id: "c", text: "O(2n)", isCorrect: false },
        { id: "d", text: "O(log n)", isCorrect: false },
      ],
      explanation: "Dos loops anidados que cada uno corre n veces = n × n = n² operaciones. O(n²) crece cuadráticamente y es ineficiente para n grandes.",
    },
    {
      section: "Complejidad y Estructuras",
      difficulty: "MID",
      tags: ["recursión", "memorization"],
      questionText: "¿Qué técnica mejora la eficiencia de algoritmos recursivos guardando resultados de subproblemas ya calculados?",
      options: [
        { id: "a", text: "Recursión de cola (tail recursion)", isCorrect: false },
        { id: "b", text: "Memoización / Dynamic Programming", isCorrect: true },
        { id: "c", text: "Divide y vencerás", isCorrect: false },
        { id: "d", text: "Greedy algorithms", isCorrect: false },
      ],
      explanation: "La memoización guarda los resultados de llamadas con los mismos argumentos para no recalcularlos. Es la base de Dynamic Programming y convierte algoritmos exponenciales en polinomiales.",
    },
  ],
};

// ============================================================
// TEMPLATE 4: TYPESCRIPT / REACT (MID LEVEL)
// ============================================================
const typescriptReact: TemplateSeed = {
  title: "TypeScript & React",
  slug: "typescript-react",
  description: "Evalúa conocimientos de TypeScript y React para posiciones frontend de nivel medio.",
  type: "MCQ",
  difficulty: "MID",
  passingScore: 70,
  timeLimit: 25,
  sections: [
    { name: "TypeScript", questions: 5 },
    { name: "React Fundamentos", questions: 5 },
    { name: "React Avanzado", questions: 5 },
  ],
  questions: [
    // ── TypeScript ──
    {
      section: "TypeScript",
      difficulty: "MID",
      tags: ["typescript", "tipos"],
      questionText: "¿Cuál es la diferencia entre `interface` y `type` en TypeScript?",
      options: [
        { id: "a", text: "Son exactamente iguales y se pueden usar indistintamente", isCorrect: false },
        { id: "b", text: "`interface` puede extenderse y mergearse; `type` es más flexible para unions e intersecciones", isCorrect: true },
        { id: "c", text: "`type` solo sirve para tipos primitivos", isCorrect: false },
        { id: "d", text: "`interface` no puede tener métodos", isCorrect: false },
      ],
      explanation: "Las `interface` soportan declaration merging (múltiples declaraciones se combinan) y son mejores para shapes de objetos. `type` es más flexible para union types (`string | number`), tuplas, y tipos complejos.",
    },
    {
      section: "TypeScript",
      difficulty: "MID",
      tags: ["typescript", "generics"],
      questionText: "¿Qué hace el tipo genérico `<T>` en TypeScript?",
      options: [
        { id: "a", text: "Es un placeholder que se reemplaza con un tipo concreto al usar la función/clase", isCorrect: true },
        { id: "b", text: "Indica que el valor puede ser de cualquier tipo (como `any`)", isCorrect: false },
        { id: "c", text: "Solo sirve para arrays", isCorrect: false },
        { id: "d", text: "`T` siempre representa un string", isCorrect: false },
      ],
      explanation: "Los generics permiten crear código reutilizable con tipos parametrizados. `function identity<T>(arg: T): T` puede usarse con cualquier tipo y TypeScript infiere o verifica el tipo correcto.",
    },
    {
      section: "TypeScript",
      difficulty: "MID",
      tags: ["typescript", "utility-types"],
      questionText: "¿Qué hace `Partial<User>` en TypeScript?",
      options: [
        { id: "a", text: "Hace que todas las propiedades de User sean opcionales", isCorrect: true },
        { id: "b", text: "Hace que todas las propiedades de User sean requeridas", isCorrect: false },
        { id: "c", text: "Crea un subset aleatorio de User", isCorrect: false },
        { id: "d", text: "Elimina las propiedades null de User", isCorrect: false },
      ],
      explanation: "`Partial<T>` convierte todas las propiedades en opcionales (`?`). Útil para tipos de actualización donde solo algunos campos cambian. Lo opuesto es `Required<T>`.",
    },
    {
      section: "TypeScript",
      difficulty: "MID",
      tags: ["typescript", "union-types"],
      questionText: "¿Cómo defines que una variable puede ser `string` o `number`?",
      options: [
        { id: "a", text: "let x: string & number", isCorrect: false },
        { id: "b", text: "let x: string | number", isCorrect: true },
        { id: "c", text: "let x: (string)(number)", isCorrect: false },
        { id: "d", text: "let x: any", isCorrect: false },
      ],
      explanation: "El operador `|` crea un union type. `string | number` significa que la variable puede ser cualquiera de los dos. `&` crea intersection types (la variable debe ser ambos a la vez).",
    },
    {
      section: "TypeScript",
      difficulty: "SENIOR",
      tags: ["typescript", "narrowing"],
      questionText: "¿Qué es type narrowing en TypeScript?",
      options: [
        { id: "a", text: "Reducir el número de tipos permitidos por una variable a través de checks", isCorrect: true },
        { id: "b", text: "Convertir un tipo a otro (casting)", isCorrect: false },
        { id: "c", text: "Eliminar propiedades opcionales", isCorrect: false },
        { id: "d", text: "Hacer un tipo más estricto con `strict: true`", isCorrect: false },
      ],
      explanation: "Type narrowing ocurre cuando TypeScript deduce un tipo más específico dentro de un bloque condicional. Por ejemplo, después de `if (typeof x === 'string')`, TypeScript sabe que x es string en ese bloque.",
    },

    // ── React Fundamentos ──
    {
      section: "React Fundamentos",
      difficulty: "MID",
      tags: ["react", "hooks"],
      questionText: "¿Cuándo se ejecuta el callback de `useEffect` con un array de dependencias vacío `[]`?",
      options: [
        { id: "a", text: "En cada re-render", isCorrect: false },
        { id: "b", text: "Solo una vez después del primer render (componentDidMount)", isCorrect: true },
        { id: "c", text: "Solo cuando el componente se desmonta", isCorrect: false },
        { id: "d", text: "Nunca se ejecuta", isCorrect: false },
      ],
      explanation: "`useEffect(() => {}, [])` se ejecuta una sola vez después del primer render. Es el equivalente de `componentDidMount`. Sin el array, se ejecuta en cada render.",
    },
    {
      section: "React Fundamentos",
      difficulty: "MID",
      tags: ["react", "state"],
      questionText: "¿Por qué no se debe mutar el estado directamente en React?",
      options: [
        { id: "a", text: "Por razones de performance únicamente", isCorrect: false },
        { id: "b", text: "Porque React no detecta la mutación y no re-renderiza el componente", isCorrect: true },
        { id: "c", text: "Es solo una convención de estilo", isCorrect: false },
        { id: "d", text: "Porque el estado es inmutable por JavaScript", isCorrect: false },
      ],
      explanation: "React detecta cambios de estado por referencia. Si mutas directamente (`state.arr.push(item)`), la referencia no cambia y React no sabe que debe re-renderizar. Siempre usar `setState` con un nuevo objeto.",
    },
    {
      section: "React Fundamentos",
      difficulty: "MID",
      tags: ["react", "keys"],
      questionText: "¿Por qué es importante el prop `key` al renderizar listas en React?",
      options: [
        { id: "a", text: "Es solo decorativo y React lo ignora", isCorrect: false },
        { id: "b", text: "Permite a React identificar qué elementos cambiaron, se agregaron o eliminaron eficientemente", isCorrect: true },
        { id: "c", text: "Es requerido para que los eventos funcionen", isCorrect: false },
        { id: "d", text: "Se usa para ordenar los elementos", isCorrect: false },
      ],
      explanation: "`key` ayuda al algoritmo de reconciliación de React a identificar elementos únicos en listas. Sin keys estables, React puede re-renderizar innecesariamente o mostrar estados incorrectos.",
    },
    {
      section: "React Fundamentos",
      difficulty: "MID",
      tags: ["react", "props"],
      questionText: "¿Qué es prop drilling y por qué puede ser problemático?",
      options: [
        { id: "a", text: "Pasar props directamente a un componente hijo — no es problemático", isCorrect: false },
        { id: "b", text: "Pasar props a través de múltiples niveles de componentes que no los necesitan", isCorrect: true },
        { id: "c", text: "Usar demasiados hooks en un componente", isCorrect: false },
        { id: "d", text: "Renderizar componentes dentro de un loop", isCorrect: false },
      ],
      explanation: "Prop drilling ocurre cuando debes pasar props a través de muchos niveles intermedios que no usan esos datos. Hace el código difícil de mantener. Soluciones: Context API, Redux, Zustand.",
    },
    {
      section: "React Fundamentos",
      difficulty: "MID",
      tags: ["react", "controlled-components"],
      questionText: "¿Qué es un controlled component en React?",
      options: [
        { id: "a", text: "Un componente que no acepta props", isCorrect: false },
        { id: "b", text: "Un input cuyo valor está controlado por el estado de React mediante `value` y `onChange`", isCorrect: true },
        { id: "c", text: "Un componente protegido con error boundaries", isCorrect: false },
        { id: "d", text: "Un componente que usa `forwardRef`", isCorrect: false },
      ],
      explanation: "En un controlled component, React controla el valor del input. Se pasa `value={state}` y `onChange` que actualiza el estado. Lo opuesto es un uncontrolled component que usa `defaultValue` y refs.",
    },

    // ── React Avanzado ──
    {
      section: "React Avanzado",
      difficulty: "SENIOR",
      tags: ["react", "useMemo"],
      questionText: "¿Cuándo deberías usar `useMemo`?",
      options: [
        { id: "a", text: "En todos los componentes siempre para maximizar performance", isCorrect: false },
        { id: "b", text: "Cuando tienes un cálculo computacionalmente costoso que no debe recalcularse en cada render", isCorrect: true },
        { id: "c", text: "Para memorizar funciones (eso es `useCallback`)", isCorrect: false },
        { id: "d", text: "Para reemplazar `useState`", isCorrect: false },
      ],
      explanation: "`useMemo` memoriza el resultado de una función. Úsalo cuando el cálculo es costoso y las dependencias no cambian frecuentemente. Usarlo en exceso añade overhead y complejidad sin beneficio.",
    },
    {
      section: "React Avanzado",
      difficulty: "SENIOR",
      tags: ["react", "context"],
      questionText: "¿Cuál es el problema de rendimiento al usar Context API con valores que cambian frecuentemente?",
      options: [
        { id: "a", text: "No hay problema, Context es siempre eficiente", isCorrect: false },
        { id: "b", text: "Todos los componentes que consumen el context se re-renderizan cuando el valor cambia", isCorrect: true },
        { id: "c", text: "Context solo puede almacenar strings", isCorrect: false },
        { id: "d", text: "Context no funciona con hooks", isCorrect: false },
      ],
      explanation: "Cuando el valor del context cambia, TODOS los componentes que lo consumen (useContext) se re-renderizan, incluso si no usan la parte que cambió. Para valores frecuentes, considerar Zustand o dividir el context.",
    },
    {
      section: "React Avanzado",
      difficulty: "SENIOR",
      tags: ["react", "suspense"],
      questionText: "¿Para qué sirve `React.Suspense`?",
      options: [
        { id: "a", text: "Para manejar errores en componentes", isCorrect: false },
        { id: "b", text: "Para mostrar un fallback mientras un componente lazy o datos se cargan", isCorrect: true },
        { id: "c", text: "Para pausar la ejecución del componente", isCorrect: false },
        { id: "d", text: "Para renderizar componentes en el servidor", isCorrect: false },
      ],
      explanation: "`Suspense` muestra un fallback (loading state) mientras espera que un componente lazy (`React.lazy()`) o una promesa (con React 18+ y use()) se resuelva. Error boundaries manejan errores.",
    },
    {
      section: "React Avanzado",
      difficulty: "SENIOR",
      tags: ["react", "server-components"],
      questionText: "¿Cuál es la diferencia principal entre React Server Components y Client Components?",
      options: [
        { id: "a", text: "Solo el nombre es diferente, funcionan igual", isCorrect: false },
        { id: "b", text: "Server Components se renderizan en el servidor sin enviar JS al cliente; Client Components son interactivos y se hidratan en el browser", isCorrect: true },
        { id: "c", text: "Server Components pueden usar useState y useEffect", isCorrect: false },
        { id: "d", text: "Client Components no pueden fetchear datos", isCorrect: false },
      ],
      explanation: "Server Components se renderizan exclusivamente en el servidor, reducen el bundle JS y pueden acceder directamente a bases de datos. Client Components (marcados con 'use client') son interactivos pero se envían al browser.",
    },
    {
      section: "React Avanzado",
      difficulty: "MID",
      tags: ["react", "useReducer"],
      questionText: "¿Cuándo preferirías `useReducer` sobre `useState`?",
      options: [
        { id: "a", text: "Cuando el estado es un string simple", isCorrect: false },
        { id: "b", text: "Cuando el estado es complejo con múltiples sub-valores o las transiciones siguen una lógica definida", isCorrect: true },
        { id: "c", text: "`useReducer` siempre es mejor que `useState`", isCorrect: false },
        { id: "d", text: "Cuando necesitas persistir el estado en localStorage", isCorrect: false },
      ],
      explanation: "`useReducer` es preferible cuando: el estado tiene múltiples campos relacionados, las actualizaciones dependen del estado anterior, o la lógica de transición es compleja. `useState` es suficiente para valores simples e independientes.",
    },
  ],
};

// ============================================================
// SEEDER INTERNO
// ============================================================
async function upsertTemplate(seed: TemplateSeed) {
  console.log(`\n📦 Procesando: ${seed.title}`);

  const template = await prisma.assessmentTemplate.upsert({
    where: { slug: seed.slug },
    update: {
      title: seed.title,
      description: seed.description,
      type: seed.type,
      difficulty: seed.difficulty,
      totalQuestions: seed.questions.length,
      passingScore: seed.passingScore,
      timeLimit: seed.timeLimit,
      sections: seed.sections,
      isActive: true,
      updatedAt: new Date(),
    },
    create: {
      title: seed.title,
      slug: seed.slug,
      description: seed.description,
      type: seed.type,
      difficulty: seed.difficulty,
      totalQuestions: seed.questions.length,
      passingScore: seed.passingScore,
      timeLimit: seed.timeLimit,
      sections: seed.sections,
      shuffleQuestions: true,
      allowRetry: false,
      maxAttempts: 1,
      penalizeWrong: false,
      isActive: true,
    },
  });

  console.log(`  ✅ Template ${template.id} (${seed.slug})`);

  let created = 0;
  let updated = 0;

  for (const q of seed.questions) {
    const existing = await prisma.assessmentQuestion.findFirst({
      where: { templateId: template.id, questionText: q.questionText },
    });

    if (existing) {
      await prisma.assessmentQuestion.update({
        where: { id: existing.id },
        data: {
          section: q.section,
          difficulty: q.difficulty,
          tags: q.tags,
          codeSnippet: q.codeSnippet ?? null,
          options: q.options,
          allowMultiple: q.allowMultiple ?? false,
          explanation: q.explanation ?? null,
          type: q.type ?? "MULTIPLE_CHOICE",
          isActive: true,
          updatedAt: new Date(),
        },
      });
      updated++;
    } else {
      await prisma.assessmentQuestion.create({
        data: {
          templateId: template.id,
          section: q.section,
          difficulty: q.difficulty,
          tags: q.tags,
          questionText: q.questionText,
          codeSnippet: q.codeSnippet ?? null,
          options: q.options,
          allowMultiple: q.allowMultiple ?? false,
          explanation: q.explanation ?? null,
          type: q.type ?? "MULTIPLE_CHOICE",
          isActive: true,
        },
      });
      created++;
    }
  }

  console.log(`  📝 Preguntas: ${created} creadas, ${updated} actualizadas`);
  return template;
}

// ============================================================
// ✅ CAMBIO 1: export para usar desde prisma/seed.ts
// ============================================================
export async function seedAssessmentTemplates() {
  console.log("🚀 Seeding assessment templates...\n");

  const templates = [
    javascriptJunior,
    sqlFundamentos,
    logicaProgramacion,
    typescriptReact,
  ];

  const results = [];
  for (const t of templates) {
    const template = await upsertTemplate(t);
    results.push({ slug: t.slug, id: template.id, questions: t.questions.length });
  }

  console.log("\n✨ Assessment templates completados:");
  console.table(results);
  return results;
}

// ============================================================
// ✅ CAMBIO 2 y 3: ejecución directa sigue funcionando
// ============================================================
if (require.main === module) {
  seedAssessmentTemplates()
    .catch((e) => {
      console.error("❌ Error en seed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}