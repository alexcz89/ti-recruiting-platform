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
    isGlobal: false,
    language: "java",
    sections: [
      { title: "Fundamentos de Java" },
      { title: "Java 8 / Streams / Lambdas" },
      { title: "Git y HTTP básico" },
    ],
    questions: [
      // Q3
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "java8", "features"],
        questionText: "¿Cuál de las siguientes NO fue introducida en Java 8?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "Generics fue introducido en Java 5. Streams, Lambdas y Optional son características de Java 8.",
        options: [
          { id: "a", text: "Streams", isCorrect: false },
          { id: "b", text: "Lambdas", isCorrect: false },
          { id: "c", text: "Generics", isCorrect: true },
          { id: "d", text: "Optional", isCorrect: false },
        ],
      },
      // Q4
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "java8", "lambda"],
        questionText: "¿Cuál es el propósito principal de las expresiones lambda en Java 8?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "Las lambdas permiten implementar interfaces funcionales de forma concisa, siendo la representación más compacta de clases anónimas de un solo método.",
        options: [
          { id: "a", text: "Simplificar la declaración de variables", isCorrect: false },
          { id: "b", text: "Reemplazar por completo las clases anónimas", isCorrect: true },
          { id: "c", text: "Permitir el uso de métodos estáticos en interfaces", isCorrect: false },
          { id: "d", text: "Facilitar el manejo de excepciones", isCorrect: false },
        ],
      },
      // Q5
      {
        section: "Fundamentos de Java",
        tags: ["java", "arrays", "loops", "output"],
        questionText: "¿Qué imprime en consola el siguiente código?\n\nint[] a = {1, 2, 3, 4, 5, 6};\nint i = a.length - 1;\nwhile (i >= 0) {\n    System.out.print(a[i]);\n    i--;\n}",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "El ciclo recorre el arreglo de derecha a izquierda (desde el índice 5 hasta 0), imprimiendo 6,5,4,3,2,1 → 654321.",
        options: [
          { id: "a", text: "0", isCorrect: false },
          { id: "b", text: "123456", isCorrect: false },
          { id: "c", text: "el tipo de array concatenando el hash code del arreglo", isCorrect: false },
          { id: "d", text: "654321", isCorrect: true },
          { id: "e", text: "no imprime nada, manda error", isCorrect: false },
        ],
      },
      // Q6
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "java8", "sort", "lambda", "collections"],
        questionText: "¿Qué método se utiliza para ordenar una colección utilizando una expresión lambda en Java 8?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "List.sort(Comparator) y Collections.sort() aceptan un Comparator expresado como lambda.",
        options: [
          { id: "a", text: "sort()", isCorrect: true },
          { id: "b", text: "sortList()", isCorrect: false },
          { id: "c", text: "sortBy()", isCorrect: false },
          { id: "d", text: "order()", isCorrect: false },
        ],
      },
      // Q7
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "java8", "streams", "filter"],
        questionText: "¿Qué método se utiliza para filtrar elementos de una colección utilizando una expresión lambda en Java?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "Stream.filter(Predicate) devuelve un nuevo Stream con solo los elementos que satisfacen la condición.",
        options: [
          { id: "a", text: "select()", isCorrect: false },
          { id: "b", text: "filter()", isCorrect: true },
          { id: "c", text: "find()", isCorrect: false },
          { id: "d", text: "match()", isCorrect: false },
        ],
      },
      // Q8
      {
        section: "Fundamentos de Java",
        tags: ["java", "basics", "char", "types", "size"],
        questionText: "¿Cuál es el tamaño de una variable char en Java?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "char en Java ocupa 16 bits (2 bytes) y puede almacenar cualquier carácter Unicode UTF-16 (rango 0–65535).",
        options: [
          { id: "a", text: "4 bits", isCorrect: false },
          { id: "b", text: "8 bits", isCorrect: false },
          { id: "c", text: "16 bits", isCorrect: true },
          { id: "d", text: "32 bits", isCorrect: false },
          { id: "e", text: "64 bits", isCorrect: false },
        ],
      },
      // Q9
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "java8", "optional"],
        questionText: "¿Cuál de las siguientes afirmaciones sobre Optional en Java 8 es verdadera?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "java.util.Optional es una clase final (no puede ser extendida). Su propósito es evitar NullPointerException.",
        options: [
          { id: "a", text: "Puede contener valores nulos.", isCorrect: false },
          { id: "b", text: "Es una clase final y no se puede extender.", isCorrect: true },
          { id: "c", text: "Siempre debe ser inicializado con un valor.", isCorrect: false },
          { id: "d", text: "Es una clase de Java 7 y no está presente en Java 8.", isCorrect: false },
        ],
      },
      // Q10
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "java8", "streams", "basics"],
        questionText: "¿Cuál es el propósito principal de la clase Stream en Java 8?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "Stream representa una secuencia de elementos que soporta operaciones de procesamiento secuenciales o paralelas.",
        options: [
          { id: "a", text: "Realizar operaciones de entrada y salida", isCorrect: false },
          { id: "b", text: "Implementar la lógica de concurrencia", isCorrect: false },
          { id: "c", text: "Proporcionar funciones de encriptación de datos", isCorrect: false },
          { id: "d", text: "Representar una secuencia de elementos", isCorrect: true },
        ],
      },
      // Q11
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "java8", "optional"],
        questionText: "¿Qué método se utiliza para obtener un Optional vacío en Java 8?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "Optional.empty() crea un Optional sin ningún valor presente.",
        options: [
          { id: "a", text: "empty()", isCorrect: true },
          { id: "b", text: "null()", isCorrect: false },
          { id: "c", text: "None()", isCorrect: false },
          { id: "d", text: "void()", isCorrect: false },
        ],
      },
      // Q12
      {
        section: "Fundamentos de Java",
        tags: ["java", "basics", "string", "default-value"],
        questionText: "¿Cuál es el valor por defecto de una variable String en Java?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "String es un tipo de referencia. Las variables de instancia sin inicializar toman el valor null.",
        options: [
          { id: "a", text: "null", isCorrect: true },
          { id: "b", text: "''", isCorrect: false },
          { id: "c", text: '""', isCorrect: false },
          { id: "d", text: '" "', isCorrect: false },
          { id: "e", text: "no está definido", isCorrect: false },
        ],
      },
      // Q13
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "java8", "streams", "findFirst"],
        questionText: "¿Qué método se utiliza para obtener el primer elemento de un Stream en Java 8?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "findFirst() devuelve un Optional con el primer elemento del Stream.",
        options: [
          { id: "a", text: "first()", isCorrect: false },
          { id: "b", text: "getFirst()", isCorrect: false },
          { id: "c", text: "findFirst()", isCorrect: true },
          { id: "d", text: "head()", isCorrect: false },
        ],
      },
      // Q14
      {
        section: "Fundamentos de Java",
        tags: ["java", "gc", "finalize", "garbage-collector"],
        questionText: "¿Bajo qué condiciones el garbage collector invoca el método finalize() de los objetos?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "El GC invoca finalize() antes de recolectar un objeto, cuando detecta que ya no hay referencias activas a él desde ningún thread.",
        options: [
          { id: "a", text: "Tan pronto se asigna null a los objetos", isCorrect: false },
          { id: "b", text: "Cuando detecta que el objeto no puede ser accedido por ningún thread", isCorrect: true },
          { id: "c", text: "Periódicamente revisa si el objeto tiene asignado null para invocar el método", isCorrect: false },
          { id: "d", text: "Cuando se instancie la clase javax.realtime.GarbageCollector", isCorrect: false },
          { id: "e", text: "Todas las opciones", isCorrect: false },
        ],
      },
      // Q15
      {
        section: "Git y HTTP básico",
        tags: ["git", "branch", "list"],
        questionText: "¿Qué comando se utiliza para listar todas las ramas locales en Git?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "git branch sin argumentos lista todas las ramas locales del repositorio.",
        options: [
          { id: "a", text: "SEND Git branch", isCorrect: false },
          { id: "b", text: "git branch", isCorrect: true },
          { id: "c", text: "git branch +add", isCorrect: false },
          { id: "d", text: "branch staged", isCorrect: false },
        ],
      },
      // Q16
      {
        section: "Fundamentos de Java",
        tags: ["java", "keywords", "basics"],
        questionText: "¿Cuál de las siguientes NO es una palabra reservada (keyword) en Java?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "'Int' con I mayúscula no existe en Java. El tipo primitivo es 'int' (minúscula). Java es case-sensitive.",
        options: [
          { id: "a", text: "public", isCorrect: false },
          { id: "b", text: "static", isCorrect: false },
          { id: "c", text: "void", isCorrect: false },
          { id: "d", text: "private", isCorrect: false },
          { id: "e", text: "Int", isCorrect: true },
        ],
      },
      // Q17
      {
        section: "Git y HTTP básico",
        tags: ["http", "status-codes", "404"],
        questionText: "¿Qué código de estado HTTP indica que un recurso no fue encontrado?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "404 Not Found: el servidor no encontró el recurso solicitado.",
        options: [
          { id: "a", text: "104", isCorrect: false },
          { id: "b", text: "404", isCorrect: true },
          { id: "c", text: "500", isCorrect: false },
          { id: "d", text: "201", isCorrect: false },
        ],
      },
      // Q18
      {
        section: "Git y HTTP básico",
        tags: ["http", "status-codes", "204"],
        questionText: "¿Qué código HTTP indica que el servidor procesó la solicitud exitosamente pero no devuelve contenido?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "204 No Content: la solicitud fue exitosa pero no hay cuerpo en la respuesta.",
        options: [
          { id: "a", text: "500", isCorrect: false },
          { id: "b", text: "300", isCorrect: false },
          { id: "c", text: "301", isCorrect: false },
          { id: "d", text: "204", isCorrect: true },
        ],
      },
      // Q19
      {
        section: "Fundamentos de Java",
        tags: ["java", "exceptions", "throwable", "error"],
        questionText: "¿Cuál es la superclase común de Error y Exception en Java?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "Throwable es la raíz de la jerarquía de excepciones. Error y Exception son subclases directas de Throwable.",
        options: [
          { id: "a", text: "Catchable", isCorrect: false },
          { id: "b", text: "RunTimeException", isCorrect: false },
          { id: "c", text: "Thread", isCorrect: false },
          { id: "d", text: "Throwable", isCorrect: true },
          { id: "e", text: "main", isCorrect: false },
        ],
      },
      // Q20
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "lambda", "exceptions", "functional-interface"],
        questionText: "¿Cuál de las siguientes afirmaciones sobre las excepciones en expresiones lambda es verdadera en Java?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "Para que una lambda pueda lanzar una checked exception, la interfaz funcional debe declararla en la firma del método abstracto.",
        options: [
          { id: "a", text: "Las expresiones lambda no pueden lanzar excepciones.", isCorrect: false },
          { id: "b", text: "Las excepciones deben ser manejadas dentro de la expresión lambda.", isCorrect: false },
          { id: "c", text: "Las excepciones deben ser declaradas en la lista de excepciones de la interfaz funcional.", isCorrect: true },
          { id: "d", text: "Las expresiones lambda automáticamente manejan todas las excepciones.", isCorrect: false },
        ],
      },
      // Q21
      {
        section: "Fundamentos de Java",
        tags: ["java", "oop", "inheritance", "access-modifiers"],
        questionText: "¿Cuáles de las siguientes afirmaciones son correctas respecto a una superclase en Java?",
        allowMultiple: true,
        difficulty: "JUNIOR",
        explanation: "Reglas de visibilidad: private solo dentro de la clase; protected accesible desde subclases; public accesible desde cualquier lugar.",
        options: [
          { id: "a", text: "Variables, métodos y constructores declarados como private solo pueden ser accedidos por los miembros de la super clase", isCorrect: true },
          { id: "b", text: "Miembros declarados como protected pueden ser accedidos por cualquier subclase de la super clase", isCorrect: true },
          { id: "c", text: "Variables, métodos y constructores declarados como public en la super clase pueden ser accedidos por cualquier clase", isCorrect: true },
          { id: "d", text: "No es correcta ninguna opción", isCorrect: false },
          { id: "e", text: "No existen super clases en Java", isCorrect: false },
        ],
      },
      // Q22
      {
        section: "Git y HTTP básico",
        tags: ["git", "clone", "remote"],
        questionText: "¿Qué comando de Git se utiliza para descargar un repositorio remoto?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "git clone copia un repositorio remoto al directorio local, incluyendo historial y ramas.",
        options: [
          { id: "a", text: "Git clone", isCorrect: true },
          { id: "b", text: "git status", isCorrect: false },
          { id: "c", text: "git dowload", isCorrect: false },
          { id: "d", text: "Clone dowload repo", isCorrect: false },
        ],
      },
      // Q23
      {
        section: "Git y HTTP básico",
        tags: ["git", "status", "modified"],
        questionText: "¿Qué comando de Git se utiliza para ver los archivos modificados?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "git status muestra el estado del directorio de trabajo y el área de staging.",
        options: [
          { id: "a", text: "Git clone", isCorrect: false },
          { id: "b", text: "git status", isCorrect: true },
          { id: "c", text: "git dowload", isCorrect: false },
          { id: "d", text: "Read update", isCorrect: false },
        ],
      },
      // Q24
      {
        section: "Java Core",
        tags: ["java", "comparator", "arrays", "sort"],
        questionText: `¿Qué imprime en consola el siguiente código?\n\npublic class Tester {\n  public static void main(String[] args) {\n    Integer[] primes = {3, 2, 7, 11, 13, 5};\n    MySort ms = new MySort();\n    Arrays.sort(primes, ms);\n    for(Integer pi: primes)\n      System.out.println(pi);\n  }\n}\n\nclass MySort implements Comparator {\n  @Override\n  public int compare(Object o1, Object o2) {\n    return ((Integer) o2).compareTo((Integer) o1);\n  }\n}`,
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "MySort implementa Comparator invirtiendo el orden natural (o2.compareTo(o1)), lo que ordena el array de forma descendente: 13, 11, 7, 5, 3, 2, imprimiéndose cada valor en una línea.",
        options: [
          { id: "a", text: "2 3 5 7", isCorrect: false },
          { id: "b", text: "2 3 5 7 11 13", isCorrect: false },
          { id: "c", text: "13\n11\n7\n5\n3\n2", isCorrect: true },
          { id: "d", text: "13 11 7 5 3 2", isCorrect: false },
        ],
      },
      // Q25
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "java8", "streams", "forEach"],
        questionText: "¿Qué método de Stream se utiliza para ejecutar una acción para cada elemento en Java 8?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "forEach() es una operación terminal que aplica un Consumer a cada elemento del Stream.",
        options: [
          { id: "a", text: "iterate()", isCorrect: false },
          { id: "b", text: "forEach()", isCorrect: true },
          { id: "c", text: "perform()", isCorrect: false },
          { id: "d", text: "apply()", isCorrect: false },
        ],
      },
      // Q26
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "java8", "lambda", "scope", "effectively-final"],
        questionText: "¿Cuál de las siguientes afirmaciones sobre las expresiones lambda en Java 8 es verdadera?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "Las lambdas pueden capturar variables locales, pero solo si son final o efectivamente finales (su valor no cambia después de la asignación).",
        options: [
          { id: "a", text: "Siempre es necesario especificar el tipo de parámetros en una expresión lambda.", isCorrect: false },
          { id: "b", text: "Pueden acceder a variables locales que están final o efectivamente finales.", isCorrect: true },
          { id: "c", text: "No se pueden utilizar en interfaces funcionales.", isCorrect: false },
          { id: "d", text: "Pueden tener múltiples sentencias de retorno.", isCorrect: false },
        ],
      },
      // Q27
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "java8", "streams", "distinct", "count"],
        questionText: "¿Cuál es el resultado de la operación stream.distinct().count()?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "distinct() elimina elementos duplicados y count() devuelve el número de elementos restantes, es decir, el conteo de elementos distintos.",
        options: [
          { id: "a", text: "Devuelve el primer elemento del Stream.", isCorrect: false },
          { id: "b", text: "Cuenta el número de elementos distintos en el Stream.", isCorrect: true },
          { id: "c", text: "Filtra los elementos duplicados del Stream.", isCorrect: false },
          { id: "d", text: "Lanza una excepción debido a la llamada incorrecta del método count().", isCorrect: false },
        ],
      },
      // Q28
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "java8", "predicate", "functional-interface"],
        questionText: "¿Cuál es el propósito principal de la interfaz Predicate en Java 8?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "Predicate<T> es una interfaz funcional que representa una función booleana: toma un argumento T y devuelve true o false.",
        options: [
          { id: "a", text: "Representar una función que toma un argumento y devuelve un resultado.", isCorrect: false },
          { id: "b", text: "Representar una operación que acepta un argumento y no devuelve ningún resultado.", isCorrect: false },
          { id: "c", text: "Representar una operación que verifica una condición.", isCorrect: true },
          { id: "d", text: "Representar una secuencia de elementos.", isCorrect: false },
        ],
      },
      // Q29
      {
        section: "Git y HTTP básico",
        tags: ["git", "branch", "create"],
        questionText: "¿Qué comando de Git se utiliza para crear una rama?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "git branch <nombre> crea la rama pero no cambia a ella. Para crear y cambiar en un paso se usa git checkout -b.",
        options: [
          { id: "a", text: "git create <nombre de la rama>", isCorrect: false },
          { id: "b", text: "git branch <nombre de la rama>", isCorrect: true },
          { id: "c", text: "create git <nombre de la rama>", isCorrect: false },
          { id: "d", text: "git <nombre de la rama>", isCorrect: false },
        ],
      },
      // Q30
      {
        section: "Git y HTTP básico",
        tags: ["git", "checkout", "branch", "create-switch"],
        questionText: "¿Qué comando de Git crea una rama y cambia a ella en un solo paso?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "git checkout -b <nombre> crea la nueva rama y hace checkout a ella en un solo comando.",
        options: [
          { id: "a", text: "git create <nombre de la rama>", isCorrect: false },
          { id: "b", text: "Git checkout –b <nombre de la rama>", isCorrect: true },
          { id: "c", text: "create git <nombre de la rama> +1", isCorrect: false },
          { id: "d", text: "git <nombre de la rama>", isCorrect: false },
        ],
      },
      // Q31
      {
        section: "Git y HTTP básico",
        tags: ["git", "pull", "update", "remote"],
        questionText: "¿Qué comando de Git se utiliza para actualizar el repositorio local con cambios del remoto?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "git pull descarga (fetch) y fusiona (merge) los cambios del repositorio remoto en la rama actual.",
        options: [
          { id: "a", text: "git update <nombre de la rama>", isCorrect: false },
          { id: "b", text: "Git checkout", isCorrect: false },
          { id: "c", text: "create git <nombre de la rama> +1", isCorrect: false },
          { id: "d", text: "git pull", isCorrect: true },
        ],
      },
      // Q32
      {
        section: "Java Core",
        tags: ["java", "inner-class", "access-modifiers", "nested-class"],
        questionText: `¿Qué código puede ser insertado en la línea N1 comentada y compila correctamente?\n\npublic class App {\n  void calcBill() {\n    // N1\n    new Invoice().print();\n  }\n}`,
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "Una inner class con modificador de acceso por defecto (package-private) puede ser definida dentro de la clase App y ser instanciada desde sus métodos. No existe 'internal' en Java; 'private' sí funciona; sin modificador (package-private) también compila correctamente.",
        options: [
          { id: "a", text: "internal class Invoice {\n  void print() {\n    System.out.println(\"Invoice Printed\");\n  }\n}", isCorrect: false },
          { id: "b", text: "private class Invoice {\n  void print() {\n    System.out.println(\"Invoice Printed\");\n  }\n}", isCorrect: false },
          { id: "c", text: "protected class Invoice {\n  void print() {\n    System.out.println(\"Invoice Printed\");\n  }\n}", isCorrect: false },
          { id: "d", text: "public class Invoice {\n  void print() {\n    System.out.println(\"Invoice Printed\");\n  }\n}", isCorrect: false },
          { id: "e", text: "class Invoice {\n  void print() {\n    System.out.println(\"Invoice Printed\");\n  }\n}", isCorrect: true },
        ],
      },
      // Q33
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "java8", "streams", "reduce"],
        questionText: "¿Cuál de las siguientes afirmaciones sobre el método reduce() en Java 8 es verdadera?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "reduce(identity, BinaryOperator) combina todos los elementos del Stream en un solo resultado usando la función acumuladora.",
        options: [
          { id: "a", text: "Si el Stream está vacío, reduce() lanza una excepción.", isCorrect: false },
          { id: "b", text: "El método reduce() debe ser usado solo con Streams de números.", isCorrect: false },
          { id: "c", text: "El método reduce() acepta un acumulador y una función de combinación como argumentos.", isCorrect: true },
          { id: "d", text: "El método reduce() siempre devuelve un Optional.", isCorrect: false },
        ],
      },
      // Q34
      {
        section: "Java 8 / Streams / Lambdas",
        tags: ["java", "java8", "streams", "mapToInt", "sum"],
        questionText: "¿Cuál es el resultado de stream.mapToInt(x -> x * 2).sum() sobre un Stream de enteros?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "mapToInt(x -> x * 2) transforma cada elemento multiplicándolo por 2, y sum() suma todos los resultados obtenidos.",
        options: [
          { id: "a", text: "Multiplica cada elemento del Stream por 2 y devuelve el total.", isCorrect: true },
          { id: "b", text: "Devuelve la suma de los elementos del Stream.", isCorrect: false },
          { id: "c", text: "Devuelve el doble de la suma de los elementos del Stream.", isCorrect: false },
          { id: "d", text: "Lanza una excepción debido a la llamada incorrecta del método sum().", isCorrect: false },
        ],
      },
      // Q35
      {
        section: "Fundamentos de Java",
        tags: ["java", "collections", "set"],
        questionText: "¿Cuáles son las características de la interfaz Set en Java?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "Set no permite elementos duplicados. El orden no está garantizado (excepto en implementaciones como TreeSet o LinkedHashSet).",
        options: [
          { id: "a", text: "A. colección de elementos que no permite valores repetidos", isCorrect: true },
          { id: "b", text: "B. colección de elementos con su llave", isCorrect: false },
          { id: "c", text: "C. colección de elementos siempre ordenados", isCorrect: false },
          { id: "d", text: "D. colección de elementos que no admite null en alguno de sus elementos", isCorrect: false },
          { id: "e", text: "Correcto A y D", isCorrect: false },
        ],
      },
      // Q36
      {
        section: "Fundamentos de Java",
        tags: ["java", "basics", "types", "assignments", "widening"],
        questionText: "¿Cuál de estas expresiones es correcta en Java?",
        allowMultiple: true,
        difficulty: "JUNIOR",
        explanation: "Widening automático: float→double y int→double están permitidos. char puede recibir entero en rango 0-65535. 'float x = 6d' requiere cast explícito.",
        options: [
          { id: "a", text: "double x = 2.0f;", isCorrect: true },
          { id: "b", text: "double x = 2;", isCorrect: true },
          { id: "c", text: "float x = 6d;", isCorrect: false },
          { id: "d", text: "char x = 66;", isCorrect: true },
          { id: "e", text: "long x = 128l", isCorrect: false },
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
    isGlobal: false,
    language: null,
    sections: [
      { title: "REST y HTTP" },
      { title: "Diseño de recursos" },
      { title: "Git básico" },
    ],
    questions: [
      // Q3
      {
        section: "REST y HTTP",
        tags: ["soap", "xml", "rest", "json"],
        questionText: "SOAP es a XML como...",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "REST usa JSON como formato de intercambio, del mismo modo que SOAP usa XML.",
        options: [
          { id: "a", text: "JAVA es a GIT", isCorrect: false },
          { id: "b", text: "REST es a JSON", isCorrect: true },
          { id: "c", text: "JSON es a JAVA", isCorrect: false },
          { id: "d", text: "HTTP es a WEB", isCorrect: false },
        ],
      },
      // Q4
      {
        section: "Git basico",
        tags: ["git", "branch", "rename"],
        questionText: "Renombrar una rama en GIT",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "git branch -m <nuevo-nombre> renombra la rama actual.",
        options: [
          { id: "a", text: "git branch -m <nuevo-nombre>", isCorrect: true },
          { id: "b", text: "git branch <nuevo-nombre>", isCorrect: false },
          { id: "c", text: "rename a:{NEW} b:{OLD}", isCorrect: false },
          { id: "d", text: "git rename <nuevo-nombre>", isCorrect: false },
        ],
      },
      // Q5
      {
        section: "REST y HTTP",
        tags: ["http", "patch", "partial-update"],
        questionText: "Actualizar parcialmente un recurso",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "PATCH actualiza parcialmente un recurso.",
        options: [
          { id: "a", text: "OPTIONS", isCorrect: false },
          { id: "b", text: "GET", isCorrect: false },
          { id: "c", text: "PATCH", isCorrect: true },
          { id: "d", text: "HEAD", isCorrect: false },
        ],
      },
      // Q6
      {
        section: "REST y HTTP",
        tags: ["http", "post", "create"],
        questionText: "Crear un nuevo recurso",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "POST se utiliza para crear un nuevo recurso.",
        options: [
          { id: "a", text: "HEAD", isCorrect: false },
          { id: "b", text: "POST", isCorrect: true },
          { id: "c", text: "LIST", isCorrect: false },
          { id: "d", text: "OPTIONS", isCorrect: false },
        ],
      },
      // Q7
      {
        section: "REST y HTTP",
        tags: ["http", "4xx", "5xx", "error-codes"],
        questionText: "Cual es la diferencia entre los codigos de error 4xx y 5xx?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "4xx son errores del cliente; 5xx son errores del servidor.",
        options: [
          { id: "a", text: "4xx son errores de cliente y los 5xx son errores de servidor.", isCorrect: true },
          { id: "b", text: "5xx son errores de cliente y los 4xx son errores de servidor.", isCorrect: false },
          { id: "c", text: "4xx son errores de direccionamiento y los 5xx son errores de redireccionamiento.", isCorrect: false },
          { id: "d", text: "No existe diferencia semantica entre ellos.", isCorrect: false },
        ],
      },
      // Q8
      {
        section: "REST y HTTP",
        tags: ["http", "204", "status-code"],
        questionText: "Codigo de estado 204:",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "HTTP 204 No Content: solicitud exitosa pero sin cuerpo en la respuesta.",
        options: [
          { id: "a", text: "Respuesta OK", isCorrect: false },
          { id: "b", text: "Respuesta erronea configurable por cliente", isCorrect: false },
          { id: "c", text: "Respuesta de exito sin body", isCorrect: true },
          { id: "d", text: "Respuesta de exito con body", isCorrect: false },
        ],
      },
      // Q9
      {
        section: "REST y HTTP",
        tags: ["api", "rest", "principles"],
        questionText: "De las siguientes opciones, elige la que contenga tres principios de REST",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "REST es stateless, tiene interfaz uniforme y el recurso puede tener multiples representaciones.",
        options: [
          { id: "a", text: "Analogico, estructuracion, lineal", isCorrect: false },
          { id: "b", text: "Basado en Java, Uso de Web Services, Enfocado a Microservicios", isCorrect: false },
          { id: "c", text: "Peticiones con estado, persistencia, orientado a acciones", isCorrect: false },
          { id: "d", text: "Es stateless, tiene interfaz uniforme, el recurso tiene mas de una manera de representacion", isCorrect: true },
        ],
      },
      // Q10
      {
        section: "REST y HTTP",
        tags: ["http", "400", "bad-request"],
        questionText: "Error 400:",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "HTTP 400 Bad Request: la peticion tiene formato incorrecto o datos invalidos.",
        options: [
          { id: "a", text: "Bad request", isCorrect: true },
          { id: "b", text: "Return code ok", isCorrect: false },
          { id: "c", text: "Invalid action", isCorrect: false },
          { id: "d", text: "Slight error", isCorrect: false },
        ],
      },
      // Q11
      {
        section: "Diseno de recursos",
        tags: ["rest", "endpoints", "post"],
        questionText: "Dar de alta un credito para un carro",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "Para crear un recurso se usa POST con sustantivos en la URI.",
        options: [
          { id: "a", text: "POST credits/v0/credits/cars", isCorrect: false },
          { id: "b", text: "POST credits/v0/credits/credit-car", isCorrect: true },
          { id: "c", text: "PUT credits/v0/credits/credit-car", isCorrect: false },
          { id: "d", text: "PUT credits/v0/credits/cars", isCorrect: false },
        ],
      },
      // Q12
      {
        section: "Git basico",
        tags: ["git", "add", "staging"],
        questionText: "Enviar archivos a staged",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "git add . agrega todos los archivos modificados al area de staging.",
        options: [
          { id: "a", text: "SEND Git staged", isCorrect: false },
          { id: "b", text: "Git add .", isCorrect: true },
          { id: "c", text: "git branch", isCorrect: false },
          { id: "d", text: "PUT staged", isCorrect: false },
        ],
      },
      // Q13
      {
        section: "Git basico",
        tags: ["git", "branch", "list"],
        questionText: "Listar todas las ramas locales",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "git branch sin argumentos lista todas las ramas locales.",
        options: [
          { id: "a", text: "SEND Git branch", isCorrect: false },
          { id: "b", text: "git branch", isCorrect: true },
          { id: "c", text: "git branch +add", isCorrect: false },
          { id: "d", text: "branch staged", isCorrect: false },
        ],
      },
      // Q14
      {
        section: "REST y HTTP",
        tags: ["http", "404", "not-found"],
        questionText: "Codigo de estado para un recurso no encontrado",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "HTTP 404 Not Found indica que el recurso no existe.",
        options: [
          { id: "a", text: "104", isCorrect: false },
          { id: "b", text: "404", isCorrect: true },
          { id: "c", text: "500", isCorrect: false },
          { id: "d", text: "201", isCorrect: false },
        ],
      },
      // Q15
      {
        section: "REST y HTTP",
        tags: ["http", "204", "no-content"],
        questionText: "El servidor ha procesado con exito la solicitud, pero no va a devolver ningun contenido",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "HTTP 204 No Content: operacion exitosa sin datos que retornar.",
        options: [
          { id: "a", text: "500", isCorrect: false },
          { id: "b", text: "300", isCorrect: false },
          { id: "c", text: "301", isCorrect: false },
          { id: "d", text: "204", isCorrect: true },
        ],
      },
      // Q16
      {
        section: "REST y HTTP",
        tags: ["http", "idempotency", "methods"],
        questionText: "Selecciona todos los metodos idempotentes",
        allowMultiple: true,
        difficulty: "JUNIOR",
        explanation: "GET, PUT y DELETE son idempotentes. POST no lo es.",
        options: [
          { id: "a", text: "GET", isCorrect: true },
          { id: "b", text: "PUT", isCorrect: true },
          { id: "c", text: "DELETE", isCorrect: true },
          { id: "d", text: "POST", isCorrect: false },
        ],
      },
      // Q17
      {
        section: "REST y HTTP",
        tags: ["http", "idempotency", "non-idempotent"],
        questionText: "Selecciona todos los metodos no idempotentes",
        allowMultiple: true,
        difficulty: "JUNIOR",
        explanation: "POST no es idempotente: cada llamada puede crear un nuevo recurso.",
        options: [
          { id: "a", text: "GET", isCorrect: false },
          { id: "b", text: "PUT", isCorrect: false },
          { id: "c", text: "DELETE", isCorrect: false },
          { id: "d", text: "POST", isCorrect: true },
        ],
      },
      // Q18
      {
        section: "Git basico",
        tags: ["git", "clone", "download"],
        questionText: "Descargar un repositorio",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "git clone descarga una copia completa de un repositorio remoto.",
        options: [
          { id: "a", text: "Git clone", isCorrect: true },
          { id: "b", text: "git status", isCorrect: false },
          { id: "c", text: "git dowload", isCorrect: false },
          { id: "d", text: "Clone dowload repo", isCorrect: false },
        ],
      },
      // Q19
      {
        section: "Git basico",
        tags: ["git", "status", "modified"],
        questionText: "Ver los archivos modificados en GIT",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "git status muestra el estado del directorio de trabajo.",
        options: [
          { id: "a", text: "Git clone", isCorrect: false },
          { id: "b", text: "git status", isCorrect: true },
          { id: "c", text: "git dowload", isCorrect: false },
          { id: "d", text: "Read update", isCorrect: false },
        ],
      },
      // Q20
      {
        section: "Diseno de recursos",
        tags: ["api", "rest", "uri-param", "path-param"],
        questionText: "Define para que sirve un URI Param:",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "Un URI param identifica el recurso concreto, ej. /customers/123.",
        options: [
          { id: "a", text: "Para recibir los datos del RESPOSE", isCorrect: false },
          { id: "b", text: "Para apartar el recurso al que queremos hacer una operacion en concreto.", isCorrect: false },
          { id: "c", text: "Para enviar el identificador del recurso al que queremos hacer una operacion en concreto.", isCorrect: true },
          { id: "d", text: "Para actualizar el recurso", isCorrect: false },
        ],
      },
      // Q21
      {
        section: "REST y HTTP",
        tags: ["oop", "inheritance"],
        questionText: "Que es la herencia?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "La herencia permite que una clase hija adquiera las caracteristicas y metodos de su clase padre.",
        options: [
          { id: "a", text: "Hereda las caracteristicas y metodos.", isCorrect: true },
          { id: "b", text: "Hereda los atributos y nombres", isCorrect: false },
          { id: "c", text: "Hereda las relaciones y correspondencias", isCorrect: false },
          { id: "d", text: "Hereda la familia y subfamilia", isCorrect: false },
        ],
      },
      // Q22
      {
        section: "REST y HTTP",
        tags: ["http", "delete", "method"],
        questionText: "Elimina un recurso",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "DELETE es el metodo HTTP para eliminar un recurso identificado por la URI.",
        options: [
          { id: "a", text: "DEL", isCorrect: false },
          { id: "b", text: "UPDATE NULL", isCorrect: false },
          { id: "c", text: "DELETE", isCorrect: true },
          { id: "d", text: "OPTIONS", isCorrect: false },
        ],
      },
      // Q23
      {
        section: "REST y HTTP",
        tags: ["http", "media-type", "content-type"],
        questionText: "Que es  Media type?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "Un media type (MIME type) identifica el formato del contenido, ej. application/json.",
        options: [
          { id: "a", text: "Es un identificador de dos partes que indica el formato del contenido transmitido por Internet.", isCorrect: true },
          { id: "b", text: "Es un Archivo multimedia", isCorrect: false },
          { id: "c", text: "Es un segmento de informacion que se asocia a los metadatos de un archivo", isCorrect: false },
          { id: "d", text: ".JPG, .AVI, .BMP, .MP3", isCorrect: false },
        ],
      },
      // Q24
      {
        section: "Git basico",
        tags: ["git", "branch", "create"],
        questionText: "Crear una rama en GIT",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "git branch <nombre> crea una nueva rama sin moverse a ella.",
        options: [
          { id: "a", text: "git create <nombre de la rama>", isCorrect: false },
          { id: "b", text: "git branch <nombre de la rama>", isCorrect: true },
          { id: "c", text: "create git <nombre de la rama>", isCorrect: false },
          { id: "d", text: "git <nombre de la rama>", isCorrect: false },
        ],
      },
      // Q25
      {
        section: "Git basico",
        tags: ["git", "checkout", "branch", "create-switch"],
        questionText: "Creer una rama en GIT y movernos a la rama",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "git checkout -b <nombre> crea la rama y se mueve a ella.",
        options: [
          { id: "a", text: "git create <nombre de la rama>", isCorrect: false },
          { id: "b", text: "Git checkout -b <nombre de la rama>", isCorrect: true },
          { id: "c", text: "create git <nombre de la rama> +1", isCorrect: false },
          { id: "d", text: "git <nombre de la rama>", isCorrect: false },
        ],
      },
      // Q26
      {
        section: "Git basico",
        tags: ["git", "pull", "update", "remote"],
        questionText: "Que comando de GIT se utiliza para actualizar en tu repositorio local?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "git pull descarga y fusiona los cambios remotos en la rama local actual.",
        options: [
          { id: "a", text: "git update <nombre de la rama>", isCorrect: false },
          { id: "b", text: "Git checkout", isCorrect: false },
          { id: "c", text: "create git <nombre de la rama> +1", isCorrect: false },
          { id: "d", text: "git pull", isCorrect: true },
        ],
      },
      // Q27
      {
        section: "REST y HTTP",
        tags: ["api", "rest", "http", "protocol"],
        questionText: "Que protocolo de comunicacion ocupa REST?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "REST utiliza HTTP como protocolo de comunicacion.",
        options: [
          { id: "a", text: "SOAP", isCorrect: false },
          { id: "b", text: "HTTP", isCorrect: true },
          { id: "c", text: "JSON", isCorrect: false },
          { id: "d", text: "XML", isCorrect: false },
        ],
      },
      // Q28
      {
        section: "REST y HTTP",
        tags: ["api", "rest", "restless", "resources"],
        questionText: "RESTful es a Recursos como RESTless es a",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "RESTful modela recursos (sustantivos); RESTless se orienta a acciones (verbos).",
        options: [
          { id: "a", text: "Situacion", isCorrect: false },
          { id: "b", text: "XML", isCorrect: false },
          { id: "c", text: "JSON", isCorrect: false },
          { id: "d", text: "Acciones", isCorrect: true },
        ],
      },
      // Q29
      {
        section: "Diseno de recursos",
        tags: ["rest", "antipattern", "endpoints", "naming"],
        questionText: "Es un antipatron al definir un recurso REST",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "Usar verbos en la URI es un antipatron. Los recursos deben nombrarse con sustantivos.",
        options: [
          { id: "a", text: "POST customer/", isCorrect: false },
          { id: "b", text: "GET update_customers/12345", isCorrect: true },
          { id: "c", text: "PATCH /accounts/12345/related-contracts/67890", isCorrect: false },
          { id: "d", text: "GET /customers/12345", isCorrect: false },
        ],
      },
      // Q30
      {
        section: "REST y HTTP",
        tags: ["api", "rest", "definition"],
        questionText: "Que es REST?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "REST (Representational State Transfer) es un estilo arquitectonico sobre HTTP.",
        options: [
          { id: "a", text: "Es un formato de transferencia", isCorrect: false },
          { id: "b", text: "Es una arquitectura", isCorrect: false },
          { id: "c", text: "Es un estilo arquitectonico", isCorrect: true },
          { id: "d", text: "Es un protocolo de comunicacion", isCorrect: false },
        ],
      },
      // Q31
      {
        section: "REST y HTTP",
        tags: ["api", "raml", "definition"],
        questionText: "Que es RAML?",
        allowMultiple: false,
        difficulty: "JUNIOR",
        explanation: "RAML (RESTful API Modeling Language) es un lenguaje para describir APIs RESTful.",
        options: [
          { id: "a", text: "Es un lenguaje de definicion de APIs", isCorrect: true },
          { id: "b", text: "Es una arquitectura", isCorrect: false },
          { id: "c", text: "Es un estilo arquitectonico", isCorrect: false },
          { id: "d", text: "Es un protocolo de comunicacion", isCorrect: false },
        ],
      },
    ],
  },
]