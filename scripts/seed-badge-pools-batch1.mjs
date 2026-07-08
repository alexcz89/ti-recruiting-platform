// scripts/seed-badge-pools-batch1.mjs
// Tanda 1 de contenido para certificaciones (#17): JavaScript, Python y SQL
// nivel Básico. Pools de 24 preguntas; el examen sortea 12 por intento.
//
// Los templates se crean como globales activos SIN marcar como badge:
// la aprobación humana es marcarlos en /dashboard/admin/templates
// (columna Badge) después de revisar cada pool.
//
// Idempotente por slug. Uso: node scripts/seed-badge-pools-batch1.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// opts: [texto, esCorrecta]
const q = (section, text, opts, explanation, tags, code = null) => ({
  section,
  questionText: text,
  codeSnippet: code,
  options: opts.map(([t, ok], i) => ({
    id: "abcde"[i],
    text: t,
    isCorrect: Boolean(ok),
  })),
  allowMultiple: opts.filter(([, ok]) => ok).length > 1,
  explanation,
  tags,
});

const POOLS = [
  {
    slug: "badge-javascript-basico",
    title: "Certificación JavaScript · Básico",
    termSlug: "javascript",
    description:
      "Fundamentos de JavaScript: tipos, funciones, arrays, objetos y nociones de asincronía. Al aprobar obtienes el badge verificado JavaScript · Básico.",
    sections: ["Fundamentos", "Funciones y objetos", "Arrays y asincronía"],
    questions: [
      q("Fundamentos", "¿Qué imprime console.log(typeof null)?", [
        ["\"null\"", false],
        ["\"object\"", true],
        ["\"undefined\"", false],
        ["Lanza un error", false],
      ], "Es un comportamiento histórico del lenguaje: typeof null devuelve \"object\".", ["javascript", "tipos"]),
      q("Fundamentos", "¿Cuál es la diferencia principal entre let y const?", [
        ["const no permite reasignar la variable; let sí", true],
        ["let es global y const es local", false],
        ["const hace el valor inmutable en profundidad", false],
        ["No hay diferencia, son alias", false],
      ], "const impide la reasignación de la referencia, pero el contenido de un objeto const sí puede mutar.", ["javascript", "variables"]),
      q("Fundamentos", "¿Qué evalúa la expresión \"5\" == 5?", [
        ["true", true],
        ["false", false],
        ["undefined", false],
        ["Lanza TypeError", false],
      ], "== aplica coerción de tipos: la cadena \"5\" se convierte a número antes de comparar. Con === el resultado sería false.", ["javascript", "operadores"]),
      q("Fundamentos", "¿Qué evalúa NaN === NaN?", [
        ["true", false],
        ["false", true],
        ["NaN", false],
        ["Lanza un error", false],
      ], "NaN es el único valor de JavaScript que no es igual a sí mismo. Para detectarlo se usa Number.isNaN().", ["javascript", "tipos"]),
      q("Fundamentos", "¿Qué imprime este código?", [
        ["undefined", true],
        ["ReferenceError", false],
        ["5", false],
        ["null", false],
      ], "Las declaraciones var se elevan (hoisting) con valor undefined; la asignación ocurre después del console.log.", ["javascript", "hoisting"], "console.log(x);\nvar x = 5;"),
      q("Fundamentos", "¿Cuál es la sintaxis correcta de un template literal?", [
        ["`Hola ${nombre}`", true],
        ["\"Hola ${nombre}\"", false],
        ["'Hola #{nombre}'", false],
        ["`Hola {{nombre}}`", false],
      ], "Los template literals usan backticks (`) e interpolan con ${expresión}.", ["javascript", "strings"]),
      q("Fundamentos", "¿Cuáles de estos valores son falsy en JavaScript?", [
        ["\"\" (cadena vacía)", true],
        ["0", true],
        ["\"0\" (cadena con cero)", false],
        ["[] (array vacío)", false],
      ], "Los falsy son: false, 0, \"\", null, undefined y NaN. La cadena \"0\" y el array vacío son truthy.", ["javascript", "tipos"]),
      q("Fundamentos", "¿Qué hace el operador ?? (nullish coalescing)?", [
        ["Devuelve el operando derecho solo si el izquierdo es null o undefined", true],
        ["Devuelve el operando derecho si el izquierdo es cualquier falsy", false],
        ["Compara sin coerción de tipos", false],
        ["Encadena accesos a propiedades opcionales", false],
      ], "A diferencia de ||, el operador ?? solo cae al segundo valor con null/undefined — 0 y \"\" se conservan.", ["javascript", "operadores"]),
      q("Fundamentos", "¿Cuál es el alcance (scope) de una variable declarada con let dentro de un bloque if?", [
        ["Solo el bloque donde fue declarada", true],
        ["Toda la función", false],
        ["Todo el archivo", false],
        ["El objeto global", false],
      ], "let y const tienen alcance de bloque; var tiene alcance de función.", ["javascript", "scope"]),
      q("Funciones y objetos", "¿Qué característica distingue a las arrow functions?", [
        ["No tienen su propio this; lo heredan del contexto donde se definen", true],
        ["Se ejecutan siempre de forma asíncrona", false],
        ["Solo pueden retornar valores primitivos", false],
        ["Crean su propio this en cada llamada", false],
      ], "Las arrow functions capturan el this léxico del entorno; por eso no sirven como métodos que dependan de this dinámico.", ["javascript", "funciones"]),
      q("Funciones y objetos", "¿Qué imprime este código?", [
        ["10", true],
        ["undefined", false],
        ["NaN", false],
        ["Error de sintaxis", false],
      ], "La desestructuración extrae la propiedad a del objeto: a vale 10.", ["javascript", "destructuring"], "const { a } = { a: 10, b: 20 };\nconsole.log(a);"),
      q("Funciones y objetos", "¿Qué hace el operador spread (...) en [...arr1, ...arr2]?", [
        ["Crea un nuevo array con los elementos de ambos arrays", true],
        ["Crea un array de arrays anidados", false],
        ["Suma los elementos numéricos de ambos", false],
        ["Modifica arr1 agregándole arr2", false],
      ], "Spread expande los elementos: es la forma idiomática de concatenar o copiar arrays sin mutar los originales.", ["javascript", "arrays"]),
      q("Funciones y objetos", "¿Cómo se accede a una propiedad de objeto cuyo nombre está en una variable clave?", [
        ["obj[clave]", true],
        ["obj.clave", false],
        ["obj->clave", false],
        ["obj::clave", false],
      ], "La notación de corchetes evalúa la expresión; la notación de punto busca literalmente la propiedad llamada \"clave\".", ["javascript", "objetos"]),
      q("Funciones y objetos", "¿Qué devuelve JSON.parse('{\"x\":1}')?", [
        ["Un objeto JavaScript { x: 1 }", true],
        ["Una cadena de texto", false],
        ["Un Map con la clave x", false],
        ["undefined", false],
      ], "JSON.parse convierte una cadena JSON en su valor JavaScript; JSON.stringify hace lo inverso.", ["javascript", "json"]),
      q("Funciones y objetos", "¿Qué imprime este código?", [
        ["3", true],
        ["undefined", false],
        ["1", false],
        ["Error", false],
      ], "Los parámetros con valor por defecto se usan cuando el argumento es undefined: suma(1) equivale a suma(1, 2).", ["javascript", "funciones"], "function suma(a, b = 2) {\n  return a + b;\n}\nconsole.log(suma(1));"),
      q("Funciones y objetos", "¿Qué devuelve Object.keys({ a: 1, b: 2 })?", [
        ["[\"a\", \"b\"]", true],
        ["[1, 2]", false],
        ["[[\"a\", 1], [\"b\", 2]]", false],
        ["{ a, b }", false],
      ], "Object.keys devuelve un array con los nombres de las propiedades; Object.values devuelve los valores.", ["javascript", "objetos"]),
      q("Arrays y asincronía", "¿Cuál es la diferencia entre map() y forEach()?", [
        ["map devuelve un nuevo array; forEach devuelve undefined", true],
        ["forEach es más rápido y devuelve un array", false],
        ["map modifica el array original", false],
        ["Son idénticos", false],
      ], "map transforma y devuelve un nuevo array del mismo tamaño; forEach solo itera con efectos secundarios.", ["javascript", "arrays"]),
      q("Arrays y asincronía", "¿Qué imprime este código?", [
        ["[2, 4]", true],
        ["[1, 2, 3, 4]", false],
        ["[1, 3]", false],
        ["2", false],
      ], "filter conserva los elementos donde el callback devuelve true: los pares 2 y 4.", ["javascript", "arrays"], "const r = [1, 2, 3, 4].filter(n => n % 2 === 0);\nconsole.log(r);"),
      q("Arrays y asincronía", "¿Qué devuelve el método push() de un array?", [
        ["La nueva longitud del array", true],
        ["El elemento agregado", false],
        ["El array modificado", false],
        ["undefined", false],
      ], "push agrega al final y devuelve la nueva longitud — un clásico que sorprende en code reviews.", ["javascript", "arrays"]),
      q("Arrays y asincronía", "¿Cuáles son los tres estados posibles de una Promise?", [
        ["pending, fulfilled, rejected", true],
        ["start, running, done", false],
        ["open, closed, error", false],
        ["waiting, success, failure", false],
      ], "Una Promise nace pending y se establece una sola vez en fulfilled (resuelta) o rejected (rechazada).", ["javascript", "promesas"]),
      q("Arrays y asincronía", "¿Qué imprime este código?", [
        ["1 3 2", true],
        ["1 2 3", false],
        ["3 2 1", false],
        ["2 1 3", false],
      ], "setTimeout con 0ms va a la cola de tareas: el código síncrono (1 y 3) se ejecuta antes que el callback (2).", ["javascript", "event-loop"], "console.log(1);\nsetTimeout(() => console.log(2), 0);\nconsole.log(3);"),
      q("Arrays y asincronía", "¿Dónde puede usarse la palabra clave await?", [
        ["Dentro de funciones async (o en top-level de módulos ES)", true],
        ["En cualquier función", false],
        ["Solo dentro de callbacks", false],
        ["Solo en el objeto window", false],
      ], "await pausa la ejecución hasta que la Promise se resuelva y requiere contexto async.", ["javascript", "async"]),
      q("Arrays y asincronía", "¿Qué devuelve [1, 2, 3].includes(2)?", [
        ["true", true],
        ["1 (el índice)", false],
        ["[2]", false],
        ["undefined", false],
      ], "includes devuelve booleano; indexOf devolvería el índice (1 en este caso).", ["javascript", "arrays"]),
      q("Arrays y asincronía", "¿Cuál es la forma correcta de verificar si una variable es un array?", [
        ["Array.isArray(x)", true],
        ["typeof x === \"array\"", false],
        ["x instanceof Object", false],
        ["x.length !== undefined", false],
      ], "typeof de un array devuelve \"object\"; Array.isArray es la verificación confiable.", ["javascript", "arrays"]),
    ],
  },
  {
    slug: "badge-python-basico",
    title: "Certificación Python · Básico",
    termSlug: "python",
    description:
      "Fundamentos de Python: tipos, colecciones, control de flujo, funciones y manejo de errores. Al aprobar obtienes el badge verificado Python · Básico.",
    sections: ["Fundamentos", "Colecciones", "Funciones y errores"],
    questions: [
      q("Fundamentos", "¿Qué tipo de dato devuelve 5 / 2 en Python 3?", [
        ["float (2.5)", true],
        ["int (2)", false],
        ["Decimal", false],
        ["Lanza error por tipos mezclados", false],
      ], "En Python 3, / siempre devuelve float. La división entera se hace con //.", ["python", "operadores"]),
      q("Fundamentos", "¿Qué devuelve 7 // 2?", [
        ["3", true],
        ["3.5", false],
        ["4", false],
        ["1", false],
      ], "// es división entera (floor division): descarta la parte decimal hacia abajo.", ["python", "operadores"]),
      q("Fundamentos", "¿Cómo se delimitan los bloques de código en Python?", [
        ["Con indentación", true],
        ["Con llaves { }", false],
        ["Con palabras begin/end", false],
        ["Con paréntesis", false],
      ], "La indentación es sintaxis en Python: un bloque mal indentado es IndentationError.", ["python", "sintaxis"]),
      q("Fundamentos", "¿Qué valores produce range(3)?", [
        ["0, 1, 2", true],
        ["1, 2, 3", false],
        ["0, 1, 2, 3", false],
        ["3, 2, 1", false],
      ], "range(n) inicia en 0 y excluye n. range(1, 4) daría 1, 2, 3.", ["python", "iteracion"]),
      q("Fundamentos", "¿Qué imprime este código?", [
        ["aaa", true],
        ["a3", false],
        ["aaa aaa aaa", false],
        ["TypeError", false],
      ], "El operador * repite secuencias: \"a\" * 3 produce \"aaa\".", ["python", "strings"], 'print("a" * 3)'),
      q("Fundamentos", "¿Cuál es el valor nulo en Python?", [
        ["None", true],
        ["null", false],
        ["nil", false],
        ["undefined", false],
      ], "None es el único valor del tipo NoneType; se compara con \"is None\".", ["python", "tipos"]),
      q("Fundamentos", "¿Cuál es la diferencia entre == e is?", [
        ["== compara valores; is compara identidad (mismo objeto en memoria)", true],
        ["is compara valores; == compara identidad", false],
        ["Son intercambiables", false],
        ["is solo funciona con números", false],
      ], "Dos listas con el mismo contenido son == pero no is. Para None se recomienda \"is None\".", ["python", "operadores"]),
      q("Fundamentos", "¿Qué evalúa bool([]) (lista vacía)?", [
        ["False", true],
        ["True", false],
        ["None", false],
        ["Lanza ValueError", false],
      ], "Las colecciones vacías ([], {}, \"\", set()) son falsy; con contenido son truthy.", ["python", "tipos"]),
      q("Fundamentos", "¿Cuál es la sintaxis correcta de un f-string?", [
        ["f\"Hola {nombre}\"", true],
        ["\"Hola {nombre}\".f()", false],
        ["format\"Hola {nombre}\"", false],
        ["$\"Hola {nombre}\"", false],
      ], "El prefijo f permite interpolar expresiones dentro de llaves directamente en la cadena.", ["python", "strings"]),
      q("Colecciones", "¿Cuál es la diferencia principal entre una lista y una tupla?", [
        ["La lista es mutable; la tupla es inmutable", true],
        ["La tupla permite duplicados; la lista no", false],
        ["La lista es ordenada; la tupla no", false],
        ["No hay diferencia funcional", false],
      ], "Las tuplas no pueden modificarse tras crearse, lo que las hace usables como claves de diccionario.", ["python", "colecciones"]),
      q("Colecciones", "¿Qué ventaja tiene dict.get(\"clave\") sobre dict[\"clave\"]?", [
        ["get devuelve None (o un default) si la clave no existe, en vez de lanzar KeyError", true],
        ["get es más rápido", false],
        ["get también busca en los valores", false],
        ["Ninguna, son idénticos", false],
      ], "d[\"x\"] lanza KeyError si x no existe; d.get(\"x\", valor_default) es la alternativa segura.", ["python", "diccionarios"]),
      q("Colecciones", "¿Qué imprime este código?", [
        ["[2, 3]", true],
        ["[1, 2, 3]", false],
        ["[2, 3, 4]", false],
        ["[1, 2]", false],
      ], "El slice [1:3] toma desde el índice 1 hasta el 3 excluido: elementos en posiciones 1 y 2.", ["python", "slicing"], "nums = [1, 2, 3, 4]\nprint(nums[1:3])"),
      q("Colecciones", "¿Qué produce [x * 2 for x in range(3)]?", [
        ["[0, 2, 4]", true],
        ["[2, 4, 6]", false],
        ["[0, 1, 2, 0, 1, 2]", false],
        ["Error de sintaxis", false],
      ], "La list comprehension aplica x*2 a 0, 1 y 2: [0, 2, 4].", ["python", "comprehensions"]),
      q("Colecciones", "¿Cuál es la diferencia entre append() y extend() en listas?", [
        ["append agrega su argumento como un solo elemento; extend agrega cada elemento del iterable", true],
        ["extend agrega al inicio; append al final", false],
        ["append acepta varios argumentos; extend solo uno", false],
        ["Son sinónimos", false],
      ], "[1].append([2,3]) da [1, [2, 3]]; [1].extend([2,3]) da [1, 2, 3].", ["python", "listas"]),
      q("Colecciones", "¿Qué característica define a un set?", [
        ["No permite elementos duplicados", true],
        ["Mantiene el orden de inserción garantizado", false],
        ["Permite acceso por índice", false],
        ["Es inmutable siempre", false],
      ], "set elimina duplicados automáticamente; set([1,1,2]) es {1, 2}.", ["python", "sets"]),
      q("Colecciones", "¿Cómo se verifica si un elemento pertenece a una lista?", [
        ["elemento in lista", true],
        ["lista.contains(elemento)", false],
        ["lista.has(elemento)", false],
        ["elemento.in(lista)", false],
      ], "El operador in funciona con listas, tuplas, sets, dicts (claves) y cadenas.", ["python", "operadores"]),
      q("Colecciones", "¿Cuál es la diferencia entre sorted(lista) y lista.sort()?", [
        ["sorted devuelve una nueva lista; sort ordena in-place y devuelve None", true],
        ["sort devuelve una nueva lista; sorted ordena in-place", false],
        ["sorted solo funciona con números", false],
        ["Ninguna", false],
      ], "x = lista.sort() deja x en None — error común. sorted() no muta la original.", ["python", "listas"]),
      q("Funciones y errores", "¿Qué imprime este código?", [
        ["hola mundo", true],
        ["hola", false],
        ["TypeError: falta argumento", false],
        ["hola None", false],
      ], "El parámetro con default se usa al no pasar el argumento: saludo(\"hola\") usa b=\"mundo\".", ["python", "funciones"], 'def saludo(a, b="mundo"):\n    print(a, b)\n\nsaludo("hola")'),
      q("Funciones y errores", "¿Qué permite *args en la firma de una función?", [
        ["Recibir un número variable de argumentos posicionales como tupla", true],
        ["Recibir argumentos por nombre como diccionario", false],
        ["Hacer todos los argumentos opcionales", false],
        ["Desempaquetar diccionarios", false],
      ], "*args agrupa posicionales extra en una tupla; **kwargs agrupa los nombrados en un dict.", ["python", "funciones"]),
      q("Funciones y errores", "¿Cuál es la estructura correcta para manejar excepciones?", [
        ["try: ... except ValueError: ...", true],
        ["try: ... catch ValueError: ...", false],
        ["begin: ... rescue: ...", false],
        ["try: ... error ValueError: ...", false],
      ], "Python usa try/except (con else y finally opcionales); catch es de otros lenguajes.", ["python", "excepciones"]),
      q("Funciones y errores", "¿Qué significa que los strings sean inmutables en Python?", [
        ["No se pueden modificar en el lugar; toda operación crea una cadena nueva", true],
        ["No se pueden reasignar a otra variable", false],
        ["Solo pueden contener ASCII", false],
        ["No se pueden concatenar", false],
      ], "s[0] = \"X\" lanza TypeError; s.upper() devuelve una nueva cadena sin tocar s.", ["python", "strings"]),
      q("Funciones y errores", "¿Qué devuelve len(\"hola\")?", [
        ["4", true],
        ["5", false],
        ["3", false],
        ["Error: len no aplica a cadenas", false],
      ], "len funciona con cualquier secuencia: cadenas, listas, tuplas, dicts (número de claves).", ["python", "strings"]),
      q("Funciones y errores", "¿Qué imprime este código?", [
        ["dividiendo\nno se puede\nfin", true],
        ["dividiendo\nfin", false],
        ["ZeroDivisionError sin capturar", false],
        ["no se puede", false],
      ], "1/0 lanza ZeroDivisionError, se captura en except, y finally se ejecuta siempre.", ["python", "excepciones"], 'try:\n    print("dividiendo")\n    x = 1 / 0\nexcept ZeroDivisionError:\n    print("no se puede")\nfinally:\n    print("fin")'),
      q("Funciones y errores", "¿Cómo se importa solo la función sqrt del módulo math?", [
        ["from math import sqrt", true],
        ["import sqrt from math", false],
        ["import math.sqrt", false],
        ["using math.sqrt", false],
      ], "from módulo import nombre trae el símbolo directo; import math requiere usar math.sqrt.", ["python", "modulos"]),
    ],
  },
  {
    slug: "badge-sql-basico",
    title: "Certificación SQL · Básico",
    termSlug: "sql",
    description:
      "Fundamentos de SQL: consultas, filtros, joins, agregación y modelado básico. Al aprobar obtienes el badge verificado SQL · Básico.",
    sections: ["Consultas", "Joins y agregación", "Modelado básico"],
    questions: [
      q("Consultas", "¿Qué hace SELECT DISTINCT?", [
        ["Elimina filas duplicadas del resultado", true],
        ["Ordena el resultado", false],
        ["Selecciona solo la primera fila", false],
        ["Excluye valores NULL", false],
      ], "DISTINCT aplica sobre la combinación completa de columnas seleccionadas.", ["sql", "select"]),
      q("Consultas", "¿Cuál es la forma correcta de filtrar valores NULL?", [
        ["WHERE columna IS NULL", true],
        ["WHERE columna = NULL", false],
        ["WHERE columna == NULL", false],
        ["WHERE NULL(columna)", false],
      ], "NULL no es comparable con =: cualquier comparación con NULL da NULL (ni true ni false). Se usa IS NULL / IS NOT NULL.", ["sql", "null"]),
      q("Consultas", "¿Qué filas devuelve WHERE nombre LIKE 'A%'?", [
        ["Las que empiezan con A", true],
        ["Las que terminan con A", false],
        ["Las que contienen A en cualquier posición", false],
        ["Las que son exactamente 'A%'", false],
      ], "% es comodín de cero o más caracteres; _ es comodín de exactamente uno.", ["sql", "like"]),
      q("Consultas", "¿El operador BETWEEN 10 AND 20 incluye los extremos?", [
        ["Sí, es inclusivo en ambos extremos", true],
        ["No, excluye ambos", false],
        ["Incluye solo el 10", false],
        ["Depende del ORDER BY", false],
      ], "BETWEEN a AND b equivale a >= a AND <= b.", ["sql", "operadores"]),
      q("Consultas", "¿Qué hace ORDER BY precio DESC?", [
        ["Ordena por precio de mayor a menor", true],
        ["Ordena por precio de menor a mayor", false],
        ["Elimina la columna precio", false],
        ["Agrupa por precio", false],
      ], "DESC = descendente; el default sin especificar es ASC (ascendente).", ["sql", "order-by"]),
      q("Consultas", "¿Para qué sirve LIMIT 10 en una consulta?", [
        ["Devuelve como máximo 10 filas del resultado", true],
        ["Limita la consulta a 10 columnas", false],
        ["Limita el tiempo de ejecución a 10 segundos", false],
        ["Bloquea 10 filas para escritura", false],
      ], "LIMIT recorta el resultado; combinado con OFFSET permite paginar.", ["sql", "limit"]),
      q("Consultas", "¿Qué hace la cláusula AS en SELECT precio * 1.16 AS precio_con_iva?", [
        ["Asigna un alias a la columna calculada en el resultado", true],
        ["Crea una columna permanente en la tabla", false],
        ["Convierte el tipo de dato", false],
        ["Redondea el resultado", false],
      ], "El alias solo existe en el resultado de la consulta; no modifica la tabla.", ["sql", "alias"]),
      q("Consultas", "¿Qué devuelve WHERE estado IN ('ABIERTA', 'PAUSADA')?", [
        ["Las filas cuyo estado sea cualquiera de los valores listados", true],
        ["Las filas cuyo estado contenga esas palabras", false],
        ["Las filas con ambos estados a la vez", false],
        ["Error: IN requiere subconsulta", false],
      ], "IN equivale a una cadena de ORs: estado = 'ABIERTA' OR estado = 'PAUSADA'.", ["sql", "operadores"]),
      q("Joins y agregación", "¿Qué devuelve un INNER JOIN entre dos tablas?", [
        ["Solo las filas que tienen coincidencia en ambas tablas", true],
        ["Todas las filas de ambas tablas", false],
        ["Todas las filas de la tabla izquierda", false],
        ["El producto cartesiano completo", false],
      ], "INNER JOIN intersecta por la condición ON; sin coincidencia, la fila no aparece.", ["sql", "joins"]),
      q("Joins y agregación", "En un LEFT JOIN, ¿qué valor tienen las columnas de la tabla derecha cuando no hay coincidencia?", [
        ["NULL", true],
        ["0 o cadena vacía según el tipo", false],
        ["La fila se descarta", false],
        ["El último valor conocido", false],
      ], "LEFT JOIN conserva todas las filas de la izquierda y rellena con NULL donde no hubo match — útil para encontrar huérfanos con WHERE derecha.id IS NULL.", ["sql", "joins"]),
      q("Joins y agregación", "¿Cuál es la diferencia entre COUNT(*) y COUNT(columna)?", [
        ["COUNT(*) cuenta todas las filas; COUNT(columna) ignora los NULL de esa columna", true],
        ["COUNT(columna) es más rápido siempre", false],
        ["COUNT(*) incluye filas borradas", false],
        ["Ninguna diferencia", false],
      ], "Si la columna tiene NULLs, COUNT(columna) < COUNT(*).", ["sql", "agregacion"]),
      q("Joins y agregación", "¿Cuál es la diferencia entre WHERE y HAVING?", [
        ["WHERE filtra filas antes de agrupar; HAVING filtra grupos después de agregar", true],
        ["HAVING es un alias moderno de WHERE", false],
        ["WHERE solo funciona con números", false],
        ["HAVING filtra antes y WHERE después", false],
      ], "HAVING puede usar funciones agregadas (HAVING COUNT(*) > 5); WHERE no.", ["sql", "group-by"]),
      q("Joins y agregación", "¿Qué calcula esta consulta?", [
        ["El número de vacantes por empresa", true],
        ["El total de empresas", false],
        ["Las vacantes sin empresa", false],
        ["Error: falta WHERE", false],
      ], "GROUP BY agrupa por empresa y COUNT(*) cuenta las filas de cada grupo.", ["sql", "group-by"], "SELECT company_id, COUNT(*)\nFROM jobs\nGROUP BY company_id;"),
      q("Joins y agregación", "¿Cuál es la diferencia entre UNION y UNION ALL?", [
        ["UNION elimina duplicados; UNION ALL los conserva", true],
        ["UNION ALL elimina duplicados; UNION los conserva", false],
        ["UNION ALL une columnas en vez de filas", false],
        ["UNION requiere el mismo nombre de tablas", false],
      ], "UNION implica una deduplicación (más costosa); UNION ALL es directo y más rápido.", ["sql", "union"]),
      q("Joins y agregación", "¿Qué devuelve AVG(salario) si algunas filas tienen salario NULL?", [
        ["El promedio ignorando los NULL", true],
        ["El promedio tratando NULL como 0", false],
        ["NULL siempre", false],
        ["Un error", false],
      ], "Las funciones agregadas (AVG, SUM, MAX...) ignoran NULL — el divisor es el número de valores no nulos.", ["sql", "agregacion"]),
      q("Joins y agregación", "¿Qué es una subconsulta en WHERE id IN (SELECT ...)?", [
        ["Una consulta anidada cuyo resultado alimenta la condición externa", true],
        ["Una vista temporal permanente", false],
        ["Un join implícito obligatorio", false],
        ["Una transacción anidada", false],
      ], "La subconsulta se evalúa y la externa filtra contra su resultado.", ["sql", "subconsultas"]),
      q("Modelado básico", "¿Qué propiedades tiene una PRIMARY KEY?", [
        ["Única y no nula", true],
        ["Única, pero puede ser NULL", false],
        ["Solo numérica y autoincremental", false],
        ["Solo indica el orden físico de la tabla", false],
      ], "Una tabla tiene una sola primary key (que puede ser compuesta); implica unicidad y NOT NULL.", ["sql", "modelado"]),
      q("Modelado básico", "¿Para qué sirve una FOREIGN KEY?", [
        ["Garantizar que el valor exista en la tabla referenciada (integridad referencial)", true],
        ["Acelerar los SELECT", false],
        ["Cifrar la columna", false],
        ["Crear una copia de la otra tabla", false],
      ], "La FK impide insertar referencias huérfanas y puede definir comportamiento ON DELETE (CASCADE, SET NULL...).", ["sql", "modelado"]),
      q("Modelado básico", "¿Cuál es la sintaxis correcta para insertar una fila?", [
        ["INSERT INTO usuarios (nombre, email) VALUES ('Ana', 'ana@x.com')", true],
        ["INSERT usuarios SET nombre='Ana', email='ana@x.com'", false],
        ["ADD INTO usuarios VALUES ('Ana', 'ana@x.com')", false],
        ["INSERT VALUES ('Ana', 'ana@x.com') INTO usuarios", false],
      ], "INSERT INTO tabla (columnas) VALUES (valores) — listar las columnas evita depender del orden físico.", ["sql", "dml"]),
      q("Modelado básico", "¿Qué pasa si ejecutas UPDATE usuarios SET activo = false sin WHERE?", [
        ["Actualiza TODAS las filas de la tabla", true],
        ["No actualiza nada", false],
        ["Actualiza solo la primera fila", false],
        ["Lanza un error de sintaxis", false],
      ], "UPDATE y DELETE sin WHERE afectan toda la tabla — de los errores más costosos en producción.", ["sql", "dml"]),
      q("Modelado básico", "¿Cuál es el propósito principal de un índice?", [
        ["Acelerar las búsquedas sobre las columnas indexadas", true],
        ["Comprimir los datos de la tabla", false],
        ["Garantizar unicidad siempre", false],
        ["Ordenar físicamente la tabla en cada INSERT", false],
      ], "El índice acelera lecturas a costa de espacio y de escrituras ligeramente más lentas; solo el índice UNIQUE garantiza unicidad.", ["sql", "indices"]),
      q("Modelado básico", "¿Cuál es la diferencia entre CHAR(10) y VARCHAR(10)?", [
        ["CHAR ocupa siempre 10 caracteres (rellena); VARCHAR ocupa solo lo usado", true],
        ["VARCHAR es numérico", false],
        ["CHAR permite más de 10 si es necesario", false],
        ["Ninguna en la práctica", false],
      ], "CHAR es de longitud fija con relleno de espacios; VARCHAR es de longitud variable hasta el máximo.", ["sql", "tipos"]),
      q("Modelado básico", "¿Qué hace DELETE FROM logs WHERE fecha < '2025-01-01'?", [
        ["Borra solo las filas anteriores a esa fecha", true],
        ["Borra toda la tabla", false],
        ["Borra la columna fecha", false],
        ["Archiva las filas en otra tabla", false],
      ], "DELETE con WHERE borra las filas que cumplen la condición; TRUNCATE vaciaría la tabla completa.", ["sql", "dml"]),
      q("Modelado básico", "¿Qué devuelve esta consulta si la tabla tiene 3 vacantes con salario 10000, 20000 y NULL?", [
        ["30000", true],
        ["NULL", false],
        ["10000", false],
        ["Error", false],
      ], "SUM ignora los NULL: 10000 + 20000 = 30000.", ["sql", "agregacion"], "SELECT SUM(salario) FROM vacantes;"),
    ],
  },
];

async function main() {
  for (const pool of POOLS) {
    const term = await prisma.taxonomyTerm.findFirst({
      where: { kind: "SKILL", slug: pool.termSlug },
      select: { id: true, label: true },
    });
    if (!term) {
      console.warn(`⚠ Skill '${pool.termSlug}' no encontrado — se omite ${pool.slug}`);
      continue;
    }

    const sections = pool.sections.map((s) => ({ name: s, title: s }));

    const template = await prisma.assessmentTemplate.upsert({
      where: { slug: pool.slug },
      create: {
        slug: pool.slug,
        title: pool.title,
        description: pool.description,
        type: "MCQ",
        difficulty: "JUNIOR",
        totalQuestions: 12, // se sortean 12 del pool de 24
        passingScore: 70,
        timeLimit: 20,
        sections,
        shuffleQuestions: true,
        allowRetry: true,
        maxAttempts: 99,
        isActive: true,
        isGlobal: true,
        companyId: null,
        language: "es",
        baseCreditCost: 0,
        // SIN marcar como badge: la aprobación humana es marcarlo en el admin
        isBadgeExam: false,
      },
      update: {},
    });

    const existing = await prisma.assessmentQuestion.count({
      where: { templateId: template.id },
    });
    if (existing > 0) {
      console.log(`${pool.slug}: ya tiene ${existing} preguntas — no se duplican.`);
      continue;
    }

    await prisma.assessmentQuestion.createMany({
      data: pool.questions.map((qq) => ({
        templateId: template.id,
        section: qq.section,
        difficulty: "JUNIOR",
        tags: qq.tags,
        questionText: qq.questionText,
        codeSnippet: qq.codeSnippet,
        options: qq.options,
        allowMultiple: qq.allowMultiple,
        explanation: qq.explanation,
        type: "MULTIPLE_CHOICE",
        isActive: true,
      })),
    });

    console.log(
      `✓ ${pool.title}: ${pool.questions.length} preguntas (examen de 12 sorteadas). Pendiente de revisión y marcado como badge (${term.label} · Básico) en /dashboard/admin/templates.`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
