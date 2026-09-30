# TaskIO V1 Product Plan

**Status:** propuesta para aprobación; no autoriza implementación.  
**Base de evidencia:** auditorías recruiter y candidate de Get on Board, contrastadas con el repositorio actual de TaskIO al 28 de septiembre de 2026.  
**Criterio de decisión:** construir el sistema de decisión técnica posterior a la postulación, no otro job board generalista.

## Executive Decision

TaskIO V1 debe concentrarse en un único trabajo: ayudar a un equipo pequeño de reclutamiento TI a convertir una postulación en una decisión humana trazable, usando CV estructurado, requisitos de la vacante, assessments y evidencia de código sin mezclar todas las señales en un score opaco.

La frontera recomendada de V1 es:

1. Hacer confiable el assessment antes de ampliar su alcance.
2. Unificar el proceso de contratación y registrar su historia.
3. Hacer que los límites comerciales correspondan con lo que la UI promete y el backend aplica.
4. Soportar de verdad a equipos de 2–10 recruiters de una empresa.
5. Reorganizar recruiter y candidate alrededor de la vacante y del proceso, respectivamente.
6. Presentar la evidencia separada, con procedencia y fecha, para que una persona pueda decidir.
7. Cerrar el ciclo con el candidato: contexto, siguiente paso y cierre.

No se recomienda competir ahora por amplitud de catálogo, una base global de talento, automatización enterprise ni adquisición pagada de vacantes. Las ventajas existentes —assessments MCQ, coding, Monaco, Judge0, integridad, parsing y AI Match— deben convertirse primero en un flujo coherente y confiable.

**Decisión de release:** las iniciativas 1–9 constituyen TaskIO V1. Talent Memory es la iniciativa 10 y entra sólo si las nueve anteriores cumplen sus criterios de aceptación sin comprometer confiabilidad ni cierre del proceso.

## What TaskIO V1 Is

**TaskIO V1 ayuda a equipos de reclutamiento TI de 2–10 personas a convertir postulaciones en decisiones trazables mediante un workflow compartido que une CV estructurado, requisitos, assessments y evidencia de código, sin depender de un score opaco ni dejar al candidato sin contexto o cierre.**

### Usuario principal

Recruiter o hiring lead de una empresa que contrata talento TI y necesita revisar, evaluar, comparar señales y decidir en colaboración con un equipo pequeño.

### Usuario contraparte

El candidato, que necesita entender qué se solicita, completar una evaluación sin perder trabajo, saber qué sigue y conservar evidencia reutilizable cuando exista consentimiento y contexto suficiente.

### Problema principal

Hoy las capacidades existen como piezas, pero no forman un sistema de decisión confiable: el pipeline puede divergir, la evidencia está fragmentada, el candidato no tiene una vista de proceso, el guardado MCQ puede fallar silenciosamente y los planes no siempre coinciden con el enforcement.

### Workflow principal

**Recruiter:** Vacante → candidato → CV y requisitos → evidencia → assessment/código → revisión humana → entrevista → decisión → cierre.  
**Candidato:** Postulación/invitación → contexto y consentimiento → acción requerida → evaluación confiable → siguiente paso → decisión/cierre → evidencia reutilizable cuando corresponda.

### Valor

- **Recruiter:** menos cambio de contexto, señales comparables sin falsa precisión, historia auditable y próxima acción clara.
- **Candidato:** expectativas explícitas, guardado confiable, proceso visible y cierre oportuno.
- **Diferenciador:** la decisión técnica se apoya en evidencia con procedencia —declarada, encontrada en CV, evaluada o verificada— y no en un único ranking mágico.

## What TaskIO V1 Is Not

TaskIO V1 no es:

- un job board generalista que gana por volumen de vacantes;
- una Talent Database global o un marketplace de candidatos;
- un ATS enterprise configurable para cualquier industria;
- un recruiter autónomo que decide con IA;
- una plataforma de certificación universal;
- una capa de integraciones, API pública o MCP;
- un producto de employer branding, comunidad o contenido social;
- un sistema que reduce a una persona a un score único.

La distribución de vacantes sigue siendo útil, pero deja de conducir la arquitectura. El centro de producto es la decisión posterior a la postulación.

## Product Principles

1. **Integridad antes que amplitud.** Ninguna nueva superficie compensa respuestas perdidas, estados contradictorios o límites comerciales que no se cumplen.
2. **Un proceso, una fuente de verdad.** Recruiter y candidate pueden ver lenguaje distinto, pero ambos deben derivar del mismo estado canónico y de la misma historia de eventos.
3. **Evidencia separada y con procedencia.** AI Match, CV, MCQ, código, badges y revisión humana se muestran como señales distintas, con fuente, fecha, alcance y limitaciones.
4. **La IA asiste; una persona decide.** La IA puede resumir, ordenar o explicar coincidencias, pero no emite una decisión final ni oculta los insumos.
5. **El candidato recibe claridad, resiliencia y cierre.** Antes, durante y después de cada acción se explica el contexto, el estado del guardado, el siguiente paso y el resultado visible.

## Current-State Technical Findings

| Área | Lo que existe | Hallazgo operativo | Implicación V1 |
|---|---|---|---|
| Multi-tenant | `Company`, `RecruiterProfile.companyId`, jobs y aplicaciones filtrados por empresa | Varios recruiters pueden compartir empresa, pero no existe gestión de equipo ni enforcement visible de permisos | Reutilizar `RecruiterProfile` como membresía V1 y hacer efectivos rol/permisos antes de crear arquitectura enterprise |
| Pipeline | `Application.status`, `recruiterInterest`, Kanban y vistas candidate | El Kanban usa `recruiterInterest`; candidate usa `status`; endpoints los modifican por separado | Elegir un estado canónico y separar etapa, disposición y decisión |
| Historia del proceso | Fechas escalares en `Application`; `AuditLog` modelado | No hay `ApplicationEvent`; varias fechas se leen pero no se escriben en flujos encontrados | Crear ledger append-only para timeline, SLA y analytics |
| Assessment | Templates, invites, attempts, answers, events, scoring, badges | Buen modelo de intento/reanudación, pero MCQ actualiza UI antes de confirmar persistencia y silencia fallos | Resolver integridad de guardado como primer slice |
| Coding | Monaco, Judge0, casos visibles/ocultos y scoring | Es una señal técnica diferenciada; no debe colapsarse con AI Match o MCQ | Presentarla como evidencia separada |
| Candidate assessments | `/assessments`, `/mis-evaluaciones`, proceso por aplicación inexistente | Dos hubs solapados reconstruyen estado y deduplicación por separado | Los assessments de una vacante viven en “Mis procesos”; un hub secundario sirve para voluntarios/historial |
| Candidate process | `/profile/applications` con tarjetas y estados | No hay timeline, acción, deadline, siguiente paso o cierre integral | Crear “Mis procesos” a partir del estado y eventos canónicos |
| CV | `User.resumeUrl`, parsing estructurado, `Resume` con snapshots | El modelo `Resume` no aparece conectado al flujo operativo; la postulación captura `resumeUrl` sin selector/preview | En V1 previsualizar el CV compartido; no prometer versionado múltiple aún |
| Evidence | Skills de perfil/CV, badges, assessment/coding results | La procedencia no se presenta como modelo unificado; badges pueden influir en match | Crear una vista normalizada de evidencia sin score compuesto |
| Notifications | Modelos, preferencias y servicio | Se notifican nuevas aplicaciones e hitos de assessment; `APPLICATION_STATUS_CHANGE` existe pero no está cableado al cambio de estado | El evento canónico debe disparar notificación y timeline con la misma política |
| Entitlements | `config/plans.ts`, `Company.billingPlan`, créditos, Stripe, `Plan`/`Subscription` en Prisma | Límites configurados, UI, enforcement y cobro divergen; modelos `Plan`/`Subscription` no gobiernan runtime | Definir un único resolver de entitlements y ledger de uso |
| Analytics | Plausible para marketing; timestamps y filas de dominio | No existe instrumentación de producto suficiente para tiempo en etapa o historia de decisiones | Instrumentar eventos antes de construir dashboards |
| Talent Memory | `/dashboard/candidates` lista candidatos que aplicaron a la empresa | La ruta está fuera de la navegación y no separa activos/anteriores | Evolucionarla; no crear base global, embeddings ni importación compleja |

### Evidencia técnica determinante

- En el Kanban de `app/dashboard/jobs/[id]/page.tsx`, las columnas son `REVIEW`, `MAYBE`, `ACCEPTED` y `REJECTED`; mover a `ACCEPTED` puede seguir guardando `Application.status = REVIEWING`, aunque la columna se llame “Entrevista”.
- `app/api/applications/[id]/interest/route.ts` modifica interés sin modificar estado; la ruta de estado modifica estado sin reconciliar interés.
- `app/assessments/[templateId]/page.tsx` actualiza respuestas locales antes del POST. En un error no 400/410 o de red devuelve `false`, pero el componente MCQ no consume ese resultado ni revierte el estado.
- El submit califica las respuestas persistidas en base de datos, no las que sólo existen en estado local. Una respuesta que parece contestada puede terminar como omitida.
- La API de respuesta usa la clave natural `(attemptId, questionId)` y maneja repetición con create/update; es repetible en estado, pero no hay cola/retry cliente ni idempotency key de request.
- `/assessments` es invite-centric; `/mis-evaluaciones` vuelve a consultar intentos, invitaciones y metadata para construir pendientes, curso e historial. Un tercer flujo repite lógica para el badge de navegación.
- `Application` contiene `reviewingAt`, `interviewAt`, `offerAt`, `hiredAt`, `lastViewedAt` y `viewCount`, pero no se encontraron escrituras operativas para la mayoría de esos campos.
- La UI de la vacante puede describir un assessment como requerido antes de postular; la creación de `Application` no exige completarlo y el backend describe las invitaciones como manuales después de postular. `triggerAt = AFTER_APPLY` no ejecuta un trigger encontrado.
- El onboarding de CV comunica PDF/DOCX y 5 MB; el servidor acepta PDF/DOC/DOCX y 8 MB; otras superficies comunican 8 MB.
- Los booleanos de permiso de `RecruiterProfile` y `maxRecruiters` están modelados/configurados, pero no gobiernan de forma consistente rutas ni alta de equipo.
- El analytics actual es principalmente marketing/Plausible; `AuditLog` está modelado pero no se encontró como historial de producto.

## Critical Inconsistencies

| # | Contradicción | Riesgo | Resolución propuesta |
|---:|---|---|---|
| 1 | `Application.status` y `recruiterInterest` representan etapas parcialmente solapadas | Recruiter y candidato pueden ver realidades distintas | `stage` canónico para progreso; `disposition` para seguir/rechazar; `decision` como acto humano registrado. Durante transición, un solo servicio escribe ambos campos legacy y el evento |
| 2 | La UI MCQ considera respondida una pregunta antes del acknowledgement del servidor | Pérdida silenciosa y score incorrecto | Estados `saving/saved/failed`, retry persistente y submit consciente de pendientes; no mostrar “guardado” antes del ack |
| 3 | Intro promete autosave, pero no informa un fallo recuperable | Falsa confianza | Cambiar el contrato de interfaz junto con la resiliencia, no como copy aislado |
| 4 | Assessment “requerido antes de postular” en la vacante versus invitación manual `AFTER_APPLY` | Candidato no sabe si puede postular; el requisito no se aplica | V1 soporta sólo assessment vinculado al proceso después de postular/invitación. Retirar la promesa pre-apply hasta que exista policy enforcement |
| 5 | `/assessments` y `/mis-evaluaciones` ofrecen vistas paralelas del mismo dominio | Estados y CTAs pueden divergir | Hacer `/assessments` el hub secundario; redirigir `/mis-evaluaciones`; mover lo vinculado a una vacante a `/processes/[applicationId]` |
| 6 | `Resume` modela versiones, pero la operación usa `User.resumeUrl` | La UI podría prometer selección/versionado que no existe | V1 muestra y confirma el CV actual capturado en la aplicación. Versionado múltiple queda fuera hasta tener ownership, preview y retención claros |
| 7 | Recruiter audit favorece equipo/configuración; el código da acceso por empresa sin administración de equipo | Permisos declarados no son seguridad efectiva | Equipo V1 de una sola empresa, con owner/admin/recruiter y permisos aplicados; sin multiempresa ni ACL por vacante salvo necesidad validada |
| 8 | Candidate audit podría elevar “Evaluaciones” a navegación primaria, pero los assessments de vacante son parte de un proceso | Fragmentación mental y rutas duplicadas | Navegación primaria candidate: Mis procesos y Perfil técnico. Evaluaciones es secundaria para voluntarios/badges e historial |
| 9 | Los audits sugieren analytics accionable, pero no existe historia de cambios de etapa | Métricas retroactivas falsas | Instrumentar `ApplicationEvent` primero; mostrar sólo métricas derivables y etiquetar cobertura desde la fecha de instrumentación |
| 10 | Valores, comentarios, pricing, Stripe y consumo de créditos no coinciden | Sobreventa, bypass o cobro inesperado | Resolver entitlements desde una fuente central; no cambiar precios hasta aprobar la semántica comercial |
| 11 | FREE/comentarios pueden decir sin coding, mientras configuración activa coding | La promesa comercial cambia según superficie | Tomar valores aprobados —no comentarios— como catálogo versionado y probar UI/backend contra ese catálogo |
| 12 | Créditos de coding se describen con costo distinto, pero la ruta real descuenta una unidad plana | Margen y expectativas incorrectas | Unificar `quote → reserve → charge/release` en el ledger existente con costo por tipo aprobado |
| 13 | Nuevas empresas pueden iniciar en PRO con créditos aunque existe un tier FREE | Adquisición y facturación no reflejan el catálogo | Decidir explícitamente trial versus FREE; no mantener un “PRO implícito” |
| 14 | `APPLICATION_STATUS_CHANGE` existe, pero el cambio de etapa no dispara una política completa de comunicación | Candidato queda sin siguiente paso o cierre | El cambio canónico crea evento; una policy decide visibilidad, notificación y copy candidato |

## Recruiter Architecture

### Navegación recomendada

| Destino | Nivel | Función | Usuario/frecuencia | Contenido | Dependencia |
|---|---|---|---|---|---|
| **Panel** | Primario | Priorizar trabajo del día | Todos; diaria | Acciones pendientes, vacantes activas, candidatos sin revisar, assessments por revisar, SLA | Eventos canónicos y permisos |
| **Vacantes** | Primario | Crear y operar procesos | Recruiter/lead; diaria | Lista, estado, owner, salud del pipeline, entrada al Job Workspace | Entitlements y equipo |
| **Candidatos** | Primario | Memoria de talento de la empresa | Recruiter/lead; semanal/diaria | Activos, anteriores, búsqueda y filtros por evidencia/última actividad | Identidad por `User`, eventos y evidencia |
| **Evaluaciones** | Primario | Administrar recursos transversales | Recruiter técnico; semanal | Templates, cola global de revisión, consumo; no sustituye el tab por vacante | Entitlements y permisos |
| **Equipo** | Secundario | Invitar y gobernar acceso | Owner/admin; ocasional | Miembros, estado, rol, permisos, capacidad del plan | Modelo mínimo de equipo |
| **Configuración** | Secundario | Empresa, plan, facturación y políticas | Owner/admin; ocasional | Perfil empresa, billing, impuestos, notificaciones, políticas | Entitlements y permisos |

**Analytics no debe ser navegación primaria al lanzar V1.** Hasta disponer de eventos completos, las métricas útiles viven en Panel y en cada Job Workspace. Un destino global “Analytics” se justifica después de que exista cobertura histórica y uso recurrente.

### Cambio sobre la arquitectura actual

- Mantener Panel, Vacantes y Evaluaciones.
- Incorporar Candidatos —la ruta ya existe y hoy está huérfana— como destino principal.
- Mover Facturación bajo Configuración; conservar deep links para no romper accesos.
- Añadir Equipo sólo después de hacer efectivos los permisos.
- Evitar un nav item independiente para cada capacidad técnica; templates y cola global viven en Evaluaciones, mientras resultados por candidato viven en el Decision Packet.

## Candidate Architecture

### Navegación mínima recomendada

| Destino | Nivel | Propósito | Contenido |
|---|---|---|---|
| **Mis procesos** | Primario | Ver cada relación con una empresa/vacante y actuar | Estado comprensible, timeline, acción, deadline, assessment, datos compartidos y cierre |
| **Perfil técnico** | Primario | Mantener la identidad profesional reutilizable | CV actual, experiencia, skills, preferencias, badges/evidencia pública y privacidad |
| **Oportunidades** | Secundario | Descubrir o volver a vacantes | Feed/búsqueda; no domina la experiencia autenticada |
| **Evaluaciones** | Secundario | Voluntarios, badges, práctica e historial transversal | Sólo experiencias no explicadas mejor por un proceso; acceso por utility link y notificaciones |

### Regla de ubicación

- **Assessment ligado a una aplicación:** vive en `Mis procesos → Empresa + vacante` y abre el runner compartido.
- **Assessment voluntario/badge/práctica:** vive en Evaluaciones y puede generar evidencia reutilizable con visibilidad controlada.
- **Historial técnico transversal:** aparece en Perfil técnico como evidencia, no como otro inbox.

La navegación pública puede seguir mostrando oportunidades, pero tras iniciar sesión la primera tarea del candidato es entender sus procesos y acciones pendientes.

## Job Workspace

El Job Workspace mejora la arquitectura actual porque convierte la vacante en el contexto estable de trabajo. Hoy board, lista de aplicaciones, assessments y settings se alcanzan desde rutas o patrones distintos.

### Estructura V1

```text
Vacante: Senior Backend Engineer
├── Overview
├── Pipeline
├── Assessments
├── Activity & Insights
└── Settings
```

| Tab | Decisión que soporta | Contenido V1 |
|---|---|---|
| Overview | ¿Qué requiere atención? | Estado/owner, vacantes del plan, resumen de funnel, candidatos sin revisar, assessments pendientes, alertas |
| Pipeline | ¿Quién avanza y por qué? | Board/lista como dos vistas del mismo query y estado canónico; owner, acción, SLA, filtros |
| Assessments | ¿Qué se solicita y cómo progresa? | Asignación de templates, invitados, started/completed, resultado e integridad resumida |
| Activity & Insights | ¿Qué ocurrió y dónde se atasca? | Timeline de eventos y métricas derivables: volumen, conversión, tiempo en etapa, drop-off con cobertura explícita |
| Settings | ¿Cómo opera esta vacante? | Publicación, requisitos, miembros/owner, política de assessment y cierre/pausa |

### Reglas

- `Pipeline` es el tab operativo por defecto.
- Board y tabla no tienen lógicas de estado distintas.
- Abrir un candidato conserva el contexto de la vacante y muestra el Decision Packet.
- Los insights se derivan de eventos; no se reconstruye historia a partir del valor actual.
- La configuración de assessments no implica automáticamente “pre-apply”; V1 usa política post-apply/invite.

## Candidate Process

“Mis procesos” reemplaza la lista pasiva de postulaciones por una unidad de relación candidato–empresa–vacante.

### Contenido de cada proceso

- empresa y vacante;
- estado comprensible y fecha de última actualización;
- acción requerida y CTA único;
- próximo paso esperado y, si se conoce, fecha/ventana;
- deadline y estado de assessment;
- resultado visible según política;
- CV/datos compartidos al aplicar;
- mensajes/notificaciones del proceso;
- cierre y razón pública cuando la política lo permita.

### Estados candidate-facing

| Estado candidate | Deriva de | Mensaje mínimo |
|---|---|---|
| **Postulación recibida** | Application creada | “Recibimos tu postulación” + datos compartidos |
| **Revisando perfil** | Revisión iniciada | Próximo paso esperado, sin prometer una fecha inexistente |
| **Acción requerida** | Assessment/información pendiente | Qué hacer, duración, deadline y soporte |
| **Evaluación técnica** | Invite/attempt activo o revisión técnica | Guardado/resultado visible y qué sigue |
| **Entrevista** | Stage canónico interview | Fecha o “coordinación pendiente” |
| **Decisión** | Offer/final review | Acción o expectativa de cierre |
| **Proceso cerrado** | Hired/rejected/withdrawn/closed | Resultado comunicado y evidencia reutilizable disponible |

No se exponen etiquetas internas como `MAYBE` o `recruiterInterest`. La capa candidate traduce el estado canónico sin inventar avance.

### Eventos del timeline

- `application_created`
- `application_viewed` —sólo si se define como señal pública; por defecto interno
- `application_stage_changed` con `from/to`
- `assessment_invited`
- `assessment_started`
- `assessment_completed`
- `interview_created` o entrevista coordinada
- `offer_created`
- `candidate_hired`
- `candidate_rejected`
- `candidate_withdrew`
- `process_closed`
- comunicación explícita relevante

Cada tipo define visibilidad `INTERNAL`, `CANDIDATE` o `BOTH`; el timeline candidate no refleja automáticamente notas o señales de integridad.

## Candidate Decision Packet

El Decision Packet no es otra ficha. Es la pantalla que responde: **“¿Tenemos evidencia suficiente, pertinente y vigente para avanzar a esta persona en esta vacante?”**

### Jerarquía visual

#### Visible inmediatamente

1. **Contexto de decisión:** candidato, vacante, etapa, owner, tiempo en etapa y siguiente acción.
2. **Requisitos must-have:** cumplido, no demostrado o contradicho; cada estado enlaza a su evidencia.
3. **Señales separadas:**
   - AI Match y explicación de coincidencias;
   - perfil/CV;
   - MCQ;
   - coding;
   - skills verificadas;
   - revisión humana.
4. **Gaps y blockers:** assessment pendiente, evidencia vieja, requisito no demostrado, integridad que requiere revisión.
5. **Decisión humana:** avanzar, mantener, rechazar o cerrar; razón interna y comunicación candidate separadas.

No existe un score total.

#### Al expandir

- evidencia exacta que respalda un requisito;
- fuente (`declared`, `cv_extracted`, `assessment`, `coding`, `badge`, `human_review`);
- fecha, alcance, versión/blueprint, confianza y validez;
- desglose por sección del assessment;
- casos visibles/ocultos del coding según permisos;
- detalle neutral de integridad, nunca una acusación automática;
- actividad relacionada y autor de notas.

#### Tabs

| Tab | Contenido |
|---|---|
| **Decision Overview** | Contexto, must-haves, gaps, señales resumidas y acciones |
| **Experience & CV** | CV compartido en esa aplicación, experiencia, educación y parsing |
| **Technical Evidence** | Matriz de skills y procedencia, badges y vigencia |
| **Assessments & Code** | Attempts, secciones, score, código, tests e integridad |
| **Activity & Notes** | Evento canónico, notas humanas, decisiones y comunicación |

### Regla de decisión

La UI puede sugerir “evidencia suficiente/incompleta” por checklist explícito, pero no decide por el recruiter. Toda decisión registra actor, timestamp, contexto de vacante y razón opcional/obligatoria según política.

## Assessment Experience

### Assessment Contract previo al inicio

El contrato debe ser corto, escaneable y específico a la invitación. Cuatro bloques son suficientes:

1. **Contexto** — quién lo solicita, empresa, vacante, competencias y para qué se usará.
2. **Esfuerzo** — duración estimada, secciones/preguntas, deadline, intentos y score mínimo si aplica.
3. **Integridad y privacidad** — foco/cambios de pestaña/copy-paste u otras señales registradas; qué verá el recruiter; declarar expresamente “No usamos cámara ni micrófono” mientras sea cierto.
4. **Resiliencia y resultado** — cómo se guardan respuestas, indicador de confirmación, qué ocurre al desconectarse, cómo reanudar, soporte/accommodations y qué resultado verá el candidato.

Se requiere acknowledgement breve: “Entiendo el tiempo, el monitoreo descrito y el resultado que compartiré”. El tono debe ser neutral; señales de integridad no equivalen por sí solas a fraude ni descalificación.

### Persistencia MCQ: comportamiento actual demostrado

1. El candidato selecciona una opción.
2. La UI actualiza `answers` local inmediatamente.
3. Se envía POST a la ruta de respuesta.
4. 400/410 disparan manejo específico de expiración; otros errores devuelven `false` o se registran en consola.
5. El componente MCQ no actúa sobre ese `false`: no hay error visible, rollback, retry ni cola.
6. El progreso local puede marcar la pregunta como completa.
7. En submit/timer se califica lo persistido en `AttemptAnswer`; la respuesta sólo local puede perderse.

La reanudación sí reconstruye respuestas desde servidor y existe índice local, lo cual es una base positiva. El servidor acepta repeticiones por `(attemptId, questionId)` y actualiza, pero esa capacidad no se convierte aún en resiliencia cliente.

### Contrato de guardado V1

- Cada pregunta muestra `Guardando…`, `Guardada` o `No confirmada`.
- Sólo el acknowledgement del servidor permite marcarla guardada.
- Fallos transitorios entran a una cola local persistente y se reintentan con backoff.
- El candidato puede navegar, pero el indicador global mantiene visibles las pendientes.
- El submit manual espera o bloquea con explicación mientras existan pendientes.
- Al expirar el timer se hace un intento acotado de flush; cualquier respuesta no confirmada se comunica, nunca se presenta como guardada.
- Reload/reanudación reconcilia servidor y cola local sin duplicar respuestas.
- Telemetría mide fallo, recuperación y respuesta todavía no confirmada al submit.

### Resultado candidate

V1 muestra estado de finalización, score/secciones cuando la política lo permite, fecha, evidencia que puede reutilizarse y siguiente paso del proceso. No revela respuestas correctas de un assessment de contratación si compromete el banco de preguntas; esa restricción debe explicarse.

## Verified Technical Evidence

### Modelo conceptual

Una pieza de evidencia afirma algo acotado sobre una skill; no afirma seniority general.

```text
JavaScript
├── Declarado: 4 años (candidate, actualizado Sep 2026)
├── CV: 3 experiencias detectadas (parser + fragmentos, Sep 2026)
├── MCQ: 88% (Blueprint JS Fundamentals v3, Sep 2026)
└── Coding: 91% (Challenge Async Data v2, Sep 2026)
```

| Campo | Significado |
|---|---|
| `source` | Declaración, CV, assessment, coding, badge o review humano |
| `sourceRef` | Attempt, badge, resume snapshot o nota que permite inspeccionar origen |
| `observedAt` | Fecha en que se produjo/actualizó la evidencia |
| `confidence` | Calidad de extracción o verificación, no probabilidad de contratación |
| `scope/domain` | Skill y subdominio medidos por blueprint/challenge |
| `validUntil` | Vigencia explícita sólo cuando la política lo requiere |
| `visibility` | Privada candidate, compartida con empresa/proceso o pública |
| `context` | Vacante/proceso que originó la evidencia, si aplica |

### Reutilización

- **Reutilizable con consentimiento:** badges voluntarios, assessment estandarizado cuyo contrato lo permita y evidencia pública controlada por candidate.
- **Reutilizable dentro de la misma empresa con policy visible:** resultados comparables y vigentes, sin exponer contenido protegido.
- **No reutilizable por defecto:** notas humanas, integridad cruda, challenge específico/confidencial, resultado ligado a requisitos particulares o CV compartido para otra vacante.

V1 debe producir un read model normalizado a partir de datos existentes antes de agregar una tabla genérica `Evidence`. Si aparecen múltiples consumidores, versionado y consentimiento complejo, entonces se justifica persistir el modelo.

## Talent Memory MVP

Talent Memory V1 no es una base global. Es la memoria de personas que ya tuvieron relación con una empresa.

### Alcance

- Evolucionar `/dashboard/candidates`; no crear un producto separado.
- Dos vistas: **Activos** —al menos un proceso abierto— y **Anteriores** —todos los procesos cerrados.
- Búsqueda por nombre/email y filtros por skill, evidencia disponible, última actividad, vacante y disposición.
- Mostrar última relación, procesos previos, evidencia que puede verse/reutilizarse y estado de consentimiento.
- Dedupe de candidatos registrados por `User.id` y email normalizado.

### Fuera del MVP

- sourcing global;
- embeddings o búsqueda semántica;
- enriquecimiento externo;
- campañas masivas;
- importación arbitraria de contactos sin identidad, consentimiento y estrategia de dedupe;
- scoring transversal de “calidad”.

Aunque el objetivo futuro incluye personas importadas/evaluadas, la primera versión se limita a candidatos con identidad TaskIO y relación demostrable. La importación entra después de resolver ownership, consentimiento y duplicados.

## Analytics Foundation

### Modelo mínimo de evento

`ApplicationEvent` es append-only y contiene:

- `type`;
- `actorType` y `actorId` nullable para sistema;
- `candidateId`, `applicationId`, `jobId`, `companyId`;
- `happenedAt` del hecho y `recordedAt` técnico;
- `visibility`: `INTERNAL`, `CANDIDATE`, `BOTH`;
- `metadata` mínima, versionada y sin CV/respuestas completas;
- `idempotencyKey` opcional para consumidores/retries.

### Eventos y metadata

| Evento | Actor usual | Metadata importante | Estado actual |
|---|---|---|---|
| `application_created` | Candidate/system | source, UTM, resume snapshot ref | Fila/timestamp disponible; source no siempre poblada; no evento |
| `application_viewed` | Recruiter | surface, firstView | Campos existen, escrituras no encontradas; no historia |
| `application_stage_changed` | Recruiter/system | from, to, reason | Sólo valores actuales; no historia confiable |
| `application_disposition_changed` | Recruiter | from, to, reason | Interés actual; no historia |
| `assessment_invited` | Recruiter | templateId, deadline, required | Invite conserva timestamps; falta evento unificado |
| `assessment_started` | Candidate | attemptId, template version | `startedAt` disponible implícitamente |
| `assessment_answer_saved` | Candidate | attemptId, questionId, latency, retryCount | Respuesta/answeredAt actual; no fallo/recovery ni historia completa |
| `assessment_save_failed/recovered` | Candidate/system | error class, offline, retries, latency | No existe; necesario para calidad |
| `assessment_completed` | Candidate/system | attemptId, score, passed, duration | `submittedAt` y resultados disponibles |
| `interview_created` | Recruiter | schedule/ref, channel | Stage existe; evento/scheduling no demostrado |
| `offer_created` | Recruiter | no datos sensibles | Stage existe; evento no demostrado |
| `candidate_rejected` | Recruiter/system | reasonCode, delayedNotice | `rejectedAt` parcial; no historia unificada |
| `candidate_hired` | Recruiter | effective date opcional | Campo/modelo actual insuficientemente escrito |
| `process_closed` | Recruiter/system | outcome, reasonCode | No existe como evento explícito |

### Qué se puede medir hoy

- **Disponible como snapshot/filas:** aplicaciones, invites, attempts iniciados/completados, respuestas persistidas, rejectedAt, source/UTM si fueron poblados.
- **No disponible históricamente de forma confiable:** cambios de etapa, tiempo en etapa, vistas, decisiones, entrevista/oferta/hire y cierre comunicado.
- **Derivable con limitaciones:** funnel invite → start → complete; no explica abandono, fallos de red ni cobertura anterior a instrumentación.

Primero se instrumenta el dominio; después se muestran analytics. Eventos nuevos no deben fingir historia retroactiva.

## Plans & Entitlements

### Matriz del estado actual

Leyenda: **Sí** = consistente; **Parcial** = existe pero no cubre todos los flujos; **No** = no se encontró enforcement; **Contradictorio** = dos fuentes discrepan.

| Entitlement | Configurado | Mostrado en UI | Aplicado backend | Facturado/ledger | Diagnóstico |
|---|---:|---:|---:|---:|---|
| `maxActiveJobs` | Sí | Sí | Sí al crear y en downgrade | Indirecto por plan | Único límite relativamente coherente |
| `maxCandidatesPerMonth` | Sí | Parcial/copy | No | No | Promesa sin contador/enforcement |
| `maxRecruiters` | Sí | Sí | No consistente | Indirecto por plan | No existe gestión de equipo completa |
| `maxClients` | Sí | Sí, incluido modo agencia | No | Indirecto por plan | No existe modelo de cliente/agencia que lo soporte |
| `codingEnabled` | Sí | Parcial | No encontrado | Indirecto | Comentarios y valor real de FREE contradicen; riesgo de acceso no gobernado |
| AI Match limit | Sí | Sí | Sí, por ranking/lectura | Indirecto | No es consumo mensual; “primeros N” depende del orden/query |
| Assessment credits | Sí en `Company` y config | Sí | Parcial y dependiente de env | Sí, ledger/packs | Dos algoritmos: reserva/costo por tipo versus descuento plano real |
| MCQ/coding incluidos | Sí en copy/config | Sí | Contradictorio | Contradictorio | Valores mensuales de comentarios, config y cobro no coinciden |
| Credit packs | Sí | Sí | Sí vía checkout | Sí | Precios de `config/plans.ts` y pricing/Stripe difieren |
| STARTER/PRO subscription | Sí | Sí | Sí | Sí vía Stripe | Camino principal disponible |
| BUSINESS subscription | Sí | CTA/copy parcial | No en checkout estándar | No completo | UI contiene placeholder; servidor no lo acepta como Starter/Pro |
| Default company plan | PRO en código | No como decisión explícita | Sí al alta | Créditos concedidos | Contradice un catálogo con FREE si no se define como trial |
| `Plan`/`Subscription` Prisma | Sí | No gobierna UI | No gobierna checks observados | No gobierna webhook principal | Modelo paralelo/disconectado |

### Contradicciones específicas

- Comentarios de FREE indican una política de coding distinta de `codingEnabled: true`.
- Comentarios de créditos mensuales (por ejemplo 150/500/2000) difieren de valores reales (250/750/2500).
- Copy de MCQ ilimitado en tiers pagados convive con créditos compartidos y cobro por invite.
- `lib/assessments/credits.ts` contempla costos distintos y reserva; la ruta operativa de invitación/submit utiliza una unidad plana.
- Los packs declarados en configuración comercial no usan los mismos precios que el flujo Stripe.
- Stripe actualiza principalmente `Company.billingPlan`; no demuestra sincronización integral de assessment plan, refill, ciclo y el modelo `Subscription`.
- `ASSESSMENTS_REQUIRE_CREDITS` puede hacer que una capacidad mostrada/facturada tenga enforcement distinto por ambiente.

### Arquitectura futura de fuente única

```text
Catálogo de Plan versionado
        ↓
Resolver de Entitlements por Company
        ↓
Usage/Ledger transaccional
        ↓
Enforcement de dominio
        ↓
UI lee la misma decisión y razón
```

1. **Plan:** catálogo único con tiers existentes; precios quedan sin cambio hasta decisión comercial.
2. **Entitlements:** resolver central retorna límite, consumo, restante y razón, no sólo un booleano.
3. **Usage:** trabajos activos por query; candidatos mensuales y AI Match con definición aprobada; créditos mediante ledger reserve/charge/release.
4. **Enforcement:** servicio de dominio usado por APIs, server actions y checkout; nunca sólo esconder UI.
5. **UI:** muestra el resultado del resolver, ventana temporal y upgrade path exacto.
6. **Billing sync:** webhook idempotente actualiza suscripción, periodo, plan efectivo y refill con audit trail.

No se cambian tiers ni precios en esta fase. Primero se decide qué significa cada entitlement y cuál archivo/modelo deja de ser fuente de verdad.

## Data Model Implications

| Cambio conceptual | Problema actual | Propuesta conservadora | Relaciones/riesgo | ¿Evitable en V1? |
|---|---|---|---|---|
| `ApplicationEvent` | No hay historia para timeline, SLA o analytics | Tabla append-only con tipo, actor, visibilidad, IDs desnormalizados, timestamps, metadata e idempotency key | FK a Application/Candidate/Job/Company; riesgo medio de backfill y doble escritura | **No** para una V1 trazable |
| Stage/Disposition/Decision | `status` e `interest` se solapan | Conceptualmente: stage canónico; disposition separada; decision como evento. Puede introducirse un campo `disposition` y compatibilidad temporal | Migración media; mapear valores actuales y bloquear escritores directos | **No** como concepto; quizá evitar tabla configurable |
| `PipelineStage` configurable | Etapas fijas pueden limitar a clientes futuros | No crear tabla V1; usar enum canónico fijo y mapping candidate | Configuración introduce orden, permisos y migraciones complejas | **Sí**, posponer |
| Company membership | `RecruiterProfile` ya une user-company pero sin rol operativo | Añadir rol/estado de invitación/owner y aplicar permisos existentes en `RecruiterProfile` | Riesgo medio; ownership y último owner requieren reglas | **Sí** puede evitarse un modelo nuevo; no evitar enforcement |
| `CompanyMembership` nuevo | Multiempresa/agencia futura | Crear sólo si un User debe pertenecer a varias empresas o existen hiring managers externos | Cambia auth/session/queries; alto riesgo | **Sí**, fuera de V1 |
| Job access | Hoy el `companyId` abre todos los jobs a recruiters aprobados | V1: acceso company-wide con owner visible; ACL sólo para vacantes confidenciales validadas | Añade join table y filtros a toda consulta | **Sí** |
| `ResumeVersion` | `Resume` no gobierna aplicaciones; `resumeUrl` sí | V1 conserva el snapshot/ref compartido y añade preview; no renombrar/duplicar modelo aún | Retención y archivos pueden quedar huérfanos | **Sí** como nuevo modelo |
| `Evidence` | Señales dispersas sin procedencia uniforme | V1 read model derivado de badge/attempt/resume/profile, con DTO común | Persistir sólo al requerir versionado/consentimiento transversal | **Sí** como tabla; no como contrato de lectura |
| `CandidateDecision` | Acción final no tiene objeto auditado uniforme | Registrar decisión/disposición como `ApplicationEvent` + estado actual; tabla sólo si aparecen aprobaciones múltiples | Evita duplicar estado/evento | **Sí** |
| `AssessmentSaveState` server | Cliente no sabe si una respuesta está confirmada | Estado cliente/local queue; `AttemptAnswer` sigue siendo autoridad | Riesgo bajo; cuidar expiry y reconciliación | **Sí** como tabla |
| Entitlement usage | Algunos límites no tienen ventana/ledger | Resolver primero con queries y ledger de créditos; crear contador transaccional sólo para límites mensuales que lo requieran | Riesgo de race conditions al contar | Parcialmente |

### Estrategia de transición del pipeline

1. Aprobar mapping de estados actuales a stage/disposition.
2. Crear un único comando de transición que valide permisos y reglas.
3. Escribir valor canónico, compatibilidad legacy y `ApplicationEvent` en una transacción.
4. Migrar Kanban, APIs y candidate view al comando.
5. Detectar y reconciliar filas divergentes con reporte, no con suposiciones silenciosas.
6. Retirar escritores directos después de verificar cobertura.

## Route Cleanup

No se cambia ninguna ruta en esta fase. El inventario es la intención final.

### Recruiter

| Ruta actual/propuesta | Acción | Destino/razón |
|---|---|---|
| `/dashboard/overview` | KEEP | Panel operativo |
| `/dashboard/jobs` | KEEP | Lista de vacantes |
| `/dashboard/jobs/new` | KEEP | Wizard, sujeto al entitlement central |
| `/dashboard/jobs/[id]` | MERGE | Entrada al Job Workspace; redirigir al tab default `pipeline` o mostrar overview |
| `/dashboard/jobs/[id]/applications` | MERGE | `jobs/[id]/pipeline?view=list`; board/list comparten dominio |
| `/dashboard/jobs/[id]/pipeline` | NEW | Estado canónico y dos vistas |
| `/dashboard/jobs/[id]/assessments` | KEEP/MOVE | Tab del Job Workspace |
| `/dashboard/jobs/[id]/activity` | NEW | Eventos e insights con cobertura explícita |
| `/dashboard/assessments` | KEEP | Cola global y entrada a templates |
| `/dashboard/assessments/templates` | KEEP | Biblioteca transversal |
| `/dashboard/candidates` | KEEP/EVOLVE | Talent Memory Activos/Anteriores |
| `/dashboard/candidates/pending` | MERGE | Filtro de activos/pending, no destino separado |
| `/dashboard/team` | NEW | Miembros, roles, invitaciones y uso del plan |
| `/dashboard/billing/*` | KEEP + RELOCATE NAV | Deep links permanecen; entrada desde Configuración |
| `/dashboard/company/profile` | KEEP + RELOCATE NAV | Configuración de empresa |
| `/dashboard/analytics` | DEFER | No crear hasta tener historia y demanda; insights en Panel/Job Workspace |

### Candidate

| Ruta actual/propuesta | Acción | Destino/razón |
|---|---|---|
| `/profile/applications` | REDIRECT/EVOLVE | Canonicalizar como `/processes`; preservar redirect |
| `/processes` | NEW | Lista de Mis procesos |
| `/processes/[applicationId]` | NEW | Timeline, acción, assessment, datos compartidos y cierre |
| `/assessments` | KEEP/REDUCE | Hub secundario para voluntarios/badges e historial; puede listar atajos a procesos |
| `/mis-evaluaciones` | REDIRECT | `/assessments?view=history`; retirar lógica duplicada |
| `/assessments/[templateId]` | KEEP | Runner compartido, siempre con contexto de invite/application cuando aplique |
| `/profile/summary` | KEEP/EVOLVE | Perfil técnico y evidencia |
| `/profile/edit` | KEEP/MERGE UI | Edición desde Perfil técnico sin duplicar navegación |
| `/resume/builder` y `/cv/builder` | MERGE | Elegir una ruta canónica; mantener redirects |
| `/profile/resume` | NEW opcional | Ruta semántica estable que puede apuntar al builder canónico |
| Resultados de assessment | KEEP | Enlazar desde proceso o evidencia, con policy de visibilidad |

## 8–10 Product Initiatives

Las iniciativas están en orden recomendado. `FOUNDATION` y `CORE V1` forman el release; `NEXT` no bloquea V1.

### 1. Assessment Answer Integrity — FOUNDATION

- **Problema:** una respuesta MCQ puede parecer guardada aunque el request haya fallado; el submit usa sólo base de datos.
- **Evidencia del repo:** actualización local previa al POST; `false` ignorado por el componente; sin retry/rollback/offline queue; submit califica `AttemptAnswer`.
- **Beneficiario:** candidate primero; recruiter y negocio por confiabilidad del score.
- **Resultado esperado:** ninguna respuesta se presenta como confirmada antes del ack; fallos son visibles y recuperables.
- **Incluye:** save states, retry/backoff, cola local, reconciliación, submit/expiry consciente de pendientes, telemetría de calidad.
- **Fuera de scope:** offline-first completo, service worker, rediseño de scoring o banco de preguntas.
- **Dependencias:** ninguna de producto; reutiliza endpoint repeat-safe.
- **Riesgo:** timers y expiración pueden competir con retries; copy debe ser preciso.
- **Complejidad:** M. **Impacto:** Crítico.

### 2. Canonical Hiring Process & Event Ledger — FOUNDATION

- **Problema:** estado e interés divergen y no existe historia confiable.
- **Evidencia:** Kanban, API de interest y API de status escriben por separado; timestamps históricos no se llenan consistentemente.
- **Beneficiario:** recruiter, candidate, soporte y analytics.
- **Resultado esperado:** toda transición válida produce un estado canónico, disposición coherente y evento auditable.
- **Incluye:** mapping stage/disposition, comando único, `ApplicationEvent`, visibilidad, compatibilidad legacy, reporte de divergencias.
- **Fuera de scope:** etapas configurables por empresa y automation builder.
- **Dependencias:** decisión sobre taxonomía y mapping.
- **Riesgo:** backfill ambiguo y múltiples escritores ocultos.
- **Complejidad:** L. **Impacto:** Crítico.

### 3. Entitlements as One Source of Truth — FOUNDATION

- **Problema:** catálogo, UI, backend, Stripe y créditos discrepan.
- **Evidencia:** límites sin enforcement; dos precios de packs; costo plano real versus costos por tipo; BUSINESS incompleto; default PRO.
- **Beneficiario:** empresa compradora, finanzas, soporte y plataforma.
- **Resultado esperado:** cada capacidad responde de manera consistente “permitida, usada, restante y por qué”.
- **Incluye:** catálogo efectivo, resolver, usage, enforcement, ledger crediticio, sync idempotente y UI consumidora.
- **Fuera de scope:** nuevos tiers, repricing, descuentos o packaging experimental.
- **Dependencias:** decisiones comerciales sobre FREE/trial, coding, créditos y candidatos/mes.
- **Riesgo:** cambiar comportamiento implícito puede afectar clientes actuales; requiere rollout y auditoría.
- **Complejidad:** L. **Impacto:** Crítico.

### 4. Company Team Minimum — FOUNDATION

- **Problema:** múltiples recruiters comparten empresa, pero roles, invitaciones, owner y límites no están operativos.
- **Evidencia:** `RecruiterProfile` y flags existen; `maxRecruiters` no se aplica; no hay Team UI ni ACL clara.
- **Beneficiario:** owner/admin y equipos recruiter de 2–10.
- **Resultado esperado:** una empresa invita, activa/desactiva y gobierna miembros dentro de su plan.
- **Incluye:** owner/admin/recruiter, invitación/estado, permisos efectivos, último owner, límite del plan, audit events.
- **Fuera de scope:** multiempresa por usuario, clientes de agencia, SSO, SCIM, ACL por job.
- **Dependencias:** iniciativa 3 para límite; auth/authorization review.
- **Riesgo:** escalación de privilegios o bloqueo del último owner.
- **Complejidad:** L. **Impacto:** Alto.

### 5. Recruiter Job Workspace — CORE V1

- **Problema:** operar una vacante requiere saltar entre board, lista, candidate review y assessment sin un contexto uniforme.
- **Evidencia:** rutas y componentes separados; Candidatos existe pero no aparece en navegación; analytics actual es snapshot.
- **Beneficiario:** recruiter y hiring lead.
- **Resultado esperado:** una vacante contiene pipeline, assessments, actividad y settings con próximos pasos claros.
- **Incluye:** navegación recruiter final, workspace, board/list única semántica, overview y activity/insights honestos.
- **Fuera de scope:** dashboard BI global, custom widgets, stage builder.
- **Dependencias:** 2, 3 y 4 para estado, límites y permisos.
- **Riesgo:** migrar rutas sin perder deep links; exceso de densidad.
- **Complejidad:** L. **Impacto:** Alto.

### 6. Candidate “Mis procesos” & Assessment Route Consolidation — CORE V1

- **Problema:** candidate ve postulaciones como tarjetas y assessments en hubs duplicados, sin acción/siguiente paso/cierre.
- **Evidencia:** `/profile/applications`, `/assessments` y `/mis-evaluaciones` reconstruyen partes del mismo proceso.
- **Beneficiario:** candidate; soporte por reducción de incertidumbre.
- **Resultado esperado:** cada aplicación tiene una vista coherente con timeline, acción, deadline, assessment y cierre.
- **Incluye:** `/processes`, detalle, estados candidate-facing, redirects y hub secundario consolidado.
- **Fuera de scope:** mensajería completa, calendario propio y comunidad.
- **Dependencias:** 1 y 2; notification policy.
- **Riesgo:** exponer accidentalmente eventos internos o prometer fechas inexistentes.
- **Complejidad:** L. **Impacto:** Crítico.

### 7. Assessment Contract, Results & Closure — CORE V1

- **Problema:** la intro enfatiza monitoreo, omite contexto de empresa/vacante y no explica resiliencia, datos, resultado o accommodations.
- **Evidencia:** template route no incorpora contexto completo de invite/application; resultado y visibilidad dependen de flujos distintos.
- **Beneficiario:** candidate y recruiter.
- **Resultado esperado:** consentimiento informado corto y expectativas consistentes antes/durante/después.
- **Incluye:** contrato de cuatro bloques, contexto, privacidad, integridad neutral, accommodations/contacto, result policy y next step.
- **Fuera de scope:** proctoring con cámara/micrófono, revisión legal internacional y explicación de respuestas protegidas.
- **Dependencias:** 1, 2 y 6; decisión de policy de resultados.
- **Riesgo:** afirmar garantías técnicas no implementadas o exponer contenido del banco.
- **Complejidad:** M. **Impacto:** Alto.

### 8. Technical Evidence Provenance V1 — CORE V1

- **Problema:** skills, CV, badges, MCQ y coding existen, pero no comunican fuente, alcance y vigencia de forma uniforme.
- **Evidencia:** datos distribuidos; badges verificados pueden alimentar match; no existe un contrato de evidencia común.
- **Beneficiario:** recruiter y candidate.
- **Resultado esperado:** cada señal técnica puede inspeccionarse y, cuando corresponde, reutilizarse con consentimiento.
- **Incluye:** read model/DTO, source/date/confidence/scope/validity/visibility, adapters, presentación en packet y perfil.
- **Fuera de scope:** certificación global, inferencia automática de seniority y tabla genérica si no es necesaria.
- **Dependencias:** result/visibility policy de 7; fuentes existentes estables.
- **Riesgo:** tratar confianza de parsing como verdad o comparar blueprints no equivalentes.
- **Complejidad:** L. **Impacto:** Alto.

### 9. Candidate Decision Packet — CORE V1

- **Problema:** hay muchos datos, pero no una vista enfocada en suficiencia de evidencia para una vacante.
- **Evidencia:** `CandidateReviewShell` ya agrupa IA, perfil, CV, assessments, notas y actividad, pero no articula must-haves/provenance/decisión.
- **Beneficiario:** recruiter y hiring lead.
- **Resultado esperado:** decidir avanzar/mantener/rechazar con señales separadas, gaps visibles y razón registrada.
- **Incluye:** jerarquía, tabs, checklist must-have, señales separadas, gaps, integridad neutral y acción humana.
- **Fuera de scope:** score compuesto, auto-rejection y comparación masiva opaca.
- **Dependencias:** 2, 5 y contrato de evidencia de 8; puede empezar con adapter sobre datos actuales.
- **Riesgo:** falsa certeza de parsing/match; sobrecarga visual.
- **Complejidad:** L. **Impacto:** Alto.

### 10. Talent Memory MVP — NEXT

- **Problema:** la empresa no capitaliza candidatos previos aunque ya existe una lista por company.
- **Evidencia:** `/dashboard/candidates` consulta aplicantes de la empresa, pero no está integrada en navegación ni separa activos/anteriores.
- **Beneficiario:** recruiter y empresa.
- **Resultado esperado:** recuperar candidatos conocidos por relación, evidencia y última actividad sin construir una base global.
- **Incluye:** Activos/Anteriores, búsqueda, filtros, relaciones previas, consentimiento visible.
- **Fuera de scope:** embeddings, sourcing externo, importación sin dedupe, campañas y marketplace.
- **Dependencias:** 2, 4, 5 y 9; identidad TaskIO existente.
- **Riesgo:** uso secundario de datos fuera del consentimiento o resultados no comparables.
- **Complejidad:** M. **Impacto:** Medio/Alto. No bloquea V1.

## Implementation Order

1. **Assessment Answer Integrity.** Reduce el riesgo más grave con pocas dependencias y genera telemetría real.
2. **Aprobar y construir Canonical Hiring Process & Event Ledger.** Todo timeline, métrica y UI posterior depende de una semántica estable.
3. **Entitlements as One Source of Truth.** Antes de exponer nuevas acciones o equipo, la plataforma debe saber quién puede hacer qué.
4. **Company Team Minimum.** Aplica autorización y límite sobre la base comercial central.
5. **Recruiter Job Workspace.** Reorganiza la operación usando estado, eventos y permisos ya resueltos.
6. **Candidate “Mis procesos” & route consolidation.** Expone una traducción segura del mismo proceso y elimina duplicación.
7. **Assessment Contract, Results & Closure.** Confiabilidad y contexto de proceso ya disponibles permiten promesas verdaderas.
8. **Technical Evidence Provenance V1.** Normaliza las señales antes de hacerlas centrales en decisiones.
9. **Candidate Decision Packet.** Ensambla proceso, requisitos y evidencia ya normalizados en la superficie de decisión.
10. **Talent Memory MVP.** Reutiliza identidad, historia y evidencia; entra después del release core o si queda capacidad sin comprometerlo.

### Secuencia de entrega sugerida

- **Slice 0:** confiabilidad MCQ, sin migración.
- **Foundation release:** iniciativas 2–4, con migraciones separadas y feature flags de lectura/escritura dual donde proceda.
- **Workflow release:** iniciativas 5–7.
- **Evidence release:** iniciativas 8–9.
- **Next:** iniciativa 10.

## Dependencies

```text
1 Assessment integrity ───────────────┐
                                      ├─> 6 Mis procesos ─> 7 Contract
2 Canonical process + events ─> 5 Job Workspace ──────────┐
            ├────────────────────────> 6 Mis procesos      │
            └────────────────────────> Analytics foundation│
3 Entitlements ─> 4 Team ───────────> 5 Job Workspace     │
7 Contract/results ─> 8 Evidence provenance ─> 9 Decision Packet
2 + 4 + 5 + 8 ───────────────────────────────────────────> 10 Talent Memory
```

### Decisiones que bloquean trabajo

- La taxonomía stage/disposition y su mapping bloquean iniciativa 2.
- FREE versus trial PRO, costo de créditos y definición de candidatos/mes bloquean iniciativa 3.
- Una empresa por recruiter en V1 bloquea el alcance correcto de iniciativa 4.
- Visibilidad de resultados, reutilización y consentimiento bloquean iniciativas 7–9.
- Ninguna de esas decisiones bloquea el primer slice de guardado MCQ, salvo aprobar la conducta de expiración/submit con respuestas no confirmadas.

## Acceptance Criteria

### Initiative 1 — Assessment Answer Integrity

- **GIVEN** un candidato selecciona una respuesta, **WHEN** el servidor aún no confirma, **THEN** la pregunta muestra “Guardando” y no “Guardada”.
- **GIVEN** un fallo temporal o pérdida de conexión, **WHEN** falla el save, **THEN** la respuesta permanece local, se marca “No confirmada” y se reintenta sin requerir volver a seleccionarla.
- **GIVEN** un reload con saves pendientes, **WHEN** el intento sigue vigente, **THEN** cliente y servidor se reconcilian sin duplicar ni sobrescribir una confirmación más nueva.
- **GIVEN** respuestas pendientes, **WHEN** el candidato intenta enviar, **THEN** el sistema espera/reintenta o explica qué no está confirmado; nunca afirma que todo fue guardado.
- **GIVEN** expira el timer, **WHEN** existe una respuesta no confirmada, **THEN** se intenta un flush acotado y el resultado queda observable en UI/telemetría.

### Initiative 2 — Canonical Hiring Process & Event Ledger

- **GIVEN** una aplicación válida, **WHEN** un recruiter cambia etapa o disposición, **THEN** un único comando actualiza el estado actual y escribe un evento con actor, from/to y timestamp en la misma operación.
- **GIVEN** una combinación legacy incompatible de `status` e `interest`, **WHEN** se audita la migración, **THEN** aparece en un reporte y no se corrige con una inferencia silenciosa.
- **GIVEN** un evento interno, **WHEN** candidate abre el proceso, **THEN** sólo ve eventos cuya policy sea `CANDIDATE` o `BOTH`.

### Initiative 3 — Entitlements as One Source of Truth

- **GIVEN** empresa, plan y uso, **WHEN** UI y backend consultan una capacidad, **THEN** reciben el mismo límite, consumo, restante y razón.
- **GIVEN** una operación sobre el límite, **WHEN** dos requests compiten, **THEN** no pueden consumir más de lo permitido.
- **GIVEN** un assessment por créditos, **WHEN** se invita, completa, cancela o expira, **THEN** ledger aplica la política aprobada de reserve/charge/release una sola vez.
- **GIVEN** un webhook repetido, **WHEN** se procesa, **THEN** plan, periodo y refill no se duplican.

### Initiative 4 — Company Team Minimum

- **GIVEN** un owner dentro del límite, **WHEN** invita a un recruiter, **THEN** el miembro queda asociado a la misma empresa con rol/estado auditables.
- **GIVEN** un miembro sin permiso, **WHEN** llama directamente una ruta protegida, **THEN** backend niega la acción aunque la UI no muestre el control.
- **GIVEN** una empresa con un solo owner activo, **WHEN** se intenta desactivar/eliminar, **THEN** se exige transferir ownership.

### Initiative 5 — Recruiter Job Workspace

- **GIVEN** una vacante, **WHEN** se alterna board/lista, **THEN** ambos muestran los mismos candidatos, etapas, filtros y permisos.
- **GIVEN** un cambio en Pipeline, **WHEN** termina, **THEN** Overview y Activity reflejan el mismo evento sin refresh inconsistente.
- **GIVEN** datos anteriores a instrumentación, **WHEN** se muestran insights, **THEN** la UI indica cobertura y no inventa tiempo histórico.

### Initiative 6 — Candidate “Mis procesos”

- **GIVEN** una aplicación, **WHEN** candidate abre su proceso, **THEN** ve empresa/vacante, estado entendible, última actualización, acción requerida, deadline y próximo paso conocido.
- **GIVEN** un assessment ligado a esa aplicación, **WHEN** se invita/inicia/completa, **THEN** aparece dentro del proceso y no requiere interpretar dos hubs.
- **GIVEN** una ruta legacy `/mis-evaluaciones` o `/profile/applications`, **WHEN** se navega, **THEN** redirige al destino canónico conservando el contexto posible.
- **GIVEN** un proceso cerrado, **WHEN** candidate lo abre, **THEN** ve un cierre explícito y no permanece indefinidamente “en revisión”.

### Initiative 7 — Assessment Contract, Results & Closure

- **GIVEN** una invitación de contratación, **WHEN** candidate ve la intro, **THEN** identifica solicitante, vacante, competencias, duración, deadline, intentos, monitoreo, resiliencia y visibilidad de resultados.
- **GIVEN** que no se usa cámara/micrófono, **WHEN** se describe integridad, **THEN** se afirma explícitamente y no se usa lenguaje acusatorio.
- **GIVEN** una necesidad de accommodation, **WHEN** candidate aún no inicia, **THEN** encuentra un canal/acción y sabe el efecto sobre deadline.
- **GIVEN** un attempt terminado, **WHEN** se publica el resultado permitido, **THEN** candidate ve lo prometido y el siguiente paso del proceso.

### Initiative 8 — Technical Evidence Provenance V1

- **GIVEN** una skill con varias señales, **WHEN** se presenta, **THEN** cada señal conserva source, date, scope, confidence/verification y visibility.
- **GIVEN** un assessment de una vacante, **WHEN** se evalúa reutilización, **THEN** no aparece en otra empresa/proceso sin policy y consentimiento aplicables.
- **GIVEN** una sola evaluación alta, **WHEN** se resume la evidencia, **THEN** no se infiere seniority general ni se genera score compuesto.

### Initiative 9 — Candidate Decision Packet

- **GIVEN** un candidato en una vacante, **WHEN** recruiter abre el packet, **THEN** ve de inmediato must-haves, gaps, señales separadas, etapa, owner y próxima acción.
- **GIVEN** una afirmación de match o skill, **WHEN** recruiter la inspecciona, **THEN** puede llegar a su evidencia/procedencia y timestamp.
- **GIVEN** una señal de integridad, **WHEN** aparece, **THEN** se muestra como dato que requiere revisión, no como fraude probado.
- **GIVEN** una decisión humana, **WHEN** recruiter confirma, **THEN** se registra actor/razón/evento y se aplica la política de comunicación candidate.

## Success Metrics

Máximo ocho métricas, todas accionables:

| Categoría | Métrica | Por qué importa |
|---|---|---|
| Business | **Weekly Active Hiring Companies:** empresas con ≥1 vacante activa y ≥1 acción de decisión/evidencia en la semana | Mide uso real del workflow, no logins |
| Business | **Evidence Workflow Adoption:** % de empresas activas que usan assessment/coding y Decision Packet en ≥1 proceso | Valida el diferenciador |
| Recruiter | **Median time to first review** desde `application_created` | Detecta acumulación inicial |
| Recruiter | **P75 time in stage** por etapa y vacante | Orienta SLA y cuellos de botella |
| Candidate | **Assessment start → completion rate**, segmentada por duración/dispositivo | Detecta fricción y abandono |
| Candidate | **Processes closed and communicated within SLA** | Mide cierre, no sólo cambio interno |
| Platform quality | **Confirmed save failure per 1,000 answers + recovery within 30 s** | Vigila la integridad MCQ y eficacia del retry |
| Platform quality | **Unauthorized/over-limit operations that succeed** —objetivo cero— y discrepancias UI/backend | Vigila entitlements y permisos |

Guardrails de lectura: cohortes pequeñas, plantillas distintas y jobs con diferente seniority no deben compararse como si fueran equivalentes.

## North Star

**Porcentaje de aplicaciones cerradas que alcanzan una decisión humana documentada con la evidencia requerida completa y cuyo resultado se comunica al candidato dentro del SLA prometido.**

Esta métrica une valor recruiter, candidate y calidad operacional. No recompensa “rechazar rápido” porque exige evidencia requerida, decisión documentada y comunicación; debe leerse junto con tiempo por etapa y tasas de completion.

## Not Now

| No construir ahora | Por qué no ahora | Condición que justificaría construirlo |
|---|---|---|
| Marketplace masivo / Talent Database global | Compite por liquidez y volumen antes de cerrar el workflow | Retención fuerte de empresas, demanda de sourcing y consentimiento/identidad sólidos |
| Pin / Boost / adquisición pagada de vacantes | Optimiza distribución, no calidad de decisión | El supply de vacantes y conversión pública son el cuello de botella demostrado |
| Salary insights | Requiere dataset confiable, normalización y escala | Cobertura estadística suficiente por rol/ubicación/seniority y utilidad validada |
| MCP recruiter, API pública y webhooks self-service | Amplían superficie, seguridad y soporte | Workflow estable, eventos versionados y clientes que lo exijan para renovación |
| Integraciones ATS | Duplican sync/ownership antes de estabilizar el modelo canónico | ICP medio/enterprise pierde deals por una integración específica |
| Career page builder sofisticado | Employer branding no es el core de decisión | Clientes convierten mal por falta de personalización y lo piden repetidamente |
| Social feed, events, perks y following companies | Comunidad/adquisición desvía recursos del post-funnel | Existe masa crítica y evidencia de retención por contenido/comunidad |
| Chat genérico de IA | No resuelve por sí mismo un trabajo verificable y puede ocultar evidencia | Casos acotados muestran ahorro medible y mantienen trazabilidad |
| Score único de candidato | Crea falsa precisión y sesgo; contradice la tesis de señales separadas | No recomendado; si se explora, sólo con investigación de validez, explicación y gobernanza |
| Etapas custom, automation builder, SSO/SCIM y ACL por job | Complejidad enterprise prematura | Clientes objetivo superan 10 miembros o requieren compliance/confidencialidad contractual |
| Certificación global | Mezcla evidencia contextual con credencial universal | Blueprints estandarizados, validez demostrada y demanda de portabilidad candidate |
| Importación masiva y embeddings para Talent Memory | Identidad, dedupe, consentimiento y calidad aún no resueltos | Corpus empresarial suficiente y búsqueda literal/filtros ya no cubren el trabajo |

Las tres exclusiones estratégicas que más protegen V1 son: marketplace/Talent DB global, capa enterprise de integraciones y score único.

## Risks

| Riesgo | Probabilidad/impacto | Mitigación |
|---|---|---|
| Backfill ambiguo de pipeline | Alta/Alta | Reporte de divergencias, mapping aprobado, dual write temporal, reconciliación manual de outliers |
| Pérdida al expirar mientras la red falla | Media/Crítica | Estado no confirmado, queue local, retry acotado, telemetría y diseño posterior de submit atómico si los datos lo justifican |
| Cambiar entitlements afecta cuentas existentes | Alta/Alta | Audit mode, comparación de decisiones, grandfathering explícito y rollout por capability |
| Sobreprometer privacidad/integridad | Media/Alta | Contract generado desde capacidades reales; revisión legal/privacidad antes de copy final |
| Exponer notas/eventos internos a candidate | Media/Alta | Visibilidad por tipo allowlist; pruebas de autorización y payload |
| UI del packet demasiado densa | Media/Media | Jerarquía progresiva, prueba con tareas de decisión, no añadir score para simplificar artificialmente |
| Evidencia no comparable | Alta/Media | Mostrar blueprint/version/scope/date; no ordenar candidatos por resultados incompatibles |
| Permisos sólo cosméticos | Media/Crítica | Enforcement server-side central y matriz de autorización probada |
| Métricas sin cobertura histórica | Alta/Media | Etiquetar fecha de inicio/cobertura y evitar backfill inferido |
| Scope creep hacia job board/enterprise | Alta/Alta | Gate de iniciativas: debe mejorar integridad, claridad, evidencia, workflow o decisión de V1 |

## Open Product Decisions

Estas decisiones requieren aprobación antes de sus iniciativas; la recomendación está marcada.

1. **Frontera de V1 — recomendada:** sistema de decisión postulación→cierre para equipos TI de 2–10; distribución pública permanece pero no conduce el roadmap.
2. **Pipeline canónico — recomendada:** stages fijos `APPLIED/REVIEW/ASSESSMENT/INTERVIEW/OFFER/CLOSED`; disposition separada `ACTIVE/HOLD/REJECTED/WITHDRAWN/HIRED`; la decisión queda como evento humano. El naming final debe validarse contra casos reales.
3. **Assessment job policy — recomendada:** V1 sólo post-apply/invite. No mostrar “requerido antes de postular” hasta tener enforcement y UX dedicados.
4. **Equipo — recomendada:** un recruiter pertenece a una empresa en V1; `RecruiterProfile` funciona como membresía. Multiempresa/agencia queda fuera.
5. **Resultados candidate — por aprobar:** qué score/desglose se muestra para job assessments, cuándo se libera y qué evidencia puede reutilizarse.
6. **Entitlements — por aprobar:** FREE versus trial PRO; coding en FREE; significado de candidatos/mes; costo MCQ/coding; momento de reserve/charge/release; experiencia BUSINESS.
7. **Cierre candidate — recomendada:** todo proceso terminal debe generar comunicación, salvo excepción legal/operativa explícita y auditable.
8. **Assessment expiry — recomendada:** una respuesta no confirmada nunca se representa como guardada; al expirar se hace flush acotado y se registra el resultado. Evaluar submit atómico sólo si el slice demuestra pérdida residual relevante.
9. **Evidence reuse — recomendada:** opt-in explícito para reutilización entre empresas; dentro de empresa, policy visible y scope/validez conservados.

### Decisión mínima para comenzar

Aprobar la definición y frontera de TaskIO V1, y autorizar que **Assessment Answer Integrity** sea el primer slice con esta regla: *la UI nunca afirma que una respuesta está guardada hasta recibir confirmación; los fallos se conservan, muestran y reintentan, y el submit no los oculta*.

La taxonomía del pipeline y la política comercial pueden aprobarse después, antes de las iniciativas 2 y 3 respectivamente.

## Recommended First Engineering Slice

### Slice: MCQ save acknowledgement + recoverable retry

Es el mejor primer trabajo porque el fallo está demostrado, afecta la validez del assessment, tiene pocas dependencias, no requiere Prisma ni rediseñar el producto y puede verificarse con fallos de red controlados.

### Archivos/rutas afectados

- `app/assessments/[templateId]/page.tsx` — orquestación de respuestas, estado global, timer y submit.
- Componente MCQ `AssessmentQuestion` correspondiente — consume y representa el resultado del save.
- Un hook/módulo pequeño junto al runner, por ejemplo `useAnswerPersistence` — cola, estados, retry y reconciliación.
- `app/api/assessments/attempts/[attemptId]/answer/route.ts` — inicialmente sólo confirmar el contrato repeat-safe/respuesta; modificar únicamente si una respuesta explícita de versión/ack es necesaria.
- Tests unitarios/integración del hook/runner y tests de la ruta repeat-safe.

No requiere cambio de schema, migración, pricing ni navegación.

### Comportamiento actual

- Selección actualiza UI local inmediatamente.
- POST persiste después.
- Fallos genéricos/red devuelven `false` o consola.
- MCQ ignora el resultado.
- Progreso puede tratar la pregunta como contestada.
- Submit califica sólo la base de datos.

### Comportamiento objetivo

- La selección sigue respondiendo visualmente, pero queda `saving`.
- Ack cambia a `saved` y registra latencia.
- Error transitorio cambia a `failed/unconfirmed`, conserva la respuesta y programa retry.
- La cola sobrevive reload durante el intento y se reconcilia con `/state`.
- Cambiar de pregunta no oculta pendientes; hay indicador agregado.
- Submit manual no continúa silenciosamente con pendientes.
- Expiry ejecuta un flush acotado, muestra el resultado real y emite telemetría.

### Implementación conceptual

1. Modelar por `questionId` `{selectedOption, status, updatedAt, retryCount}`.
2. Persistir sólo pendientes en storage namespaced por attempt; limpiar cada item después del ack.
3. Serializar/coalescer saves por pregunta: la selección más nueva sustituye una anterior pendiente.
4. Reintentar errores de red/5xx con backoff y jitter; no reintentar errores definitivos de auth/expiry/validación.
5. Al cargar, leer estado servidor, reconciliar una selección local más nueva y reintentar si el attempt sigue activo.
6. Derivar progreso confirmado y progreso seleccionado por separado; usar lenguaje inequívoco.
7. Antes de submit, ejecutar `flushPending` con timeout; en submit manual pedir acción si queda algo no confirmado.
8. En timer expiry, no prolongar indefinidamente: flush acotado, transición existente y telemetría `pending_count/recovered_count`.
9. Instrumentar `save_failed`, `save_recovered`, latencia y pendientes al submit sin guardar contenido de respuestas en analytics.

### Tests necesarios

- selección → saving → ack → saved;
- network error/500 → unconfirmed → retry → saved;
- dos selecciones rápidas de la misma pregunta terminan con la más nueva;
- request repetido no duplica y actualiza la misma respuesta;
- 400/410 no entra en retry infinito;
- reload con server answer + local pending reconcilia correctamente;
- submit manual espera/bloquea con pendientes y continúa tras ack;
- expiry con retry exitoso y expiry con red caída;
- UI no comunica “guardada” antes del ack;
- telemetría no contiene opción/respuesta ni PII innecesaria.

### Riesgos

- Race entre selección, retry y timer.
- Storage compartido entre attempts si no se namespacifica correctamente.
- Una expiración server-side puede rechazar el último retry; la UI debe admitirlo sin afirmar éxito.
- Tests con timers pueden ser frágiles; usar reloj simulado y máquina de estados pequeña.

### Definition of Done

- No existe camino MCQ conocido donde un fallo de persistencia deje una respuesta visualmente “guardada”.
- Las respuestas pendientes son visibles, reintentables y sobreviven un reload del mismo attempt.
- Submit manual y expiración tienen conducta explícita y probada con pendientes.
- Repetir el save produce una única respuesta autoritativa por attempt/question.
- Métricas de fallo y recuperación están disponibles sin contenido sensible.
- Build, lint y tests relevantes pasan.
- QA manual reproduce offline, recuperación, reload y timer.
- No hay cambios de Prisma, planes, scoring ni rutas fuera del slice.
