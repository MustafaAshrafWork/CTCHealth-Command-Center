"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { Person } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
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
import { quickAddPerson } from "@/lib/actions/people";
import { cn } from "@/lib/utils";

// Merges people quick-added this session into the server-provided list so a
// newly created person is selectable/visible before router.refresh() lands.
export function mergePeople(people: Person[], added: Person[]): Person[] {
  const extras = added.filter(
    (person) => !people.some((existing) => existing.id === person.id),
  );
  if (extras.length === 0) {
    return people;
  }
  return [...people, ...extras].sort((a, b) => a.name.localeCompare(b.name));
}

// Searchable person list with an "Add «name»" option as the first item when
// the query doesn't match an existing name. Creating persists the person for
// everyone (Person with canLogin: false) via quickAddPerson.
export function CreatablePersonCommand({
  people,
  placeholder,
  isSelected,
  onPick,
  onCreated,
}: {
  people: Person[];
  placeholder: string;
  isSelected: (personId: string) => boolean;
  onPick: (personId: string) => void;
  onCreated: (person: Person) => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const query = search.trim();
  const filtered = query
    ? people.filter((person) =>
        person.name.toLowerCase().includes(query.toLowerCase()),
      )
    : people;
  const exactMatch = people.some(
    (person) => person.name.toLowerCase() === query.toLowerCase(),
  );
  const showAdd = query.length > 0 && !exactMatch;

  function handleCreate() {
    if (!query || creating) {
      return;
    }
    setCreating(true);
    void quickAddPerson(query).then((result) => {
      setCreating(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSearch("");
      onCreated(result.data);
      router.refresh();
    });
  }

  return (
    <Command shouldFilter={false}>
      <CommandInput
        placeholder={placeholder}
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandGroup>
          {showAdd ? (
            <CommandItem
              value={`__add__:${query}`}
              disabled={creating}
              onSelect={handleCreate}
            >
              <Plus />
              Add &ldquo;{query}&rdquo;
            </CommandItem>
          ) : null}
          {filtered.map((person) => (
            <CommandItem
              key={person.id}
              value={person.id}
              data-checked={isSelected(person.id)}
              onSelect={() => onPick(person.id)}
            >
              {person.name}
            </CommandItem>
          ))}
        </CommandGroup>
        {!showAdd && filtered.length === 0 ? (
          <p className="py-6 text-center text-sm">No people found.</p>
        ) : null}
      </CommandList>
    </Command>
  );
}

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
  const [added, setAdded] = useState<Person[]>([]);
  const merged = mergePeople(people, added);
  const selected = merged.find((person) => person.id === value);

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
        <CreatablePersonCommand
          people={merged}
          placeholder="Search or add people..."
          isSelected={(personId) => personId === value}
          onPick={(personId) => {
            onChange(personId);
            setOpen(false);
          }}
          onCreated={(person) => {
            setAdded((prev) => [...prev, person]);
            onChange(person.id);
            setOpen(false);
          }}
        />
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
  const [added, setAdded] = useState<Person[]>([]);
  const merged = mergePeople(people, added);
  const selected = merged.filter((person) => value.includes(person.id));

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
          <CreatablePersonCommand
            people={merged}
            placeholder="Search or add people..."
            isSelected={(personId) => value.includes(personId)}
            onPick={toggle}
            onCreated={(person) => {
              setAdded((prev) => [...prev, person]);
              if (!value.includes(person.id)) {
                onChange([...value, person.id]);
              }
            }}
          />
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
