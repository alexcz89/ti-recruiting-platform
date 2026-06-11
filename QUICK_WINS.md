# ⚡ 3 Quick-Win Fixes (45 minutos)

## **Fix #1: Better Error Messages (15 min)**

**Problema:** Errores genéricos no dicen qué salió mal
```
"Error al crear la cuenta" ← Usuario no sabe qué cambiar
```

**Solución:** Mensajes específicos
- Email duplicado → "Este email ya está registrado"
- Contraseña débil → "Contraseña debe tener mayúscula, minúscula, número y símbolo"
- Email inválido → "Email debe ser válido (ej: usuario@empresa.com)"
- Ubicación requerida → "Debes seleccionar una ubicación válida"

**Dónde:** `app/auth/signup/candidate/components/SignupMultiStep.tsx`
- Mejorar messages en catches
- Usar mensajes específicos del servidor

**Impacto:** Usuarios saben qué arreglar → Menos abandonos

---

## **Fix #2: Max Length Attributes (15 min)**

**Problema:** User puede copiar/pegar 1000 caracteres en nombre
```
<input type="text" value={data.firstName} />  ← Sin límite
```

**Solución:** Agregar maxLength HTML
```
<input type="text" maxLength={50} value={data.firstName} />
```

**Dónde:** 
- Step1Basic.tsx: firstName, lastName (50 chars)
- Step1Basic.tsx: maternalSurname (50 chars)
- PhoneInputField.tsx: phone ya está validado

**Impacto:** Evita truncamiento silencioso, UX más clara

---

## **Fix #3: Input Sanitization XSS (15 min)**

**Problema:** User puede ingresar `<script>alert('XSS')</script>`
```
Job description: "<script>alert('hacked')</script>" ← Sin sanitización
```

**Solución:** Sanitizar al guardar y mostrar
- En signup: validar que no haya <, >, script, etc
- En mostrar: usar innerText en lugar de innerHTML
- Usar librería: DOMPurify o similar

**Dónde:**
- CV builder description field
- Job description field
- Cualquier rich text que se muestre en público

**Impacto:** Imposible inyectar JavaScript malicioso

---

## **Timeline:**

| Fix | Archivo | Tiempo | Dificultad |
|-----|---------|--------|-----------|
| **#23** | SignupMultiStep.tsx | 15 min | Fácil |
| **#9** | Step1Basic.tsx, PhoneInputField.tsx | 15 min | Muy fácil |
| **#20** | CV builder, Job creation | 15 min | Media |

**Total: 45 minutos → 13 bugs arreglados en producción**
