# TaskIO — Frontend Design Guidelines

**Versión:** 0.2 — guía operativa propuesta, pendiente de validación del frontend  
**Fecha:** 4 de noviembre de 2026  
**Ámbito propuesto:** interfaces web de TaskIO (reclutador/empresa, candidato y páginas públicas)  
**Ubicación sugerida en el repositorio:** `/TASKIO_DESIGN_GUIDELINES.md`  
**Estado:** propuesta de dirección visual; **no representa una auditoría del frontend vigente ni una decisión sobre tokens ya implementados**.

> **Relación con `AGENTS.md`.** Este documento complementa las reglas generales de desarrollo del repositorio. **No las sustituye.** En caso de conflicto, prevalecen `AGENTS.md`, las instrucciones locales aplicables, los contratos/estados verificados en el código y las restricciones de seguridad. Este documento guía decisiones de presentación, interacción y revisión visual; no autoriza modificaciones del dominio ni despliegues.

## 1. Objetivo del diseño

TaskIO debe sentirse como una herramienta profesional de trabajo para reclutamiento: clara, rápida de entender, confiable, consistente y útil para ejecutar acciones. Su experiencia debe expresar la **suite integral de bolsa de trabajo + ATS + evaluaciones técnicas**, sin presentar las evaluaciones como el único producto.

**Prioridad de diseño:** comprensión y ejecución de tareas > claridad de datos > accesibilidad > consistencia > atractivo decorativo.

La dirección visual **propuesta, todavía no aprobada como identidad definitiva**, combina:

- **Linear como referencia conceptual de organización:** navegación contenida, jerarquía precisa, buena densidad informativa y patrones consistentes.
- **SaaS moderno como referencia de comunicación:** uso moderado de color para acciones, progreso y estados relevantes.
- **Identidad propia de TaskIO:** conservar la marca, el contenido real y las convenciones útiles ya existentes; no clonar pantallas ni estilos ajenos.

No es objetivo reproducir un mockup pixel por pixel, diseñar un dashboard genérico ni introducir características por motivos visuales.

## 2. Alcance y fuentes de verdad

Las siguientes decisiones **deben verificarse en el repositorio antes de implementar**:

- Tokens actuales, tipografía, colores de marca, logotipos, temas claro/oscuro, Tailwind y componentes compartidos.
- Estructura del layout, rutas, menús, permisos, estados y acciones existentes.
- Bibliotecas de componentes, iconografía, tablas, gráficas, animación y drag-and-drop realmente instaladas.
- Fuentes de datos disponibles para indicadores y vistas; la existencia de un mockup o un modelo Prisma no prueba que el dato ya se calcule.

**Orden para decidir:** flujo y comportamiento reales en la rama activa → componentes/tokens existentes → referencias visuales seleccionadas → propuestas nuevas. Toda modificación debe cumplir también la jerarquía técnica de `AGENTS.md`.

## 3. Método para utilizar Designeer y otras referencias

[Designeer](https://designeer.xyz/) se utiliza como **punto de descubrimiento** de referencias, no como fuente automática de código ni como especificación funcional. Las referencias pueden provenir de los recursos enlazados desde allí o de productos comparables.

Para cada pantalla o patrón importante, seleccionar **1–3 referencias aprobadas** y registrar lo siguiente en el PR, issue o ficha de diseño:

| Campo | Qué registrar |
|---|---|
| Referencia | URL directa y captura con fecha, si está permitido |
| Contexto | Pantalla de TaskIO y tarea del usuario |
| Patrón a adoptar | Ej.: alineación de tabla, comportamiento del sidebar, jerarquía de filtros |
| Problema que resuelve | Ej.: identificar candidatos pendientes en menos pasos |
| Qué NO copiar | Marca, ilustraciones, texto, datos, componentes licenciados o interacciones que no apliquen |
| Compatibilidad | Componentes y dependencias actuales reutilizables |
| Criterio verificable | Qué mejora debe observarse en desktop y mobile |

**Reglas:**

1. No copiar interfaces completas, logos, imágenes, código o recursos de terceros sin revisar licencia y permisos.
2. No mezclar patrones contradictorios por el solo hecho de que todos se vean atractivos.
3. Acompañar cada referencia de una explicación funcional; «se ve premium» no es justificación suficiente.
4. Priorizar referencias de productos operativos y pantallas de trabajo reales para dashboard/ATS; reservar referencias de marketing para la landing.
5. Si una referencia requiere modificar un flujo o introducir nuevos estados/datos, plantearlo como decisión de producto separada.

## 4. Reglas contra el «AI slop»

**Evitar por defecto:**

- Gradientes llamativos, glassmorphism, brillos, fondos con halos, sombras grandes y efectos 3D sin propósito.
- Tarjetas de métricas y gráficas solo para llenar espacios.
- Iconos ornamentales repetidos, emojis como sustitutos de iconos de interfaz y colores aleatorios por sección.
- Exceso de bordes redondeados, etiquetas y badges que compiten con los datos principales.
- Encabezados demasiado altos, mucho espacio vacío en pantallas de operación o tablas comprimidas para mantener una composición «bonita».
- Microcopy genérico, promesas no demostradas, textos de relleno y cifras inventadas.
- Animaciones continuas, transiciones lentas y controles que solo aparecen al hacer hover.
- Variantes duplicadas del mismo botón, modal, tabla o tarjeta en páginas diferentes.

**No son prohibiciones absolutas:** un gradiente, una ilustración, una gráfica, un badge o una animación pueden existir cuando aportan identidad, comprensión, orientación o una acción medible. La carga de justificar su uso corresponde a quien propone el cambio.

**Prueba rápida de calidad:** si al ocultar el logotipo y cambiar el nombre del producto la pantalla parece una plantilla SaaS genérica sin relación con reclutamiento, revisar jerarquía, contenido y tareas antes de darla por terminada.

## 5. Sistema visual y tokens

### 5.1 Regla de implementación

**Primero auditar; después normalizar.** Reutilizar las variables CSS, tokens Tailwind, fuentes y componentes ya existentes cuando sean adecuados. No introducir una nueva paleta paralela ni un segundo sistema de diseño por conveniencia.

Al aprobar el sistema visual, definir tokens **semánticos**, no valores hardcodeados en cada pantalla. Categorías mínimas:

| Categoría | Tokens conceptuales (nombres orientativos, no implementados) |
|---|---|
| Superficies | `canvas`, `surface`, `surface-muted`, `surface-raised` |
| Texto | `text-primary`, `text-secondary`, `text-muted`, `text-inverse` |
| Líneas | `border-subtle`, `border-default`, `focus-ring` |
| Acciones | `action-primary`, `action-hover`, `action-disabled` |
| Semántica | `success`, `warning`, `danger`, `info`, `neutral` |
| Geometría | `spacing-*`, `radius-*`, `shadow-*` |
| Tipografía | `font-body`, `font-heading`, `text-*`, `line-height-*` |

Los nombres finales deben ajustarse a las convenciones verificadas del repositorio. **No se aprueban aquí fuentes, códigos HEX, tamaños ni dependencias nuevos.** Cualquier propuesta de valores deberá compararse con el frontend actual y comprobar contraste.

### 5.2 Aplicación visual

- Tipografía sobria, pocas familias/pesos, jerarquía perceptible y tamaños legibles.
- Espaciado consistente a partir de la escala existente; no usar márgenes arbitrarios para resolver cada pantalla.
- Bordes y separadores discretos. La elevación debe indicar jerarquía, no decorar.
- Color de acento reservado principalmente para acciones, selección, enlaces y señales de estado importantes.
- Estados semánticos consistentes; usar además **texto o icono**, nunca solo color.
- Datos numéricos alineados para facilitar comparación. Fechas, dinero y cantidades con formatos coherentes para México, cuando aplique.
- Preservar modo claro/oscuro si existe, validando ambos. No agregar un modo nuevo dentro de un PR de alcance limitado.

## 6. Componentes y patrones de interacción

### Navegación y shell

- El sidebar debe reflejar rutas y permisos **existentes**, no inventar secciones.
- Mantener ubicación, etiquetas y comportamiento previsibles entre vistas del mismo rol.
- La página activa se reconoce por más de una señal visual.
- En mobile, ofrecer navegación accesible y cerrarla de forma previsible tras navegar.
- No ocultar funciones críticas en menús secundarios solo por imitar una referencia.

### Tablas y listas

- Priorizar búsqueda, ordenamiento y filtros **cuando tengan un caso de uso real y estén soportados por el flujo existente**.
- Hacer visibles el dato principal, estado, responsable/siguiente paso y acciones relevantes, cuando esos datos existan y el rol pueda verlos.
- Mantener orden y jerarquía al reducir el ancho; utilizar tarjetas o desplazamiento horizontal justificado en vez de truncar campos críticos sin alternativa.
- Mostrar estado vacío, carga, error, éxito y resultados sin coincidencias con un siguiente paso útil.

### Formularios y acciones

- Etiquetas persistentes, instrucciones específicas, errores cercanos al campo y validación comprensible.
- Diferenciar la acción principal de las secundarias. Confirmar operaciones irreversibles cuando corresponda.
- Mostrar feedback de cambios guardados, fallidos o pendientes; evitar duplicaciones al reenviar.
- No construir componentes interactivos inertes para que la pantalla se parezca al mockup.

### Tarjetas, indicadores y gráficas

- Una tarjeta o gráfica debe responder a una pregunta concreta del usuario.
- Todo indicador debe tener fuente, definición y estado de carga/error verificables.
- **Nunca usar cifras ficticias en una interfaz conectada a producción.** Los ejemplos visuales con datos sintéticos deben quedar identificados y aislados.
- No reemplazar flujos de trabajo útiles por un mural de KPIs.

## 7. Diseño por tipo de usuario

| Experiencia | Prioridad UX | Evitar |
|---|---|---|
| Reclutador / empresa | Encontrar vacantes, candidatos pendientes, estado actual y siguiente acción | Dashboards decorativos o pasos extra |
| ATS | Rastrear etapas, interés, historial, origen y decisiones de candidatos | Confundir estados persistidos con indicadores visuales |
| Evaluaciones | Crear/enviar invitaciones y entender resultados disponibles | Sobreprometer validez, precisión o información no calculada |
| Candidato | Buscar/postularse, editar perfil y completar una evaluación con claridad | Fricción, ambigüedad, pérdida de progreso |
| Landing pública | Comunicar bolsa + ATS + evaluaciones, diferenciador y CTA real | Promesas inventadas, efectos que distraen del producto |

### Reglas específicas del ATS

- **No inventar ni renombrar estados de contratación en la UI sin validar la semántica del dominio vigente.** Diferenciar estado del proceso, disposición e interés del reclutador cuando así funcione el modelo actual.
- No cambiar, simular ni escribir directamente etapas por una mejora visual. Las transiciones deben reutilizar el writer/servicio autorizado de la rama.
- No asumir que el Kanban ilustrado en una referencia coincide con las etapas de TaskIO.
- Los movimientos deben comunicar claramente el resultado, errores y restricciones; drag-and-drop, si existe, requiere alternativa accesible por teclado/menú.
- No revelar datos de otras empresas o candidatos no autorizados. Un control oculto no sustituye autorizaciones de servidor.

### Reglas específicas de evaluaciones

- Separar señales de integridad de decisiones automáticas sobre candidatos.
- Mostrar solo resultados y datos que el usuario tiene permiso de consultar.
- En pruebas cronometradas, hacer visibles tiempo, progreso, instrucciones, errores y confirmación de entrega; comprobar el flujo real antes de rediseñarlo.

## 8. Responsive y accesibilidad

**Objetivo:** experiencia funcional desde móviles pequeños hasta escritorio, sin degradar la tarea principal.

- Probar como mínimo un móvil estrecho (~320–390 px), tablet (~768 px), escritorio medio (~1280 px) y amplio (~1440 px), ajustando a los breakpoints reales del proyecto.
- Sin desbordamientos horizontales globales, botones cortados, formularios imposibles de completar o modales fuera de pantalla.
- Navegación por teclado, foco visible, nombres accesibles y orden lógico de tabulación.
- Contraste de texto normal de al menos **4.5:1** y texto grande de al menos **3:1** como objetivo WCAG AA, salvo excepciones aplicables.
- Controles táctiles con superficie cómoda (objetivo preferido ~44 × 44 px), sin sacrificar densidad en escritorio.
- No depender del color para transmitir estados; proporcionar texto/indicadores adicionales.
- Respetar `prefers-reduced-motion`; animación breve, funcional y no bloqueante.
- Verificar zoom, textos largos, traducciones y mensajes de error sin romper el layout.

## 9. Implementación en el repositorio

Antes de editar, Codex debe cumplir el diagnóstico de `AGENTS.md`: rama/commit, árbol de trabajo, `package.json`, rutas relevantes, componentes/tokens reales y dependencias. **No aplicar estas guías como instrucciones para reescribir todo el frontend.**

Orden preferido:

1. Registrar baseline con capturas y lista de flujos de la pantalla actual.
2. Seleccionar referencias y explicar patrones a adoptar/excluir.
3. Decidir qué se reutiliza y qué cambio mínimo se necesita.
4. Modificar una sección coherente por PR, sin ampliar el dominio técnico.
5. Verificar flujos, estilos, accesibilidad y regresiones.
6. Presentar comparación visual antes/después y plan de reversión.

**Restricciones:** no cambiar endpoints, esquema Prisma, migraciones, contratos, permisos, billing, IA, evaluaciones ni writer de contratación por motivos estéticos. Si una mejora real requiere modificar alguno de ellos, separar alcance, riesgos, pruebas y autorización.

**Dependencias:** no instalar bibliotecas o paquetes de UI/animación porque aparezcan en Designeer. Evaluar licencia, bundle, accesibilidad, mantenimiento, compatibilidad y alternativas existentes.

## 10. Convenciones para PRs de frontend

Todo PR visual debe incluir, en proporción al alcance:

- **Problema real:** quién usa la pantalla, qué tarea mejora y por qué importa.
- **Alcance y no alcance:** rutas/componentes afectados y módulos deliberadamente intactos.
- **Referencias:** enlaces/capturas aprobados y patrones concretos adaptados.
- **Antes/después:** misma ruta, viewport y estado de datos; desktop y mobile si aplica. No difundir PII en capturas.
- **Comportamiento:** qué acciones/estados se preservaron o cambiaron explícitamente.
- **Pruebas:** comandos realmente ejecutados y resultados, más revisión manual de interacciones.
- **Riesgos/rollback:** cómo revertir la UI sin afectar datos.

### Checklist de revisión

- [ ] La pantalla ayuda a completar una tarea concreta y no parece una plantilla genérica.
- [ ] La UI conserva el lenguaje y los tres pilares de TaskIO cuando aplique.
- [ ] Los patrones visuales están justificados y las referencias tienen procedencia clara y aprobación cuando corresponde.
- [ ] Se reutilizaron componentes y tokens existentes; no hay variantes duplicadas innecesarias ni nuevas dependencias sin justificación.
- [ ] No se inventaron métricas, datos, rutas, estados, acciones ni permisos.
- [ ] El UX writing y la terminología son consistentes; se validaron estados de carga, vacío, error, éxito y acceso denegado relevantes.
- [ ] Funciona con teclado, foco visible, contraste suficiente y tamaños responsive.
- [ ] Se preservaron acciones y validaciones existentes; sin cambios encubiertos al backend.
- [ ] Hay evidencia antes/después comparable y resultados de pruebas reales, no supuestos; se reportó impacto de rendimiento cuando aplica.
- [ ] Existe estrategia de rollback; no hay merge ni despliegue sin autorización.

## 11. UX writing, terminología y mensajes

El texto de la interfaz es parte del flujo, no un elemento decorativo. Debe permitir al usuario comprender el estado de sus procesos y actuar sin interpretar jerga técnica.

- **Idioma principal:** español claro para usuarios de México; utilizar términos coherentes con el producto y respetar traducciones existentes cuando estén implementadas.
- **Vocabulario de referencia, sujeto a auditoría:** «vacante», «candidato», «postulación», «evaluación técnica» y «resultado». No alternar sin motivo «aplicante», «postulante», «aspirante» y «candidato» cuando se refieran al mismo concepto. No sustituir etiquetas de estados existentes sin comprobar su significado y uso.
- **Acciones concretas:** preferir etiquetas que indiquen la operación («Publicar vacante», «Invitar a evaluación», «Guardar cambios») frente a botones genéricos («Continuar», «Enviar») cuando el contexto no sea inequívoco.
- **Errores recuperables:** explicar qué falló, si se conservó la información y el siguiente paso. No exponer detalles internos, identificadores sensibles, stack traces ni datos de otros usuarios.
- **Confirmación y progreso:** distinguir «guardando», «guardado», «no se pudo guardar», «enviado» y «pendiente» según el resultado real del servidor; nunca anunciar éxito anticipadamente.
- **Estados vacíos:** diferenciar «todavía no hay elementos» de «los filtros no encontraron coincidencias» y ofrecer una acción válida, sin introducir funciones ficticias.
- **Accesibilidad del lenguaje:** usar etiquetas visibles y descriptivas, textos de ayuda específicos y mensajes comprensibles para quienes no tienen perfil técnico.
- **Copy comercial:** no prometer ahorros, porcentajes, capacidades de IA, integraciones o precios que no estén respaldados por evidencia aprobada.

Antes de cambiar una etiqueta compartida, comprobar su impacto en navegación, documentación, soporte, pruebas y flujos de reclutador/candidato. Cambios de terminología de estados persistidos requieren una decisión funcional separada.

## 12. Reutilización y creación de componentes

Antes de crear o adoptar un componente visual, Codex debe resolver esta secuencia:

1. **Reutilizar:** comprobar si ya existe un componente, variante o patrón que cubra la necesidad.
2. **Extender:** si falta un comportamiento visual legítimo, evaluar una variante explícita del componente existente sin romper a sus consumidores.
3. **Crear:** solo si el propósito, contrato, accesibilidad y mantenimiento justifican un componente nuevo.
4. **Adoptar una dependencia externa:** último recurso, sujeto a licencia, mantenimiento, tamaño, compatibilidad, accesibilidad y aprobación cuando afecte al sistema compartido.

**Criterios para componentes nuevos o modificados:**

- Responsabilidad clara y nombre alineado con el repositorio; evitar componentes «universales» con demasiadas opciones o lógica duplicada.
- Propiedades tipadas, estados visuales pertinentes y comportamiento accesible (foco, teclado, etiquetas y semántica).
- Variantes limitadas a necesidades observables; no crear una variante distinta para cada pantalla.
- Uso consistente de tokens y primitives existentes; no introducir valores inline arbitrarios ni dependencias circulares.
- Separación entre presentación y lógica de negocio; no mover autorizaciones o escrituras a componentes de UI.
- Identificar consumidores existentes y comprobar regresiones antes de modificar componentes compartidos.
- No eliminar componentes anteriores hasta confirmar que no quedan consumidores y que el reemplazo conserva sus contratos.

**Regla de decisión:** una nueva abstracción debe reducir duplicación o mejorar una interacción comprobable; si no, preferir el cambio local más sencillo.

## 13. Rendimiento y costo del frontend

La estética no debe empeorar de forma injustificada el rendimiento, especialmente en móvil o con conexiones inestables.

- Registrar una **línea base comparable** de las rutas afectadas antes de rediseñarlas. Si no existe instrumentación, documentar esa limitación; no inventar números de rendimiento.
- Comprobar impacto en peso de JavaScript/CSS, fuentes, imágenes, iconos y dependencias nuevas. Preferir recursos ya disponibles y carga diferida cuando esté justificada.
- Evitar dependencias pesadas para detalles que CSS o componentes existentes pueden resolver.
- Prevenir saltos de diseño reservando espacio para contenido e imágenes; respetar dimensiones e hidratación reales.
- Evitar animaciones continuas, efectos que bloqueen interacción o cálculo costoso durante scroll; respetar `prefers-reduced-motion`.
- No convertir en Client Component una sección completa si solo una pequeña parte necesita interacción, salvo justificación técnica.
- No añadir consultas repetidas al servidor, polling innecesario o cálculos costosos por motivos visuales.
- Medir, cuando las herramientas del proyecto lo permitan, **LCP, CLS e INP**, y contrastar antes/después con mismo entorno, red, dispositivo y datos.
- No establecer presupuestos numéricos de bundle o Core Web Vitals sin conocer la línea base. Si hay regresión relevante, documentarla y resolverla antes de recomendar el merge.

## 14. Protocolo de validación visual y funcional

La calidad visual no se determina solo por una captura atractiva. Para cada PR de frontend, adaptar la siguiente matriz al alcance real:

| Aspecto | Evidencia requerida |
|---|---|
| Baseline | Captura anterior y explicación del flujo actual; misma ruta, rol, estado de datos y tamaño de viewport |
| Referencia | 1–3 imágenes/URLs seleccionadas con patrón concreto que se pretende adaptar |
| Resultado | Captura posterior con el mismo viewport, zoom, tema y estado de datos que la baseline |
| Responsive | Móvil estrecho, tablet cuando aplique y al menos un escritorio; comprobar menús, tablas y acciones |
| Interacciones | Acciones primarias, navegación, tabulación/foco, estados vacíos, carga, error, éxito y acceso denegado relevantes |
| Compatibilidad | Verificación de las rutas/roles consumidores cuando cambian componentes compartidos |
| Rendimiento | Comparación con la línea base o explicación explícita de por qué no pudo medirse |
| Seguridad visual | Capturas con datos sintéticos o anonimizados; sin CV, correos, teléfonos, tokens ni PII reales |

**Reglas de comparación:**

1. Tomar capturas **antes** de implementar cuando exista un entorno seguro; no comparar solo dos diseños propuestos.
2. Usar condiciones equivalentes y anotar diferencias inevitables (datos, permisos, tema, contenido, fuente).
3. Revisar estados interactivos, no solo la primera pantalla visible; los controles no deben ser decorativos ni inertes.
4. Si hay pruebas de regresión visual o E2E en el repositorio, reutilizarlas antes de incorporar herramientas nuevas.
5. Distinguir evidencia automatizada, inspección manual y aspectos no comprobados. No afirmar «verificado» sin haber ejecutado la prueba correspondiente.
6. Cualquier diferencia intencional respecto de la referencia aprobada debe explicarse por necesidad de TaskIO, limitación técnica o accesibilidad.

El objetivo no es igualar píxeles externos, sino producir una solución propia más clara y operativamente correcta.

## 15. Gobernanza visual y decisiones de diseño

**Estado de autoridad:** este documento propone reglas operativas; no aprueba por sí solo una nueva paleta, una familia tipográfica, componentes de terceros ni cambios globales de marca.

- **Codex puede** auditar, comparar alternativas, proponer soluciones, elaborar prototipos y ejecutar cambios acotados dentro del alcance autorizado.
- **La persona responsable del producto debe aprobar explícitamente** cambios de identidad visual, navegación global, patrones transversales, cambios de terminología críticos o adopción de un nuevo sistema de componentes antes de su implementación generalizada.
- **Un PR visual debe registrar** decisión, referencia aprobada, problema resuelto, alternativas descartadas si son relevantes, alcance, evidencia y riesgos.
- **Excepciones:** cuando una pantalla requiera romper una regla visual, explicar por qué y limitar su aplicación. No convertir una excepción local en nuevo estándar sin revisión.
- **Cambios pequeños:** no hacer rediseños globales silenciosos al corregir un detalle; conservar una estrategia de rollback por PR.
- **Coherencia entre roles:** compartir fundamentos (tokens, tipografía, controles y accesibilidad) cuando convenga, sin forzar al candidato a la misma densidad y navegación del reclutador.
- **Mantenimiento:** una decisión visual aprobada se incorpora a estas guías o a una referencia enlazada; no volver a improvisarla en cada sesión de Codex.

**Ficha breve de decisión para PR/issue:**

```md
### Decisión visual
- Pantalla y usuario:
- Problema / tarea que debe mejorar:
- Referencias aprobadas (URL o captura):
- Patrón adoptado / elementos excluidos:
- Componentes y tokens reutilizados:
- Alternativas y riesgos relevantes:
- Evidencia antes/después:
- Aprobación / estado: pendiente | aprobada | rechazada
```

---

## 16. Primer incremento sugerido (pendiente de auditoría)

**PR candidato:** `Recruiter dashboard shell — visual refresh`.

**Incluir únicamente si los componentes existen y es seguro aislarlos:** layout del reclutador, navegación/sidebar, encabezado, espaciado y componentes de superficie compartidos por ese ámbito. Mantener datos y acciones actuales.

**Excluir del primer PR:** rediseño funcional del ATS, nuevas columnas o etapas Kanban, métricas nuevas, cambios de evaluación, cambios globales que afecten al candidato, actualizaciones mayores de dependencias y migraciones.

**Criterio de salida:** navegación íntegra, vistas de reclutador funcionales, sin regresiones en roles ajenos, comparación desktop/mobile y PR pequeño revisable. Si el layout es compartido por varios roles, elegir una estrategia de alcance menor en vez de modificarlo globalmente sin control.

## 17. Decisiones pendientes de validar con el frontend real

1. Paleta y tipografía oficiales de TaskIO; tokens existentes que deben preservarse.
2. Librería de componentes e iconografía actual; evaluar si hace falta incorporar alguna otra.
3. Soporte y convenciones existentes de modo claro/oscuro.
4. Navegación y layout reales de cada rol; qué componentes son compartidos.
5. Capturas de referencia finalmente aprobadas para dashboard, ATS y landing.
6. Qué métricas y datos existen de verdad en el dashboard; no diseñar sobre supuestos.
7. Infraestructura de pruebas visuales/E2E y herramienta de comparación disponibles.
8. Terminología efectiva de la interfaz y si existe localización/i18n.
9. Línea base de rendimiento y herramientas de medición accesibles.
10. Responsable y proceso de aprobación de decisiones visuales globales.

**Mantenimiento:** actualizar este documento mediante PR pequeño cuando se aprueben decisiones visuales nuevas; registrar fecha, cambio, justificación y pantallas afectadas. Las reglas de esta guía deben evolucionar con evidencia del producto, no por tendencias de diseño.


## Registro de cambios

- **v0.2 — 4 de noviembre de 2026:** normalización de nombre/Markdown y ampliación con UX writing, ciclo de vida de componentes, rendimiento, validación visual reproducible y gobernanza de decisiones. Se mantienen pendientes la auditoría del frontend y la aprobación de la identidad visual definitiva.
- **v0.1 — 4 de noviembre de 2026:** dirección visual inicial, uso de Designeer, reglas anti-AI slop, accesibilidad y PR incremental sugerido.
