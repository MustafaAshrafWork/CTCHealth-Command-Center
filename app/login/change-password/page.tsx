import Image from "next/image";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { getSession } from "@/lib/session";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

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
            Change your password
          </h1>
          <p className="text-sm text-muted-foreground">{session.name}</p>
          <Badge variant="secondary">Minimum 8 characters</Badge>
        </div>

        <ChangePasswordForm />
      </div>
    </div>
  );
}
