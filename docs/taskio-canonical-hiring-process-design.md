# TaskIO Canonical Hiring Process Design

## Executive Recommendation

TaskIO debe tener una sola autoridad operacional para cada candidatura:

- `stage` responde **dónde está** el proceso.
- `disposition` responde **en qué condición operativa o terminal** está.
- una decisión humana es un **evento auditable**, no un tercer snapshot que pueda divergir.

El enum de `Stage` recomendado es `APPLIED | REVIEW | ASSESSMENT | INTERVIEW | OFFER | CLOSED`.

El enum de `Disposition` recomendado es `ACTIVE | HOLD | REJECTED | WITHDRAWN | HIRED | CANCELLED`. `CANCELLED` se añade a la propuesta del Product Plan porque “la empresa cerró la vacante con candidatos activos” no significa que esas personas fueron rechazadas, retiradas o contratadas. Sin ese valor, el modelo obliga a mentir o a combinar `CLOSED + ACTIVE`, que es contradictorio.

`recruiterInterest` no debe reinterpretarse como la nueva disposition. `MAYBE` y `ACCEPTED` mezclan interés, shortlist y etapa; además, `ACCEPTED` hoy significa “Entrevista”, “Aceptados”, `REVIEWING` u `OFFER` según la superficie. Debe mantenerse temporalmente como campo legacy de compatibilidad, escrito únicamente por el comando canónico, dejar de leerse por producto y eliminarse en una iniciativa posterior tras un periodo de auditoría.

La migración no debe reconstruir una historia que no existe. Cada fila reconciliada recibe un único `legacy_state_imported` como baseline, con la combinación original y la clasificación del mapping. Las métricas temporales confiables empiezan en la fecha de instrumentación; los timestamps legacy sólo se usan como snapshots cuando su procedencia sea demostrable.

La solución requiere dos migrations V1, ambas aditivas o endurecedoras, no una eliminación inmediata:

1. añadir estado canónico nullable, versión de concurrencia y ledger append-only;
2. después del reporte/backfill, hacer canónico el write path, completar restricciones/defaults e índices necesarios.

La eliminación de campos legacy sería una migration futura separada y no forma parte de estas dos.

## Current State Inventory

### Hallazgo central

El repositorio no tiene una máquina de estados única. Tiene dos snapshots independientes, varios escritores directos y distintas traducciones UI. La candidatura puede quedar legítimamente almacenada en una combinación que el recruiter interpreta como entrevista y el candidate como revisión.

| Archivo | Campo | Lee / escribe | Valores utilizados | Contexto | Riesgo |
|---|---|---|---|---|---|
| `prisma/schema.prisma` | `Application.status` | Define | `SUBMITTED`, `REVIEWING`, `INTERVIEW`, `OFFER`, `REJECTED`, `HIRED`; default `SUBMITTED` | Snapshot candidato/proceso | Solapa etapa y resultado terminal |
| `prisma/schema.prisma` | `Application.recruiterInterest` | Define | `REVIEW`, `MAYBE`, `ACCEPTED`, `REJECTED`; default `REVIEW` | Snapshot recruiter | Solapa interés, decisión y etapa |
| `prisma/schema.prisma` | timestamps de `Application` | Define | `submittedAt`, `reviewingAt`, `interviewAt`, `offerAt`, `hiredAt`, `rejectedAt`, `lastViewedAt`, `assignedAt`, `starredAt` | Timeline/snapshots | La mayoría no tiene escritor de producción demostrado |
| `app/api/applications/route.ts` | `status`, `recruiterInterest` | Crea/lee | defaults `SUBMITTED + REVIEW` | Postulación y listado | Crea el baseline correcto, pero sin evento |
| `app/api/applications/[id]/route.ts` | `status` | Escribe | cualquier `ApplicationStatus` válido | PATCH genérico recruiter/admin | Salta reglas, timestamps, eventos y sincronización de interest |
| `app/api/applications/[id]/status/route.ts` | `status`, `rejectedAt`, `rejectionEmailSent` | Lee/escribe | cualquiera de los seis status | Cambio explícito de status | Permite cualquier origen→destino; sólo mantiene rechazo; `oldStatus` no gobierna nada |
| `app/api/applications/[id]/interest/route.ts` | `recruiterInterest` | Escribe | los cuatro interests | Botones/select recruiter | No sincroniza status, timestamps, evento ni notificación |
| `app/dashboard/applications/actions.ts` | `status` | Escribe | cualquiera; tratamiento especial `REJECTED` | Server action legacy | Otro escritor directo con reglas parciales |
| `app/dashboard/overview/actions.ts` | ambos | Escribe | `REVIEWING + ACCEPTED`; `REJECTED + REJECTED` | Quick actions | “Revisar” convierte interest a `ACCEPTED`; semántica no evidente |
| `app/dashboard/jobs/[id]/page.tsx` | ambos | Lee/escribe | columnas interest; `REJECTED→REJECTED`, todo lo demás→`REVIEWING` | Kanban recruiter | Mover a `ACCEPTED`/“Entrevista” deja status `REVIEWING` |
| `app/dashboard/jobs/[id]/applications/InterestSelect.tsx` | ambos | Escribe en dos requests | `REVIEW/MAYBE→REVIEWING`, `ACCEPTED→OFFER`, `REJECTED→REJECTED` | Selector en lista | Contradice Kanban; dos requests pueden fallar parcialmente |
| `app/dashboard/jobs/[id]/applications/page.tsx` | `recruiterInterest` | Lee/filtra | cuatro interests | Lista, filtros y contadores | El pipeline recruiter ignora status |
| `components/dashboard/CandidateReviewShell.tsx` | ambos + timestamps | Lee; escribe interest | `MAYBE`, `ACCEPTED`, `REJECTED` | Decision packet actual | Botones cambian sólo interest; timeline consume timestamps casi nunca escritos |
| `app/dashboard/candidates/[id]/page.tsx` | ambos + timestamps | Lee | todos | Carga Candidate Review | Expone divergencia existente a la shell sin reconciliar |
| `app/dashboard/candidates/pending/page.tsx` | interest/status relacionados | Lee | estados activos/pending | Cola recruiter | “Pending” depende de semántica legacy, no canónica |
| `app/profile/applications/page.tsx` | `status` | Lee/filtra | seis status | Vista candidate | Candidate ignora interest y puede ver otra realidad |
| `app/profile/summary/ProfileSummaryClient.tsx` | `status` | Lee | seis status | Resumen candidate | Incluso el copy de rechazo difiere de la otra vista candidate |
| `app/dashboard/overview/page.tsx` | ambos | Lee/agrega | status recientes; funnel por interest | Dashboard/funnel | `ACCEPTED` se llama “Aceptados”; métricas son snapshot, no historia |
| `app/api/applications/[id]/assessment-invite/route.ts` | relación Application, no estado canónico | Lee | invite/assessment status | Enviar assessment | No mueve stage ni genera evento de proceso |
| rutas `app/api/assessments/**` y vistas assessment | invite/attempt status | Lee/escribe su propio dominio | invited/started/submitted/result | Ciclo de evaluación | El subdominio cambia sin reflejarse en el pipeline |
| `app/api/cron/rejections/route.ts` | `status`, `rejectedAt`, `rejectionEmailSent` | Lee/escribe flag de email | `REJECTED` | Email diferido a 3 días | Un interest `REJECTED` divergente no comunica cierre; bloqueo concurrente débil |
| `lib/notifications/constants.ts`, `service.ts`, `templates.ts`, `channels/email.ts` | tipo de notificación | Define/procesa | `APPLICATION_STATUS_CHANGE` existe | Infra de notificaciones | Infra disponible pero no conectada al cambio de status observado |
| `prisma/seed.ts` | `status` | Crea | principalmente `SUBMITTED` | Seed general | No prueba transiciones |
| `prisma/seed-demo-candidates.ts` | ambos | Crea | cuatro combinaciones únicas observadas | Demo recruiter | Materializa divergencias, incluida `REVIEWING + ACCEPTED` |
| `scripts/create-test-invite.ts`, `scripts/full-test-coding-system.ts` | `status` | Crea | `REVIEWING` | Datos de prueba manual | Pueden omitir interest explícito y depender del default |
| `__tests__/integration/api/applications.test.ts` | status literales | Prueba | incluye valores legacy ajenos al enum actual (`PENDING`, `ACCEPTED`) | Integración | Drift: no es evidencia confiable de la máquina actual |
| migrations `20250909172648_add_codex`, `20250916180906_add_company_nullable` | `ApplicationStatus` | Crea/extiende | primero sin `HIRED`, luego con `HIRED` | Historia schema | El enum evolucionó sin ledger |
| migration `20250926200749_add_rejected_fields` | rechazo | Añade | `rejectedAt`, `rejectionEmailSent` | Comunicación diferida | Sólo un terminal recibió instrumentación parcial |
| migration `20251009191521_add_recruiter_interest` | interest | Añade | cuatro valores | Pipeline recruiter | Introdujo segunda autoridad |
| migration `20260216220938_improve_signup_models` | timestamps pipeline | Añade | reviewing/interview/offer/hired/etc. | Timeline proyectado | Columnas añadidas sin writers uniformes |

No se encontró importador productivo de candidaturas. Los scripts actuales son de seed/prueba; una importación manual futura debe entrar mediante el mismo comando con actor `IMPORT` o `SYSTEM`, no escribir snapshots directamente.

## Current Enums

### `Application.status`

| Valor | Significado aparente | Recruiter-facing | Candidate-facing | Qué lo genera hoy | Timestamp | Notificación | Label/color y filtro | Terminal |
|---|---|---|---|---|---|---|---|---|
| `SUBMITTED` | Postulación creada | Aparece en datos recientes, no gobierna board/lista | “Enviada”, gris/zinc; filtrable | POST application/default/seed | `submittedAt` default | Email de recepción al aplicar; no por transición | Candidate sí | No |
| `REVIEWING` | Revisión general | Overview “En revisión”; puede ser forzado por Kanban | “En revisión”, azul/celeste; filtrable | PATCH genérico/status, actions, Kanban para cualquier interest no rechazado | `reviewingAt` existe, sin write productivo encontrado | No observada | Candidate sí | No |
| `INTERVIEW` | Etapa entrevista | Overview “A entrevista”; board puede no reflejarla | “Entrevista”, índigo/violeta; filtrable | PATCH genérico/status; no writer de scheduling unificado | `interviewAt` existe, sin write productivo encontrado | No observada | Candidate sí | No |
| `OFFER` | Oferta | Overview “Con oferta” | “Oferta”, verde; filtrable | PATCH genérico/status y `InterestSelect` cuando interest=`ACCEPTED` | `offerAt` existe, sin write productivo encontrado | No observada | Candidate sí | No |
| `REJECTED` | Rechazo terminal | Overview “Rechazado”; board/list “Descartado” si también interest rejected | “Rechazada” o “No seleccionado”, rosa/rojo; filtrable | status endpoints/actions, Kanban/selector, overview quick action | `rejectedAt` sí se escribe en varios flujos | Email diferido por cron si status y timestamp coinciden | Sí | Sí |
| `HIRED` | Contratación terminal | Overview “Contratado” | “Contratado”, verde; filtrable | PATCH genérico/status | `hiredAt` existe, sin write productivo encontrado | No observada | Candidate sí | Sí |

### `Application.recruiterInterest`

| Valor | Significado aparente | Recruiter-facing | Candidate-facing | Qué lo genera hoy | Timestamp | Notificación | Label/color y filtro | Terminal |
|---|---|---|---|---|---|---|---|---|
| `REVIEW` | Sin revisar / pendiente de decisión | “Por revisar”; overview “Sin revisar”; gris/ámbar | Nunca directamente | Default, selector, board | No dedicado | No | Sí, board/list/overview | No |
| `MAYBE` | Mezcla de preselección y duda | “Preselecto”; overview “En duda”; teal/celeste | Nunca directamente | Botón/select/board | No dedicado | No | Sí | No; tampoco equivale de forma segura a HOLD |
| `ACCEPTED` | Mezcla de avance, entrevista y aceptación | “Entrevista”; overview “Aceptados”; sky/verde | Nunca directamente | Botón/select/board/quick action | No dedicado | No | Sí | No; no significa `HIRED` |
| `REJECTED` | Descartado por recruiter | “Descartado”, rojo | Nunca directamente; candidate depende de status | Botón/select/board/quick action | No dedicado; algunos flujos también escriben `rejectedAt` | Sólo si el status también quedó `REJECTED` | Sí | Pretende ser terminal, pero por sí solo no lo garantiza |

Las columnas de color describen la evidencia UI, no una recomendación de diseño.

## Current Transition Graph

No existe un único grafo obligatorio. El grafo real es la unión de estos caminos:

```text
Creación
  -> status SUBMITTED + interest REVIEW

PATCH status / PATCH genérico / server action
  cualquier status -> cualquier ApplicationStatus

PATCH interest / CandidateReviewShell
  cualquier interest -> cualquier ApplicationInterest

Kanban
  interest REVIEW | MAYBE | ACCEPTED -> status REVIEWING
  interest REJECTED                  -> status REJECTED

InterestSelect (dos requests independientes)
  REVIEW | MAYBE -> status REVIEWING
  ACCEPTED       -> status OFFER
  REJECTED       -> status REJECTED

Overview quick action
  -> REVIEWING + ACCEPTED
  -> REJECTED  + REJECTED
```

Por tanto, el backend permite saltos hacia delante, hacia atrás, reapertura de terminales y cambios laterales sin razón. Tampoco hay control optimista: dos recruiters pueden sobrescribirse, y dos requests del selector pueden dejar sólo una mitad aplicada.

### Actores y superficies

| Transición | Actor autorizado hoy | Superficie | Validación desde estado actual | Efectos secundarios |
|---|---|---|---|---|
| status→status | recruiter/admin de la empresa | APIs y server actions | Ninguna | Sólo rechazo mantiene timestamp/flag en algunos writers |
| interest→interest | recruiter/admin de la empresa | API, Kanban, lista, review shell | Ninguna | En algunos UIs también cambia status con mapping distinto |
| apply | candidate | POST application | Unicidad candidate+job | Emails/notificación de nueva aplicación |
| assessment lifecycle | recruiter/candidate/system | invite/start/answer/submit | Reglas propias de assessment | No cambia pipeline |
| rejection communication | cron/system | cron | status y antigüedad de `rejectedAt` | Email y flag enviado |

## Divergence Analysis

### Por qué divergen

1. Board y tabla leen `recruiterInterest`; candidate lee `status`.
2. Hay endpoints independientes para ambos campos.
3. `InterestSelect` sincroniza con dos requests no atómicos.
4. Kanban y `InterestSelect` usan mappings diferentes para `ACCEPTED`.
5. Los writers genéricos sólo cambian status.
6. CandidateReviewShell sólo cambia interest.

### Traducciones visibles actuales

| Interest recruiter | Recruiter ve | Status candidate | Candidate ve |
|---|---|---|---|
| `REVIEW` | Por revisar / Sin revisar | `SUBMITTED` | Enviada |
| `MAYBE` | Preselecto / En duda | `REVIEWING` | En revisión |
| `ACCEPTED` | Entrevista / Aceptados | `INTERVIEW` | Entrevista |
| `REJECTED` | Descartado | `OFFER` | Oferta |
| — | — | `REJECTED` | Rechazada / No seleccionado |
| — | — | `HIRED` | Contratado |

Esta tabla no implica equivalencia por fila: ilustra que cada audiencia usa un vocabulario y una fuente diferentes.

## Production/Data Distribution (if safely available)

La base configurada **no pudo consultarse de forma segura**. Se intentaron exclusivamente agregados `SELECT` sin PII para `status`, `recruiterInterest`, sus combinaciones y cobertura de timestamps; Prisma no pudo abrir la conexión TLS en este host (`No hay credenciales disponibles en el paquete de seguridad`). No se relajó TLS, no se instaló otro cliente y no se ejecutó ningún write.

En consecuencia:

- no se afirma ninguna distribución real;
- no hay cifra de registros ambiguos de producción;
- el reporte read-only debe ejecutarse antes de aprobar el backfill;
- los cuatro pares únicos del seed demo (`SUBMITTED+REVIEW`, `SUBMITTED+MAYBE`, `REVIEWING+ACCEPTED`, `INTERVIEW+ACCEPTED`) son fixtures, no evidencia de producción.

Los campos son no-null en el schema actual, por lo que NULL no debería aplicar a status/interest si producción está sincronizada; el reporte debe verificarlo mediante SQL, no asumirlo.

## Canonical Concepts

- **Stage:** posición actual de la candidatura dentro del proceso de contratación.
- **Disposition:** condición operacional o resultado de la candidatura, separada del avance.
- **Decision:** acción humana auditable que explica un cambio de stage/disposition; se registra como evento con actor y razón, no como otro snapshot.
- **Current state:** `Application.stage` + `Application.disposition`, optimizado para operar y filtrar.
- **History:** secuencia append-only de `ApplicationEvent`, autoridad para timeline, auditoría y métricas desde instrumentación.

Invariantes:

1. `CLOSED` sólo se combina con una disposition terminal.
2. Una disposition terminal exige `CLOSED`.
3. `HOLD` conserva la stage en la que se pausó; no es progreso.
4. Ningún evento histórico se edita para “corregir” el pasado; una corrección es otro evento.
5. Snapshot y evento se escriben en la misma transacción.

## Proposed Stage Model

`APPLIED | REVIEW | ASSESSMENT | INTERVIEW | OFFER | CLOSED`

| Stage | Significado | Entrada típica | Salida típica | Candidate la ve | Label candidate | ¿Puede volver atrás? |
|---|---|---|---|---|---|---|
| `APPLIED` | Aplicación recibida, sin revisión humana demostrada | `application_created` | Primera revisión o cierre | Sí | Postulación recibida | Normalmente no; import/corrección con warning |
| `REVIEW` | Recruiter está evaluando perfil/evidencia o formando shortlist | Primera revisión, retorno desde assessment/interview | Assessment, entrevista, oferta excepcional o cierre | Sí | Revisando perfil | Sí, con razón; no borra historia |
| `ASSESSMENT` | Existe evaluación técnica activa o bajo revisión como siguiente paso principal | Invite requerida/enviada | Review, interview u offer/cierre | Sí según subestado | Acción requerida o Evaluación | Sí, con razón; repetir attempt no cambia stage |
| `INTERVIEW` | Una o más entrevistas están en coordinación o curso | Avance desde review/assessment | Otra entrevista sin cambio de stage, offer, review o cierre | Sí | Entrevista | Sí, con warning y razón |
| `OFFER` | Oferta/final decision está en preparación o comunicada | Desde review/interview | Closed o retorno excepcional | Sí de forma conservadora | Decisión | Sí, con warning y razón |
| `CLOSED` | El proceso individual terminó | Resultado terminal | Sólo reapertura explícita | Sí | Proceso cerrado | Sólo comando de reopen, permiso elevado y razón |

`ASSESSMENT` no intenta copiar todos los estados de invite/attempt. Esos subestados siguen perteneciendo al dominio assessment y determinan si el candidate ve “Acción requerida” o “Evaluación”. `INTERVIEW` tampoco se multiplica por rondas.

## Proposed Disposition Model

`ACTIVE | HOLD | REJECTED | WITHDRAWN | HIRED | CANCELLED`

| Disposition | Significado | Terminal | Bloquea acciones | Candidate la ve | Interacción con Stage |
|---|---|---:|---|---|---|
| `ACTIVE` | El proceso continúa normalmente | No | No | No como progreso separado | Requerida en toda stage no cerrada salvo hold |
| `HOLD` | Pausa deliberada sin decisión final | No | Bloquea avance automático y SLA operativo; permite reanudar/cerrar | No se anuncia como avance; sólo mensaje neutral si policy lo decide | Conserva `APPLIED`…`OFFER`; nunca `CLOSED` |
| `REJECTED` | La empresa decidió no continuar | Sí | Sí, salvo reapertura explícita | Sí, cierre comunicado | Sólo con `CLOSED` |
| `WITHDRAWN` | Candidate decidió salir | Sí | Sí, salvo reapertura explícita iniciada/aceptada por candidate | Sí | Sólo con `CLOSED` |
| `HIRED` | Candidate fue contratado para el proceso | Sí | Sí | Sí | Sólo con `CLOSED` |
| `CANCELLED` | La empresa cerró/canceló vacante o proceso sin decisión negativa individual | Sí | Sí, salvo reapertura | Sí como cierre operativo, sin fingir rechazo | Sólo con `CLOSED` |

No se recomienda mapear `MAYBE` automáticamente a `HOLD`: “Preselecto/En duda” no demuestra que el proceso esté pausado.

## Human Decision Model

Una decisión humana es el comando confirmado que cambia stage/disposition o registra un outcome. Debe conservar:

- actor y rol;
- estado anterior y nuevo;
- razón estructurada opcional/obligatoria según transición;
- timestamp del hecho;
- visibility/communication policy;
- idempotency key cuando pueda reintentarse.

No se crea `CandidateDecision` en V1. El snapshot canónico responde el estado presente y el evento responde quién decidió qué y cuándo. Si en el futuro existe aprobación múltiple, comité o decisión pendiente con lifecycle propio, entonces se reevalúa una entidad separada.

## Candidate-Facing Mapping

El mapping candidate es una proyección allowlisted; nunca muestra enums internos, notas, scoring ni razones privadas.

| Canonical state / condición | Candidate ve | Regla para no inventar progreso |
|---|---|---|
| `APPLIED + ACTIVE/HOLD` | **Postulación recibida** | HOLD no cambia el mensaje a “avanzaste” |
| `REVIEW + ACTIVE/HOLD` | **Revisando perfil** | No promete deadline ni shortlist |
| `ASSESSMENT` con acción pendiente del candidate | **Acción requerida** | CTA, deadline y soporte provienen del invite real |
| `ASSESSMENT` iniciado/completado, sin acción candidate | **Evaluación** | Puede decir “recibida/en revisión” sólo si el attempt lo demuestra |
| `INTERVIEW + ACTIVE/HOLD` | **Entrevista** | Fecha sólo si existe entrevista confirmada |
| `OFFER + ACTIVE/HOLD` | **Decisión** | No dice “Oferta” hasta que `offer_sent` sea candidate-visible |
| `CLOSED + REJECTED` | **Proceso cerrado** | Cierre explícito; razón pública sólo si policy la permite |
| `CLOSED + WITHDRAWN` | **Proceso cerrado** | Reconoce retiro sin lenguaje de rechazo |
| `CLOSED + HIRED` | **Proceso cerrado** | Puede mostrar contratación confirmada |
| `CLOSED + CANCELLED` | **Proceso cerrado** | Explica cierre de proceso/vacante, no rechazo personal |

La última actualización candidate debe derivarse del último evento `CANDIDATE` o `BOTH`, no de un evento interno que revelaría actividad oculta.

## Scenario Validation

| # | Escenario | Estado/evento recomendado | Observación |
|---:|---|---|---|
| 1 | Acaba de aplicar | `APPLIED + ACTIVE`; `application_created` | Baseline |
| 2 | Recruiter revisa CV sin decidir | `REVIEW + ACTIVE`; stage change/first review | Permite time-to-first-review |
| 3 | Interesante, aún sin entrevista | `REVIEW + ACTIVE`; decisión/nota interna opcional | No requiere stage “SHORTLIST” |
| 4 | Envía assessment | `ASSESSMENT + ACTIVE`; `assessment_invited` | Invite manda el CTA |
| 5 | Assessment pendiente | Igual | Subestado del invite, no otra stage |
| 6 | Terminó y se revisan resultados | `ASSESSMENT + ACTIVE`; `assessment_completed` | No avanzar por completar automáticamente |
| 7 | Agenda entrevista | `INTERVIEW + ACTIVE`; `interview_created` | Visible sólo al confirmar |
| 8 | Segunda entrevista | Sigue `INTERVIEW`; nuevo `interview_created` | No stage por ronda |
| 9 | Prepara oferta | `OFFER + ACTIVE`; `offer_created` INTERNAL | Candidate ve “Decisión”, no oferta aún |
| 10 | Oferta enviada | Sigue `OFFER`; `offer_sent` BOTH | Nuevo evento mínimo necesario para distinguir draft/envío |
| 11 | Candidate rechaza oferta | `CLOSED + WITHDRAWN`; `candidate_withdrew`, reason `OFFER_DECLINED` | No confundir con rejection empresa |
| 12 | Empresa rechaza candidate | `CLOSED + REJECTED`; `candidate_rejected` | Comunicación terminal |
| 13 | Candidate se retira | `CLOSED + WITHDRAWN`; `candidate_withdrew` | Candidate actor cuando aplique |
| 14 | Contratado | `CLOSED + HIRED`; `candidate_hired` | Terminal |
| 15 | Proceso pausado | Stage actual + `HOLD`; disposition change | No progreso candidate |
| 16 | Candidate en hold | Stage actual + `HOLD` | Reanudar vuelve a ACTIVE misma stage |
| 17 | Empresa cierra vacante con activos | `CLOSED + CANCELLED`; `process_closed` por aplicación | Bulk idempotente y comunicación |
| 18 | Movimiento accidental hacia atrás | Backward transition con warning, razón y evento correctivo | Nunca borra el movimiento anterior |
| 19 | Repite assessment | Sigue `ASSESSMENT`; eventos por invite/attempt | Sin stage adicional |
| 20 | Aplicación importada | Stage/disposition explícitos + `legacy_state_imported`/`application_imported` | No inventar pasos previos |

Los veinte escenarios caben en seis stages. La única ampliación necesaria frente al plan inicial está en disposition (`CANCELLED`), no en stages.

## ApplicationEvent Design

`ApplicationEvent` es append-only a nivel de dominio: no ofrece update/delete ordinario. Correcciones y redacciones se modelan explícitamente; la retención legal/privacidad requiere una policy separada.

| Campo evaluado | ¿V1? | Por qué existe / consulta habilitada | ¿Puede derivarse? |
|---|---:|---|---|
| `id` | Sí | Identidad estable, cursor y orden de desempate | No |
| `type` | Sí | Timeline, policy y agregación por hecho | No |
| `applicationId` | Sí | Une historia con current state | No |
| `candidateId` | No inicialmente | Funnel/cohortes candidate; sería útil si se elimina Application | Sí desde Application; añadir sólo con policy de retención aprobada |
| `jobId` | No inicialmente | Métricas directas por vacante | Sí desde Application→Job; indexar joins antes de duplicar |
| `companyId` | Sí | Aislamiento tenant e índices de auditoría | Derivable, pero conviene fijarlo para autorización/retención; validar contra Application al escribir |
| `actorType` | Sí | Distingue `CANDIDATE`, `RECRUITER`, `ADMIN`, `SYSTEM`, `IMPORT` | No |
| `actorId` | Sí, nullable | Auditoría humana; null para system/import sin usuario | No de forma segura |
| `fromStage`, `toStage` | Sí, nullable | Tiempo/transiciones sin interpretar metadata | Sólo leyendo eventos vecinos, frágil; mantener explícitos en stage events |
| `fromDisposition`, `toDisposition` | Sí, nullable | Historia de hold/terminal/reopen | Igual; mantener explícitos en disposition events |
| `visibility` | Sí | Allowlist candidate y auditoría de comunicación | No debe inferirse sólo al leer; default por tipo, persistido al crear |
| `reasonCode` | Sí, nullable | Razones agregables sin exponer texto | No; catálogo pequeño y versionable |
| `metadata` | Sí, mínima | IDs/referencias y versión de payload por tipo | Parte puede derivarse, pero preserva contexto; nunca CV/respuestas/notas completas |
| `happenedAt` | Sí | Momento de negocio, imports y SLA | No siempre igual al insert |
| `recordedAt` | Sí | Latencia, auditoría y orden técnico | Default DB |
| `idempotencyKey` | Sí, nullable y unique por company/tipo | Reintentos, bulk closure y consumers sin duplicados | No |

Se recomienda además una `stateVersion` en `Application`, no en el evento, para control optimista de concurrencia. No es información de negocio.

## V1 Event Types

### Domain events mínimos

| Evento | Cuándo se emite | Metadata mínima |
|---|---|---|
| `application_created` | Se crea la postulación | source/UTM permitida, referencia de snapshot CV |
| `application_stage_changed` | Cambia stage | reason/version del comando; from/to en columnas |
| `application_disposition_changed` | Cambia disposition | reason; from/to en columnas |
| `assessment_invited` | Invite de contratación confirmado | inviteId/templateId/deadline/required, sin respuestas |
| `assessment_started` | Primer inicio del attempt | attemptId/templateVersion |
| `assessment_completed` | Submit aceptado | attemptId/duration; resultado sólo si policy lo permite |
| `interview_created` | Entrevista confirmada | interviewRef/fecha/canal no sensible |
| `offer_created` | Draft/aprobación interna | referencia no sensible |
| `offer_sent` | Oferta efectivamente comunicada | referencia/canal, sin términos sensibles |
| `candidate_rejected` | Decisión empresa | reasonCode interno y flag de comunicación, no nota libre candidate |
| `candidate_withdrew` | Retiro/declinación candidate | reasonCode opcional |
| `candidate_hired` | Contratación confirmada | effectiveDate opcional |
| `process_closed` | Cierre/cancelación administrativa | outcome/reasonCode |
| `legacy_state_imported` | Baseline de migración/import | status/interest originales, mapping class y coverage version |

Los eventos específicos de outcome pueden convivir con `application_disposition_changed` dentro del mismo comando sólo si cada uno tiene una función clara: disposition registra el cambio genérico y el evento outcome expresa el hecho/comunicación. Si analytics no necesita ambos, el evento específico puede ser el único domain event con from/to. La implementación debe decidir una convención y evitar doble conteo.

### Analytics event, no ledger de dominio

`application_viewed` repetido es clickstream y no debe llenar `ApplicationEvent`. V1 necesita como máximo `application_first_reviewed` como domain event derivado del primer cambio a `REVIEW`, o un evento analytics separado, deduplicado por application. Vistas posteriores pertenecen a telemetría/analytics de producto.

`assessment_answer_saved`, fallos y recovery también son telemetría del subsistema de integridad, no eventos del hiring ledger salvo que cambien el proceso.

## Event Visibility

Persistir visibility no sustituye la allowlist del reader candidate. El reader debe exigir `(visibility = CANDIDATE OR BOTH)` **y** serializar campos permitidos por tipo.

| Event type | Default | Candidate notification potencial | Nota de seguridad |
|---|---|---|---|
| `application_created` | `BOTH` | Sí/confirmación | Sin UTM interna en payload candidate |
| `application_stage_changed` | `INTERNAL` | No directamente | La proyección candidate cambia; evento bruto no se expone por default |
| `application_disposition_changed` | `INTERNAL` | No directamente | Outcomes públicos usan evento específico |
| `assessment_invited` | `BOTH` | Sí, acción requerida | Sin scoring/integrity raw |
| `assessment_started` | `BOTH` | No | Candidate conoce su propia acción |
| `assessment_completed` | `BOTH` | Opcional | Resultado se filtra por policy separada |
| `interview_created` | `BOTH` al confirmar | Sí | Drafts siguen internos |
| `offer_created` | `INTERNAL` | No | No revelar preparación |
| `offer_sent` | `BOTH` | Sí | Sin términos en metadata genérica |
| `candidate_rejected` | `BOTH` | Sí | Razón pública separada de reasonCode/nota interna |
| `candidate_withdrew` | `BOTH` | Confirmación | No revelar reason interno si no fue aportado por candidate |
| `candidate_hired` | `BOTH` | Sí | Fecha según policy |
| `process_closed` | `BOTH` | Sí | Copy neutral para CANCELLED |
| `legacy_state_imported` | `INTERNAL` | No | Contiene valores legacy y confidence |
| `application_first_reviewed` | `INTERNAL` | No | No prometer avance por una vista |

`CANDIDATE` queda disponible para eventos originados por candidate que no deban generar contenido interno adicional; en la práctica, la mayoría de hechos compartidos son `BOTH`. No debe usarse para ocultar al recruiter una acción del proceso.

## Transition Command

Contrato conceptual:

```ts
transitionApplication({
  applicationId,
  targetStage?,
  targetDisposition?,
  expectedVersion,
  actor,
  reasonCode?,
  publicMessageIntent?,
  idempotencyKey?,
  happenedAt?
})
```

Responsabilidades, en orden:

1. cargar Application, Job y Company dentro de la transacción;
2. autorizar actor, tenant y capacidad específica;
3. verificar `expectedVersion`/idempotency para evitar lost updates;
4. normalizar el target completo y validar invariantes/transición;
5. exigir razón/confirmación para warnings, terminales y reopen;
6. actualizar stage/disposition y timestamps snapshot que se decida conservar;
7. insertar evento(s) con from/to, actor, visibility y hora en la misma transacción;
8. durante rollout, calcular y escribir status/interest legacy desde una única función;
9. crear un outbox/intent de notificación en la misma transacción cuando corresponda; el envío externo ocurre después y es idempotente;
10. retornar current state, event y policy outcome.

Ninguna UI o endpoint debe escribir directamente campos canónicos o legacy. Los eventos de assessment invocan un comando de proceso o un publisher transaccional equivalente después de validar su propio dominio.

## Transition Rules

### Clasificación

| Transición | Clase | Condición |
|---|---|---|
| `APPLIED → REVIEW` | VALID | Primera revisión humana |
| `REVIEW → ASSESSMENT` | VALID | Invite/policy existente |
| `REVIEW → INTERVIEW` | VALID | Assessment opcional |
| `ASSESSMENT → REVIEW` | VALID | Revisión de resultados |
| `ASSESSMENT → INTERVIEW` | VALID | Evidencia suficiente |
| `INTERVIEW → OFFER` | VALID | Decisión humana |
| misma stage + nuevo evento de assessment/interview | VALID | Repetición/ronda; no muta stage |
| cualquier nonterminal `ACTIVE ↔ HOLD` | VALID | Requiere reason para HOLD; resume conserva stage |
| cualquier nonterminal → `CLOSED + REJECTED/WITHDRAWN/HIRED/CANCELLED` | VALID | Actor y reason/outcome autorizados |
| saltar una o más stages hacia delante | VALID WITH WARNING | Realidad operativa/import/direct hire; razón obligatoria |
| volver a una stage anterior no terminal | VALID WITH WARNING | Razón obligatoria; conserva eventos |
| `OFFER → REVIEW/INTERVIEW` | VALID WITH WARNING | Oferta pausada/retirada; no borrar offer event |
| terminal → nonterminal | VALID WITH WARNING, comando especial | `reopenApplication`, permiso elevado, razón y comunicación policy |
| nonterminal + disposition terminal | INVALID | Debe cambiar stage a `CLOSED` atómicamente |
| `CLOSED + ACTIVE/HOLD` | INVALID | Contradice cierre |
| `CLOSED` sin outcome terminal | INVALID | Outcome obligatorio |
| cambiar `HIRED` directamente a `REJECTED` | INVALID en comando normal | Requiere reapertura/corrección explícita, no overwrite |
| transition sin tenant/permiso o expectedVersion stale | INVALID | 403/409 sin cambios parciales |

Las reglas deliberadamente permiten saltos reales; el warning crea fricción y auditoría, no un workflow rígido.

## Legacy Mapping Matrix

La matriz cubre las 24 combinaciones posibles (6 status × 4 interests). La columna “Vista actual” es `recruiter / candidate`. “Manual” significa que el backfill no debe escribir estado canónico definitivo sin reconciliación.

| Current status | Current interest | Vista actual | Proposed stage | Proposed disposition | Confidence | Auto migration | Manual |
|---|---|---|---|---|---|---:|---:|
| `SUBMITTED` | `REVIEW` | Por revisar / Enviada | `APPLIED` | `ACTIVE` | SAFE AUTO-MAP | Sí | No |
| `SUBMITTED` | `MAYBE` | Preselecto / Enviada | `REVIEW` | `ACTIVE` | LIKELY BUT REVIEW | No | Sí |
| `SUBMITTED` | `ACCEPTED` | Entrevista / Enviada | — | — | AMBIGUOUS: review, interview u offer | No | Sí |
| `SUBMITTED` | `REJECTED` | Descartado / Enviada | — | — | CONTRADICTORY | No | Sí |
| `REVIEWING` | `REVIEW` | Por revisar / En revisión | `REVIEW` | `ACTIVE` | SAFE AUTO-MAP | Sí | No |
| `REVIEWING` | `MAYBE` | Preselecto / En revisión | `REVIEW` | `ACTIVE` | SAFE AUTO-MAP; conservar legacy en baseline | Sí | No |
| `REVIEWING` | `ACCEPTED` | Entrevista / En revisión | — | — | AMBIGUOUS: Kanban produce este par para entrevista | No | Sí |
| `REVIEWING` | `REJECTED` | Descartado / En revisión | — | — | CONTRADICTORY | No | Sí |
| `INTERVIEW` | `REVIEW` | Por revisar / Entrevista | `INTERVIEW` | `ACTIVE` | LIKELY BUT REVIEW | No | Sí |
| `INTERVIEW` | `MAYBE` | Preselecto / Entrevista | — | — | AMBIGUOUS: activo vs hold/stale | No | Sí |
| `INTERVIEW` | `ACCEPTED` | Entrevista / Entrevista | `INTERVIEW` | `ACTIVE` | SAFE AUTO-MAP | Sí | No |
| `INTERVIEW` | `REJECTED` | Descartado / Entrevista | — | — | CONTRADICTORY | No | Sí |
| `OFFER` | `REVIEW` | Por revisar / Oferta | `OFFER` | `ACTIVE` | LIKELY BUT REVIEW | No | Sí |
| `OFFER` | `MAYBE` | Preselecto / Oferta | — | — | AMBIGUOUS: activo vs hold/stale | No | Sí |
| `OFFER` | `ACCEPTED` | Entrevista / Oferta | `OFFER` | `ACTIVE` | SAFE AUTO-MAP | Sí | No |
| `OFFER` | `REJECTED` | Descartado / Oferta | — | — | CONTRADICTORY | No | Sí |
| `REJECTED` | `REVIEW` | Por revisar / Rechazada | — | — | CONTRADICTORY | No | Sí |
| `REJECTED` | `MAYBE` | Preselecto / Rechazada | — | — | CONTRADICTORY | No | Sí |
| `REJECTED` | `ACCEPTED` | Entrevista / Rechazada | — | — | CONTRADICTORY | No | Sí |
| `REJECTED` | `REJECTED` | Descartado / Rechazada | `CLOSED` | `REJECTED` | SAFE AUTO-MAP | Sí | No |
| `HIRED` | `REVIEW` | Por revisar / Contratado | `CLOSED` | `HIRED` | LIKELY BUT REVIEW: terminal status parece más fuerte | No | Sí |
| `HIRED` | `MAYBE` | Preselecto / Contratado | `CLOSED` | `HIRED` | LIKELY BUT REVIEW: interest stale probable | No | Sí |
| `HIRED` | `ACCEPTED` | Entrevista / Contratado | `CLOSED` | `HIRED` | SAFE AUTO-MAP | Sí | No |
| `HIRED` | `REJECTED` | Descartado / Contratado | — | — | CONTRADICTORY | No | Sí |

Resumen de la matriz:

- 7 `SAFE AUTO-MAP`;
- 5 `LIKELY BUT REVIEW`;
- 4 `AMBIGUOUS`;
- 8 `CONTRADICTORY`;
- 12 de 24 requieren reconciliación por ambigüedad/contradicción; si se adopta una política conservadora, las 5 “likely” también pasan por revisión o reglas de evidencia explícitas.

## Ambiguous Records

El reporte previo al backfill debe producir únicamente conteos y claves técnicas restringidas para el equipo de reconciliación; el resumen compartido no contiene PII.

Campos mínimos del reporte:

- status e interest actuales;
- categoría/confidence y razón;
- presencia de timestamps relevantes;
- último writer conocido si hay audit técnico;
- assessment/interview/offer relacionados como evidencia, sin respuestas ni scoring;
- propuesta sólo cuando sea determinista;
- total por company/job y total global.

Reglas:

1. `AMBIGUOUS` y `CONTRADICTORY` nunca se auto-corrigen.
2. `LIKELY BUT REVIEW` sólo puede automatizarse si Alejandro aprueba una regla adicional basada en evidencia verificable.
3. Ningún timestamp por sí solo crea una secuencia histórica.
4. Una resolución manual crea `legacy_state_imported` con mapping version y actor/import batch; no eventos retroactivos de cada stage.
5. No hay cantidad de registros reales disponible porque la consulta TLS no fue posible de forma segura.

## Backfill Strategy

1. Congelar y versionar el mapping aprobado.
2. Desplegar campos canónicos nullable y ledger sin cambiar readers.
3. Ejecutar un **dry-run read-only** que distribuya las 24 combinaciones, NULLs, timestamps y evidence hints.
4. Auto-mapear sólo `SAFE AUTO-MAP` mediante job idempotente y lotes pequeños.
5. Crear exactamente un `legacy_state_imported` por Application, con `happenedAt` igual al momento de importación salvo timestamp de creación demostrable; `recordedAt` es el insert.
6. Enviar `LIKELY`, `AMBIGUOUS` y `CONTRADICTORY` a reporte de reconciliación; no mostrarles progreso canónico nuevo hasta resolver o aplicar una policy explícita de fallback.
7. Verificar conteos antes/después: ninguna Application perdida, una sola baseline por migrada, invariantes válidas.
8. Definir `coverageStartedAt` global y por métrica como la fecha en que todos los writers relevantes emiten eventos.

### Timestamps confiables para baseline

- `submittedAt`: utilizable como fecha de aplicación cuando no sea null y sea coherente con `createdAt`.
- `rejectedAt`: utilizable como snapshot de rechazo sólo si status=`REJECTED` y el writer/cron es consistente; no reconstruye etapas previas.
- `reviewingAt`, `interviewAt`, `offerAt`, `hiredAt`, `lastViewedAt`: no usar para inventar eventos hasta medir cobertura y procedencia; el inventario no encontró writers productivos uniformes.
- `updatedAt`: nunca equivale automáticamente a cambio de pipeline.

## Dual-Write Rollout

| Fase | Writers | Readers | Control |
|---|---|---|---|
| A — Additive | Legacy sigue autoridad; schema/eventos disponibles | Legacy | Feature flags off; no cambio usuario |
| B — Shadow command | Comando calcula canonical + legacy y evento; sólo superficies piloto lo usan | Legacy | Comparar resultado calculado, atomicidad e idempotencia |
| C — All writers | Todas las mutaciones pasan por comando y dual-write | Legacy por defecto; canonical shadow | Métrica de direct writes/divergencia debe llegar a cero |
| D — Reader migration | Igual | Internos primero, candidate después mediante allowlist | Comparación board/list/status candidate |
| E — Canonical authority | Canonical→legacy projection solamente | Canonical | Alertas por drift; bloquear writers directos |
| F — Stop legacy writes | Sólo canonical/event | Canonical | Ventana de estabilidad y rollback lógico |
| G — Cleanup futuro | Eliminar legacy/timestamps decididos | Canonical | Migration destructiva separada, no V1 inicial |

Feature flags recomendadas: canonical write, canonical read recruiter, canonical read candidate y notification policy. No se recomienda un flag que permita dos writers autoritativos.

## Timestamp Strategy

| Campo actual | Decisión | Motivo |
|---|---|---|
| `createdAt` | KEEP | Auditoría técnica de fila |
| `submittedAt` | KEEP | Snapshot útil y baseline de application; alinear con `application_created` |
| `reviewingAt` | DERIVE FROM EVENTS; DEPRECATE LATER | Sin writer uniforme; first review se deriva del primer evento válido |
| `interviewAt` | DERIVE FROM EVENTS; DEPRECATE LATER | Varias rondas no caben en una columna |
| `offerAt` | DERIVE FROM EVENTS; DEPRECATE LATER | Debe distinguir created/sent |
| `hiredAt` | FIX WRITES durante compatibilidad; luego DERIVE/KEEP snapshot | Es outcome útil; elegir una sola autoridad |
| `rejectedAt` | FIX WRITES y KEEP temporal | Cron depende de él; después derive del outcome o conserve snapshot operacional |
| `rejectionEmailSent` | KEEP temporal; migrar a delivery/outbox | No es historia de pipeline |
| `lastViewedAt`, `viewCount` | FIX sólo si siguen siendo feature; no convertir cada view en domain event | Son agregados operacionales/analytics |
| `assignedAt` | KEEP snapshot operacional | Assignment no es stage; evento futuro si audit requerido |
| `starredAt` | KEEP snapshot UI | Favorito no es hiring history |
| `updatedAt` | KEEP técnico | No usar para time-in-stage |

Regla: no mantener columna timestamp y evento como dos autoridades independientes. Si una columna queda por performance/cron, se actualiza en el mismo comando y se considera proyección.

## Notification Policy

| Hecho | Candidate | Recruiter | Ninguna / condición |
|---|---|---|---|
| Application creada | Confirmación | Nueva candidatura | Idempotente |
| Primera revisión / stage interna REVIEW | No por default | No | Una vista no promete avance |
| HOLD/resume | No por default | Opcional al owner/assignee | No presentar HOLD como avance |
| Assessment invited | Sí, accionable | Confirmación/assignee opcional | Incluye deadline real |
| Assessment started | No | Opcional | Evitar ruido |
| Assessment completed | Confirmación candidate | Sí si requiere revisión | Resultado según policy aparte |
| Interview confirmed | Sí | Sí/participantes | Draft no notifica |
| Offer created | No | Opcional/aprobadores | INTERNAL |
| Offer sent | Sí | Confirmación | Comunicación explícita |
| Rejected | Sí, cierre | Confirmación/owner | Puede conservar delay aprobado, pero el evento nace al decidir y delivery es separado |
| Withdrawn | Confirmación | Sí | — |
| Hired | Sí | Sí | — |
| Process cancelled/closed | Sí | Sí/owner | Copy neutral y SLA |
| Backward/correction | Sólo si cambia una promesa ya comunicada | Sí | Policy evalúa impacto público |
| Reopen | Sí si proceso había sido comunicado como cerrado | Sí | Razón/permiso elevados |

Notificación se deriva del evento/policy, no del componente UI. La transacción registra un outbox/intención; no debe esperar al proveedor de email. El cron de rechazo debe evolucionar a delivery idempotente basado en evento/outbox, manteniendo temporalmente `rejectedAt` y `rejectionEmailSent`.

## Analytics Enabled

| Métrica | Cálculo con ledger | Cobertura |
|---|---|---|
| Time to first review | primer `application_stage_changed` a REVIEW o `application_first_reviewed` − `application_created` | Sólo aplicaciones instrumentadas; baseline legacy no prueba review |
| Time in stage | suma de intervalos entre stage events, cerrando con siguiente cambio/ahora | Desde instrumentación; soporta regresiones y reentradas |
| Assessment drop-off | invites → started → completed, por cohort/deadline/template version | Historial existente puede dar snapshot parcial; ledger confiable desde integración |
| Rejection rate | `CLOSED+REJECTED` / cohort elegible, por outcome event | Baseline puede dar stock; tasa temporal confiable desde coverage date |
| Offer rate | aplicaciones con `offer_sent` (o entrada OFFER, definición aprobada) / cohort | Debe aprobarse denominador y created vs sent |
| Hire rate | `candidate_hired` / cohort elegible | Desde ledger; baseline HIRED sólo stock |
| Closure SLA | `process_closed/candidate_*` comunicado − application/decision según SLA aprobado | Requiere delivery timestamp, no sólo state change |

Toda consulta debe mostrar `coverageStartedAt`, porcentaje de aplicaciones con evento baseline/instrumentación y exclusiones. No comparar jobs/templates/cohortes incompatibles como si fueran equivalentes.

## Migration Plan

### Migration 1 — additive foundation

- **Schema change:** enums Stage/Disposition/actor/visibility/type; `Application.stage` y `disposition` nullable; `stateVersion`; `ApplicationEvent`; constraints e índices seguros; idempotency uniqueness.
- **Backfill:** ninguno automático durante deploy; sólo dry-run/report.
- **Code writers:** comando canónico detrás de flag, inicialmente shadow/piloto; legacy projection centralizada.
- **Code readers:** sin cambio por default.
- **Tests:** modelo/invariantes, command atomicity, auth, idempotencia, concurrencia, serialization allowlist.
- **Observability:** command outcomes, drift, eventos por transition, fallos/outbox.
- **Rollback:** apagar flags y volver a legacy reads/writes; conservar columnas/eventos aditivos para análisis, sin borrarlos.

### Data reconciliation entre migrations

- Ejecutar reporte real read-only.
- Aprobar reglas y resolver manualmente outliers.
- Backfill idempotente de safe rows + baseline event.
- Migrar todos los writers y comprobar cero direct writes.
- Migrar readers recruiter y candidate por separado.

### Migration 2 — canonical enforcement

- **Schema change:** hacer stage/disposition non-null una vez cubierta toda Application; defaults para nuevas aplicaciones; CHECK/invariantes posibles e índices finales.
- **Backfill:** sólo filas reconciliadas restantes; migration falla si hay null/divergencia, no adivina.
- **Code writers:** command es la única vía; bloquear direct writes mediante arquitectura/tests y, si es viable, permisos/trigger guard.
- **Code readers:** canonical por default; legacy sólo comparación temporal.
- **Tests:** build/integration/end-to-end, report de drift, terminal/reopen y candidate visibility.
- **Observability:** alertas de divergence, missing event, notification delivery y stateVersion conflicts.
- **Rollback:** volver readers a legacy y relajar enforcement mediante migration correctiva si fuera imprescindible; no borrar eventos ni reescribir historia.

### Cleanup futuro, no contado como migration V1

Tras una ventana estable se puede retirar `recruiterInterest`, `status` y timestamps deprecados. Es destructivo, requiere backup/retención y aprobación aparte.

## Rollback Strategy

1. Flags permiten volver a legacy readers sin rollback de datos.
2. Mientras dual-write esté activo, legacy sigue proyectado desde el comando y puede sostener UI anterior.
3. Si falla event insert, falla toda la transición; nunca aceptar snapshot sin evento.
4. Si falla envío externo, current state/event permanecen y outbox reintenta; no se revierte la decisión humana.
5. No se eliminan eventos durante rollback.
6. Un mapping equivocado se corrige con evento/reconciliación explícita, no UPDATE retroactivo del ledger.
7. La Migration 2 sólo se aplica con preflight de cero nulls, cero combinaciones sin resolución y cero writers directos observados.

## Test Plan

| Área | Casos mínimos |
|---|---|
| Allowed transitions | Caminos normales, skips aprobados, hold/resume, repeated assessment/interview |
| Invalid transitions | CLOSED+ACTIVE, terminal sin CLOSED, transición stale, actor/tenant incorrecto |
| Warning transitions | Backward, skip, offer rollback, reopen con razón/permiso |
| Atomicity | Snapshot+event+outbox juntos; fallo de evento revierte snapshot |
| Permission | Candidate/recruiter/admin/system/import; aislamiento company; job ownership actual |
| Visibility | INTERNAL jamás aparece en candidate; serializer redacciona metadata incluso con BOTH |
| Idempotency | Mismo key devuelve mismo resultado; key distinto no duplica por retry accidental |
| Concurrency | Dos recruiters con misma version: uno gana, otro 409; sin lost update |
| Notifications | Policy por outcome, delay rejection, retry delivery, sin doble email |
| Legacy dual-write | Cada target canónico produce status/interest esperado; un único mapping compartido |
| Divergence report | Las 24 combinaciones clasificadas; ambiguas/contradictorias no se escriben |
| Backfill | Repeat-safe, un baseline por Application, conteos antes/después, batches recuperables |
| Terminal states | reject/withdraw/hire/cancel, bulk job close, reopen/correction |
| Assessment integration | Invite/start/complete no duplican stage; repeat attempt conserva ASSESSMENT |
| Candidate mapping | Máximo seis categorías, no revela hold/notas/reasonCode/scoring |
| Analytics | Reentradas de stage, coverage date, eventos faltantes y denominadores documentados |
| Writer inventory | Test/lint arquitectónico que impida nuevos updates directos a campos de proceso |

Los tests actuales de applications que usan `PENDING`/`ACCEPTED` como status deben corregirse al implementar; hoy son señal de drift, no especificación.

## Risks

1. **Backfill silenciosamente incorrecto.** `ACCEPTED` puede significar review, interview u offer y 12/24 combinaciones son ambiguas o contradictorias. Mitigación: reporte, auto-map sólo de 7 pares seguros, baseline import y revisión.
2. **Escritores ocultos o no atómicos mantienen dos verdades.** Hay APIs, actions, Kanban, selector y shell con reglas distintas. Mitigación: comando único, inventory gate, dual-write sólo desde él, stateVersion y observabilidad de drift.
3. **Exposición/communication incorrecta al candidate.** Eventos internos, hold, offer draft, reasons o scoring podrían filtrarse; terminales podrían no comunicarse. Mitigación: allowlist por tipo + visibility persistida + DTO redacted + outbox/policy testeada.
4. **Historia y métricas falsas.** Timestamps existentes no demuestran secuencia. Mitigación: coverage date explícita, no synthetic history, separar stock legacy de cohorts instrumentadas.
5. **Cierre masivo y concurrencia.** Job close, cron y recruiters pueden competir. Mitigación: bulk idempotente, optimistic locking y eventos/outbox transaccionales.
6. **Retención vs ledger append-only.** DELETE actual de Application y obligaciones de privacidad no están reconciliados. Mitigación: aprobar policy de borrado/anonymization antes de FK/onDelete definitivo.

## Open Decisions

Alejandro debe aprobar antes de escribir código:

1. enums finales: seis stages y la adición de `CANCELLED` a dispositions;
2. invariantes `CLOSED ↔ terminal disposition` y HOLD conservando stage;
3. que `recruiterInterest` sea compatibilidad temporal, no disposition, y se retire después;
4. mapping de las 24 combinaciones, especialmente los 7 auto-map, los 5 likely y el tratamiento manual de 12 ambiguas/contradictorias;
5. si `LIKELY BUT REVIEW` se revisa siempre o puede resolverse con evidencia objetiva aprobada;
6. reglas de skip/backward/reopen, permisos y razones obligatorias;
7. que cerrar una vacante aplique `CLOSED+CANCELLED` a candidaturas activas y genere comunicación;
8. policy candidate: offer draft vs sent, cierre obligatorio, razones públicas y SLA/delay de rechazo;
9. convención de eventos: evento genérico + outcome específico o sólo outcome con from/to, para evitar doble conteo;
10. retención/anonymization del ledger y qué ocurre al borrar Application/candidate/job;
11. campos desnormalizados: recomendación V1 `applicationId+companyId`, derivando candidate/job;
12. fecha de inicio/cobertura de analytics y que no habrá reconstrucción retroactiva;
13. dos migrations V1 y cleanup legacy destructivo como aprobación futura separada.

## Recommended Implementation Slices

### Slice 1 — Additive canonical foundation, sin cambiar UI

- Migration 1 con campos nullable, ledger, índices/idempotency y stateVersion.
- tipos/policies puros y comando transaccional detrás de flag off/shadow.
- reporte read-only de las 24 combinaciones y dry-run del mapping.
- tests de invariantes, auth, atomicidad, idempotencia, concurrencia y visibility.
- cero backfill automático, cero reader migration, cero eliminación legacy.

**Exit:** reporte real revisable, command demuestra snapshot+event atómicos y ninguna experiencia cambia.

### Slice 2 — One writer pilot + dual-write

- migrar una sola superficie controlada al comando;
- proyectar canonical→legacy en la misma transacción;
- comparar resultados y alertar divergencia;
- mantener readers legacy.

### Slice 3 — All writers + safe backfill

- migrar APIs/actions/Kanban/list/shell;
- auto-map sólo SAFE y crear baselines;
- reconciliar manualmente el resto;
- llegar a cero direct writes.

### Slice 4 — Recruiter readers

- board/list/overview/CandidateReview usan stage/disposition;
- mismo query y labels;
- activity interna basada en eventos.

### Slice 5 — Candidate projection + notifications

- mapping allowlisted y timeline visible;
- outbox/policy de assessment/interview/offer/cierre;
- no exponer internal metadata.

### Slice 6 — Enforcement

- Migration 2 non-null/constraints/defaults;
- canonical read/write por default;
- coverage analytics activada desde fecha declarada.

### Slice futuro — Cleanup

- detener y luego eliminar `recruiterInterest`, status y timestamps deprecados tras ventana de estabilidad y aprobación destructiva independiente.
