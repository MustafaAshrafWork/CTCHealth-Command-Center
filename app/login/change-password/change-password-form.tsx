"use client";

import { Eye, EyeOff } from "lucide-react";
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
  const [showPasswords, setShowPasswords] = useState(false);
  const [changed, setChanged] = useState(false);
  const [isPending, startTransition] = useTransition();

  const newTooShort = newPassword.length > 0 && newPassword.length < 8;
  const confirmMismatch =
    confirmPassword.length > 0 && confirmPassword !== newPassword;
  const canSubmit =
    !isPending &&
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    confirmPassword === newPassword;

  const fieldType = showPasswords ? "text" : "password";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Guards against implicit submission (Enter, password-manager autofill)
    // firing before every field is complete and matching.
    if (!canSubmit) {
      return;
    }

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

      setChanged(true);
    });
  }

  if (changed) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Password changed. Use your new password the next time you sign in —
          make sure you have it saved somewhere safe.
        </p>
        <Button
          className="w-full"
          onClick={() => {
            router.replace("/projects");
            router.refresh();
          }}
        >
          Continue
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-1.5">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          required
          autoFocus
          type={fieldType}
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
          type={fieldType}
          autoComplete="new-password"
          value={newPassword}
          disabled={isPending}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        {newTooShort ? (
          <p className="text-sm text-destructive">At least 8 characters.</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          required
          minLength={8}
          type={fieldType}
          autoComplete="new-password"
          value={confirmPassword}
          disabled={isPending}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        {confirmMismatch ? (
          <p className="text-sm text-destructive">Passwords do not match.</p>
        ) : null}
      </div>

      <button
        type="button"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        onClick={() => setShowPasswords((value) => !value)}
      >
        {showPasswords ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
        {showPasswords ? "Hide passwords" : "Show passwords"}
      </button>

      <Button type="submit" className="w-full" disabled={!canSubmit}>
        {isPending ? "Changing password…" : "Change password"}
      </Button>
    </form>
  );
}
