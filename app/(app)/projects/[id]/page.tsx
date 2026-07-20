import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { computeHealth } from "@/lib/health";
import { sanitizePerson } from "@/lib/sanitize-person";
import { requireSession } from "@/lib/session";

import { ProjectDetail } from "./project-detail";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const isDemo = session.isDemo;

  const [project, people, actor] = await Promise.all([
    db.project.findUnique({
      where: { id, isDemo },
      include: {
        owner: true,
        members: { include: { person: true } },
        milestones: true,
        flags: true,
        weeklyUpdates: {
          include: { owner: true },
          orderBy: [{ weekOf: "desc" }, { createdDate: "desc" }],
        },
      },
    }),
    db.person.findMany({ where: { isDemo: false }, orderBy: { name: "asc" } }),
    db.person.findUnique({
      where: { id: session.personId },
      select: { isAdmin: true },
    }),
  ]);

  if (!project) {
    notFound();
  }

  const safeProject = {
    ...project,
    owner: sanitizePerson(project.owner),
    members: project.members.map((member) => ({
      ...member,
      person: sanitizePerson(member.person),
    })),
    weeklyUpdates: project.weeklyUpdates.map((update) => ({
      ...update,
      owner: sanitizePerson(update.owner),
    })),
  };

  const health = computeHealth({
    completed: project.completed,
    endDate: project.endDate,
    progress: project.progress,
  });
  const canEdit = Boolean(
    session.isDemo || actor?.isAdmin || project.ownerId === session.personId,
  );
  const canLogWeeklyUpdate = Boolean(
    session.isDemo || project.ownerId === session.personId,
  );

  return (
    <ProjectDetail
      project={safeProject}
      people={people.map(sanitizePerson)}
      health={health}
      canEdit={canEdit}
      canLogWeeklyUpdate={canLogWeeklyUpdate}
    />
  );
}
