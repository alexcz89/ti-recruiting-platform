# AI Assessment Generation — Phase 3A

El generador existente (`POST /api/ai/assessment-builder/generate`) entrega borradores al builder. El reclutador selecciona, edita y guarda explícitamente las preguntas. Generar no escribe preguntas, plantillas, candidatos ni aplicaciones.

## Contratos y compatibilidad

- Autenticación: reclutador con perfil APPROVED y companyId resuelto en servidor; administrador autorizado por rol explícito. No se acepta companyId ni jobId en el contrato de generación.
- Solicitud: hasta 24 000 bytes, prompt hasta 6 000 caracteres, de 1 a 5 preguntas, tipo y dificultad enumerados.
- Salida: Structured Outputs con el modelo configurado y validación Zod en servidor. Los modelos legacy contemplados usan modo JSON con la misma validación. Una salida incompleta, rechazada o inválida se descarta completa, sin aceptar preguntas parciales.
- MCQ: cuatro opciones distintas, una correcta, texto no vacío y cantidad exacta.
- CODING: esqueleto incompleto fijo por lenguaje, asignado exclusivamente por el servidor después de validar el borrador. El schema enviado a OpenAI omite `codeSnippet`; su objeto estricto rechaza ese campo, `starterCode`, `solutionCode` y cualquier otro campo no previsto. La respuesta pública conserva `codeSnippet` para el builder. No se acepta código arbitrario del modelo, ni siquiera si incluye TODO. Lenguaje solicitado y casos distintos, al menos uno visible y uno oculto. Se rechazan entradas vacías, metadatos malformados y el sentinel `__NO_CHECK__`.
- JavaScript/TypeScript: runner `console.log(JSON.stringify(solution(...[ARGUMENTOS_JSON])));`, concatenado al código dentro de Judge0. Se analizan los argumentos como JSON; no se evalúa código generado en Next.js.
- Otros lenguajes: entrada de texto completo por stdin; el esqueleto incluye lectura y escritura, incluida la llamada a la función. El candidato implementa parsing y lógica. SQL usa datasets SQLite validados, seguidos de la consulta incompleta que el candidato debe terminar, sin stdin.
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

## Validación anterior al defecto de Preview (commit afb79b91)

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

## Corrección del starter resuelto detectado en Preview

La regresión reprodujo el fallo antes del cambio: el endpoint devolvía 200 con el programa Python `resultado = a + b; print(resultado)` en `codeSnippet`, en lugar de rechazarlo. El prompt solicitaba dejar la lógica incompleta, pero el servidor sólo exigía código no vacío. El builder lo guardaba sin alteraciones y el candidato lo recibía mediante el fallback de `starterCode` a `codeSnippet`.

Ahora `lib/ai/assessment-coding-starters.ts` define esqueletos incompletos para los 14 lenguajes del catálogo existente. Cada esqueleto exige implementar la lógica y falla mientras no se complete. Los esqueletos generales anteriores de `Judge0Service.getStarterCode` no se cambian: algunos sólo leen una línea o, en Python, no incluyen el transporte stdin/stdout. Reutilizarlos modificaría el contrato requerido o afectaría flujos antiguos. No cambia la ejecución de Judge0, ni hay escrituras automáticas sobre preguntas guardadas, respuestas o intentos activos.

El prompt reserva la solución de referencia a `explanation`, ya existente y no incluida en el payload candidato. Enunciado y sección deben contener sólo prosa, requisitos y ejemplos; el servidor rechaza bloques de código Markdown en ellos. Esto no demuestra que la prosa no revele un algoritmo ni que los resultados esperados sean correctos. Sigue siendo imprescindible revisar los borradores antes de guardarlos. El reclutador conserva su capacidad de editar el starter; esta protección se aplica al generador, no a la autoría manual.

La prueba del componente candidato usa la página, `AssessmentQuestion` y `CodeEditor` reales, con Monaco, red y persistencia simulados. Tanto el nuevo starter como una pregunta legacy cargan como **Pendiente**, y editar no envía respuestas. Un envío explícito exitoso marca **Respondida**; una respuesta previamente enviada conserva ese estado al reanudar. No se reprodujo el segundo síntoma como consecuencia del código precargado. Hay una leyenda estática «Respondida / Pendiente» en la vista ancha; no representa el estado individual de la pregunta. No se modifica la lógica de estados sin evidencia de un defecto.

### Validación inicial de la corrección del starter (antes del incidente 502)

- Focalizadas: **5 suites, 164 pruebas aprobadas**. Generación, rechazo del caso observado y variantes con TODO, los 14 esqueletos, stdin visible/oculto sin alteraciones, runner JS/TS, datasets SQL, builder, guardado POST/PUT y estado del candidato.
- Regresión ampliada: **28 suites, 316 pruebas aprobadas**, incluidas las anteriores. MCQ, límite de 50 preguntas, permisos, expiración, invitaciones, intentos, badges, concursos, Judge0 y guardas del proceso canónico.
- `npm run type-check -- --incremental false`: aprobado.
- `git diff --check`: sin errores de whitespace.

```text
npx vitest run --exclude ".claude/worktrees/**" --reporter=dot --silent=true __tests__/server/ai-assessment-generation.test.ts __tests__/components/coding-candidate-initialization.test.tsx __tests__/components/ai-assessment-builder.test.tsx __tests__/security/assessment-builder-persistence.test.ts __tests__/server/judge0-language-contract.test.ts

npx vitest run --exclude ".claude/worktrees/**" --reporter=dot --silent=true __tests__/server/assessment __tests__/server/ai-assessment-generation.test.ts __tests__/server/judge0-language-contract.test.ts __tests__/server/sql-service.test.ts __tests__/server/contests.test.ts __tests__/server/badges-linkedin.test.ts __tests__/security/assessment-builder-persistence.test.ts __tests__/security/assessment-template-tenant-isolation.test.ts __tests__/security/job-edit-assessment-tenant-isolation.test.tsx __tests__/security/assessment-expiration-tenant.test.ts __tests__/security/coding-question-access.test.ts __tests__/security/custom-run-reservation.test.ts __tests__/components/ai-assessment-builder.test.tsx __tests__/components/coding-candidate-initialization.test.tsx __tests__/server/writer-cutover-architecture.test.ts
```

La prueba roja inicial fue 1 fallida / 78 aprobadas. Durante el desarrollo se corrigieron un escape de backticks de Kotlin y la representación del enum en el schema antes de la ejecución final. No se llamó a OpenAI ni a Judge0 reales ni se escribió en bases de datos: la generación y el transporte externo se simulan. Estas pruebas no sustituyen la comprobación funcional en Preview.

### Repetición funcional supervisada en Vercel Preview

Sin desplegar desde esta tarea, cuando el responsable actualice Preview con estos cambios:

1. Usar exclusivamente empresa/candidato sintéticos y la base aislada de Preview. Crear un template nuevo CODING Python; pedir un programa que sume dos enteros de stdin y escriba el resultado en stdout.
2. Revisar el borrador: `codeSnippet` debe coincidir con el esqueleto Python, con `raise NotImplementedError("TODO")`, lectura de `sys.stdin` y escritura a `sys.stdout`, sin suma implementada. La solución sólo puede estar en la explicación del reclutador. Revisar enunciado y casos visibles/ocultos manualmente.
3. Añadir y guardar explícitamente; comprobar que el editor del builder conserva el starter. Invitar al candidato sintético a un intento nuevo. No reutilizar un template antiguo que contenga la solución, porque no se reescriben datos existentes.
4. Antes de ejecutar o enviar: el editor candidato debe contener el mismo starter y el indicador de la pregunta debe ser **Pendiente**. No confundirlo con la leyenda. El payload candidato no debe incluir explicación, solución ni casos ocultos.
5. Ejecutar el starter sin completarlo: debe fallar, no superar los ejemplos. Implementar dentro de `solution(input_data)` la lectura de enteros y devolver la suma como texto. Ejecutar/enviar y verificar stdout, puntuación e indicador **Respondida**. El flujo existente puede enviar automáticamente tras superar todos los casos públicos al pulsar Ejecutar; no ocurre al cargar la página.
6. Recargar/reanudar y comprobar que conserva únicamente respuestas realmente guardadas. Repetir generación/revisión con JS/TS (runner JSON de argumentos) y SQL (dataset SQLite + consulta), sin alterar evaluaciones activas.

## Incidente 502 tras exigir el starter literal (HEAD base 2a00e62e)

### Evidencia real y alcance de la conclusión

La respuesta pública «El proveedor de IA no está disponible. Intenta más tarde.» corresponde exclusivamente al `AssessmentGenerationError` de tipo `provider` que se produce al fallar `chat.completions.create`. No corresponde al análisis JSON ni a la validación del contenido; esas ramas devuelven otro mensaje público.

Se reprodujo contra `api.openai.com/v1/chat/completions`, con el SDK instalado, el modelo local configurado `gpt-4o` y requisitos sintéticos, sin acceso a bases de datos:

| Comprobación | Resultado | Request ID |
| --- | --- | --- |
| Schema original, con el starter Python multilínea como enum; máximo 1 token | HTTP 400, tipo `invalid_request_error`, código `null` | `req_132bffe1e29d4af1b7e682a745d63b48` |
| Misma solicitud cambiando únicamente ese campo a string acotado | HTTP 200, `finish_reason=length` por el límite diagnóstico de 1 token | `req_e3d414ac309f43ac94c80e0e5cd5b8fd` |
| Schema corregido sin starter generado por el modelo, generación completa e instrucciones finales | HTTP 200, `finish_reason=stop`; validación aprobada, 1 pregunta, starter canónico y casos visibles/ocultos | `req_57bd1b0c63ec45d4a1753d6f0c609e48` |

La comparación aísla la restricción literal de `codeSnippet` como desencadenante del rechazo en esta configuración. No prueba qué detalle interno del literal rechaza el proveedor, ni que todos los enums o todos los modelos sean incompatibles. La [documentación oficial de Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat) admite enums en general. No se inspeccionaron los logs privados ni las variables remotas de Preview; la reproducción usa la configuración local verificada.

Dos generaciones intermedias con el schema ya aceptado recibieron HTTP 200 pero fueron rechazadas posteriormente por bloques Markdown en el enunciado. No se relajó ese control: se aclaró el prompt para que los ejemplos estén exclusivamente en `testCases` y el enunciado sea un párrafo de prosa. La última generación real pasó también la validación posterior. Esto no garantiza que todas las futuras respuestas del modelo sean semánticamente válidas: las salidas inválidas siguen fallando de forma segura.

### Cambio y diagnóstico seguro

- Se mantienen Structured Outputs, el modelo configurado, límites, timeout, ausencia de reintentos y revisión explícita del reclutador.
- El proveedor sólo genera enunciado, sección, dificultad, explicación, lenguajes y casos. El servidor agrega el starter existente e inmutable del lenguaje solicitado. No se modifica el catálogo de starters, el contrato público del builder, los templates guardados, Prisma ni Judge0.
- Si el modelo intenta devolver un `codeSnippet` completo, con TODO o incluso idéntico al canónico, se rechaza como campo no autorizado. El único starter devuelto procede del servidor.
- Los registros internos sólo contienen categoría (`provider_request`, `configuration`, `completion`, `json_parse` u `output_validation`), estado HTTP del proveedor, código/tipo e identificador de solicitud cuando existen y tienen formato acotado. Se descartan mensajes, cuerpos, cabeceras, stack, causas, prompts, respuestas, soluciones, claves y datos personales. El navegador conserva los errores genéricos existentes y `Cache-Control: no-store`.

### Regresión y validación final

La nueva prueba usa el SDK OpenAI real con transporte HTTP local simulado: reproduce el rechazo 400 del esquema anterior y comprueba el schema serializado sin `codeSnippet`, `strict: true`, `additionalProperties: false` y la asignación posterior del starter. Falló antes de la corrección (HTTP 502 en vez de 200). La evidencia de compatibilidad no depende sólo de esta simulación: incluye la comparación real y la generación completa indicadas arriba. CI no usa claves ni llamadas pagadas.

- Focalizadas: **5 suites, 170 pruebas aprobadas**.
- Regresión ampliada: **28 suites, 322 pruebas aprobadas**, incluidas las focalizadas.
- `npm run type-check -- --incremental false`: aprobado.
- `git diff --check`: sin errores; avisos de conversión LF/CRLF de Git.

Los comandos de Vitest son los mismos listados en la validación anterior, incluyendo `coding-candidate-initialization.test.tsx`. No se ejecutó Judge0 real ni se escribieron datos de candidatos. No hubo commit, push, PR ni deploy desde esta tarea.

### Verificación posterior en Preview

Cuando el responsable publique estos cambios en Preview (esta tarea no lo hace), verificar que el despliegue contiene la corrección y registrar el modelo configurado, sin copiar variables sensibles. Con un reclutador y empresa sintéticos, generar una nueva pregunta CODING Python de suma por stdin. Comprobar HTTP 200, starter canónico con `NotImplementedError`, casos visibles/ocultos y ausencia de solución en campos candidatos. Añadir, revisar y guardar explícitamente; ejecutar los pasos de candidato anteriores en un intento nuevo. Comprobar también MCQ y JS/TS/SQL. Si vuelve a fallar, correlacionar la categoría interna y el request ID: `provider_request` indica un rechazo de la llamada, mientras que `completion`, `json_parse` y `output_validation` indican una respuesta recibida que no se aceptó. No copiar prompts, soluciones ni payloads completos a logs o incidencias.
