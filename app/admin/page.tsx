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
  P1: "bg-red-600 text-white",
  P2: "bg-orange-500 text-white",
  P3: "bg-amber-100 text-amber-900",
  P4: "bg-slate-100 text-slate-700",
};
const SLA_STYLE: Record<string, string> = {
  breached: "text-red-700",
  response_overdue: "text-red-700",
  at_risk: "text-amber-700",
  on_track: "text-emerald-700",
  paused: "text-sky-700",
  done: "text-slate-500",
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
    <main className="mx-auto max-w-6xl p-4 md:p-6">
      <AppHeader current="admin" />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Active tickets" value={active.length} />
        <Tile label="Past SLA" value={overdue.length} alert={overdue.length > 0} />
        <Tile label="Open P1" value={active.filter((t) => t.priority === "P1").length} alert={active.some((t) => t.priority === "P1")} />
        <Tile label="Waiting for user" value={active.filter((t) => t.status === "waiting_for_user").length} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="font-semibold">All tickets</h2>
            <p className="text-xs text-slate-500">Open P1 first, then worst SLA. Change a status and the employee sees it at once.</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5"
              aria-label="Filter by team"
            >
              <option value="all">All teams</option>
              {teams.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-slate-600">
              <input type="checkbox" checked={showFinished} onChange={(e) => setShowFinished(e.target.checked)} />
              Show finished
            </label>
          </div>
        </div>

        {error && <p className="p-4 text-sm text-red-600">{error}</p>}
        {!error && visible.length === 0 && <p className="p-4 text-sm text-slate-500">No tickets to show.</p>}

        <ul className="divide-y divide-slate-100">
          {visible.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className={`mr-2 rounded px-1.5 py-0.5 text-xs font-semibold ${PRIORITY_STYLE[t.priority] ?? ""}`}>
                    {t.priority}
                  </span>
                  <span className="text-slate-400">#{t.id}</span> {t.title}
                  {t.escalated && (
                    <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-xs font-normal text-violet-800">escalated</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {t.employee} · {t.team} · {t.category} · raised {t.created}
                </p>
                {t.sla && <p className={`mt-1 text-xs font-medium ${SLA_STYLE[t.sla.state] ?? ""}`}>{t.sla.state === "paused" ? "Paused: waiting for the employee's reply" : t.sla.summary}</p>}
              </div>
              <select
                value={t.status}
                disabled={saving === t.id}
                onChange={(e) => changeStatus(t.id, e.target.value)}
                className="shrink-0 rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-50"
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
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className={`text-2xl font-semibold ${alert ? "text-red-600" : ""}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
