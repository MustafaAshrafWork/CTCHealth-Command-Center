"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type {
  Flag,
  Milestone,
  Person,
  Project,
  ProjectMember,
  WeeklyUpdate,
} from "@prisma/client";

import { FlagManager } from "@/components/flags/flag-manager";
import { DetailsTab } from "@/components/project-details/details-tab";
import { MilestoneSection } from "@/components/project-details/milestone-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WeeklyUpdateHistory } from "@/components/weekly-updates/weekly-update-history";
import { setArchived } from "@/lib/actions/projects";
import type { ProjectWithRelations } from "@/lib/actions/projects";
import { healthLabel, type Health } from "@/lib/health";
import { cn } from "@/lib/utils";

const HEALTH_DOT: Record<Health, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

const CATEGORY_LABEL: Record<string, string> = {
  tech: "Tech",
  consultancy: "Consultancy",
  agency: "Agency",
  agents: "Agents",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

type ProjectDetailData = Project & {
  owner: Person;
  members: (ProjectMember & { person: Person })[];
  milestones: Milestone[];
  flags: Flag[];
  weeklyUpdates: (WeeklyUpdate & { owner: Person })[];
};

export function ProjectDetail({
  project,
  people,
  health,
  canEdit,
}: {
  project: ProjectDetailData;
  people: Person[];
  health: Health;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleArchiveToggle() {
    startTransition(async () => {
      const result = await setArchived(
        [{ id: project.id, version: project.version }],
        !project.archived,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(project.archived ? "Project unarchived." : "Project archived.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <Button asChild variant="ghost" size="icon-sm" className="mt-0.5">
              <Link href="/timeline">
                <ArrowLeft />
                <span className="sr-only">Back to timeline</span>
              </Link>
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight">
                  {project.name}
                </h1>
                {project.archived ? (
                  <Badge variant="secondary">Archived</Badge>
                ) : null}
                {project.completed ? (
                  <Badge variant="secondary">Completed</Badge>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>{project.client}</span>
                <span aria-hidden>·</span>
                <span>{CATEGORY_LABEL[project.category] ?? project.category}</span>
                <span aria-hidden>·</span>
                <span>Owner: {project.owner.name}</span>
                <span aria-hidden>·</span>
                <span>
                  {dateFormatter.format(new Date(project.startDate))} →{" "}
                  {dateFormatter.format(new Date(project.endDate))}
                </span>
                <span aria-hidden>·</span>
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn("h-2 w-2 rounded-full", HEALTH_DOT[health])}
                  />
                  {healthLabel(health)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {project.sharePointLink ? (
              <Button asChild variant="outline" size="sm">
                <a
                  href={project.sharePointLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink data-icon="inline-start" />
                  SharePoint folder
                </a>
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  isPending || (!project.archived && !project.completed)
                }
                title={
                  !project.archived && !project.completed
                    ? "Mark the project complete before archiving it."
                    : undefined
                }
                onClick={handleArchiveToggle}
              >
                {project.archived ? "Unarchive" : "Archive"}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1.5 max-w-md flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${project.progress}%` }}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {project.progress}%
          </span>
        </div>
      </header>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(18rem,1fr)_minmax(0,2fr)]">
        <section className="rounded-lg border border-border">
          <h2 className="border-b px-4 py-2.5 text-sm font-medium">Details</h2>
          <DetailsTab
            key={project.id}
            project={project as ProjectWithRelations}
            people={people}
            mode="edit"
            canEdit={canEdit}
            onClose={() => router.refresh()}
          />
        </section>

        <div className="flex flex-col gap-4">
          <MilestoneSection
            projectId={project.id}
            projectStartDate={project.startDate}
            projectEndDate={project.endDate}
            ownerId={project.ownerId}
            people={people}
            milestones={project.milestones}
            canEdit={canEdit}
          />
          <FlagManager
            projectId={project.id}
            flags={project.flags}
            canEdit={canEdit}
          />
          <WeeklyUpdateHistory
            updates={project.weeklyUpdates.map((update) => ({
              id: update.id,
              weekOf: update.weekOf,
              summary: update.summary,
              priorities: update.priorities,
              createdDate: update.createdDate,
              ownerName: update.owner.name,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
