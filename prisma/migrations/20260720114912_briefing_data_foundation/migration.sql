-- Preserve the existing Project rows while introducing the briefing's
-- explicit completion state and optional SharePoint folder link.
ALTER TABLE "Project" ADD COLUMN "completed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "sharePointLink" TEXT;

UPDATE "Project"
SET "completed" = CASE WHEN "status" = 'completed' THEN true ELSE false END;

CREATE INDEX "Project_completed_idx" ON "Project"("completed");

-- Existing milestones were point-in-time deliverables. Preserve that point as
-- a zero-duration range until an owner supplies the actual start date.
ALTER TABLE "Milestone" ADD COLUMN "startDate" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00 +00:00';
ALTER TABLE "Milestone" ADD COLUMN "endDate" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00 +00:00';

UPDATE "Milestone"
SET "startDate" = "dueDate", "endDate" = "dueDate";

-- Flags remain separate from narrative updates because their lifecycle must be
-- status-tracked and aggregated independently.
CREATE TABLE "Flag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "needs" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "raised" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Flag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Flag_projectId_idx" ON "Flag"("projectId");
CREATE INDEX "Flag_status_idx" ON "Flag"("status");

CREATE TABLE "WeeklyUpdate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "weekOf" DATETIME NOT NULL,
    "summary" TEXT NOT NULL,
    "priorities" TEXT NOT NULL,
    "rawTranscript" TEXT,
    "createdDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "WeeklyUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WeeklyUpdate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WeeklyUpdate_projectId_ownerId_weekOf_key" ON "WeeklyUpdate"("projectId", "ownerId", "weekOf");
CREATE INDEX "WeeklyUpdate_projectId_weekOf_idx" ON "WeeklyUpdate"("projectId", "weekOf");
CREATE INDEX "WeeklyUpdate_ownerId_weekOf_idx" ON "WeeklyUpdate"("ownerId", "weekOf");
