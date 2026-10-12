"use client";

import { KeyRound } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { claimProfile } from "@/app/(site)/me/actions";

export function ClaimForm() {
  return (
    <ActionForm action={claimProfile} className="mt-4 flex flex-wrap gap-2">
      <div className="relative min-w-56 flex-1">
        <KeyRound className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="code" placeholder="e.g. WOW-7K3Q-PX" autoComplete="off" autoCapitalize="characters" className="pl-8 font-mono uppercase" required />
      </div>
      <Button type="submit">Claim my profile</Button>
    </ActionForm>
  );
}
