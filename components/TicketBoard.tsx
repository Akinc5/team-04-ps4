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
  const visible = showFinished ? tickets : tickets.filter((t) => t.sla?.state !== "done");
  const finishedCount = tickets.length - tickets.filter((t) => t.sla?.state !== "done").length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold">My tickets</h2>
        <p className="text-xs text-slate-500">
          {board?.employee
            ? `${board.employee.name} · ${board.employee.department}, ${board.employee.location} · ${board.employee.laptop_model ?? "no laptop on record"}`
            : "Live from Supabase. Updates when the agent changes data."}
        </p>
      </div>

      {error && (
        <div className="p-4 text-sm text-red-600">
          <p>{error}</p>
          <p className="mt-1 text-xs text-slate-500">
            Check <a href="/api/health" className="underline">/api/health</a> and make sure the PS4 seed file has been run.
          </p>
        </div>
      )}

      {board && (
        <>
          <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-200 text-center">
            <Stat label="Active" value={board.stats.active} />
            <Stat label="Past SLA" value={board.stats.overdue} alert={board.stats.overdue > 0} />
            <Stat label="Need your reply" value={board.stats.waiting_for_you} />
          </div>

          <ul className="max-h-[52vh] divide-y divide-slate-100 overflow-y-auto">
            {visible.length === 0 && <li className="p-4 text-sm text-slate-500">No tickets to show.</li>}
            {visible.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => onAsk(`Show me the details and SLA status of ticket #${t.id}.`)}
                  className="block w-full px-4 py-3 text-left hover:bg-slate-50"
                  title="Ask DeskBot about this ticket"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">
                      <span className="text-slate-400">#{t.id}</span> {t.title}
                    </p>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${PRIORITY_STYLE[t.priority] ?? ""}`}>
                      {t.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {STATUS_LABEL[t.status] ?? t.status} · {t.team} · raised {t.created}
                    {t.escalated && <span className="ml-1 rounded bg-violet-100 px-1.5 py-0.5 text-violet-800">escalated</span>}
                  </p>
                  {t.sla && <p className={`mt-1 text-xs font-medium ${SLA_STYLE[t.sla.state] ?? ""}`}>{t.sla.summary}</p>}
                </button>
              </li>
            ))}
          </ul>

          {finishedCount > 0 && (
            <button
              onClick={() => setShowFinished((v) => !v)}
              className="w-full border-t border-slate-200 px-4 py-2 text-left text-xs text-slate-500 hover:text-slate-900"
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
    <div className="px-2 py-3">
      <p className={`text-xl font-semibold ${alert ? "text-red-600" : ""}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
