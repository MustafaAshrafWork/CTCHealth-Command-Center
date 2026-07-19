"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Person } from "@prisma/client";

import { NewProjectDialog } from "@/components/project-details/new-project-dialog";
import { ProjectsTable } from "@/components/projects-table/projects-table";
import type { ProjectRow } from "@/components/projects-table/types";

export function ProjectsPageClient({
  rows,
  clientOptions,
  ownerOptions,
  totalCount,
  people,
  currentPersonId,
}: {
  rows: ProjectRow[];
  clientOptions: { value: string; label: string }[];
  ownerOptions: { value: string; label: string }[];
  totalCount: number;
  people: Person[];
  currentPersonId: string;
}) {
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);

  return (
    <>
      <ProjectsTable
        rows={rows}
        clientOptions={clientOptions}
        ownerOptions={ownerOptions}
        totalCount={totalCount}
        onRowClick={(id) => router.push(`/projects/${id}`)}
        onNewProject={() => setNewOpen(true)}
      />
      <NewProjectDialog
        people={people}
        currentPersonId={currentPersonId}
        open={newOpen}
        onOpenChange={setNewOpen}
      />
    </>
  );
}
