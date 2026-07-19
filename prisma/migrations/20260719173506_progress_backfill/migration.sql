-- One-time backfill: progress is derived from deliverables only.
-- Recompute for projects with milestones (round(100*done/total)) and reset
-- zero-milestone projects to 0, matching lib/health.ts deriveProgress.
UPDATE "Project"
SET "progress" = COALESCE(
  (
    SELECT CAST(ROUND((100.0 * SUM(CASE WHEN "m"."done" THEN 1 ELSE 0 END)) / COUNT(*)) AS INTEGER)
    FROM "Milestone" "m"
    WHERE "m"."projectId" = "Project"."id"
  ),
  0
);
