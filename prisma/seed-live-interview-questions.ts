/**
 * Banco de preguntas para entrevistas técnicas en vivo.
 * Ejecutar: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-live-interview-questions.ts
 * O agregar script en package.json: "seed:live-questions": "..."
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const QUESTIONS = [
  // ── Arquitectura y Escalabilidad ─────────────────────────────────────────
  {
    techStack: "General",
    category: "Escalabilidad",
    question: "Tu app empieza a recibir 10x el tráfico normal. ¿Qué harías primero para escalarla?",
    expectedTopics: ["horizontal scaling", "load balancer", "caching (Redis)", "CDN", "base de datos read replicas"],
    orderIndex: 1,
  },
  {
    techStack: "General",
    category: "Arquitectura",
    question: "¿Qué harías para migrar esta app a microservicios? ¿Por dónde empezarías?",
    expectedTopics: ["identificar dominios", "strangler fig pattern", "API gateway", "comunicación async (queues)", "deploy independiente"],
    orderIndex: 2,
  },
  {
    techStack: "General",
    category: "Arquitectura",
    question: "Si quisieras montar esta app en una máquina virtual en la nube, ¿cuáles serían los pasos?",
    expectedTopics: ["elegir proveedor (AWS/GCP/Azure)", "tipo de instancia", "abrir puertos", "instalar runtime", "process manager (PM2/systemd)", "reverse proxy (Nginx)", "SSL"],
    orderIndex: 3,
  },
  {
    techStack: "General",
    category: "Arquitectura",
    question: "¿Cómo manejarías el estado compartido entre múltiples instancias de tu app?",
    expectedTopics: ["Redis", "sesiones centralizadas", "stateless design", "sticky sessions (anti-pattern)", "JWT"],
    orderIndex: 4,
  },

  // ── Base de datos ─────────────────────────────────────────────────────────
  {
    techStack: "General",
    category: "Base de datos",
    question: "La query más lenta de tu app tarda 3 segundos. ¿Cómo la optimizarías?",
    expectedTopics: ["EXPLAIN/EXPLAIN ANALYZE", "índices", "N+1 queries", "eager loading", "query rewrite", "caching"],
    orderIndex: 5,
  },
  {
    techStack: "General",
    category: "Base de datos",
    question: "¿Cuándo usarías SQL vs NoSQL? Dame un ejemplo concreto de cada uno.",
    expectedTopics: ["transacciones ACID", "esquema flexible", "relaciones complejas", "escalabilidad horizontal", "caso de uso real"],
    orderIndex: 6,
  },

  // ── Frontend ──────────────────────────────────────────────────────────────
  {
    techStack: "Frontend",
    category: "Performance",
    question: "En el frontend que construiste, los SVGs generados por AI hacen bloat en el código. ¿Qué harías para reemplazarlos?",
    expectedTopics: ["sprite SVG", "icon library (Lucide, Heroicons)", "icon font", "lazy loading", "SVGO optimización", "imagen PNG/WebP como alternativa"],
    orderIndex: 7,
  },
  {
    techStack: "Frontend",
    category: "Performance",
    question: "¿Cómo mejorarías el tiempo de carga inicial de tu app?",
    expectedTopics: ["code splitting", "lazy loading", "bundle analyzer", "tree shaking", "CDN para assets", "critical CSS", "prefetch/preload"],
    orderIndex: 8,
  },
  {
    techStack: "Frontend",
    category: "Estado",
    question: "Si tu app creciera con más features, ¿cómo manejarías el estado global?",
    expectedTopics: ["Context API", "Zustand", "Redux", "React Query para server state", "separar server vs client state"],
    orderIndex: 9,
  },

  // ── DevOps / Cloud ────────────────────────────────────────────────────────
  {
    techStack: "DevOps",
    category: "CI/CD",
    question: "¿Cómo montarías un pipeline de CI/CD para esta app?",
    expectedTopics: ["GitHub Actions / GitLab CI", "lint + tests en PR", "build", "deploy staging", "deploy producción con aprobación", "rollback"],
    orderIndex: 10,
  },
  {
    techStack: "DevOps",
    category: "Contenedores",
    question: "¿Cómo dockerizarías esta app? ¿Qué incluirías en el Dockerfile?",
    expectedTopics: ["base image", "COPY de código", "RUN npm install / mvn package", "EXPOSE puerto", "CMD", "multi-stage build", ".dockerignore"],
    orderIndex: 11,
  },
  {
    techStack: "DevOps",
    category: "Monitoreo",
    question: "¿Cómo sabrías si tu app en producción está fallando antes que te lo digan los usuarios?",
    expectedTopics: ["health checks", "alertas de error rate", "logs estructurados", "Sentry / Datadog", "uptime monitoring", "métricas de latencia"],
    orderIndex: 12,
  },

  // ── Seguridad ─────────────────────────────────────────────────────────────
  {
    techStack: "General",
    category: "Seguridad",
    question: "¿Qué vulnerabilidades de seguridad podría tener la app que acabas de construir?",
    expectedTopics: ["API key expuesta", "CORS mal configurado", "SQL injection", "rate limiting", "autenticación", "HTTPS", "variables de entorno"],
    orderIndex: 13,
  },
  {
    techStack: "General",
    category: "Seguridad",
    question: "¿Cómo protegerías la API key de la API externa que usaste?",
    expectedTopics: ["variables de entorno", "backend proxy", "nunca en cliente", "secret manager", "rotación de keys"],
    orderIndex: 14,
  },

  // ── Java específico ───────────────────────────────────────────────────────
  {
    techStack: "Java",
    category: "Concurrencia",
    question: "En Java, ¿cuándo usarías un ExecutorService en lugar de crear threads directamente?",
    expectedTopics: ["thread pool", "gestión de recursos", "Future/CompletableFuture", "overhead de crear threads", "shutdown graceful"],
    orderIndex: 15,
  },
  {
    techStack: "Java",
    category: "Spring Boot",
    question: "¿Cómo manejarías transacciones en Spring Boot cuando tienes múltiples operaciones en la DB?",
    expectedTopics: ["@Transactional", "propagation", "rollback en excepción", "transacciones anidadas", "isolation level"],
    orderIndex: 16,
  },
  {
    techStack: "Java",
    category: "Performance",
    question: "Tu API Java tarda mucho en responder bajo carga. ¿Cómo lo diagnosticarías?",
    expectedTopics: ["profiler (VisualVM/JProfiler)", "thread dump", "heap dump", "GC logs", "N+1 con Hibernate", "connection pool"],
    orderIndex: 17,
  },

  // ── Soft skills técnicos ──────────────────────────────────────────────────
  {
    techStack: "General",
    category: "Proceso",
    question: "¿Cómo decidirías si hacer algo tú mismo o usar una librería externa?",
    expectedTopics: ["mantenimiento", "licencia", "bundle size", "curva de aprendizaje", "casos de uso cubiertos", "alternativas"],
    orderIndex: 18,
  },
  {
    techStack: "General",
    category: "Proceso",
    question: "¿Qué harías si en code review te dicen que tu solución no escala?",
    expectedTopics: ["entender el feedback", "preguntar ejemplos concretos", "investigar alternativas", "proponer solución", "aprender del proceso"],
    orderIndex: 19,
  },
  {
    techStack: "General",
    category: "Deuda técnica",
    question: "En 6 meses, alguien más va a mantener el código que acabas de escribir. ¿Qué harías diferente?",
    expectedTopics: ["nombres claros", "README con instrucciones", "tests", "comentarios donde hay lógica no obvia", "estructura de carpetas", "evitar magic numbers"],
    orderIndex: 20,
  },
];

async function main() {
  console.log("Seeding live interview question bank...");

  let created = 0;
  let skipped = 0;

  for (const q of QUESTIONS) {
    const existing = await prisma.liveInterviewQuestion.findFirst({
      where: { question: q.question },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.liveInterviewQuestion.create({ data: q });
    created++;
  }

  console.log(`Done: ${created} created, ${skipped} already exist.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
