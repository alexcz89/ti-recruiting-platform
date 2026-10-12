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

Status: passed

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

Status: passed

Validate:

- `/profile/applications` retains legacy labels and filters.
- `/profile/summary` retains legacy application badge presentation.
- No canonical candidate presentation appears while the flag is OFF.

## QA evidence

Manual Preview validation:

- Flag ON:
  - `/profile/applications` displayed `Proceso cerrado`.
  - `/profile/summary` displayed `Proceso cerrado`.
  - The same canonical terminal application was presented consistently on both surfaces.
  - No internal canonical state was exposed to the candidate.
- Flag OFF:
  - `/profile/applications` returned to the legacy label `Rechazada`.
  - `/profile/summary` returned to its historical legacy label `No seleccionado`.
  - This confirms that each surface preserves its previous flag-off presentation.

Automated coverage validates the remaining canonical mappings, fallback behavior, filter buckets, legacy URL compatibility, and canonical authority over stale legacy status.

## Production

Status: not started

Production flag must remain OFF/unset until Preview QA is complete.
