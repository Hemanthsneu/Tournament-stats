"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/admin";
import { cn } from "@/lib/utils";

type FormAction = (fd: FormData) => Promise<ActionResult | void>;

function report(res: ActionResult | void, success?: string): boolean {
  if (!res) return true; // redirected
  if (res.ok) {
    toast.success(res.message ?? success ?? "Saved");
    return true;
  }
  toast.error(res.error);
  return false;
}

/** Form that submits to a server action, shows a toast and keeps input on error. */
export function ActionForm({
  action,
  children,
  className,
  success,
  resetOnSuccess = false,
  confirm,
}: {
  action: FormAction;
  children: React.ReactNode;
  className?: string;
  success?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
}) {
  const [pending, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const ok = report(await action(fd), success);
          if (ok && resetOnSuccess) ref.current?.reset();
        });
      }}
    >
      <fieldset disabled={pending} className={cn("contents", pending && "[&_button[type=submit]]:opacity-60")}>
        {children}
      </fieldset>
    </form>
  );
}

/** One-click button for a bound server action (delete, release, move…). */
export function ActionButton({
  action,
  children,
  confirm,
  variant = "outline",
  size = "sm",
  className,
  title,
}: {
  action: () => Promise<ActionResult | void>;
  children: React.ReactNode;
  confirm?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  title?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      title={title}
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          report(await action());
        });
      }}
    >
      {children}
    </Button>
  );
}
