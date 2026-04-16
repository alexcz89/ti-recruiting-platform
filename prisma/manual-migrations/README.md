# Manual migrations

## 2026-04 recruiter-company-phase1

Esta migración se ejecutó manualmente porque `prisma migrate dev` detectó drift en una branch derivada de producción de Neon y no pudo generar una migración segura sin resetear el schema.

Cambios cubiertos:
- migración de `RecruiterProfile.companyId`
- migración de `Company.size` a enum
- actualización de `AssessmentInviteChargeLedger`
- conversión de créditos de `Company` a integer
- eliminación de columnas legacy en `RecruiterProfile`

Archivo aplicado:
- `2026-04-recruiter-company-phase1.sql`

Importante:
- `User.companyId` y `Subscription.accountId` se mantienen para una fase 2.