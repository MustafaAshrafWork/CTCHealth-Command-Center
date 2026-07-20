import type { Health } from "@/lib/health";

import {
  BlockersPanel,
  type LeadershipFlag,
} from "@/components/leadership/blockers-panel";
import {
  HealthByClient,
  type ClientHealthRow,
} from "@/components/leadership/health-by-client";
import { HeadlineSummary } from "@/components/leadership/headline-summary";
import { LeadershipControls } from "@/components/leadership/leadership-controls";
import {
  ManagerProjects,
  type ManagerProjectRow,
} from "@/components/leadership/manager-projects";
import {
  WeeklyUpdatesPanel,
  type LeadershipWeeklyUpdate,
} from "@/components/leadership/weekly-updates-panel";
import { db } from "@/lib/db";
import { computeHealth, dateOnlyUTC } from "@/lib/health";
import {
  isDueWithin30Days,
  parsePortfolioSort,
  sortPortfolioRows,
} from "@/lib/portfolio";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;
const HEALTH_RANK: Record<Health, number> = { red: 0, amber: 1, green: 2 };

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function daysRemaining(endDate: Date, today: Date): number {
  return Math.round(
    (dateOnlyUTC(endDate).getTime() - dateOnlyUTC(today).getTime()) /
      MILLISECONDS_PER_DAY,
  );
}

export default async function LeadershipPage({
  searchParams,
}: {
  searchParams: Promise<{
    owner?: string | string[];
    sort?: string | string[];
  }>;
}) {
  const [session, params] = await Promise.all([requireSession(), searchParams]);
  const sort = parsePortfolioSort(params.sort);

  const [projects, allProjectOwners, allFlags, allWeeklyUpdates] = await Promise.all([
    db.project.findMany({
      where: {
        archived: false,
        completed: false,
        isDemo: session.isDemo,
      },
      include: {
        owner: { select: { id: true, name: true } },
        flags: true,
      },
    }),
    db.project.findMany({
      where: { isDemo: session.isDemo },
      select: { owner: { select: { id: true, name: true } } },
    }),
    db.flag.findMany({
      where: { project: { isDemo: session.isDemo } },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            client: true,
            ownerId: true,
          },
        },
      },
    }),
    db.weeklyUpdate.findMany({
      where: { project: { isDemo: session.isDemo } },
      include: {
        owner: { select: { id: true, name: true } },
        project: {
          select: {
            id: true,
            name: true,
            client: true,
            ownerId: true,
            completed: true,
            archived: true,
          },
        },
      },
      orderBy: [{ weekOf: "desc" }, { createdDate: "desc" }],
    }),
  ]);
  const owners = Array.from(
    new Map(
      [
        ...allProjectOwners.map((project) => project.owner),
        ...allWeeklyUpdates.map((update) => update.owner),
      ].map((owner) => [owner.id, owner]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const requestedOwnerId = firstValue(params.owner);
  const selectedOwner = owners.find((owner) => owner.id === requestedOwnerId);
  const ownerId = selectedOwner?.id ?? "all";
  const today = dateOnlyUTC(new Date());

  const portfolioRows = projects.map((project) => ({
    ...project,
    health: computeHealth(
      {
        completed: project.completed,
        endDate: project.endDate,
        progress: project.progress,
      },
      today,
    ),
  }));
  const visibleRows = selectedOwner
    ? portfolioRows.filter((project) => project.ownerId === selectedOwner.id)
    : portfolioRows;

  const critical = visibleRows.filter((project) => project.health === "red").length;
  const atRisk = visibleRows.filter((project) => project.health === "amber").length;
  const dueWithin30Days = visibleRows.filter((project) =>
    isDueWithin30Days(project, today),
  ).length;

  const flags: LeadershipFlag[] = allFlags
    .filter((flag) =>
      selectedOwner
        ? flag.project.ownerId === selectedOwner.id
        : flag.status === "open",
    )
    .sort(
      (a, b) =>
        Number(a.status !== "open") - Number(b.status !== "open") ||
        b.raised.getTime() - a.raised.getTime(),
    );

  const weeklyUpdates: LeadershipWeeklyUpdate[] = allWeeklyUpdates
    .filter(
      (update) =>
        !selectedOwner || update.ownerId === selectedOwner.id,
    )
    .map((update) => ({
      id: update.id,
      weekOf: update.weekOf,
      summary: update.summary,
      priorities: update.priorities,
      ownerName: update.owner.name,
      project: {
        id: update.project.id,
        name: update.project.name,
        client: update.project.client,
        completed: update.project.completed,
        archived: update.project.archived,
      },
    }));

  const headline = (
    <HeadlineSummary
      critical={critical}
      atRisk={atRisk}
      dueWithin30Days={dueWithin30Days}
      scopeLabel={
        selectedOwner ? `${selectedOwner.name}'s portfolio` : "Company portfolio"
      }
    />
  );

  let lowerPanels: React.ReactNode;

  if (selectedOwner) {
    const managerRows: ManagerProjectRow[] = sortPortfolioRows(
      visibleRows.map((project) => ({
        id: project.id,
        name: project.name,
        client: project.client,
        startDate: project.startDate,
        endDate: project.endDate,
        health: project.health,
        progress: project.progress,
        daysRemaining: daysRemaining(project.endDate, today),
      })),
      sort,
    );

    lowerPanels = (
      <>
        <BlockersPanel flags={flags} includeResolved />
        <ManagerProjects rows={managerRows} />
        <WeeklyUpdatesPanel updates={weeklyUpdates} />
      </>
    );
  } else {
    const rowsByClient = new Map<string, ClientHealthRow>();

    for (const project of visibleRows) {
      const current = rowsByClient.get(project.client);
      const openBlockers = project.flags.filter(
        (flag) => flag.status === "open",
      ).length;

      if (!current) {
        rowsByClient.set(project.client, {
          client: project.client,
          projectCount: 1,
          blockerCount: openBlockers,
          worstHealth: project.health,
        });
        continue;
      }

      current.projectCount += 1;
      current.blockerCount += openBlockers;
      if (HEALTH_RANK[project.health] < HEALTH_RANK[current.worstHealth]) {
        current.worstHealth = project.health;
      }
    }

    const clientRows = Array.from(rowsByClient.values()).sort(
      (a, b) =>
        HEALTH_RANK[a.worstHealth] - HEALTH_RANK[b.worstHealth] ||
        a.client.localeCompare(b.client, "en", { sensitivity: "base" }),
    );

    lowerPanels = (
      <>
        <BlockersPanel flags={flags} includeResolved={false} />
        <HealthByClient rows={clientRows} />
        <WeeklyUpdatesPanel updates={weeklyUpdates} />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leadership</h1>
          <p className="text-sm text-muted-foreground">
            Start with the company picture, then narrow to an owner or project.
          </p>
        </div>
        <LeadershipControls
          owners={owners}
          ownerId={ownerId}
          sort={sort}
        />
      </header>

      {headline}

      <div className="grid gap-3">{lowerPanels}</div>
    </div>
  );
}
