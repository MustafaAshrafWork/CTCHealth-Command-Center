import { GanttChart, type GanttRow } from "@/components/gantt/gantt-chart";
import {
  PortfolioControls,
  type PortfolioAttention,
} from "@/components/portfolio/portfolio-controls";
import { NewProjectControl } from "@/components/portfolio/new-project-control";
import { db } from "@/lib/db";
import { computeHealth, dateOnlyUTC } from "@/lib/health";
import {
  isDueWithin30Days,
  parsePortfolioSort,
  sortPortfolioRows,
} from "@/lib/portfolio";
import { sanitizePerson } from "@/lib/sanitize-person";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const CATEGORY_OPTIONS = [
  { value: "tech", label: "Tech" },
  { value: "consultancy", label: "Consultancy" },
  { value: "agency", label: "Agency" },
  { value: "agents", label: "Agents" },
] as const;

type SearchValue = string | string[] | null | undefined;

type TimelineSearchParams = {
  client?: SearchValue;
  owner?: SearchValue;
  category?: SearchValue;
  attention?: SearchValue;
  sort?: SearchValue;
};

function firstValue(value: SearchValue): string | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

function parseAttention(value: SearchValue): PortfolioAttention {
  const candidate = firstValue(value);
  return candidate === "critical" ||
    candidate === "risk" ||
    candidate === "due30"
    ? candidate
    : "active";
}

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<TimelineSearchParams>;
}) {
  const [params, session] = await Promise.all([searchParams, requireSession()]);
  const today = dateOnlyUTC(new Date());
  const sort = parsePortfolioSort(params.sort);
  const attention = parseAttention(params.attention);

  const [projects, people, actor] = await Promise.all([
    db.project.findMany({
      where: {
        archived: false,
        completed: false,
        isDemo: session.isDemo,
      },
      include: {
        owner: true,
        milestones: true,
        flags: { select: { id: true, status: true } },
      },
    }),
    db.person.findMany({
      where: { active: true, isDemo: false },
      orderBy: { name: "asc" },
    }),
    db.person.findUnique({
      where: { id: session.personId },
      select: { isAdmin: true },
    }),
  ]);

  const ownerOptions = Array.from(
    new Map(
      projects.map((project) => [
        project.ownerId,
        { value: project.ownerId, label: project.owner.name },
      ]),
    ).values(),
  ).sort((a, b) => a.label.localeCompare(b.label));
  const clientOptions = Array.from(
    new Set(projects.map((project) => project.client)),
  )
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
    .map((client) => ({ value: client, label: client }));

  const requestedClient = firstValue(params.client);
  const client = clientOptions.some((option) => option.value === requestedClient)
    ? requestedClient ?? null
    : null;
  const requestedOwner = firstValue(params.owner);
  const owner = ownerOptions.some((option) => option.value === requestedOwner)
    ? requestedOwner ?? null
    : null;
  const requestedCategory = firstValue(params.category);
  const category = CATEGORY_OPTIONS.some(
    (option) => option.value === requestedCategory,
  )
    ? requestedCategory ?? null
    : null;

  const scopedRows: GanttRow[] = projects
    .filter((project) => !client || project.client === client)
    .filter((project) => !owner || project.ownerId === owner)
    .filter((project) => !category || project.category === category)
    .map((project) => ({
      id: project.id,
      name: project.name,
      category: project.category,
      client: project.client,
      ownerName: project.owner.name,
      completed: project.completed,
      startDate: project.startDate.toISOString(),
      endDate: project.endDate.toISOString(),
      progress: project.progress,
      health: computeHealth(
        {
          completed: project.completed,
          endDate: project.endDate,
          progress: project.progress,
        },
        today,
      ),
      openBlockerCount: project.flags.filter((flag) => flag.status === "open")
        .length,
      milestones: project.milestones.map((milestone) => ({
        id: milestone.id,
        name: milestone.name,
        done: milestone.done,
        startDate: milestone.startDate.toISOString(),
        endDate: milestone.endDate.toISOString(),
      })),
    }));

  const counts = {
    active: scopedRows.length,
    critical: scopedRows.filter((project) => project.health === "red").length,
    risk: scopedRows.filter((project) => project.health === "amber").length,
    due30: scopedRows.filter((project) => isDueWithin30Days(project, today))
      .length,
  };

  const attentionRows = scopedRows.filter((project) => {
    switch (attention) {
      case "critical":
        return project.health === "red";
      case "risk":
        return project.health === "amber";
      case "due30":
        return isDueWithin30Days(project, today);
      case "active":
        return true;
    }
  });
  const rows = sortPortfolioRows(attentionRows, sort);

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>
          <p className="text-sm text-muted-foreground">
            Portfolio Gantt across {counts.active} active project
            {counts.active === 1 ? "" : "s"}.
          </p>
        </div>
        <NewProjectControl
          people={people.map(sanitizePerson)}
          currentPersonId={session.isDemo ? "" : session.personId}
          canChooseOwner={Boolean(session.isDemo || actor?.isAdmin)}
        />
      </header>

      <div className="rounded-lg border border-border bg-muted/35 px-4 py-3">
        <p className="text-sm font-medium text-foreground">
          {counts.critical} critical, {counts.risk} at risk, and {counts.due30} due
          within 30 days.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Due ≤30 days is upcoming only: project end dates from today through 30
          days from now. Overdue projects are excluded.
        </p>
      </div>

      <PortfolioControls
        attention={attention}
        category={category}
        categoryOptions={CATEGORY_OPTIONS.map((option) => ({ ...option }))}
        client={client}
        clientOptions={clientOptions}
        counts={counts}
        owner={owner}
        ownerOptions={ownerOptions}
        sort={sort}
      />

      <GanttChart rows={rows} />
    </div>
  );
}
