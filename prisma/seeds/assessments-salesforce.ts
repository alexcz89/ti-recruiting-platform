// prisma/seeds/assessments-salesforce.ts
// Correr: dotenv -e .env.production.local -- tsx prisma/seeds/assessments-salesforce.ts

import { PrismaClient, AssessmentDifficulty } from "@prisma/client";
const prisma = new PrismaClient();

const salesforceDeveloper = {
  title: "Salesforce Developer",
  slug: "salesforce-developer-mid",
  description: "Evalúa conocimientos de desarrollo en Salesforce: Apex, SOQL, triggers, Lightning Web Components, integrations y mejores prácticas de la plataforma.",
  type: "MCQ" as const,
  difficulty: "MID" as AssessmentDifficulty,
  passingScore: 70,
  timeLimit: 30,
  sections: [
    { name: "Apex & SOQL", questions: 5 },
    { name: "Triggers & Automatización", questions: 4 },
    { name: "Lightning Web Components", questions: 4 },
    { name: "Integración & APIs", questions: 2 },
  ],
  questions: [

    // ── APEX & SOQL ──
    {
      section: "Apex & SOQL",
      difficulty: "MID" as AssessmentDifficulty,
      tags: ["apex", "soql"],
      questionText: "¿Cuál es el límite de registros que puede retornar una consulta SOQL en un contexto sincrónico en Salesforce?",
      options: [
        { id: "a", text: "1,000 registros", isCorrect: false },
        { id: "b", text: "10,000 registros", isCorrect: false },
        { id: "c", text: "50,000 registros", isCorrect: true },
        { id: "d", text: "100,000 registros", isCorrect: false },
      ],
      explanation: "En contextos sincrónicos (triggers, clases Apex normales), el límite es 50,000 registros por consulta SOQL. En batch Apex el límite sube a 50 millones con `Database.QueryLocator`.",
    },
    {
      section: "Apex & SOQL",
      difficulty: "MID" as AssessmentDifficulty,
      tags: ["apex", "colecciones"],
      questionText: "¿Cuál es la diferencia entre `List`, `Set` y `Map` en Apex?",
      options: [
        { id: "a", text: "Son lo mismo, solo cambia el nombre", isCorrect: false },
        { id: "b", text: "List permite duplicados y mantiene orden; Set no permite duplicados; Map almacena pares clave-valor", isCorrect: true },
        { id: "c", text: "Set es más rápido que List para todas las operaciones", isCorrect: false },
        { id: "d", text: "Map solo puede tener String como clave", isCorrect: false },
      ],
      explanation: "List: ordenada, permite duplicados. Set: no ordenada, no permite duplicados, útil para deduplicar IDs. Map: pares clave-valor, ideal para lookups rápidos por ID.",
    },
    {
      section: "Apex & SOQL",
      difficulty: "MID" as AssessmentDifficulty,
      tags: ["soql", "relaciones"],
      questionText: "¿Cuál query SOQL obtiene el nombre del Account relacionado a un Contact?",
      options: [
        { id: "a", text: "SELECT Name, Account.Name FROM Contact", isCorrect: true },
        { id: "b", text: "SELECT Name, AccountName FROM Contact JOIN Account", isCorrect: false },
        { id: "c", text: "SELECT Name FROM Contact INCLUDE Account.Name", isCorrect: false },
        { id: "d", text: "SELECT Name, (SELECT Name FROM Account) FROM Contact", isCorrect: false },
      ],
      explanation: "SOQL usa dot notation para traversal de relaciones padre. `Account.Name` en el SELECT de Contact navega la relación lookup/master-detail. No existe JOIN en SOQL.",
    },
    {
      section: "Apex & SOQL",
      difficulty: "MID" as AssessmentDifficulty,
      tags: ["apex", "governor-limits"],
      questionText: "¿Cuántas consultas SOQL síncronas se pueden ejecutar en una sola transacción en Salesforce?",
      options: [
        { id: "a", text: "10", isCorrect: false },
        { id: "b", text: "50", isCorrect: false },
        { id: "c", text: "100", isCorrect: true },
        { id: "d", text: "200", isCorrect: false },
      ],
      explanation: "El Governor Limit para SOQL queries en contexto síncrono es 100 queries por transacción. En async (batch, future, queueable) es 200. Por eso se debe bulkificar el código.",
    },
    {
      section: "Apex & SOQL",
      difficulty: "SENIOR" as AssessmentDifficulty,
      tags: ["apex", "soql", "agregaciones"],
      questionText: "¿Qué devuelve esta query?\n```sql\nSELECT AccountId, COUNT(Id) total\nFROM Contact\nGROUP BY AccountId\nHAVING COUNT(Id) > 5\n```",
      options: [
        { id: "a", text: "Todos los contactos con más de 5 campos", isCorrect: false },
        { id: "b", text: "Los AccountId que tienen más de 5 contactos asociados", isCorrect: true },
        { id: "c", text: "Un error porque SOQL no soporta HAVING", isCorrect: false },
        { id: "d", text: "Los primeros 5 contactos de cada Account", isCorrect: false },
      ],
      explanation: "SOQL soporta GROUP BY y HAVING para agregaciones. Esta query retorna objetos AggregateResult con el AccountId y el conteo, filtrando solo los accounts con más de 5 contactos.",
    },

    // ── TRIGGERS & AUTOMATIZACIÓN ──
    {
      section: "Triggers & Automatización",
      difficulty: "MID" as AssessmentDifficulty,
      tags: ["triggers", "apex"],
      questionText: "¿Cuál es la mejor práctica para los Apex Triggers en Salesforce?",
      options: [
        { id: "a", text: "Crear un trigger por cada lógica de negocio en el mismo objeto", isCorrect: false },
        { id: "b", text: "Un trigger por objeto que llama a una Handler class", isCorrect: true },
        { id: "c", text: "Poner toda la lógica directamente dentro del trigger", isCorrect: false },
        { id: "d", text: "Usar Process Builder en lugar de triggers siempre", isCorrect: false },
      ],
      explanation: "El patrón recomendado es 'One Trigger Per Object': un trigger que delega a una clase Handler (TriggerHandler pattern). Esto facilita el testing, mantenimiento y evita conflictos entre múltiples triggers.",
    },
    {
      section: "Triggers & Automatización",
      difficulty: "MID" as AssessmentDifficulty,
      tags: ["triggers", "contexto"],
      questionText: "¿Cuáles son los contextos de ejecución disponibles en un Apex Trigger?",
      options: [
        { id: "a", text: "Solo before insert y after insert", isCorrect: false },
        { id: "b", text: "before/after insert, update, delete; after undelete", isCorrect: true },
        { id: "c", text: "before/after insert, update, delete, merge, undelete", isCorrect: false },
        { id: "d", text: "Solo after insert, after update, after delete", isCorrect: false },
      ],
      explanation: "Los contextos son: before/after insert, before/after update, before/after delete, y after undelete. No existe 'before undelete'. Merge dispara update/delete en los registros involucrados.",
    },
    {
      section: "Triggers & Automatización",
      difficulty: "MID" as AssessmentDifficulty,
      tags: ["triggers", "bulkification"],
      questionText: "¿Por qué es un problema hacer una consulta SOQL dentro de un loop `for` en un trigger?",
      options: [
        { id: "a", text: "No es problema, es la forma correcta", isCorrect: false },
        { id: "b", text: "Puede superar el límite de 100 queries SOQL por transacción cuando hay múltiples registros", isCorrect: true },
        { id: "c", text: "Solo es problema si el loop tiene más de 1000 iteraciones", isCorrect: false },
        { id: "d", text: "Causa problemas de seguridad", isCorrect: false },
      ],
      explanation: "Si se procesan 150 registros en batch y hay una SOQL dentro del loop, se ejecutan 150 queries superando el límite de 100. La solución es sacar las queries del loop y usar colecciones de IDs.",
    },
    {
      section: "Triggers & Automatización",
      difficulty: "MID" as AssessmentDifficulty,
      tags: ["automatización", "flow"],
      questionText: "¿Cuándo es preferible usar un Flow Record-Triggered sobre un Apex Trigger?",
      options: [
        { id: "a", text: "Nunca, Apex Trigger siempre es mejor", isCorrect: false },
        { id: "b", text: "Para lógica declarativa simple sin necesidad de código, accesible para admins sin programación", isCorrect: true },
        { id: "c", text: "Solo para objetos estándar de Salesforce", isCorrect: false },
        { id: "d", text: "Cuando se necesitan más de 100 SOQL queries", isCorrect: false },
      ],
      explanation: "Record-Triggered Flows son ideales para automatización sin código: updates de campos, crear registros relacionados, enviar emails. Para lógica compleja, integraciones o procesamiento masivo, Apex Trigger es más apropiado.",
    },

    // ── LIGHTNING WEB COMPONENTS ──
    {
      section: "Lightning Web Components",
      difficulty: "MID" as AssessmentDifficulty,
      tags: ["lwc", "componentes"],
      questionText: "¿Qué decorator se usa en LWC para exponer una propiedad como atributo público accesible desde el componente padre?",
      options: [
        { id: "a", text: "@track", isCorrect: false },
        { id: "b", text: "@wire", isCorrect: false },
        { id: "c", text: "@api", isCorrect: true },
        { id: "d", text: "@public", isCorrect: false },
      ],
      explanation: "`@api` expone propiedades y métodos públicos del componente. `@track` (legacy) era para reactividad de objetos/arrays. `@wire` conecta con datos de Salesforce. En LWC moderno, las propiedades son reactivas por defecto.",
    },
    {
      section: "Lightning Web Components",
      difficulty: "MID" as AssessmentDifficulty,
      tags: ["lwc", "wire"],
      questionText: "¿Para qué sirve el decorator `@wire` en LWC?",
      options: [
        { id: "a", text: "Para definir estilos CSS reactivos", isCorrect: false },
        { id: "b", text: "Para llamar métodos Apex de forma imperativa", isCorrect: false },
        { id: "c", text: "Para conectar el componente a datos de Salesforce (Apex, wire adapters) de forma reactiva", isCorrect: true },
        { id: "d", text: "Para comunicación entre componentes hermanos", isCorrect: false },
      ],
      explanation: "`@wire` provee datos reactivos: cuando cambian los parámetros, el componente se actualiza automáticamente. Se usa con métodos Apex anotados con `@AuraEnabled(cacheable=true)` o con wire adapters como `getRecord`.",
    },
    {
      section: "Lightning Web Components",
      difficulty: "MID" as AssessmentDifficulty,
      tags: ["lwc", "eventos"],
      questionText: "¿Cómo comunica un LWC hijo un evento al componente padre?",
      options: [
        { id: "a", text: "Usando `@api` para llamar métodos del padre directamente", isCorrect: false },
        { id: "b", text: "Disparando un CustomEvent con `this.dispatchEvent()` y escuchándolo en el padre con `on[eventname]`", isCorrect: true },
        { id: "c", text: "Usando un servicio global compartido", isCorrect: false },
        { id: "d", text: "Con `window.postMessage()`", isCorrect: false },
      ],
      explanation: "El patrón estándar es: hijo dispara `this.dispatchEvent(new CustomEvent('miEvento', { detail: data }))`. El padre escucha con `onmievento={handleEvento}` en el template HTML.",
    },
    {
      section: "Lightning Web Components",
      difficulty: "SENIOR" as AssessmentDifficulty,
      tags: ["lwc", "lifecycle"],
      questionText: "¿En qué orden se ejecutan los lifecycle hooks de un LWC?",
      options: [
        { id: "a", text: "connectedCallback → constructor → renderedCallback", isCorrect: false },
        { id: "b", text: "constructor → connectedCallback → renderedCallback", isCorrect: true },
        { id: "c", text: "renderedCallback → constructor → connectedCallback", isCorrect: false },
        { id: "d", text: "constructor → renderedCallback → connectedCallback", isCorrect: false },
      ],
      explanation: "`constructor()` se llama al crear el componente. `connectedCallback()` cuando se inserta en el DOM. `renderedCallback()` después de cada render. `disconnectedCallback()` al removerse del DOM.",
    },

    // ── INTEGRACIÓN & APIs ──
    {
      section: "Integración & APIs",
      difficulty: "MID" as AssessmentDifficulty,
      tags: ["api", "rest", "integración"],
      questionText: "¿Qué clase de Apex se usa para hacer callouts HTTP hacia APIs externas?",
      options: [
        { id: "a", text: "HttpClient", isCorrect: false },
        { id: "b", text: "Http, HttpRequest y HttpResponse", isCorrect: true },
        { id: "c", text: "WebService y HttpCall", isCorrect: false },
        { id: "d", text: "ExternalAPI", isCorrect: false },
      ],
      explanation: "Para callouts en Apex se usan las clases `Http`, `HttpRequest` (configura método, endpoint, headers, body) y `HttpResponse` (procesa la respuesta). El endpoint debe estar en Remote Site Settings o Named Credentials.",
    },
    {
      section: "Integración & APIs",
      difficulty: "SENIOR" as AssessmentDifficulty,
      tags: ["api", "plataforma"],
      questionText: "¿Cuál es la diferencia entre REST API y BULK API de Salesforce?",
      options: [
        { id: "a", text: "REST API es más rápida para cualquier volumen de datos", isCorrect: false },
        { id: "b", text: "REST API es para operaciones individuales o pequeños lotes; BULK API está optimizada para cargas masivas de 50,000+ registros", isCorrect: true },
        { id: "c", text: "BULK API solo funciona para inserción, no para updates", isCorrect: false },
        { id: "d", text: "No hay diferencia práctica entre ambas", isCorrect: false },
      ],
      explanation: "REST API es síncrona y eficiente para operaciones puntuales. BULK API es asíncrona, procesa jobs en lotes y está diseñada para millones de registros. Para migraciones o integraciones masivas, BULK API es la opción correcta.",
    },
  ],
};

async function run() {
  console.log("🚀 Seeding Salesforce Developer template...");

  const template = await prisma.assessmentTemplate.upsert({
    where: { slug: salesforceDeveloper.slug },
    update: {
      title: salesforceDeveloper.title,
      description: salesforceDeveloper.description,
      type: salesforceDeveloper.type,
      difficulty: salesforceDeveloper.difficulty,
      totalQuestions: salesforceDeveloper.questions.length,
      passingScore: salesforceDeveloper.passingScore,
      timeLimit: salesforceDeveloper.timeLimit,
      sections: salesforceDeveloper.sections,
      isActive: true,
      updatedAt: new Date(),
    },
    create: {
      title: salesforceDeveloper.title,
      slug: salesforceDeveloper.slug,
      description: salesforceDeveloper.description,
      type: salesforceDeveloper.type,
      difficulty: salesforceDeveloper.difficulty,
      totalQuestions: salesforceDeveloper.questions.length,
      passingScore: salesforceDeveloper.passingScore,
      timeLimit: salesforceDeveloper.timeLimit,
      sections: salesforceDeveloper.sections,
      shuffleQuestions: true,
      allowRetry: false,
      maxAttempts: 1,
      penalizeWrong: false,
      isActive: true,
      isGlobal: true,
    },
  });

  console.log(`✅ Template: ${template.id}`);

  let created = 0;
  for (const q of salesforceDeveloper.questions) {
    const existing = await prisma.assessmentQuestion.findFirst({
      where: { templateId: template.id, questionText: q.questionText },
    });
    if (!existing) {
      await prisma.assessmentQuestion.create({
        data: {
          templateId: template.id,
          questionText: q.questionText,
          section: q.section,
          difficulty: q.difficulty,
          tags: q.tags,
          type: "MULTIPLE_CHOICE",
          options: q.options,
          allowMultiple: false,
          explanation: q.explanation,
          isActive: true,
        },
      });
      created++;
    }
  }

  console.log(`📝 ${created} preguntas creadas`);
  console.log("✨ Listo!");
}

run()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());