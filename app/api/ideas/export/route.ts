import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 403 });
  }

  const person = await db.person.findUnique({
    where: { id: session.personId },
    select: { isAdmin: true },
  });
  if (!person?.isAdmin) {
    return new Response("Unauthorized", { status: 403 });
  }

  const ideas = await db.idea.findMany({
    include: { author: true },
    orderBy: { createdAt: "desc" },
  });

  const rows = [
    "created_at,author,idea",
    ...ideas.map((idea) =>
      [
        csvField(idea.createdAt.toISOString()),
        csvField(idea.author.name),
        csvField(idea.text),
      ].join(","),
    ),
  ];
  const csv = "﻿" + rows.join("\r\n");

  const filename = `ideas-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
