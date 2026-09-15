# Solicitudes de demo

`/contact` usa un formulario propio y `POST /api/contact`. No crea tablas ni
registros en Prisma. El endpoint valida la solicitud y envía un correo a la
dirección de contacto existente mediante el módulo Resend ya instalado.
El remitente usa `RESEND_FROM` (o `EMAIL_FROM` como fallback), el destino es
`alejandro@taskio.com.mx` y `Reply-To` usa el correo validado del prospecto.

El servidor sólo devuelve éxito cuando Resend acepta el mensaje. Si el correo
está deshabilitado, falta configuración o el proveedor falla, devuelve `503` y
la interfaz conserva los datos para reintentar. No se añadió ningún servicio,
dependencia o variable de entorno.

## Datos y protección

Los campos requeridos son nombre, empresa, correo de trabajo y necesidades de
contratación. Cargo y mensaje adicional son opcionales. El esquema Zod de
`lib/contact/demo-request.ts` se comparte entre cliente y servidor y limita cada
campo antes de construir el correo. Todo contenido se escapa en HTML.

El endpoint exige JSON, limita el cuerpo a 12 KB, valida el origen cuando el
navegador lo envía, incluye un honeypot y aplica límites de 3 solicitudes por
correo y 10 por IP durante una hora. El limitador existente reside en memoria;
en varias instancias serverless reduce abuso casual, pero no constituye un
límite global estricto. Si el volumen lo requiere, se debe sustituir por un
almacén compartido.

Los logs del endpoint son estáticos y no incluyen los datos del formulario. El
correo sí contiene los datos que la persona envió porque ése es el canal elegido
para atender la solicitud.

## Analytics

`demo_request_started` se registra una vez tras el primer cambio real en el
formulario. `demo_request_submitted` se registra sólo después de una respuesta
exitosa del servidor. Ambos eventos se llaman sin propiedades, por lo que no
reciben nombre, correo, empresa, mensaje ni otros datos del formulario.

El transporte externo sigue sujeto a `NEXT_PUBLIC_ANALYTICS_ENABLED=true` y a
un dominio Plausible configurado. Sin esas dos condiciones no sale ninguna
solicitud de analytics.

## Pruebas

```sh
npx vitest run __tests__/server/demo-request-schema.test.ts __tests__/server/demo-request-mailer.test.ts __tests__/server/contact-route.test.ts __tests__/components/contact-form.test.tsx
```

La suite cubre validación, escape HTML, honeypot, origen, rate limit, entrega
omitida, errores de interfaz, éxito confirmado, doble envío y eventos sin PII.
