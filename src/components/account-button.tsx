"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRound } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { browserSupabase } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** "Sign in" or "My profile", read from the browser session (no server round-trip). */
export function AccountButton() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = browserSupabase();
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, [pathname]);

  if (!isSupabaseConfigured || signedIn === null) return null;
  return signedIn ? (
    <Button asChild size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
      <Link href="/me">
        <UserRound /> <span className="hidden sm:inline">Profile</span>
      </Link>
    </Button>
  ) : (
    <Button asChild size="sm" className="bg-hot font-semibold text-white hover:bg-hot/90">
      <Link href={`/login?next=${encodeURIComponent(pathname)}`}>Sign in</Link>
    </Button>
  );
}
