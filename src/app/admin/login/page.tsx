import Link from "next/link";
import { Crosshair } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { TextField } from "@/components/admin/fields";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { signIn } from "../actions";

export const metadata = { title: "Organizer login" };

export default function LoginPage() {
  return (
    <main className="grid flex-1 place-items-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6">
        <Link href="/" className="mb-6 flex items-center gap-2 font-heading text-lg font-extrabold">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Crosshair className="size-5" />
          </span>
          WOW <span className="text-primary">League</span>
        </Link>
        <h1 className="text-xl font-bold">Organizer login</h1>
        {isSupabaseConfigured ? (
          <ActionForm action={signIn} className="mt-4 grid gap-4">
            <TextField label="Email" name="email" type="email" autoComplete="email" required />
            <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
            <Button type="submit">Sign in</Button>
          </ActionForm>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Supabase isn&apos;t connected yet. Fill in <code>.env.local</code> (see README), then restart the app.
          </p>
        )}
      </div>
    </main>
  );
}
