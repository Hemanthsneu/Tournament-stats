"use client";

import { Check, Copy } from "@/components/icons";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label, size = "sm", variant = "outline" }: { text: string; label?: string; size?: "sm" | "icon-xs"; variant?: "outline" | "ghost" }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      title={label ?? "Copy"}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        toast.success("Copied");
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check /> : <Copy />} {label}
    </Button>
  );
}
