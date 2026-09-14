# Analytics de landing

## Auditoría y decisión

No se encontraron Vercel Analytics, Speed Insights, GA4/GTM, Plausible,
PostHog, Mixpanel, Segment ni un tracker propio en package.json, los puntos
de entrada o las utilidades del proyecto. No había variables de esos proveedores
en los archivos de entorno locales inspeccionados (sólo se revisaron nombres).
El HTML público de https://www.taskio.com.mx tampoco declaró scripts de analytics.
Esto no verifica configuraciones privadas del panel de hosting o scripts inyectados
fuera del repositorio. Los reportes de reclutamiento son métricas de negocio, no
instrumentación de visitantes. Sí existe telemetría interna de antitrampas en
`app/assessments/[templateId]/useAntiCheating.ts`, que envía flags mediante
sendBeacon/fetch a la API del intento. No es analytics de adquisición y no se
modificó ni reutilizó, para no mezclar datos sensibles de assessments.

Se elige **Plausible**, una sola plataforma de métricas agregadas. Se usa su
[Events API](https://plausible.io/docs/events-api) directamente desde el navegador
para controlar exactamente las URLs enviadas, sin SDK, script externo, cookies,
proxy ni modificaciones de backend/auth/Prisma. El servicio requiere cuenta y
suscripción; los eventos personalizados consumen la cuota mensual. Consultar
[planes vigentes](https://plausible.io/#pricing) antes de activarlo. No se creó ni
contrató una cuenta y no se ha verificado recepción en un dashboard real.

## Configuración

Variables públicas de compilación, configuradas **sólo en Production** del hosting:

```dotenv
NEXT_PUBLIC_ANALYTICS_ENABLED=true
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=www.taskio.com.mx
NEXT_PUBLIC_ANALYTICS_UTM_VALUES=linkedin,google,newsletter,organic,cpc,email,launch,hero
```

Crear primero el sitio `www.taskio.com.mx` en Plausible. El dominio debe coincidir
exactamente con el hostname público y con el sitio del dashboard. No instalar
además el snippet de Plausible: duplicaría pageviews. Recompilar/desplegar para
aplicar variables. Ausencia de configuración = ningún envío.

La lista UTM es un ejemplo: revisar y añadir sólo códigos de campañas sin datos
personales. Se aceptan valores exactos de esa lista con 1–64 caracteres
`a-z`, `0-9`, `_` o `-`, en `utm_source`, `utm_medium`, `utm_campaign` y
`utm_content`. El resto se descarta, incluso si parece un código válido.
Sin lista configurada, no se envían UTM. Usar los mismos nombres revisados en
los enlaces de marketing; no usar nombres de personas como campañas.

## Eventos

Todos los nombres están centralizados en `lib/analytics.ts`.

| Evento | Momento | Frecuencia |
| --- | --- | --- |
| `pageview` | Landing visible o formulario de candidato visible | Una vez por visita/montaje del formulario |
| `landing_code_editor_viewed` | Editor intersecta la mitad de su altura o la mitad del viewport, lo menor | Una vez por visita a `/` |
| `landing_how_it_works_clicked` | Clic en el enlace actual a `#experiencia-candidato` | Por clic |
| `candidate_experience_section_viewed` | Sección intersecta el mismo umbral significativo | Una vez por visita a `/` |
| `landing_demo_clicked` | Clic en Solicitar demo, desktop o menú móvil | Por clic |
| `landing_scroll_25` | Borde inferior del viewport alcanza el 25% del documento | Una vez por visita |
| `landing_scroll_50` | Alcanza el 50% | Una vez por visita |
| `landing_scroll_75` | Alcanza el 75% | Una vez por visita |
| `landing_scroll_100` | Llega al fondo (tolerancia de 1 px) | Una vez por visita |
| `candidate_signup_started` | Formulario real montado y documento visible | Una vez por montaje |
| `candidate_signup_completed` | `createCandidateImproved` responde `ok: true`, antes de navegar a verificación | Una vez por montaje exitoso |
| `demo_request_started` | Primer cambio real en el formulario de `/contact` | Una vez por montaje |
| `demo_request_submitted` | `POST /api/contact` confirma que Resend aceptó el correo | Una vez por envío exitoso |

Una visita a la landing termina al cambiar de ruta; regresar inicia otra.
Cambiar el hash, redimensionar, volver a una pestaña o repetir efectos de
StrictMode no duplica vistas/hitos. No se cuenta una pestaña oculta. No se exige
tiempo de permanencia: una intersección que supera el umbral ya cuenta.
La profundidad usa la parte del documento expuesta, incluyendo el viewport inicial;
en una página que cabe entera, todos los hitos aplican. Scroll usa listener pasivo
y como máximo un requestAnimationFrame pendiente, sin polling. Los saltos al
ancla también cuentan como profundidad, no demuestran lectura.

## Payload y atribución

Todos los eventos llevan únicamente `name`, `domain`, `url`, `referrer` e
`interactive`. No se aceptan propiedades arbitrarias en `track`.

- `url`: origin + ruta permitida (`/`, `/contact` o `/auth/signup/candidate`) y UTM aprobados.
  No se envían hash, email, callbackUrl, jobId, tokens ni otras rutas.
- `referrer`: sólo origin HTTP(S) de `document.referrer`; se eliminan ruta,
  query, credenciales y hash. Se sacrifica detalle por privacidad.
- `interactive`: falso para vistas de secciones y scroll, para no convertirlos
  artificialmente en interacción en el cálculo de rebote; verdadero para el resto.
- Plausible obtiene dispositivo/navegador desde el User-Agent y extrae los UTM
  de la URL; no se duplican en propiedades. Landing path figura como página de
  entrada en una sesión que empezó en `/`. Su atribución de sesión vincula los
  eventos posteriores; la app no persiste campañas ni identificadores propios.

No se envían nombre, email, teléfono, CV, código, respuestas de assessments,
IDs de usuario/empresa/vacante, formularios ni mensajes de errores. Las solicitudes
usan `credentials: omit`, `referrerPolicy: no-referrer` y `keepalive`; las fallas
se ignoran sin reintentos y nunca bloquean clics o registro.

El transporte HTTP comunica IP y User-Agent al proveedor. Según su
[política técnica](https://plausible.io/security), Plausible deriva un identificador
diario con hash y sal rotativa, sin guardar IP/User-Agent crudos. Esta integración
no crea cookies, almacenamiento de analytics, IDs ni fingerprinting propio.
Respeta Do Not Track y Global Privacy Control. Bloqueadores, red, opt-out o cierre
del navegador pueden causar subregistro: no es un registro contable garantizado.

## Límites reales

- Demo: `/contact` confirma la conversión sólo cuando el endpoint recibe una
  aceptación del proveedor de correo. No equivale a una reunión agendada ni a
  una oportunidad comercial calificada. La implementación y sus límites se
  documentan en `docs/demo-request.md`.
- Signup completed mide creación por contraseña, no verificación del correo.
  Si el servidor crea la cuenta pero falla antes de devolver `ok`, no se cuenta.
- Google OAuth puede crear una cuenta o iniciar sesión en una existente. No se
  inventa una conversión desde la página de destino. Medir nuevas cuentas OAuth
  requeriría una señal confirmada desde auth en otra fase. El inicio del formulario
  sí incluye personas que luego eligen Google: considerar esta cobertura al calcular
  conversión. Los registros ajenos a este formulario no están incluidos.
- Recruiter queda fuera. Puntos futuros: `app/auth/signup/recruiter/page.tsx` y
  su acción en `app/auth/signup/recruiter/actions.ts`, sólo tras creación confirmada.
- No hay replay, heatmaps, A/B, experimentos o captura automática de formularios.

## Prueba local

En `.env.local` (no versionado), añadir `NEXT_PUBLIC_ANALYTICS_DEBUG=true` y
ejecutar `npm run dev`. En la consola del navegador, antes de navegar a `/`:

```js
window.addEventListener('taskio:analytics', e => console.log(e.detail));
```

El stream es sólo local, no hace requests a Plausible. Un listener agregado después
de cargar no verá eventos previos: navegar a otra ruta y regresar sin recargar, o
instalarlo antes de cargar con herramientas del navegador. Revisar vistas al entrar,
scroll, ambos CTAs, menú móvil y volver arriba/abajo sin duplicados. En Network no
debe haber `/api/event` durante desarrollo ni en previews con hostname distinto.

Probar registro con acción simulada en tests; no crear cuentas reales sólo para
probar analytics. Un error y una visita directa a verificación no son conversiones.

```sh
npx vitest run __tests__/components/landing-analytics.test.tsx __tests__/components/candidate-signup-analytics.test.tsx __tests__/components/landing-code-editor.test.tsx
npm run lint
npm run type-check
npm run build
git diff --check
```

## Verificación en producción

Después de configurar y desplegar, añadir los diez eventos como Custom Event
Goals en Plausible, con los nombres exactos de la tabla. Abrir `/` con UTM aprobados,
realizar clics/scroll y revisar Network → `https://plausible.io/api/event`: payload
filtrado, sin cookies ni PII. HTTP 202 por sí solo no prueba aceptación: revisar
`x-plausible-dropped` y confirmar los eventos en el dashboard/tiempo real.
Consultar Goals/conversiones, Top Pages/Entry Pages, Sources/campañas y Devices.
Segmentar el objetivo `landing_demo_clicked` con esos filtros; no hay dimensiones
duplicadas. La recepción real sigue pendiente de una cuenta configurada.

## Validación de esta entrega

- Lint: pasa, con advertencias preexistentes en `useAntiCheating.ts` y
  `ClientSplitView.tsx`.
- Typecheck y build: pasan. El build reporta `/` en 5.42 kB y First Load JS de
  105 kB. El aviso de Browserslist desactualizado es previo a esta integración.
- 17 tests pasan: clicks, umbrales, scroll, pestaña oculta, StrictMode, navegación,
  filtros de privacidad, configuración del transporte, fallos y éxito de registro,
  deduplicación de conversión y tests existentes del editor.
- Chromium/Puppeteer: landing a 1440 y 375 px, sin errores de consola ni overlays;
  ancla y CTA desktop/móvil conservan el destino. Capturas en
  `test-screenshots/analytics/` (archivos locales ignorados por Git).
- En navegador real con debug: vistas de editor/sección, clicks y scroll 25/50/75/100
  aparecen una vez cuando corresponde; un parámetro de correo de prueba se elimina,
  los UTM aprobados se conservan y no se hacen solicitudes al proveedor.
  El CTA móvil dispara un evento y entrar al formulario emite signup_started,
  sin emitir signup_completed por sólo visitarlo.
- Comparación de AST/JSX contra HEAD: mismo contenido visual en los cinco archivos
  existentes, excluyendo sólo atributos de analytics y el componente que devuelve null.
- El módulo `LandingAnalytics` con su helper mide 3,852 bytes minificados / 1,778 bytes
  gzip en esbuild, excluyendo React y Next ya existentes. Es una medición aislada,
  no una comparación exacta del bundle Next antes/después. Cero dependencias nuevas.
  No se midieron Core Web Vitals de campo; no se afirma una variación numérica de LCP/CLS.
- `git diff --check`: pasa.

Archivos de implementación: `lib/analytics.ts`,
`components/landing/LandingAnalytics.tsx`, `app/layout.tsx`,
`components/Header.tsx`, `components/landing/CodeAssessmentHero.tsx`,
`components/landing/TaskioCodeEditor.tsx`, y
`app/auth/signup/candidate/components/SignupMultiStep.tsx`.
Tests: `__tests__/components/landing-analytics.test.tsx` y
`__tests__/components/candidate-signup-analytics.test.tsx`.
Documentación: este archivo. No se hizo commit ni despliegue.
