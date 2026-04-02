// prisma/seeds/nfq-junior-assessments.ts

export type SeedOption = {
  id: string
  text: string
  isCorrect: boolean
}

export type SeedQuestion = {
  section: string
  tags: string[]
  questionText: string
  allowMultiple: boolean
  difficulty: "JUNIOR" | "MID" | "SENIOR"
  explanation?: string
  options: SeedOption[]
}

export type SeedAssessmentTemplate = {
  slug: string
  title: string
  description: string
  instructions: string
  type: "MCQ" | "CODING" | "MIXED"
  difficulty: "JUNIOR" | "MID" | "SENIOR"
  timeLimit: number
  passingScore: number
  maxAttempts: number
  allowRetry: boolean
  shuffleQuestions: boolean
  penalizeWrong: boolean
  isActive: boolean
  isGlobal: boolean
  language: string | null
  sections: { title: string; weight?: number }[]
  questions: SeedQuestion[]
}

export const nfqJuniorAssessments: SeedAssessmentTemplate[] = [
  {
    slug: "JAVA_JUNIOR_NFQ",
    title: "NFQ - Java Junior",
    description:
      "Evaluación diagnóstica junior de Java enfocada en fundamentos, Java 8, Streams, Optional, Git y conceptos básicos de HTTP.",
    instructions:
      "Lee cada pregunta con atención. Algunas preguntas son de opción única y otras de opción múltiple. El puntaje mínimo aprobatorio es 50%.",
    type: "MCQ",
    difficulty: "JUNIOR",
    timeLimit: 30,
    passingScore: 50,
    maxAttempts: 1,
    allowRetry: false,
    shuffleQuestions: false,
    penalizeWrong: false,
    isActive: true,
    isGlobal: true,
    language: "java",
    sections: [
      { title: "Fundamentos de Java" },
      { title: "Java 8 / Streams / Lambdas" },
      { title: "Git y HTTP básico" },
    ],
    questions: [
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "java8", "lambda"],
        questionText: "¿Cuál es el propósito principal de las expresiones lambda en Java 8?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation:
          "Las lambdas permiten expresar comportamiento de forma más compacta, especialmente con interfaces funcionales.",
        options: [
          { id: "a", text: "Simplificar la declaración de variables", isCorrect: false },
          {
            id: "b",
            text: "Escribir comportamiento de forma más concisa con interfaces funcionales",
            isCorrect: true,
          },
          { id: "c", text: "Permitir el uso de métodos estáticos en interfaces", isCorrect: false },
          { id: "d", text: "Facilitar el manejo de excepciones", isCorrect: false },
        ],
      },
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "java8", "optional"],
        questionText: "¿Qué método se utiliza para obtener un Optional vacío en Java 8?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "empty()", isCorrect: true },
          { id: "b", text: "null()", isCorrect: false },
          { id: "c", text: "none()", isCorrect: false },
          { id: "d", text: "void()", isCorrect: false },
        ],
      },
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "java8", "optional"],
        questionText: "¿Cuál de las siguientes afirmaciones sobre Optional en Java 8 es verdadera?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "Puede contener valores null como valor interno válido", isCorrect: false },
          { id: "b", text: "Es una clase final y no se puede extender", isCorrect: true },
          { id: "c", text: "Siempre debe inicializarse con un valor", isCorrect: false },
          { id: "d", text: "Fue introducida en Java 7", isCorrect: false },
        ],
      },
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "java8", "predicate"],
        questionText: "¿Cuál es el propósito principal de la interfaz Predicate en Java 8?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "Representar una función que transforma un valor", isCorrect: false },
          { id: "b", text: "Representar una operación sin valor de retorno", isCorrect: false },
          { id: "c", text: "Evaluar una condición y devolver true/false", isCorrect: true },
          { id: "d", text: "Representar una secuencia de elementos", isCorrect: false },
        ],
      },
      {
        section: "Fundamentos de Java",
        tags: ["java", "basics", "char"],
        questionText: "¿Cuál es el tamaño de una variable char en Java?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "8 bits", isCorrect: false },
          { id: "b", text: "16 bits", isCorrect: true },
          { id: "c", text: "32 bits", isCorrect: false },
          { id: "d", text: "64 bits", isCorrect: false },
        ],
      },
      {
        section: "Fundamentos de Java",
        tags: ["java", "basics", "string"],
        questionText: "¿Cuál es el valor por defecto de una variable de instancia String no inicializada?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "null", isCorrect: true },
          { id: "b", text: "\"\"", isCorrect: false },
          { id: "c", text: "undefined", isCorrect: false },
          { id: "d", text: "\"-\"", isCorrect: false },
        ],
      },
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "streams", "distinct", "count"],
        questionText: "¿Qué hace la operación stream.distinct().count()?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "Devuelve el primer elemento del Stream", isCorrect: false },
          { id: "b", text: "Cuenta cuántos elementos distintos hay en el Stream", isCorrect: true },
          { id: "c", text: "Elimina duplicados y devuelve el Stream completo", isCorrect: false },
          { id: "d", text: "Lanza excepción por uso incorrecto", isCorrect: false },
        ],
      },
      {
        section: "Fundamentos de Java",
        tags: ["java", "collections", "set"],
        questionText: "¿Cuál de las siguientes características describe mejor a Set en Java?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          {
            id: "a",
            text: "Permite valores duplicados y mantiene orden de inserción siempre",
            isCorrect: false,
          },
          { id: "b", text: "No permite elementos duplicados", isCorrect: true },
          { id: "c", text: "Siempre requiere claves y valores", isCorrect: false },
          { id: "d", text: "Nunca permite null", isCorrect: false },
        ],
      },
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "java8", "features"],
        questionText: "¿Cuál de las siguientes NO fue introducida en Java 8?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "Streams", isCorrect: false },
          { id: "b", text: "Lambdas", isCorrect: false },
          { id: "c", text: "Generics", isCorrect: true },
          { id: "d", text: "Optional", isCorrect: false },
        ],
      },
      {
        section: "Fundamentos de Java",
        tags: ["java", "basics", "types"],
        questionText: "¿Cuál de estas asignaciones es válida en Java?",
        allowMultiple: true,
        difficulty: "JUNIOR",
        explanation:
          "double puede recibir enteros; char puede recibir un literal entero compatible; long acepta sufijo l/L.",
        options: [
          { id: "a", text: "double x = 2.0f;", isCorrect: true },
          { id: "b", text: "double x = 2;", isCorrect: true },
          { id: "c", text: "float x = 6d;", isCorrect: false },
          { id: "d", text: "char x = 66;", isCorrect: true },
          { id: "e", text: "long x = 128L;", isCorrect: true },
        ],
      },
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "streams", "findfirst"],
        questionText: "¿Qué método se utiliza para obtener el primer elemento de un Stream en Java 8?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "first()", isCorrect: false },
          { id: "b", text: "getFirst()", isCorrect: false },
          { id: "c", text: "findFirst()", isCorrect: true },
          { id: "d", text: "head()", isCorrect: false },
        ],
      },
      {
        section: "Fundamentos de Java",
        tags: ["java", "oop", "inheritance"],
        questionText: "Respecto a una superclase en Java, ¿cuáles afirmaciones son correctas?",
        allowMultiple: true,
        difficulty: "JUNIOR",
        options: [
          {
            id: "a",
            text: "Los miembros private de la superclase no son accesibles directamente desde una subclase",
            isCorrect: true,
          },
          {
            id: "b",
            text: "Los miembros protected de la superclase pueden ser accesibles desde subclases",
            isCorrect: true,
          },
          {
            id: "c",
            text: "Los miembros public de la superclase son accesibles desde otras clases según las reglas normales de visibilidad",
            isCorrect: true,
          },
          { id: "d", text: "No existen superclases en Java", isCorrect: false },
        ],
      },
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "streams", "reduce"],
        questionText: "¿Cuál afirmación sobre reduce() en Java 8 es correcta?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "Solo puede usarse con Streams de números", isCorrect: false },
          { id: "b", text: "Siempre devuelve Optional", isCorrect: false },
          { id: "c", text: "Permite combinar elementos del Stream en un solo resultado", isCorrect: true },
          { id: "d", text: "Lanza excepción si el Stream está vacío en todos los casos", isCorrect: false },
        ],
      },
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "streams", "foreach"],
        questionText: "¿Qué método de Stream se utiliza para ejecutar una acción por cada elemento?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "iterate()", isCorrect: false },
          { id: "b", text: "forEach()", isCorrect: true },
          { id: "c", text: "perform()", isCorrect: false },
          { id: "d", text: "apply()", isCorrect: false },
        ],
      },
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "lambda", "scope"],
        questionText: "¿Cuál afirmación sobre las expresiones lambda en Java 8 es verdadera?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "Siempre es obligatorio declarar el tipo de los parámetros", isCorrect: false },
          {
            id: "b",
            text: "Pueden acceder a variables locales final o efectivamente final",
            isCorrect: true,
          },
          { id: "c", text: "No se utilizan con interfaces funcionales", isCorrect: false },
          {
            id: "d",
            text: "Pueden modificar libremente cualquier variable local externa",
            isCorrect: false,
          },
        ],
      },
      {
        section: "Fundamentos de Java",
        tags: ["java", "exceptions", "throwable"],
        questionText: "¿Cuál es la superclase común de Error y Exception en Java?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "RuntimeException", isCorrect: false },
          { id: "b", text: "Thread", isCorrect: false },
          { id: "c", text: "Throwable", isCorrect: true },
          { id: "d", text: "Object", isCorrect: false },
        ],
      },
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "streams", "maptoint", "sum"],
        questionText: "¿Cuál es el resultado de stream.mapToInt(x -> x * 2).sum() sobre una colección de enteros?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "Cuenta cuántos elementos hay en el Stream", isCorrect: false },
          {
            id: "b",
            text: "Multiplica cada elemento por 2 y suma todos los resultados",
            isCorrect: true,
          },
          { id: "c", text: "Devuelve un nuevo Stream sin sumar", isCorrect: false },
          { id: "d", text: "Lanza excepción por uso inválido de sum()", isCorrect: false },
        ],
      },
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "streams", "basics"],
        questionText: "¿Cuál es el propósito principal de la clase Stream en Java 8?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "Realizar operaciones de entrada y salida", isCorrect: false },
          { id: "b", text: "Implementar concurrencia", isCorrect: false },
          {
            id: "c",
            text: "Representar una secuencia de elementos y procesarla declarativamente",
            isCorrect: true,
          },
          { id: "d", text: "Cifrar datos", isCorrect: false },
        ],
      },
      {
        section: "Fundamentos de Java",
        tags: ["java", "arrays", "output"],
        questionText:
          "¿Qué imprime este código?\n\nint[] a = {1, 2, 3, 4, 5, 6};\nint i = a.length - 1;\nwhile (i >= 0) {\n  System.out.print(a[i]);\n  i--;\n}",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "123456", isCorrect: false },
          { id: "b", text: "654321", isCorrect: true },
          { id: "c", text: "0", isCorrect: false },
          { id: "d", text: "No imprime nada", isCorrect: false },
        ],
      },
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "lambda", "exceptions"],
        questionText: "¿Cuál afirmación sobre excepciones en expresiones lambda es correcta?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "Las lambdas no pueden lanzar excepciones", isCorrect: false },
          {
            id: "b",
            text: "Las checked exceptions deben respetar la firma funcional utilizada",
            isCorrect: true,
          },
          { id: "c", text: "Las lambdas manejan automáticamente todas las excepciones", isCorrect: false },
          { id: "d", text: "Las excepciones checked siempre se ignoran dentro de una lambda", isCorrect: false },
        ],
      },
      {
        section: "Git y HTTP básico",
        tags: ["git", "branch"],
        questionText: "¿En qué caso se utiliza git branch?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "Para listar ramas locales", isCorrect: true },
          { id: "b", text: "Para ver archivos modificados", isCorrect: false },
          { id: "c", text: "Para descargar un repositorio", isCorrect: false },
          { id: "d", text: "Para enviar archivos al stage", isCorrect: false },
        ],
      },
      {
        section: "Git y HTTP básico",
        tags: ["git", "status"],
        questionText: "¿Qué comando muestra archivos modificados en Git?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "git clone", isCorrect: false },
          { id: "b", text: "git status", isCorrect: true },
          { id: "c", text: "git pull", isCorrect: false },
          { id: "d", text: "git checkout", isCorrect: false },
        ],
      },
      {
        section: "Git y HTTP básico",
        tags: ["git", "clone"],
        questionText: "¿Qué comando descarga un repositorio remoto?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "git clone", isCorrect: true },
          { id: "b", text: "git download", isCorrect: false },
          { id: "c", text: "git status", isCorrect: false },
          { id: "d", text: "git push", isCorrect: false },
        ],
      },
      {
        section: "Git y HTTP básico",
        tags: ["git", "checkout", "branch"],
        questionText: "¿Qué comando crea una rama y cambia a ella en un solo paso?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "git branch nueva-rama", isCorrect: false },
          { id: "b", text: "git checkout -b nueva-rama", isCorrect: true },
          { id: "c", text: "git switch nueva-rama --create=false", isCorrect: false },
          { id: "d", text: "git pull nueva-rama", isCorrect: false },
        ],
      },
      {
        section: "Git y HTTP básico",
        tags: ["git", "pull"],
        questionText: "¿Qué comando actualiza tu repositorio local con cambios del remoto?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "git update", isCorrect: false },
          { id: "b", text: "git checkout", isCorrect: false },
          { id: "c", text: "git pull", isCorrect: true },
          { id: "d", text: "git stage", isCorrect: false },
        ],
      },
      {
        section: "Git y HTTP básico",
        tags: ["http", "404"],
        questionText: "¿Qué código HTTP indica que un recurso no fue encontrado?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "201", isCorrect: false },
          { id: "b", text: "204", isCorrect: false },
          { id: "c", text: "404", isCorrect: true },
          { id: "d", text: "500", isCorrect: false },
        ],
      },
      {
        section: "Git y HTTP básico",
        tags: ["http", "204"],
        questionText: "¿Qué código HTTP indica que la solicitud fue exitosa pero no hay contenido en la respuesta?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "200", isCorrect: false },
          { id: "b", text: "201", isCorrect: false },
          { id: "c", text: "204", isCorrect: true },
          { id: "d", text: "301", isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: "API_DESIGNER_JUNIOR_NFQ",
    title: "NFQ - API Designer Junior",
    description:
      "Evaluación diagnóstica junior enfocada en fundamentos de REST, HTTP, media types, idempotencia y diseño básico de endpoints.",
    instructions:
      "Lee cada pregunta con atención. Algunas preguntas son de opción única y otras de opción múltiple. El puntaje mínimo aprobatorio es 50%.",
    type: "MCQ",
    difficulty: "JUNIOR",
    timeLimit: 20,
    passingScore: 50,
    maxAttempts: 1,
    allowRetry: false,
    shuffleQuestions: false,
    penalizeWrong: false,
    isActive: true,
    isGlobal: true,
    language: null,
    sections: [
      { title: "REST y HTTP" },
      { title: "Diseño de recursos" },
      { title: "Git básico" },
    ],
    questions: [
      {
        section: "Diseño de recursos",
        tags: ["api", "rest", "path-param"],
        questionText: "¿Para qué sirve un URI param (path param)?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "Para recibir los datos del response", isCorrect: false },
          {
            id: "b",
            text: "Para identificar el recurso específico sobre el que se va a operar",
            isCorrect: true,
          },
          { id: "c", text: "Para actualizar el recurso automáticamente", isCorrect: false },
          { id: "d", text: "Para definir el body de la petición", isCorrect: false },
        ],
      },
      {
        section: "REST y HTTP",
        tags: ["api", "raml"],
        questionText: "¿Qué es RAML?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "Un lenguaje de definición de APIs", isCorrect: true },
          { id: "b", text: "Una arquitectura", isCorrect: false },
          { id: "c", text: "Un estilo arquitectónico", isCorrect: false },
          { id: "d", text: "Un protocolo de comunicación", isCorrect: false },
        ],
      },
      {
        section: "REST y HTTP",
        tags: ["api", "rest"],
        questionText: "¿Qué es REST?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "Un formato de transferencia", isCorrect: false },
          { id: "b", text: "Una arquitectura", isCorrect: false },
          { id: "c", text: "Un estilo arquitectónico", isCorrect: true },
          { id: "d", text: "Un protocolo de comunicación", isCorrect: false },
        ],
      },
      {
        section: "REST y HTTP",
        tags: ["http", "404"],
        questionText: "¿Qué código de estado representa un recurso no encontrado?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "201", isCorrect: false },
          { id: "b", text: "400", isCorrect: false },
          { id: "c", text: "404", isCorrect: true },
          { id: "d", text: "500", isCorrect: false },
        ],
      },
      {
        section: "REST y HTTP",
        tags: ["http", "400"],
        questionText: "¿Qué significa HTTP 400?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "Bad Request", isCorrect: true },
          { id: "b", text: "Request exitosa", isCorrect: false },
          { id: "c", text: "Acción inválida del servidor", isCorrect: false },
          { id: "d", text: "Error leve", isCorrect: false },
        ],
      },
      {
        section: "REST y HTTP",
        tags: ["api", "rest", "principles"],
        questionText: "¿Cuál opción contiene principios de REST?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "Analógico, estructuración, lineal", isCorrect: false },
          { id: "b", text: "Basado en Java, uso de Web Services, microservicios", isCorrect: false },
          { id: "c", text: "Peticiones con estado, persistencia, orientación a acciones", isCorrect: false },
          { id: "d", text: "Stateless, interfaz uniforme y múltiples representaciones", isCorrect: true },
        ],
      },
      {
        section: "Diseño de recursos",
        tags: ["http", "post", "create"],
        questionText: "¿Qué método HTTP se utiliza normalmente para crear un nuevo recurso?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "HEAD", isCorrect: false },
          { id: "b", text: "POST", isCorrect: true },
          { id: "c", text: "LIST", isCorrect: false },
          { id: "d", text: "OPTIONS", isCorrect: false },
        ],
      },
      {
        section: "Diseño de recursos",
        tags: ["http", "delete"],
        questionText: "¿Qué método HTTP elimina un recurso?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "DEL", isCorrect: false },
          { id: "b", text: "DELETE", isCorrect: true },
          { id: "c", text: "OPTIONS", isCorrect: false },
          { id: "d", text: "UPDATE", isCorrect: false },
        ],
      },
      {
        section: "Diseño de recursos",
        tags: ["http", "patch", "partial-update"],
        questionText: "¿Qué método HTTP se utiliza para actualizar parcialmente un recurso?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "GET", isCorrect: false },
          { id: "b", text: "PATCH", isCorrect: true },
          { id: "c", text: "OPTIONS", isCorrect: false },
          { id: "d", text: "HEAD", isCorrect: false },
        ],
      },
      {
        section: "REST y HTTP",
        tags: ["http", "media-type", "content-type"],
        questionText: "¿Qué es un media type?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          {
            id: "a",
            text: "Un identificador del formato del contenido transmitido, como application/json",
            isCorrect: true,
          },
          { id: "b", text: "Un archivo multimedia", isCorrect: false },
          { id: "c", text: "Un metadato interno de un archivo local", isCorrect: false },
          { id: "d", text: "Una lista de extensiones como jpg, avi y mp3", isCorrect: false },
        ],
      },
      {
        section: "REST y HTTP",
        tags: ["http", "idempotency"],
        questionText: "Selecciona los métodos HTTP idempotentes",
        allowMultiple: true,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "GET", isCorrect: true },
          { id: "b", text: "PUT", isCorrect: true },
          { id: "c", text: "DELETE", isCorrect: true },
          { id: "d", text: "POST", isCorrect: false },
        ],
      },
      {
        section: "REST y HTTP",
        tags: ["api", "rest", "http"],
        questionText: "¿Qué protocolo de comunicación utiliza comúnmente una API REST?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "SOAP", isCorrect: false },
          { id: "b", text: "HTTP", isCorrect: true },
          { id: "c", text: "JSON", isCorrect: false },
          { id: "d", text: "XML", isCorrect: false },
        ],
      },
      {
        section: "REST y HTTP",
        tags: ["http", "204"],
        questionText: "¿Qué código HTTP indica éxito sin body en la respuesta?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "200", isCorrect: false },
          { id: "b", text: "201", isCorrect: false },
          { id: "c", text: "204", isCorrect: true },
          { id: "d", text: "500", isCorrect: false },
        ],
      },
      {
        section: "REST y HTTP",
        tags: ["soap", "xml", "rest", "json"],
        questionText: "SOAP es a XML como...",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "REST es a JSON", isCorrect: true },
          { id: "b", text: "JSON es a Java", isCorrect: false },
          { id: "c", text: "HTTP es a Web", isCorrect: false },
          { id: "d", text: "REST es a RAML", isCorrect: false },
        ],
      },
      {
        section: "Diseño de recursos",
        tags: ["rest", "antipattern", "endpoints"],
        questionText: "¿Cuál de las siguientes rutas representa un antipatrón en un diseño REST?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "POST /customers", isCorrect: false },
          { id: "b", text: "GET /update_customers/12345", isCorrect: true },
          { id: "c", text: "PATCH /accounts/12345/related-contracts/67890", isCorrect: false },
          { id: "d", text: "GET /customers/12345", isCorrect: false },
        ],
      },
      {
        section: "REST y HTTP",
        tags: ["http", "204"],
        questionText: "¿Qué significa HTTP 204?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "Éxito con body", isCorrect: false },
          { id: "b", text: "Éxito sin body", isCorrect: true },
          { id: "c", text: "Error del cliente configurable", isCorrect: false },
          { id: "d", text: "Redirección", isCorrect: false },
        ],
      },
      {
        section: "REST y HTTP",
        tags: ["http", "4xx", "5xx"],
        questionText: "¿Cuál es la diferencia entre los códigos 4xx y 5xx?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "4xx son errores del cliente y 5xx son errores del servidor", isCorrect: true },
          { id: "b", text: "5xx son errores del cliente y 4xx son errores del servidor", isCorrect: false },
          { id: "c", text: "4xx son redirecciones y 5xx son errores del servidor", isCorrect: false },
          { id: "d", text: "No existe una diferencia semántica real", isCorrect: false },
        ],
      },
      {
        section: "Git básico",
        tags: ["git", "branch"],
        questionText: "¿Qué comando de Git lista todas las ramas locales?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "git branch", isCorrect: true },
          { id: "b", text: "git branch +add", isCorrect: false },
          { id: "c", text: "branch staged", isCorrect: false },
          { id: "d", text: "git staged", isCorrect: false },
        ],
      },
      {
        section: "Git básico",
        tags: ["git", "add", "staging"],
        questionText: "¿Qué comando envía archivos al staging area en Git?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "git add .", isCorrect: true },
          { id: "b", text: "git branch", isCorrect: false },
          { id: "c", text: "git clone", isCorrect: false },
          { id: "d", text: "git staged", isCorrect: false },
        ],
      },
      {
        section: "Git básico",
        tags: ["git", "status"],
        questionText: "¿Qué comando de Git muestra archivos modificados?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "git status", isCorrect: true },
          { id: "b", text: "git clone", isCorrect: false },
          { id: "c", text: "git download", isCorrect: false },
          { id: "d", text: "git update", isCorrect: false },
        ],
      },
      {
        section: "Git básico",
        tags: ["git", "pull"],
        questionText: "¿Qué comando actualiza tu repositorio local con cambios del remoto?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "git checkout", isCorrect: false },
          { id: "b", text: "git pull", isCorrect: true },
          { id: "c", text: "git update", isCorrect: false },
          { id: "d", text: "git merge remote", isCorrect: false },
        ],
      },
      {
        section: "Git básico",
        tags: ["git", "clone"],
        questionText: "¿Qué comando descarga un repositorio remoto?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "git clone", isCorrect: true },
          { id: "b", text: "git status", isCorrect: false },
          { id: "c", text: "git download", isCorrect: false },
          { id: "d", text: "clone download repo", isCorrect: false },
        ],
      },
      {
        section: "Git básico",
        tags: ["git", "checkout", "branch"],
        questionText: "¿Qué comando crea una rama y se mueve a ella?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        options: [
          { id: "a", text: "git create rama", isCorrect: false },
          { id: "b", text: "git checkout -b rama", isCorrect: true },
          { id: "c", text: "create git rama +1", isCorrect: false },
          { id: "d", text: "git rama", isCorrect: false },
        ],
      },
      {
        section: "Diseño de recursos",
        tags: ["rest", "resources", "post"],
        questionText:
          "¿Cuál de las siguientes rutas representa correctamente la creación de un crédito para un carro desde una perspectiva REST simple?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation:
          "En REST conviene modelar recursos con sustantivos y usar POST para creación.",
        options: [
          { id: "a", text: "POST /credits/v0/credits/cars", isCorrect: false },
          { id: "b", text: "POST /credits/v0/credits/credit-car", isCorrect: false },
          { id: "c", text: "PUT /credits/v0/credits/credit-car", isCorrect: false },
          { id: "d", text: "POST /v0/credits/cars", isCorrect: true },
        ],
      },
    ],
  },
]