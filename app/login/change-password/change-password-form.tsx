"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/lib/actions/people";

export function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Password changed.");
      router.replace("/projects");
      router.refresh();
    });
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-1.5">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          required
          autoFocus
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          disabled={isPending}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          required
          minLength={8}
          type="password"
          autoComplete="new-password"
          value={newPassword}
          disabled={isPending}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          required
          minLength={8}
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          disabled={isPending}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={
          isPending ||
          !currentPassword ||
          newPassword.length < 8 ||
          confirmPassword.length < 8
        }
      >
        {isPending ? "Changing password…" : "Change password"}
      </Button>
    </form>
  );
}
