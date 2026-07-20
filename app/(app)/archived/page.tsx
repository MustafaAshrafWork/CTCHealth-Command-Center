import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import {
  ArchivedProjectsTable,
  type ArchivedProjectRow,
} from "@/app/(app)/archived/archived-projects-table";

export const dynamic = "force-dynamic";

const dateLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function ArchivedPage() {
  const session = await requireSession();
  const isDemo = session.isDemo;

  const [projects, actor] = await Promise.all([
    db.project.findMany({
      where: {
        isDemo,
        OR: [
          { archived: true },
          { completed: true, archived: false },
        ],
      },
      orderBy: [
        { archived: "asc" },
        { updatedAt: "desc" },
        { name: "asc" },
      ],
      select: {
        id: true,
        version: true,
        name: true,
        client: true,
        category: true,
        completed: true,
        archived: true,
        startDate: true,
        endDate: true,
        ownerId: true,
        owner: { select: { name: true } },
      },
    }),
    db.person.findUnique({
      where: { id: session.personId },
      select: { isAdmin: true },
    }),
  ]);

  const rows: ArchivedProjectRow[] = projects.map((project) => ({
    id: project.id,
    version: project.version,
    name: project.name,
    client: project.client,
    category: project.category,
    completed: project.completed,
    archived: project.archived,
    canEdit: Boolean(
      session.isDemo || actor?.isAdmin || project.ownerId === session.personId,
    ),
    ownerName: project.owner.name,
    startDateLabel: dateLabel.format(project.startDate),
    endDateLabel: dateLabel.format(project.endDate),
  }));

  return (
    <div className="flex flex-col gap-4">
      <header>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Completed &amp; archived projects
          </h1>
          <p className="text-sm text-muted-foreground">
            Archive completed work or return archived projects to the portfolio.
          </p>
        </div>
      </header>
      <ArchivedProjectsTable projects={rows} />
    </div>
  );
}
