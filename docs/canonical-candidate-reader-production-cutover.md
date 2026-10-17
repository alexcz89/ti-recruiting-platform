# Slice 4C — Candidate reader cutover

## 4C-PR — Candidate Reader Cutover Readiness

This PR adds cutover evidence and an operational procedure. It does not enable
the Production candidate reader flag, deploy, access Production or Staging,
write business data, reconcile, backfill, or change an Application.

### Candidate reader contract

- `CANONICAL_HIRING_PROCESS_CANDIDATE_READS_ENABLED` controls candidate-facing
  presentation, counts, and filters only.
- With the flag OFF/unset, candidate surfaces preserve legacy presentation from
  `Application.status`.
- With the flag ON, `stage != null AND disposition != null` is a complete
  canonical representation and is authoritative. This remains true when
  `stateVersion = 0`.
- A partial representation or a fully legacy representation uses
  `LEGACY_FALLBACK`. Readers do not repair, reconcile, or reject it.
- Completeness is not semantic validation. A complete but unsupported canonical
  pair remains on the current canonical reader path and blocks 4C-OPS pending
  investigation. This slice does not silently convert it to legacy fallback.
- Candidate presentation does not depend on `recruiterInterest`.
- Stale legacy `status` cannot override a complete canonical row while the flag
  is ON.

Candidate-safe mappings remain:

| Canonical state | Candidate bucket | Candidate label |
| --- | --- | --- |
| `APPLIED` | `RECEIVED` | Postulación recibida |
| `REVIEW` | `REVIEWING` | Revisando perfil |
| `ASSESSMENT` | `ASSESSMENT` | Evaluación |
| `INTERVIEW` | `INTERVIEW` | Entrevista |
| `OFFER` | `DECISION` | Decisión |
| terminal/closed | `CLOSED` | Proceso cerrado |

`REJECTED`, `HIRED`, `WITHDRAWN`, `CANCELLED`, and `CLOSED` deliberately share
the candidate-safe closed label. `HOLD` does not expose recruiter terminology;
the visible label continues to follow its stage. Recruiter-only details such as
Preselecto and raw `recruiterInterest` remain private.

The writer flag remains ON and the recruiter reader flag remains ON. Neither is
selected or influenced by the candidate reader flag. No schema, migration,
writer, event, authorization, CAS, expectedVersion, idempotency, UI, or product
semantics change is part of 4C-PR.

Readiness coverage adds one mixed-cohort OFF -> ON -> OFF cycle, including a
complete version-0 row, stale legacy fields, partial and legacy fallback rows,
candidate-safe terminal states, counts, active/closed classification, and a
complete invalid pair that remains canonical. Architecture guards restrict the
flag to approved candidate read surfaces and keep the centralized read model
free of persistence and writer dependencies.

## 4C-OPS — Production Candidate Reader Activation & Observation

**Outside this PR. Requires separate operational authorization.**

1. Record the approved release SHA, deployment, operator, UTC activation window,
   and effective values of all three hiring-process flags. Confirm the release
   contains the writer compatibility bridge and 4C readiness changes.
2. Confirm before activation:
   - `CANONICAL_HIRING_PROCESS_ENABLED=true`;
   - `CANONICAL_HIRING_PROCESS_RECRUITER_READS_ENABLED=true`;
   - `CANONICAL_HIRING_PROCESS_CANDIDATE_READS_ENABLED=false` or unset.
3. Run the approved read-only baseline below. Any partial/inconsistent
   representation or semantically invalid complete pair blocks activation. Do
   not repair data as part of 4C.
4. Capture the two candidate surfaces for the same naturally existing candidate:
   `/profile/applications` and `/profile/summary`. Record labels, counts, filters,
   and the observation time. Do not create artificial Applications.
5. An authorized operator changes only the candidate reader flag to true through
   the normal release process. Keep the writer and recruiter reader flags true.
6. Revisit the same candidate surfaces. Compare candidate buckets and labels,
   accounting for legitimate concurrent hiring actions. Confirm legacy rows use
   fallback and complete canonical rows use canonical authority.
7. Stop for internal terminology exposure, recruiter-interest-dependent output,
   stale legacy status overriding canonical state, partial rows presented as
   canonical, unexplained count loss/duplication, reader-triggered writes/events,
   authorization errors, or URL/filter regressions.
8. Record evidence and the go/rollback decision. No relevant rows or no natural
   candidate traffic means observation is pending, not a pass. Continued
   integrity monitoring belongs to Slice 4D.

### Expected presentation differences

Flag OFF intentionally retains historical labels such as `Enviada`, `Oferta`,
`Contratado`, and `Rechazada`. Flag ON uses the privacy-preserving process labels
above, including `Decisión` and the common `Proceso cerrado`. These expected text
changes are not data mutations.

Legacy `status=` URLs remain accepted conservatively. Canonical `process=` links
are generated when the flag is ON. Historical `status=HIRED` and
`status=REJECTED` retain their narrow terminal meaning without allowing stale
legacy status to override canonical disposition.

### Future read-only verification (DO NOT run as part of 4C-PR)

Use an approved read-only role, a bounded timeout, and a repeatable-read snapshot.
The SQL is a review template, not authorization to connect. Validate its plan and
replace the observation timestamp before Production use. Do not export candidate
PII or credentials.

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';

-- Persisted representation cohorts. Complete version-0 rows are CANONICAL.
SELECT CASE
  WHEN a."stage" IS NOT NULL AND a."disposition" IS NOT NULL THEN 'CANONICAL'
  WHEN a."stage" IS NULL AND a."disposition" IS NULL
    AND a."stateVersion" = 0 THEN 'LEGACY'
  ELSE 'PARTIAL_OR_INCONSISTENT'
END AS representation, count(*)
FROM "Application" a
GROUP BY 1
ORDER BY 1;

SELECT count(*) AS complete_canonical_version_zero
FROM "Application"
WHERE "stage" IS NOT NULL
  AND "disposition" IS NOT NULL
  AND "stateVersion" = 0;

-- Structural anomalies: expected zero and an activation stop condition.
SELECT count(*) AS partial_or_inconsistent
FROM "Application"
WHERE ("stage" IS NULL) <> ("disposition" IS NULL)
   OR ("stage" IS NULL AND "disposition" IS NULL AND "stateVersion" <> 0);

-- Complete but semantically unsupported canonical pairs. Readers do not repair
-- or reinterpret these rows; every result blocks activation.
SELECT "stage", "disposition", "stateVersion", count(*)
FROM "Application"
WHERE "stage" IS NOT NULL
  AND "disposition" IS NOT NULL
  AND (
    "stateVersion" < 0
    OR NOT (
      ("stage" IN ('APPLIED', 'REVIEW', 'ASSESSMENT', 'INTERVIEW', 'OFFER')
       AND "disposition" IN ('ACTIVE', 'HOLD'))
      OR
      ("stage" = 'CLOSED'
       AND "disposition" IN ('REJECTED', 'WITHDRAWN', 'HIRED', 'CANCELLED'))
    )
  )
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

-- Reproduce the current candidate read-model precedence. This expression does
-- not reference recruiterInterest: candidate presentation does not require it.
WITH resolved AS (
  SELECT
    CASE
      WHEN a."stage" IS NULL OR a."disposition" IS NULL THEN
        CASE a."status"::text
          WHEN 'REVIEWING' THEN 'REVIEWING'
          WHEN 'INTERVIEW' THEN 'INTERVIEW'
          WHEN 'OFFER' THEN 'DECISION'
          WHEN 'HIRED' THEN 'CLOSED'
          WHEN 'REJECTED' THEN 'CLOSED'
          ELSE 'RECEIVED'
        END
      WHEN a."disposition" IN ('REJECTED', 'WITHDRAWN', 'HIRED', 'CANCELLED')
        OR a."stage" = 'CLOSED' THEN 'CLOSED'
      WHEN a."stage" = 'APPLIED' THEN 'RECEIVED'
      WHEN a."stage" = 'REVIEW' THEN 'REVIEWING'
      WHEN a."stage" = 'ASSESSMENT' THEN 'ASSESSMENT'
      WHEN a."stage" = 'INTERVIEW' THEN 'INTERVIEW'
      WHEN a."stage" = 'OFFER' THEN 'DECISION'
      ELSE 'CLOSED'
    END AS bucket
  FROM "Application" a
)
SELECT bucket, count(*)
FROM resolved
GROUP BY 1
ORDER BY 1;

-- Active versus closed presentation totals; their sum must equal all rows.
WITH resolved AS (
  SELECT
    CASE
      WHEN a."stage" IS NULL OR a."disposition" IS NULL THEN
        CASE WHEN a."status" IN ('HIRED', 'REJECTED') THEN 'CLOSED' ELSE 'ACTIVE' END
      WHEN a."disposition" IN ('REJECTED', 'WITHDRAWN', 'HIRED', 'CANCELLED')
        OR a."stage" = 'CLOSED' THEN 'CLOSED'
      ELSE 'ACTIVE'
    END AS process_class
  FROM "Application" a
)
SELECT process_class, count(*)
FROM resolved
GROUP BY 1
ORDER BY 1;

-- Observe canonical rows with legacy compatibility fields that differ by
-- stage/disposition. Review aggregates only; do not expose candidate identity.
SELECT "stage", "disposition", "status", count(*)
FROM "Application"
WHERE "stage" IS NOT NULL AND "disposition" IS NOT NULL
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

-- Focused candidate-safe state inventory for cutover observation.
SELECT "stage", "disposition", count(*)
FROM "Application"
WHERE "stage" = 'OFFER'
   OR "disposition" IN
      ('HOLD', 'REJECTED', 'HIRED', 'WITHDRAWN', 'CANCELLED')
GROUP BY 1, 2
ORDER BY 1, 2;

-- Reader activation must not itself create events or update Applications.
-- recordedAt is persistence time; happenedAt is the logical business time.
-- Replace this sample timestamp with the recorded activation boundary and
-- correlate any natural hiring actions before drawing a conclusion.
WITH params AS (
  SELECT TIMESTAMPTZ '2026-01-01T00:00:00Z' AS activated_at
)
SELECT
  (SELECT count(*) FROM "ApplicationEvent", params
   WHERE "recordedAt" >= params.activated_at) AS events_since_activation,
  (SELECT count(*) FROM "Application", params
   WHERE "updatedAt" >= params.activated_at) AS applications_updated_since_activation;

ROLLBACK;
```

The bucket query deliberately excludes `recruiterInterest`. SQL predicts read
presentation only; it does not validate event chains, select writers, mutate
rows, or authorize reconciliation. Compare both candidate surfaces at the same
observation boundary. Any event/update count must be correlated with natural
business actions and application logs; the reader flag itself must cause none.

### Rollback

An authorized operator restores only
`CANONICAL_HIRING_PROCESS_CANDIDATE_READS_ENABLED` to false/unset through the
normal release process. Preserve:

```ini
CANONICAL_HIRING_PROCESS_ENABLED=true
CANONICAL_HIRING_PROCESS_RECRUITER_READS_ENABLED=true
```

Record the effective UTC rollback boundary and any mixed-deployment interval.
Rollback restores legacy candidate presentation and legacy-generated URLs. It
does not change canonical snapshots, `stateVersion`, ApplicationEvents,
Applications, writer routing, recruiter presentation, or historical data. No
backfill, reconciliation, event deletion, or business-data write is part of
rollback.
