# AI Assessment Generation — Phase 3A

El generador existente (`POST /api/ai/assessment-builder/generate`) entrega borradores al builder. El reclutador selecciona, edita y guarda explícitamente las preguntas. Generar no escribe preguntas, plantillas, candidatos ni aplicaciones.

## Contratos y compatibilidad

- Autenticación: reclutador con perfil APPROVED y companyId resuelto en servidor; administrador autorizado por rol explícito. No se acepta companyId ni jobId en el contrato de generación.
- Solicitud: hasta 24 000 bytes, prompt hasta 6 000 caracteres, de 1 a 5 preguntas, tipo y dificultad enumerados.
- Salida: Structured Outputs con el modelo configurado y validación Zod en servidor. Los modelos legacy contemplados usan modo JSON con la misma validación. Una salida incompleta, rechazada o inválida se descarta completa, sin aceptar preguntas parciales.
- MCQ: cuatro opciones distintas, una correcta, texto no vacío y cantidad exacta.
- CODING: código base no vacío, lenguaje solicitado y casos distintos, al menos uno visible y uno oculto. Se rechazan entradas vacías, metadatos malformados y el sentinel `__NO_CHECK__`.
- JavaScript/TypeScript: runner `console.log(JSON.stringify(solution(...[ARGUMENTOS_JSON])));`, concatenado al código dentro de Judge0. Se analizan los argumentos como JSON; no se evalúa código generado en Next.js.
- Otros lenguajes: entrada de texto por stdin; el prompt exige un programa completo con lectura y escritura, incluida la llamada a la función. SQL usa datasets SQLite validados, seguidos de la consulta del candidato, sin stdin.
- El builder conserva el lenguaje de las preguntas. Su selector principal queda bloqueado cuando hay CODING, incluso en MIXED. POST y PUT comprueban metadatos de pregunta y, en PUT, también los datos persistidos antes de escribir. Se admite metadata legacy ausente heredando el lenguaje de la plantilla, y allowedLanguages en array o JSON válido.
- Un lote que supera las 50 preguntas se rechaza completo; la vista previa y la selección permanecen disponibles.

## Límite operativo pendiente para producción

El contador actual permite hasta 10 solicitudes por minuto y empresa **sólo dentro del proceso que recibe la solicitud**. Se reutiliza el helper de memoria existente. En Vercel hay múltiples instancias y reinicios: el contador no se comparte, no limita el consumo global y no garantiza un presupuesto por empresa. Los administradores tienen un contador local por usuario.

Los límites de tamaño, tokens (hasta 8 000), timeout de proveedor (45 segundos) y ausencia de reintentos automáticos acotan cada llamada, pero no el gasto total.

Antes de habilitar públicamente el generador se necesitan:

1. Cuotas persistentes y atómicas por empresa y usuario, compartidas entre instancias, con reserva y conciliación del consumo y límite de concurrencia. El registro de tokens/costos y los presupuestos persistentes corresponden a Phase 4.
2. Límites y alertas de gasto en el proyecto del proveedor y un mecanismo operativo para suspender nuevas generaciones. Las alertas por sí solas tampoco constituyen un corte de consumo garantizado.
3. Mantener acceso restringido a un piloto hasta disponer de esos controles; aplicar protección de frecuencia compartida en el borde si ya existe, sin suponer que reemplaza las cuotas por empresa.
4. Prueba supervisada con datos sintéticos en el Judge0 configurado y revisión de preguntas por lenguaje. Los tests de transporte simulan Judge0: no prueban compilación real, exactitud pedagógica ni que la solución propuesta pase todos los casos.

No se incorpora Redis, infraestructura adicional, billing ni configuración de producción en esta etapa. La revisión humana sigue siendo necesaria: los contratos estructurales no demuestran corrección semántica de código, distractores ni resultados esperados.

## Validación local de esta continuación

TypeScript aprobado sin regenerar la caché incremental preexistente:

```text
npm run type-check -- --incremental false
```

Pruebas focalizadas: 4 suites, 137 pruebas aprobadas. Incluyen autenticación, entradas/salidas inválidas, revisión/edición, coherencia POST/PUT, metadata legacy y capacidad 48+5, 48+2 y 50 preguntas.

```text
npx vitest run --exclude ".claude/worktrees/**" --reporter=dot --silent=true __tests__/components/ai-assessment-builder.test.tsx __tests__/server/ai-assessment-generation.test.ts __tests__/server/judge0-language-contract.test.ts __tests__/security/assessment-builder-persistence.test.ts
```

Regresión ampliada: 27 suites, 289 pruebas aprobadas. Este total incluye las pruebas focalizadas; no se suman ambos resultados.

```text
npx vitest run --exclude ".claude/worktrees/**" --reporter=dot --silent=true __tests__/server/assessment __tests__/server/ai-assessment-generation.test.ts __tests__/server/judge0-language-contract.test.ts __tests__/server/sql-service.test.ts __tests__/server/contests.test.ts __tests__/server/badges-linkedin.test.ts __tests__/security/assessment-builder-persistence.test.ts __tests__/security/assessment-template-tenant-isolation.test.ts __tests__/security/job-edit-assessment-tenant-isolation.test.tsx __tests__/security/assessment-expiration-tenant.test.ts __tests__/security/coding-question-access.test.ts __tests__/security/custom-run-reservation.test.ts __tests__/components/ai-assessment-builder.test.tsx __tests__/server/writer-cutover-architecture.test.ts
```

Los servicios externos y Prisma se simulan en estos tests. Se verificó el valor exacto del textarea del builder y su edición/guardado: `getByDisplayValue` requiere un normalizador identidad para comparar el código multilínea, porque su normalización predeterminada colapsa espacios y saltos de línea. La vista candidata conserva su fallback existente de `starterCode` a `codeSnippet`; no se cambió ese flujo.
