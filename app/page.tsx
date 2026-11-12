"use client";

import { useState } from "react";
import AgentChat from "@/components/AgentChat";
import AppHeader from "@/components/AppHeader";
import TicketBoard from "@/components/TicketBoard";

/*
 * HOME PAGE
 * Left: DeskBot, the helpdesk agent. Right: the employee's tickets with live SLA status.
 * Clicking a ticket asks the agent about it.
 */
export default function HomePage() {
  // Changes every time the agent writes data, so the ticket board reloads.
  const [refreshKey, setRefreshKey] = useState(0);
  // A prompt sent from outside the chat (clicking a ticket).
  const [queued, setQueued] = useState<{ text: string; n: number } | null>(null);

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-4 pb-8 pt-4 sm:px-7 sm:pt-6 lg:px-10">
      <AppHeader current="helpdesk" />
      <section className="mb-4 flex flex-col justify-between gap-6 py-5 sm:flex-row sm:items-end sm:py-7">
        <div>
          <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
            IT support, <span className="text-[var(--accent)]">without the back-and-forth.</span>
          </h2>
          <p className="muted mt-2 max-w-xl text-sm leading-6">
            Tell DeskBot what’s going on. Get a trusted fix, or track your request and its SLA in one place.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 self-start rounded-full border border-[var(--line)] bg-[#101210] px-3 py-2 sm:self-auto">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--accent)] opacity-40" />
            <span className="relative inline-flex size-2 rounded-full bg-[var(--accent)]" />
          </span>
          <span className="text-xs font-medium text-[#d9ddd5]">Employee workspace</span>
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(390px,0.9fr)]">
        <section className="min-w-0">
          <AgentChat queuedPrompt={queued} onDataChanged={() => setRefreshKey((k) => k + 1)} />
        </section>
        <section className="min-w-0">
          <TicketBoard refreshKey={refreshKey} onAsk={(text) => setQueued((q) => ({ text, n: (q?.n ?? 0) + 1 }))} />
        </section>
      </div>
    </main>
  );
}
