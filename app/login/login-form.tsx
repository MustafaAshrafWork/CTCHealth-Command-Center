"use client";

import { Fragment, useState, useTransition } from "react";
import { toast } from "sonner";

import { loginAs } from "@/lib/actions/people";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Person = { id: string; name: string };

export function LoginForm({ persons }: { persons: Person[] }) {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedPerson = persons.find(
    (person) => person.id === selectedPersonId,
  );

  function selectPerson(personId: string) {
    setSelectedPersonId(personId);
    setPassword("");
  }

  function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPersonId || !password) {
      return;
    }

    startTransition(async () => {
      const result = await loginAs(selectedPersonId, password);
      if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {persons.map((person) => {
        const selected = person.id === selectedPersonId;

        return (
          <Fragment key={person.id}>
            <Button
              type="button"
              variant={selected ? "default" : "outline"}
              size="lg"
              className="h-11 justify-center text-base"
              disabled={isPending}
              aria-expanded={selected}
              onClick={() => selectPerson(person.id)}
            >
              {person.name}
            </Button>

            {selected ? (
              <form
                className="mb-1 rounded-lg border border-border bg-muted/40 p-3"
                onSubmit={submitLogin}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="login-password">
                    Password for {selectedPerson?.name}
                  </Label>
                  <Input
                    id="login-password"
                    autoFocus
                    required
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    disabled={isPending}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  className="mt-3 w-full"
                  disabled={isPending || !password}
                >
                  {isPending ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
