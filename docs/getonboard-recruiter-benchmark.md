# Get on Board — Recruiter Product Benchmark

> Auditoría realizada el 28 de septiembre de 2026. Alcance: experiencia de empresa/reclutador. No se evaluó el portal del candidato, salvo cuando un dato del lado candidato afecta directamente una decisión o flujo del reclutador.

## Executive Summary

Get on Board no se comporta solamente como un ATS: combina marketplace de talento TI, publicación de vacantes, sourcing sobre una base propia, ATS colaborativo, analítica y una capa de IA. Su ventaja más difícil de replicar no es el Kanban, sino la unión entre audiencia, datos propios y workflow: vacante publicada → postulaciones → búsqueda de talento pasivo → evaluación → contacto → métricas.

La experiencia recruiter está organizada alrededor de cinco objetos: vacantes, procesos, profesionales, equipo y consumo del plan. Esa arquitectura es clara, aunque presenta dos costos de complejidad: varias capacidades se reparten entre dashboard, menú de usuario y configuración; y la monetización aparece en demasiados niveles (vacante bloqueada/desbloqueada, Pin, Boost, créditos de Talent Database, slots de Superpower, plan y reportes premium).

Para TaskIO, la lección principal no es construir otra bolsa de trabajo ni clonar Talent Database. El mayor espacio de diferenciación está en cerrar mejor el ciclo técnico: vacante → CV estructurado → assessment → ejecución de código → evidencia → score explicable → shortlist → entrevista. Get on Board es fuerte en adquisición de candidatos, screening inicial y colaboración; TaskIO ya tiene una base más profunda en evaluaciones técnicas, coding tests, anticheat, badges y resultados.

### Limitación de la auditoría

La pestaña recruiter facilitada (`/jobs/new`) redirigió a `/members/auth/login` y terminó en `ERR_TOO_MANY_REDIRECTS`. La única sesión autenticada funcional visible era la de profesional, que se excluyó del análisis por instrucción. Por lo tanto:

- **OBSERVADO**: interfaz visible en capturas oficiales actuales, página pública de precios, pantalla de error de la sesión y elementos que pudieron verificarse visualmente sin actuar.
- **DOCUMENTADO**: comportamiento descrito por el manual y centro de ayuda oficial de Get on Board.
- **REPO**: capacidades verificadas directamente en el código y esquema de TaskIO.
- **INFERIDO**: interpretación de producto basada en señales observadas/documentadas; nunca se presenta como hecho.

No se publicó ninguna vacante, no se envió ninguna invitación, no se desbloqueó ningún perfil, no se modificó configuración, no se generaron llaves ni se inició una compra.

## Information Architecture

La arquitectura recruiter documentada se organiza así:

```text
Empresa
├── Empleos
│   ├── Abiertos
│   ├── Pendientes de revisión/moderación
│   ├── Borradores / requieren cambios
│   └── Cerrados
├── Talent
│   ├── Talent Database
│   ├── Invitaciones
│   └── Postulantes / base propia de candidatos
├── Recursos de empleo
│   ├── Scorecards
│   └── Plantillas de mensajes
├── Insights Pro
├── Performance de empleos / Reportes
│   ├── Overview
│   ├── Descartes
│   └── Performance
├── Mi equipo
│   ├── Actividad
│   ├── Usuarios
│   └── Grupos
├── Plan y consumo
│   ├── Vacantes/slots
│   ├── Boosts/Pin
│   └── Contactos o créditos de Talent Database
└── Configuración
    ├── Información de empresa
    ├── Diseño de página de carreras
    ├── Notificaciones
    ├── Integraciones ATS
    ├── Slack
    ├── API
    ├── Webhooks
    ├── Suscripción
    ├── Facturas
    └── Métodos de pago
```

La captura oficial de “Magic Fill” confirma visualmente una barra lateral con Empleos, Talent Database, Insights Pro, Postulantes, Performance de empleos, Mi equipo, consumo del plan y Configuración. El [manual del dashboard](https://www.getonbrd.com/user-manual/jobs-dashboard) documenta además Invitaciones, Actividad, Scorecards y plantillas de mensajes.

## Recruiter Navigation Map

| Pantalla | Ruta/entrada verificable | Antes | Después / salidas | Evidencia |
|---|---|---|---|---|
| Dashboard de empleos | `/dashboard` | Login empresa | Vacante, crear empleo, acciones, reportes | DOCUMENTADO |
| Crear empleo | `/jobs/new` observado en la pestaña proporcionada | Dashboard / CTA | Moderación; luego proceso | OBSERVADO + DOCUMENTADO |
| Proceso ATS | Abrir una vacante desde Dashboard; URL privada no verificable | Vacante | Perfil, mensaje, fase, descarte, contratación | DOCUMENTADO |
| Talent Database | Menú Talent Database; URL privada no verificable | Sidebar | Perfil bloqueado/desbloqueado, invitación | DOCUMENTADO |
| Invitaciones | Menú Talent → Invitaciones | Sourcing / sugerencias / Boost | Estado de invitación y proceso | DOCUMENTADO |
| Postulantes | Menú Postulantes / My Applicants | Aplicaciones previas | Perfil y proceso de origen | DOCUMENTADO |
| Reportes | Menú Reports / Job Performance | Dashboard o vacante | Overview, Descartes, Performance, CSV | DOCUMENTADO |
| Mi equipo | Menú My team | Sidebar | Actividad, usuarios, grupos y acceso | DOCUMENTADO |
| Configuración | Sidebar y menú de usuario | Cuenta empresa | Empresa, página, integraciones, billing | DOCUMENTADO |
| Superpower AI | Dentro de creación, proceso y candidatura | Vacante con slot/AI activo | Resumen, match, filtros, quiz | DOCUMENTADO |
| Insights Pro | Sidebar | Cuenta/rol con acceso | Reportes salariales | DOCUMENTADO |

Hallazgo de IA: el producto divide correctamente el trabajo operativo (sidebar) de las opciones personales, billing e integraciones (menú de usuario), pero la misma “Configuración” aparece en ambas narrativas. Esto puede dificultar que un administrador prediga dónde vive cada ajuste.

## Dashboard

**Objetivo.** Dar una vista de procesos activos y llevar al recruiter a la vacante que necesita atención.

**DOCUMENTADO:**

- La vista inicial muestra por defecto empleos abiertos que el usuario sigue.
- Existen tabs/estados superiores para abiertos, pendientes de revisión, borradores, requieren cambios y cerrados.
- La tarjeta/menú de una vacante permite Boost, refrescar fecha, gestionar acceso, seguir, exportar CSV, borrar, cerrar, configurar emails, asignar scorecard e importar candidatos.
- Se mantiene visible el consumo del plan: vacantes/slots, invitaciones o contactos y Boosts.
- Una captura oficial reciente muestra además un control de “autodescartar empleos”, pero no fue posible verificar su comportamiento; se registra como OBSERVADO EN CAPTURA, no como capacidad confirmada.

**Fortalezas:**

- El dashboard modela el estado real de publicación y moderación, no solo “activo/inactivo”.
- Las acciones operativas están cerca de cada proceso.
- El seguimiento por usuario evita que cada recruiter reciba ruido de todas las vacantes.

**Fricciones:**

- El menú de acciones agrupa operaciones frecuentes, premium y destructivas en el mismo lugar.
- “Cerrar”, “despublicar”, “borrar”, “reabrir”, “re-lanzar”, “refrescar fecha”, Pin y Boost son conceptos cercanos que exigen aprendizaje.
- La selección por “vacantes que sigo” es útil para equipos grandes, pero puede ocultar procesos si no se explica el filtro activo.

## Jobs

### Lista y ciclo de vida

Get on Board distingue publicación, proceso y visibilidad comercial:

- Un proceso puede estar abierto pero no publicado.
- Un empleo pasa por moderación antes de publicarse.
- Cerrar archiva el proceso y puede notificar a postulantes.
- Despublicar afecta visibilidad sin equivaler necesariamente a cerrar.
- Reabrir conserva el proceso; relanzar/duplicar crea un ciclo nuevo.
- Pin/refresh mejoran posición; Boost agrega visibilidad e invitaciones automáticas.

Esto es más expresivo que un único enum de estado, pero también más difícil de explicar. TaskIO hoy usa `OPEN`, `PAUSED` y `CLOSED`; esa simplicidad es buena hasta que exista una operación editorial o campañas pagadas.

### Acciones visibles

| Acción | Valor | Riesgo o costo |
|---|---|---|
| Ver/editar empleo | Operación básica | Bajo |
| Abrir proceso | Gestionar pipeline | Bajo |
| Gestionar acceso | Confidencialidad y colaboración | Requiere permisos claros |
| Seguir / emails | Control de ruido | Puede fragmentar configuración |
| Exportar CSV | Portabilidad | Premium en ciertos planes |
| Importar candidato | Consolidar fuentes | Riesgo de duplicados/privacidad |
| Refresh / Pin | Mejorar visibilidad | Puede confundir orgánico con pagado |
| Boost | Alcance + invitaciones | Upsell y consumo |
| Cerrar / borrar | Finalizar | Borrar es irreversible |

## Create Job

### Flujo documentado de Get on Board

1. Introducir empresa y describir el puesto.
2. Elegir modalidad/ubicación.
3. Definir seniority, funciones, requisitos y salario bruto.
4. Agregar preguntas y solicitar información extra.
5. Agregar scorecards.
6. Revisar vista previa.
7. Enviar a moderación; no se publica instantáneamente.

Los tipos de pregunta documentados son texto abierto, opción múltiple y código fuente. Las preguntas de opción múltiple pueden tener puntaje; las preguntas abiertas o de código no se evalúan automáticamente. La recomendación oficial es no añadir más de tres preguntas extra para reducir abandono.

Superpower ofrece “Magic Fill”: el recruiter pega una descripción breve o completa y la IA estructura el anuncio. [Captura oficial de Magic Fill](https://d2dgum4gsvdsrq.cloudfront.net/assets/superpower/superpower-magic-fill-0c177e4ff1b5d597651d3cd41270f084ebde67a36f24b80941453bc1bf27fddf.png).

### Comparación inmediata con TaskIO

TaskIO tiene un wizard REPO de cinco pasos: Básicos, Prestaciones, Detalles, Evaluaciones y Revisión. Incluye ubicación estructurada, MXN/USD, salario exacto/rango/máximo, beneficios mexicanos, horarios, taxonomías, idiomas, educación, certificaciones, assessments, autosave local, plantillas/reuso, score de calidad, preview y generación/extracción con IA.

La ventaja de Get on Board está en moderación editorial y distribución. La ventaja de TaskIO está en la profundidad técnica del requisito y en asignar assessments reales durante la creación.

**Recomendación:** mantener el wizard TaskIO, pero añadir un “brief mínimo” previo que pueda generar un borrador completo. No esconder el formulario estructurado detrás de la IA; usarla como acelerador y mostrar exactamente qué campos cambió.

## Applicants / ATS

### Modelo de pipeline de Get on Board

El proceso tiene Board/Kanban y List (Beta). Las fases iniciales documentadas son:

1. Sugerencias e invitaciones.
2. Postulantes.
3. Descartados.
4. Seleccionados (ejemplo editable).
5. Contratados.
6. Fases personalizadas ilimitadas.

Las columnas se pueden crear, renombrar, mover, colapsar y borrar. Cada columna puede filtrar y enviar mensajes masivos. Las bulk actions actuales permiten mover, mensajear, descartar o invitar múltiples personas. Con Superpower existe una fase reservada “Selected by Superpower” para postulaciones con match de 80% o más mientras siguen en Applicants.

### Filtros

**Básicos:** leído/no leído, país, inglés, expectativa salarial USD/mes, promedio de scorecard, puntaje de respuestas, aplicaciones previas y presencia de CV/portfolio/LinkedIn/GitHub/GitLab.

**Smart filters (Superpower):** años de experiencia, skills/tecnologías, instituciones educativas, industrias, certificaciones e indicadores de trayectoria (universidad, bootcamp, voluntariado, becas, background no técnico, etc.).

### Colaboración y comunicación

- Mensajes uno a uno dentro de la candidatura.
- Mensajes masivos por fase con plantillas y token de personalización.
- Notas privadas visibles solo para el equipo con acceso.
- Scorecards con evaluaciones individuales y promedio de equipo.
- Activity log por usuario.
- Respuesta por email sincronizada con la conversación.
- Enlace público compartible de una aplicación para stakeholders sin cuenta.

### Fortalezas

- Fases personalizables y bulk actions resuelven volumen real.
- Board y List atienden dos modos mentales: flujo y escaneo/ordenamiento.
- Los filtros se apoyan en señales explícitas y en extracción IA.
- Separar scorecard humano, quiz automático y match IA evita presentar una única cifra como verdad.

### Fricciones

- Los filtros por columna pueden producir pipelines con criterios distintos entre fases y dificultar entender el conjunto.
- El Kanban se vuelve costoso con cientos de postulantes; List sigue etiquetado Beta.
- Mensaje, nota, actividad, scorecard, respuestas, CV y resumen IA compiten por atención dentro de la tarjeta.
- La automatización “Selected by Superpower” puede reforzar confianza excesiva en un umbral del 80%, aunque la documentación advierte que es una señal, no una decisión.
- Mover a Descartados requiere razón y la notificación no es automática; es seguro, pero añade una decisión en cada descarte.

### Comparación con TaskIO

TaskIO tiene dos vistas: Kanban y lista de postulantes. El pipeline visible se reduce a Por revisar, Preselecto, Entrevista y Descartado, mientras el modelo de datos contiene estados formales SUBMITTED, REVIEWING, INTERVIEW, OFFER, REJECTED y HIRED. Esta doble semántica (`recruiterInterest` frente a `status`) ya genera deuda conceptual. Antes de añadir fases personalizadas, TaskIO debería unificar qué significa etapa, estado legal y señal de interés.

TaskIO sí muestra match, skills, CV, teléfono/WhatsApp y badges de assessment en tarjetas, pero no tiene REPO evidencia de bulk actions, mensajería integrada, plantillas de mensajes, scorecards colaborativos o fases configurables.

## Candidate Profile

La candidatura de Get on Board prioriza una columna fija con identidad, rol, contacto, ubicación, señales detectadas por Superpower y acciones de mover/descartar/invitar/compartir. El panel principal usa tabs para Postulación, Actividad, Mensajes, Notas y Rúbricas. [Captura oficial de notas y ficha](https://d2dgum4gsvdsrq.cloudfront.net/assets/superpower/superpower-smart-notes-b4f6f49c97da7db02d78739f08f060a3d64037976517de852ec80d3a7bbf6f2b.png).

La documentación confirma:

- contacto y perfil profesional;
- experiencia y educación;
- respuestas de la postulación;
- actividad del candidato y del equipo;
- mensajes directos;
- notas privadas;
- scorecards;
- CV y links según disponibilidad/acceso;
- resumen, match y señales de Superpower cuando está habilitado.

**Jerarquía visual:** decisión primero, evidencia después. Las acciones de etapa permanecen cerca del nombre; la evidencia extensa se divide por tabs. Es eficaz para throughput, aunque el sidebar lateral deja menos ancho para CV y experiencia.

TaskIO ya implementa un shell de revisión comparable: lista lateral de candidatos, tabs Resumen IA/Perfil/CV/Evaluaciones, etapa, notas con autosave y actividad. Además muestra desglose de AI Match, skills faltantes/presentes, badges verificados, experiencia, educación, idiomas, salario deseado, LinkedIn/GitHub, WhatsApp y resultados de assessments.

El gap de TaskIO no es “tener perfil”; es convertir la evidencia técnica en una decisión compartible: score compuesto, razones, reviewer, timestamp, comparador de finalistas y entrevista.

## Talent Database

### Qué es

Talent Database es una base first-party de profesionales que aceptaron ser visibles. La página de precios declara 1.6 millones de candidatos opt-in. Buscar es accesible para cuentas empresa; revelar contacto/invitar consume créditos.

### Búsqueda y filtros

**DOCUMENTADO:**

- búsqueda semántica y por keywords;
- roles, tecnologías y requisitos en el texto;
- tags y seniority;
- país;
- expectativa salarial;
- nivel de inglés;
- disponibilidad;
- estado de perfil bloqueado/desbloqueado;
- preferencias laborales y contenido del perfil.

Los tags influyen en relevancia pero no fuerzan coincidencia exacta. Resultados pueden cambiar cuando los profesionales actualizan skills, disponibilidad, salario o visibilidad.

### Resultados y perfil

Antes del unlock se muestran headline, seniority, skills principales, ubicación y preferencias; no nombre completo, contacto ni CV. Después del unlock o de aceptar invitación, se muestran perfil completo, contacto y CV. Un perfil desbloqueado permanece accesible hasta un año.

La captura pública muestra un layout de tres paneles: filtros a la izquierda, resultados compactos al centro y detalle del perfil a la derecha. [Captura oficial de Talent Database](https://d2dgum4gsvdsrq.cloudfront.net/assets/screenshots/talent-db-b96a55ed23b97e0ece2644f1c05fda07c22246d6abb09096770d45fbf204fcb2.jpg). La captura parece anterior a la documentación actual; se usa para patrón de interacción, no para afirmar el set exacto de campos vigente.

### Créditos e invitaciones

- Unlock directo: 1 crédito.
- Invitar desde Talent Database: crea unlock y usa 1 crédito.
- Invitar a un perfil ya desbloqueado o ex-postulante: sin crédito adicional.
- La cuota se renueva mensualmente y no se acumula.
- No se venden créditos sueltos actualmente; el camino es subir de plan o esperar renovación.
- Si el perfil está oculto, el contacto aparece después de aceptar la invitación.

### MCP / búsqueda conversacional

Get on Board expone un MCP read-only para recruiters. Puede buscar talento por brief, leer perfiles seguros, listar vacantes abiertas y obtener descripción/cuestionario. Nunca devuelve email, teléfono, CV o links sociales, ni puede desbloquear, gastar créditos o invitar. Esta frontera de seguridad es una decisión de producto excelente: automatiza discovery sin automatizar contacto.

### Modelo de negocio

**OBSERVADO/DOCUMENTADO:** Talent Database convierte la base propia en una cuota mensual de contactos desbloqueados incluida en planes. La página de precios muestra desde 200 contactos/mes en Growth hasta 2,000 en Unlimited, según plan.

**INFERIDO:** el crédito no solo monetiza datos; regula el volumen de contacto y preserva confianza del lado candidato. La ausencia de packs sueltos convierte el crecimiento del sourcing en palanca de upgrade de plan.

### Qué debería hacer TaskIO

No intentar construir una base de 1.6 millones ni vender datos de contacto. En el corto plazo, TaskIO debe construir una “Talent Memory” propia de cada empresa: candidatos que ya aplicaron, fueron importados o evaluados, con consentimiento y trazabilidad. La diferenciación será buscar por evidencia técnica verificada y resultados de assessment, no por volumen bruto.

## Job Performance / Analytics

Get on Board divide analítica en dos niveles:

- **Vacante:** vistas, aplicaciones, conversión y señales de atractivo.
- **Empresa:** Overview, Descartes y Performance.

Los reportes documentados incluyen tiempos de respuesta, volumen, razones de descarte, duración, éxito de procesos cerrados y filtros por estado/periodo. Los planes avanzados habilitan detalle por proceso, éxito trimestral y CSV.

La conversión vistas → postulaciones es especialmente accionable: si hay vistas pero pocas aplicaciones, la propia ayuda propone revisar salario, preguntas, seniority, ubicación y perks. Esa conexión entre métrica y acción es mejor que un dashboard pasivo.

TaskIO REPO hoy ofrece overview operativo: pendientes, vacantes, pipeline, nuevas entradas, funnel, top de vacantes por match promedio, postulaciones y actividad reciente. No se encontró una sección dedicada para conversión, fuentes, razones de descarte, time-to-stage, time-to-hire o performance por recruiter, aunque el plan Pro promete reportes de tiempo, fuente y conversión. Ese desfase debe corregirse antes de vender analítica como feature.

## AI Features

### Get on Board

- Magic Fill para estructurar vacantes.
- Resúmenes de candidato específicos por empleo.
- Match percentage y orden “Best match”.
- Fase “Selected by Superpower” para match ≥80%.
- Smart filters derivados de CV/aplicación.
- Notas con fortalezas, gaps y puntos a aclarar en entrevista.
- Quiz de opción múltiple con puntaje generado automáticamente.
- Sourcing conversacional mediante MCP.

[Captura oficial de resumen hover](https://d2dgum4gsvdsrq.cloudfront.net/assets/superpower/superpower-smart-summary-f75430eda0b6ce5a1edbc7ec73c7c3d346f0fb4f55fa2c2ba377cd60185d9cf9.png).

Fortaleza: la IA aparece dentro de tareas existentes, no como chat aislado. Debilidad: el lenguaje de “sin sesgo” es más fuerte que lo que un score automatizado puede garantizar; TaskIO debería hablar de consistencia, evidencia y revisión humana.

### TaskIO

TaskIO REPO incluye AI job wizard, parsing/análisis de CV, resumen de candidato, AI Match explicable por skills/seniority/experiencia, generación de preguntas y perfiles AI cacheados. Su profundidad técnica potencial es mayor, pero las superficies están separadas y el valor no se resume aún en una “decision packet” unificada.

## Team & Permissions

Get on Board permite usuarios ilimitados y grupos. Roles documentados: Account Owner, Billing Owner, Recruiter, Jobs Only e Insights Pro; un usuario puede tener múltiples roles. Solo admins invitan/remueven usuarios y editan varias configuraciones. Grupos pueden limitar acceso a procesos confidenciales. Cada acción queda atribuida a una persona.

Puntos fuertes:

- El modelo reconoce que finanzas, recruiting y hiring managers necesitan permisos distintos.
- Los grupos asignables por vacante escalan mejor que roles globales.
- Usuarios ilimitados reducen el incentivo a compartir cuentas.

TaskIO REPO solo tiene roles globales ADMIN, RECRUITER y CANDIDATE. `User` no tiene una membresía multiempresa ni rol por compañía/grupo; `Company` se relaciona con `RecruiterProfile`. No existe UI de equipo en la navegación recruiter. Esto bloquea colaboración real y vuelve insuficiente el `maxRecruiters` comercial configurado en planes.

## Company Settings

Get on Board separa información de empresa y diseño de página de carreras. Los admins pueden editar nombre, descripciones, contacto, logo, datos, color, imagen, video de YouTube, layout de header, redes y título. Las vacantes activas aparecen automáticamente y la página puede embeberse en el sitio propio.

Fortaleza: convierte configuración en employer branding operativo. Fricción: el cambio de slug no es autoservicio; requiere email y puede tardar hasta 24 horas hábiles.

TaskIO REPO dispone de configuración básica de empresa, logo/banner, industria, tamaño, website, dirección y datos fiscales. No se encontró builder de página de carreras ni embed. No es P0: antes debe cerrar ATS/evaluación.

## Integrations / API / Webhooks

Get on Board ofrece:

- Integraciones nativas con Lever, Greenhouse y Ashby.
- Importación de jobs del ATS como borradores.
- Conexión de una vacante existente con el posting externo.
- Exportación automática/manual de aplicaciones.
- API pública para jobs, empresas, taxonomías y market data.
- API privada premium para jobs, procesos, aplicaciones y candidatos autorizados.
- Webhooks de job creado/actualizado, aplicación enviada/retirada y mensaje recibido.
- Slack para mensajes/postulaciones.
- LinkedIn Limited Listings/feed.
- MCP read-only para sourcing.

TaskIO tiene APIs internas y un canal webhook para entrega de notificaciones, pero no hay REPO evidencia de API pública/privada de producto, gestión de llaves, UI de webhooks o integraciones ATS. No debe priorizar una plataforma de integraciones antes de estabilizar el modelo de pipeline; sí conviene diseñar eventos de dominio desde ahora.

## Billing & Monetization

### Get on Board — observado el 28/09/2026

- Pay as you go: USD 150 por empleo, incluye AI screening; Boost adicional USD 120.
- Suscripciones Growth, Scale, Recruiter, Corporate y Unlimited; variantes con Boost.
- Precio anual equivalente aproximado: Growth USD 250/mes, Scale USD 375/mes, Recruiter USD 500/mes, Corporate USD 758/mes, Unlimited USD 1,008/mes; precios sin impuestos y con cobro anual.
- La capacidad crece en jobs con AI, pins, Boosts y contactos desbloqueados.
- ATS y Superpower están incluidos en planes; API, ATS integrations, CSV, métricas avanzadas y soporte aparecen en tiers altos.
- Sin success fee.

La monetización opera en cuatro ejes: volumen de vacantes, distribución, sourcing y capacidades enterprise. Es potente, pero exige una excelente pantalla de consumo para evitar sorpresas.

### TaskIO

Planes REPO: Gratis MXN 0, Starter MXN 999, Pro MXN 2,499 y Business MXN 4,999. Monetiza vacantes, recruiters/clientes, AI Match, coding tests y packs de créditos.

Hay una inconsistencia concreta en `config/plans.ts`: los comentarios describen FREE sin coding y `codingEnabled: false`, pero la configuración real y la lista comercial indican 10 coding tests, `codingEnabled: true` y packs disponibles. También las cifras de créditos comentadas para Starter/Pro/Business no coinciden con los valores finales. Esto debe resolverse antes de exponer límites o facturar.

En enforcement, solo se encontró aplicado `maxActiveJobs` al crear vacantes. No se encontró aplicación equivalente de `maxCandidatesPerMonth`, `maxRecruiters` o `maxClients`; hoy varios límites son promesa/configuración, no entitlement efectivo.

## UX/UI Analysis

### Navegación y jerarquía

La barra lateral de Get on Board funciona bien para un producto de uso diario: objetos operativos arriba, equipo/plan/configuración abajo. En capturas recientes el consumo del plan vive dentro de la navegación, haciendo visible el límite antes del bloqueo.

Problema: hay demasiados destinos secundarios para el recruiter ocasional. Insights Pro, Performance, Talent Database, Postulantes, Mi equipo y Configuración compiten al mismo nivel aunque su frecuencia sea distinta.

### Densidad y layout

- Dashboard y Talent Database usan alta densidad apropiada para recruiting.
- Talent Database aprovecha tres paneles para conservar contexto; es excelente en desktop y probablemente difícil en tablet/móvil.
- Kanban es familiar y directo, pero las tarjetas acumulan score, mensajes, notas, fecha, quizzes y match.
- El perfil usa sidebar + tabs, patrón efectivo para decidir sin perder contexto.

### Color, iconografía y estados

El sistema visual es utilitario: azul/teal como acción, verdes para score/completitud, rojo para descarte y morado para Superpower. La iconografía es compacta y consistente, aunque algunas capturas antiguas muestran icon fonts difíciles de interpretar sin tooltip.

### CTAs, modales y vacíos

- CTAs principales son previsibles: crear, invitar, mover, descartar, unlock.
- La confirmación de unlock hace visible el costo; buena práctica.
- Magic Fill usa modal porque transforma un brief en muchos campos; aquí el modal sí está justificado.
- Las pantallas de analítica dependen de procesos cerrados y pueden quedar vacías; la documentación explica cómo desbloquear valor, pero no se verificó el empty state real.

### Consistencia y aprendizaje

La experiencia reutiliza patrones de menú, tabs, columnas y tarjetas. El costo de aprendizaje viene del modelo comercial y del ciclo editorial, no tanto de los componentes.

### Responsive y accesibilidad

La página pública afirma responsive para la career page. No fue posible verificar el dashboard recruiter a distintos breakpoints. Las capturas evidencian layouts desktop densos y varios controles pequeños; se marca como riesgo, no como fallo confirmado. Tampoco se pudo hacer auditoría de teclado/lector de pantalla por falta de sesión recruiter funcional.

## Recruiter Workflows

### A. Crear vacante

```text
Dashboard → Crear empleo → Empresa/puesto → Modalidad/seniority/requisitos/salario
→ Preguntas de postulación → Scorecards → Preview → Enviar a moderación
→ Publicada → Proceso ATS → Pin/Boost/refresh según necesidad
```

Superpower puede adelantar el llenado, pero el recruiter conserva revisión final. La moderación aporta calidad al marketplace; para TaskIO solo tiene sentido si existe distribución pública propia.

### B. Gestionar candidatos

```text
Vacante → Board o List → Filtrar/ordenar → Abrir candidatura
→ Revisar resumen + CV + respuestas + actividad
→ Mensaje / nota / scorecard → Mover fase
→ Shortlist / entrevista / descarte con motivo / contratado
```

### C. Sourcing

```text
Talent Database → Brief/keywords + filtros → Resultados rankeados
→ Preview sin contacto → Perfil → Unlock o invitar
→ Consumir 1 crédito → Acceso/contacto → Si acepta, entra al proceso
```

Alternativa actual:

```text
MCP read-only → Brief natural o vacante abierta → Shortlist seguro
→ Abrir links en web → decisión humana de unlock/invitación
```

### D. Analytics

```text
Vacante → vistas + postulaciones + conversión → ajustar contenido/distribución
Empresa → Reports → Overview / Discards / Performance → filtro temporal/proceso → CSV
```

### E. Equipo

```text
Mi equipo → Usuarios y grupos → invitar usuario → asignar roles
→ crear grupo → dar acceso a procesos → actividad atribuida
```

### F. Configuración

```text
Menú usuario/Settings → Empresa / Career page / Notificaciones
→ Integraciones / API / Webhooks / Slack → Plan / facturas / métodos de pago
```

## Strengths

1. Marketplace + ATS + Talent Database en un mismo sistema de registro.
2. Base first-party y opt-in, con contacto protegido por unlock.
3. MCP read-only con frontera de seguridad bien diseñada.
4. Kanban configurable más vista List para alto volumen.
5. Filtros básicos y smart filters muy cercanos a decisiones reales.
6. Colaboración completa: grupos, acceso por proceso, notas, mensajes y actividad.
7. Analítica conectada con acciones de mejora de la vacante.
8. IA integrada en creación, screening, sourcing y resumen.
9. Separación entre match IA, quiz automático y scorecard humano.
10. Monetización diversificada sin success fee.

## Weaknesses / Friction

1. Taxonomía de ciclo de vida compleja: publicar, moderar, desbloquear, cerrar, despublicar, reabrir, relanzar, refrescar, Pin y Boost.
2. Monetización fragmentada en jobs, slots AI, contactos, Pins, Boosts y reportes.
3. El Kanban acumula demasiadas señales y no escala solo; List sigue Beta.
4. Filtros por columna pueden volver opaco el criterio global del pipeline.
5. El umbral automático de Superpower puede sentirse más determinista de lo que es.
6. No hay evaluación automática real de código; el tipo source code depende de revisión/scorecard.
7. “Sin sesgo” es una promesa difícil de sostener para IA de matching.
8. API keys e integraciones son surfaces técnicas dentro de una app de recruiter y necesitan gobernanza fuerte.
9. Configuración está repartida entre sidebar y menú de usuario.
10. Algunos screenshots/manuales son antiguos respecto al producto actual, señal de deuda documental.

## Get on Board vs TaskIO

| Funcionalidad | Get on Board | TaskIO actual (REPO) | Gap | Recomendación |
|---|---|---|---|---|
| Dashboard | Estados de publicación, procesos seguidos, consumo, acciones | KPIs operativos, funnel, top jobs, recientes, actividad | TaskIO no expone moderación/owners; GoB menos centrado en evaluación | Mantener dashboard accionable y añadir SLA/assessment bottlenecks |
| Vacantes | Marketplace, moderación, Pin/Boost/refresh | OPEN/PAUSED/CLOSED, filtros, templates, assessments | TaskIO no tiene distribución ni lifecycle editorial | No clonar promoción; mejorar lifecycle y ownership |
| Crear vacante | 4 pasos documentados + Magic Fill + preguntas/scorecards | Wizard 5 pasos, AI, benefits MX, taxonomías, assessments, calidad, draft | TaskIO carece de preguntas ad-hoc; GoB carece de evaluación automática profunda | Brief-first + campos estructurados + assessment reusable |
| ATS | Kanban configurable + List Beta + bulk actions | Kanban + lista; etapas fijas; match/assessment visibles | Fases, bulk, mensajes y semántica duplicada | Unificar estado/etapa y añadir bulk actions |
| Candidate profile | Tabs de postulación, actividad, mensajes, notas, rúbricas | Resumen IA, perfil, CV, evaluaciones, match, notas, actividad | TaskIO sin mensajería/scorecards colaborativos | Construir decision packet, no otra ficha |
| CV parsing | Superpower extrae señales y filtros | Parse/analyze CV + caché + perfil estructurado | Falta mostrar provenance/confidence | Evidencia por campo y corrección humana |
| Talent database | 1.6M opt-in, semantic/keyword, unlock | El recruiter solo accede a candidatos que aplicaron a su empresa; no hay sourcing global | Gap enorme de red, no de UI | Crear Talent Memory privada por empresa |
| Sourcing | TDB + sugerencias + Boost + MCP | No sourcing dedicado | Falta búsqueda sobre pool propio | Buscar por evidencia, skill verificada y disponibilidad |
| Assessments | Preguntas + scorecards + cultural fit | MCQ/CODING/MIXED, plantillas, invitaciones, resultados | TaskIO es más profundo; falta scorecard humano | Hacer assessments el centro diferencial |
| Coding tests | Source-code answer, sin puntaje automático documentado | Judge0, tests visibles/ocultos, scoring, anticheat | Ventaja TaskIO | Convertir resultado en evidencia explicable |
| Candidate scoring | Match %, quiz score, scorecard promedio | AI Match 0–100 + assessment score | Falta score compuesto y calibración | Score multidimensional, nunca ranking opaco único |
| Pipeline | Fases ilimitadas, Selected by Superpower | 4 fases de interés + 6 estados formales | Modelo inconsistente y rígido | Separar stage, disposition y legal status |
| Analytics | Conversión, discards, duración, success, response time | Overview/funnel/top match/actividad | No reportes profundos pese a copy comercial | P0 instrumentation; P1 reportes básicos |
| Team collaboration | Usuarios ilimitados, roles múltiples, grupos, activity | Roles globales; sin UI/membresía de equipo | Gap estructural | Membership + roles por empresa + job access |
| Permissions | Owner, Billing, Recruiter, Jobs Only, Insights | ADMIN/RECRUITER/CANDIDATE | Muy grueso | RBAC mínimo antes de multi-recruiter |
| Notifications | In-app/email por evento y por job | In-app/email/webhook interno + preferencias | Falta ownership y digest por proceso | Añadir watchers y SLA, no más canales aún |
| Integrations | Lever, Greenhouse, Ashby, Slack, LinkedIn | Sin integrations UI | Gap, pero no P0 | Diseñar eventos; integrar después de PMF |
| API | Pública y privada premium | APIs internas de app | No producto API | Postergar; documentar eventos internos |
| Webhooks | Configurables por eventos | Delivery channel interno, sin self-service | Sin producto webhook | P2 después de modelo de eventos estable |
| Billing | Jobs, Boost, Pin, contacts, AI slots | Planes + assessment credits/packs + Stripe + CFDI | Config inconsistente; solo `maxActiveJobs` se encontró aplicado | Simplificar y alinear copy/config/enforcement |
| AI | Creation, summaries, match, filters, MCP | Wizard, CV parse, summaries, match, question gen | TaskIO más fragmentado | Unificar en workflow y provenance |

## What TaskIO Should Adapt

### 1. Board + List como vistas iguales

El Kanban no debe ser la única forma de operar. La lista debe soportar sort, filtros guardados, selección múltiple y bulk actions.

### 2. Filtros de decisión

Adoptar filtros por match, CV, assessment completado/pasado, anticheat, años, disponibilidad, inglés, salario y experiencia; mostrar qué señal es declarada, parseada, evaluada o inferida.

### 3. Colaboración por vacante

Watchers, owner, grupo de acceso, notas privadas y actividad atribuida. Es más valioso que sumar otra pantalla de analytics.

### 4. IA dentro del trabajo

El patrón correcto es generación/recomendación contextual y revisable, no un chat genérico. Mostrar cambios propuestos, razones y fuente.

### 5. Métrica → recomendación

Si una vacante tiene visitas y pocas postulaciones, o muchos starts y pocos assessment completados, TaskIO debe señalar el cuello de botella y sugerir una acción concreta.

## What TaskIO Should Not Copy

1. No construir una bolsa de trabajo masiva como fin principal.
2. No replicar la combinación de Pin, Boost, refresh y unlock antes de tener demanda suficiente.
3. No usar un único porcentaje de IA como decisión final.
4. No crear filtros diferentes por columna sin una vista global clara.
5. No abrir API, webhooks e integraciones antes de estabilizar el dominio de stages, assessments y candidate identity.
6. No prometer “sin sesgo”; prometer trazabilidad, revisión humana y consistencia.
7. No mezclar acciones destructivas y upsells con acciones diarias en un mismo menú sin jerarquía.

## Opportunities to Beat Get on Board

### 1. Evidence graph técnico

Unir CV parseado, experiencia, skill declarada, skill verificada, MCQ, ejecución de código, anticheat y revisión humana en un mapa de evidencia. Cada score debe poder responder “por qué” y enlazar al artefacto.

### 2. Assessment-to-shortlist automático pero controlable

Permitir reglas: “entra a shortlist si assessment ≥75, cero flags severos y cumple 3 must-have”. Mostrar simulación, permitir override y registrar autor. Esto es más defendible que un match genérico.

### 3. Talent Memory privada

Crear una base por empresa de todos los candidatos consentidos/importados/evaluados, deduplicada y buscable por evidencia técnica. Es viable sin competir por volumen con Get on Board.

### 4. Interview packet

Generar agenda de entrevista basada en gaps reales: preguntas sobre skills faltantes, resultados fallidos, decisiones de código y puntos ambiguos del CV. Incluir scorecard y feedback estructurado.

### 5. Calidad y equidad operacional

Monitorear diferencias por fuente/etapa, consistencia de reviewers y razones de descarte; no vender “AI sin sesgo”, sino instrumentos auditables para reducir decisiones arbitrarias.

## Recommended TaskIO Recruiter Architecture

```text
Panel
├── Mi trabajo hoy
├── Cuellos de botella
├── Vacantes en riesgo
└── Actividad del equipo

Vacantes
├── Lista: Draft / Open / Paused / Closed
├── Crear o reutilizar
└── Job workspace
    ├── Overview
    ├── Pipeline (Board / List)
    ├── Assessments
    ├── Analytics
    └── Settings / Access

Talento
├── Talent Memory
├── Guardados / pools
└── Imports

Evaluaciones
├── Templates
├── Builder MCQ/Coding/Mixed
├── Invitations / attempts
├── Review queue
└── Calibration

Equipo
├── Members
├── Roles
├── Groups
└── Activity

Reportes
├── Funnel
├── Time in stage
├── Assessment completion
├── Sources
└── Disposition reasons

Configuración
├── Empresa
├── Hiring workflow
├── Notifications
├── Billing & credits
└── Integrations (futuro)
```

Principios:

- La vacante es el workspace central.
- “Pipeline” es una vista de aplicaciones, no un estado paralelo.
- Assessment, evidencia y decisión viven juntos.
- Talent Memory es privada por tenant y respeta origen/consentimiento.
- IA nunca ejecuta contacto o cambio de etapa sin reglas explícitas y auditables.

## Prioritized Product Backlog

| Prioridad | Feature | Problema | Referencia Get on Board | Implementación TaskIO | Complejidad | Impacto |
|---|---|---|---|---|---|---|
| P0 | Unificar stage/status/interest | Dos taxonomías producen estados contradictorios | Fases como modelo operativo único | `PipelineStage` configurable + `disposition`; migrar `recruiterInterest` | Alta | Alto |
| P0 | Aplicar límites reales y corregir planes | Copy, comentarios y flags de créditos/coding no coinciden | Consumo visible y límites por plan | Fuente única de config + tests de entitlement + UI de consumo | Media | Alto |
| P0 | Ownership y membresía por empresa | No hay colaboración segura multi-recruiter | Usuarios, roles y grupos | `CompanyMembership`, owner, recruiter, hiring manager, billing; acceso por job | Alta | Alto |
| P0 | Instrumentación del funnel | Los reportes prometidos no tienen datos/surface completos | Conversión, response time, discards | Eventos de stage, source, view/apply/start/submit, reason | Alta | Alto |
| P0 | Decision packet del candidato | Evidencia está repartida | Applicant card + Superpower + scorecards | Resumen con fuentes, CV, match, assessments, flags, notes y decisión | Media | Alto |
| P1 | List view productiva | Kanban no escala | List Beta + Best match | Tabla densa, columnas configurables, sort y filtros | Media | Alto |
| P1 | Bulk actions seguras | Operar uno por uno es lento | Move/message/discard/invite bulk | Selección múltiple; mover, asignar assessment, owner, exportar; preview antes de ejecutar | Media | Alto |
| P1 | Filtros por evidencia | Filtrar solo por match/CV es insuficiente | Smart filters | Assessment, pass, flags, skill verified, experience, English, salary, availability | Media | Alto |
| P1 | Interview packet + scorecard | La evaluación técnica no llega estructurada a entrevista | Scorecards y AI notes | Guía basada en gaps + scorecard reusable + reviewers | Media | Alto |
| P1 | Talent Memory | Se pierde valor de candidatos previos | My Applicants/Talent Database | Pool privado deduplicado con origen, consentimiento y última actividad | Alta | Alto |
| P1 | Analytics recruiter | Overview no explica conversión ni velocidad | Reports Overview/Discards/Performance | Funnel, time-in-stage, assessment completion, sources y reasons | Alta | Alto |
| P1 | Watchers y notificaciones por vacante | Todos reciben demasiado o nadie responde | Follow job + email settings | Owner/watchers, digest/inmediato, SLA y quiet hours | Media | Medio |
| P1 | Provenance del AI Match | Un porcentaje sin fuente genera desconfianza | Documentación advierte usar match como señal | Declarado/parseado/verificado/evaluado, confidence y timestamp | Media | Alto |
| P2 | Búsqueda semántica privada | Talent Memory crecerá y keyword no bastará | Semantic Talent Database | Embeddings sobre perfiles autorizados + filtros estructurados | Alta | Alto |
| P2 | Importación asistida de candidatos | CVs externos quedan fuera del ATS | Import manual/email | Upload/email alias, dedupe, consentimiento y parse review | Alta | Medio |
| P2 | Fases configurables por template | Flujos distintos requieren etapas distintas | Fases ilimitadas | Templates de pipeline por tipo de vacante, con límites | Alta | Medio |
| P2 | Mensajería integrada | WhatsApp externo no deja historia completa | Mensajes + templates | Email transaccional primero; WhatsApp solo con consentimiento/integración | Alta | Medio |
| P2 | API/event catalog interno | Futuras integraciones podrían acoplarse | API + webhooks | Versionar eventos y contratos internos antes de abrir API | Media | Medio |
| P2 | Career page básica | Empresas quieren employer brand | Página de carreras configurable | Logo/banner/description/jobs; sin page builder completo | Media | Medio |
| P3 | Webhooks self-service | Automatizaciones enterprise | Webhooks por eventos | Endpoints firmados, retries, logs y scopes | Alta | Medio |
| P3 | Integraciones ATS | Clientes enterprise usan otro sistema | Lever/Greenhouse/Ashby | Comenzar con export + un partner demandado | Alta | Medio |
| P3 | MCP recruiter read-only | Sourcing conversacional | MCP de Get on Board | Buscar Talent Memory y leer vacantes, sin acciones | Alta | Medio |
| P3 | Salary insights | Benchmarks ayudan a publicar | Insights Pro | Solo con volumen/anónimos suficientes o partner externo | Alta | Bajo |
| P3 | Boost/marketplace promotion | Más alcance | Pin/Boost | No construir hasta tener liquidez de marketplace | Alta | Bajo |

## Final Conclusions

Get on Board es un benchmark excelente para la arquitectura de recruiting, especialmente en colaboración, sourcing y operación de pipelines. No es el benchmark correcto para la profundidad de evaluación técnica: allí TaskIO puede superarlo.

La prioridad recomendada para TaskIO es fortalecer el “sistema de decisión” antes que el “sistema de distribución”: unificar pipeline, hacer multi-recruiter de verdad, instrumentar funnel, consolidar evidencia técnica y crear una lista/bulk workflow escalable. Después, construir Talent Memory privada. Integraciones, API pública, career builder y marketplace deben esperar.

La propuesta diferenciada puede resumirse así:

> Get on Board ayuda a encontrar y gestionar talento TI. TaskIO debe ayudar a demostrar, comparar y decidir talento TI con evidencia técnica trazable.

### Fuentes y referencias visuales

- [Manual de recruiter / dashboard](https://www.getonbrd.com/user-manual)
- [Dashboard de empleos](https://www.getonbrd.com/user-manual/jobs-dashboard)
- [Proceso Kanban](https://www.getonbrd.com/user-manual/process-view-kanban)
- [Ficha de postulante](https://www.getonbrd.com/user-manual/applicant-s-card)
- [Talent Database](https://www.getonbrd.com/help/what-is-talent-database)
- [Filtros de postulantes](https://www.getonbrd.com/help/how-can-i-filter-applicants-in-my-job)
- [Superpower AI](https://www.getonbrd.com/superpower)
- [Precios vigentes](https://www.getonbrd.com/pricing)
- [Reportes](https://www.getonbrd.com/help/what-kind-of-reports-can-i-find-in-get-on-board)
- [Roles](https://www.getonbrd.com/user-manual/user-roles)
- [Integraciones ATS](https://www.getonbrd.com/help/how-can-i-integrate-get-on-board-with-my-external-ats)
- [API](https://www.getonbrd.com/help/what-can-i-do-with-get-on-board-s-api)
- [Webhooks](https://www.getonbrd.com/help/what-webhook-events-does-get-on-board-send)
- [MCP vs API](https://www.getonbrd.com/help/mcp-server-or-api-which-integration-should-i-use)
