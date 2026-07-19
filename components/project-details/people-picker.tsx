"use client";

import { useState } from "react";
import { ChevronsUpDown, X } from "lucide-react";
import type { Person } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function OwnerPicker({
  people,
  value,
  onChange,
  invalid,
}: {
  people: Person[];
  value: string;
  onChange: (personId: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = people.find((person) => person.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-invalid={invalid}
          className="w-full justify-between font-normal"
        >
          <span className={cn(!selected && "text-muted-foreground")}>
            {selected ? selected.name : "Select owner"}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Search people..." />
          <CommandList>
            <CommandEmpty>No people found.</CommandEmpty>
            <CommandGroup>
              {people.map((person) => (
                <CommandItem
                  key={person.id}
                  value={person.name}
                  data-checked={person.id === value}
                  onSelect={() => {
                    onChange(person.id);
                    setOpen(false);
                  }}
                >
                  {person.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function MembersPicker({
  people,
  value,
  onChange,
}: {
  people: Person[];
  value: string[];
  onChange: (personIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = people.filter((person) => value.includes(person.id));

  function toggle(personId: string) {
    if (value.includes(personId)) {
      onChange(value.filter((id) => id !== personId));
    } else {
      onChange([...value, personId]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
          >
            <span
              className={cn(selected.length === 0 && "text-muted-foreground")}
            >
              {selected.length > 0
                ? `${selected.length} member${selected.length === 1 ? "" : "s"}`
                : "Add team members"}
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command>
            <CommandInput placeholder="Search people..." />
            <CommandList>
              <CommandEmpty>No people found.</CommandEmpty>
              <CommandGroup>
                {people.map((person) => (
                  <CommandItem
                    key={person.id}
                    value={person.name}
                    data-checked={value.includes(person.id)}
                    onSelect={() => toggle(person.id)}
                  >
                    {person.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((person) => (
            <Badge key={person.id} variant="secondary" className="gap-1 pr-1">
              {person.name}
              <button
                type="button"
                aria-label={`Remove ${person.name}`}
                className="rounded-full p-0.5 hover:bg-foreground/10"
                onClick={() => toggle(person.id)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
