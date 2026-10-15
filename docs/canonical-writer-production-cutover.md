# Slice 4A — Writer cutover

## 4A-PR — Writer Cutover Readiness

This PR prepares evidence and an operational procedure. It does not activate
Production, authorize Production access, deploy, reconcile, or backfill data.
Operational status: **not started**. Readiness tests are not activation evidence.

### Persisted representation contract (PR #44)

- At creation only, `CANONICAL_HIRING_PROCESS_ENABLED=true` creates
  APPLIED/ACTIVE, version 1, SUBMITTED/REVIEW and one INTERNAL APPLICATION_CREATED
  event atomically. False/unset creates null/null, version 0 and no event.
- `stage != null && disposition != null` is a complete canonical representation,
  **including stateVersion === 0**. Existing canonical rows use canonical writers
  regardless of the creation flag. Completeness does not make an invalid state
  pair valid; transition validation remains required.
- Null/null/version-0 rows remain on legacy writers regardless of the flag.
- Partial representation or null/null with nonzero version fails closed.
- Exact legacy tuple restrictions and canonical transition rules remain in force.
- Reader flags are independent and are not changed in 4A.

Coverage: existing creation/routing/terminal/auth/CAS tests plus one coexisting
cohort OFF -> ON -> OFF lifecycle with replay after rollback. The architecture
guard restricts writer-flag consumption to the flag definition and creation
selector, and requires representation routing in intents and overview.

Validation: focused compatibility tests, relevant writer/engine/architecture
tests, isolated local PostgreSQL integration, type-check and diff whitespace
check. Keep schema, migrations, runtime semantics and remote settings unchanged.

## 4A-OPS — Production Writer Activation & Observation

**Outside this PR. Requires separate operational authorization.**

1. Record owner, approved release SHA, current deployment and effective writer
   and reader flags. Verify the release includes PR #44 and compatible schema.
2. Preserve staging QA evidence (five compatibility combinations). Record local
   readiness results. Do not manufacture Production applications for QA.
3. An authorized operator sets only the writer creation flag to true through
   the normal release process. Record when the new configuration is effective;
   setting an environment variable alone is not proof of runtime activation.
4. Observe normal traffic and the read-only checks below. Keep a separate
   activation interval, excluding mixed-deployment/in-flight boundary requests.
   Record those boundary requests separately rather than silently ignoring them.
5. Stop progression for unexpected partial rows, missing/duplicate creation
   events, invalid state pairs, projection corruption, blocked valid cohorts,
   unauthorized access, or replay/concurrency failures. Do not repair data here.
6. Record observed counts, time window, release SHA, errors and operator decision.
   Zero new applications means insufficient creation evidence, not a pass.
   Sustained monitoring belongs to 4D; reader activation belongs to 4B/4C.

### Future read-only verification (DO NOT run as part of 4A-PR)

Use an approved read-only role/session and bounded timeout. SQL below is a
review template, not an authorization to connect. Use UTC timestamps matching
the schema's timestamp-without-time-zone storage. Replace placeholders before
execution. Do not export candidate PII or connection secrets. Full-table cohort
checks can be expensive: obtain an approved observation window/plan first.

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';

-- Cohort distribution. Complete version-0 snapshots remain CANONICAL.
SELECT CASE
  WHEN "stage" IS NOT NULL AND "disposition" IS NOT NULL THEN 'CANONICAL'
  WHEN "stage" IS NULL AND "disposition" IS NULL AND "stateVersion" = 0 THEN 'LEGACY'
  ELSE 'PARTIAL_OR_INCONSISTENT'
END AS representation, count(*)
FROM "Application" GROUP BY 1;

-- Structural anomalies: expected zero; a nonzero baseline blocks activation
-- pending investigation, not automatic reconciliation.
SELECT count(*) AS invalid_representation
FROM "Application"
WHERE ("stage" IS NULL) <> ("disposition" IS NULL)
   OR ("stage" IS NULL AND "disposition" IS NULL AND "stateVersion" <> 0);

-- Complete but invalid canonical state pairs or invalid versions.
SELECT "stage", "disposition", "stateVersion", count(*)
FROM "Application"
WHERE "stage" IS NOT NULL AND "disposition" IS NOT NULL
  AND (("stage" = 'CLOSED') <>
       ("disposition" IN ('REJECTED', 'HIRED', 'WITHDRAWN', 'CANCELLED'))
       OR "stateVersion" < 0)
GROUP BY 1, 2, 3;

-- Valid but not completed lifecycle slices: inventory separately, never
-- reinterpret HOLD as Preselecto or automatically transition these rows.
SELECT "stage", "disposition", count(*)
FROM "Application"
WHERE "stage" = 'ASSESSMENT'
   OR "disposition" IN ('HOLD', 'WITHDRAWN', 'CANCELLED')
GROUP BY 1, 2;

-- Exact observed tuples expose unsupported/ambiguous legacy combinations.
-- Compare against the individual intent contracts, not a guessed global map:
-- ACCEPTED is historically ambiguous; this query performs no normalization.
SELECT "stage", "disposition", "status", "recruiterInterest", count(*)
FROM "Application" GROUP BY 1, 2, 3, 4;

-- New applications in the confirmed flag-ON interval: each must still be
-- canonical (it may already have advanced beyond APPLIED), version >= 1,
-- with exactly one correct creation event and no wrong-tenant creation event.
-- Replace both placeholders with approved UTC timestamps.
WITH cohort AS (
  SELECT a.*, j."companyId" FROM "Application" a
  JOIN "Job" j ON j.id = a."jobId"
  WHERE a."createdAt" >= TIMESTAMP '<effective_on_utc>'
    AND a."createdAt" < TIMESTAMP '<observation_end_utc>'
), evidence AS (
  SELECT a.id, a."stage", a."disposition", a."stateVersion",
    count(e.id) AS creation_events,
    count(e.id) FILTER (WHERE e."fromStage" IS NULL
      AND e."fromDisposition" IS NULL AND e."toStage" = 'APPLIED'
      AND e."toDisposition" = 'ACTIVE' AND e.visibility = 'INTERNAL'
      AND e."companyId" = a."companyId"
      AND e."actorType" = 'CANDIDATE' AND e."actorId" = a."candidateId"
      AND e.metadata->>'resultingStateVersion' = '1') AS valid_creation_events
  FROM cohort a LEFT JOIN "ApplicationEvent" e
    ON e."applicationId" = a.id AND e.type = 'APPLICATION_CREATED'
  GROUP BY a.id, a."stage", a."disposition", a."stateVersion"
)
SELECT count(*) AS observed_new_applications,
  count(*) FILTER (WHERE "stage" IS NULL OR "disposition" IS NULL
    OR "stateVersion" < 1 OR creation_events <> 1
    OR valid_creation_events <> 1) AS failures
FROM evidence;

-- Historical canonical/imported rows need not have APPLICATION_CREATED.
-- Do not apply the new-cohort assertion retroactively.
ROLLBACK;
```

Projection and event-chain checks require intent context: PRESELECTED is a
compatibility marker inside REVIEW/ACTIVE; clearing it does not increment the
canonical version or create a fake stage event. Review failures with existing
contracts and deployment logs. Do not equate total event count to stateVersion
for every historical/imported row. The existing local divergence-report script
is not a Production verifier and its environment safeguards must not be bypassed.

### Rollback

An authorized operator restores writer flag false/unset using a release that
**still includes the compatibility bridge**. Do not roll back to pre-PR-44 code.
Record the effective rollback UTC boundary and exclude mixed-runtime requests.
New applications thereafter should be null/null/version-0 without creation
events. Existing canonical applications must continue canonical transitions,
CAS, idempotency and legacy projection updates; existing legacy applications
remain legacy. Reader flags stay unchanged. No snapshots/events are deleted.

For future read-only rollback verification, reuse the bounded cohort query with
the effective OFF interval, changing its failure predicate to:

```sql
"stage" IS NOT NULL OR "disposition" IS NOT NULL
OR "stateVersion" <> 0 OR creation_events <> 0
```

Observe naturally occurring transitions for pre-rollback canonical rows and
confirm representation is retained and command replay does not duplicate events.
If there is no traffic, record the observation as pending. Production completion
requires separate activation/observation evidence; merging readiness is not it.
