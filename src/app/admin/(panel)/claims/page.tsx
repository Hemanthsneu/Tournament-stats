import { BadgeCheck, KeyRound } from "@/components/icons";
import { ActionButton, ActionForm } from "@/components/admin/action-form";
import { CopyButton } from "@/components/admin/copy-button";
import { Panel } from "@/components/admin/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadCommunity } from "@/lib/community";
import { loadLeague } from "@/lib/data";
import { sortedSeasons } from "@/lib/engine/league";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSessionClient } from "@/lib/supabase/server";
import { hasServiceKey, serviceSupabase } from "@/lib/supabase/service";
import { deleteClaimCode, generateAllClaimCodes, generateClaimCode, resetPlayerPassword, revokeClaim } from "../../claims-actions";

export const metadata = { title: "Claims · Admin" };

export default async function ClaimsAdmin() {
  const [{ idx }, community] = await Promise.all([loadLeague(true), loadCommunity()]);
  const codes = new Map<string, string>();
  const emails = new Map<string, string>();
  if (isSupabaseConfigured) {
    const db = await createSessionClient();
    const { data } = await db.from("claim_codes").select("player_id, code");
    for (const c of data ?? []) codes.set(c.player_id, c.code);
    if (hasServiceKey()) {
      const { data: users } = await serviceSupabase().auth.admin.listUsers({ perPage: 1000 });
      for (const u of users?.users ?? []) if (u.email) emails.set(u.id, u.email);
    }
  }
  const accounts = new Map(community.accounts.map((a) => [a.player_id, a]));
  const latest = sortedSeasons(idx.data)[0];
  const teamOf = (playerId: string) => {
    const r = idx.data.rosters.find((x) => x.player_id === playerId && x.season_id === latest?.id && !x.left_on);
    return r ? idx.teamById.get(r.team_id)?.tag : undefined;
  };
  const players = [...idx.data.players].sort((a, b) => Number(accounts.has(a.id)) - Number(accounts.has(b.id)) || a.ign.localeCompare(b.ign));
  const pending = players.filter((p) => !accounts.has(p.id) && codes.has(p.id));
  const whatsapp = [
    "*WOW League: claim your player profile*",
    "1. Open the site, tap Sign in → Create account",
    "2. Go to My profile and enter your code:",
    "",
    ...pending.map((p) => `${p.ign}: ${codes.get(p.id)}`),
  ].join("\n");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Player claims</h1>
        <span className="text-sm text-muted-foreground">
          {community.accounts.length} of {players.length} profiles claimed
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <ActionButton action={generateAllClaimCodes} variant="default" size="default">
            <KeyRound /> Generate codes for everyone unclaimed
          </ActionButton>
          {pending.length > 0 && <CopyButton text={whatsapp} label={`Copy ${pending.length} codes for WhatsApp`} />}
        </div>
      </div>
      <Panel
        title="How it works"
        description="Each player creates an account on the site, then enters their one-time code on My profile. The code is deleted once used. A claimed player can edit their photo, bio, role and socials, but never their stats."
      >
        {!hasServiceKey() && (
          <p className="text-xs text-muted-foreground">Claimer emails and password resets need SUPABASE_SERVICE_ROLE_KEY on the server.</p>
        )}
      </Panel>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b bg-muted/50 font-heading text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
              <th className="px-4 py-3 text-left font-semibold">Player</th>
              <th className="px-2 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const account = accounts.get(p.id);
              const code = codes.get(p.id);
              return (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{p.ign}</span>
                    {teamOf(p.id) && <span className="ml-2 text-xs text-muted-foreground">{teamOf(p.id)}</span>}
                  </td>
                  <td className="px-2 py-2.5">
                    {account ? (
                      <span className="inline-flex items-center gap-1 text-win">
                        <BadgeCheck className="size-4" /> Claimed{emails.get(account.user_id) ? ` by ${emails.get(account.user_id)}` : ""}
                      </span>
                    ) : code ? (
                      <span className="inline-flex items-center gap-2">
                        <code className="rounded bg-muted px-2 py-0.5 font-mono">{code}</code>
                        <CopyButton text={`${p.ign}: your WOW League claim code is ${code}`} size="icon-xs" variant="ghost" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No code yet</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap justify-end gap-1">
                      {account ? (
                        <>
                          {hasServiceKey() && (
                            <ActionForm action={resetPlayerPassword.bind(null, p.id)} resetOnSuccess confirm={`Set a new password for ${p.ign}?`} className="flex gap-1">
                              <Input name="password" type="text" placeholder="New password" minLength={8} className="h-8 w-36 text-xs" required />
                              <Button type="submit" size="sm" variant="secondary">
                                Reset password
                              </Button>
                            </ActionForm>
                          )}
                          <ActionButton action={revokeClaim.bind(null, p.id)} confirm={`Unlink ${p.ign}'s profile from its login?`} variant="ghost" className="text-loss">
                            Revoke
                          </ActionButton>
                        </>
                      ) : (
                        <>
                          <ActionButton action={generateClaimCode.bind(null, p.id)} confirm={code ? "Replace the current code? The old one stops working." : undefined}>
                            {code ? "New code" : "Generate code"}
                          </ActionButton>
                          {code && (
                            <ActionButton action={deleteClaimCode.bind(null, p.id)} variant="ghost">
                              Cancel code
                            </ActionButton>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
