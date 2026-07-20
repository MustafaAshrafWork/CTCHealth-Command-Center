-- Every briefing milestone has an owner. Preserve existing milestone ids and
-- ranges while assigning legacy unowned rows to their parent project owner.
UPDATE "Milestone"
SET "assigneeId" = (
    SELECT "Project"."ownerId"
    FROM "Project"
    WHERE "Project"."id" = "Milestone"."projectId"
)
WHERE "assigneeId" IS NULL;

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00 +00:00',
    "endDate" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00 +00:00',
    "dueDate" DATETIME NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "assigneeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT,
    CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Milestone_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Milestone_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Milestone" (
    "id",
    "projectId",
    "name",
    "startDate",
    "endDate",
    "dueDate",
    "done",
    "assigneeId",
    "version",
    "createdAt",
    "updatedAt",
    "updatedById"
)
SELECT
    "id",
    "projectId",
    "name",
    "startDate",
    "endDate",
    "dueDate",
    "done",
    "assigneeId",
    "version",
    "createdAt",
    "updatedAt",
    "updatedById"
FROM "Milestone";

DROP TABLE "Milestone";
ALTER TABLE "new_Milestone" RENAME TO "Milestone";

CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");
CREATE INDEX "Milestone_updatedById_idx" ON "Milestone"("updatedById");
CREATE INDEX "Milestone_assigneeId_idx" ON "Milestone"("assigneeId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
