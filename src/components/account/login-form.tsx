"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TextField } from "@/components/admin/fields";
import { Button } from "@/components/ui/button";
import { browserSupabase } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [pending, start] = useTransition();

  const submit = (fd: FormData) => {
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    if (mode === "signup") {
      if (password.length < 8) return toast.error("Use at least 8 characters for your password.");
      if (password !== fd.get("confirm")) return toast.error("Passwords don't match.");
    }
    start(async () => {
      const supabase = browserSupabase();
      const { error } =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (error) {
        toast.error(
          /already registered/i.test(error.message)
            ? "That email already has an account. Sign in instead."
            : /signups not allowed/i.test(error.message)
              ? "Player sign-ups aren't open yet."
              : error.message,
        );
        return;
      }
      toast.success(mode === "signin" ? "Signed in" : "Account created");
      router.replace(next);
      router.refresh();
    });
  };

  if (!isSupabaseConfigured) {
    return <p className="text-sm text-muted-foreground">Sign-in isn&apos;t available in demo mode.</p>;
  }

  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="mb-5 grid grid-cols-2 rounded-lg bg-muted p-1 text-sm">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn("rounded-md py-1.5 font-medium text-muted-foreground", mode === m && "bg-background text-foreground shadow-xs")}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <h1 className="text-xl font-bold">{mode === "signin" ? "Welcome back" : "Join the league"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "signin"
          ? "Players and captains sign in here."
          : "Create an account, then claim your player profile with the code your organizer sends you."}
      </p>
      <form
        className="mt-5 grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
      >
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          minLength={mode === "signup" ? 8 : undefined}
          required
        />
        {mode === "signup" && <TextField label="Repeat password" name="confirm" type="password" autoComplete="new-password" required />}
        <Button type="submit" disabled={pending}>
          {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
        {mode === "signin" && (
          <p className="text-center text-xs text-muted-foreground">Forgot your password? Ask an organizer to reset it.</p>
        )}
      </form>
    </div>
  );
}
