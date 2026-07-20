"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { Person } from "@prisma/client";

import { NewProjectDialog } from "@/components/project-details/new-project-dialog";
import { Button } from "@/components/ui/button";

export function NewProjectControl({
  people,
  currentPersonId,
  canChooseOwner,
}: {
  people: Person[];
  currentPersonId: string;
  canChooseOwner: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        New project
      </Button>
      <NewProjectDialog
        people={people}
        currentPersonId={currentPersonId}
        canChooseOwner={canChooseOwner}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
