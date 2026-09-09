# Operación de recruiters para pilotos

El signup público de recruiters está deshabilitado. Ningún dominio de correo
crea ni asigna una empresa automáticamente. El acceso requiere `companyId`
explícito y `RecruiterProfile.status = APPROVED`.

## Revisar antes de cambiar

1. Abre Prisma Studio con `npx prisma studio`.
2. En `Company`, copia el `id` exacto de la empresa del piloto.
3. En `User`, confirma que el email no pertenece a un `CANDIDATE` o `ADMIN`.
4. Si ya existe un `RecruiterProfile`, compara su `companyId` y revisa sus
   vacantes antes de corregirlo. La herramienta no mueve vacantes,
   aplicaciones ni otros datos.

## Crear y aprobar un recruiter

En PowerShell, usa una contraseña temporal fuerte sin escribirla como argumento:

```powershell
$env:PILOT_RECRUITER_PASSWORD = Read-Host "Password temporal"
npm run pilot:recruiter -- --email=recruiter@empresa.com --company-id=COMPANY_ID --name="Nombre Recruiter" --approve
Remove-Item Env:PILOT_RECRUITER_PASSWORD
```

La creación manual marca el email como verificado, genera el hash con bcrypt y
crea el perfil en la empresa indicada. La contraseña no se imprime.

## Aprobar un recruiter existente

```powershell
npm run pilot:recruiter -- --email=recruiter@empresa.com --company-id=COMPANY_ID --approve
```

Sin `--approve`, un perfil nuevo queda `PENDING`.

## Corregir una asociación existente

La herramienta se niega a cambiar un `companyId` existente por defecto. Después
de revisar los IDs y confirmar que no se deben mover vacantes ni aplicaciones:

```powershell
npm run pilot:recruiter -- --email=recruiter@empresa.com --company-id=COMPANY_ID_CORRECTO --correct-company --approve
```

La corrección sólo actualiza `RecruiterProfile.companyId`, `companyName` y, si
se indica, la aprobación. No borra ni reasigna información de negocio.

## Revocar acceso

En Prisma Studio cambia `RecruiterProfile.status` a `PENDING` o `REJECTED`. Los
tokens existentes se degradan a `RECRUITER_PENDING` al refrescar y dejan de
tener acceso de recruiter. Esta herramienta nunca modifica usuarios `ADMIN`.
