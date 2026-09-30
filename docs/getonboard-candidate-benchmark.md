# Get on Board — Candidate Product Benchmark

Fecha de auditoría: 28 de septiembre de 2026  
Producto comparado: Get on Board (experiencia de profesional/candidato)  
Producto de referencia: TaskIO  
Alcance: candidato → oportunidad → postulación → perfil → evaluación → proceso → resultado.

Convenciones de evidencia usadas en todo el documento:

- **OBSERVADO**: verificado directamente en la interfaz disponible durante la auditoría.
- **DOCUMENTADO**: descrito por una fuente oficial de Get on Board.
- **REPO**: comprobado en el código fuente actual de TaskIO.
- **INFERIDO**: lectura de producto derivada de la evidencia; no debe tratarse como una capacidad confirmada.

## Executive Summary

Get on Board construye una experiencia de candidato propia de un marketplace de empleo maduro: una identidad profesional reutilizable, un catálogo relevante, señales de confianza antes de postular, varios caminos de retorno y un panel que confirma recepción y lectura. Su mayor fortaleza es reducir el costo de buscar y volver a buscar empleo. Su mayor debilidad aparece después de `Apply`: las etapas internas no son visibles y el cierre depende de la disciplina de cada empresa.

TaskIO tiene la situación inversa. **REPO:** hoy ofrece una postulación extremadamente breve y una plataforma de evaluación técnica mucho más profunda: ejecución de código, pruebas visibles y ocultas, temporizador, reanudación, resultados, credenciales y monitoreo. Sin embargo, la experiencia está fragmentada, explica de forma insuficiente las condiciones de la evaluación y no articula todavía una historia clara de proceso para el candidato.

La recomendación estratégica es inequívoca: **TaskIO no debería competir como otro job board generalista**. Construir feed, seguidores, alertas, merchandising de vacantes y un marketplace líquido consumiría años y desviaría el producto de su ventaja real. Debe convertirse en la mejor capa posfunnel para selección técnica: invitación confiable, evaluación justa, progreso visible, evidencia técnica reutilizable y cierre obligatorio.

Las decisiones de mayor impacto son:

1. Crear `Mis procesos` como hogar del candidato, con un timeline verificable por oportunidad.
2. Unificar `/assessments` y `/mis-evaluaciones` en una sola arquitectura.
3. Añadir un “contrato de evaluación” antes de comenzar: propósito, tiempo, monitoreo, datos guardados, accesibilidad, recuperación y qué verá el reclutador.
4. Hacer visible y confiable el guardado de respuestas, con reintentos ante fallos de red.
5. Transformar resultados en evidencia técnica portable, fechada, granular y controlada por el candidato.
6. Exigir a las empresas un resultado o cierre de proceso, incluso cuando no haya feedback detallado.

## Research Limitations

- **OBSERVADO:** se inspeccionó la experiencia autenticada de `Jobs for you`, su navegación lateral y banners; también se verificó una vacante pública en escritorio y en un viewport móvil de 375 × 812.
- **OBSERVADO:** durante la navegación a `Applications` la sesión dejó de estar autenticada y el producto redirigió al inicio público con el aviso “Primero debes iniciar sesión como profesional”. No se intentó iniciar sesión nuevamente.
- **OBSERVADO:** no se enviaron postulaciones, no se aceptaron invitaciones, no se siguieron empresas, no se configuraron alertas, no se editaron perfiles/CV y no se iniciaron tests.
- **OBSERVADO:** `/quizzes` no expuso contenido útil sin sesión. La UX autenticada de Applications, Invitations, CV manager, Profile y Tests no pudo verificarse directamente.
- **DOCUMENTADO:** esas áreas se reconstruyen con el centro de ayuda y páginas oficiales. Una descripción oficial no sustituye una prueba de usabilidad.
- **REPO:** TaskIO se evaluó por su implementación actual. Que una ruta o modelo exista no garantiza adopción, rendimiento en producción ni comprensión por usuarios reales.
- **INFERIDO:** no se califican tiempos de carga, tasa de abandono, compatibilidad real con lectores de pantalla, navegación completa por teclado ni calidad de soporte porque no hubo telemetría ni estudio con usuarios.
- **INFERIDO:** las páginas oficiales de Get on Board presentan pequeñas tensiones sobre cuándo se revela identidad/contacto tras una invitación. Este informe registra la inconsistencia y evita convertirla en certeza.

## Candidate Information Architecture

### Get on Board actual

**OBSERVADO:** la navegación autenticada expone `Empleos para ti`, `Tus postulaciones`, `Invitaciones`, `Editar mi perfil`, `Tus CVs`, `Eventos`, `Siguiendo`, `Tests`, `Perks` y `Help`.

```text
Profesional
├─ Descubrir
│  ├─ Empleos para ti
│  ├─ Alertas
│  ├─ Empresas seguidas
│  └─ Eventos
├─ Convertir
│  ├─ Detalle de empleo
│  ├─ Apply estándar
│  └─ Quick Apply
├─ Gestionar
│  ├─ Postulaciones
│  ├─ Invitaciones
│  └─ Mensajes por proceso
├─ Identidad
│  ├─ Perfil
│  ├─ Hasta 10 CV
│  ├─ Preferencias
│  └─ Visibilidad en Talent Database
└─ Retener
   ├─ Tests
   ├─ Perks
   └─ Contenido/notificaciones
```

**INFERIDO:** la arquitectura prioriza recurrencia y amplitud. Es coherente con un marketplace, pero distribuye la atención entre demasiados destinos cuando la necesidad urgente del candidato suele ser una: “¿qué está pasando con mis procesos?”.

### TaskIO actual

**REPO:** la navegación del candidato destaca empleos, certificaciones, coding challenge, evaluaciones, notificaciones y perfil. `Mis postulaciones` no aparece como destino principal persistente; se accede desde el resumen de perfil. Existen dos superficies solapadas para evaluaciones: `/assessments` y `/mis-evaluaciones`.

**INFERIDO:** TaskIO mezcla adquisición, acreditación y ejecución del proceso sin una jerarquía explícita. La arquitectura debería organizarse alrededor del proceso activo, no del inventario de funcionalidades.

## Candidate Journey Map

| Momento | Necesidad del candidato | Get on Board | TaskIO hoy | Riesgo principal |
|---|---|---|---|---|
| Descubrir | Encontrar opciones relevantes | **OBSERVADO:** feed, filtros y tarjetas | **REPO:** catálogo público y detalle | Competir en catálogo sin liquidez |
| Evaluar oportunidad | Entender trabajo, salario y confianza | **OBSERVADO:** salario, modalidad, postulaciones, tiempo de respuesta, última revisión | **REPO:** rol, empresa, modalidad, salario si es público, skills | Menor señal sobre comportamiento de la empresa |
| Crear identidad | Evitar reescribir información | **DOCUMENTADO:** perfil, preferencias y hasta 10 CV | **REPO:** perfil estructurado y un CV operativo | CV desactualizado o equivocado al postular |
| Postular | Completar lo mínimo con control | **DOCUMENTADO:** estándar y Quick Apply | **REPO:** un clic con `jobId` | Envío sin preview ni contexto adicional |
| Recibir evaluación | Saber por qué, cuánto y bajo qué reglas | **INFERIDO:** capacidad técnica limitada/documentación fragmentaria | **REPO:** invitaciones de assessment detalladas | Ansiedad y consentimiento implícito |
| Resolver | Probar capacidad sin perder trabajo | **DOCUMENTADO:** screening y quizzes; no se verificó IDE técnico | **REPO:** autosave, reanudación, código, tests, temporizador | Guardado de opción múltiple puede fallar silenciosamente |
| Esperar | Conocer el siguiente paso | **DOCUMENTADO:** Sent/Seen, mensajes; etapas internas ocultas | **REPO:** estados más granulares, sin timeline/mensajes | Estado nominal sin explicación ni SLA |
| Obtener resultado | Entender desempeño y decisión | **DOCUMENTADO:** no garantiza cierre ni feedback | **REPO:** score y secciones; feedback restringido en procesos | Resultado técnico desconectado de decisión humana |
| Reutilizar evidencia | No repetir trabajo equivalente | **DOCUMENTADO:** quizzes reutilizables; CV reusable | **REPO:** credenciales en badge exams | Evidencia de assessments laborales no portable |

## Signup & Onboarding

**DOCUMENTADO:** Get on Board unifica registro e inicio de sesión y recomienda magic link; también acepta Google, LinkedIn y GitHub. Tras entrar, impulsa antecedentes, habilidades, CV y enlaces. [Cómo empezar en Get on Board](https://www.getonbrd.com/help/how-do-i-get-started-on-get-on-board)

**REPO:** TaskIO usa tres pasos de alta —identidad/email, contraseña y datos como teléfono, ubicación, LinkedIn y GitHub— además de Google. Conserva borrador y paso actual en almacenamiento local. Después de verificar el correo, abre un onboarding de cuatro pasos: importar CV, habilidades, información adicional/certificaciones y finalización. Varios pasos se pueden omitir.

**INFERIDO:** TaskIO pide más compromiso antes de demostrar valor. El guardado local reduce pérdidas, pero no responde “¿por qué necesito esto ahora?”. La mejor secuencia depende del origen:

- Invitado por una empresa: confirmar identidad → ver contexto del proceso → completar solo lo requerido.
- Candidato orgánico: crear cuenta → importar CV → revisar extracción → expresar objetivo profesional.
- Certificación voluntaria: crear cuenta → explicar la credencial → preparar el entorno → evaluar.

**Recomendación:** adoptar el acceso simple de Get on Board, pero evitar un onboarding universal. TaskIO necesita onboarding contextual y progresivo, con una promesa visible en cada dato solicitado.

## CV Import

**DOCUMENTADO:** Get on Board acepta PDF, DOC, DOCX, RTF y TXT de hasta 5 MB, conserva el original y puede extraer experiencia, educación, contacto, enlaces y habilidades. Advierte que el candidato debe revisar la extracción; archivos escaneados o protegidos pueden fallar. Permite hasta diez CV, uno predeterminado y elección por postulación. [Carga y reutilización](https://www.getonbrd.com/help/how-can-i-upload-or-reuse-my-cv-to-apply-faster) y [gestión de CV](https://www.getonbrd.com/help/how-to-manage-your-resumes-on-get-on-board)

**REPO:** TaskIO usa el CV como alimentador del perfil: normaliza experiencia, educación, skills, idiomas, credenciales, ubicación, teléfono y enlaces. Es una base técnicamente superior a tratar el CV como adjunto opaco.

**REPO:** existe una inconsistencia: la interfaz declara PDF/DOCX y máximo 5 MB, mientras el servidor acepta PDF/DOC/DOCX y hasta 8 MB. Además, aunque el modelo incluye múltiples `Resume`, la aplicación normal usa el `resumeUrl` actual del usuario y no ofrece selección por oportunidad.

**INFERIDO:** la extracción estructurada de TaskIO es más valiosa que almacenar diez archivos sin semántica, pero el candidato necesita tres garantías: preview de lo leído, control para corregir y selección explícita de qué versión comparte.

Recomendación funcional:

1. Una “fuente principal” versionada, no una colección desordenada de adjuntos.
2. Comparación “CV dice / perfil dice / dato verificado”.
3. Confirmación de CV y campos compartidos antes de postular o aceptar una invitación.
4. Etiquetas por objetivo (`Frontend`, `Data`, `Liderazgo`) y fecha de actualización.
5. Unificar límites y formatos entre copy y validación de servidor.

## Candidate Profile

**DOCUMENTADO:** Get on Board combina antecedentes, habilidades con nivel, inglés, enlaces, CV y preferencias laborales. Las empresas pueden descubrir un preview con headline, seniority, skills, ubicación y preferencias; identidad, contacto y CV completo se revelan según acceso/invitación/proceso. [Información visible en Talent Database](https://www.getonbrd.com/help/what-profile-information-is-visible-in-talent-database)

**REPO:** TaskIO modela datos ricos: contacto, fecha de nacimiento, LinkedIn, GitHub, CV, certificaciones, idiomas, skills con nivel, experiencia, educación, seniority y años de experiencia.

**REPO:** no se encontró una superficie candidata clara para preferencias de trabajo, disponibilidad, salario esperado, portfolio o controles granulares de discoverability. Tampoco se encontró una vista dedicada que explique quién ve cada dato.

**INFERIDO:** TaskIO tiene más estructura de la que convierte en confianza. El perfil debe dejar de ser un formulario y convertirse en un mapa de evidencia:

```text
Dato profesional
├─ Declarado por la persona
├─ Extraído de CV (fuente + fecha)
├─ Verificado por assessment (dominio + nivel + fecha)
└─ Compartido con: empresa X / proceso Y / público
```

## Job Discovery

**OBSERVADO:** `Empleos para ti` ofrece filtros por categoría, experiencia, país, modalidad, rango salarial, términos y tags. Las tarjetas muestran empresa, puesto, seniority, tipo de empleo, ubicación/modalidad, tags, novedad y fecha. En el estado observado no mostraron salario en la tarjeta.

**OBSERVADO:** el feed incluye control de alertas, un banner para añadir hasta diez habilidades y una invitación a importar postulaciones desde otras plataformas. También promueve un test de adaptabilidad de cinco minutos.

**DOCUMENTADO:** el ranking combina perfil, preferencias, interacciones, tags, ubicación, salario, experiencia, recencia y promociones Pin/Boost. La fórmula completa no es pública. [Ranking de empleos](https://www.getonbrd.com/help/how-job-search-results-are-ranked)

**INFERIDO:** esta capa es costosa de replicar: necesita oferta suficiente, matching, moderación, marca de empresas, alertas y comportamiento histórico. Para TaskIO debe ser secundaria. El descubrimiento útil puede ser “oportunidades para las que tu evidencia ya aplica”, no un feed generalista infinito.

## Job Detail

**OBSERVADO:** la vacante auditada mostró fecha, título, empresa, ubicación híbrida, seniority, jornada, categoría, salario de USD 1,900–2,500/mes, volumen de postulaciones, respuesta estimada de 14–24 días y “revisado hoy”. Incluyó responsabilidades, requisitos técnicos, modalidad, horario, beneficios, política remota, tags, empresa, similares y reporte de la vacante.

**OBSERVADO:** el detalle ofreció `Apply` y acceso por email, Google, LinkedIn o GitHub. En móvil conservó salario, número de postulaciones, tiempo estimado y frescura de revisión en un layout apilado.

**INFERIDO:** las mejores señales no describen solo el puesto; describen el comportamiento del empleador. TaskIO debería añadir:

- Tiempo mediano hasta primera revisión.
- Porcentaje de procesos cerrados correctamente.
- Vigencia real de la vacante.
- Número y duración esperada de etapas.
- Evaluación requerida antes de postular.
- Política de feedback y fecha máxima de decisión.

## Application Flow

### Get on Board

**DOCUMENTADO:** el Apply estándar puede pedir CV, GitHub/GitLab, LinkedIn, portfolio, video, inglés, motivación, antecedentes, expectativa salarial y preguntas de filtro. Quick Apply pide un subconjunto, pero solo está disponible en vacantes promovidas con Pin/Boost. [Quick Apply](https://www.getonbrd.com/help/what-is-quick-apply-and-how-can-i-activate-it)

**DOCUMENTADO:** se recomiendan no más de tres preguntas adicionales. Las preguntas pueden ser abiertas, opción múltiple o código; solo la opción múltiple obtiene scoring automático. [Preguntas de filtro](https://getonbrd.com/help/how-to-create-and-add-screening-questions-to-your-job)

**DOCUMENTADO:** un badge `Incomplete` puede aparecer después de que la postulación ya fue enviada porque se recalcula con el perfil actual. [Por qué no puedo postular](https://getonbrd.com/help/why-cant-i-apply-to-a-job)

### TaskIO

**REPO:** el botón actual envía esencialmente `jobId`. La API admite `coverLetter` y `resumeUrl`, pero la interfaz no los solicita. Se adjunta el CV actual si existe; no hay preview, selector de CV, confirmación de campos compartidos ni preguntas del proceso.

**INFERIDO:** un clic es una ventaja solo cuando el usuario comprende qué acaba de enviar. Sin preview, TaskIO cambia fricción visible por riesgo invisible.

### Modelo recomendado por nivel de fricción

| Tipo de proceso | Fricción aceptable | Flujo recomendado |
|---|---:|---|
| Interés inicial | Baja | Confirmar identidad, CV compartido y disponibilidad |
| Invitación dirigida | Baja-media | Mostrar empresa, rol, motivo de invitación y assessment previsto |
| Postulación completa | Media | Contexto breve, pretensión opcional, preguntas estrictamente necesarias |
| Assessment técnico | Alta pero justificada | Consentimiento informado, preparación, guardado y resultado |

## Applications

**DOCUMENTADO:** Get on Board ofrece vista lista y board, agrupando borradores/incompletas, enviadas, en proceso, finalizadas y eliminadas. Distingue `Sent` y `Seen by`, mensajes no leídos, cierre y despublicación. Las etapas internas no son visibles salvo comunicación de la empresa. [Seguimiento](https://www.getonbrd.com/help/how-to-track-my-job-applications) y [qué ocurre después](https://www.getonbrd.com/help/what-happens-after-i-apply-for-a-job)

**REPO:** TaskIO modela estados más expresivos: `SUBMITTED`, `REVIEWING`, `INTERVIEW`, `OFFER`, `HIRED`, `REJECTED`, con filtros por vacante, empresa, ubicación y fecha.

**REPO:** no se encontró en la experiencia candidata un hilo de mensajes, `seen`, timeline, responsable, siguiente paso, fecha esperada, feedback ni retiro visible. El cambio de estado depende de la operación del reclutador.

**INFERIDO:** TaskIO tiene mejores nombres de etapa, pero Get on Board ofrece mejores pruebas de actividad. La solución no es copiar un kanban; es combinar estado semántico con evidencia temporal:

```text
Postulación recibida — 12 sep
Revisada por la empresa — 13 sep
Assessment enviado — 14 sep · vence 18 sep
Assessment completado — 16 sep
Entrevista técnica — acción requerida
Decisión prevista — antes del 25 sep
```

## Invitations

**DOCUMENTADO:** una invitación de Get on Board llega por email y dashboard con mensaje del reclutador. No hay chat previo independiente; para conversar, la persona acepta, postula y entra al proceso. Aceptar puede crear la postulación y ampliar el acceso de la empresa al perfil. [Contacto tras invitación](https://getonbrd.com/help/how-can-the-person-i-invited-to-apply-for-my-job-contact-me)

**REPO:** TaskIO envía assessments vinculados a una postulación. La evaluación no se dispara automáticamente al aplicar; el reclutador la asigna después.

**INFERIDO:** la invitación ideal no debe ser un CTA desnudo. Debe declarar quién invita, por qué encaja la persona, qué datos ya vio, qué se desbloqueará, cuántas etapas habrá y si el assessment se puede reutilizar. Antes de aceptar debe existir un canal de pregunta acotado o FAQs específicas del proceso.

## Tests & Assessments

| Fase | Get on Board | TaskIO | Lectura |
|---|---|---|---|
| Antes | **DOCUMENTADO:** preguntas de filtro, Cultural Fit y Adaptability; no pass/fail en los dos quizzes de autoconocimiento | **REPO:** intro con preguntas, duración, score mínimo, secciones, intentos, penalización y reglas de monitoreo | TaskIO tiene mayor poder, pero exige mejor explicación |
| Durante | **DOCUMENTADO:** MCQ puntuable; texto/código se revisan manualmente según la documentación disponible | **REPO:** una pregunta a la vez, mapa, temporizador, respuestas persistidas, Monaco/Judge0, casos públicos/ocultos | Ventaja técnica clara de TaskIO |
| Después | **DOCUMENTADO:** quizzes entregan perfil, fortalezas o sugerencias; compartir Cultural Fit es voluntario | **REPO:** score, aprobado/reprobado, secciones, tiempo y credencial en badge exams | TaskIO necesita separar feedback de selección y evidencia portable |

**DOCUMENTADO:** Cultural Fit usa seis distribuciones de puntos y cinco perfiles; Get on Board advierte que no debe usarse como criterio único. Adaptability mide cuatro dimensiones y ofrece fortalezas/áreas/tips. [Cultural Fit](https://www.getonbrd.com/help/what-is-the-cultural-fit-test-and-how-should-i-prepare) y [Adaptability](https://www.getonbrd.com/help/what-is-adaptability-quiz)

**DOCUMENTADO:** una publicación histórica de Get on Board planteó tests independientes de la vacante, feedback inmediato y reutilización longitudinal; también anunciaba tests técnicos como futuros. Debe leerse como visión histórica, no como prueba de disponibilidad actual. [Presentando Get on Board Tests](https://www.getonbrd.com/blog/presentando-get-on-board-tests?lang=es)

## Assessment UX

### Antes de comenzar en TaskIO

**REPO:** la introducción informa volumen de preguntas, minutos, score requerido, secciones, retry, intentos, penalización, inicio del timer, navegación y autosave. También enumera tab changes, pérdida de foco, copy/paste, tiempo por pregunta y reporte al reclutador; prohíbe IA y búsquedas externas.

Faltantes críticos:

- **REPO:** el componente de introducción no da suficiente contexto visible de empresa y vacante.
- **REPO:** no explica con precisión qué verá el reclutador ni cuánto se conservará.
- **REPO:** no declara qué pasa ante pérdida de red o cierre accidental.
- **REPO:** no aclara explícitamente que cámara y micrófono no son requeridos.
- **REPO:** comenzar funciona como consentimiento implícito; no existe un reconocimiento explícito de reglas y datos.
- **INFERIDO:** el lenguaje sobre “trampa” y “descalificación” aumenta ansiedad y puede penalizar conductas benignas o necesidades de accesibilidad.

### Durante

**REPO:** la navegación permite volver, usa mapa de preguntas, progreso y timer sticky. El envío avisa por preguntas sin responder; al expirar, se envían respuestas guardadas. En coding existen selector de lenguaje, editor Monaco, Judge0, tests visibles/ocultos y entrada personalizada no puntuable.

**REPO:** las respuestas de opción múltiple actualizan el estado local aunque el guardado de red falle; el error no presenta toast, estado persistente ni cola de reintento. La persona puede creer que la promesa de guardado automático se cumplió. En código sí existe feedback de error.

**REPO:** no se encontró detector offline o cola durable de reintento. El índice actual se conserva localmente y el intento/las respuestas se persisten en servidor, por lo que existe una base de reanudación, pero no una garantía completa.

**INFERIDO:** el mayor riesgo de integridad no es el fraude; es perder respuestas legítimas mientras la UI asegura que se guardan.

### Después

**REPO:** el candidato ve score, resultado, desempeño por sección, tiempo y número de respuestas. En assessments de vacante/invitación se ocultan respuestas correctas y explicaciones por confidencialidad; el reclutador ve más detalle. Los badge exams sí pueden emitir credencial pública y compartirla en LinkedIn.

**INFERIDO:** preservar el banco de preguntas no requiere negar todo aprendizaje. Puede ofrecerse feedback por competencia (“fortaleza en SQL joins; revisar transacciones”) sin revelar respuestas ni casos ocultos.

## Results & Feedback

**DOCUMENTADO:** Get on Board no garantiza que una empresa avise el rechazo ni comparta su razón. El candidato puede contactar a la empresa dentro del proceso. [Notificación de no selección](https://www.getonbrd.com/help/will-i-be-notified-if-i-have-not-been-selected-in-a-process) y [por qué fue descartada](https://www.getonbrd.com/help/why-was-my-application-discarded-and-what-can-i-do)

**REPO:** TaskIO ofrece resultado técnico estructurado, pero no un circuito claro de feedback del reclutador ni una explicación de cómo el score afectó la decisión. La credencial existe principalmente para exámenes voluntarios, no para evaluaciones laborales.

**INFERIDO:** el resultado necesita tres capas independientes:

1. **Entrega:** “tu evaluación fue recibida y es válida”.
2. **Aprendizaje:** fortalezas y áreas de mejora sin filtrar contenido protegido.
3. **Proceso:** decisión o siguiente paso, responsable y fecha estimada.

TaskIO debería garantizar al menos entrega y cierre, incluso si la empresa elige no ofrecer feedback cualitativo.

## Candidate Trust & Privacy

**DOCUMENTADO:** Get on Board separa perfil público, visibilidad en Talent Database y alertas. Sin embargo, su ayuda indica que desactivar emails de nuevos empleos también oculta el perfil de Talent Database. Eso acopla dos decisiones distintas. [Control de visibilidad](https://www.getonbrd.com/help/control-who-can-find-me-in-talent-database) y [emails o eliminación](https://www.getonbrd.com/help/stop-job-emails-or-delete-your-profile)

**DOCUMENTADO:** salario esperado se comparte solo con la aplicación específica; la eliminación de cuenta es permanente e incluye aplicaciones, CV, experiencia y datos guardados. [Expectativa salarial](https://www.getonbrd.com/help/can-companies-see-my-salary-expectation-before-i-apply) y [eliminar perfil](https://www.getonbrd.com/help/can-i-delete-my-profile-as-a-professional)

**DOCUMENTADO:** todas las vacantes pasan moderación y se pueden reportar; Get on Board advierte sobre pagos, solicitud de datos financieros, presión y traslado prematuro fuera de la plataforma. [Protección contra estafas](https://www.getonbrd.com/help/how-does-get-on-board-protect-candidates-from-scam-jobs)

**REPO:** no se encontró una superficie candidata dedicada que explique visibilidad, retención, exportación o eliminación de datos del proceso. El assessment registra señales de monitoreo extensas.

**Recomendación de confianza para TaskIO:**

- Consentimiento por proceso, no permiso global ambiguo.
- “Quién puede ver esto” junto a cada artefacto.
- Retención y eliminación con fechas comprensibles.
- Separación de señal de integridad y juicio automático.
- Derecho a reportar contexto: interrupción, accesibilidad, conectividad o incidente.
- Prohibir que una bandera de monitoreo produzca rechazo automático sin revisión humana.

## Notifications

**DOCUMENTADO:** Get on Board usa email y dashboard para invitaciones, mensajes y alertas de empleos; seguir empresas puede generar novedades. Las respuestas por email pueden incorporarse al hilo del proceso.

**REPO:** TaskIO tiene notificaciones dentro de la aplicación y correo para cambios de estado, invitaciones y finalización de assessments.

**INFERIDO:** la oportunidad no es enviar más avisos sino diseñar una jerarquía:

- Acción inmediata: assessment por vencer, entrevista por confirmar, fallo de guardado.
- Cambio de proceso: revisión, avance, rechazo, cierre.
- Valor futuro: credencial por expirar o skill actualizable.
- Marketing: separado y opcional.

Cada aviso debe responder “qué pasó, qué tengo que hacer, antes de cuándo y qué ocurre si no lo hago”.

## Retention Features

**OBSERVADO:** Get on Board expone alertas, empresas seguidas, eventos, perks, tests, invitaciones y el incentivo de completar habilidades. **DOCUMENTADO:** también usa `Recently active`, preferencias y el panel de procesos para fomentar retorno.

**INFERIDO:** son buenas palancas para un marketplace, pero muchas no pertenecen al núcleo de TaskIO. La retención correcta para TaskIO es profesional, no adictiva:

- Evidencia técnica que gana o pierde vigencia.
- Historial de procesos y evaluaciones.
- Reutilización consentida de resultados equivalentes.
- Plan de mejora entre intentos.
- Nuevas oportunidades compatibles con evidencia existente.
- Recordatorios accionables, no un feed genérico.

## Mobile & Accessibility

**OBSERVADO:** el detalle público de Get on Board conservó en 375 × 812 la información esencial y apiló correctamente contenido y opciones de acceso. No se probó navegación por teclado ni lector de pantalla.

**DOCUMENTADO:** Get on Board declara que desde navegador móvil se puede buscar, postular, subir CV y revisar Applications; no ofrece app nativa. [Postular desde el teléfono](https://www.getonbrd.com/help/can-i-apply-for-jobs-from-my-phone)

**REPO:** TaskIO aplica patrones responsive y en coding usa tabs para editor/resultados. No se encontró una recomendación visible de usar escritorio para desafíos de código.

**INFERIDO:** hacer que Monaco quepa en un teléfono no vuelve adecuada una prueba de programación móvil. TaskIO debe:

- Permitir revisar invitación, reglas, deadline y progreso en móvil.
- Permitir preguntas simples y resultados en móvil.
- Recomendar escritorio para coding con una justificación honesta.
- Ofrecer prueba de compatibilidad del navegador y teclado antes del timer.
- Admitir tiempo adicional y ajustes de monitoreo como accommodation.
- Asegurar foco, etiquetas, contraste, anuncios del timer y navegación completa por teclado.
- No usar pérdida de foco como sinónimo de fraude, especialmente con tecnología asistiva.

## Candidate Friction Analysis

| Fricción | Evidencia | Severidad | Por qué importa | Respuesta TaskIO |
|---|---|---:|---|---|
| Pipeline interno invisible | **DOCUMENTADO** | Alta | La espera se vuelve incertidumbre | Timeline y fecha prevista |
| Cierre/rechazo no garantizado | **DOCUMENTADO** | Alta | Erosiona confianza y retorno | SLA de cierre para empresas |
| `Incomplete` después de enviar | **DOCUMENTADO** | Alta | Parece fallo de envío | Separar recepción de completitud |
| Quick Apply ligado a promoción | **DOCUMENTADO** | Media | La fricción depende del gasto del empleador | Reglas por riesgo, no por plan |
| Aceptar/postular para poder preguntar | **DOCUMENTADO** | Media | Fuerza compromiso prematuro | Pregunta previa acotada |
| Alertas y discoverability acopladas | **DOCUMENTADO** | Alta | Control de privacidad poco granular | Preferencias independientes |
| Extracción de CV potencialmente imperfecta | **DOCUMENTADO** | Media | Datos erróneos se propagan | Review y provenance |
| Salario a veces oculto en exploración | **DOCUMENTADO** | Media | Desperdicia tiempo antes de Apply | Transparencia desde detalle |
| Código dentro del formulario | **DOCUMENTADO/INFERIDO** | Media-Alta | Entorno débil y mala portabilidad | Assessment técnico dedicado |
| Falta de evidencia oficial de accesibilidad | **INFERIDO** | Alta | No permite confiar en inclusión | Estándar y pruebas públicas |

Las cinco fricciones más importantes son: opacidad del pipeline, ausencia de cierre garantizado, ambigüedad del estado `Incomplete`, controles de privacidad acoplados y compromiso forzado para conversar tras una invitación.

## Get on Board vs TaskIO

| Dimensión | Get on Board | TaskIO | Ganador actual |
|---|---|---|---|
| Acceso | Magic link + social | Email/password + Google | Get on Board |
| Perfil estructurado | Completo y orientado a matching | Muy rico y normalizado | Empate |
| Preferencias laborales | Explícitas | No claras en UI | Get on Board |
| CV múltiple | Hasta 10 y selector | Modelo múltiple, flujo usa CV actual | Get on Board |
| Extracción de CV | Sí, con aviso de revisión | Sí, normaliza múltiples entidades | TaskIO potencial |
| Descubrimiento | Feed maduro y filtros | Catálogo básico | Get on Board |
| Señales de empresa | Respuesta, revisión, volumen | Limitadas | Get on Board |
| Transparencia salarial | Fuerte, aunque puede ocultarse públicamente | Condicionada por `showSalary` | Get on Board |
| Aplicación rápida | Quick Apply contextual | Un clic general | TaskIO en velocidad; GoB en control |
| Preview de lo enviado | Implícito en formulario/CV | No claro | Get on Board |
| Seguimiento de lectura | Sent/Seen | No encontrado | Get on Board |
| Etapas nominales | Internas ocultas al candidato | Estados más granulares | TaskIO |
| Timeline | No completo | No completo | Ninguno |
| Mensajería por proceso | Sí | No encontrada | Get on Board |
| Cierre garantizado | No | No | Ninguno |
| Invitaciones | Marketplace + mensaje | Orientadas a assessment/proceso | Depende del caso |
| Screening MCQ | Scoring | Sí | Empate |
| Coding ejecutable | No verificado; código manual documentado | Monaco + Judge0 + tests | TaskIO |
| Persistencia/reanudación | No verificada | Sí | TaskIO |
| Transparencia de monitoreo | No aplica/no verificada | Amplia pero punitiva | TaskIO en información; deuda de tono |
| Resiliencia offline | No verificada | Insuficiente | Ninguno |
| Resultado por sección | Quizzes de autoconocimiento | Sí | TaskIO |
| Feedback técnico | Limitado/no verificado | Parcial y restringido | TaskIO potencial |
| Credencial portable | No clara para técnico | Badge exams | TaskIO |
| Privacidad/discoverability | Controles visibles, con acoplamientos | Superficie no encontrada | Get on Board |
| Mobile | Flujo básico documentado y detalle verificado | Responsive; coding incómodo | Get on Board en journey general |
| Accesibilidad demostrable | No encontrada | No encontrada | Ninguno |
| Retención | Alertas, follows, eventos, perks, tests | Procesos, assessments, badges | Distintas estrategias |

## TaskIO Assessment Experience

La experiencia técnica de TaskIO ya contiene un motor competitivo, pero todavía no un producto candidato de clase mundial.

### Lo que funciona

- **REPO:** alcance, tiempo, score mínimo, secciones e intentos aparecen antes de comenzar.
- **REPO:** hay reanudación, respuestas persistidas, navegación, progreso y confirmación antes de enviar incompleto.
- **REPO:** Monaco, Judge0, lenguajes, entrada personalizada y tests públicos/ocultos forman un entorno técnico real.
- **REPO:** resultados por sección y badge exams permiten convertir desempeño en señal.
- **REPO:** el sistema registra integridad con más detalle que un simple formulario.

### Lo que puede provocar abandono o desconfianza

- **REPO:** dos centros de evaluaciones compiten por el mismo concepto.
- **REPO:** contexto de vacante/empresa débil en el intro.
- **REPO:** guardado de MCQ puede fallar silenciosamente.
- **REPO:** reglas de monitoreo se comunican con lenguaje punitivo y sin matices de accesibilidad.
- **REPO:** no hay prueba previa del entorno ni guía clara ante desconexión.
- **REPO:** no se declara de forma tranquilizadora que no se usa cámara/micrófono.
- **REPO:** feedback de evaluaciones laborales es demasiado escaso para el esfuerzo solicitado.
- **REPO:** la etiqueta “Ver mis postulaciones” dirige a `/profile/summary`, una promesa de navegación incorrecta.

### Principio rector

**INFERIDO:** un assessment es un intercambio. La empresa recibe evidencia; la persona debe recibir certeza, aprendizaje y portabilidad proporcional al tiempo invertido.

## Verified Technical Profile Opportunity

TaskIO puede crear una categoría superior a “perfil completo”: un perfil técnico verificable sin convertir una prueba aislada en verdad permanente.

### Modelo de evidencia

| Capa | Ejemplo | Fuente | Confianza | Vigencia |
|---|---|---|---|---|
| Declarada | “React avanzado” | Candidato | Baja-media | Editable |
| Documental | React en CV durante 3 años | CV + extracción revisada | Media | Fecha del CV |
| Observada | 82% en componentes/estado | Assessment | Alta en ese dominio | 12–18 meses |
| Ejecutada | Solución aceptada con tests ocultos | Coding challenge | Alta | 12 meses |
| Contextual | Desempeño en proceso de Empresa X | Proceso | Restringida | Según consentimiento |

### Reglas para que sea confiable

- La evidencia debe incluir dominio, versión del blueprint, fecha, duración e identidad verificada.
- Score no equivale automáticamente a seniority.
- Resultados equivalentes se reutilizan solo con consentimiento y ventana de vigencia.
- El candidato decide visibilidad pública, por empresa o privada.
- Retakes muestran evolución, no borran selectivamente intentos fallidos sin contexto.
- Debe existir un periodo de enfriamiento razonable y preparación gratuita.
- Se registran accommodations sin revelar detalles médicos al reclutador.
- Las banderas de integridad requieren revisión humana y derecho a aportar contexto.
- No se publica un “índice de empleabilidad” opaco.
- La credencial debe ser verificable por URL y revocable por el candidato.

**INFERIDO:** la oportunidad no es certificar personas; es certificar observaciones acotadas. Esa distinción reduce gaming, discriminación y falsa precisión.

## What TaskIO Should Adapt

1. **Señales de actividad empresarial.** `Visto`, última revisión, tiempo esperado y tasa de cierre reducen incertidumbre.
2. **Identidad reutilizable con selección explícita.** Adaptar múltiples versiones de CV, pero ligarlas a un perfil estructurado y versionado.
3. **Aplicación proporcional.** Tener un camino rápido y otro completo según riesgo/requisitos, no según promoción comercial.
4. **Controles de visibilidad comprensibles.** Separar perfil público, descubrimiento, uso por proceso, alertas y marketing.
5. **Retorno basado en utilidad.** Procesos, mensajes, invitaciones, evidencia vigente y oportunidades compatibles.

## What TaskIO Should Not Copy

1. **Pipeline opaco.** No limitar al candidato a `Sent/Seen` cuando existen etapas reales.
2. **Cierre voluntario.** No permitir procesos indefinidos sin recordatorio, SLA y cierre explícito.
3. **Quick Apply como beneficio pagado.** La fricción debe responder a la información necesaria, no al plan del empleador.
4. **Preferencias acopladas.** No ligar email de alertas con visibilidad ante empresas.
5. **Código como textarea de screening.** Una prueba técnica merece entorno, recuperación, fairness y feedback.

## Opportunities to Beat Get on Board

### 1. El mejor proceso pospostulación

Un timeline compartido, fechas esperadas, acciones pendientes, cierre obligatorio y mensajes contextuales convertirían la selección en un servicio confiable. Get on Board reduce incertidumbre con señales, pero no abre el pipeline.

### 2. Evidencia técnica portable y justa

TaskIO ya ejecuta código y produce resultados granulares. Si añade consentimiento, vigencia, equivalencias, feedback por competencia y control de visibilidad, puede evitar pruebas repetidas y crear una identidad técnica más útil que un CV.

### 3. Assessment resiliente y humano

Guardado verificable, recuperación offline, preparación del entorno, accommodations y revisión humana de señales de integridad pueden hacer que “evaluación rigurosa” deje de significar “experiencia hostil”.

## Recommended TaskIO Candidate Architecture

La navegación primaria recomendada es deliberadamente corta:

```text
TaskIO candidato
├─ Mis procesos (inicio)
│  ├─ Acción requerida
│  ├─ En curso
│  ├─ Esperando empresa
│  └─ Cerrados
├─ Evaluaciones
│  ├─ Próximas
│  ├─ En progreso
│  ├─ Resultados
│  └─ Práctica / credenciales
├─ Perfil técnico
│  ├─ Datos y preferencias
│  ├─ Experiencia y CV versionado
│  ├─ Evidencia verificada
│  └─ Privacidad y acceso
└─ Oportunidades (secundario)
   ├─ Invitaciones
   └─ Compatibles con mi evidencia
```

`Oportunidades` solo debe ocupar navegación principal si TaskIO decide financiar conscientemente un marketplace. En una estrategia B2B invite-first puede vivir como sección secundaria.

Cada proceso funciona como contenedor:

```text
Empresa + rol
├─ Resumen y condiciones
├─ Timeline compartido
├─ Acciones pendientes
├─ Evaluaciones y resultados
├─ Mensajes
├─ Datos compartidos
└─ Resultado / feedback / retiro
```

## Ideal Candidate Journey

```text
Recibe invitación
  ↓
Ve empresa, rol, rango, motivo, etapas, tiempo total y deadline
  ↓
Pregunta / rechaza / acepta sin penalización
  ↓
Revisa perfil, CV y datos exactos que compartirá
  ↓
Ve contrato del assessment
  ├─ competencias
  ├─ duración e intentos
  ├─ monitoreo y privacidad
  ├─ accommodations
  └─ prueba técnica del entorno
  ↓
Realiza assessment con guardado verificable
  ├─ Guardado ✓ / Sin conexión / Reintentando
  └─ recuperación sin perder timer injustamente
  ↓
Recibe confirmación + resultado por competencia
  ↓
Elige si reutiliza evidencia en futuras oportunidades
  ↓
Sigue timeline del proceso con fecha del próximo evento
  ↓
Recibe avance, oferta o cierre obligatorio
  ↓
Conserva aprendizaje e historial bajo su control
```

El journey orgánico puede comenzar en una vacante o badge, pero converge en el mismo núcleo: identidad controlada, assessment justo, proceso legible y resultado.

## Prioritized Product Backlog

| Pri. | Problema | Referencia | Solución | Impacto candidato | Impacto reclutador | Complejidad | Dependencia | Riesgo |
|---|---|---|---|---|---|---|---|---|
| P0 | MCQ puede parecer guardada cuando falló | **REPO** | Estado `Guardado/Reintentando/Sin conexión`, cola durable e idempotencia | Muy alto | Datos más íntegros | M | API de respuestas | Conflictos de versión |
| P0 | No existe hogar claro del proceso | **REPO** | `Mis procesos` como inicio y navegación primaria | Muy alto | Menos soporte | M | Modelo de timeline | Migración de rutas |
| P0 | Dos superficies de assessment | **REPO** | Unificar `/assessments` y `/mis-evaluaciones` | Alto | Menor confusión | M | Inventario de rutas | Links antiguos |
| P0 | Condiciones/privacidad poco claras | **REPO** | Contrato de assessment y consentimiento explícito | Alto | Evidencia defendible | S-M | Copy legal/producto | Exceso de texto |
| P0 | Procesos pueden quedar sin cierre | **REPO/DOCUMENTADO** | SLA, recordatorios y cierre obligatorio | Muy alto | Disciplina operativa | M | Workflow/notifications | Resistencia de clientes |
| P0 | CTA de postulaciones apunta a perfil | **REPO** | Corregir destino y etiqueta | Medio | Bajo | XS | Ninguna | Mínimo |
| P1 | Postulación de un clic no muestra qué se envía | **REPO** | Sheet de confirmación con CV y datos compartidos | Alto | Datos más relevantes | S | Versionado de CV | Un paso extra |
| P1 | Sin timeline accionable | **REPO** | Eventos, responsable, próxima fecha y estado de espera | Muy alto | Menos seguimiento manual | L | Eventos de dominio | Datos desactualizados |
| P1 | Monitoreo punitivo | **REPO** | Lenguaje neutral, contexto del incidente y revisión humana | Alto | Menos falsos positivos | M | Política de integridad | Gaming percibido |
| P1 | No hay preparación del entorno | **REPO** | Device check, ejercicio de práctica y recomendación desktop | Alto | Menos intentos fallidos | M | Runner/Judge0 | Divergencia con examen real |
| P1 | Feedback técnico insuficiente | **REPO** | Feedback por competencia sin revelar respuestas | Alto | Mejor marca empleadora | M | Taxonomía/blueprints | Fuga de contenido |
| P1 | CV operativo único | **REPO/DOCUMENTADO** | Versiones nombradas y selector por proceso | Medio-alto | Mejor ajuste | M | Resume model existente | Complejidad de sincronía |
| P1 | Privacidad poco visible | **REPO** | Centro “Datos y acceso” por artefacto/empresa | Alto | Cumplimiento y confianza | L | Auditoría de accesos | UX compleja |
| P2 | Evidencia no reutilizable entre procesos | **REPO** | Perfil verificado con consentimiento y equivalencias | Muy alto | Menos costo de evaluación | L | Blueprint/versionado | Comparabilidad falsa |
| P2 | Falta canal contextual | **REPO** | Mensajes por proceso y pregunta previa acotada | Medio | Comunicación centralizada | L | Mensajería/email | Moderación |
| P2 | Sin señal de comportamiento de empresa | **REPO/OBSERVADO** | Tiempo de revisión y tasa de cierre | Alto | Incentivo operativo | M | Analytics confiable | Métrica manipulable |
| P2 | Sin accommodations visibles | **REPO** | Solicitud privada de tiempo/monitoreo ajustado | Alto | Fairness | M | Roles y privacidad | Abuso/estigma |
| P2 | Resultado técnico separado de decisión | **REPO** | Resultado del assessment dentro del timeline | Alto | Contexto unificado | M | Mis procesos | Dependencia de estados |
| P3 | Oportunidades genéricas | **REPO/INFERIDO** | Recomendar solo roles compatibles con evidencia y preferencia | Medio | Leads más calificados | L | Inventario y matching | Marketplace prematuro |
| P3 | Vigencia de habilidades invisible | **INFERIDO** | Fechas, expiración y plan de actualización | Medio | Señales frescas | M | Perfil verificado | Fatiga de recertificación |

Orden sugerido: primero integridad y confianza (P0), después claridad operativa (P1), luego portabilidad y diferenciación (P2), y solo al final expansión de discovery (P3).

## Final Conclusions

Get on Board ofrece la mejor experiencia de las dos plataformas para **encontrar, comparar y reutilizar una identidad laboral**. Su feed, filtros, señales de empresa, múltiples CV, invitaciones, alertas y mensajes forman un sistema coherente de job board. Sin embargo, su experiencia posterior a la postulación sigue subordinada al comportamiento de la empresa: el candidato ve recepción y lectura, pero no el pipeline real ni tiene garantía de cierre o feedback.

TaskIO ya posee el activo más difícil de construir para el tramo posterior: un motor de evaluación técnica con ejecución, persistencia, controles, secciones, resultados y credenciales. Su problema no es falta de capacidades; es que esas capacidades todavía no están envueltas en una experiencia de confianza. La fragmentación de rutas, el guardado silencioso, el tono anticheat, la falta de contexto y la ausencia de un timeline reducen el valor percibido.

La respuesta estratégica es:

> **Get on Board es actualmente la mejor referencia para la experiencia de job board. TaskIO tiene la oportunidad de ser claramente mejor en la experiencia posterior al funnel —evaluación técnica, evidencia, proceso y resultado— siempre que priorice resiliencia, transparencia y justicia antes de ampliar el catálogo.**

Cinco cambios reducirían más el abandono candidato:

1. Mostrar antes de aceptar el tiempo total, las etapas, el deadline y las reglas del assessment.
2. Garantizar guardado visible y recuperación ante fallos de red.
3. Permitir revisar exactamente qué CV/datos se comparten.
4. Unificar todo el proceso en un timeline con siguiente acción y fecha esperada.
5. Entregar cierre obligatorio y feedback técnico útil, aunque sea por competencias.

El north star recomendado no es “más postulaciones”. Es: **porcentaje de candidatos que completan un proceso comprendiendo qué ocurrió, conservando evidencia útil y recibiendo un cierre dentro del plazo prometido**.
