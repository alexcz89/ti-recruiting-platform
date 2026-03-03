// prisma/seeds/assessments-coding.ts
// Correr: dotenv -e .env.production.local -- tsx prisma/seeds/assessments-coding.ts

import { PrismaClient, AssessmentType, AssessmentDifficulty, QuestionType } from "@prisma/client";

const prisma = new PrismaClient();

type CodingQuestionSeed = {
  section: string;
  difficulty: AssessmentDifficulty;
  tags: string[];
  questionText: string;
  starterCode?: Record<string, string>; // { python: "...", javascript: "...", cpp: "..." }
  testCases?: { input: string; expectedOutput: string; isHidden?: boolean }[];
  explanation?: string;
  type: QuestionType;
};

type TemplateSeed = {
  title: string;
  slug: string;
  description: string;
  type: AssessmentType;
  difficulty: AssessmentDifficulty;
  passingScore: number;
  timeLimit: number;
  sections: { name: string; questions: number }[];
  questions: CodingQuestionSeed[];
};

// ============================================================
// TEMPLATE 1: JAVASCRIPT CODING — JUNIOR
// ============================================================
const javascriptCodingJunior: TemplateSeed = {
  title: "JavaScript — Programación Práctica Junior",
  slug: "javascript-coding-junior",
  description: "Evalúa habilidades prácticas de JavaScript: manipulación de arrays, strings, objetos y lógica básica mediante ejercicios de código real.",
  type: "CODING",
  difficulty: "JUNIOR",
  passingScore: 60,
  timeLimit: 45,
  sections: [
    { name: "Strings y Arrays", questions: 3 },
    { name: "Objetos y Lógica", questions: 2 },
  ],
  questions: [
    {
      section: "Strings y Arrays",
      difficulty: "JUNIOR",
      tags: ["strings", "javascript"],
      type: "CODING",
      questionText: `## Invertir una cadena

Escribe una función \`reverseString\` que reciba un string y retorne ese string invertido.

**Ejemplos:**
\`\`\`
reverseString("hello")  → "olleh"
reverseString("world")  → "dlrow"
reverseString("abcde")  → "edcba"
\`\`\`

**Restricciones:**
- No uses el método \`.reverse()\` directamente en el string
- La función debe manejar strings vacíos`,
      starterCode: {
        javascript: `function reverseString(str) {
  // Tu código aquí
}`,
      },
      testCases: [
        { input: "hello", expectedOutput: "olleh" },
        { input: "world", expectedOutput: "dlrow" },
        { input: "abcde", expectedOutput: "edcba" },
        { input: "", expectedOutput: "" },
        { input: "a", expectedOutput: "a" },
      ],
      explanation: "Se puede usar `.split('').reverse().join('')` o un loop que recorra el string de atrás hacia adelante.",
    },
    {
      section: "Strings y Arrays",
      difficulty: "JUNIOR",
      tags: ["arrays", "javascript"],
      type: "CODING",
      questionText: `## Suma de array

Escribe una función \`sumArray\` que reciba un array de números y retorne la suma de todos sus elementos.

**Ejemplos:**
\`\`\`
sumArray([1, 2, 3, 4, 5])  → 15
sumArray([10, 20, 30])     → 60
sumArray([])               → 0
sumArray([-1, 1])          → 0
\`\`\``,
      starterCode: {
        javascript: `function sumArray(nums) {
  // Tu código aquí
}`,
      },
      testCases: [
        { input: "[1, 2, 3, 4, 5]", expectedOutput: "15" },
        { input: "[10, 20, 30]", expectedOutput: "60" },
        { input: "[]", expectedOutput: "0" },
        { input: "[-1, 1]", expectedOutput: "0" },
        { input: "[100]", expectedOutput: "100" },
      ],
      explanation: "Se puede usar `reduce((acc, n) => acc + n, 0)` o un loop acumulador.",
    },
    {
      section: "Strings y Arrays",
      difficulty: "JUNIOR",
      tags: ["arrays", "filter", "javascript"],
      type: "CODING",
      questionText: `## Filtrar números pares

Escribe una función \`filterEvens\` que reciba un array de números y retorne un nuevo array con solo los números pares.

**Ejemplos:**
\`\`\`
filterEvens([1, 2, 3, 4, 5, 6])  → [2, 4, 6]
filterEvens([1, 3, 5])           → []
filterEvens([2, 4, 6])           → [2, 4, 6]
\`\`\``,
      starterCode: {
        javascript: `function filterEvens(nums) {
  // Tu código aquí
}`,
      },
      testCases: [
        { input: "[1, 2, 3, 4, 5, 6]", expectedOutput: "[2, 4, 6]" },
        { input: "[1, 3, 5]", expectedOutput: "[]" },
        { input: "[2, 4, 6]", expectedOutput: "[2, 4, 6]" },
        { input: "[]", expectedOutput: "[]" },
      ],
      explanation: "Usar `.filter(n => n % 2 === 0)`.",
    },
    {
      section: "Objetos y Lógica",
      difficulty: "JUNIOR",
      tags: ["objetos", "javascript"],
      type: "CODING",
      questionText: `## Contar frecuencia de palabras

Escribe una función \`wordCount\` que reciba un string y retorne un objeto donde las llaves son las palabras y los valores son cuántas veces aparece cada una.

**Ejemplos:**
\`\`\`
wordCount("hola mundo hola")  → { hola: 2, mundo: 1 }
wordCount("a b a b a")        → { a: 3, b: 2 }
wordCount("")                 → {}
\`\`\``,
      starterCode: {
        javascript: `function wordCount(str) {
  // Tu código aquí
}`,
      },
      testCases: [
        { input: "hola mundo hola", expectedOutput: '{"hola":2,"mundo":1}' },
        { input: "a b a b a", expectedOutput: '{"a":3,"b":2}' },
        { input: "", expectedOutput: "{}" },
      ],
      explanation: "Split por espacios, luego iterar y usar el objeto como acumulador.",
    },
    {
      section: "Objetos y Lógica",
      difficulty: "JUNIOR",
      tags: ["lógica", "fibonacci"],
      type: "CODING",
      questionText: `## Número de Fibonacci

Escribe una función \`fibonacci\` que reciba un número \`n\` y retorne el n-ésimo número de la secuencia de Fibonacci.

La secuencia es: 0, 1, 1, 2, 3, 5, 8, 13, 21, ...

**Ejemplos:**
\`\`\`
fibonacci(0)  → 0
fibonacci(1)  → 1
fibonacci(5)  → 5
fibonacci(8)  → 21
\`\`\``,
      starterCode: {
        javascript: `function fibonacci(n) {
  // Tu código aquí
}`,
      },
      testCases: [
        { input: "0", expectedOutput: "0" },
        { input: "1", expectedOutput: "1" },
        { input: "5", expectedOutput: "5" },
        { input: "8", expectedOutput: "21" },
        { input: "10", expectedOutput: "55", isHidden: true },
      ],
      explanation: "Se puede resolver iterativamente con dos variables o recursivamente. La versión iterativa es más eficiente.",
    },
  ],
};

// ============================================================
// TEMPLATE 2: PYTHON CODING — JUNIOR
// ============================================================
const pythonCodingJunior: TemplateSeed = {
  title: "Python — Programación Práctica Junior",
  slug: "python-coding-junior",
  description: "Evalúa habilidades prácticas de Python: manipulación de listas, strings, diccionarios y lógica básica.",
  type: "CODING",
  difficulty: "JUNIOR",
  passingScore: 60,
  timeLimit: 45,
  sections: [
    { name: "Listas y Strings", questions: 3 },
    { name: "Diccionarios y Lógica", questions: 2 },
  ],
  questions: [
    {
      section: "Listas y Strings",
      difficulty: "JUNIOR",
      tags: ["strings", "python"],
      type: "CODING",
      questionText: `## Palíndromo

Escribe una función \`es_palindromo\` que reciba un string y retorne \`True\` si es un palíndromo, \`False\` si no lo es. Ignora mayúsculas/minúsculas.

**Ejemplos:**
\`\`\`
es_palindromo("radar")   → True
es_palindromo("hello")   → False
es_palindromo("Ama")     → True
es_palindromo("racecar") → True
\`\`\``,
      starterCode: {
        python: `def es_palindromo(s):
    # Tu código aquí
    pass`,
      },
      testCases: [
        { input: "radar", expectedOutput: "True" },
        { input: "hello", expectedOutput: "False" },
        { input: "Ama", expectedOutput: "True" },
        { input: "racecar", expectedOutput: "True" },
        { input: "a", expectedOutput: "True" },
      ],
      explanation: "Convertir a minúsculas y comparar con su reverso: `s.lower() == s.lower()[::-1]`.",
    },
    {
      section: "Listas y Strings",
      difficulty: "JUNIOR",
      tags: ["listas", "python"],
      type: "CODING",
      questionText: `## Máximo y mínimo sin funciones built-in

Escribe una función \`max_min\` que reciba una lista de números y retorne una tupla \`(maximo, minimo)\`. No uses las funciones \`max()\` ni \`min()\` de Python.

**Ejemplos:**
\`\`\`
max_min([3, 1, 4, 1, 5, 9])  → (9, 1)
max_min([10, 20, 30])        → (30, 10)
max_min([-5, -1, -3])        → (-1, -5)
\`\`\``,
      starterCode: {
        python: `def max_min(nums):
    # Tu código aquí
    pass`,
      },
      testCases: [
        { input: "[3, 1, 4, 1, 5, 9]", expectedOutput: "(9, 1)" },
        { input: "[10, 20, 30]", expectedOutput: "(30, 10)" },
        { input: "[-5, -1, -3]", expectedOutput: "(-1, -5)" },
      ],
      explanation: "Inicializar máximo y mínimo con el primer elemento e iterar comparando.",
    },
    {
      section: "Listas y Strings",
      difficulty: "JUNIOR",
      tags: ["listas", "python"],
      type: "CODING",
      questionText: `## Aplanar lista anidada

Escribe una función \`aplanar\` que reciba una lista con posibles sublistas de un nivel y retorne una lista plana.

**Ejemplos:**
\`\`\`
aplanar([1, [2, 3], [4, 5], 6])  → [1, 2, 3, 4, 5, 6]
aplanar([[1, 2], [3, 4]])        → [1, 2, 3, 4]
aplanar([1, 2, 3])               → [1, 2, 3]
\`\`\``,
      starterCode: {
        python: `def aplanar(lista):
    # Tu código aquí
    pass`,
      },
      testCases: [
        { input: "[1, [2, 3], [4, 5], 6]", expectedOutput: "[1, 2, 3, 4, 5, 6]" },
        { input: "[[1, 2], [3, 4]]", expectedOutput: "[1, 2, 3, 4]" },
        { input: "[1, 2, 3]", expectedOutput: "[1, 2, 3]" },
      ],
      explanation: "Iterar y verificar si cada elemento es lista con `isinstance(item, list)`.",
    },
    {
      section: "Diccionarios y Lógica",
      difficulty: "JUNIOR",
      tags: ["diccionarios", "python"],
      type: "CODING",
      questionText: `## Invertir diccionario

Escribe una función \`invertir_dict\` que reciba un diccionario y retorne uno nuevo con llaves y valores intercambiados.

**Ejemplos:**
\`\`\`
invertir_dict({"a": 1, "b": 2})   → {1: "a", 2: "b"}
invertir_dict({"x": 10, "y": 20}) → {10: "x", 20: "y"}
\`\`\``,
      starterCode: {
        python: `def invertir_dict(d):
    # Tu código aquí
    pass`,
      },
      testCases: [
        { input: '{"a": 1, "b": 2}', expectedOutput: '{1: "a", 2: "b"}' },
        { input: '{"x": 10, "y": 20}', expectedOutput: '{10: "x", 20: "y"}' },
      ],
      explanation: "Dict comprehension: `{v: k for k, v in d.items()}`.",
    },
    {
      section: "Diccionarios y Lógica",
      difficulty: "JUNIOR",
      tags: ["lógica", "python"],
      type: "CODING",
      questionText: `## FizzBuzz

Escribe una función \`fizzbuzz\` que reciba un número \`n\` y retorne una lista con los números del 1 al n donde:
- Múltiplos de 3 → "Fizz"
- Múltiplos de 5 → "Buzz"  
- Múltiplos de ambos → "FizzBuzz"
- Resto → el número como string

**Ejemplos:**
\`\`\`
fizzbuzz(5)  → ["1", "2", "Fizz", "4", "Buzz"]
fizzbuzz(15) → [..., "FizzBuzz"]
\`\`\``,
      starterCode: {
        python: `def fizzbuzz(n):
    # Tu código aquí
    pass`,
      },
      testCases: [
        { input: "5", expectedOutput: '["1", "2", "Fizz", "4", "Buzz"]' },
        { input: "3", expectedOutput: '["1", "2", "Fizz"]' },
        { input: "15", expectedOutput: '["1", "2", "Fizz", "4", "Buzz", "Fizz", "7", "8", "Fizz", "Buzz", "11", "Fizz", "13", "14", "FizzBuzz"]' },
      ],
      explanation: "Verificar primero `n % 15 == 0` (FizzBuzz), luego `% 3` y `% 5` por separado.",
    },
  ],
};

// ============================================================
// TEMPLATE 3: C++ CODING — JUNIOR
// ============================================================
const cppCodingJunior: TemplateSeed = {
  title: "C++ — Programación Práctica Junior",
  slug: "cpp-coding-junior",
  description: "Evalúa habilidades prácticas de C++: manejo de arrays, strings, punteros básicos y lógica estructurada.",
  type: "CODING",
  difficulty: "JUNIOR",
  passingScore: 60,
  timeLimit: 50,
  sections: [
    { name: "Arrays y Strings", questions: 3 },
    { name: "Lógica y Funciones", questions: 2 },
  ],
  questions: [
    {
      section: "Arrays y Strings",
      difficulty: "JUNIOR",
      tags: ["arrays", "cpp"],
      type: "CODING",
      questionText: `## Suma de elementos de un array

Escribe una función \`sumaArray\` que reciba un vector de enteros y retorne la suma de todos sus elementos.

**Ejemplos:**
\`\`\`
sumaArray({1, 2, 3, 4, 5})  → 15
sumaArray({10, 20, 30})     → 60
sumaArray({})               → 0
\`\`\``,
      starterCode: {
        cpp: `#include <vector>
using namespace std;

int sumaArray(vector<int> nums) {
    // Tu código aquí
}`,
      },
      testCases: [
        { input: "{1, 2, 3, 4, 5}", expectedOutput: "15" },
        { input: "{10, 20, 30}", expectedOutput: "60" },
        { input: "{}", expectedOutput: "0" },
        { input: "{-1, 1}", expectedOutput: "0" },
      ],
      explanation: "Usar un loop for o `accumulate` de `<numeric>` con valor inicial 0.",
    },
    {
      section: "Arrays y Strings",
      difficulty: "JUNIOR",
      tags: ["strings", "cpp"],
      type: "CODING",
      questionText: `## Contar vocales

Escribe una función \`contarVocales\` que reciba un string y retorne cuántas vocales (a, e, i, o, u) contiene, sin distinguir mayúsculas.

**Ejemplos:**
\`\`\`
contarVocales("hello")   → 2
contarVocales("aeiou")   → 5
contarVocales("rhythm")  → 0
contarVocales("HOLA")    → 2
\`\`\``,
      starterCode: {
        cpp: `#include <string>
using namespace std;

int contarVocales(string s) {
    // Tu código aquí
}`,
      },
      testCases: [
        { input: "hello", expectedOutput: "2" },
        { input: "aeiou", expectedOutput: "5" },
        { input: "rhythm", expectedOutput: "0" },
        { input: "HOLA", expectedOutput: "2" },
      ],
      explanation: "Convertir a minúsculas con `tolower()` y verificar si cada caracter está en el conjunto de vocales.",
    },
    {
      section: "Arrays y Strings",
      difficulty: "JUNIOR",
      tags: ["arrays", "ordenamiento", "cpp"],
      type: "CODING",
      questionText: `## Encontrar el segundo mayor

Escribe una función \`segundoMayor\` que reciba un vector de enteros (mínimo 2 elementos distintos) y retorne el segundo número más grande.

**Ejemplos:**
\`\`\`
segundoMayor({3, 1, 4, 1, 5, 9})  → 5
segundoMayor({10, 20, 30})        → 20
segundoMayor({5, 5, 3})           → 3
\`\`\``,
      starterCode: {
        cpp: `#include <vector>
using namespace std;

int segundoMayor(vector<int> nums) {
    // Tu código aquí
}`,
      },
      testCases: [
        { input: "{3, 1, 4, 1, 5, 9}", expectedOutput: "5" },
        { input: "{10, 20, 30}", expectedOutput: "20" },
        { input: "{5, 5, 3}", expectedOutput: "3" },
      ],
      explanation: "Mantener dos variables: `primero` y `segundo`. Actualizar ambas al iterar.",
    },
    {
      section: "Lógica y Funciones",
      difficulty: "JUNIOR",
      tags: ["lógica", "cpp"],
      type: "CODING",
      questionText: `## Número primo

Escribe una función \`esPrimo\` que reciba un entero y retorne \`true\` si es primo, \`false\` si no.

**Ejemplos:**
\`\`\`
esPrimo(2)   → true
esPrimo(7)   → true
esPrimo(9)   → false
esPrimo(1)   → false
esPrimo(13)  → true
\`\`\``,
      starterCode: {
        cpp: `bool esPrimo(int n) {
    // Tu código aquí
}`,
      },
      testCases: [
        { input: "2", expectedOutput: "true" },
        { input: "7", expectedOutput: "true" },
        { input: "9", expectedOutput: "false" },
        { input: "1", expectedOutput: "false" },
        { input: "13", expectedOutput: "true" },
        { input: "100", expectedOutput: "false", isHidden: true },
      ],
      explanation: "Verificar divisibilidad desde 2 hasta √n. Si n < 2 retornar false.",
    },
    {
      section: "Lógica y Funciones",
      difficulty: "JUNIOR",
      tags: ["recursión", "cpp"],
      type: "CODING",
      questionText: `## Factorial recursivo

Escribe una función recursiva \`factorial\` que calcule el factorial de un número n.

**Ejemplos:**
\`\`\`
factorial(0)  → 1
factorial(1)  → 1
factorial(5)  → 120
factorial(7)  → 5040
\`\`\``,
      starterCode: {
        cpp: `long long factorial(int n) {
    // Tu código aquí
}`,
      },
      testCases: [
        { input: "0", expectedOutput: "1" },
        { input: "1", expectedOutput: "1" },
        { input: "5", expectedOutput: "120" },
        { input: "7", expectedOutput: "5040" },
        { input: "10", expectedOutput: "3628800", isHidden: true },
      ],
      explanation: "Caso base: `if (n <= 1) return 1`. Caso recursivo: `return n * factorial(n-1)`.",
    },
  ],
};

// ============================================================
// TEMPLATE 4: JAVASCRIPT CODING — MID
// ============================================================
const javascriptCodingMid: TemplateSeed = {
  title: "JavaScript — Programación Práctica Mid Level",
  slug: "javascript-coding-mid",
  description: "Evalúa habilidades intermedias de JavaScript: closures, programación funcional, estructuras de datos y asincronía.",
  type: "CODING",
  difficulty: "MID",
  passingScore: 65,
  timeLimit: 60,
  sections: [
    { name: "Programación Funcional", questions: 2 },
    { name: "Estructuras de Datos", questions: 2 },
    { name: "Asincronía", questions: 1 },
  ],
  questions: [
    {
      section: "Programación Funcional",
      difficulty: "MID",
      tags: ["closures", "javascript"],
      type: "CODING",
      questionText: `## Función memoize

Implementa una función \`memoize\` que reciba una función y retorne una versión "memoizada" de la misma (que cachea resultados).

**Ejemplos:**
\`\`\`js
const suma = memoize((a, b) => a + b);
suma(1, 2);  // calcula → 3
suma(1, 2);  // retorna del cache → 3
suma(3, 4);  // calcula → 7
\`\`\``,
      starterCode: {
        javascript: `function memoize(fn) {
  // Tu código aquí
}`,
      },
      testCases: [
        { input: "memoize((a,b) => a+b)(2, 3)", expectedOutput: "5" },
        { input: "const f = memoize((n) => n*2); f(5); f(5);", expectedOutput: "10" },
      ],
      explanation: "Usar un objeto o Map como cache con la clave siendo los argumentos serializados (`JSON.stringify(args)`).",
    },
    {
      section: "Programación Funcional",
      difficulty: "MID",
      tags: ["functional", "compose", "javascript"],
      type: "CODING",
      questionText: `## Pipe de funciones

Implementa una función \`pipe\` que reciba múltiples funciones y retorne una nueva función que aplique todas en orden de izquierda a derecha.

**Ejemplos:**
\`\`\`js
const doble = x => x * 2;
const sumarUno = x => x + 1;
const alCuadrado = x => x * x;

const transformar = pipe(doble, sumarUno, alCuadrado);
transformar(3);  // doble(3)=6 → sumarUno(6)=7 → alCuadrado(7)=49
\`\`\``,
      starterCode: {
        javascript: `function pipe(...fns) {
  // Tu código aquí
}`,
      },
      testCases: [
        { input: "pipe(x => x*2, x => x+1)(3)", expectedOutput: "7" },
        { input: "pipe(x => x*2, x => x*2, x => x*2)(1)", expectedOutput: "8" },
      ],
      explanation: "Usar `reduce` para aplicar cada función al resultado anterior: `fns.reduce((v, f) => f(v), x)`.",
    },
    {
      section: "Estructuras de Datos",
      difficulty: "MID",
      tags: ["estructuras", "stack", "javascript"],
      type: "CODING",
      questionText: `## Implementar una Stack

Implementa una clase \`Stack\` con los métodos:
- \`push(val)\`: agrega un elemento al tope
- \`pop()\`: elimina y retorna el elemento del tope (o \`null\` si está vacía)
- \`peek()\`: retorna el elemento del tope sin eliminarlo
- \`isEmpty()\`: retorna \`true\` si está vacía
- \`size()\`: retorna el número de elementos

**Ejemplo:**
\`\`\`js
const s = new Stack();
s.push(1); s.push(2); s.push(3);
s.peek()    // 3
s.pop()     // 3
s.size()    // 2
s.isEmpty() // false
\`\`\``,
      starterCode: {
        javascript: `class Stack {
  constructor() {
    // Tu código aquí
  }

  push(val) { }
  pop() { }
  peek() { }
  isEmpty() { }
  size() { }
}`,
      },
      testCases: [
        { input: "const s = new Stack(); s.push(1); s.push(2); s.peek();", expectedOutput: "2" },
        { input: "const s = new Stack(); s.push(1); s.pop(); s.isEmpty();", expectedOutput: "true" },
        { input: "const s = new Stack(); s.push(1); s.push(2); s.push(3); s.size();", expectedOutput: "3" },
      ],
      explanation: "Usar un array interno. `push` → `arr.push()`, `pop` → `arr.pop()`, `peek` → `arr[arr.length-1]`.",
    },
    {
      section: "Estructuras de Datos",
      difficulty: "MID",
      tags: ["hash-map", "javascript"],
      type: "CODING",
      questionText: `## Dos sumas (Two Sum)

Escribe una función \`twoSum\` que reciba un array de números y un target. Retorna los índices de los dos números que suman el target.

**Ejemplos:**
\`\`\`js
twoSum([2, 7, 11, 15], 9)  → [0, 1]  // 2+7=9
twoSum([3, 2, 4], 6)       → [1, 2]  // 2+4=6
twoSum([3, 3], 6)          → [0, 1]
\`\`\`

Resuelve en O(n) usando un HashMap.`,
      starterCode: {
        javascript: `function twoSum(nums, target) {
  // Tu código aquí
}`,
      },
      testCases: [
        { input: "[2, 7, 11, 15], 9", expectedOutput: "[0, 1]" },
        { input: "[3, 2, 4], 6", expectedOutput: "[1, 2]" },
        { input: "[3, 3], 6", expectedOutput: "[0, 1]" },
      ],
      explanation: "Usar un Map para guardar `{valor: índice}`. Por cada número, verificar si `target - num` ya está en el Map.",
    },
    {
      section: "Asincronía",
      difficulty: "MID",
      tags: ["promises", "async", "javascript"],
      type: "CODING",
      questionText: `## Promise.all manual

Implementa una función \`promiseAll\` que imite el comportamiento de \`Promise.all\`: recibe un array de promesas y retorna una promesa que resuelve cuando todas resuelven, o rechaza si alguna falla.

**Ejemplos:**
\`\`\`js
promiseAll([
  Promise.resolve(1),
  Promise.resolve(2),
  Promise.resolve(3)
]) // → [1, 2, 3]

promiseAll([
  Promise.resolve(1),
  Promise.reject("error")
]) // → rechaza con "error"
\`\`\``,
      starterCode: {
        javascript: `function promiseAll(promises) {
  // Tu código aquí
}`,
      },
      testCases: [
        { input: "[Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)]", expectedOutput: "[1, 2, 3]" },
        { input: "[]", expectedOutput: "[]" },
      ],
      explanation: "Retornar `new Promise` que resuelve cuando el contador de resultados llega al total, o rechaza en el primer error.",
    },
  ],
};

// ============================================================
// TEMPLATE 5: PYTHON CODING — MID
// ============================================================
const pythonCodingMid: TemplateSeed = {
  title: "Python — Programación Práctica Mid Level",
  slug: "python-coding-mid",
  description: "Evalúa habilidades intermedias de Python: comprensiones, generadores, decoradores, OOP y algoritmos.",
  type: "CODING",
  difficulty: "MID",
  passingScore: 65,
  timeLimit: 60,
  sections: [
    { name: "Funcional y Comprensiones", questions: 2 },
    { name: "OOP", questions: 2 },
    { name: "Algoritmos", questions: 1 },
  ],
  questions: [
    {
      section: "Funcional y Comprensiones",
      difficulty: "MID",
      tags: ["comprensiones", "python"],
      type: "CODING",
      questionText: `## Agrupar por clave

Escribe una función \`agrupar_por\` que reciba una lista de diccionarios y una clave, y retorne un diccionario agrupando los items por el valor de esa clave.

**Ejemplos:**
\`\`\`python
datos = [
  {"nombre": "Ana", "dept": "Eng"},
  {"nombre": "Bob", "dept": "HR"},
  {"nombre": "Carlos", "dept": "Eng"},
]
agrupar_por(datos, "dept")
# → {"Eng": [...Ana, Carlos...], "HR": [...Bob...]}
\`\`\``,
      starterCode: {
        python: `def agrupar_por(lista, clave):
    # Tu código aquí
    pass`,
      },
      testCases: [
        {
          input: '[{"n":"A","d":"X"},{"n":"B","d":"Y"},{"n":"C","d":"X"}], "d"',
          expectedOutput: '{"X": [{"n": "A", "d": "X"}, {"n": "C", "d": "X"}], "Y": [{"n": "B", "d": "Y"}]}',
        },
      ],
      explanation: "Usar `defaultdict(list)` e iterar agregando cada item al grupo correspondiente.",
    },
    {
      section: "Funcional y Comprensiones",
      difficulty: "MID",
      tags: ["decoradores", "python"],
      type: "CODING",
      questionText: `## Decorador de tiempo de ejecución

Implementa un decorador \`medir_tiempo\` que mida cuántos segundos tarda en ejecutarse una función e imprima el resultado.

**Ejemplo:**
\`\`\`python
@medir_tiempo
def operacion_lenta():
    time.sleep(0.1)
    return "listo"

operacion_lenta()
# Imprime: "operacion_lenta tardó 0.10s"
# Retorna: "listo"
\`\`\``,
      starterCode: {
        python: `import time

def medir_tiempo(func):
    # Tu código aquí
    pass`,
      },
      testCases: [
        { input: "medir_tiempo(lambda: 42)()", expectedOutput: "42" },
      ],
      explanation: "Usar `functools.wraps` y `time.time()` antes y después de llamar a `func(*args, **kwargs)`.",
    },
    {
      section: "OOP",
      difficulty: "MID",
      tags: ["oop", "python"],
      type: "CODING",
      questionText: `## Clase LinkedList

Implementa una clase \`LinkedList\` con los métodos:
- \`append(val)\`: agrega al final
- \`prepend(val)\`: agrega al inicio
- \`delete(val)\`: elimina el primer nodo con ese valor
- \`to_list()\`: retorna los valores como lista Python

**Ejemplo:**
\`\`\`python
ll = LinkedList()
ll.append(1); ll.append(2); ll.append(3)
ll.prepend(0)
ll.to_list()   # [0, 1, 2, 3]
ll.delete(2)
ll.to_list()   # [0, 1, 3]
\`\`\``,
      starterCode: {
        python: `class Node:
    def __init__(self, val):
        self.val = val
        self.next = None

class LinkedList:
    def __init__(self):
        self.head = None

    def append(self, val):
        pass

    def prepend(self, val):
        pass

    def delete(self, val):
        pass

    def to_list(self):
        pass`,
      },
      testCases: [
        { input: "ll = LinkedList(); ll.append(1); ll.append(2); ll.to_list()", expectedOutput: "[1, 2]" },
        { input: "ll = LinkedList(); ll.append(1); ll.prepend(0); ll.to_list()", expectedOutput: "[0, 1]" },
        { input: "ll = LinkedList(); ll.append(1); ll.append(2); ll.delete(1); ll.to_list()", expectedOutput: "[2]" },
      ],
      explanation: "Manejar casos especiales: lista vacía, eliminar la cabeza, eliminar nodo intermedio/final.",
    },
    {
      section: "OOP",
      difficulty: "MID",
      tags: ["oop", "herencia", "python"],
      type: "CODING",
      questionText: `## Sistema de figuras geométricas

Crea una clase base \`Figura\` con método \`area()\` y subclases \`Circulo\` y \`Rectangulo\` que implementen su propio cálculo de área.

**Ejemplo:**
\`\`\`python
c = Circulo(5)
c.area()          # 78.53... (usar math.pi)

r = Rectangulo(4, 6)
r.area()          # 24
\`\`\``,
      starterCode: {
        python: `import math

class Figura:
    def area(self):
        raise NotImplementedError

class Circulo(Figura):
    def __init__(self, radio):
        pass

    def area(self):
        pass

class Rectangulo(Figura):
    def __init__(self, base, altura):
        pass

    def area(self):
        pass`,
      },
      testCases: [
        { input: "round(Circulo(5).area(), 2)", expectedOutput: "78.54" },
        { input: "Rectangulo(4, 6).area()", expectedOutput: "24" },
        { input: "Rectangulo(3, 3).area()", expectedOutput: "9" },
      ],
      explanation: "Circulo: `math.pi * radio ** 2`. Rectangulo: `base * altura`.",
    },
    {
      section: "Algoritmos",
      difficulty: "MID",
      tags: ["algoritmos", "búsqueda-binaria", "python"],
      type: "CODING",
      questionText: `## Búsqueda binaria

Implementa la función \`busqueda_binaria\` que reciba una lista ordenada y un target, y retorne el índice del target o \`-1\` si no existe.

**Ejemplos:**
\`\`\`python
busqueda_binaria([1, 3, 5, 7, 9], 7)   → 3
busqueda_binaria([1, 3, 5, 7, 9], 6)   → -1
busqueda_binaria([1], 1)               → 0
\`\`\`

**Restricción:** Debe ser O(log n), no uses \`list.index()\`.`,
      starterCode: {
        python: `def busqueda_binaria(lista, target):
    # Tu código aquí
    pass`,
      },
      testCases: [
        { input: "[1, 3, 5, 7, 9], 7", expectedOutput: "3" },
        { input: "[1, 3, 5, 7, 9], 6", expectedOutput: "-1" },
        { input: "[1], 1", expectedOutput: "0" },
        { input: "[1, 2, 3, 4, 5], 1", expectedOutput: "0", isHidden: true },
      ],
      explanation: "Usar punteros `izq` y `der`. Calcular `mid = (izq + der) // 2` y ajustar según comparación.",
    },
  ],
};

// ============================================================
// TEMPLATE 6: C++ CODING — MID
// ============================================================
const cppCodingMid: TemplateSeed = {
  title: "C++ — Programación Práctica Mid Level",
  slug: "cpp-coding-mid",
  description: "Evalúa habilidades intermedias de C++: STL, punteros, OOP, templates y algoritmos.",
  type: "CODING",
  difficulty: "MID",
  passingScore: 65,
  timeLimit: 60,
  sections: [
    { name: "STL y Algoritmos", questions: 2 },
    { name: "OOP", questions: 2 },
    { name: "Punteros y Memoria", questions: 1 },
  ],
  questions: [
    {
      section: "STL y Algoritmos",
      difficulty: "MID",
      tags: ["stl", "map", "cpp"],
      type: "CODING",
      questionText: `## Frecuencia de caracteres

Escribe una función \`frecuenciaChars\` que reciba un string y retorne un \`map<char, int>\` con la frecuencia de cada carácter.

**Ejemplos:**
\`\`\`cpp
frecuenciaChars("hello")  → {e:1, h:1, l:2, o:1}
frecuenciaChars("aab")    → {a:2, b:1}
\`\`\``,
      starterCode: {
        cpp: `#include <map>
#include <string>
using namespace std;

map<char, int> frecuenciaChars(string s) {
    // Tu código aquí
}`,
      },
      testCases: [
        { input: '"hello"', expectedOutput: "h:1 e:1 l:2 o:1" },
        { input: '"aab"', expectedOutput: "a:2 b:1" },
      ],
      explanation: "Iterar el string y usar `mapa[c]++` para contar cada carácter.",
    },
    {
      section: "STL y Algoritmos",
      difficulty: "MID",
      tags: ["algoritmos", "dos-punteros", "cpp"],
      type: "CODING",
      questionText: `## Verificar anagramas

Escribe una función \`sonAnagramas\` que reciba dos strings y retorne \`true\` si son anagramas (mismas letras, distinto orden).

**Ejemplos:**
\`\`\`cpp
sonAnagramas("listen", "silent")  → true
sonAnagramas("hello", "world")    → false
sonAnagramas("anagram", "nagaram") → true
\`\`\``,
      starterCode: {
        cpp: `#include <string>
using namespace std;

bool sonAnagramas(string s1, string s2) {
    // Tu código aquí
}`,
      },
      testCases: [
        { input: '"listen", "silent"', expectedOutput: "true" },
        { input: '"hello", "world"', expectedOutput: "false" },
        { input: '"anagram", "nagaram"', expectedOutput: "true" },
        { input: '"a", "ab"', expectedOutput: "false" },
      ],
      explanation: "Ordenar ambos strings y comparar, o usar un array de frecuencias de 26 caracteres.",
    },
    {
      section: "OOP",
      difficulty: "MID",
      tags: ["oop", "cpp"],
      type: "CODING",
      questionText: `## Clase BankAccount

Implementa una clase \`BankAccount\` con:
- Constructor que recibe el balance inicial
- \`deposit(amount)\`: deposita dinero
- \`withdraw(amount)\`: retira dinero (retorna \`false\` si no hay fondos suficientes)
- \`getBalance()\`: retorna el balance actual

**Ejemplo:**
\`\`\`cpp
BankAccount acc(100);
acc.deposit(50);      // balance: 150
acc.withdraw(30);     // true, balance: 120
acc.withdraw(200);    // false, balance: 120
acc.getBalance();     // 120
\`\`\``,
      starterCode: {
        cpp: `class BankAccount {
private:
    // Tu código aquí

public:
    BankAccount(double initialBalance) {
        // Tu código aquí
    }

    void deposit(double amount) {
        // Tu código aquí
    }

    bool withdraw(double amount) {
        // Tu código aquí
    }

    double getBalance() {
        // Tu código aquí
    }
};`,
      },
      testCases: [
        { input: "BankAccount(100); deposit(50); getBalance()", expectedOutput: "150" },
        { input: "BankAccount(100); withdraw(50);", expectedOutput: "true" },
        { input: "BankAccount(100); withdraw(200);", expectedOutput: "false" },
      ],
      explanation: "Usar un atributo privado `balance`. En `withdraw`, verificar `amount <= balance` antes de restar.",
    },
    {
      section: "OOP",
      difficulty: "MID",
      tags: ["herencia", "polimorfismo", "cpp"],
      type: "CODING",
      questionText: `## Figuras con polimorfismo

Crea una clase base \`Figura\` con método virtual \`area()\`, y subclases \`Circulo\` y \`Rectangulo\`.

**Ejemplo:**
\`\`\`cpp
Figura* c = new Circulo(5);
c->area();  // 78.53...

Figura* r = new Rectangulo(4, 6);
r->area();  // 24.0
\`\`\``,
      starterCode: {
        cpp: `#include <cmath>
using namespace std;

class Figura {
public:
    virtual double area() = 0;
    virtual ~Figura() {}
};

class Circulo : public Figura {
    // Tu código aquí
};

class Rectangulo : public Figura {
    // Tu código aquí
};`,
      },
      testCases: [
        { input: "round(Circulo(5).area() * 100) / 100", expectedOutput: "78.54" },
        { input: "Rectangulo(4, 6).area()", expectedOutput: "24" },
      ],
      explanation: "Usar `M_PI * radio * radio` para el círculo. Declarar métodos como `virtual` en la clase base.",
    },
    {
      section: "Punteros y Memoria",
      difficulty: "MID",
      tags: ["punteros", "memoria", "cpp"],
      type: "CODING",
      questionText: `## Intercambiar con punteros

Escribe una función \`intercambiar\` que reciba dos enteros por referencia y los intercambie sin usar una variable temporal.

**Ejemplo:**
\`\`\`cpp
int a = 5, b = 10;
intercambiar(a, b);
// a = 10, b = 5
\`\`\``,
      starterCode: {
        cpp: `void intercambiar(int& a, int& b) {
    // Tu código aquí — sin variable temporal
}`,
      },
      testCases: [
        { input: "a=5, b=10 → intercambiar(a,b) → a", expectedOutput: "10" },
        { input: "a=5, b=10 → intercambiar(a,b) → b", expectedOutput: "5" },
      ],
      explanation: "Usar XOR: `a ^= b; b ^= a; a ^= b;` o aritmética: `a = a + b; b = a - b; a = a - b;`.",
    },
  ],
};

// ============================================================
// SEEDER
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

    const data = {
      section: q.section,
      difficulty: q.difficulty,
      tags: q.tags,
      codeSnippet: q.starterCode ? JSON.stringify(q.starterCode) : null,
      options: q.testCases
        ? q.testCases.map((tc, i) => ({
            id: String(i),
            text: `Input: ${tc.input}`,
            isCorrect: false,
            expectedOutput: tc.expectedOutput,
            isHidden: tc.isHidden ?? false,
          }))
        : [],
      allowMultiple: false,
      explanation: q.explanation ?? null,
      type: q.type,
      isActive: true,
    };

    if (existing) {
      await prisma.assessmentQuestion.update({
        where: { id: existing.id },
        data: { ...data, updatedAt: new Date() },
      });
      updated++;
    } else {
      await prisma.assessmentQuestion.create({
        data: { ...data, templateId: template.id, questionText: q.questionText },
      });
      created++;
    }
  }

  console.log(`  📝 Preguntas: ${created} creadas, ${updated} actualizadas`);
  return template;
}

export async function seedCodingTemplates() {
  console.log("🚀 Seeding coding templates...\n");

  const templates = [
    javascriptCodingJunior,
    pythonCodingJunior,
    cppCodingJunior,
    javascriptCodingMid,
    pythonCodingMid,
    cppCodingMid,
  ];

  const results = [];
  for (const t of templates) {
    const template = await upsertTemplate(t);
    results.push({ slug: t.slug, id: template.id, questions: t.questions.length });
  }

  console.log("\n✨ Coding templates completados:");
  console.table(results);
  return results;
}

if (require.main === module) {
  seedCodingTemplates()
    .catch((e) => {
      console.error("❌ Error en seed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}