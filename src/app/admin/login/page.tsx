import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { TextField } from "@/components/admin/fields";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { signIn } from "../actions";

export const metadata = { title: "Organizer login" };

export default function LoginPage() {
  return (
    <main className="grid flex-1 place-items-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8">
        <Link href="/" className="mb-8 flex items-baseline gap-1.5 leading-none">
          <span className="font-heading text-[28px] italic">WOW</span>
          <span className="text-sm font-medium text-muted-foreground">League</span>
        </Link>
        <h1 className="text-3xl">Organizer login</h1>
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
