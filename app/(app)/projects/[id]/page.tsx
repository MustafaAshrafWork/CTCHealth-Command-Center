import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { computeHealth } from "@/lib/health";
import type { ProjectWithRelations } from "@/lib/actions/projects";

import { ProjectDetail } from "./project-detail";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [project, people] = await Promise.all([
    db.project.findUnique({
      where: { id },
      include: {
        owner: true,
        members: { include: { person: true } },
        milestones: true,
      },
    }),
    db.person.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!project) {
    notFound();
  }

  const health = computeHealth({
    status: project.status,
    endDate: project.endDate,
    progress: project.progress,
  });

  return (
    <ProjectDetail
      project={project as ProjectWithRelations}
      people={people}
      health={health}
    />
  );
}
