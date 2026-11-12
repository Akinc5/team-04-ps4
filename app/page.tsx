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
    <main className="mx-auto max-w-6xl p-4 md:p-6">
      <AppHeader current="helpdesk" />
      <div className="grid gap-4 md:grid-cols-5">
        <section className="md:col-span-3">
          <AgentChat queuedPrompt={queued} onDataChanged={() => setRefreshKey((k) => k + 1)} />
        </section>
        <section className="md:col-span-2">
          <TicketBoard refreshKey={refreshKey} onAsk={(text) => setQueued((q) => ({ text, n: (q?.n ?? 0) + 1 }))} />
        </section>
      </div>
    </main>
  );
}
