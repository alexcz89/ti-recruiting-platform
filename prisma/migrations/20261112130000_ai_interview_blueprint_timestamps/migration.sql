-- The original blueprint table used timezone-less timestamps. Interpret its
-- existing values in the database session's timezone, then store real instants.
-- Future CURRENT_TIMESTAMP and clock_timestamp() writes retain their offsets.
BEGIN;

ALTER TABLE "AIInterviewBlueprintVersion"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
    USING "createdAt" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "approvedAt" TYPE TIMESTAMPTZ(3)
    USING "approvedAt" AT TIME ZONE current_setting('TimeZone');

COMMIT;
