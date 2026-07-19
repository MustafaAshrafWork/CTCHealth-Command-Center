import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { DeadlineAlertServer } from "@/components/notifications/deadline-alert-server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const person = await db.person.findUnique({
    where: { id: session.personId },
    select: { name: true, mustChangePassword: true, isAdmin: true },
  });
  if (!person) {
    redirect("/login");
  }
  if (person.mustChangePassword) {
    redirect("/login/change-password");
  }

  return (
    <div className="flex h-dvh flex-1">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userName={person.name} isAdmin={person.isAdmin} />
        <DeadlineAlertServer personId={session.personId} />
        <main className="min-h-0 flex-1 overflow-auto overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
