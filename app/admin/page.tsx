"use client";

import { useCallback, useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";

type Ticket = {
  id: number;
  title: string;
  category: string;
  priority: string;
  status: string;
  team: string;
  employee: string;
  created: string;
  escalated: boolean;
  sla: { state: string; summary: string } | null;
};

const STATUSES = ["open", "in_progress", "waiting_for_user", "resolved", "closed"];
const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_for_user: "Waiting for user",
  resolved: "Resolved",
  closed: "Closed",
};
const PRIORITY_STYLE: Record<string, string> = {
  P1: "border-[#633431] bg-[#321d1c] text-[#ff9189]",
  P2: "border-[#60452a] bg-[#30251a] text-[#f3bd65]",
  P3: "border-[#596432] bg-[#272d1b] text-[#c5e17c]",
  P4: "border-[#3c423b] bg-[#222522] text-[#aeb4ac]",
};
const SLA_STYLE: Record<string, string> = {
  breached: "text-[var(--danger)]",
  response_overdue: "text-[var(--danger)]",
  at_risk: "text-[var(--warning)]",
  on_track: "text-[var(--accent)]",
  paused: "text-[#92b9da]",
  done: "text-[#777e76]",
};

/*
 * IT ADMIN BOARD
 * What the IT team sees: every ticket in the company, worst SLA first.
 * Staff can change a ticket's status here; the employee sees it in the helpdesk view.
 */
export default function AdminPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [team, setTeam] = useState("all");
  const [showFinished, setShowFinished] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tickets");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load tickets");
      setTickets(data.tickets);
      setTeams(data.teams);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tickets");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(id: number, status: string) {
    setSaving(id);
    try {
      const res = await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update the ticket");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the ticket");
    } finally {
      setSaving(null);
    }
  }

  const active = tickets.filter((t) => t.sla?.state !== "done");
  const overdue = active.filter((t) => t.sla?.state === "breached" || t.sla?.state === "response_overdue");
  const isOpenP1 = (t: Ticket) => t.priority === "P1" && t.sla?.state !== "done";
  const order = ["breached", "response_overdue", "at_risk", "on_track", "paused", "done"];
  const visible = (showFinished ? tickets : active)
    .filter((t) => team === "all" || t.team === team)
    // Open P1 incidents always come first, then the worst SLA.
    .sort((a, b) => Number(isOpenP1(b)) - Number(isOpenP1(a)) || order.indexOf(a.sla?.state ?? "done") - order.indexOf(b.sla?.state ?? "done") || a.priority.localeCompare(b.priority));

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-4 pb-8 pt-4 sm:px-7 sm:pt-6 lg:px-10">
      <AppHeader current="admin" />

      <section className="bento-card mb-4 p-5 sm:p-7">
        <p className="eyebrow mb-2">ZENTRIX SOFTWARE <span className="text-[#555b54]">/</span> OPERATIONS</p>
        <h2 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">IT Admin board</h2>
        <p className="muted mt-2 text-sm">Prioritized by incident impact and SLA. Status changes sync to the employee ticket view.</p>
      </section>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Active tickets" value={active.length} />
        <Tile label="Past SLA" value={overdue.length} alert={overdue.length > 0} />
        <Tile label="Open P1" value={active.filter((t) => t.priority === "P1").length} alert={active.some((t) => t.priority === "P1")} />
        <Tile label="Waiting for user" value={active.filter((t) => t.status === "waiting_for_user").length} />
      </div>

      <div className="bento-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-4 sm:px-5">
          <div>
            <p className="eyebrow mb-1">LIVE QUEUE</p>
            <h2 className="text-lg font-semibold">All tickets</h2>
            <p className="muted mt-1 text-xs">Open P1 first, then worst SLA.</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="dark-control px-3 py-2 text-xs"
              aria-label="Filter by team"
            >
              <option value="all">All teams</option>
              {teams.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-[#a2a79f]">
              <input type="checkbox" checked={showFinished} onChange={(e) => setShowFinished(e.target.checked)} />
              Show finished
            </label>
          </div>
        </div>

        {error && <p className="p-4 text-sm text-[var(--danger)]">{error}</p>}
        {!error && visible.length === 0 && <p className="p-8 text-center text-sm text-[#8b9189]">No tickets to show.</p>}

        <ul className="divide-y divide-[var(--line)]">
          {visible.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#e8ebe5]">
                  <span className={`mr-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLE[t.priority] ?? ""}`}>
                    {t.priority}
                  </span>
                  <span className="font-mono text-[11px] text-[#737a71]">#{t.id}</span> {t.title}
                  {t.escalated && (
                    <span className="ml-2 rounded-full border border-[#473769] bg-[#241d35] px-2 py-0.5 text-[10px] font-normal text-[#c1a8ff]">escalated</span>
                  )}
                </p>
                <p className="mt-1 text-[11px] text-[#858b83]">
                  {t.employee} <span className="text-[#4d534c]">·</span> {t.team} <span className="text-[#4d534c]">·</span> {t.category} <span className="text-[#4d534c]">·</span> raised {t.created}
                </p>
                {t.sla && <p className={`mt-1 text-[11px] font-medium ${SLA_STYLE[t.sla.state] ?? ""}`}>{t.sla.state === "paused" ? "Paused: waiting for the employee's reply" : t.sla.summary}</p>}
              </div>
              <select
                value={t.status}
                disabled={saving === t.id}
                onChange={(e) => changeStatus(t.id, e.target.value)}
                className="dark-control shrink-0 px-3 py-2 text-xs disabled:opacity-50"
                aria-label={`Status of ticket ${t.id}`}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

function Tile({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="bento-card px-4 py-4">
      <p className={`text-2xl font-semibold tracking-tight ${alert ? "text-[var(--danger)]" : "text-[var(--accent)]"}`}>{value}</p>
      <p className="mt-1 text-[11px] text-[#8b9189]">{label}</p>
    </div>
  );
}
