# Assessment Builder: rediseño de edición enfocada

Inicio: 2026-10-25. Cierre de validación: 2026-10-26. Rama: `codex/assessment-builder-ux`.
Base: `717aebb0`, main actualizado con la integración de PR #57.

## Auditoría del comportamiento existente

- `app/dashboard/assessments/builder/page.tsx` concentraba estado, hidratación, validación y guardado junto con tarjetas expandibles de todas las preguntas. El icono de arrastre era decorativo: no había un controlador de reordenamiento.
- `components/dashboard/assessments/AIQuestionGenerator.tsx` ya permitía generar, revisar y seleccionar preguntas antes de agregarlas. No guardaba templates automáticamente.
- `components/dashboard/assessments/AssessmentPreviewModal.tsx` ya ofrecía vista previa y se reutiliza sin modificaciones.
- El editor Monaco existente está ligado al flujo del candidato, ejecución y envío. Se descartó reutilizarlo para evitar acoplar esos contratos al Builder.
- Se conservan el sistema Tailwind de TaskIO, sus fuentes, colores, variantes oscuras, iconos y el componente Skeleton existente. No se agregan dependencias.

## Decisiones implementadas

- Encabezado fijo compacto con título, tipo, contador, configuración, vista previa y guardado explícito. El estado distingue «Guardado manual» de «Cambios sin guardar».
- Desktop y tablet: navegación lateral con búsqueda y páginas de diez preguntas; editor único identificado por el ID de la pregunta. Mobile: selector nativo y acciones de adición plegables.
- Configuración plegable, con los campos y semántica existentes. Al cargar un template, se prioriza la primera pregunta; al crear uno, se muestra la configuración.
- MCQ: enunciado, opciones y controles nativos de respuesta única/múltiple. Se confirma una conversión explícita que quitaría respuestas correctas adicionales.
- CODING: textarea de código de 16 líneas, altura observada de 418 px. Conserva indentación y desplazamiento interno cuando las líneas de código son largas. Los tests usan textareas multilínea y etiquetas Público/Oculto.
- Los enunciados, opciones y tests crecen con su contenido para evitar scroll vertical anidado. Sección y explicación permanecen plegadas inicialmente.
- Reordenamiento por botones Subir/Bajar; eliminación confirmada y selección de una pregunta vecina. El contenido permanece en el estado del padre al cambiar de editor.
- Los errores continúan visibles al navegar y conducen a su pregunta o campo general. Las reglas de validación existentes no se amplían ni relajan.
- Protección de borradores con confirmación en Volver, enlaces internos ordinarios y advertencia de recarga/cierre. No hay autoguardado ni almacenamiento local de respuestas.
- El modal de IA se monta en document.body para escapar del contexto fijo lateral; controla foco, Tab y Escape. Su generación, revisión y solicitudes no cambian.

## Contratos preservados

Sin cambios en APIs, Prisma, prompts, Structured Outputs, starter canónico, lenguajes admitidos, límites, Judge0, billing, Application, flags ni editor del candidato. La hidratación GET y los cuerpos POST/PUT del Builder conservan sus campos, incluidos IDs, orden, dificultad por pregunta, lenguajes, respuestas correctas y tests ocultos. El máximo sigue siendo 50 preguntas. El cambio de tipo conserva su filtrado previo y ahora pide confirmación antes de descartar preguntas incompatibles del borrador.

## Validación automatizada

Comando dirigido, **61 pruebas / 3 archivos aprobados**:

```powershell
npx vitest run --exclude ".claude/worktrees/**" --reporter=dot --silent=true __tests__/components/ai-assessment-builder.test.tsx __tests__/components/assessment-builder-workspace.test.tsx __tests__/security/assessment-builder-persistence.test.ts
```

Regresión ampliada, **358 pruebas / 30 archivos aprobados**:

```powershell
npx vitest run --exclude ".claude/worktrees/**" --reporter=dot --silent=true __tests__/server/assessment __tests__/server/ai-assessment-generation.test.ts __tests__/server/judge0-language-contract.test.ts __tests__/server/sql-service.test.ts __tests__/server/contests.test.ts __tests__/server/badges-linkedin.test.ts __tests__/security/assessment-builder-persistence.test.ts __tests__/security/assessment-template-tenant-isolation.test.ts __tests__/security/job-edit-assessment-tenant-isolation.test.tsx __tests__/security/assessment-expiration-tenant.test.ts __tests__/security/coding-question-access.test.ts __tests__/security/custom-run-reservation.test.ts __tests__/components/ai-assessment-builder.test.tsx __tests__/components/assessment-builder-workspace.test.tsx __tests__/components/coding-candidate-initialization.test.tsx __tests__/components/coding-assessment-lifecycle.test.tsx __tests__/server/writer-cutover-architecture.test.ts
```

La ejecución dirigida está incluida en la ampliada: los totales no se suman. En la validación inicial se corrigieron tres accesos Array.at en las nuevas pruebas por compatibilidad con el target TypeScript, y se ajustó únicamente el formato de createPortal. El 2026-10-26 se repitieron la ampliada (358/358), la dirigida (61/61), type-check y lint sobre el código final. No se encontraron ediciones incompletas, imports incorrectos ni marcadores de conflicto. No fueron necesarios cambios adicionales al código de producción durante este cierre.

- `npm run type-check -- --incremental false`: aprobado. El primer cierre detectó tres usos de Array.at incompatibles en el nuevo test; corregidos sin cambiar tsconfig.
- `npm run lint`: aprobado con dos avisos previos, fuera de alcance: dependencia onTabReturn en `app/assessments/[templateId]/useAntiCheating.ts:184` y selectedJob.slug en `components/jobs/ClientSplitView.tsx:73`.
- Revisión del diff y whitespace: sin errores. Git avisa de normalización LF/CRLF en el test existente; no es un fallo funcional.
- Se mantienen las siete pruebas existentes de revisión IA/persistencia y se añaden once de navegación, orden, conservación de valores multilínea, reapertura del payload, confirmaciones, errores, creación manual y foco del generador.
- No se realizan llamadas reales a OpenAI, Judge0 ni una base de datos. Las pruebas no certifican esos servicios externos.

## Inspección visual local

Chrome aislado con el Builder real, CSS de Tailwind y fuentes locales del proyecto. Se sustituyen únicamente navegación y respuestas de API por fixtures sintéticos, con un shell representativo de las alturas del dashboard. No es una ejecución completa de NextAuth ni del dashboard desplegado.

Artefactos locales ignorados por Git en `test-screenshots/builder-ux-20261025/`. Comando: `node test-screenshots/builder-ux-20261025/inspect.cjs`.

- Desktop 1440×1000, tablet 820×1180 y mobile 390×844: sin desbordamiento horizontal del documento, un solo editor, enunciado sin scroll vertical interno y botón Guardar visible y sin obstrucciones después de desplazar la página.
- Inspección de capturas CODING, MCQ, configuración, tema oscuro, modal IA y estados desplazados.
- Teclado real: Enter selecciona otra pregunta desde la lista; ArrowDown cambia la respuesta única MCQ; Tab inverso permanece en el modal IA; Escape lo cierra y devuelve el foco al disparador.
- Vista previa existente abre y cierra. Ningún error de ejecución del navegador durante esta comprobación.
- Segunda inspección de mobile: modal IA dentro de la pantalla, error de proveedor simulado visible sin alterar las preguntas, estados vacío/cargando/error sin desbordamiento. La advertencia beforeunload se observó en Chrome al abandonar un borrador modificado.
- Un intento del arnés visual agotó el tiempo de navegación porque no respondía al aviso beforeunload. Se ajustó sólo el arnés para aceptar ese diálogo; la repetición terminó correctamente. No fue un fallo de Vitest ni del Builder.
- Aviso de herramientas: caniuse-lite de Browserslist está desactualizado. No se actualizan dependencias como parte de este trabajo.

## Auditoría de diseño acotada

Veredicto: interfaz funcional de producto, sin nuevas gradientes, métricas decorativas ni animaciones de adorno. Se mantiene la identidad TaskIO. Evaluación orientativa por inspección, sin afirmar certificación WCAG ni medición de rendimiento de producción:

| Dimensión | Puntuación | Evidencia o límite |
| --- | --- | --- |
| Accesibilidad | 3/4 | Labels, controles nativos, foco visible, errores enlazados y foco del modal. Pendiente lector de pantalla y zoom en shell completo. |
| Rendimiento | 3/4 | Un editor y diez entradas visibles, sin nuevas librerías. Sin perfilado de producción. |
| Responsive | 3/4 | Tres tamaños inspeccionados; falta móvil físico y shell desplegado. |
| Temas | 3/4 | Paleta existente y tema oscuro inspeccionado; el generador conserva tipografía secundaria pequeña heredada. |
| Antipatrones | 4/4 | Jerarquía de trabajo clara, sin nuevas superficies decorativas ni tarjetas anidadas para cada test. |
| Total | 16/20 | Bueno, con comprobaciones finales de Preview pendientes. |

Los avisos gray-on-color del detector se revisaron como falsos positivos por combinar ramas condicionales, hover y dark: el texto seleccionado usa tonos teal sobre teal; Guardar usa blanco sobre teal-700 en claro y zinc-950 sobre teal-600 en oscuro; eliminar cambia simultáneamente texto y fondo a rojo al pasar el cursor. En AIQuestionGenerator, las sugerencias usan gris sobre zinc-50 en reposo y teal-700 sobre teal-50 en hover. No se suprimen reglas ni se guardan excepciones del detector.

Contraste calculado para pares de la paleta Tailwind utilizada: Guardar claro 5.47:1, Guardar oscuro 5.31:1, texto secundario claro 7.73:1 y oscuro 6.91:1; placeholder claro 4.83:1; selección clara 13.87:1 y oscura 12.84:1. Las sugerencias IA dan 4.63:1 en reposo y 5.25:1 en hover. Este cálculo no reemplaza una auditoría integral del modal heredado ni de todos los estados desplegados.

Hallazgos pendientes acotados:

- **P2, usabilidad/datos:** Atrás/Adelante nativos dentro del App Router y navegación programática externa no tienen bloqueo propio. La inspección de la versión instalada de Next.js confirma que su listener de popstate restaura la ruta con ACTION_RESTORE, sin un punto de cancelación utilizado por el Builder; el borrador sólo vive en estado React. Por tanto existe riesgo de perderlo al desmontar el editor. La protección implementada cubre los caminos indicados arriba. No se manipulan popstate ni entradas artificiales de historial para evitar ampliar el riesgo. Mejora posterior: estrategia compartida de recuperación de borradores o bloqueo de navegación soportado por el router, con pruebas de historial. No se agrega autoguardado en esta tarea.
- **P2, accesibilidad heredada:** el generador y la vista previa conservan estilos secundarios pequeños de la implementación anterior. Su rediseño completo queda fuera de alcance. Revisar lector de pantalla, contraste de todos los estados y zoom antes de afirmar conformidad integral.

No se identificaron bloqueos nuevos en los caminos ejercitados. Fortalezas: controles con semántica nativa, acciones principales de 44 px, IDs estables, campos multilínea sin transformación y ausencia de cambios de backend. Si se aborda el acabado heredado: `$impeccable adapt`, seguido de `$impeccable polish` y una nueva auditoría. Estas mejoras pueden realizarse por separado y en el orden que se prefiera.

## QA pendiente en Preview

1. Con una cuenta reclutadora de prueba, crear MCQ, CODING y MIXED. Revisar configuración, generación IA, selección antes de agregar y guardado explícito.
2. Editar opciones, respuestas múltiples, código y tests con saltos de línea y espacios finales. Alternar preguntas, reordenar y eliminar; guardar y reabrir para comparar valores y orden.
3. Provocar errores en una pregunta no seleccionada. Comprobar que el resumen permanece visible y lleva al editor correcto. Verificar el bloqueo de lenguaje y el máximo de 50 preguntas.
4. En 1440, 820 y 390 px, y un móvil físico, inspeccionar encabezado con navegación real, menús del dashboard, configuración, modal IA y vista previa. Probar tema oscuro, Tab/Shift+Tab, flechas MCQ, Escape y zoom 200 %.
5. Comprobar cancelación de salida por Volver/enlaces y advertencia de recarga. Tener presente el límite de historial nativo descrito arriba.
6. Con datos de prueba y el flujo habitual, ejecutar una evaluación MCQ/CODING y reanudarla para confirmar ausencia de cambios en el candidato. Esto no se ejecutó contra servicios desplegados en esta tarea.

Sin commit, push, PR ni deploy. Se preservan los archivos locales ajenos, incluidos caches modificados preexistentes.
