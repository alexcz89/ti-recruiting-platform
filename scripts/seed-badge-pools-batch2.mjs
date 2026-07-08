// scripts/seed-badge-pools-batch2.mjs
// Tanda 2 de contenido para certificaciones (#17): TypeScript, React,
// Node.js y Git nivel Básico. Pools de 24 preguntas; examen de 12.
// Se publican directo como badge (aprobado por el fundador en sesión).
//
// Nota: C# quedó fuera — su término de taxonomía nunca llegó a la BD
// (colisión de slug con "C"); pendiente de arreglar en el catálogo.
//
// Idempotente por slug. Uso: node scripts/seed-badge-pools-batch2.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
    slug: "badge-typescript-basico",
    title: "Certificación TypeScript · Básico",
    termSlug: "typescript",
    description:
      "Fundamentos de TypeScript: anotaciones, interfaces, uniones, genéricos básicos y el modelo de compilación. Al aprobar obtienes el badge verificado TypeScript · Básico.",
    sections: ["Tipos y sintaxis", "Interfaces y tipos compuestos", "Funciones y genéricos"],
    questions: [
      q("Tipos y sintaxis", "¿Cuál es la sintaxis correcta para anotar el tipo de una variable?", [
        ["let edad: number = 30;", true],
        ["let edad = number(30);", false],
        ["number edad = 30;", false],
        ["let edad<number> = 30;", false],
      ], "La anotación va después del nombre con dos puntos: nombre: tipo.", ["typescript", "tipos"]),
      q("Tipos y sintaxis", "¿Cuál es la diferencia entre any y unknown?", [
        ["unknown obliga a verificar el tipo antes de usarlo; any desactiva el chequeo", true],
        ["any es más estricto que unknown", false],
        ["unknown solo acepta objetos", false],
        ["Son sinónimos", false],
      ], "Con unknown no puedes llamar métodos ni operar sin narrowing previo; any elimina toda la seguridad de tipos.", ["typescript", "tipos"]),
      q("Tipos y sintaxis", "¿Qué representa el tipo string | number?", [
        ["Un valor que puede ser string O number (unión)", true],
        ["Un valor que es string Y number a la vez", false],
        ["Una tupla de string y number", false],
        ["Un error de sintaxis", false],
      ], "El operador | crea un union type; & crearía una intersección.", ["typescript", "uniones"]),
      q("Tipos y sintaxis", "¿Qué hace el compilador de TypeScript con las anotaciones de tipo al generar JavaScript?", [
        ["Las elimina: los tipos no existen en tiempo de ejecución", true],
        ["Las convierte en validaciones runtime", false],
        ["Las guarda en un archivo .map", false],
        ["Las convierte en comentarios", false],
      ], "TypeScript hace type erasure: los tipos solo viven en compilación. Validar datos externos en runtime requiere librerías como Zod.", ["typescript", "compilacion"]),
      q("Tipos y sintaxis", "¿Qué tipo infiere TypeScript aquí?", [
        ["number", true],
        ["any", false],
        ["string", false],
        ["unknown", false],
      ], "La inferencia asigna el tipo del valor inicial; no hace falta anotar lo obvio.", ["typescript", "inferencia"], "let total = 100;"),
      q("Tipos y sintaxis", "¿Cuáles son formas válidas de tipar un array de números?", [
        ["number[]", true],
        ["Array<number>", true],
        ["array(number)", false],
        ["[number]", false],
      ], "number[] y Array<number> son equivalentes. [number] es una tupla de exactamente un número.", ["typescript", "arrays"]),
      q("Tipos y sintaxis", "¿Qué es un literal type como \"on\" | \"off\"?", [
        ["Un tipo que solo acepta exactamente esos valores", true],
        ["Un tipo que acepta cualquier string corto", false],
        ["Una constante en runtime", false],
        ["Un enum implícito con validación runtime", false],
      ], "Los literal types restringen a valores exactos — la base de uniones discriminadas.", ["typescript", "tipos"]),
      q("Tipos y sintaxis", "Con strictNullChecks activado, ¿qué pasa con let nombre: string = null?", [
        ["Error de compilación: null no es asignable a string", true],
        ["Compila y nombre queda en null", false],
        ["Compila con warning", false],
        ["nombre se convierte en cadena vacía", false],
      ], "Con strict null checks, null y undefined solo son asignables si el tipo los incluye: string | null.", ["typescript", "strict"]),
      q("Interfaces y tipos compuestos", "¿Cómo se declara una propiedad opcional en una interfaz?", [
        ["telefono?: string", true],
        ["telefono: string?", false],
        ["optional telefono: string", false],
        ["telefono: string | optional", false],
      ], "El ? va después del nombre de la propiedad; su tipo efectivo es string | undefined.", ["typescript", "interfaces"]),
      q("Interfaces y tipos compuestos", "¿Qué efecto tiene readonly en una propiedad?", [
        ["Impide reasignarla después de la creación del objeto", true],
        ["La oculta al serializar a JSON", false],
        ["La congela en profundidad (deep freeze)", false],
        ["Solo permite leerla dentro de la clase", false],
      ], "readonly es una restricción de compilación sobre la reasignación directa; no congela objetos anidados.", ["typescript", "interfaces"]),
      q("Interfaces y tipos compuestos", "¿Qué diferencia práctica hay entre interface y type?", [
        ["interface admite declaration merging y extends; type admite uniones y tipos compuestos arbitrarios", true],
        ["type es solo para primitivos", false],
        ["interface genera código en runtime", false],
        ["Ninguna, el compilador los trata idéntico en todos los casos", false],
      ], "Para formas de objetos son casi intercambiables; type puede expresar uniones (A | B) que interface no.", ["typescript", "interfaces"]),
      q("Interfaces y tipos compuestos", "¿Cómo extiende una interfaz a otra?", [
        ["interface Admin extends Usuario { permisos: string[] }", true],
        ["interface Admin implements Usuario { ... }", false],
        ["interface Admin: Usuario { ... }", false],
        ["interface Admin = Usuario + { ... }", false],
      ], "extends hereda los miembros; implements es para que las clases cumplan una interfaz.", ["typescript", "interfaces"]),
      q("Interfaces y tipos compuestos", "¿Qué es una tupla en TypeScript?", [
        ["Un array con número fijo de elementos y tipo por posición, como [string, number]", true],
        ["Un array inmutable", false],
        ["Un objeto con claves numéricas", false],
        ["Un alias de Array<any>", false],
      ], "[string, number] exige exactamente esa forma: [\"Ana\", 30] es válido, [30, \"Ana\"] no.", ["typescript", "tuplas"]),
      q("Interfaces y tipos compuestos", "¿Qué hace un enum como enum Rol { ADMIN, RECruiter }?", [
        ["Define un conjunto de constantes con nombre", true],
        ["Crea una tabla en la base de datos", false],
        ["Es un alias de string[]", false],
        ["Solo existe en compilación, como los tipos", false],
      ], "A diferencia de los tipos puros, los enum numéricos/string generan un objeto real en el JavaScript emitido.", ["typescript", "enums"]),
      q("Interfaces y tipos compuestos", "¿Qué imprime este código si usuario es undefined?", [
        ["undefined (sin lanzar error)", true],
        ["TypeError: cannot read properties", false],
        ["null", false],
        ["Cadena vacía", false],
      ], "El optional chaining ?. corta la evaluación y devuelve undefined si el operando es null/undefined.", ["typescript", "operadores"], "console.log(usuario?.email);"),
      q("Interfaces y tipos compuestos", "¿Qué hace la aserción \"valor as string\"?", [
        ["Le dice al compilador que trate valor como string, sin verificar en runtime", true],
        ["Convierte el valor a string en runtime", false],
        ["Valida que el valor sea string y lanza error si no", false],
        ["Crea una copia tipada del valor", false],
      ], "as es una promesa al compilador, no una conversión: si mientes, el error aparecerá en runtime.", ["typescript", "asserts"]),
      q("Funciones y genéricos", "¿Cómo se tipa el retorno de una función?", [
        ["function suma(a: number, b: number): number { ... }", true],
        ["function suma(a: number, b: number) -> number { ... }", false],
        ["function suma: number (a, b) { ... }", false],
        ["number function suma(a, b) { ... }", false],
      ], "El tipo de retorno va después de los paréntesis de parámetros.", ["typescript", "funciones"]),
      q("Funciones y genéricos", "¿Qué significa el tipo de retorno void?", [
        ["La función no devuelve ningún valor utilizable", true],
        ["La función devuelve null", false],
        ["La función nunca termina", false],
        ["La función es asíncrona", false],
      ], "void = sin valor de retorno; never = nunca retorna (lanza siempre o loop infinito).", ["typescript", "funciones"]),
      q("Funciones y genéricos", "¿Cuándo aplica el tipo never?", [
        ["En funciones que nunca retornan: siempre lanzan o entran en loop infinito", true],
        ["En funciones sin parámetros", false],
        ["En variables sin inicializar", false],
        ["En cualquier función async", false],
      ], "never también aparece en narrowing exhaustivo: si todos los casos se cubrieron, lo restante es never.", ["typescript", "tipos"]),
      q("Funciones y genéricos", "¿Qué permite esta función genérica?", [
        ["Conservar el tipo del argumento en el retorno para cualquier tipo T", true],
        ["Aceptar solo tipos primitivos", false],
        ["Convertir el argumento a template string", false],
        ["Nada distinto de usar any", false],
      ], "El genérico enlaza entrada y salida: identity(5) retorna number, identity(\"a\") retorna string. Con any se perdería el tipo.", ["typescript", "genericos"], "function identity<T>(valor: T): T {\n  return valor;\n}"),
      q("Funciones y genéricos", "¿Qué técnica de narrowing usa este código?", [
        ["typeof para discriminar la unión", true],
        ["Type assertion", false],
        ["Declaration merging", false],
        ["Duck typing en runtime", false],
      ], "typeof es un type guard: dentro del if, TypeScript sabe que id es string.", ["typescript", "narrowing"], "function formatear(id: string | number) {\n  if (typeof id === \"string\") {\n    return id.toUpperCase();\n  }\n  return id.toFixed(0);\n}"),
      q("Funciones y genéricos", "¿Cómo se tipa un parámetro con valor por defecto?", [
        ["function saludar(nombre: string = \"mundo\") { ... }", true],
        ["function saludar(nombre = string: \"mundo\") { ... }", false],
        ["function saludar(default nombre: string) { ... }", false],
        ["function saludar(nombre?: string!) { ... }", false],
      ], "Anotación y default conviven: tipo primero, valor después. El parámetro se vuelve opcional al llamar.", ["typescript", "funciones"]),
      q("Funciones y genéricos", "¿Qué error marca el compilador aquí?", [
        ["Falta la propiedad email requerida por la interfaz", true],
        ["nombre debería ser number", false],
        ["No se puede usar const con interfaces", false],
        ["Ninguno, compila bien", false],
      ], "El objeto debe cumplir la forma completa de la interfaz; email no es opcional.", ["typescript", "interfaces"], "interface Usuario {\n  nombre: string;\n  email: string;\n}\n\nconst u: Usuario = { nombre: \"Ana\" };"),
      q("Funciones y genéricos", "¿Para qué sirve el archivo tsconfig.json?", [
        ["Configurar el compilador: strictness, target, rutas, archivos incluidos", true],
        ["Declarar las dependencias del proyecto", false],
        ["Definir los scripts de npm", false],
        ["Configurar el servidor de desarrollo", false],
      ], "tsconfig.json controla cómo compila TypeScript; las dependencias viven en package.json.", ["typescript", "tooling"]),
    ],
  },
  {
    slug: "badge-react-basico",
    title: "Certificación React · Básico",
    termSlug: "react",
    description:
      "Fundamentos de React: componentes, JSX, props, estado, eventos y hooks esenciales. Al aprobar obtienes el badge verificado React · Básico.",
    sections: ["Componentes y JSX", "Estado y eventos", "Hooks y listas"],
    questions: [
      q("Componentes y JSX", "¿Qué es JSX?", [
        ["Una extensión de sintaxis que permite escribir estructuras tipo HTML en JavaScript", true],
        ["Un motor de plantillas que corre en el servidor", false],
        ["Un lenguaje separado que reemplaza a JavaScript", false],
        ["El formato de configuración de React", false],
      ], "JSX se transpila a llamadas de creación de elementos; no es HTML real ni llega tal cual al navegador.", ["react", "jsx"]),
      q("Componentes y JSX", "¿Cuál es un componente funcional válido?", [
        ["function Saludo() { return <h1>Hola</h1>; }", true],
        ["function saludo() { return <h1>Hola</h1>; }  y usarlo como <saludo />", false],
        ["const Saludo = <h1>Hola</h1>;", false],
        ["class Saludo { render() { return <h1>Hola</h1>; } }", false],
      ], "Los componentes deben iniciar con mayúscula — <saludo /> se interpreta como etiqueta HTML nativa. La clase requeriría extender React.Component.", ["react", "componentes"]),
      q("Componentes y JSX", "¿Por qué se usa className en JSX en lugar de class?", [
        ["Porque class es palabra reservada de JavaScript", true],
        ["Por convención estética de React", false],
        ["Porque className aplica estilos más rápido", false],
        ["class funciona igual, son intercambiables", false],
      ], "JSX es JavaScript: class colisionaría con la sintaxis de clases, igual que htmlFor reemplaza a for.", ["react", "jsx"]),
      q("Componentes y JSX", "¿Qué son las props de un componente?", [
        ["Datos de solo lectura que el padre pasa al hijo", true],
        ["El estado interno mutable del componente", false],
        ["Variables globales compartidas", false],
        ["Los estilos CSS del componente", false],
      ], "Las props son inmutables desde el hijo: modificarlas es anti-patrón; el flujo de datos es unidireccional.", ["react", "props"]),
      q("Componentes y JSX", "¿Para qué sirve un Fragment (<>...</>)?", [
        ["Agrupar varios elementos sin agregar un nodo extra al DOM", true],
        ["Crear un componente sin nombre", false],
        ["Aislar estilos CSS", false],
        ["Suspender el renderizado", false],
      ], "Un componente debe retornar un solo elemento raíz; el Fragment evita divs envolventes innecesarios.", ["react", "jsx"]),
      q("Componentes y JSX", "¿Cómo accede un componente al contenido anidado entre sus etiquetas?", [
        ["Con props.children", true],
        ["Con props.content", false],
        ["Con this.innerHTML", false],
        ["Con useContent()", false],
      ], "<Card><p>Hola</p></Card> — dentro de Card, ese párrafo llega como children.", ["react", "props"]),
      q("Componentes y JSX", "¿Cómo se interpola una expresión JavaScript dentro de JSX?", [
        ["Con llaves: <p>{usuario.nombre}</p>", true],
        ["Con ${}: <p>${usuario.nombre}</p>", false],
        ["Con dobles llaves: <p>{{usuario.nombre}}</p>", false],
        ["Con %: <p>%usuario.nombre%</p>", false],
      ], "Las llaves simples evalúan cualquier expresión JS; dobles llaves solo aparecen al pasar un objeto literal (style={{...}}).", ["react", "jsx"]),
      q("Componentes y JSX", "¿Cuál es la forma idiomática de renderizado condicional en JSX?", [
        ["{estaLogueado && <Panel />} o un ternario", true],
        ["<if condition={estaLogueado}><Panel /></if>", false],
        ["v-if=\"estaLogueado\"", false],
        ["{when estaLogueado then <Panel />}", false],
      ], "React no tiene directivas: se usa JavaScript puro (&&, ternarios, o retornos tempranos).", ["react", "jsx"]),
      q("Estado y eventos", "¿Qué devuelve useState(0)?", [
        ["Un array con el valor actual y la función para actualizarlo", true],
        ["Un objeto { value, set }", false],
        ["Solo el valor actual", false],
        ["Una promesa con el estado", false],
      ], "const [count, setCount] = useState(0) — la desestructuración de array permite nombrarlos libremente.", ["react", "hooks"]),
      q("Estado y eventos", "¿Qué ocurre cuando llamas a la función setter de useState?", [
        ["React programa un re-render del componente con el nuevo valor", true],
        ["La variable cambia inmediatamente en la misma línea", false],
        ["Se recarga la página", false],
        ["Solo cambia el DOM sin tocar el estado", false],
      ], "La actualización es asíncrona a efectos prácticos: leer el estado justo después del set devuelve el valor anterior.", ["react", "estado"]),
      q("Estado y eventos", "¿Por qué está mal mutar el estado directamente (items.push(x))?", [
        ["React compara referencias: si el array es el mismo objeto, no detecta el cambio ni re-renderiza", true],
        ["push es más lento que el spread", false],
        ["Lanza una excepción siempre", false],
        ["No está mal si el array es pequeño", false],
      ], "Lo correcto es crear una nueva referencia: setItems([...items, x]).", ["react", "estado"]),
      q("Estado y eventos", "¿Cuál es la forma correcta de asignar un manejador de click?", [
        ["<button onClick={guardar}>", true],
        ["<button onClick={guardar()}>", false],
        ["<button onclick=\"guardar()\">", false],
        ["<button on-click={guardar}>", false],
      ], "onClick={guardar()} ejecuta la función en cada render en vez de pasarla como callback. Para pasar argumentos: onClick={() => guardar(id)}.", ["react", "eventos"]),
      q("Estado y eventos", "¿Qué es un input controlado?", [
        ["Un input cuyo valor vive en el estado de React (value + onChange)", true],
        ["Un input deshabilitado", false],
        ["Un input validado por el navegador", false],
        ["Un input dentro de un formulario", false],
      ], "El estado es la única fuente de verdad: value={texto} onChange={(e) => setTexto(e.target.value)}.", ["react", "formularios"]),
      q("Estado y eventos", "¿Qué es \"levantar el estado\" (lifting state up)?", [
        ["Mover el estado al ancestro común para compartirlo entre hermanos", true],
        ["Guardar el estado en localStorage", false],
        ["Convertir estado local en global con Redux", false],
        ["Pasar el estado del hijo al padre por props", false],
      ], "Los hermanos no se comunican directo: el padre guarda el estado y lo distribuye por props; los hijos avisan con callbacks.", ["react", "estado"]),
      q("Estado y eventos", "¿Cuándo se re-renderiza un componente?", [
        ["Cuando cambia su estado o cambian sus props", true],
        ["Solo cuando cambia el DOM manualmente", false],
        ["En cada segundo, por el ciclo interno de React", false],
        ["Solo al llamar forceUpdate", false],
      ], "El re-render también ocurre cuando se re-renderiza el padre (salvo memorización).", ["react", "render"]),
      q("Estado y eventos", "¿Cuál es la forma segura de incrementar basándose en el valor anterior?", [
        ["setCount(prev => prev + 1)", true],
        ["setCount(count + 1) siempre es equivalente", false],
        ["count++ y luego setCount(count)", false],
        ["setCount(+1)", false],
      ], "La forma funcional garantiza el valor más reciente cuando hay varias actualizaciones en el mismo ciclo.", ["react", "estado"]),
      q("Hooks y listas", "¿Qué hace useEffect(fn, []) con array de dependencias vacío?", [
        ["Ejecuta fn una sola vez, después del primer render (montaje)", true],
        ["Ejecuta fn en cada render", false],
        ["Nunca ejecuta fn", false],
        ["Ejecuta fn antes del primer render", false],
      ], "El array vacío significa \"sin dependencias que observar\": solo al montar (y su cleanup al desmontar).", ["react", "hooks"]),
      q("Hooks y listas", "¿Para qué sirve la función retornada dentro de useEffect?", [
        ["Es el cleanup: se ejecuta antes del siguiente efecto y al desmontar", true],
        ["Es el valor que recibe el componente padre", false],
        ["Define el estado inicial", false],
        ["Cancela el render en curso", false],
      ], "Ahí se limpian suscripciones, timers y listeners para evitar fugas de memoria.", ["react", "hooks"]),
      q("Hooks y listas", "¿Cuáles son las reglas de los hooks?", [
        ["Llamarlos solo en el nivel superior del componente", true],
        ["Llamarlos solo desde componentes o custom hooks", true],
        ["Pueden llamarse dentro de condicionales si hay default", false],
        ["Pueden llamarse en cualquier función JavaScript", false],
      ], "React depende del orden de llamada de los hooks entre renders; meterlos en ifs o loops lo rompe.", ["react", "hooks"]),
      q("Hooks y listas", "¿Por qué cada elemento de una lista necesita la prop key?", [
        ["Para que React identifique qué elementos cambiaron, se agregaron o eliminaron", true],
        ["Para dar estilos únicos a cada fila", false],
        ["Es solo una convención sin efecto real", false],
        ["Para ordenar la lista automáticamente", false],
      ], "Sin keys estables, React reutiliza nodos incorrectamente: estados que \"saltan\" de fila y renders ineficientes.", ["react", "listas"]),
      q("Hooks y listas", "¿Por qué se desaconseja usar el índice del array como key?", [
        ["Al insertar o reordenar, los índices cambian y React confunde la identidad de los elementos", true],
        ["Porque los números no son keys válidas", false],
        ["Por rendimiento: los strings son más rápidos", false],
        ["No se desaconseja, es la recomendación oficial", false],
      ], "El índice como key es aceptable solo en listas estáticas que nunca se reordenan ni filtran.", ["react", "listas"]),
      q("Hooks y listas", "¿Cuál es la forma idiomática de renderizar una lista?", [
        ["{items.map(item => <Fila key={item.id} item={item} />)}", true],
        ["{for (const item of items) { <Fila /> }}", false],
        ["<repeat items={items}><Fila /></repeat>", false],
        ["{items.forEach(item => <Fila key={item.id} />)}", false],
      ], "map devuelve el array de elementos que JSX renderiza; forEach devuelve undefined y no pinta nada.", ["react", "listas"]),
      q("Hooks y listas", "¿Qué es el Virtual DOM?", [
        ["Una representación en memoria del UI que React compara para aplicar solo los cambios necesarios al DOM real", true],
        ["Una copia del DOM guardada en el servidor", false],
        ["El DOM dentro de un iframe oculto", false],
        ["Una API del navegador que React activa", false],
      ], "React reconcilia el árbol virtual nuevo contra el anterior (diffing) y actualiza el DOM real de forma mínima.", ["react", "conceptos"]),
      q("Hooks y listas", "¿Cómo comunica un hijo un evento a su padre?", [
        ["El padre le pasa una función por props y el hijo la invoca", true],
        ["El hijo modifica las props directamente", false],
        ["Con un evento global del navegador", false],
        ["No es posible sin una librería de estado", false],
      ], "Datos bajan por props, eventos suben por callbacks: <Hijo onSave={handleSave} />.", ["react", "props"]),
    ],
  },
  {
    slug: "badge-nodejs-basico",
    title: "Certificación Node.js · Básico",
    termSlug: "nodejs",
    description:
      "Fundamentos de Node.js: módulos, npm, asincronía, entorno y HTTP básico. Al aprobar obtienes el badge verificado Node.js · Básico.",
    sections: ["Módulos y npm", "Core y asincronía", "HTTP y entorno"],
    questions: [
      q("Módulos y npm", "¿Cómo se exporta una función en CommonJS?", [
        ["module.exports = miFuncion (o exports.miFuncion = ...)", true],
        ["export default miFuncion", false],
        ["return miFuncion al final del archivo", false],
        ["global.miFuncion = miFuncion", false],
      ], "CommonJS usa module.exports/require; export/import es la sintaxis de módulos ES (ESM).", ["nodejs", "modulos"]),
      q("Módulos y npm", "¿Cuál es la diferencia entre dependencies y devDependencies?", [
        ["devDependencies solo se necesitan para desarrollar (tests, linters); dependencies para ejecutar en producción", true],
        ["devDependencies se actualizan automáticamente", false],
        ["dependencies son opcionales", false],
        ["Ninguna, es organización visual", false],
      ], "npm install --production (o con NODE_ENV=production) omite las devDependencies.", ["nodejs", "npm"]),
      q("Módulos y npm", "¿Con qué comando se instala una dependencia solo de desarrollo?", [
        ["npm install --save-dev paquete (o -D)", true],
        ["npm install --dev-only paquete", false],
        ["npm add-dev paquete", false],
        ["npm install paquete --local", false],
      ], "El flag -D la registra en devDependencies del package.json.", ["nodejs", "npm"]),
      q("Módulos y npm", "¿Por qué node_modules no se sube al repositorio?", [
        ["Es reconstruible con npm install a partir del package.json y el lockfile", true],
        ["Git no soporta carpetas tan grandes", false],
        ["Contiene secretos del proyecto", false],
        ["npm lo borra al instalar", false],
      ], "Versionar node_modules infla el repo sin beneficio: el lockfile garantiza reproducibilidad.", ["nodejs", "npm"]),
      q("Módulos y npm", "¿Cuál es el propósito de package-lock.json?", [
        ["Fijar las versiones exactas de todo el árbol de dependencias para instalaciones reproducibles", true],
        ["Bloquear el proyecto contra escritura", false],
        ["Listar los scripts disponibles", false],
        ["Configurar el registro privado de npm", false],
      ], "package.json declara rangos (^1.2.0); el lockfile congela la resolución exacta que se instaló.", ["nodejs", "npm"]),
      q("Módulos y npm", "¿Qué significa el ^ en \"express\": \"^4.18.0\"?", [
        ["Acepta actualizaciones que no cambien la versión mayor: >=4.18.0 y <5.0.0", true],
        ["Exactamente la versión 4.18.0", false],
        ["Cualquier versión superior sin límite", false],
        ["La última versión beta", false],
      ], "El caret sigue semver: parches y minors sí, majors (breaking changes) no.", ["nodejs", "npm"]),
      q("Módulos y npm", "¿Cómo se ejecuta un script llamado \"dev\" definido en package.json?", [
        ["npm run dev", true],
        ["npm dev", false],
        ["node dev", false],
        ["npm exec-script dev", false],
      ], "Los scripts se corren con npm run <nombre>; solo start y test tienen atajo sin run.", ["nodejs", "npm"]),
      q("Módulos y npm", "¿Qué contiene la variable __dirname en CommonJS?", [
        ["La ruta absoluta del directorio del archivo actual", true],
        ["La ruta desde donde se ejecutó node", false],
        ["El nombre del archivo actual", false],
        ["La raíz del proyecto siempre", false],
      ], "__dirname es del archivo; process.cwd() es del directorio de trabajo desde donde se lanzó el proceso.", ["nodejs", "modulos"]),
      q("Core y asincronía", "¿Qué modelo de concurrencia usa Node.js?", [
        ["Un solo hilo con event loop y operaciones de E/S no bloqueantes", true],
        ["Un hilo por cada request", false],
        ["Multiproceso por defecto", false],
        ["Hilos verdes administrados por el sistema operativo", false],
      ], "El event loop despacha la E/S asíncrona; el código JavaScript corre en un solo hilo (workers aparte).", ["nodejs", "event-loop"]),
      q("Core y asincronía", "¿Cuál es la convención de los callbacks \"error-first\"?", [
        ["El primer parámetro del callback es el error (o null) y los siguientes los datos", true],
        ["El callback se llama primero con el error y luego otra vez con los datos", false],
        ["Los errores se lanzan siempre con throw", false],
        ["El error va como último parámetro", false],
      ], "fs.readFile(ruta, (err, data) => { if (err) ... }) — verificar err primero es el patrón clásico de Node.", ["nodejs", "callbacks"]),
      q("Core y asincronía", "¿Cuál es la diferencia entre fs.readFile y fs.readFileSync?", [
        ["readFileSync bloquea el event loop hasta terminar; readFile es asíncrono", true],
        ["readFileSync es más seguro", false],
        ["readFile solo lee archivos de texto", false],
        ["readFileSync no existe en Node moderno", false],
      ], "En un servidor, las variantes Sync bloquean TODAS las requests mientras leen — se reservan para scripts y arranque.", ["nodejs", "fs"]),
      q("Core y asincronía", "¿Cómo se leen archivos con promesas nativas?", [
        ["const { readFile } = require(\"fs/promises\") y usar await", true],
        ["fs.readFile().then() directamente sin importar nada especial", false],
        ["Solo con la librería externa fs-extra", false],
        ["Envolviendo readFileSync en una Promise", false],
      ], "El módulo fs/promises expone la API con promesas: ideal con async/await.", ["nodejs", "fs"]),
      q("Core y asincronía", "¿Qué pasa con una excepción no capturada en un servidor Node?", [
        ["El proceso crashea (por defecto) — de ahí la importancia de manejar errores", true],
        ["Node la ignora y sigue", false],
        ["Solo falla la request en curso", false],
        ["Se reinicia automáticamente sin perder estado", false],
      ], "En producción se combinan manejo de errores, process managers (pm2) u orquestadores que reinician el proceso.", ["nodejs", "errores"]),
      q("Core y asincronía", "¿Qué imprime este código?", [
        ["1 3 2", true],
        ["1 2 3", false],
        ["3 1 2", false],
        ["2 3 1", false],
      ], "setTimeout va a la cola del event loop: el código síncrono termina primero, igual que en el navegador.", ["nodejs", "event-loop"], "console.log(1);\nsetTimeout(() => console.log(2), 0);\nconsole.log(3);"),
      q("Core y asincronía", "¿Qué objetos del navegador NO existen en Node.js?", [
        ["window y document", true],
        ["console", false],
        ["setTimeout", false],
        ["JSON", false],
      ], "Node no tiene DOM: console, timers y JSON sí existen porque son del lenguaje/runtime, no del navegador.", ["nodejs", "runtime"]),
      q("Core y asincronía", "¿Para qué sirve nodemon en desarrollo?", [
        ["Reiniciar el proceso automáticamente al detectar cambios en los archivos", true],
        ["Monitorear la memoria en producción", false],
        ["Ejecutar tests en paralelo", false],
        ["Compilar TypeScript", false],
      ], "Evita el ciclo manual de Ctrl+C y relanzar; en Node 18+ existe también node --watch.", ["nodejs", "tooling"]),
      q("HTTP y entorno", "¿Cómo se lee una variable de entorno en Node?", [
        ["process.env.NOMBRE", true],
        ["env.get(\"NOMBRE\")", false],
        ["process.getEnv(\"NOMBRE\")", false],
        ["require(\"env\").NOMBRE", false],
      ], "process.env expone el entorno del proceso; paquetes como dotenv cargan archivos .env ahí.", ["nodejs", "entorno"]),
      q("HTTP y entorno", "¿Qué tipo de dato devuelve process.env.PORT?", [
        ["string (o undefined si no existe)", true],
        ["number", false],
        ["Depende del valor", false],
        ["boolean", false],
      ], "Todas las variables de entorno llegan como strings: PORT=3000 requiere Number(...) para aritmética.", ["nodejs", "entorno"]),
      q("HTTP y entorno", "¿Qué hace este código?", [
        ["Crea un servidor HTTP que responde \"hola\" y escucha en el puerto 3000", true],
        ["Hace una petición GET a localhost:3000", false],
        ["Crea un WebSocket", false],
        ["Lanza error: falta express", false],
      ], "El módulo http nativo basta para un servidor: express agrega routing y middleware encima de esto.", ["nodejs", "http"], "const http = require(\"http\");\n\nhttp.createServer((req, res) => {\n  res.end(\"hola\");\n}).listen(3000);"),
      q("HTTP y entorno", "En un handler HTTP, ¿qué representan req y res?", [
        ["req: la petición entrante; res: la respuesta que construyes y envías", true],
        ["req: la respuesta; res: la petición", false],
        ["Ambos son alias del socket", false],
        ["req es el body y res el status code", false],
      ], "De req lees método, URL, headers y body; en res escribes status, headers y cuerpo.", ["nodejs", "http"]),
      q("HTTP y entorno", "¿Qué es un middleware en Express?", [
        ["Una función que procesa la request antes del handler final y decide si continúa con next()", true],
        ["Un servidor intermedio entre cliente y API", false],
        ["El motor de plantillas", false],
        ["Una tabla de rutas", false],
      ], "app.use((req, res, next) => {...}) — autenticación, logging y parseo de body son middlewares típicos.", ["nodejs", "express"]),
      q("HTTP y entorno", "¿Qué hace express.json() como middleware?", [
        ["Parsea el body JSON de las requests y lo deja en req.body", true],
        ["Convierte todas las respuestas a JSON", false],
        ["Valida el esquema del body", false],
        ["Comprime las respuestas", false],
      ], "Sin este middleware, req.body llega undefined en los POST con JSON.", ["nodejs", "express"]),
      q("HTTP y entorno", "¿Qué código de estado corresponde a \"recurso creado\" tras un POST exitoso?", [
        ["201", true],
        ["200", false],
        ["204", false],
        ["301", false],
      ], "201 Created, idealmente con la ubicación del recurso nuevo; 204 es éxito sin contenido.", ["nodejs", "http"]),
      q("HTTP y entorno", "¿Cuál es el propósito de un archivo .env?", [
        ["Guardar configuración y secretos por entorno fuera del código (y fuera del repo)", true],
        ["Definir los scripts de npm", false],
        ["Configurar el compilador", false],
        ["Documentar las variables para el equipo (se versiona siempre)", false],
      ], "El .env se ignora en git; lo que se versiona es un .env.example sin valores sensibles.", ["nodejs", "entorno"]),
    ],
  },
  {
    slug: "badge-git-basico",
    title: "Certificación Git · Básico",
    termSlug: "git",
    description:
      "Fundamentos de Git: staging, commits, ramas, remotos y cómo deshacer cambios. Al aprobar obtienes el badge verificado Git · Básico.",
    sections: ["Básicos", "Ramas y colaboración", "Deshacer y estado"],
    questions: [
      q("Básicos", "¿Qué hace git init?", [
        ["Crea un repositorio Git nuevo en el directorio actual", true],
        ["Descarga un repositorio remoto", false],
        ["Instala Git en el sistema", false],
        ["Crea la rama main en el remoto", false],
      ], "git init crea el directorio .git con toda la estructura del repositorio local.", ["git", "basicos"]),
      q("Básicos", "¿Qué es el staging area (índice)?", [
        ["La zona intermedia donde preparas exactamente qué cambios entrarán al próximo commit", true],
        ["Una copia de respaldo automática", false],
        ["La rama temporal de trabajo", false],
        ["El historial de commits", false],
      ], "git add mueve cambios del working directory al staging; git commit los vuelve permanentes.", ["git", "staging"]),
      q("Básicos", "¿Qué hace git add archivo.txt?", [
        ["Agrega los cambios de ese archivo al staging area", true],
        ["Crea el archivo en el disco", false],
        ["Hace commit del archivo", false],
        ["Sube el archivo al remoto", false],
      ], "add prepara; el commit es un paso separado. git add . agrega todo lo modificado.", ["git", "staging"]),
      q("Básicos", "¿Cuál es la forma correcta de commitear con mensaje?", [
        ["git commit -m \"fix: corrige validación de email\"", true],
        ["git commit \"mensaje\"", false],
        ["git push -m \"mensaje\"", false],
        ["git save -m \"mensaje\"", false],
      ], "Sin -m, Git abre el editor configurado para escribir el mensaje.", ["git", "commits"]),
      q("Básicos", "¿Qué muestra git status?", [
        ["Archivos modificados, en staging y sin trackear, más el estado de la rama", true],
        ["El historial de commits", false],
        ["Las diferencias línea por línea", false],
        ["Los remotos configurados", false],
      ], "Es el comando de orientación: qué cambió y qué entraría en el próximo commit.", ["git", "estado"]),
      q("Básicos", "¿Qué muestra git diff sin argumentos?", [
        ["Los cambios del working directory que aún NO están en staging", true],
        ["Los cambios ya commiteados", false],
        ["La diferencia con el remoto", false],
        ["Los archivos sin trackear", false],
      ], "Para ver lo ya staged se usa git diff --staged.", ["git", "estado"]),
      q("Básicos", "¿Para qué sirve el archivo .gitignore?", [
        ["Indicar patrones de archivos que Git no debe trackear (node_modules, .env, builds)", true],
        ["Ocultar archivos a otros colaboradores pero versionarlos", false],
        ["Borrar archivos del historial", false],
        ["Ignorar conflictos de merge", false],
      ], "Solo aplica a archivos aún no trackeados; los ya versionados requieren git rm --cached primero.", ["git", "basicos"]),
      q("Básicos", "¿Qué hace git clone <url>?", [
        ["Descarga el repositorio completo, con todo su historial, y configura el remoto origin", true],
        ["Descarga solo la última versión de los archivos", false],
        ["Crea una rama nueva del repo", false],
        ["Copia el repo sin historial", false],
      ], "Git es distribuido: cada clon contiene el historial completo, no solo un snapshot.", ["git", "remotos"]),
      q("Ramas y colaboración", "¿Cómo se crea una rama y se cambia a ella en un solo comando?", [
        ["git checkout -b feature/badges (o git switch -c)", true],
        ["git branch --move feature/badges", false],
        ["git create feature/badges", false],
        ["git branch feature/badges --go", false],
      ], "checkout -b y switch -c combinan crear + cambiar; git branch <nombre> solo crea.", ["git", "ramas"]),
      q("Ramas y colaboración", "¿Qué hace git merge feature estando en main?", [
        ["Integra los commits de feature dentro de main", true],
        ["Integra main dentro de feature", false],
        ["Borra la rama feature", false],
        ["Renombra feature a main", false],
      ], "El merge trae los cambios de la rama nombrada HACIA la rama actual.", ["git", "ramas"]),
      q("Ramas y colaboración", "¿Cuándo ocurre un conflicto de merge?", [
        ["Cuando ambas ramas modificaron las mismas líneas y Git no puede decidir automáticamente", true],
        ["Cada vez que dos ramas tocan el mismo archivo", false],
        ["Cuando el remoto está caído", false],
        ["Cuando faltan permisos de escritura", false],
      ], "Git marca las zonas en conflicto con <<<<<<< / ======= / >>>>>>> y tú resuelves manualmente.", ["git", "conflictos"]),
      q("Ramas y colaboración", "¿Qué equivale a git pull?", [
        ["git fetch + git merge (integra lo descargado en la rama actual)", true],
        ["git fetch solamente", false],
        ["git push + git merge", false],
        ["git clone parcial", false],
      ], "fetch descarga sin tocar tu rama; pull además fusiona (o rebasa con --rebase).", ["git", "remotos"]),
      q("Ramas y colaboración", "¿Cuál es la diferencia entre git fetch y git pull?", [
        ["fetch descarga referencias sin modificar tu rama; pull también integra los cambios", true],
        ["fetch es para subir y pull para bajar", false],
        ["fetch borra ramas locales obsoletas", false],
        ["Son idénticos", false],
      ], "fetch es seguro para inspeccionar antes de integrar: git fetch && git log origin/main.", ["git", "remotos"]),
      q("Ramas y colaboración", "¿Qué es origin?", [
        ["El nombre por convención del remoto principal del repositorio", true],
        ["La rama principal", false],
        ["El primer commit del historial", false],
        ["El servidor central obligatorio de Git", false],
      ], "Es solo un alias de la URL remota; git remote -v lista los remotos configurados.", ["git", "remotos"]),
      q("Ramas y colaboración", "¿Qué hace git push origin main?", [
        ["Sube los commits locales de main al remoto origin", true],
        ["Descarga main del remoto", false],
        ["Fusiona origin en main", false],
        ["Publica el repositorio como público", false],
      ], "push rechaza el envío si el remoto tiene commits que no tienes (non-fast-forward): primero pull/rebase.", ["git", "remotos"]),
      q("Ramas y colaboración", "¿Qué es un Pull Request (o Merge Request)?", [
        ["Una propuesta de integración de una rama, con revisión de código antes del merge", true],
        ["Un comando nativo de Git", false],
        ["Una petición de clonado del repo", false],
        ["Un backup del repositorio", false],
      ], "El PR es del flujo de plataformas (GitHub/GitLab): discusión, revisión y CI antes de integrar.", ["git", "colaboracion"]),
      q("Deshacer y estado", "¿Qué hace git stash?", [
        ["Guarda temporalmente los cambios sin commitear y limpia el working directory", true],
        ["Borra los cambios sin commitear definitivamente", false],
        ["Crea un commit oculto en el remoto", false],
        ["Comprime el repositorio", false],
      ], "Útil para cambiar de rama con trabajo a medias: git stash pop lo recupera.", ["git", "deshacer"]),
      q("Deshacer y estado", "¿Cuál es la diferencia clave entre git reset --hard y git reset --soft?", [
        ["--hard descarta los cambios del working directory; --soft los conserva en staging", true],
        ["--soft borra el historial; --hard no", false],
        ["--hard solo funciona en el remoto", false],
        ["Ninguna, son alias", false],
      ], "reset --hard es destructivo con el trabajo no commiteado — usarlo con plena certeza.", ["git", "deshacer"]),
      q("Deshacer y estado", "¿Cuál es la diferencia entre git revert y git reset para deshacer un commit ya pusheado?", [
        ["revert crea un commit nuevo que invierte los cambios (seguro en ramas compartidas); reset reescribe el historial", true],
        ["reset es más seguro en ramas compartidas", false],
        ["revert borra el commit del historial", false],
        ["Ambos reescriben el historial igual", false],
      ], "En ramas compartidas nunca se reescribe historia publicada: revert es el camino seguro.", ["git", "deshacer"]),
      q("Deshacer y estado", "¿Qué es HEAD?", [
        ["El puntero al commit actual sobre el que estás trabajando", true],
        ["La rama principal del repo", false],
        ["El commit más reciente de cualquier rama", false],
        ["El remoto por defecto", false],
      ], "Normalmente HEAD apunta a la punta de tu rama actual; en detached HEAD apunta a un commit suelto.", ["git", "conceptos"]),
      q("Deshacer y estado", "¿Qué hace git commit --amend?", [
        ["Reemplaza el último commit incorporando los cambios en staging y/o un nuevo mensaje", true],
        ["Agrega un commit vacío", false],
        ["Fusiona los dos últimos commits del remoto", false],
        ["Firma el commit con GPG", false],
      ], "amend reescribe el último commit (nuevo hash): evitarlo si ya fue pusheado a una rama compartida.", ["git", "deshacer"]),
      q("Deshacer y estado", "¿Qué muestra git log --oneline?", [
        ["El historial compacto: un commit por línea con hash corto y mensaje", true],
        ["Solo el último commit", false],
        ["Los archivos modificados de cada commit", false],
        ["El log del servidor remoto", false],
      ], "Variantes útiles: --graph para ver ramas, -n 5 para limitar.", ["git", "estado"]),
      q("Deshacer y estado", "¿Cómo descartas los cambios locales de un archivo (volver a la versión del último commit)?", [
        ["git checkout -- archivo.txt (o git restore archivo.txt)", true],
        ["git delete archivo.txt", false],
        ["git reset --file archivo.txt", false],
        ["git undo archivo.txt", false],
      ], "restore es el comando moderno para esto; los cambios descartados no se recuperan.", ["git", "deshacer"]),
      q("Deshacer y estado", "¿Qué significa que Git sea un sistema de control de versiones distribuido?", [
        ["Cada clon del repositorio contiene el historial completo y puede operar sin servidor central", true],
        ["Los archivos se reparten entre varios servidores", false],
        ["Requiere conexión permanente a internet", false],
        ["Cada desarrollador solo ve su parte del código", false],
      ], "Commits, ramas, log y diff funcionan totalmente offline; el remoto es un punto de sincronización, no una dependencia.", ["git", "conceptos"]),
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
        totalQuestions: 12,
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
        isBadgeExam: true,
        badgeTermId: term.id,
        badgeLevel: 1,
      },
      update: {
        isBadgeExam: true,
        badgeTermId: term.id,
        badgeLevel: 1,
        isActive: true,
        isGlobal: true,
      },
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
      `✓ Publicado: ${pool.title} — ${term.label} · Básico — ${pool.questions.length} preguntas en pool (examen de 12).`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
