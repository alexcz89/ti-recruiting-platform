# Candidate Reader C3 — Controlled Cutover QA

## Scope

Reader C3 validates the candidate-facing canonical hiring-process readers introduced in C1 and C2.

Covered surfaces:

- `/profile/applications`
- `/profile/summary`

No schema changes.
No migrations.
No backfill.
No writer changes.

## Feature flag

`CANONICAL_HIRING_PROCESS_CANDIDATE_READS_ENABLED`

Production remains OFF/unset during Preview QA.

## Preview QA — Flag ON

Status: pending

Validate:

- Complete canonical rows use the canonical candidate read model.
- APPLIED -> Postulación recibida
- REVIEW -> Revisando perfil
- ASSESSMENT -> Evaluación
- INTERVIEW -> Entrevista
- OFFER -> Decisión
- Terminal states -> Proceso cerrado
- HOLD is not exposed as a candidate-facing state.
- Partial/no canonical state falls back to legacy presentation.
- `/profile/applications` uses canonical `?process=` filters.
- Legacy `?status=` URLs remain accepted.
- Legacy `?status=HIRED` and `?status=REJECTED` preserve their historical narrow meaning.
- `/profile/summary` uses the same candidate read model as `/profile/applications`.

## Preview QA — Flag OFF

Status: pending

Validate:

- `/profile/applications` retains legacy labels and filters.
- `/profile/summary` retains legacy application badge presentation.
- No canonical candidate presentation appears while the flag is OFF.

## Production

Status: not started

Production flag must remain OFF/unset until Preview QA is complete.
