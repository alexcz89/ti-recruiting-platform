# Database Migration Incident — 2026-09-30

## Executive Summary

El 30 de septiembre de 2026, `prisma migrate deploy` aplicó accidentalmente la migración `20260930150000_add_canonical_hiring_process_foundation` sobre la base de datos Neon configurada para producción.

La migración terminó correctamente y sólo introdujo cambios aditivos: cinco enums, tres columnas en `Application`, la tabla `ApplicationEvent`, índices y llaves foráneas. No contiene sentencias de actualización o eliminación de datos. La inspección posterior, realizada dentro de una transacción de sólo lectura, confirmó 74 aplicaciones existentes, ninguna con `stage` o `disposition`, y cero eventos. El valor `stateVersion = 0` procede del default de la nueva columna, no de un backfill de negocio.

El riesgo inmediato para el runtime actual es **LOW** porque el código desplegado usa Prisma, desconoce los nuevos campos y puede seguir creando y leyendo aplicaciones. Production y Preview ya fueron separados: Production usa el proyecto Neon `Taskio`, branch `production`; Preview usa el proyecto `taskio-staging`, branch `preview`; desarrollo y QA local usan PostgreSQL Docker.

No se recomienda rollback. El incidente no se considera cerrado hasta que el guardrail preventivo pase toda su validación y quede incluido en un segundo commit separado. No debe hacerse push ni abrirse PR antes de ese punto de control.

## Trigger

El comando del incidente sobrescribió únicamente `DATABASE_URL` para apuntarlo a PostgreSQL local y después ejecutó `prisma migrate deploy`.

Sin embargo, `.env` también define `DIRECT_URL` con el endpoint directo de Neon. En Prisma ORM 5.17, las operaciones CLI que requieren una conexión directa usan `directUrl` cuando está configurado. Por tanto, el override local de `DATABASE_URL` no cambió el destino efectivo de la migración.

La configuración mínima que reproduce el error de selección de destino, sin conectarse a ninguna base, es:

```text
DATABASE_URL host: 127.0.0.1
DATABASE_URL database: taskio_canonical_hiring_qa
DIRECT_URL host: ep-orange-breeze-ai8fbldt.c-4.us-east-1.aws.neon.tech
DIRECT_URL database: neondb
unsafeMismatch: true
```

Referencias oficiales: [Prisma database connections](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections) y [Prisma migrate deploy](https://docs.prisma.io/docs/cli/migrate/deploy).

## Endpoint Used

La salida del comando y la inspección posterior confirman que el destino efectivo fue:

| Atributo | Valor |
| --- | --- |
| Endpoint directo | `ep-orange-breeze-ai8fbldt.c-4.us-east-1.aws.neon.tech` |
| Endpoint pooled relacionado | `ep-orange-breeze-ai8fbldt-pooler.c-4.us-east-1.aws.neon.tech` |
| Compute/endpoint ID | `ep-orange-breeze-ai8fbldt` |
| Base de datos | `neondb` |
| Rol | `neondb_owner` |
| TLS | `sslmode=require` |
| Channel binding | `require` |

No se registran credenciales ni cadenas de conexión completas en este documento.

## Environment Classification

Clasificación: **MATCH_PRODUCTION**.

El endpoint directo usado por Prisma y el endpoint pooled configurado en Vercel comparten el mismo compute ID `ep-orange-breeze-ai8fbldt`, la misma base `neondb` y el mismo rol. La variante `-pooler` no representa otra base de datos; es la conexión pooled al mismo destino lógico.

En el momento del incidente, la configuración observada no proporcionó aislamiento suficiente para asumir un destino local. Después de la remediación operacional confirmada, Preview ya no comparte ese destino: usa `taskio-staging / preview`. Desarrollo y QA local usan PostgreSQL Docker.

## Vercel Comparison

Proyecto Vercel enlazado localmente:

| Atributo | Valor |
| --- | --- |
| Project name | `ti-recruiting-platform` |
| Project ID | `prj_P0HQAeBjOEwqpV88Cg9asqBFzDf6` |
| Team ID | `team_iSr6uWeXTMef9lRx69rTXRBU` |

Mapeo actual confirmado durante el cierre del incidente:

| Entorno | Destino actual |
| --- | --- |
| Vercel Production | Neon project `Taskio`, branch `production` |
| Vercel Preview | Neon project `taskio-staging`, branch `preview` |
| Desarrollo / QA local | PostgreSQL Docker |

La separación evita que un Preview normal use la base de Production. El guardrail sigue siendo necesario porque una variable local heredada o un comando manual todavía podría seleccionar un destino remoto incorrecto.

## Neon Project / Branch

Destino del incidente confirmado:

- Compute/endpoint ID: `ep-orange-breeze-ai8fbldt`.
- Base: `neondb`.
- Región visible en hostname: `us-east-1` sobre AWS.
- Proyecto Neon: `Taskio`.
- Branch Neon: `production`.

Separación actual confirmada:

- Preview: proyecto `taskio-staging`, branch `preview`.
- Local/QA: PostgreSQL Docker, sin fallback automático a Neon.

## Migration State

La tabla `_prisma_migrations` confirma:

| Campo | Valor |
| --- | --- |
| Migration name | `20260930150000_add_canonical_hiring_process_foundation` |
| Started at UTC | `2026-10-01T01:55:39.821Z` |
| Finished at UTC | `2026-10-01T01:55:40.544Z` |
| Hora America/Mexico_City | 2026-09-30 19:55:39–19:55:40 |
| Applied steps | `1` |
| Rolled back at | `null` |
| Logs | `null` |

La migración quedó registrada como aplicada y completada, sin señal de fallo ni rollback parcial.

## Schema Changes Confirmed

La inspección del catálogo PostgreSQL confirmó:

- Cinco enums nuevos con sus valores esperados.
- `Application.stage`, nullable, de tipo `ApplicationStage`.
- `Application.disposition`, nullable, de tipo `ApplicationDisposition`.
- `Application.stateVersion`, non-null, con default `0`.
- Tabla `ApplicationEvent`.
- Índice por `applicationId, happenedAt`.
- Índice por `companyId, happenedAt`.
- Índice único por `companyId, applicationId, idempotencyKey`.
- Llave primaria de `ApplicationEvent`.
- Llaves foráneas esperadas con `ON UPDATE CASCADE` y `ON DELETE RESTRICT`.

El SQL de migración contiene únicamente `CREATE TYPE`, `ALTER TABLE ... ADD COLUMN`, `CREATE TABLE`, `CREATE INDEX` y `ADD FOREIGN KEY`. No contiene `DROP`, renombres ni cambios destructivos sobre columnas existentes.

## Data Changes Confirmed

Conteos obtenidos dentro de una transacción PostgreSQL marcada `READ ONLY`:

| Medida | Conteo |
| --- | ---: |
| Aplicaciones totales | 74 |
| Aplicaciones con `stage` no nulo | 0 |
| Aplicaciones con `disposition` no nulo | 0 |
| Eventos en `ApplicationEvent` | 0 |

No hubo `UPDATE`, `INSERT` ni `DELETE` de datos de negocio en la migración. Las 74 filas muestran `stateVersion = 0` por el default aplicado al agregar la columna, no por una sentencia de backfill. No se consultaron ni expusieron filas con PII.

## Production Compatibility

Compatibilidad inmediata del runtime: **LOW RISK**.

Razones:

- El código actualmente desplegado usa Prisma en lugar de `SELECT *` o inserts posicionales sobre `Application`.
- El Prisma Client anterior desconoce los campos y modelos nuevos; PostgreSQL tolera las columnas y tablas adicionales.
- `stage` y `disposition` son nullable.
- `stateVersion` tiene default `0`, por lo que los inserts del código anterior siguen siendo válidos.
- Los enums nuevos son tipos independientes y no modifican los enums legacy.
- `ApplicationEvent` está vacío, por lo que sus FKs `RESTRICT` no bloquean borrados existentes en este momento.

Riesgo futuro a vigilar: cuando existan eventos, `ON DELETE RESTRICT` impedirá eliminar aplicaciones referenciadas. Esa conducta forma parte del nuevo modelo, pero debe estar contemplada antes de habilitar escrituras de eventos.

## Root Cause

Causa primaria: el comando sobrescribió `DATABASE_URL`, pero no `DIRECT_URL`; Prisma CLI eligió el `directUrl` remoto definido en `.env`.

Factores contribuyentes:

1. `DATABASE_URL` y `DIRECT_URL` podían señalar a entornos distintos sin validación previa.
2. No existe `.env.test` ni una configuración de DB local aislada y explícita para esta operación.
3. Los scripts `db:push`/Prisma no tienen un preflight que bloquee hosts remotos en desarrollo o pruebas.
4. En el momento del incidente, la configuración observada no permitía demostrar aislamiento entre los destinos remotos; Production y Preview ya fueron separados como parte de la remediación.
5. El comando mostró el datasource remoto, pero no hubo un gate que detuviera automáticamente la ejecución.

## Recommended Remediation

1. Dejar la migración aplicada; no ejecutar rollback.
2. Mantener la separación ya realizada entre `Taskio / production`, `taskio-staging / preview` y PostgreSQL Docker local.
3. Ejecutar y revisar los tests del guardrail sin credenciales reales ni conexión remota.
4. Incluir el guardrail y este informe en un segundo commit separado del Slice 1.
5. Obtener signoff del incidente antes de hacer push o abrir PR.
6. Al desplegar posteriormente el código compatible, Prisma reconocerá la migración como ya aplicada.

## Rollback Assessment

Recomendación: **leave applied**.

Un rollback requeriría eliminar la tabla, FKs, índices, columnas y enums, además de reconciliar `_prisma_migrations`. Eso introduce más riesgo que beneficio porque:

- La migración terminó correctamente.
- Los cambios son aditivos y compatibles con el runtime anterior.
- No existen eventos ni valores canónicos que recuperar.
- El futuro despliegue compatible espera precisamente este esquema.

No debe prepararse ni ejecutarse rollback salvo que aparezca evidencia nueva de incompatibilidad material.

## Preventive Guardrail

Guardrail implementado para el cierre del incidente:

- Un wrapper único protege `migrate dev`, `migrate deploy`, `migrate reset`, `db push` y `db execute`.
- El wrapper carga `.env` de forma explícita para reproducir la resolución real de Prisma, parsea las URLs con `URL()` y determina el destino que utilizará Prisma.
- Cualquier destino remoto queda bloqueado por defecto, incluidos endpoints directos y pooled `*.neon.tech`.
- Una ejecución remota sólo se autoriza si `ALLOW_REMOTE_DB_MIGRATION=true` y `ALLOWED_REMOTE_DB_HOST` coincide exactamente con el hostname efectivo. No se aceptan wildcards ni coincidencias parciales.
- Un mismatch entre `DATABASE_URL` y `DIRECT_URL` nunca se elige silenciosamente. Sólo puede continuar un destino remoto demostrado por el wrapper y autorizado de forma exacta.
- Un `--schema` alternativo queda bloqueado porque podría cambiar el datasource sin que el wrapper pudiera demostrar el destino; sólo se admite `prisma/schema.prisma`.
- Un archivo `prisma/.env` queda bloqueado para operaciones protegidas porque Prisma podría cargarlo después del preflight y cambiar el datasource inspeccionado. La configuración debe llegar por el entorno explícito o el `.env` raíz que el wrapper sí reproduce.
- Los errores muestran como máximo el hostname; nunca passwords ni connection strings completas.
- El script oficial `test:hiring-process:db` usa el modo `test-db`, que no carga `.env` y exige una `DATABASE_URL` local explícita. `DIRECT_URL`, si existe, también debe ser local y señalar al mismo host, puerto y base.
- `prisma generate` y `prisma validate` no quedan bloqueados por no ser operaciones de schema conectadas a una base remota.
- Los scripts oficiales de `package.json` pasan por el wrapper.

El guardrail tiene cobertura para hosts locales, Docker, Neon directo y pooled, autorizaciones incompletas, autorización exacta, wildcards, mismatches, protección de secretos, `db execute --url`, tests DB y exclusión de `generate`.

## Open Questions

1. ¿Quién dará el signoff final del incidente antes del próximo push/PR?
2. ¿Debe añadirse en un trabajo posterior una política central de CI para impedir invocaciones directas a Prisma fuera de los scripts oficiales?
