"use client";

import { useEffect, useState } from "react";

type Sla = { state: string; summary: string; resolve_by: string };
type Ticket = {
  id: number;
  title: string;
  category: string;
  priority: string;
  status: string;
  team: string;
  created: string;
  escalated: boolean;
  sla: Sla | null;
};
type Employee = { id: string; name: string; department: string; location: string; laptop_model: string | null };
type Board = { employee: Employee | null; tickets: Ticket[]; stats: { active: number; overdue: number; waiting_for_you: number } };

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

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_for_user: "Waiting for you",
  resolved: "Resolved",
  closed: "Closed",
};

/** Live view of the employee's tickets. Reloads whenever the agent writes data. */
export default function TicketBoard({ refreshKey, onAsk }: { refreshKey: number; onAsk: (prompt: string) => void }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [showFinished, setShowFinished] = useState(false);
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("all");

  useEffect(() => {
    fetch("/api/tickets")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load tickets");
        setBoard(data);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, [refreshKey]);

  const tickets = board?.tickets ?? [];
  const visible = (showFinished ? tickets : tickets.filter((t) => t.sla?.state !== "done"))
    .filter((t) => priority === "all" || t.priority === priority)
    .filter((t) => `${t.id} ${t.title} ${t.category} ${t.team} ${t.status}`.toLowerCase().includes(query.trim().toLowerCase()));
  const finishedCount = tickets.length - tickets.filter((t) => t.sla?.state !== "done").length;

  return (
    <div className="bento-card">
      <div className="border-b border-[var(--line)] px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow mb-1">YOUR SUPPORT DESK</p>
            <h2 className="text-lg font-semibold tracking-tight">My tickets</h2>
          </div>
          {board && <span className="rounded-full border border-[var(--line)] bg-[#101210] px-2.5 py-1 text-[11px] text-[#a1a69f]">{tickets.length} total</span>}
        </div>
        <p className="muted mt-2 text-xs leading-5">
          {board?.employee
            ? `${board.employee.name} · ${board.employee.department}, ${board.employee.location}`
            : "Live from Supabase. Updates when the agent changes data."}
        </p>
      </div>

      {error && (
        <div className="p-4 text-sm text-[var(--danger)]">
          <p>{error}</p>
          <p className="mt-1 text-xs text-[#8a8f88]">
            Check <a href="/api/health" className="underline">/api/health</a> and make sure the PS4 seed file has been run.
          </p>
        </div>
      )}

      {board && (
        <>
          <div className="grid grid-cols-3 divide-x divide-[var(--line)] border-b border-[var(--line)] text-center">
            <Stat label="Active" value={board.stats.active} />
            <Stat label="Past SLA" value={board.stats.overdue} alert={board.stats.overdue > 0} />
            <Stat label="Need your reply" value={board.stats.waiting_for_you} />
          </div>

          <div className="grid gap-2 border-b border-[var(--line)] p-3 sm:grid-cols-[minmax(0,1fr)_112px]">
            <label className="sr-only" htmlFor="ticket-search">Search your tickets</label>
            <input
              id="ticket-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, team, category..."
              className="dark-control min-w-0 px-3 py-2 text-xs outline-none transition focus:border-[#66734d]"
            />
            <label className="sr-only" htmlFor="ticket-priority">Filter tickets by priority</label>
            <select
              id="ticket-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="dark-control px-2.5 py-2 text-xs outline-none"
            >
              <option value="all">All priority</option>
              <option value="P1">P1 · Urgent</option>
              <option value="P2">P2 · High</option>
              <option value="P3">P3 · Normal</option>
              <option value="P4">P4 · Request</option>
            </select>
          </div>

          <ul className="subtle-scrollbar max-h-[58vh] divide-y divide-[var(--line)] overflow-y-auto">
            {visible.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-[#8b9189]">
                {tickets.length === 0 ? "No tickets yet. Ask DeskBot for help to get started." : "No tickets match these filters."}
              </li>
            )}
            {visible.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => onAsk(`Show me the details and SLA status of ticket #${t.id}.`)}
                  className="group block w-full px-4 py-3.5 text-left transition hover:bg-white/[0.035] sm:px-5"
                  title="Ask DeskBot about this ticket"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-medium leading-5 text-[#e8ebe5]">
                      <span className="mr-1.5 font-mono text-[11px] text-[#737a71]">#{t.id}</span>{t.title}
                    </p>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLE[t.priority] ?? ""}`}>
                      {t.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#858b83]">
                    {STATUS_LABEL[t.status] ?? t.status} <span className="text-[#4d534c]">·</span> {t.team} <span className="text-[#4d534c]">·</span> {t.category}
                    {t.escalated && <span className="ml-2 rounded-full border border-[#473769] bg-[#241d35] px-2 py-0.5 text-[10px] text-[#c1a8ff]">escalated</span>}
                  </p>
                  {t.sla && <p className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-medium ${SLA_STYLE[t.sla.state] ?? ""}`}>
                    <span className="size-1.5 rounded-full bg-current" />{t.sla.summary}
                  </p>}
                </button>
              </li>
            ))}
          </ul>

          {finishedCount > 0 && (
            <button
              onClick={() => setShowFinished((v) => !v)}
              className="w-full border-t border-[var(--line)] px-4 py-3 text-left text-xs text-[#929890] transition hover:text-white"
            >
              {showFinished ? "Hide finished tickets" : `Show ${finishedCount} finished ticket${finishedCount === 1 ? "" : "s"}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="px-2 py-3.5">
      <p className={`text-xl font-semibold tracking-tight ${alert ? "text-[var(--danger)]" : "text-[#f2f4ef]"}`}>{value}</p>
      <p className="mt-0.5 text-[10px] leading-4 text-[#8b9189]">{label}</p>
    </div>
  );
}
