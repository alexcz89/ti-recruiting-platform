// components/dashboard/assessments/AIQuestionGenerator.tsx
"use client";

import { useState } from "react";
import { Sparkles, X, Loader2, Plus, AlertCircle, Wand2 } from "lucide-react";

type GeneratedMCQOption = { text: string; isCorrect: boolean };
type GeneratedTestCase = { input: string; expectedOutput: string; isHidden: boolean };

type GeneratedQuestion = {
  questionText: string;
  section: string;
  difficulty: "JUNIOR" | "MID" | "SENIOR";
  explanation: string;
  options?: GeneratedMCQOption[];
  codeSnippet?: string;
  allowedLanguages?: string[];
  testCases?: GeneratedTestCase[];
};

type Props = {
  onAddQuestions: (questions: GeneratedQuestion[]) => void;
  currentLanguage?: string;
  currentDifficulty?: string;
  currentType?: "MCQ" | "CODING" | "MIXED";
};

// ── Sugerencias por lenguaje ──────────────────────────────────────────────────
const CODING_BY_LANG: Record<string, Record<string, string[]>> = {
  python: {
    JUNIOR: ["Función que suma elementos de una lista", "Verificar si un número es par", "Contar vocales en un string", "Invertir una cadena de texto", "Calcular el factorial de un número"],
    MID: ["Encontrar el elemento más frecuente en una lista", "Implementar búsqueda binaria", "Aplanar una lista anidada", "Verificar si un string es palíndromo con espacios", "Calcular la serie de Fibonacci con memoización"],
    SENIOR: ["Implementar un decorador de caché LRU", "Resolver el problema de la mochila 0/1", "Implementar un árbol binario de búsqueda", "Generador que produce números primos infinitamente", "Implementar merge sort in-place"],
  },
  javascript: {
    JUNIOR: ["Función que filtra números pares de un array", "Contar palabras en un string", "Encontrar el valor máximo en un array", "Invertir un array sin reverse()", "Verificar si un string es palíndromo"],
    MID: ["Implementar debounce sin librerías", "Función que agrupa objetos por propiedad", "Aplanar un array anidado recursivamente", "Implementar Promise.all desde cero", "Deep clone de un objeto sin JSON.parse"],
    SENIOR: ["Implementar un EventEmitter desde cero", "Función curry con aridad variable", "Implementar memoización genérica", "Resolver problema de dependencias circulares", "Implementar observable/subscriber pattern"],
  },
  typescript: {
    JUNIOR: ["Función tipada que filtra un array genérico", "Tipo que hace todos los campos opcionales", "Función que convierte snake_case a camelCase", "Validar un objeto con tipos estrictos", "Tipo condicional simple"],
    MID: ["Implementar un tipo DeepPartial<T>", "Función genérica de pipeline de transformaciones", "Tipo que extrae keys con valores de cierto tipo", "Implementar patrón Repository tipado", "Mapped types con transformación condicional"],
    SENIOR: ["Implementar un type-safe event emitter", "Builder pattern completamente tipado", "Inferir tipos de una función desde sus parámetros", "Implementar Awaited<T> desde cero", "Dependency injection container tipado"],
  },
  ruby: {
    JUNIOR: ["Método que invierte un string", "Encontrar el número mayor en un array", "Contar elementos únicos en un array", "Calcular suma de dígitos de un número", "Verificar si un número es primo"],
    MID: ["Implementar un método de ordenamiento personalizado", "Usar bloques para transformar una colección", "Método que agrupa elementos por criterio", "Implementar memoización con Hash", "Procesar un CSV simple línea por línea"],
    SENIOR: ["Implementar un DSL simple con bloques", "Método que usa metaprogramación con define_method", "Implementar patrón Observer con módulos", "Crear un Enumerator personalizado", "Implementar lazy evaluation con Enumerator::Lazy"],
  },
  java: {
    JUNIOR: ["Método que invierte un array de enteros", "Verificar si un número es palíndromo", "Contar frecuencia de caracteres en un String", "Calcular potencia sin Math.pow", "Encontrar duplicados en un array"],
    MID: ["Implementar búsqueda binaria genérica", "Ordenar lista de objetos por múltiples campos", "Implementar una pila usando dos colas", "Detectar ciclo en una lista enlazada", "Implementar LRU Cache con LinkedHashMap"],
    SENIOR: ["Implementar un thread pool desde cero", "Productor-consumidor con BlockingQueue", "Implementar patrón Command con lambdas", "Árbol de segmentos para consultas de rango", "Implementar un parser de expresiones matemáticas"],
  },
  cpp: {
    JUNIOR: ["Función que ordena un vector de enteros", "Encontrar el elemento mediano de un array", "Contar ocurrencias de un elemento", "Verificar si un string es palíndromo", "Implementar FizzBuzz"],
    MID: ["Implementar una pila con templates", "Lista enlazada simple con template", "Búsqueda binaria en array ordenado", "Implementar merge sort", "Detectar ciclo en lista enlazada"],
    SENIOR: ["Implementar un smart pointer simple", "Árbol AVL con rotaciones automáticas", "Pool de memoria con placement new", "Implementar un grafo con Dijkstra", "CRTP para polimorfismo estático"],
  },
  c: {
    JUNIOR: ["Función que invierte un string", "Calcular factorial recursivamente", "Encontrar el máximo en un array", "Verificar si un número es primo", "Implementar FizzBuzz"],
    MID: ["Implementar una lista enlazada", "Búsqueda binaria iterativa", "Implementar una pila con array dinámico", "Ordenar array con bubble sort", "Contar bits en 1 de un entero"],
    SENIOR: ["Implementar malloc/free simplificado", "Árbol binario de búsqueda genérico con void*", "Parser de expresiones con precedencia", "Implementar tabla hash con encadenamiento", "Máquina de estados finitos"],
  },
  csharp: {
    JUNIOR: ["Método que invierte una cadena", "Encontrar duplicados en una lista", "Calcular promedio de un array", "Verificar si un número es palíndromo", "Contar palabras en un texto"],
    MID: ["Implementar LINQ personalizado con extensiones", "Patrón Repository con generics", "Implementar caché con Dictionary y TTL", "Árbol binario con IEnumerable", "Implementar patrón Observer con eventos"],
    SENIOR: ["Implementar async pipeline de transformaciones", "Source generator simple con Roslyn", "Implementar canal productor-consumidor con Channel<T>", "Middleware pipeline personalizado", "Implementar un IoC container básico"],
  },
  go: {
    JUNIOR: ["Función que filtra un slice", "Encontrar el máximo en un slice", "Invertir un string en Go", "Contar palabras en un texto", "Implementar FizzBuzz"],
    MID: ["Implementar worker pool con goroutines", "Función que invierte un mapa key-value", "Implementar caché simple con mutex", "Pipeline de transformaciones con channels", "Detectar deadlock en un programa simple"],
    SENIOR: ["Implementar circuit breaker con goroutines", "Rate limiter con token bucket", "Servidor HTTP con middleware chain", "Implementar pub/sub con channels", "Implementar distributed lock con Redis"],
  },
  rust: {
    JUNIOR: ["Función que filtra números pares de un Vec", "Calcular suma de un iterator", "Convertir string a número con manejo de error", "Encontrar el máximo en un Vec", "Implementar FizzBuzz"],
    MID: ["Implementar una pila genérica", "Función que procesa Result<Vec<T>>", "Implementar iterador personalizado", "Árbol binario con Box<T>", "Implementar patrón Builder"],
    SENIOR: ["Implementar un async runtime simplificado", "Smart pointer similar a Rc<T>", "Implementar un pool de threads desde cero", "Parser combinator simple", "Lock-free stack con AtomicPtr"],
  },
  sql: {
    JUNIOR: ["Consulta con WHERE y ORDER BY", "Contar registros por categoría con GROUP BY", "JOIN simple entre dos tablas", "Encontrar el máximo valor por grupo", "Filtrar registros con HAVING"],
    MID: ["Consulta con múltiples JOINs y subconsulta", "Top N por categoría con ROW_NUMBER()", "Detectar registros duplicados con EXISTS", "Calcular running total con SUM OVER", "Pivotear datos con CASE WHEN"],
    SENIOR: ["Consulta recursiva con CTE para jerarquías", "Optimizar consulta con índices compuestos", "Window functions: LAG/LEAD para análisis temporal", "Implementar soft delete con particiones", "Consulta para detectar gaps en secuencias"],
  },
  php: {
    JUNIOR: ["Función que invierte un string", "Filtrar array por condición", "Contar frecuencia de palabras", "Verificar si un número es primo", "Calcular factorial recursivo"],
    MID: ["Implementar patrón Singleton", "Clase de caché simple con array", "Procesar y validar un formulario", "Implementar patrón Iterator con SPL", "Parser de CSV a array asociativo"],
    SENIOR: ["Implementar middleware pipeline PSR-15", "Container de dependencias simple", "Implementar patrón Active Record básico", "Rate limiter con Redis y PHP", "Implementar JWT desde cero"],
  },
  ruby_on_rails: {
    JUNIOR: ["Método de scope en ActiveRecord", "Validación personalizada en un modelo", "Callback before_save con lógica", "Helper method en un módulo", "Partial con locals en erb"],
    MID: ["Service object para lógica de negocio", "Concern reutilizable entre modelos", "Query object para consultas complejas", "Serializer personalizado con ActiveModel", "Background job con ActiveJob"],
    SENIOR: ["Implementar patrón CQRS en Rails", "Optimizar N+1 con includes complejos", "Implementar multi-tenancy con scopes", "Decorator pattern con Draper", "Implementar event sourcing básico"],
  },
  kotlin: {
    JUNIOR: ["Función que filtra una lista", "Encontrar el máximo en una colección", "Invertir un string", "Calcular factorial con tail recursion", "Implementar FizzBuzz"],
    MID: ["Implementar patrón Builder con data classes", "Función de extensión para transformar listas", "Sealed class para manejo de resultados", "Implementar caché con lazy delegation", "Coroutine simple con async/await"],
    SENIOR: ["Implementar Flow para streams reactivos", "DSL type-safe con function types", "Implementar patrón Observer con StateFlow", "Middleware con Higher-Order Functions", "Implementar inyección de dependencias básica"],
  },
  swift: {
    JUNIOR: ["Función que filtra un array", "Encontrar el elemento máximo", "Invertir un String en Swift", "Calcular factorial recursivo", "Implementar FizzBuzz"],
    MID: ["Implementar patrón Builder con structs", "Protocolo con tipos asociados", "Implementar Result<T,E> personalizado", "Función genérica de transformación", "Implementar caché con Dictionary"],
    SENIOR: ["Implementar async/await con Actor", "Combine publisher personalizado", "Implementar patrón Coordinator", "Type-safe builder con result builders", "Implementar un Property Wrapper"],
  },
  bash: {
    JUNIOR: ["Script que cuenta líneas de un archivo", "Script que renombra archivos en batch", "Verificar si un archivo existe", "Script que muestra los 10 procesos con más CPU", "Función que valida un email con regex"],
    MID: ["Script de backup con rotación de logs", "Parser de argumentos con getopts", "Script que monitorea un servicio y lo reinicia", "Pipeline de procesamiento de logs con awk/sed", "Script que despliega una aplicación en staging"],
    SENIOR: ["Framework de testing para scripts bash", "Script de migración de datos con rollback", "Orquestador de tareas paralelas con jobs", "Script de provisioning de servidor desde cero", "Implementar un daemon con PID file"],
  },
  r: {
    JUNIOR: ["Función que calcula estadísticas básicas de un vector", "Filtrar un data.frame por condición", "Crear un gráfico simple con base R", "Función que detecta outliers con IQR", "Leer y limpiar un CSV"],
    MID: ["Análisis de regresión lineal con interpretación", "Función de limpieza de datos con dplyr", "Visualización con ggplot2 personalizada", "Implementar validación cruzada manual", "Transformar datos con tidyr pivot"],
    SENIOR: ["Implementar algoritmo de clustering desde cero", "Pipeline de ML con caret/tidymodels", "Crear un paquete R con funciones documentadas", "Análisis de series temporales con forecast", "Implementar Shiny app con módulos"],
  },
  scala: {
    JUNIOR: ["Función que filtra una lista en Scala", "Calcular suma con fold", "Encontrar el máximo con reduce", "Función recursiva de factorial", "Implementar FizzBuzz funcional"],
    MID: ["Implementar patrón Option para nulls", "Función de composición con andThen", "Implementar patrón Either para errores", "Case class con pattern matching", "Implementar un actor simple con Akka"],
    SENIOR: ["Implementar un monad transformer simple", "Type class con implicit para serialización", "Implementar free monad para DSL", "Akka streams para procesamiento de datos", "Implementar CQRS con Event Sourcing"],
  },
  haskell: {
    JUNIOR: ["Función que calcula el factorial", "Filtrar lista con predicado", "Implementar map desde cero", "Calcular longitud de una lista", "Implementar FizzBuzz funcional"],
    MID: ["Implementar un árbol binario con fold", "Función de parsing con Maybe", "Implementar State monad simple", "Quicksort funcional", "Implementar Reader monad básico"],
    SENIOR: ["Implementar un parser combinator", "Monad transformer con ExceptT", "Implementar tipo libre (Free Monad)", "Concurrencia con STM", "Implementar un intérprete de un lenguaje simple"],
  },
  elixir: {
    JUNIOR: ["Función que filtra una lista", "Calcular factorial con recursión", "Encontrar el máximo en una lista", "Contar elementos únicos", "Implementar FizzBuzz"],
    MID: ["GenServer para estado compartido", "Implementar un caché con ETS", "Pipeline con |> para transformar datos", "Supervisión de procesos con Supervisor", "Pattern matching avanzado con guardas"],
    SENIOR: ["Implementar un sistema de pub/sub con Phoenix.PubSub", "Distributed task con Task.Supervisor", "Implementar un protocolo personalizado", "Hot code reloading en producción", "Implementar CQRS con Event Sourcing en Elixir"],
  },
  lua: {
    JUNIOR: ["Función que invierte una cadena", "Calcular factorial", "Filtrar tabla por condición", "Encontrar el máximo en una tabla", "Implementar FizzBuzz"],
    MID: ["Implementar una clase con metatables", "Implementar un iterador personalizado", "Módulo con namespace usando tables", "Implementar caché con weak references", "Coroutine productor-consumidor"],
    SENIOR: ["Implementar un sistema de eventos con coroutines", "DSL con metatables y metamethods", "Implementar un scheduler cooperativo", "Interop con C usando FFI", "Implementar un intérprete de un lenguaje simple"],
  },
  perl: {
    JUNIOR: ["Script que procesa un archivo de texto línea por línea", "Regex para extraer emails de un texto", "Función que cuenta palabras", "Invertir un string", "Verificar si un número es primo"],
    MID: ["Parser de logs con regex avanzado", "Módulo con funciones exportables", "Script de transformación de CSV", "Implementar caché simple con hash", "Manipulación de datos con map/grep"],
    SENIOR: ["Implementar un ORM básico con AUTOLOAD", "Parser de gramática con Parse::RecDescent", "Implementar un daemon con fork", "DSL con sobrecarga de operadores", "Optimizar regex con possessive quantifiers"],
  },
  erlang: {
    JUNIOR: ["Función que calcula factorial con recursión", "Enviar mensajes entre procesos", "Implementar una lista con recursión", "Verificar si una lista es palíndromo", "FizzBuzz en Erlang"],
    MID: ["Implementar un gen_server básico", "Supervisor con estrategia one_for_one", "Pool de workers con supervisión", "Hot code upgrade en producción", "Comunicación entre nodos Erlang"],
    SENIOR: ["Sistema de cola tolerante a fallos", "OTP application completa", "BEAM scheduler y reducción de procesos", "Protocolo binario personalizado", "Distributed Erlang con global registry"],
  },
  clojure: {
    JUNIOR: ["Filtrar una secuencia con filter", "Calcular factorial con recur", "Transformar un mapa con map", "FizzBuzz funcional en Clojure", "Usar reduce para sumar colección"],
    MID: ["Atom para estado mutable compartido", "Transacciones con STM y refs", "Macros simples con defmacro", "Implementar lazy sequences", "Protocolo con defprotocol"],
    SENIOR: ["Sistema de actores con core.async", "Macros complejas con syntax-quote", "Transducers para transformaciones eficientes", "Intérprete de un DSL en Clojure", "ClojureScript interop con JavaScript"],
  },
  fsharp: {
    JUNIOR: ["Filtrar una lista con List.filter", "Factorial con recursión de cola", "Pattern matching básico", "FizzBuzz funcional en F#", "Transformar lista con List.map"],
    MID: ["Discriminated unions para modelar dominio", "Railway-oriented programming con Result", "Computation expressions básicas", "Árbol binario con pattern matching", "Async workflows en F#"],
    SENIOR: ["Type provider simple en F#", "Quotations y metaprogramación", "Active patterns complejos", "Monad transformer personalizado", "Interop avanzado con C# y .NET"],
  },
  ocaml: {
    JUNIOR: ["Función recursiva de factorial", "Filtrar una lista con recursión", "Implementar map desde cero", "Pattern matching con variantes", "Calcular longitud de una lista"],
    MID: ["Árbol binario con GADTs", "Módulos y functors en OCaml", "Mónada Option para manejo de nulos", "Parser simple con Menhir", "Concurrencia con Lwt"],
    SENIOR: ["Type checker simple con GADTs", "Compilador de expresiones en OCaml", "Módulos de primera clase", "Effect handlers en OCaml 5", "Parser combinator desde cero"],
  },
  groovy: {
    JUNIOR: ["Closure que transforma una lista", "Usar GString para interpolación", "findAll y collect en colecciones", "Implementar una clase con properties", "FizzBuzz en Groovy"],
    MID: ["DSL con builder pattern", "Metaprogramación con ExpandoMetaClass", "Gradle task personalizado", "AST transformations básicas", "Script de CI/CD con Groovy"],
    SENIOR: ["Plugin de Gradle desde cero", "AST transformations complejas", "Framework de testing con DSL", "Interop avanzado con Java", "Motor de reglas con DSL Groovy"],
  },
  nim: {
    JUNIOR: ["Función que invierte una secuencia", "Factorial recursivo en Nim", "Filtrar un array por condición", "FizzBuzz en Nim", "Verificar si un número es primo"],
    MID: ["Macros para generar código repetitivo", "Iterador personalizado con iterator", "Templates genéricos en Nim", "Servidor HTTP simple con asynchttpserver", "Gestión de memoria con alloc/dealloc"],
    SENIOR: ["Compilar a JavaScript con Nim", "FFI con librerías de C en Nim", "DSL con macros avanzadas", "Zero-cost abstractions con templates", "Async runtime con asyncdispatch"],
  },
  objectivec: {
    JUNIOR: ["Clase con properties y métodos básicos", "Usar NSArray y NSDictionary", "Implementar un protocolo simple", "Bloques (blocks) básicos en ObjC", "Memory management con ARC"],
    MID: ["Categorías para extender clases", "KVO y KVC para observación", "Delegate pattern en Objective-C", "Runtime introspección con NSObject", "Interop básico con Swift"],
    SENIOR: ["Method swizzling para monkey patching", "Associated objects con runtime", "Framework con headers públicos", "Message forwarding avanzado", "Bridging header Swift/Objective-C"],
  },
  pascal: {
    JUNIOR: ["Función que calcula factorial", "Ordenar array con bubble sort", "Buscar elemento en un array", "Calcular suma de dígitos", "Verificar si un número es primo"],
    MID: ["Lista enlazada con punteros", "Árbol binario de búsqueda", "Leer y procesar archivo de texto", "Pila con array dinámico", "Recursión con backtracking"],
    SENIOR: ["Intérprete de expresiones en Pascal", "Parser descendente recursivo", "Gestión avanzada de memoria", "Units y modularización avanzada", "Grafo con algoritmo de Dijkstra"],
  },
  prolog: {
    JUNIOR: ["Definir hechos y reglas básicas", "Consulta de relaciones familiares", "Implementar member/2 desde cero", "Calcular longitud de una lista", "Implementar append/3"],
    MID: ["Quicksort en Prolog", "Problema de las N-Reinas", "Parser con DCG (Definite Clause Grammars)", "Negación por falla y cut", "Laberinto con backtracking automático"],
    SENIOR: ["Intérprete de lenguaje simple en Prolog", "Meta-predicados con call/N", "CLP(FD) para problemas de satisfacción", "Motor de inferencia hacia adelante", "Tabling y memoización en Prolog"],
  },
  cobol: {
    JUNIOR: ["Programa que suma dos números", "Leer y mostrar datos de archivo", "Usar MOVE y COMPUTE básico", "Contador con PERFORM UNTIL", "Formatear números con PICTURE"],
    MID: ["Procesar archivo de registros de longitud fija", "Reporte con WRITE y totales acumulados", "Tablas (arrays) en COBOL con OCCURS", "Lógica con IF/EVALUATE WHEN", "Acceso a BD con EXEC SQL EMBEDDED"],
    SENIOR: ["Subprogramas con CALL y LINKAGE SECTION", "Migración de batch job a COBOL moderno", "Optimizar rendimiento de programas batch", "Interfaz COBOL-Java via JNI", "Procesador de transacciones bancarias"],
  },
  fortran: {
    JUNIOR: ["Función que calcula el factorial", "Ordenar array con selection sort", "Producto escalar de dos vectores", "Búsqueda binaria iterativa", "Estadísticas básicas: media y varianza"],
    MID: ["Multiplicación de matrices con DO implícito", "Subrutinas con INTENT(IN/OUT)", "Sistema de ecuaciones con eliminación de Gauss", "Módulos y USE en Fortran 90+", "Optimizar loops con vectorización automática"],
    SENIOR: ["Paralelismo con OpenMP en Fortran", "Interop con C mediante ISO_C_BINDING", "Solver de elementos finitos simple", "Allocatable arrays para gestión dinámica", "Método de Monte Carlo paralelo con MPI"],
  },
  d: {
    JUNIOR: ["Filtrar un array con ranges", "Factorial recursivo en D", "FizzBuzz en D", "Usar ranges para transformar datos", "Encontrar el máximo en un array"],
    MID: ["Templates con CTFE (compile-time functions)", "Mixin para logging automático", "Concurrencia con std.parallelism", "Iterador personalizado con ranges", "Unit testing con unittest blocks"],
    SENIOR: ["Metaprogramación con __traits y mixins", "Allocator personalizado en D", "Interop con C y C++ via extern(C)", "UFCS y fluent interfaces", "Implementar un garbage collector incremental"],
  },
  vbnet: {
    JUNIOR: ["Función que invierte un string", "Factorial recursivo en VB.NET", "Filtrar lista con LINQ Where", "Properties y eventos básicos", "FizzBuzz en VB.NET"],
    MID: ["Async/Await con Tasks en VB.NET", "Generics y colecciones tipadas", "Observer con eventos y delegates", "LINQ to Objects avanzado", "Repositorio con Entity Framework"],
    SENIOR: ["COM Interop con Office Automation", "Reflection y emisión de código IL", "Expresiones compiladas con CodeDOM", "WCF service con contratos", "Migración de VB6 a VB.NET moderno"],
  },
  assembly: {
    JUNIOR: ["Suma de dos números en registros", "Bucle con CMP y JNE", "Mover datos entre registros y memoria", "Imprimir string con syscall write", "FizzBuzz en ensamblador x86"],
    MID: ["Función con stack frame correcto", "Ordenar array con bubble sort en ASM", "Factorial con recursión en ensamblador", "Manipulación de bits y máscaras", "Llamar funciones de C desde ensamblador"],
    SENIOR: ["Optimizar loop con instrucciones SIMD/SSE", "Implementar un hook de función en runtime", "Técnicas de mitigación de buffer overflow", "Reverse engineering de función compilada", "Shellcode con restricciones de caracteres"],
  },
  javafx: {
    JUNIOR: ["Ventana básica con Stage y Scene", "Botón con EventHandler en JavaFX", "TextField y Label para entrada", "ListView con ObservableList", "Estilos con CSS en JavaFX"],
    MID: ["FXML con Controller pattern", "Binding bidireccional con Property", "TableView con datos dinámicos", "Animaciones con Timeline y KeyFrame", "Navegación entre múltiples Scenes"],
    SENIOR: ["Arquitectura MVP/MVVM en JavaFX", "Threading con Task y Service", "Custom control con Canvas", "Drag & Drop personalizado", "Dashboard con Charts complejos"],
  },
  basic: {
    JUNIOR: ["Programa que suma dos números", "Bucle FOR del 1 al 10", "Función que calcula el factorial", "INPUT y PRINT para interacción", "FizzBuzz en BASIC"],
    MID: ["Menú interactivo con SELECT CASE", "Procesar un array con bucles", "Búsqueda lineal en array", "Subrutinas con GOSUB/RETURN", "Juego de adivinanza de número"],
    SENIOR: ["Lista enlazada simulada con arrays", "Parser de expresiones matemáticas", "Intérprete de comandos simple", "Sistema de archivos básico", "Optimizar con PEEK/POKE en memoria"],
  },
  commonlisp: {
    JUNIOR: ["Función recursiva de factorial en Common Lisp", "Filtrar una lista con remove-if-not", "Calcular longitud de lista con recursión", "Implementar map desde cero", "FizzBuzz funcional en Common Lisp"],
    MID: ["Macros con defmacro en Common Lisp", "CLOS: clases y métodos genéricos", "Implementar un árbol binario", "Closures y entornos léxicos", "Implementar memoización con hash tables"],
    SENIOR: ["Macros complejas con &body y quasiquote", "CLOS: before/after/around methods", "Implementar un intérprete en Common Lisp", "Condiciones y reinicios (restarts)", "Optimización con declare y type hints"],
  },
  default: {
    JUNIOR: ["Función que invierte una cadena de texto", "Encontrar el número mayor en una lista", "Verificar si un número es primo", "Calcular el factorial de un número", "Implementar FizzBuzz"],
    MID: ["Implementar búsqueda binaria", "Detectar ciclo en una lista enlazada", "Implementar una pila desde cero", "Encontrar el elemento más frecuente", "Implementar merge sort"],
    SENIOR: ["Implementar un árbol AVL", "Resolver el problema de la mochila 0/1", "Implementar un sistema de caché LRU", "Algoritmo de Dijkstra para camino más corto", "Implementar un intérprete de expresiones"],
  },
};

const MCQ_BY_LANG: Record<string, Record<string, string[]>> = {
  python: {
    JUNIOR: ["Tipos de datos básicos en Python", "Estructuras de control: if, for, while", "Funciones y scope en Python", "Listas, tuplas y diccionarios", "Manejo básico de excepciones"],
    MID: ["Decoradores y funciones de orden superior", "Generadores e iteradores en Python", "Programación orientada a objetos en Python", "Context managers y with statement", "Módulos, paquetes e importaciones"],
    SENIOR: ["Metaclases y descriptores en Python", "GIL y concurrencia en CPython", "Optimización de memoria con __slots__", "Asyncio y event loop avanzado", "C extensions y Cython"],
  },
  javascript: {
    JUNIOR: ["Tipos de datos y coerción en JS", "Funciones y scope en JavaScript", "Arrays: métodos map, filter, reduce", "DOM manipulation básica", "Callbacks y eventos"],
    MID: ["Closures y el scope chain", "Promesas y async/await", "Prototipos y herencia prototípica", "Event loop y microtasks/macrotasks", "Módulos ES6 vs CommonJS"],
    SENIOR: ["V8 engine: JIT compilation y optimización", "Memory leaks y garbage collection", "Web Workers y SharedArrayBuffer", "Design patterns en JavaScript", "Temporal dead zone y hoisting avanzado"],
  },
  typescript: {
    JUNIOR: ["Tipos básicos en TypeScript", "Interfaces vs type aliases", "Funciones tipadas y parámetros opcionales", "Enums en TypeScript", "Type assertions y unknown vs any"],
    MID: ["Generics y constraints", "Utility types: Partial, Required, Pick, Omit", "Discriminated unions", "Conditional types", "Decoradores y metadata"],
    SENIOR: ["Template literal types", "Infer en conditional types", "Variance en tipos genéricos", "Module augmentation", "Compiler API y transformers"],
  },
  ruby: {
    JUNIOR: ["Tipos de datos básicos en Ruby", "Bloques, Procs y lambdas", "Clases y objetos en Ruby", "Módulos e inclusión", "Iteradores básicos: each, map, select"],
    MID: ["Mixins y composición en Ruby", "Metaprogramación: method_missing, define_method", "Símbolos vs Strings en Ruby", "Comparable y Enumerable módulos", "Manejo de excepciones con rescue/ensure"],
    SENIOR: ["Eigenclass y singleton methods", "Fiber y concurrencia en Ruby", "ObjectSpace y gestión de memoria", "DSLs con instance_eval", "TracePoint para debugging avanzado"],
  },
  java: {
    JUNIOR: ["Tipos primitivos vs objetos en Java", "Herencia e interfaces", "Colecciones: List, Set, Map", "Manejo de excepciones checked/unchecked", "Modificadores de acceso"],
    MID: ["Generics y wildcards en Java", "Streams y expresiones lambda", "Concurrencia: synchronized, volatile", "Design patterns: Singleton, Factory, Observer", "JVM: ClassLoader y bytecode"],
    SENIOR: ["Garbage collectors: G1, ZGC, Shenandoah", "CompletableFuture y async programming", "Java Memory Model y happens-before", "Reflection y Annotation Processing", "GraalVM y native compilation"],
  },
  cpp: {
    JUNIOR: ["Punteros y referencias en C++", "Clases y objetos básicos", "Herencia y polimorfismo", "STL: vector, map, set", "RAII y gestión de memoria"],
    MID: ["Templates y metaprogramación básica", "Smart pointers: unique_ptr, shared_ptr", "Move semantics y rvalue references", "Lambdas y function objects", "Algoritmos STL y complejidad"],
    SENIOR: ["SFINAE y enable_if", "Variadic templates", "Undefined behavior y optimizaciones del compilador", "Lock-free programming con atomics", "Concepts en C++20"],
  },
  go: {
    JUNIOR: ["Goroutines y channels básicos", "Interfaces en Go", "Slices vs arrays en Go", "Manejo de errores con error", "Punteros en Go vs otros lenguajes"],
    MID: ["Context y cancelación de goroutines", "Select statement con channels", "Embedding vs herencia", "Defer, panic y recover", "Testing en Go con table-driven tests"],
    SENIOR: ["Memory model de Go y race conditions", "Escape analysis y stack vs heap", "Scheduler de goroutines (GOMAXPROCS)", "Plugin system en Go", "Unsafe package y cgo"],
  },
  rust: {
    JUNIOR: ["Ownership y borrowing en Rust", "References y lifetimes básicos", "Enums y pattern matching", "Result<T,E> y Option<T>", "Structs y traits básicos"],
    MID: ["Lifetimes explícitos y anotaciones", "Trait objects vs generics", "Closures y Fn/FnMut/FnOnce", "Smart pointers: Box, Rc, Arc", "Async/await en Rust"],
    SENIOR: ["Unsafe Rust y raw pointers", "Pin y Unpin para async", "Macros procedurales", "SIMD con std::arch", "Custom allocators"],
  },
  sql: {
    JUNIOR: ["Tipos de JOINs: INNER, LEFT, RIGHT, FULL", "Funciones de agregación: COUNT, SUM, AVG", "WHERE vs HAVING", "Índices: cuándo y por qué usarlos", "Normalización: 1NF, 2NF, 3NF"],
    MID: ["Window functions: ROW_NUMBER, RANK, DENSE_RANK", "CTEs vs subqueries: cuándo usar cada uno", "Transacciones y niveles de aislamiento", "Execution plans e índices compuestos", "Particionamiento de tablas"],
    SENIOR: ["MVCC: Multi-Version Concurrency Control", "Deadlocks: detección y prevención", "Sharding horizontal vs vertical", "OLAP vs OLTP: diferencias de diseño", "Query optimizer: estadísticas y hints"],
  },
  csharp: {
    JUNIOR: ["Value types vs reference types", "Properties y encapsulación", "Interfaces en C#", "LINQ básico: Where, Select, OrderBy", "Nullable types y null safety"],
    MID: ["Async/await y Task en C#", "Generics y constraints", "Extension methods", "Events y delegates", "IDisposable y finalizers"],
    SENIOR: ["Span<T> y Memory<T> para rendimiento", "Source generators", "unsafe code y stackalloc", "Async streams con IAsyncEnumerable", "Expression trees y compilación dinámica"],
  },
  kotlin: {
    JUNIOR: ["Null safety en Kotlin", "Data classes vs regular classes", "Funciones de extensión", "Lambdas y funciones de orden superior", "Sealed classes"],
    MID: ["Coroutines: launch, async, runBlocking", "Flow vs LiveData vs StateFlow", "Delegation pattern con by", "Inline functions y reified generics", "Companion objects vs object"],
    SENIOR: ["Multiplatform Kotlin (KMM)", "Arrow para programación funcional", "Kotlin Contracts", "IR compiler backend", "Coroutines internals: continuations"],
  },
  swift: {
    JUNIOR: ["Optionals y optional chaining", "Structs vs clases en Swift", "Protocolos en Swift", "Error handling con throws/try", "Closures en Swift"],
    MID: ["Generics y associated types", "Property wrappers", "Result builders", "Combine framework básico", "Memory management: ARC y retain cycles"],
    SENIOR: ["Swift Concurrency: actors y data races", "Advanced generics con where clauses", "Macros en Swift 5.9", "Inlining y performance tuning", "Bidirectional interop con Objective-C"],
  },
  bash: {
    JUNIOR: ["Variables y substitución en Bash", "Condicionales: if, case", "Bucles: for, while, until", "Funciones en Bash", "Redirección y pipes"],
    MID: ["Arrays asociativos en Bash", "Process substitution", "Trap y manejo de señales", "Here documents y here strings", "Regex con grep, sed y awk"],
    SENIOR: ["Optimización de scripts para producción", "Coprocesses y comunicación entre procesos", "Portabilidad POSIX vs bashisms", "Profiling de scripts con PS4 y xtrace", "Security: injection y sanitización"],
  },
  erlang: {
    JUNIOR: ["Modelo de actores en Erlang", "Pattern matching básico en Erlang", "Recursión y tail calls en Erlang", "Átomos vs strings en Erlang", "Procesos ligeros y message passing"],
    MID: ["OTP: GenServer, Supervisor, Application", "Hot code reloading en producción", "ETS: Erlang Term Storage", "Distribución de nodos en Erlang", "Manejo de errores: let it crash philosophy"],
    SENIOR: ["BEAM VM: scheduler preemptivo", "Mnesia: base de datos distribuida", "NIFs vs ports para interop con C", "Dialyzer y análisis de tipos en Erlang", "Observabilidad con observer y recon"],
  },
  clojure: {
    JUNIOR: ["Estructuras de datos inmutables en Clojure", "Funciones de primera clase", "Namespaces en Clojure", "Lazy evaluation con lazy-seq", "Java interop básico"],
    MID: ["STM: Software Transactional Memory", "Macros vs funciones: cuándo usar cada una", "Transducers y su eficiencia", "core.async: channels y goroutines", "Spec para validación de datos"],
    SENIOR: ["ClojureScript y compilación a JS", "Datomic: base de datos inmutable", "Polimorfismo: multimethods vs protocols", "REPL-driven development avanzado", "Optimización de rendimiento en Clojure"],
  },
  fsharp: {
    JUNIOR: ["Tipos básicos e inferencia en F#", "Pattern matching en F#", "Funciones y pipelines con |>", "Option type para nulls", "Listas y arrays en F#"],
    MID: ["Discriminated unions para modelado", "Computation expressions: seq, async, result", "Módulos y namespaces en F#", "Type providers para acceso a datos", "Units of measure en F#"],
    SENIOR: ["F# y FABLE para frontend", "Análisis estático con Fantomas y Ionide", "Interop bidireccional F#/C#", "Programación reactiva con Rx.NET en F#", "Implementar un lenguaje con FParsec"],
  },
  ocaml: {
    JUNIOR: ["Sistema de tipos estático en OCaml", "Pattern matching exhaustivo", "Módulos y archivos .mli", "Referencias mutables en OCaml", "Manejo de excepciones en OCaml"],
    MID: ["Functors y módulos de primera clase", "GADTs para tipos más precisos", "Concurrencia con Lwt vs Async", "OCaml y JavaScript con js_of_ocaml", "ppx: syntax extensions"],
    SENIOR: ["Effect handlers en OCaml 5", "Módulos dependientes y tipos abstractos", "Implementar un type checker", "Optimización del compilador nativo", "Interop con C via ctypes"],
  },
  groovy: {
    JUNIOR: ["Diferencias Groovy vs Java", "Closures en Groovy", "GStrings y templates", "Colecciones y métodos funcionales", "Dynamic typing en Groovy"],
    MID: ["Meta-object protocol de Groovy", "DSLs con Groovy: Gradle, Pipelines", "AST transformations: @Immutable, @Singleton", "Groovy vs Kotlin para JVM", "Testing con Spock framework"],
    SENIOR: ["Groovy's MOP: invokeMethod, propertyMissing", "Compilación estática con @CompileStatic", "Groovy en Jenkins Pipeline avanzado", "Crear un Gradle plugin publicable", "Optimización de rendimiento Groovy vs Java"],
  },
  nim: {
    JUNIOR: ["Sistema de tipos en Nim", "Procedimientos vs funciones en Nim", "Gestión de memoria: GC vs manual", "Importar módulos en Nim", "Diferencias Nim vs Python/C"],
    MID: ["Macros y metaprogramación en Nim", "Templates vs generics en Nim", "FFI con C: importc y exportc", "Concurrencia con async/await en Nim", "Nim targets: C, C++, JavaScript"],
    SENIOR: ["Compilación Nim a C y optimizaciones", "Destructors y lifecycle de objetos", "Implementar un DSL tipado con macros", "Zero-overhead abstractions en Nim", "Interop avanzado con Python via nimpy"],
  },
  objectivec: {
    JUNIOR: ["Diferencias entre C y Objective-C", "Manejo de memoria: MRC vs ARC", "Mensajes vs llamadas a métodos", "Categorías y extensiones", "Protocolos (interfaces) en ObjC"],
    MID: ["KVO y KVC: Key-Value Observing/Coding", "Blocks (closures) en Objective-C", "Runtime de ObjC: introspección", "Grand Central Dispatch (GCD)", "Interoperabilidad ObjC/Swift"],
    SENIOR: ["Method swizzling y sus riesgos", "Associated objects para extender clases", "Implementar un ORM ligero en ObjC", "Optimización de memoria en iOS con ObjC", "Análisis de retain cycles con Instruments"],
  },
  pascal: {
    JUNIOR: ["Variables, tipos y constantes en Pascal", "Procedimientos vs funciones", "Arrays y strings en Pascal", "Punteros básicos en Pascal", "Manejo de archivos en Pascal"],
    MID: ["Objetos y herencia en Object Pascal", "Manejo de excepciones con try/except", "Unidades (units) y modularización", "Tipos dinámicos con punteros", "Sets y enumeraciones en Pascal"],
    SENIOR: ["Delphi vs Free Pascal: diferencias", "Programación de bajo nivel con inline ASM", "Interfaz con librerías C via cdecl", "Generics en Modern Object Pascal", "Implementar un compilador simple en Pascal"],
  },
  prolog: {
    JUNIOR: ["Diferencias paradigma lógico vs imperativo", "Hechos, reglas y consultas en Prolog", "Unificación y pattern matching", "Backtracking automático en Prolog", "Listas en Prolog: head y tail"],
    MID: ["Cut (!) y sus efectos en backtracking", "Negación por falla vs negación clásica", "Meta-predicados: findall, bagof, setof", "DCG para procesamiento de lenguaje", "Aritmética y comparaciones en Prolog"],
    SENIOR: ["CLP(FD) para problemas combinatorios", "Tabling para memoización automática", "Constraint Handling Rules (CHR)", "Diferencias SWI-Prolog vs SICStus", "Implementar un intérprete Prolog en Prolog"],
  },
  cobol: {
    JUNIOR: ["Estructura de un programa COBOL", "Divisiones: IDENTIFICATION, ENVIRONMENT, DATA, PROCEDURE", "Tipos de datos y PICTURE clause", "Verbos básicos: MOVE, ADD, SUBTRACT, MULTIPLY", "Condiciones IF/ELSE en COBOL"],
    MID: ["Procesamiento de archivos secuenciales", "PERFORM VARYING para bucles", "Subprogramas y CALL/LINKAGE", "Tablas con OCCURS y DEPENDING ON", "Embedded SQL en COBOL"],
    SENIOR: ["Batch vs online processing en mainframe", "VSAM: tipos de acceso (KSDS, ESDS, RRDS)", "Optimización de programas COBOL en producción", "COBOL y APIs REST modernas", "Debugging en entorno z/OS con Debug Tool"],
  },
  fortran: {
    JUNIOR: ["Historia y evolución de Fortran", "Tipos de datos en Fortran 90+", "Arrays y operaciones vectoriales", "Subrutinas vs funciones en Fortran", "I/O básico: READ y WRITE"],
    MID: ["Módulos y USE en Fortran 90+", "Punteros y targets en Fortran", "Interoperabilidad con C via ISO_C_BINDING", "Allocatable arrays y memoria dinámica", "Fortran para computación científica vs C++"],
    SENIOR: ["OpenMP para paralelismo en Fortran", "MPI para computación distribuida", "Optimización de memoria caché en loops", "Intrínsecos matemáticos y su precisión", "Fortran en HPC: benchmark y profiling"],
  },
  d: {
    JUNIOR: ["D vs C++: principales diferencias", "Garbage collector en D", "Slices y arrays en D", "Imports y módulos en D", "unittest blocks para testing"],
    MID: ["Templates y CTFE en D", "Mixins: string mixins vs template mixins", "D y concurrencia: shared, synchronized", "Ranges y algoritmos en std.range", "Memory safety: @safe vs @system en D"],
    SENIOR: ["Metaprogramación con __traits", "Allocators personalizados en D", "BetterC: D sin garbage collector", "Interop con C y C++ en D", "LDC vs GDC vs DMD: diferencias de compilador"],
  },
  vbnet: {
    JUNIOR: ["Diferencias VB.NET vs C#", "Option Strict y Option Explicit", "Tipos de valor vs referencia en VB.NET", "LINQ básico en VB.NET", "Manejo de excepciones con Try/Catch/Finally"],
    MID: ["Async/Await en VB.NET", "Generics y colecciones en VB.NET", "Eventos y delegates en VB.NET", "Reflection en VB.NET", "Entity Framework con VB.NET"],
    SENIOR: ["COM Interop para automatización de Office", "Migración de código VB6 a VB.NET", "Emitir IL dinámicamente con Reflection.Emit", "Interop VB.NET con C# en mismo proyecto", "Rendimiento VB.NET vs C# en .NET 6+"],
  },
  assembly: {
    JUNIOR: ["Registros de propósito general x86-64", "Modos de direccionamiento", "Flags: ZF, CF, SF, OF", "Diferencia entre MOV, LEA y XCHG", "Stack y convenciones de llamada"],
    MID: ["Convención de llamada System V AMD64 ABI", "Diferencia entre CALL/RET y JMP", "Segmentos de memoria: .text, .data, .bss", "Instrucciones de cadena: MOVS, CMPS, SCAS", "Inline assembly en C/C++"],
    SENIOR: ["SIMD: SSE/AVX para vectorización", "Mitigaciones Spectre/Meltdown en CPU", "Return-oriented programming (ROP)", "Análisis de binarios con objdump/radare2", "Diferencias x86 vs ARM assembly"],
  },
  javafx: {
    JUNIOR: ["Componentes básicos de JavaFX", "Diferencias Swing vs JavaFX", "Event-driven programming en JavaFX", "Scene graph y nodos en JavaFX", "FXML vs código programático"],
    MID: ["Property binding y observables en JavaFX", "Concurrencia: Platform.runLater vs Task", "CSS styling en JavaFX", "Patrón MVC/MVP en JavaFX", "TableView con edición en celda"],
    SENIOR: ["Modularización con Java Modules (JPMS)", "GraalVM Native Image con JavaFX", "Custom skin y control desde cero", "Rendimiento: hardware acceleration en JavaFX", "Testing de UI con TestFX"],
  },
  basic: {
    JUNIOR: ["Historia de BASIC y sus variantes", "Variables y tipos de datos en BASIC", "Estructuras de control: IF, FOR, WHILE", "Funciones built-in de BASIC", "INPUT/OUTPUT básico en BASIC"],
    MID: ["Subrutinas y modularidad en BASIC", "Manejo de archivos en BASIC", "Arrays y matrices en BASIC", "Diferencias entre variantes: QBasic, VBA, FreeBASIC", "Programación de juegos en BASIC"],
    SENIOR: ["Interop con librerías externas desde BASIC", "Optimización de programas BASIC", "BASIC en microcontroladores (PICBASIC, etc.)", "Migración de código BASIC legado", "Implementar un intérprete de BASIC"],
  },
  commonlisp: {
    JUNIOR: ["Diferencias Lisp vs lenguajes imperativos", "S-expressions y evaluación en Lisp", "CAR, CDR y operaciones básicas de listas", "Funciones de primera clase en Common Lisp", "Nil, T y valores booleanos en Lisp"],
    MID: ["CLOS vs herencia en lenguajes OOP", "Macros vs funciones: diferencias fundamentales", "Paquetes (packages) y namespaces en CL", "Multiple values y values/multiple-value-bind", "Condiciones vs excepciones en Common Lisp"],
    SENIOR: ["Meta-object protocol (MOP) de CLOS", "Compilación vs interpretación en SBCL", "Restarts para manejo de errores recuperables", "Optimización de tail calls en CL", "Diferencias entre implementaciones: SBCL, CCL, ECL"],
  },
  default: {
    JUNIOR: ["Conceptos básicos de programación", "Estructuras de datos fundamentales", "Algoritmos de búsqueda y ordenamiento", "Principios de POO", "Control de flujo y funciones"],
    MID: ["Patrones de diseño: Singleton, Factory, Observer", "Complejidad algorítmica Big O", "Principios SOLID", "REST APIs y HTTP", "Testing: unit, integration, e2e"],
    SENIOR: ["Arquitectura de microservicios", "Sistemas distribuidos: CAP theorem", "Performance profiling y optimización", "Seguridad: OWASP Top 10", "Design patterns avanzados"],
  },
};

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: "JavaScript (Node.js)", typescript: "TypeScript", python: "Python",
  java: "Java", cpp: "C++", c: "C", csharp: "C#", go: "Go", rust: "Rust",
  kotlin: "Kotlin", swift: "Swift", sql: "SQL (SQLite)", php: "PHP", ruby: "Ruby",
  scala: "Scala", r: "R", bash: "Bash", perl: "Perl", lua: "Lua",
  haskell: "Haskell", elixir: "Elixir", erlang: "Erlang", clojure: "Clojure",
  fsharp: "F#", ocaml: "OCaml", commonlisp: "Common Lisp", objectivec: "Objective-C",
  pascal: "Pascal", prolog: "Prolog", cobol: "COBOL", fortran: "Fortran",
  d: "D", groovy: "Groovy", nim: "Nim", octave: "Octave", vbnet: "Visual Basic .NET",
  assembly: "Assembly (NASM)", basic: "Basic", javafx: "JavaFX",
};

export default function AIQuestionGenerator({
  onAddQuestions,
  currentLanguage = "",
  currentDifficulty = "MID",
  currentType = "MCQ",
}: Props) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [questionType, setQuestionType] = useState<"MULTIPLE_CHOICE" | "CODING">(
    currentType === "CODING" ? "CODING" : "MULTIPLE_CHOICE"
  );
  const [language, setLanguage] = useState(currentLanguage || "python");
  const [difficulty, setDifficulty] = useState<"JUNIOR" | "MID" | "SENIOR">(
    (currentDifficulty as "JUNIOR" | "MID" | "SENIOR") || "MID"
  );
  const [count, setCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<GeneratedQuestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const isCoding = questionType === "CODING";
  const langKey = language || "default";
  const diffKey = difficulty || "MID";

  // Sugerencias dinámicas por lenguaje y dificultad
  const suggestionMap = isCoding ? CODING_BY_LANG : MCQ_BY_LANG;
  const examples = (suggestionMap[langKey]?.[diffKey] ?? suggestionMap["default"]?.[diffKey] ?? suggestionMap["default"]?.["MID"] ?? []).slice(0, 3);

  const handleGenerate = async () => {
    if (!prompt.trim()) { setError("Describe qué tipo de preguntas quieres generar"); return; }
    setError(""); setLoading(true); setPreview([]); setSelected(new Set());
    try {
      const res = await fetch("/api/ai/assessment-builder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, questionType, language, difficulty, count }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setError(data.error || "Error al generar"); return; }
      setPreview(data.questions);
      setSelected(new Set(data.questions.map((_: any, i: number) => i)));
    } catch { setError("Error de conexión. Intenta de nuevo."); }
    finally { setLoading(false); }
  };

  const handleAdd = () => {
    const toAdd = preview.filter((_, i) => selected.has(i));
    if (!toAdd.length) return;
    onAddQuestions(toAdd);
    setPreview([]); setPrompt(""); setSelected(new Set()); setOpen(false);
  };

  const toggleSelect = (i: number) => setSelected(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 transition-all hover:border-violet-500 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/20 dark:text-violet-300 dark:hover:bg-violet-900/30"
      >
        <Sparkles className="h-4 w-4" />
        Generar con AI
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center p-4">
          <div className="flex w-full max-w-2xl flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
                  <Wand2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Generador de preguntas con AI</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Describe lo que necesitas y el AI crea las preguntas</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* Tipo — bloqueado si el template tiene tipo fijo */}
              {currentType === "MIXED" || !currentType ? (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "MULTIPLE_CHOICE", label: "Opción múltiple", icon: "✓" },
                    { value: "CODING", label: "Código", icon: "</>" },
                  ].map(opt => (
                    <button key={opt.value} type="button" onClick={() => setQuestionType(opt.value as any)}
                      className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                        questionType === opt.value
                          ? "border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-950/30 dark:text-violet-300"
                          : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400"
                      }`}>
                      <span>{opt.icon}</span>{opt.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border-2 border-violet-500 bg-violet-50 dark:bg-violet-950/30 px-3 py-2.5">
                  <span>{currentType === "CODING" ? "</>" : "✓"}</span>
                  <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                    {currentType === "CODING" ? "Código" : "Opción múltiple"}
                  </span>
                  <span className="ml-auto text-[10px] text-violet-500">Definido por el template</span>
                </div>
              )}

              {/* Config */}
              <div className={`grid gap-3 ${isCoding ? "grid-cols-2" : "grid-cols-1"}`}>
                {isCoding && (
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Lenguaje</label>
                    <select value={language} onChange={e => setLanguage(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500">
                      {Object.entries(LANGUAGE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Cuántas preguntas generar
                  </label>
                  <select value={count} onChange={e => setCount(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500">
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} pregunta{n>1?"s":""}</option>)}
                  </select>
                </div>
              </div>
              {/* Nivel heredado del template — mostrar como badge informativo */}
              <div className="flex items-center gap-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3 py-2">
                <span className="text-[10px] text-zinc-400">Nivel:</span>
                <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
                  {difficulty === "JUNIOR" ? "Junior" : difficulty === "SENIOR" ? "Senior" : "Mid Level"}
                </span>
                <span className="text-[10px] text-zinc-400 ml-1">— heredado del template</span>
              </div>

              {/* Prompt */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Describe qué quieres evaluar *</label>
                <textarea
                  value={prompt}
                  onChange={e => { setPrompt(e.target.value); setError(""); }}
                  placeholder={isCoding
                    ? `Ej: ${examples[0] ?? "Función que resuelve un problema específico"}...`
                    : `Ej: ${examples[0] ?? "Preguntas sobre conceptos del lenguaje"}...`
                  }
                  rows={3}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {examples.map(ex => (
                    <button key={ex} type="button" onClick={() => setPrompt(ex)}
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[10px] text-zinc-500 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-violet-700 dark:hover:text-violet-400 transition-colors">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-800/40 dark:bg-red-950/20">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              {/* Preview */}
              {preview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                      {preview.length} pregunta{preview.length>1?"s":""} generada{preview.length>1?"s":""} — selecciona cuáles agregar
                    </p>
                    <button type="button" onClick={() => setSelected(selected.size===preview.length ? new Set() : new Set(preview.map((_,i)=>i)))}
                      className="text-[10px] text-violet-600 hover:underline dark:text-violet-400">
                      {selected.size===preview.length ? "Deseleccionar todas" : "Seleccionar todas"}
                    </button>
                  </div>
                  {preview.map((q, i) => (
                    <button key={i} type="button" onClick={() => toggleSelect(i)}
                      className={`w-full text-left rounded-xl border-2 p-3 transition-all ${
                        selected.has(i) ? "border-violet-400 bg-violet-50 dark:border-violet-600 dark:bg-violet-950/20" : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700"
                      }`}>
                      <div className="flex items-start gap-2.5">
                        <div className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${selected.has(i) ? "border-violet-500 bg-violet-500" : "border-zinc-300 dark:border-zinc-600"}`}>
                          {selected.has(i) && <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">{q.section}</span>
                            <span className="text-[10px] text-zinc-400">·</span>
                            <span className="text-[10px] text-zinc-400">{q.difficulty}</span>
                            {q.testCases && <><span className="text-[10px] text-zinc-400">·</span><span className="text-[10px] text-zinc-400">{q.testCases.length} test cases</span></>}
                            {q.options && <><span className="text-[10px] text-zinc-400">·</span><span className="text-[10px] text-zinc-400">{q.options.length} opciones</span></>}
                          </div>
                          <p className="text-xs text-zinc-800 dark:text-zinc-200 line-clamp-2">{q.questionText}</p>
                          {q.options && (
                            <div className="mt-1.5 space-y-0.5">
                              {q.options.map((opt, j) => (
                                <p key={j} className={`text-[10px] flex items-center gap-1 ${opt.isCorrect ? "text-emerald-600 font-medium dark:text-emerald-400" : "text-zinc-400"}`}>
                                  {opt.isCorrect ? "✓" : "○"} {opt.text}
                                </p>
                              ))}
                            </div>
                          )}
                          {q.codeSnippet && (
                            <pre className="mt-1.5 rounded bg-zinc-900 px-2 py-1.5 text-[10px] text-green-400 font-mono line-clamp-3 overflow-hidden">{q.codeSnippet}</pre>
                          )}
                          {q.testCases && q.testCases.length > 0 && (
                            <div className="mt-1.5 space-y-1">
                              {q.testCases.filter(tc => !tc.isHidden).slice(0, 2).map((tc, ti) => (
                                <div key={ti} className="flex items-start gap-2 rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-[10px] font-mono">
                                  <span className="text-zinc-400 shrink-0">in:</span>
                                  <span className="text-zinc-700 dark:text-zinc-300 truncate">{tc.input}</span>
                                  <span className="text-zinc-400 shrink-0 ml-1">→</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 truncate">{tc.expectedOutput}</span>
                                </div>
                              ))}
                              {q.testCases.filter(tc => tc.isHidden).length > 0 && (
                                <p className="text-[10px] text-zinc-400 italic">
                                  + {q.testCases.filter((tc: any) => tc.isHidden).length} casos ocultos (el candidato no los ve)
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <p className="text-[10px] text-zinc-400">✨ Powered by AI · Revisa las preguntas antes de publicar</p>
              <div className="flex gap-2">
                {preview.length === 0 ? (
                  <button type="button" onClick={handleGenerate} disabled={loading || !prompt.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin"/>Generando...</> : <><Sparkles className="h-4 w-4"/>Generar</>}
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={handleGenerate} disabled={loading}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 disabled:opacity-50">
                      <Sparkles className="h-3.5 w-3.5"/>Regenerar
                    </button>
                    <button type="button" onClick={handleAdd} disabled={selected.size===0}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                      <Plus className="h-4 w-4"/>Agregar {selected.size>0 ? `(${selected.size})` : ""}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}