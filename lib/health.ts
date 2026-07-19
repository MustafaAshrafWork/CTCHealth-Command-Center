export type Health = "green" | "amber" | "red";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;

export function dateOnlyUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function computeHealth(
  project: { status: string; endDate: Date; progress: number },
  today: Date = new Date(),
): Health {
  if (project.status === "completed") {
    return "green";
  }

  const normalizedEndDate = dateOnlyUTC(project.endDate);
  const normalizedToday = dateOnlyUTC(today);
  const daysLeft =
    (normalizedEndDate.getTime() - normalizedToday.getTime()) /
    MILLISECONDS_PER_DAY;

  if (daysLeft <= 1) {
    return "red";
  }

  if (daysLeft <= 14 && project.progress < 80) {
    return "red";
  }

  if (daysLeft <= 30 && project.progress < 50) {
    return "amber";
  }

  return "green";
}

export function deriveProgress(doneCount: number, totalCount: number): number {
  if (totalCount <= 0) {
    return 0;
  }
  return Math.round((100 * doneCount) / totalCount);
}

export function healthLabel(health: Health): string {
  switch (health) {
    case "green":
      return "On track";
    case "amber":
      return "At risk";
    case "red":
      return "Critical";
  }
}
