# Slice 4B — Recruiter reader cutover

## 4B-PR — Recruiter Reader Cutover Readiness

This PR prepares evidence and an operational procedure. It does not activate a
Production flag, deploy, authorize Production access, reconcile, backfill, or
modify application state. Operational status: **not started**.

### Reader contract

- `CANONICAL_HIRING_PROCESS_RECRUITER_READS_ENABLED` controls recruiter
  presentation and filtering only.
- With the flag ON, a complete representation (`stage` and `disposition` both
  non-null) uses canonical authority. This remains true at `stateVersion = 0`.
- A partial representation or a fully legacy representation uses
  `LEGACY_FALLBACK`; readers do not repair or reject it.
- Completeness is not semantic validation. A complete but invalid stage/
  disposition pair remains canonical input to the current read model and is an
  operational stop condition. This slice does not silently redesign it.
- `MAYBE` means PRESELECTED only for REVIEW/ACTIVE. Stale legacy fields cannot
  override canonical Interview, Offer, Rejected, Hired, HOLD or CLOSED_OTHER.
- Legacy URL aliases remain conservative: REVIEW -> APPLIED, MAYBE ->
  PRESELECTED, ACCEPTED -> INTERVIEW and REJECTED -> REJECTED. ACCEPTED never
  infers Offer or Hired.
- The writer flag remains ON. Writer routing continues to use persisted
  representation through the compatibility bridge. The candidate reader flag
  is independent and remains unchanged.

Readiness coverage adds one mixed-cohort OFF -> ON -> OFF cycle and focused
Kanban, selector, rail and per-job pending tests. Architecture guards restrict
the environment flag to approved read surfaces, isolate the mixed Kanban server
action, and keep the centralized read model free of persistence, events,
transitions, authorization, CAS, expectedVersion and idempotency concerns.

No schema, migration, UI, product-semantic or functional Production code change
is part of 4B-PR.

## 4B-OPS — Production Recruiter Reader Activation & Observation

**Outside this PR. Requires separate operational authorization.**

1. Record the approved release SHA, deployment, operator, UTC activation window,
   effective writer flag and both reader flags. Confirm the release contains the
   compatibility bridge and this readiness PR.
2. Preserve the current writer-cutover observation. Do not manufacture business
   data. New writer evidence remains a separate 4A-OPS concern.
3. Run the approved read-only baseline below. Any partial representation or
   semantically invalid complete pair blocks activation pending investigation;
   do not repair it in 4B.
4. An authorized operator changes only the recruiter reader flag to true through
   the normal release process. Record when it becomes effective. Keep the writer
   flag true and the candidate reader flag unchanged.
5. Observe existing recruiter surfaces and natural traffic: application list,
   candidate review rail/selector, overview/funnel, pending queue, job pending
   counts and Kanban. Compare their state buckets, not unrelated page totals.
6. Stop for unexplained bucket/count differences, legacy fields overriding a
   complete canonical row, writable terminal/unsupported states, partial rows
   presented as canonical, writer/event activity attributable solely to the
   flag change, authorization errors, or regressions in URLs and filters.
7. Record evidence and decision. No relevant rows or no recruiter traffic means
   observation is pending, not a pass. Sustained monitoring belongs to 4D.

### Expected OFF-mode differences

Legacy surfaces intentionally do not share one global pending definition:

- job aggregate pending counts use legacy `status = SUBMITTED`;
- overview and pending queue use legacy recruiter-interest semantics;
- application list and Kanban use legacy recruiter-interest buckets;
- the recruiter rail may suppress the APPLIED fallback label.

Therefore OFF-mode counts can differ without indicating a canonical-reader bug.
With the flag ON, compare the APPLIED bucket across overview, pending queue and
job aggregates for the same company/job and the same observation snapshot.
Kanban and the application list should place those same rows in Por revisar.
Concurrent applications or recruiter transitions must be accounted for.

### Future read-only verification (DO NOT run as part of 4B-PR)

Use an approved read-only role, a bounded timeout and one repeatable-read
snapshot. SQL below is a review template, not authorization to connect. Replace
placeholders and validate the query plan before Production use. Do not export
candidate PII or connection credentials.

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';

-- Persisted cohort distribution. Complete version-0 rows are CANONICAL.
SELECT CASE
  WHEN a."stage" IS NOT NULL AND a."disposition" IS NOT NULL THEN 'CANONICAL'
  WHEN a."stage" IS NULL AND a."disposition" IS NULL
    AND a."stateVersion" = 0 THEN 'LEGACY'
  ELSE 'PARTIAL_OR_INCONSISTENT'
END AS representation, count(*)
FROM "Application" a
GROUP BY 1;

SELECT count(*) AS complete_canonical_version_zero
FROM "Application"
WHERE "stage" IS NOT NULL AND "disposition" IS NOT NULL
  AND "stateVersion" = 0;

-- Structural anomalies: expected zero and an activation stop condition.
SELECT count(*) AS invalid_representation
FROM "Application"
WHERE ("stage" IS NULL) <> ("disposition" IS NULL)
   OR ("stage" IS NULL AND "disposition" IS NULL AND "stateVersion" <> 0);

-- Complete but semantically invalid canonical combinations. Readers do not
-- repair these rows; every result blocks activation pending investigation.
SELECT "stage", "disposition", "stateVersion", count(*)
FROM "Application"
WHERE "stage" IS NOT NULL AND "disposition" IS NOT NULL
  AND (("stage" = 'CLOSED') <>
       ("disposition" IN ('REJECTED', 'WITHDRAWN', 'HIRED', 'CANCELLED'))
       OR "stateVersion" < 0)
GROUP BY 1, 2, 3;

-- Reproduce the current recruiter read-model precedence. Partial/no canonical
-- representation takes the conservative legacy fallback branch.
WITH resolved AS (
  SELECT j."companyId", a."jobId", a.id,
    CASE
      WHEN a."stage" IS NULL OR a."disposition" IS NULL THEN
        CASE a."recruiterInterest"::text
          WHEN 'MAYBE' THEN 'PRESELECTED'
          WHEN 'ACCEPTED' THEN 'INTERVIEW'
          WHEN 'REJECTED' THEN 'REJECTED'
          ELSE 'APPLIED'
        END
      WHEN a."disposition" = 'REJECTED' THEN 'REJECTED'
      WHEN a."disposition" = 'HIRED' THEN 'HIRED'
      WHEN a."disposition" IN ('WITHDRAWN', 'CANCELLED') THEN 'CLOSED_OTHER'
      WHEN a."disposition" = 'HOLD' AND a."stage" <> 'CLOSED' THEN 'HOLD'
      WHEN a."stage" = 'CLOSED' THEN 'CLOSED_OTHER'
      WHEN a."stage" = 'APPLIED' THEN 'APPLIED'
      WHEN a."stage" = 'REVIEW' AND a."recruiterInterest" = 'MAYBE'
        THEN 'PRESELECTED'
      WHEN a."stage" = 'REVIEW' THEN 'REVIEW'
      WHEN a."stage" = 'ASSESSMENT' THEN 'ASSESSMENT'
      WHEN a."stage" = 'INTERVIEW' THEN 'INTERVIEW'
      WHEN a."stage" = 'OFFER' THEN 'OFFER'
      ELSE 'CLOSED_OTHER'
    END AS bucket
  FROM "Application" a
  JOIN "Job" j ON j.id = a."jobId"
)
SELECT "companyId", bucket, count(*)
FROM resolved
GROUP BY 1, 2
ORDER BY 1, 2;

-- Canonical/fallback APPLIED expectation used by overview, queue and job
-- aggregate presentation while recruiter readers are ON.
WITH resolved AS (
  SELECT j."companyId", a."jobId",
    CASE
      WHEN a."stage" IS NULL OR a."disposition" IS NULL THEN
        CASE WHEN a."recruiterInterest" = 'REVIEW' THEN 'APPLIED' ELSE 'OTHER' END
      WHEN a."disposition" = 'REJECTED' THEN 'REJECTED'
      WHEN a."disposition" = 'HIRED' THEN 'HIRED'
      WHEN a."disposition" IN ('WITHDRAWN', 'CANCELLED') THEN 'CLOSED_OTHER'
      WHEN a."disposition" = 'HOLD' AND a."stage" <> 'CLOSED' THEN 'HOLD'
      WHEN a."stage" = 'CLOSED' THEN 'CLOSED_OTHER'
      WHEN a."stage" = 'APPLIED' THEN 'APPLIED'
      ELSE 'OTHER'
    END AS bucket
  FROM "Application" a
  JOIN "Job" j ON j.id = a."jobId"
)
SELECT "companyId", "jobId", count(*) AS expected_applied
FROM resolved
WHERE bucket = 'APPLIED'
GROUP BY 1, 2
ORDER BY 1, 2;

-- Focused inventory for cutover observation. This includes the compatibility
-- PRESELECTED marker and supported terminal/supplemental presentation buckets.
WITH resolved AS (
  SELECT a.id,
    CASE
      WHEN a."stage" IS NULL OR a."disposition" IS NULL THEN
        CASE a."recruiterInterest"::text
          WHEN 'MAYBE' THEN 'PRESELECTED'
          WHEN 'ACCEPTED' THEN 'INTERVIEW'
          WHEN 'REJECTED' THEN 'REJECTED'
          ELSE 'APPLIED'
        END
      WHEN a."disposition" = 'REJECTED' THEN 'REJECTED'
      WHEN a."disposition" = 'HIRED' THEN 'HIRED'
      WHEN a."disposition" IN ('WITHDRAWN', 'CANCELLED') THEN 'CLOSED_OTHER'
      WHEN a."disposition" = 'HOLD' AND a."stage" <> 'CLOSED' THEN 'HOLD'
      WHEN a."stage" = 'CLOSED' THEN 'CLOSED_OTHER'
      WHEN a."stage" = 'REVIEW' AND a."recruiterInterest" = 'MAYBE'
        THEN 'PRESELECTED'
      WHEN a."stage" = 'OFFER' THEN 'OFFER'
      WHEN a."stage" = 'APPLIED' THEN 'APPLIED'
      WHEN a."stage" = 'REVIEW' THEN 'REVIEW'
      WHEN a."stage" = 'ASSESSMENT' THEN 'ASSESSMENT'
      WHEN a."stage" = 'INTERVIEW' THEN 'INTERVIEW'
      ELSE 'CLOSED_OTHER'
    END AS bucket
  FROM "Application" a
)
SELECT bucket, count(*)
FROM resolved
WHERE bucket IN
  ('PRESELECTED', 'OFFER', 'REJECTED', 'HIRED', 'HOLD', 'CLOSED_OTHER')
GROUP BY 1
ORDER BY 1;

ROLLBACK;
```

The SQL predicts presentation buckets only. It does not validate event chains,
select writers, modify rows, or authorize reconciliation. The UI comparison must
use the same company/job and observation snapshot. HOLD/CLOSED_OTHER appear in
overview and Kanban when populated but are not primary `pipeline=` filters.

### Rollback

An authorized operator restores only
`CANONICAL_HIRING_PROCESS_RECRUITER_READS_ENABLED` to false/unset using a release
that retains the compatibility bridge and recruiter reader implementation.
Keep `CANONICAL_HIRING_PROCESS_ENABLED=true`; leave the candidate reader flag
unchanged. Record the effective UTC boundary and mixed-deployment interval.

Rollback restores legacy recruiter presentation and legacy-generated URLs. It
does not revert canonical snapshots, events or writer transitions. Existing
canonical applications continue through canonical writers; fully legacy rows
continue through legacy writers. After rollback, verify the expected OFF-mode
differences above and confirm no state/event changes are attributable solely to
the reader flag. No backfill, reconciliation or data deletion is part of rollback.
