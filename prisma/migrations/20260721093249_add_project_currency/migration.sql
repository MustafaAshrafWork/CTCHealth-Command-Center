-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "budget" REAL,
    "currency" TEXT NOT NULL DEFAULT 'CHF',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "sharePointLink" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT NOT NULL,
    CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Project_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("archived", "budget", "category", "client", "completed", "createdAt", "createdById", "endDate", "id", "isDemo", "name", "notes", "ownerId", "priority", "progress", "sharePointLink", "startDate", "status", "updatedAt", "updatedById", "version") SELECT "archived", "budget", "category", "client", "completed", "createdAt", "createdById", "endDate", "id", "isDemo", "name", "notes", "ownerId", "priority", "progress", "sharePointLink", "startDate", "status", "updatedAt", "updatedById", "version" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");
CREATE INDEX "Project_endDate_idx" ON "Project"("endDate");
CREATE INDEX "Project_completed_idx" ON "Project"("completed");
CREATE INDEX "Project_archived_idx" ON "Project"("archived");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
