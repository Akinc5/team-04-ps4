import "server-only";
import { getSupabase } from "./supabase";

/*
 * HELPDESK BUSINESS RULES
 * Everything in this file is plain code, not prompt text. The agent cannot talk
 * its way around these rules: tools call these functions before touching data.
 */

/** The demo is logged in as this employee (see seed/ps4_it_helpdesk.sql). */
export const CURRENT_EMPLOYEE_ID = "E101";

export const CATEGORIES = ["VPN", "Network", "Account", "Access", "Email", "Apps", "Hardware", "Security"] as const;
export type Category = (typeof CATEGORIES)[number];

export const IMPACTS = ["many_users_blocked", "fully_blocked", "work_slowed", "request"] as const;
export type Impact = (typeof IMPACTS)[number];

export type Priority = "P1" | "P2" | "P3" | "P4";
export type Status = "open" | "in_progress" | "waiting_for_user" | "resolved" | "closed";

export const ACTIVE_STATUSES: Status[] = ["open", "in_progress", "waiting_for_user"];

/** Rule: an employee can have at most this many active tickets at once. */
export const MAX_ACTIVE_TICKETS = 5;
/** Rule: a resolved or closed ticket can be reopened only within this many days. */
export const REOPEN_WINDOW_DAYS = 7;

/** Rule: the category decides the team. The model never picks the team. */
export const CATEGORY_TEAM: Record<Category, string> = {
  VPN: "T1",
  Network: "T1",
  Account: "T2",
  Access: "T2",
  Hardware: "T3",
  Email: "T4",
  Apps: "T4",
  Security: "T5",
};

/**
 * Rule: the priority comes from the impact, following the sla_rules table.
 * Security issues are always P1. The model never picks the priority directly.
 */
export function decidePriority(category: Category, impact: Impact): Priority {
  if (category === "Security") return "P1";
  if (impact === "many_users_blocked") return "P1";
  if (impact === "fully_blocked") return "P2";
  if (impact === "work_slowed") return "P3";
  return "P4";
}

export type SlaRule = { priority: Priority; meaning: string; response_hours: number; resolve_hours: number };

export type TicketRow = {
  id: number;
  employee_id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  team_id: string;
  status: Status;
  created_at: string;
  updated_at: string;
};

export const TICKET_COLUMNS =
  "id, employee_id, title, description, category, priority, team_id, status, created_at, updated_at";

export type SlaState = "on_track" | "at_risk" | "response_overdue" | "breached" | "paused" | "done";

export type SlaInfo = {
  state: SlaState;
  respond_by: string;
  resolve_by: string;
  /** Hours until the resolve deadline. Negative when overdue. */
  hours_left: number;
  summary: string;
};

const HOUR = 60 * 60 * 1000;

/** Date and time in India, for example "12 Nov, 2:05 pm". */
export function formatIST(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function duration(hours: number): string {
  const h = Math.abs(hours);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.floor(h / 24)} d ${Math.round(h % 24)} h`;
}

/**
 * Works out where a ticket stands against its SLA.
 * The SLA clock uses calendar hours from the time the ticket was created.
 */
export function slaFor(ticket: TicketRow, rule: SlaRule, now: Date = new Date()): SlaInfo {
  const created = new Date(ticket.created_at).getTime();
  const respondBy = new Date(created + rule.response_hours * HOUR);
  const resolveBy = new Date(created + rule.resolve_hours * HOUR);
  const hoursLeft = (resolveBy.getTime() - now.getTime()) / HOUR;

  let state: SlaState;
  let summary: string;
  if (ticket.status === "resolved" || ticket.status === "closed") {
    state = "done";
    summary = ticket.status === "resolved" ? "Resolved, waiting for you to confirm" : "Closed";
  } else if (ticket.status === "waiting_for_user") {
    state = "paused";
    summary = "Paused: the team is waiting for your reply";
  } else if (hoursLeft < 0) {
    state = "breached";
    summary = `Overdue by ${duration(hoursLeft)}`;
  } else if (ticket.status === "open" && now > respondBy) {
    state = "response_overdue";
    summary = `First response is overdue (${duration(hoursLeft)} left to resolve)`;
  } else if (hoursLeft < rule.resolve_hours * 0.25) {
    state = "at_risk";
    summary = `Due soon: ${duration(hoursLeft)} left`;
  } else {
    state = "on_track";
    summary = `On track: ${duration(hoursLeft)} left`;
  }

  return {
    state,
    respond_by: formatIST(respondBy),
    resolve_by: formatIST(resolveBy),
    hours_left: Math.round(hoursLeft * 10) / 10,
    summary,
  };
}

const STOP_WORDS = new Set(
  "a an and are as at be but by can cannot cant do does for from has have how i in is it its my me need not of on or our please so that the this to was what when will with work working keeps keep every very again still issue problem help".split(
    " "
  )
);

/** Lower-case word stems without filler words. "disconnecting" and "disconnects" give the same stem. */
export function stems(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return [...new Set(words.filter((w) => w.length > 2 && !STOP_WORDS.has(w)).map((w) => w.slice(0, 5)))];
}

/** 0 to 1: how much two short texts overlap. Used to catch duplicate tickets. */
export function similarity(a: string, b: string): number {
  const sa = stems(a);
  const sb = new Set(stems(b));
  if (sa.length === 0 || sb.size === 0) return 0;
  const shared = sa.filter((s) => sb.has(s)).length;
  return shared / Math.min(sa.length, sb.size);
}

export async function loadSlaRules(): Promise<Map<string, SlaRule>> {
  const { data, error } = await getSupabase()
    .from("sla_rules")
    .select("priority, meaning, response_hours, resolve_hours");
  if (error) throw new Error(error.message);
  return new Map((data as SlaRule[]).map((r) => [r.priority, r]));
}

export type Team = { id: string; name: string; handles: string };

export async function loadTeams(): Promise<Map<string, Team>> {
  const { data, error } = await getSupabase().from("support_teams").select("id, name, handles");
  if (error) throw new Error(error.message);
  return new Map((data as Team[]).map((t) => [t.id, t]));
}

/** The small, clean ticket object that tools and the dashboard return. */
export function presentTicket(ticket: TicketRow, rules: Map<string, SlaRule>, teams: Map<string, Team>) {
  const rule = rules.get(ticket.priority);
  return {
    id: ticket.id,
    title: ticket.title,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    team: teams.get(ticket.team_id)?.name ?? ticket.team_id,
    created: formatIST(new Date(ticket.created_at)),
    updated: formatIST(new Date(ticket.updated_at)),
    escalated: ticket.description.includes("[Escalated"),
    sla: rule ? slaFor(ticket, rule) : null,
  };
}
