import Link from "next/link";
import { redirect } from "next/navigation";
import { Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSessionClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/admin-nav";
import { signOut } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Demo mode (no Supabase yet): show the admin screens on sample data so organizers can look around.
  if (!isSupabaseConfigured) {
    return (
      <AdminShell email={null}>
        <div className="mb-6 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
          <b>Preview mode.</b> You&apos;re seeing the demo league, and changes won&apos;t be saved. Connect Supabase (see README) to
          use the real admin panel.
        </div>
        {children}
      </AdminShell>
    );
  }

  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");

  return (
    <AdminShell email={user.email ?? ""}>
      {isAdmin ? (
        children
      ) : (
        <div className="rounded-xl border p-8 text-center">
          <p className="font-medium">{user.email} is not on the organizer list.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add it with <code>ADMIN_EMAILS</code> and re-run <code>npm run db:setup</code>.
          </p>
        </div>
      )}
    </AdminShell>
  );
}

function AdminShell({ email, children }: { email: string | null; children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b bg-card/50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2 font-heading font-extrabold">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <Crosshair className="size-4" />
            </span>
            Admin
          </Link>
          <AdminNav />
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {email && <span className="hidden sm:inline">{email}</span>}
            <Button asChild variant="ghost" size="sm">
              <Link href="/">View site</Link>
            </Button>
            {email !== null && (
              <form action={signOut}>
                <Button variant="outline" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
