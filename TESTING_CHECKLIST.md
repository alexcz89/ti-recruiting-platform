# 🧪 Testing Checklist - 10 Fixes Implementados

## **RONDA 1: Data Integrity**

### Bug #4: Data Loss en CV Draft
**Test:** Signup con CV
- [ ] Ir a /auth/signup/candidate
- [ ] Completar paso 1 (datos básicos)
- [ ] Ir a paso 2 (contraseña)
- [ ] Ir a paso 3 (ubicación)
- [ ] Intentar enviar
- ✅ Verificar: Usuario creado en BD con todos los datos
- ✅ Verificar: Si algo falla, usuario NO se crea (transacción rollback)

### Bug #6: Race Condition Email Verification
**Test:** Verificación simultánea
- [ ] Abrir 2 navegadores con mismo token de verificación
- [ ] Hacer click "Verificar" en ambos simultáneamente
- ✅ Verificar: Solo uno se verifica, no hay conflictos
- ✅ Verificar: emailVerified timestamp es consistente

### Bug #1: Password Validation
**Test:** Contraseñas inválidas
- [ ] Intentar: "password123 " (con espacio) → Debe rechazar
- [ ] Intentar: "password123Ñ" (con acento) → Debe rechazar
- [ ] Intentar: "Password123!" (con !) → Debe aceptar
- [ ] Intentar: "Password123@" (con @) → Debe aceptar

### Bug #7: LinkedIn/GitHub URLs
**Test:** URLs falsas
- [ ] Intentar LinkedIn: "https://google.com" → Debe rechazar
- [ ] Intentar LinkedIn: "https://linkedin.com/in/juan" → Debe aceptar
- [ ] Intentar GitHub: "https://google.com" → Debe rechazar
- [ ] Intentar GitHub: "https://github.com/juan" → Debe aceptar

---

## **RONDA 2: UX & Features**

### Bug #14: Resume Capability
**Test:** Guardar y reanudar progreso
- [ ] Ir a signup, llenar paso 1
- [ ] Cerrar navegador completamente
- [ ] Abrir signup de nuevo
- ✅ Verificar: Los datos del paso 1 están ahí
- ✅ Verificar: Está en paso 1, puede continuar al paso 2
- ✅ Verificar: Después de completar signup, datos se limpian

### Bug #8: Location Parsing
**Test:** Ubicaciones en diferentes formatos
- [ ] "Ciudad de México, CDMX, MX" → Debe parsear correctamente
- [ ] "New York, NY, USA" → Debe parsear correctamente
- [ ] "México" (solo ciudad) → Debe funcionar
- ✅ Verificar: cityNorm y admin1Norm están normalizados en BD

### Bug #15: Email Retry
**Test:** Reintentos si falla email
- [ ] Completar signup normalmente
- ✅ Verificar: Email de verificación llega
- [ ] Simular falla SMTP y reintento (solo en desarrollo)
- ✅ Verificar: Reintenta 3 veces con backoff exponencial

---

## **RONDA 3: Security**

### Bug #16: Rate Limiting Email
**Test:** Límite de reenvíos
- [ ] En /auth/verify/check-email, hacer click "Reenviar" 5 veces
- ✅ Verificar: Los 5 funcionan
- [ ] Hacer click 6to
- ✅ Verificar: Error "Demasiados intentos" + retry time
- [ ] Esperar y volver a intentar después
- ✅ Verificar: Funciona nuevamente

### Bug #17: Email Enumeration Prevention
**Test:** No revelar si email existe
- [ ] GET /api/auth/check-email?email=alejandro.cz89@gmail.com (usuario real)
- [ ] GET /api/auth/check-email?email=noexiste@example.com (usuario falso)
- ✅ Verificar: Ambos devuelven respuesta similar (available: true/false)
- ✅ Verificar: No dice "usuario existe" vs "usuario no existe"

### Bug #19: Password Reset
**Test:** Validación de nueva contraseña
- [ ] Solicitar password reset
- [ ] Intentar cambiar a contraseña anterior
- ✅ Verificar: Error "Debe ser diferente a la anterior"
- [ ] Cambiar a contraseña nueva
- ✅ Verificar: Funciona correctamente

---

## **RONDA 4: Data Integrity**

### Bug #2: Double-Submit Prevention
**Test:** Email tomado entre check y submit
- [ ] Abrir 2 navegadores en signup paso 1
- [ ] Navegador A: Llena email "test@example.com"
- [ ] Navegador B: Llena mismo email, completa registro
- [ ] Navegador A: Hace click "Continuar"
- ✅ Verificar: Error "Email ya registrado"
- ✅ Verificar: Se re-valida en submit, no usa el check anterior

### Bug #3: Timezone Handling
**Test:** Fechas en educación/experiencia
- [ ] Agregar educación con fecha "Enero 2024"
- [ ] En CV, ver fechas guardadas
- ✅ Verificar: Muestra "Enero 2024", no "Diciembre 2023"
- ✅ Verificar: Consistente sin importar timezone del servidor

### Bug #12: Phone Validation
**Test:** Números inválidos
- [ ] Intentar: "0000000000" (todos 0s) → Debe rechazar
- [ ] Intentar: "1234567890" (secuencial) → Debe rechazar
- [ ] Intentar: "5551234567" (válido) → Debe aceptar
- [ ] Intentar: "+52 555 123 4567" (con espacios) → Debe aceptar

---

## **Resultado Final**

Si todos pasan ✅:
- Código está listo para deployment
- Puedes hacer push a producción
- Configurar monitoreo de logs

Si alguno falla ❌:
- Nota el bug específico
- Reporta la rama/commit
- Investigar qué salió mal
