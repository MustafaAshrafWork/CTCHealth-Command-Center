"use client";

import { useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type FilterOption = { value: string; label: string };

function FilterTrigger({
  label,
  selectedCount,
  ...props
}: {
  label: string;
  selectedCount: number;
} & React.ComponentProps<typeof Button>) {
  // Radix `asChild` triggers clone their props (onClick, ref, aria) onto this
  // component — they must be spread through to the Button or clicks are lost.
  return (
    <Button variant="outline" size="sm" {...props}>
      {label}
      {selectedCount > 0 ? (
        <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-semibold">
          {selectedCount}
        </span>
      ) : null}
    </Button>
  );
}

export function FilterDropdown({
  label,
  options,
  selected,
  onToggle,
  searchable = false,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (searchable) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FilterTrigger label={label} selectedCount={selected.length} />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 gap-0 p-0">
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>No matches found.</CommandEmpty>
              <CommandGroup heading={label}>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    data-checked={selected.includes(option.value)}
                    onSelect={() => onToggle(option.value)}
                  >
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterTrigger label={label} selectedCount={selected.length} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selected.includes(option.value)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => onToggle(option.value)}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
