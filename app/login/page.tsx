import Image from "next/image";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { LoginForm } from "./login-form";

const PERSONA_ORDER = [
  "Thomas Mrosk",
  "Eman Osama",
  "Manuel Mitola",
  "Nataliya Boyko",
  "Torben Guijarro",
  "Mai Ibrahim",
  "Mustafa Ashraf",
] as const;

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/projects");
  }

  const persons = await db.person.findMany({
    where: { canLogin: true, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const sortedPersons = [...persons].sort((a, b) => {
    const aIndex = PERSONA_ORDER.indexOf(a.name as (typeof PERSONA_ORDER)[number]);
    const bIndex = PERSONA_ORDER.indexOf(b.name as (typeof PERSONA_ORDER)[number]);
    const aRank = aIndex === -1 ? PERSONA_ORDER.length : aIndex;
    const bRank = bIndex === -1 ? PERSONA_ORDER.length : bIndex;
    return aRank - bRank;
  });

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-muted/40 p-6">
      <Image
        src="/logos/logo-on-light.png"
        alt="ctcHealth"
        width={2737}
        height={1042}
        className="h-auto w-48"
        priority
      />

      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl font-semibold text-foreground">
            ctcHealth Command Center
          </h1>
          <Badge variant="secondary">MVP · Pilot</Badge>
        </div>

        <LoginForm persons={sortedPersons} />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Pilot build — use the password provided by your administrator.
        </p>
      </div>
    </div>
  );
}
