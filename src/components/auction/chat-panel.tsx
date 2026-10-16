"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { X } from "@/components/icons";
import { onColor, teamColor } from "@/lib/team-colors";
import type { AuctionMessage, Team } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX = 200;
const QUICK = ["Steal!", "Overpaid", "GG", "Let's gooo", "Bid more!", "Worth it"];

/** Live chat for one auction: last 80 messages, then inserts/deletes as they happen. */
export function useAuctionChat(sb: SupabaseClient, auctionId: string) {
  const [messages, setMessages] = useState<AuctionMessage[]>([]);

  const load = useCallback(async () => {
    const { data } = await sb.from("auction_messages").select("*").eq("auction_id", auctionId).order("id", { ascending: false }).limit(80);
    if (data) setMessages((data as AuctionMessage[]).reverse());
  }, [sb, auctionId]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const ch = sb
      .channel(`auction-chat-${auctionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "auction_messages", filter: `auction_id=eq.${auctionId}` }, ({ new: m }) =>
        setMessages((list) => (list.some((x) => x.id === (m as AuctionMessage).id) ? list : [...list.slice(-119), m as AuctionMessage])),
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "auction_messages" }, ({ old }) =>
        setMessages((list) => list.filter((x) => x.id !== (old as { id: number }).id)),
      )
      .subscribe();
    return () => {
      clearTimeout(first);
      void sb.removeChannel(ch);
    };
  }, [sb, auctionId, load]);

  const send = useCallback(
    async (body: string) => {
      const { error } = await sb.rpc("auction_send_message", { p_auction_id: auctionId, p_body: body });
      if (error) {
        toast.error(error.message);
        return false;
      }
      void load(); // in case realtime is slow; inserts are de-duplicated by id
      return true;
    },
    [sb, auctionId, load],
  );

  const remove = useCallback(
    async (id: number) => {
      const { error } = await sb.from("auction_messages").delete().eq("id", id);
      if (error) toast.error(error.message);
      else setMessages((list) => list.filter((x) => x.id !== id));
    },
    [sb],
  );

  return { messages, send, remove };
}

const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });

function Author({ m, teams }: { m: AuctionMessage; teams: Record<string, Team> }) {
  const team = m.team_id ? teams[m.team_id] ?? null : null;
  return (
    <span className="mr-1.5 inline-flex items-center gap-1 align-baseline">
      {m.role === "organizer" && <span className="rounded-[3px] bg-hot px-1 font-heading text-[10px] leading-4 font-bold text-white">ORG</span>}
      {m.role === "captain" && team && (
        <span className="rounded-[3px] px-1 font-heading text-[10px] leading-4 font-bold" style={{ background: teamColor(team), color: onColor(teamColor(team)) }}>
          {team.tag}
        </span>
      )}
      <span className={cn("font-semibold", m.role === "fan" ? "text-muted-foreground" : "text-foreground")}>{m.author}</span>
    </span>
  );
}

export function ChatPanel({
  messages,
  onSend,
  onDelete,
  teams,
  signedIn,
  enabled,
  isAdmin,
  readOnly,
  className,
  autoFocus,
}: {
  messages: AuctionMessage[];
  onSend: (body: string) => Promise<boolean>;
  onDelete: (id: number) => void;
  teams: Record<string, Team>;
  signedIn: boolean;
  enabled: boolean;
  isAdmin: boolean;
  readOnly?: boolean;
  className?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  // Keep the newest message in view unless the reader has scrolled up.
  useEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const submit = async (body: string) => {
    const t = body.trim();
    if (!t || sending) return;
    setSending(true);
    const ok = await onSend(t.slice(0, MAX));
    setSending(false);
    if (ok) setText("");
  };

  return (
    <section className={cn("flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card", className)}>
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <span className="size-2 animate-pulse rounded-full bg-hot" aria-hidden />
        <h2 className="font-heading text-base font-bold tracking-wide uppercase">Live chat</h2>
        {!enabled && <span className="ml-auto text-xs text-muted-foreground">Chat is off</span>}
      </div>
      <div
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-3 text-sm"
        aria-live="polite"
      >
        {messages.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No messages yet. Say hi to the room.</p>}
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className={cn("group rounded-md px-1.5 py-0.5 break-words", m.role === "organizer" && "bg-hot/5")}
            >
              <Author m={m} teams={teams} />
              <span>{m.body}</span>
              <span className="ml-1.5 text-[10px] text-muted-foreground/70">{timeFmt.format(new Date(m.created_at))}</span>
              {isAdmin && !readOnly && (
                <button type="button" onClick={() => onDelete(m.id)} className="ml-1 align-middle text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-loss" aria-label="Delete message">
                  <X className="inline size-3.5" />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {!readOnly &&
        (!signedIn ? (
          <p className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
            <Link href="/login?next=/auction" className="font-medium text-foreground underline underline-offset-2">
              Sign in
            </Link>{" "}
            to chat
          </p>
        ) : enabled ? (
          <div className="space-y-2 border-t p-3">
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
              {QUICK.map((q) => (
                <button key={q} type="button" disabled={sending} onClick={() => void submit(q)} className="shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent active:scale-95">
                  {q}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit(text);
              }}
              className="flex items-center gap-2"
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX))}
                placeholder="Say something…"
                maxLength={MAX}
                autoFocus={autoFocus}
                className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Chat message"
              />
              <button type="submit" disabled={sending || !text.trim()} className="h-10 rounded-lg bg-brand px-4 font-heading text-sm font-bold tracking-wide text-white uppercase transition active:scale-95 disabled:opacity-50">
                Send
              </button>
            </form>
          </div>
        ) : null)}
    </section>
  );
}

/** Phones: a chat button with an unread count that opens the chat as a bottom sheet. */
export function ChatSheet({ children, unread, open, onOpenChange, raised }: { children: React.ReactNode; unread: number; open: boolean; onOpenChange: (open: boolean) => void; raised?: boolean }) {
  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className={cn(
          "fixed right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-brand px-4 font-heading text-sm font-bold tracking-wide text-white uppercase shadow-lg transition active:scale-95 lg:hidden",
          raised ? "bottom-24" : "bottom-5",
        )}
        aria-label={`Open chat${unread ? `, ${unread} new` : ""}`}
      >
        Chat
        {unread > 0 && <span className="min-w-5 rounded-full bg-hot px-1.5 text-xs leading-5 tabular">{unread > 99 ? "99+" : unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" className="absolute inset-0 bg-black/40" onClick={() => onOpenChange(false)} aria-label="Close chat" />
            <motion.div
              className="absolute inset-x-0 bottom-0 flex h-[75dvh] flex-col rounded-t-2xl bg-background p-2 shadow-2xl"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted" aria-hidden />
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
