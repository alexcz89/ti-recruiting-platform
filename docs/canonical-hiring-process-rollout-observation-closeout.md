# Slice 4D — Canonical hiring-process rollout observation and closeout

## Purpose and current status

Slice 4D consolidates sustained observation, integrity verification, rollback
readiness, evidence capture, and the eventual closeout decision for the
canonical hiring-process rollout. It does not retire compatibility behavior or
authorize Production access.

Current supplied Production configuration:

```ini
CANONICAL_HIRING_PROCESS_ENABLED=true
CANONICAL_HIRING_PROCESS_RECRUITER_READS_ENABLED=true
CANONICAL_HIRING_PROCESS_CANDIDATE_READS_ENABLED=true
```

All three flags being ON describes configuration, not closeout. The current 4D
status is **observation pending** until the criteria in this runbook have linked
evidence and explicit approval.

## Previously observed operational evidence

The following evidence was supplied from completed operations. It was not
re-executed or independently verified while preparing this document.

### 4A-OPS — PASS (supplied evidence)

- Natural Applications were created canonically.
- The observed initial tuple was `SUBMITTED / REVIEW` and `APPLIED / ACTIVE`.
- `stateVersion = 1`.
- One `APPLICATION_CREATED` event was present with `toStage = APPLIED` and
  `toDisposition = ACTIVE`.

### 4B-OPS — PASS (supplied evidence)

- The recruiter reader flag was ON.
- Recruiter surfaces were validated on mixed canonical and legacy cohorts.
- Canonical `APPLIED / ACTIVE` displayed as `Por revisar`.
- Legacy fallback remained functional.
- No partial/inconsistent representation or relevant runtime error was observed
  during that validation.

### 4C-OPS — PASS (supplied evidence)

- The candidate reader flag was ON.
- A legitimate candidate-controlled Production Application was created as
  `SUBMITTED / REVIEW`, `APPLIED / ACTIVE`, version 1, with its creation event.
- `/profile/applications` displayed the canonical row as
  `Postulación recibida`; legacy rows on the same page remained `Enviada`.
- `/profile/summary` showed the same canonical/legacy distinction.
- Candidate UI did not expose `recruiterInterest`, `REVIEW`, `Preselecto`, or
  other recruiter-only state.
- No relevant runtime error was observed during that validation.

Attach the original timestamps, release SHAs, screenshots/log references, and
operators to the evidence register before final closeout.

## Observation states

Every observation checkpoint records exactly one state:

| State | Meaning | Decision |
| --- | --- | --- |
| `NO_TRAFFIC` | No relevant natural creation, transition, recruiter, or candidate traffic occurred. | Evidence remains pending. |
| `INSUFFICIENT_TRAFFIC` | Some traffic occurred, but it did not exercise enough of the rollout to support closeout. | Extend observation and list the missing evidence. |
| `HEALTHY_OBSERVED_TRAFFIC` | Natural traffic exercised the applicable paths without unresolved integrity or runtime regressions. | Continue through the window or evaluate closeout. |
| `STOP_OR_ROLLBACK` | A stop condition occurred or a rollout-attributable regression requires containment. | Stop closeout, preserve evidence, and apply the component-specific response. |

Use one full operational week as the initial observation window, beginning when
all three flags are confirmed effective on the intended deployment. Extend it
when traffic is absent or insufficient. Calendar duration alone never satisfies
closeout, and absence of traffic is never a PASS.

## Sustained observation procedure

1. Record the deployed SHA, deployment identifier, effective flag values,
   operator, and UTC start boundary.
2. Capture the supplied 4A/4B/4C evidence references and any known mixed-runtime
   deployment intervals.
3. At the start of the window, run the approved read-only baseline queries below
   using a read-only role and reviewed query plan.
4. Review existing Vercel and application logs at least once per operational day
   and after any incident or relevant deployment.
5. Record natural creation, transition, recruiter-reader, and candidate-reader
   traffic. Do not manufacture Production Applications or transitions.
6. Repeat the bounded integrity queries at agreed checkpoints and at the end of
   the window. Compare results against the same definitions and UTC boundaries.
7. Classify each checkpoint using the four observation states. Explain every
   evidence gap and every count change.
8. Stop and preserve evidence when a stop condition occurs. Do not repair,
   backfill, or reconcile data under this runbook.
9. When all criteria are supported, record the closeout decision and explicit
   approver. Otherwise extend observation or open a separate incident.

## Runtime health observation

Use existing Vercel and application logs. No custom monitoring service or
diagnostic endpoint is required for 4D.

At each checkpoint record counts, representative request IDs, affected routes,
release SHA, and whether the behavior is attributable to the rollout for:

- application creation route failures and writer failures;
- recruiter list, overview, queue, aggregate, Kanban, and detail failures;
- candidate applications and profile-summary failures;
- canonical transition failures, concurrency conflicts, and stale-version
  responses, distinguishing expected conflicts from unexpected failures;
- authorization, actor-validation, and cross-tenant anomalies;
- idempotency conflicts, duplicate-event errors, and command replay failures;
- unexplained sustained increases in runtime errors after activation.

Compare equivalent traffic windows where possible. A raw error count without
request volume, route, release, and cause is not sufficient rollout evidence.

## Read-only Production integrity verification

The SQL below is a review template, not authorization to connect. Do not execute
it as part of the documentation PR. Before operational use:

- use an approved read-only role and a repeatable-read, read-only transaction;
- validate the query plan and choose bounded UTC intervals;
- replace every placeholder;
- exclude known mixed-deployment boundary requests or document them separately;
- avoid exporting candidate PII or credentials;
- retain aggregate results and investigation references in the evidence record.

`Application.createdAt`, `Application.updatedAt`, `ApplicationEvent.recordedAt`,
and `ApplicationEvent.happenedAt` are separate concepts. `recordedAt` answers
when an event was persisted and is used for observation windows. `happenedAt`
is the logical business occurrence time and is used for event ordering.
`updatedAt` can change because of notes or other unrelated updates and is not,
by itself, proof of a hiring transition.

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';

-- Replace every UTC placeholder below with approved boundaries. Use a writer-ON
-- start after any mixed-runtime interval for strict creation assertions.

-- 1. Persisted representation cohorts. Complete stage/disposition is canonical
-- even when stateVersion is zero.
SELECT CASE
  WHEN a."stage" IS NOT NULL AND a."disposition" IS NOT NULL THEN 'CANONICAL'
  WHEN a."stage" IS NULL AND a."disposition" IS NULL
    AND a."stateVersion" = 0 THEN 'LEGACY'
  ELSE 'PARTIAL_OR_INCONSISTENT'
END AS representation, count(*)
FROM "Application" a
GROUP BY 1
ORDER BY 1;

-- 2. Partial/inconsistent representations. Expected: zero unresolved rows.
SELECT count(*) AS partial_or_inconsistent
FROM "Application"
WHERE ("stage" IS NULL) <> ("disposition" IS NULL)
   OR ("stage" IS NULL AND "disposition" IS NULL AND "stateVersion" <> 0);

-- 3. Complete canonical version-zero inventory. This is not automatically an
-- error; investigate provenance separately.
SELECT "stage", "disposition", count(*) AS rows
FROM "Application"
WHERE "stage" IS NOT NULL
  AND "disposition" IS NOT NULL
  AND "stateVersion" = 0
GROUP BY 1, 2
ORDER BY 1, 2;

-- 4. Invalid complete states and negative versions. The canonical rules require
-- CLOSED exactly when disposition is terminal. Version zero remains allowed.
SELECT "stage", "disposition", "stateVersion", count(*) AS rows
FROM "Application"
WHERE "stage" IS NOT NULL
  AND "disposition" IS NOT NULL
  AND (
    ("stage" = 'CLOSED') <>
      ("disposition" IN ('REJECTED', 'WITHDRAWN', 'HIRED', 'CANCELLED'))
    OR "stateVersion" < 0
  )
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

-- 5. Projection divergence only for canonical states with a defined compatible
-- projection. REVIEW/ACTIVE accepts REVIEW or MAYBE; MAYBE is Preselecto inside
-- REVIEW and must not be treated as HOLD. States without a universal projection
-- (including ASSESSMENT, HOLD, WITHDRAWN, and CANCELLED) are excluded.
WITH projected AS (
  SELECT a.*,
    CASE
      WHEN a."stage" = 'APPLIED' AND a."disposition" = 'ACTIVE'
        THEN 'SUBMITTED'
      WHEN a."stage" = 'REVIEW' AND a."disposition" = 'ACTIVE'
        THEN 'REVIEWING'
      WHEN a."stage" = 'INTERVIEW' AND a."disposition" = 'ACTIVE'
        THEN 'INTERVIEW'
      WHEN a."stage" = 'OFFER' AND a."disposition" = 'ACTIVE'
        THEN 'OFFER'
      WHEN a."stage" = 'CLOSED' AND a."disposition" = 'REJECTED'
        THEN 'REJECTED'
      WHEN a."stage" = 'CLOSED' AND a."disposition" = 'HIRED'
        THEN 'HIRED'
      ELSE NULL
    END AS expected_status,
    CASE
      WHEN a."stage" = 'APPLIED' AND a."disposition" = 'ACTIVE'
        THEN ARRAY['REVIEW']
      WHEN a."stage" = 'REVIEW' AND a."disposition" = 'ACTIVE'
        THEN ARRAY['REVIEW', 'MAYBE']
      WHEN a."stage" IN ('INTERVIEW', 'OFFER')
        AND a."disposition" = 'ACTIVE' THEN ARRAY['ACCEPTED']
      WHEN a."stage" = 'CLOSED' AND a."disposition" = 'REJECTED'
        THEN ARRAY['REJECTED']
      WHEN a."stage" = 'CLOSED' AND a."disposition" = 'HIRED'
        THEN ARRAY['ACCEPTED']
      ELSE NULL
    END AS allowed_interests
  FROM "Application" a
  WHERE a."stage" IS NOT NULL AND a."disposition" IS NOT NULL
)
SELECT "stage", "disposition", "status", "recruiterInterest", count(*) AS rows
FROM projected
WHERE expected_status IS NOT NULL
  AND (
    "status"::text IS DISTINCT FROM expected_status
    OR NOT ("recruiterInterest"::text = ANY(allowed_interests))
  )
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2, 3, 4;

-- 6. Inventory canonical states intentionally excluded from universal legacy
-- projection checks.
SELECT "stage", "disposition", "status", "recruiterInterest", count(*) AS rows
FROM "Application"
WHERE "stage" = 'ASSESSMENT'
   OR "disposition" IN ('HOLD', 'WITHDRAWN', 'CANCELLED')
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2, 3, 4;

-- 7. Recent creation rate, split by persisted representation. createdAt is
-- appropriate here because this query is about Application creation.
SELECT date_trunc('day', a."createdAt") AS utc_day,
  CASE
    WHEN a."stage" IS NOT NULL AND a."disposition" IS NOT NULL THEN 'CANONICAL'
    WHEN a."stage" IS NULL AND a."disposition" IS NULL
      AND a."stateVersion" = 0 THEN 'LEGACY'
    ELSE 'PARTIAL_OR_INCONSISTENT'
  END AS representation,
  count(*) AS applications
FROM "Application" a
WHERE a."createdAt" >= TIMESTAMP '<observation_start_utc>'
  AND a."createdAt" < TIMESTAMP '<observation_end_utc>'
GROUP BY 1, 2
ORDER BY 1, 2;

-- 8. Writer-ON cohort creation integrity. Historical/imported rows are not in
-- this cohort. Each applicable row requires exactly one valid creation event.
WITH cohort AS (
  SELECT a.id, a."candidateId", a."jobId", a."stage", a."disposition",
    a."stateVersion", j."companyId"
  FROM "Application" a
  JOIN "Job" j ON j.id = a."jobId"
  WHERE a."createdAt" >= TIMESTAMP '<writer_on_cohort_start_utc>'
    AND a."createdAt" < TIMESTAMP '<observation_end_utc>'
), evidence AS (
  SELECT c.*,
    count(e.id) FILTER (WHERE e.type = 'APPLICATION_CREATED') AS creation_events,
    count(e.id) FILTER (
      WHERE e.type = 'APPLICATION_CREATED'
        AND e."fromStage" IS NULL
        AND e."fromDisposition" IS NULL
        AND e."toStage" = 'APPLIED'
        AND e."toDisposition" = 'ACTIVE'
        AND e.visibility = 'INTERNAL'
        AND e."companyId" = c."companyId"
        AND e."actorType" = 'CANDIDATE'
        AND e."actorId" = c."candidateId"
        AND e.metadata->>'resultingStateVersion' = '1'
    ) AS valid_creation_events
  FROM cohort c
  LEFT JOIN "ApplicationEvent" e ON e."applicationId" = c.id
  GROUP BY c.id, c."candidateId", c."jobId", c."stage", c."disposition",
    c."stateVersion", c."companyId"
)
SELECT count(*) AS writer_on_applications,
  count(*) FILTER (
    WHERE "stage" IS NULL OR "disposition" IS NULL
      OR "stateVersion" < 1
      OR creation_events <> 1
      OR valid_creation_events <> 1
  ) AS failures
FROM evidence;

-- 9. Duplicate creation events are never expected. Keep the result aggregated;
-- investigate individual IDs only under approved incident handling.
SELECT count(*) AS applications_with_duplicate_creation_events
FROM (
  SELECT e."applicationId"
  FROM "ApplicationEvent" e
  WHERE e.type = 'APPLICATION_CREATED'
  GROUP BY e."applicationId"
  HAVING count(*) > 1
) duplicates;

-- 10. Separate writer-ON, imported, historical canonical, and legacy cohorts.
-- Do not apply writer-ON creation-event expectations to the latter cohorts.
SELECT provenance, count(*) AS applications
FROM (
  SELECT a.id,
    CASE
      WHEN a."createdAt" >= TIMESTAMP '<writer_on_cohort_start_utc>'
        AND a."createdAt" < TIMESTAMP '<observation_end_utc>'
        THEN 'WRITER_ON_COHORT'
      WHEN a."createdAt" >= TIMESTAMP '<observation_end_utc>'
        THEN 'AFTER_OBSERVATION_WINDOW'
      WHEN EXISTS (
        SELECT 1 FROM "ApplicationEvent" e
        WHERE e."applicationId" = a.id AND e.type = 'LEGACY_STATE_IMPORTED'
      ) THEN 'HISTORICAL_IMPORTED'
      WHEN a."stage" IS NOT NULL AND a."disposition" IS NOT NULL
        THEN 'HISTORICAL_CANONICAL_OTHER'
      WHEN a."stage" IS NULL AND a."disposition" IS NULL
        AND a."stateVersion" = 0 THEN 'LEGACY'
      ELSE 'PARTIAL_OR_INCONSISTENT'
    END AS provenance
  FROM "Application" a
) classified
GROUP BY provenance
ORDER BY provenance;

-- 11. Persisted event activity uses recordedAt. happenedAt is retained for the
-- logical business timeline and is not substituted for persistence time.
SELECT date_trunc('day', e."recordedAt") AS recorded_utc_day,
  e.type, count(*) AS events
FROM "ApplicationEvent" e
WHERE e."recordedAt" >= TIMESTAMP '<observation_start_utc>'
  AND e."recordedAt" < TIMESTAMP '<observation_end_utc>'
GROUP BY 1, 2
ORDER BY 1, 2;

-- 12. Recent canonical transition activity. Creation and import baselines are
-- reported separately from transition events.
SELECT e.type, count(*) AS transitions,
  min(e."happenedAt") AS first_logical_occurrence,
  max(e."happenedAt") AS last_logical_occurrence
FROM "ApplicationEvent" e
WHERE e."recordedAt" >= TIMESTAMP '<observation_start_utc>'
  AND e."recordedAt" < TIMESTAMP '<observation_end_utc>'
  AND e.type NOT IN ('APPLICATION_CREATED', 'LEGACY_STATE_IMPORTED')
GROUP BY e.type
ORDER BY e.type;

-- 13. Logical chain ordering uses happenedAt (with recordedAt/id as stable
-- tie-breakers). Restrict strict chain checks to writer-ON or imported rows.
WITH eligible AS (
  SELECT a.id
  FROM "Application" a
  WHERE (a."createdAt" >= TIMESTAMP '<writer_on_cohort_start_utc>'
         AND a."createdAt" < TIMESTAMP '<observation_end_utc>')
     OR EXISTS (
       SELECT 1 FROM "ApplicationEvent" e
       WHERE e."applicationId" = a.id AND e.type = 'LEGACY_STATE_IMPORTED'
     )
), ordered AS (
  SELECT e.*,
    row_number() OVER (
      PARTITION BY e."applicationId"
      ORDER BY e."happenedAt", e."recordedAt", e.id
    ) AS event_number,
    lag(e."toStage") OVER (
      PARTITION BY e."applicationId"
      ORDER BY e."happenedAt", e."recordedAt", e.id
    ) AS previous_stage,
    lag(e."toDisposition") OVER (
      PARTITION BY e."applicationId"
      ORDER BY e."happenedAt", e."recordedAt", e.id
    ) AS previous_disposition
  FROM "ApplicationEvent" e
  JOIN eligible a ON a.id = e."applicationId"
)
SELECT count(*) AS logical_chain_breaks
FROM ordered
WHERE (event_number = 1 AND
       ("fromStage" IS NOT NULL OR "fromDisposition" IS NOT NULL))
   OR (event_number > 1 AND
       ("fromStage" IS DISTINCT FROM previous_stage
        OR "fromDisposition" IS DISTINCT FROM previous_disposition));

-- 14. Versioned event metadata is guaranteed for canonical creation and
-- canonical transitions, but not for LEGACY_STATE_IMPORTED or compatibility-
-- only PRESELECTED writes. Compare only events carrying resultingStateVersion.
WITH versioned AS (
  SELECT e."applicationId",
    (e.metadata->>'resultingStateVersion')::int AS resulting_version
  FROM "ApplicationEvent" e
  WHERE e.metadata->>'resultingStateVersion' ~ '^[0-9]+$'
), latest AS (
  SELECT "applicationId", max(resulting_version) AS resulting_version
  FROM versioned
  GROUP BY "applicationId"
)
SELECT count(*) AS snapshot_version_mismatches
FROM latest v
JOIN "Application" a ON a.id = v."applicationId"
WHERE a."stateVersion" <> v.resulting_version;

SELECT count(*) AS duplicate_resulting_versions
FROM (
  SELECT e."applicationId", e.metadata->>'resultingStateVersion' AS version
  FROM "ApplicationEvent" e
  WHERE e.metadata->>'resultingStateVersion' ~ '^[0-9]+$'
  GROUP BY 1, 2
  HAVING count(*) > 1
) duplicates;

-- 15. Event tenant consistency. Expected: zero.
SELECT count(*) AS event_company_mismatches
FROM "ApplicationEvent" e
JOIN "Application" a ON a.id = e."applicationId"
JOIN "Job" j ON j.id = a."jobId"
WHERE e."companyId" <> j."companyId";

-- 16. Current terminal timestamp inventory. Reopen legitimately clears
-- rejectedAt. Backward transitions preserve historical reviewing/interview/
-- offer timestamps, so their presence on an earlier stage is not an anomaly.
-- Imported historical rows may require provenance review rather than repair.
SELECT "stage", "disposition",
  count(*) AS rows,
  count(*) FILTER (
    WHERE "disposition" = 'REJECTED' AND "rejectedAt" IS NULL
  ) AS rejected_missing_rejected_at,
  count(*) FILTER (
    WHERE "disposition" = 'HIRED' AND "hiredAt" IS NULL
  ) AS hired_missing_hired_at
FROM "Application"
WHERE "stage" = 'CLOSED'
GROUP BY 1, 2
ORDER BY 1, 2;

-- 17. Active/closed and exact canonical state inventory.
SELECT CASE WHEN "stage" = 'CLOSED' THEN 'CLOSED' ELSE 'ACTIVE' END AS class,
  "stage", "disposition", count(*) AS rows
FROM "Application"
WHERE "stage" IS NOT NULL AND "disposition" IS NOT NULL
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

ROLLBACK;
```

### Interpretation rules that prevent false positives

- Do not require every historical canonical row to have `APPLICATION_CREATED`.
  Apply that assertion only to the confirmed writer-ON cohort.
- Do not equate total event count with `stateVersion`. Imported baselines and
  compatibility-only Preselecto writes have different contracts.
- Complete canonical `stateVersion = 0` is an inventory item, not automatically
  invalid.
- Do not use `updatedAt` alone as evidence of a hiring transition.
- Reopen from rejected clears `rejectedAt` and resets rejection-delivery state.
- Backward transitions preserve historical stage timestamps.
- Do not require a legacy projection for states without a universal mapping.
- `REVIEW / ACTIVE + MAYBE` remains the valid Preselecto compatibility marker;
  `MAYBE` is not HOLD.
- Use `recordedAt` for event persistence windows and `happenedAt` for logical
  order. Investigate clock/backdating anomalies before classifying them.

## Stop conditions

Stop closeout, preserve evidence, and investigate when any of these occurs:

- a newly created partial representation;
- an unexplained invalid canonical stage/disposition combination;
- a missing or duplicate creation event in the applicable writer-ON cohort;
- unexplained snapshot/version/event-chain divergence;
- cross-tenant data or authorization anomalies;
- candidate exposure of internal recruiter state;
- sustained route, writer, reader, or transition regression attributable to the
  rollout;
- business writes or ApplicationEvents caused solely by reader activation;
- loss of idempotency or duplicate business events;
- an unresolved incident that can affect integrity or rollback safety.

A pre-existing anomaly that is understood but unresolved still blocks closeout;
record its owner and remediation project instead of silently excluding it.

## Component-specific rollback

Use a deployed version that contains the compatibility bridge. Reverting to code
from before that bridge is not a safe writer rollback.

### Candidate reader regression

Set only:

```ini
CANONICAL_HIRING_PROCESS_CANDIDATE_READS_ENABLED=false
```

or unset it. Keep writer and recruiter-reader flags unchanged.

### Recruiter reader regression

Set only:

```ini
CANONICAL_HIRING_PROCESS_RECRUITER_READS_ENABLED=false
```

or unset it. Keep writer and candidate-reader behavior unchanged unless evidence
requires a separate rollback.

### New-Application writer regression

Set only:

```ini
CANONICAL_HIRING_PROCESS_ENABLED=false
```

or unset it. This changes representation selection for subsequent Application
creation. It does not convert existing canonical Applications to legacy.
Existing canonical Applications continue using canonical writer routing from
their persisted representation; fully legacy Applications continue using legacy
routing. Therefore writer-flag rollback alone does not contain a transition
defect affecting existing canonical rows. Treat that case as an incident and
deploy a targeted compatible fix.

For every rollback record operator, reason, effective UTC boundary, release SHA,
mixed-deployment interval, affected traffic, and follow-up checks. Rollback must
never delete canonical snapshots or ApplicationEvents, reset `stateVersion`,
rewrite historical Applications, backfill, or reconcile automatically.

## Final closeout criteria

Declare the canonical hiring-process rollout complete only when linked evidence
supports every criterion:

- zero unresolved partial/inconsistent representations;
- zero unexplained invalid canonical state combinations;
- correct creation-event behavior for the applicable writer-ON cohort;
- no unexplained duplicate creation events;
- natural canonical Application creation observed;
- natural canonical transition activity observed; absent or insufficient
  transition traffic extends observation and cannot be waived;
- recruiter readers validated on mixed canonical/legacy cohorts;
- candidate readers validated on canonical and legacy fallback rows;
- no sustained rollout-attributable runtime-error increase;
- sufficient operational traffic across the observation window;
- no unresolved rollout incident;
- the component-specific rollback procedure remains available and documented;
- an owner/operator is identified;
- explicit closeout approval is recorded.

`NO_TRAFFIC` and `INSUFFICIENT_TRAFFIC` cannot satisfy closeout. A full week
without enough natural traffic extends the observation window.

## Evidence register

Create one entry per activation, checkpoint, incident, rollback, or closeout
decision. Store references under the project's approved operational evidence
location; do not place secrets or candidate PII in this repository.

| Field | Required content |
| --- | --- |
| Record ID | Stable identifier |
| Record type | Activation, checkpoint, incident, rollback, or closeout |
| Deployed SHA | Exact Production commit |
| Deployment | Production deployment identifier/link |
| Effective flags | Values of writer, recruiter-reader, and candidate-reader flags |
| Activation timestamps | Effective UTC times, when known |
| Observation window | Start/end UTC and excluded mixed-runtime intervals |
| Query/check timestamps | UTC timestamps and approved query revision |
| Traffic observed | Natural creations, transitions, recruiter sessions, candidate sessions |
| Integrity results | Cohorts, anomalies, event/version and timestamp findings |
| Runtime health | Routes, errors, request volume, and attribution |
| Incidents | IDs, impact, status, and owner |
| Evidence gaps | Missing traffic/checks and extension decision |
| Observation state | One of the four defined states |
| Decision | Continue, extend, stop, rollback, or closeout |
| Operator/approver | Named accountable people and approval time |
| References | Redacted logs, dashboards, screenshots, and query outputs |

The final record must link the supplied 4A/4B/4C evidence rather than restating
it without references.

## Production state after approved closeout

Closeout itself changes no configuration or data. Unless a separately approved
rollback occurred, the recorded Production state remains:

```ini
CANONICAL_HIRING_PROCESS_ENABLED=true
CANONICAL_HIRING_PROCESS_RECRUITER_READS_ENABLED=true
CANONICAL_HIRING_PROCESS_CANDIDATE_READS_ENABLED=true
```

Record the effective values in the closeout evidence rather than inferring them
from the intended configuration.

## State preserved after 4D closeout

Closeout preserves:

- the compatibility bridge;
- legacy reader fallback;
- `Application.status` and `recruiterInterest`;
- legacy projections;
- all three feature flags;
- `stage`, `disposition`, and `stateVersion`;
- `ApplicationEvent` history;
- the current schema and mixed-cohort support.

Closeout does not assert that every historical legacy row is canonical, nor does
it authorize removal of rollback paths.

## Deferred decommission work

If desired, the following require a separate future project or slice with their
own eligibility criteria, recovery plan, data audit, and rollout:

- legacy data backfill or reconciliation;
- historical event reconstruction;
- removal of `Application.status`;
- removal of `recruiterInterest`;
- removal of legacy projections;
- removal of the compatibility bridge;
- removal of any feature flag;
- removal of legacy reader fallback;
- schema cleanup.

None of this work is part of Slice 4D.
