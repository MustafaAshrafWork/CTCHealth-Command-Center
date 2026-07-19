import { db } from "@/lib/db";
import { computeHealth, dateOnlyUTC } from "@/lib/health";
import {
  DeadlineAlert,
  type DeadlineAlertItem,
} from "@/components/notifications/deadline-alert";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;

const dateLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export async function DeadlineAlertServer({
  personId,
}: {
  personId: string;
}) {
  const projects = await db.project.findMany({
    where: {
      archived: false,
      status: { not: "completed" },
    },
    orderBy: { endDate: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      endDate: true,
      progress: true,
    },
  });

  const today = dateOnlyUTC(new Date());
  const sevenDaysFromToday = dateOnlyUTC(
    new Date(today.getTime() + 7 * MILLISECONDS_PER_DAY),
  );
  const items = projects.flatMap<DeadlineAlertItem>((project) => {
    const endDate = dateOnlyUTC(project.endDate);
    const isOverdue = endDate.getTime() < today.getTime();
    const isDueSoon =
      endDate.getTime() >= today.getTime() &&
      endDate.getTime() <= sevenDaysFromToday.getTime();

    if (!isOverdue && !isDueSoon) {
      return [];
    }

    return [
      {
        id: project.id,
        name: project.name,
        endDateLabel: dateLabel.format(endDate),
        health: computeHealth(project, today),
        timing: isOverdue ? "overdue" : "due-soon",
      },
    ];
  });

  if (items.length === 0) {
    return null;
  }

  const overdueCount = items.filter(
    (item) => item.timing === "overdue",
  ).length;
  const dueSoonCount = items.length - overdueCount;

  return (
    <DeadlineAlert
      personId={personId}
      overdueCount={overdueCount}
      dueSoonCount={dueSoonCount}
      items={items}
    />
  );
}
