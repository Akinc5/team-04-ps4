import "server-only";
import { z } from "zod";
import { defineTool, type AgentTool } from "./defineTool";
import { getSupabase } from "../supabase";
import {
  ACTIVE_STATUSES,
  CATEGORIES,
  CATEGORY_TEAM,
  CURRENT_EMPLOYEE_ID,
  IMPACTS,
  MAX_ACTIVE_TICKETS,
  REOPEN_WINDOW_DAYS,
  TICKET_COLUMNS,
  decidePriority,
  formatIST,
  loadSlaRules,
  loadTeams,
  presentTicket,
  similarity,
  slaFor,
  stems,
  type Priority,
  type TicketRow,
} from "../helpdesk";

/*
 * DESKBOT TOOLS (PS4 IT Helpdesk Ticket Agent)
 *
 * Read tools:  getMyProfile, searchKnowledgeBase, getMyTickets, getTicketStatus, getOpenIncidents
 * Write tools: createTicket, updateTicket, escalateTicket
 *
 * Business rules live in code (here and in lib/helpdesk.ts), not only in the prompt:
 *  - priority and team are decided by code from the category and impact
 *  - duplicate tickets are blocked
 *  - employees can only see and change their own tickets
 *  - status changes follow a fixed set of allowed moves
 *  - escalation is allowed only when the SLA is actually missed
 */

const ticketId = z.number().int().positive().describe("The ticket number, for example 1");

/** Loads a ticket and enforces the ownership rule. */
async function getOwnTicket(id: number): Promise<TicketRow> {
  const { data, error } = await getSupabase().from("tickets").select(TICKET_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No ticket found with number ${id}. Call getMyTickets to see the valid numbers.`);
  const ticket = data as TicketRow;
  if (ticket.employee_id !== CURRENT_EMPLOYEE_ID) {
    throw new Error(`Ticket #${id} belongs to another employee. You can only see and change your own tickets.`);
  }
  return ticket;
}

async function saveTicket(id: number, changes: Partial<TicketRow>): Promise<TicketRow> {
  const { data, error } = await getSupabase()
    .from("tickets")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(TICKET_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as TicketRow;
}

function withNote(description: string, label: string, note: string): string {
  return `${description}\n\n[${label} · ${formatIST(new Date())}] ${note}`;
}

const getMyProfile = defineTool({
  name: "getMyProfile",
  description:
    "Use this when you need facts about the logged-in employee (name, department, office location, laptop model), or when the user asks which support teams exist or what the SLA times are for each priority.",
  schema: z.object({}),
  run: async () => {
    const [employee, rules, teams] = await Promise.all([
      getSupabase()
        .from("employees")
        .select("id, name, email, department, location, laptop_model")
        .eq("id", CURRENT_EMPLOYEE_ID)
        .maybeSingle(),
      loadSlaRules(),
      loadTeams(),
    ]);
    if (employee.error) throw new Error(employee.error.message);
    if (!employee.data) throw new Error(`Employee ${CURRENT_EMPLOYEE_ID} was not found. Has the PS4 seed file been run?`);
    return {
      employee: employee.data,
      sla_rules: [...rules.values()],
      support_teams: [...teams.values()].map((t) => ({ name: t.name, handles: t.handles })),
    };
  },
});

const searchKnowledgeBase = defineTool({
  name: "searchKnowledgeBase",
  description:
    "Use this FIRST when the user describes any IT problem or asks how to do something, before creating a ticket. Returns up to 3 matching help articles with step-by-step fixes.",
  schema: z.object({
    query: z
      .string()
      .trim()
      .min(3)
      .max(200)
      .describe("The problem in a few plain keywords, for example 'vpn keeps disconnecting' or 'outlook not receiving email'"),
  }),
  run: async ({ query }) => {
    const { data, error } = await getSupabase()
      .from("kb_articles")
      .select("id, title, category, keywords, solution_steps, team_id");
    if (error) throw new Error(error.message);
    const teams = await loadTeams();
    const wanted = stems(query);

    const scored = (data ?? [])
      .map((a) => {
        const inKeywords = new Set(stems(a.keywords));
        const inTitle = new Set(stems(a.title));
        const inCategory = new Set(stems(a.category));
        const inSteps = new Set(stems(a.solution_steps));
        let score = 0;
        for (const w of wanted) {
          if (inKeywords.has(w)) score += 3;
          if (inTitle.has(w)) score += 2;
          if (inCategory.has(w)) score += 2;
          else if (inSteps.has(w)) score += 1;
        }
        return { article: a, score };
      })
      .filter((s) => s.score >= 3)
      .sort((x, y) => y.score - x.score)
      .slice(0, 3);

    if (scored.length === 0) {
      return { count: 0, articles: [], note: "No help article matches. Offer to create a ticket instead." };
    }
    return {
      count: scored.length,
      articles: scored.map(({ article }) => ({
        title: article.title,
        category: article.category,
        solution_steps: article.solution_steps,
        team_if_ticket_needed: teams.get(article.team_id)?.name ?? article.team_id,
      })),
    };
  },
});

const getMyTickets = defineTool({
  name: "getMyTickets",
  description:
    "Use this when the user wants to see their tickets, check progress, or asks whether anything is overdue. Also use it to find a ticket number from a description like 'my battery ticket'. Each ticket includes its SLA status.",
  schema: z.object({
    filter: z
      .enum(["active", "finished", "all"])
      .optional()
      .describe("active = open, in_progress or waiting_for_user. finished = resolved or closed. Default is all."),
  }),
  run: async ({ filter }) => {
    let query = getSupabase()
      .from("tickets")
      .select(TICKET_COLUMNS)
      .eq("employee_id", CURRENT_EMPLOYEE_ID)
      .order("created_at", { ascending: false })
      .limit(20);
    if (filter === "active") query = query.in("status", ACTIVE_STATUSES);
    if (filter === "finished") query = query.in("status", ["resolved", "closed"]);
    const [{ data, error }, rules, teams] = await Promise.all([query, loadSlaRules(), loadTeams()]);
    if (error) throw new Error(error.message);
    const tickets = (data as TicketRow[]).map((t) => presentTicket(t, rules, teams));
    return {
      count: tickets.length,
      overdue: tickets.filter((t) => t.sla?.state === "breached" || t.sla?.state === "response_overdue").length,
      tickets,
    };
  },
});

const getTicketStatus = defineTool({
  name: "getTicketStatus",
  description:
    "Use this when the user asks about one specific ticket: its full description, update history, team, or exact SLA deadlines. Needs the ticket number, so call getMyTickets first if you do not know it.",
  schema: z.object({ ticket_id: ticketId }),
  run: async ({ ticket_id }) => {
    const [ticket, rules, teams] = await Promise.all([getOwnTicket(ticket_id), loadSlaRules(), loadTeams()]);
    return { ticket: { ...presentTicket(ticket, rules, teams), description: ticket.description } };
  },
});

const createTicket = defineTool({
  name: "createTicket",
  description:
    "Use this when the user needs IT support to act: the help article steps did not fix the problem, no article matched, it is a request (new software, access, hardware), or it is a security incident. You do NOT choose the priority or team: describe the category and impact, and the system decides.",
  writes: true,
  schema: z.object({
    title: z.string().trim().min(5).max(120).describe("Short summary of the problem, for example 'VPN drops every 10 minutes'"),
    description: z
      .string()
      .trim()
      .min(10)
      .max(1000)
      .describe("What happens, since when, any error message, and which fixes the user already tried"),
    category: z
      .enum(CATEGORIES)
      .describe(
        "VPN = VPN or remote access. Network = Wi-Fi, internet, shared drives, Git. Account = password, lockout, MFA. Access = permission to a tool or system. Email = Outlook or calendar. Apps = other software. Hardware = laptop, monitor, printer, accessories. Security = phishing, virus alert, lost or stolen device."
      ),
    impact: z
      .enum(IMPACTS)
      .describe(
        "many_users_blocked = several people cannot work. fully_blocked = this user cannot work at all. work_slowed = the user can continue with difficulty. request = not a fault, just a request or question."
      ),
    force_new: z
      .boolean()
      .optional()
      .describe("Set true ONLY after the duplicate check found an existing ticket and the user confirmed this is a different problem."),
  }),
  run: async ({ title, description, category, impact, force_new }) => {
    const db = getSupabase();
    const { data: active, error: activeError } = await db
      .from("tickets")
      .select(TICKET_COLUMNS)
      .eq("employee_id", CURRENT_EMPLOYEE_ID)
      .in("status", ACTIVE_STATUSES);
    if (activeError) throw new Error(activeError.message);
    const mine = active as TicketRow[];

    // Rule 1: no duplicate tickets for the same problem.
    if (!force_new) {
      const duplicate = mine.find((t) => t.category === category && similarity(title, t.title) >= 0.5);
      if (duplicate) {
        throw new Error(
          `Duplicate: ticket #${duplicate.id} "${duplicate.title}" (${duplicate.status}) already covers this. ` +
            `Add the new details to it with updateTicket action add_info, or ask the user if this is really a different problem.`
        );
      }
    }

    // Rule 2: a cap on active tickets per employee.
    if (mine.length >= MAX_ACTIVE_TICKETS) {
      throw new Error(
        `Limit reached: you already have ${mine.length} active tickets (maximum ${MAX_ACTIVE_TICKETS}). Close or update an existing ticket first.`
      );
    }

    // Rule 3: code decides the priority and the team.
    const priority = decidePriority(category, impact);
    const team_id = CATEGORY_TEAM[category];

    const { data, error } = await db
      .from("tickets")
      .insert({ employee_id: CURRENT_EMPLOYEE_ID, title, description, category, priority, team_id })
      .select(TICKET_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    const ticket = data as TicketRow;

    // Extra signal: are other people reporting the same kind of problem right now?
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("category", category)
      .neq("employee_id", CURRENT_EMPLOYEE_ID)
      .in("status", ACTIVE_STATUSES)
      .gte("created_at", since);

    const [rules, teams] = await Promise.all([loadSlaRules(), loadTeams()]);
    return {
      created: presentTicket(ticket, rules, teams),
      priority_reason: rules.get(priority)?.meaning,
      others_with_similar_open_tickets: count ?? 0,
    };
  },
});

const updateTicket = defineTool({
  name: "updateTicket",
  description:
    "Use this when the user wants to change one of their own tickets: add new information, cancel it, confirm that a resolved ticket is really fixed, or reopen it because the problem came back. Needs the ticket number, so call getMyTickets first if you do not know it.",
  writes: true,
  schema: z.object({
    ticket_id: ticketId,
    action: z
      .enum(["add_info", "cancel", "confirm_resolved", "reopen"])
      .describe(
        "add_info = attach new details to an active ticket. cancel = the user no longer needs help. confirm_resolved = the fix worked, close the ticket. reopen = the problem came back after it was resolved or closed."
      ),
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .describe("The new details or the reason, in the user's words. Required for add_info and reopen."),
  }),
  run: async ({ ticket_id, action, note }) => {
    const ticket = await getOwnTicket(ticket_id);
    const isActive = ACTIVE_STATUSES.includes(ticket.status);
    if ((action === "add_info" || action === "reopen") && (!note || note.length < 5)) {
      throw new Error(`A note of at least 5 characters is required for ${action}. Ask the user what to add.`);
    }

    let changes: Partial<TicketRow>;
    if (action === "add_info") {
      if (!isActive) {
        throw new Error(`Ticket #${ticket.id} is ${ticket.status}. To add information, reopen it first (action reopen).`);
      }
      changes = {
        description: withNote(ticket.description, "Update from employee", note!),
        // The team was waiting for this reply, so the ticket moves forward again.
        ...(ticket.status === "waiting_for_user" ? { status: "in_progress" as const } : {}),
      };
    } else if (action === "cancel") {
      if (!isActive) throw new Error(`Ticket #${ticket.id} is already ${ticket.status}, so it cannot be cancelled.`);
      if (ticket.category === "Security") {
        throw new Error(`Ticket #${ticket.id} is a security incident. Only the Security team can close it.`);
      }
      changes = {
        status: "closed",
        description: withNote(ticket.description, "Cancelled by employee", note || "No longer needed."),
      };
    } else if (action === "confirm_resolved") {
      if (ticket.status !== "resolved") {
        throw new Error(
          `Ticket #${ticket.id} is ${ticket.status}, not resolved. Only a ticket the team marked resolved can be confirmed.`
        );
      }
      changes = { status: "closed", description: withNote(ticket.description, "Fix confirmed by employee", note || "Working now.") };
    } else {
      if (isActive) throw new Error(`Ticket #${ticket.id} is already ${ticket.status}. Use add_info to add details.`);
      const days = (Date.now() - new Date(ticket.updated_at).getTime()) / (24 * 60 * 60 * 1000);
      if (days > REOPEN_WINDOW_DAYS) {
        throw new Error(
          `Ticket #${ticket.id} was ${ticket.status} ${Math.floor(days)} days ago. Tickets can be reopened only within ${REOPEN_WINDOW_DAYS} days. Create a new ticket and mention #${ticket.id} in the description.`
        );
      }
      changes = { status: "open", description: withNote(ticket.description, "Reopened by employee", note!) };
    }

    const saved = await saveTicket(ticket.id, changes);
    const [rules, teams] = await Promise.all([loadSlaRules(), loadTeams()]);
    return { action, previous_status: ticket.status, updated: presentTicket(saved, rules, teams) };
  },
});

const NEXT_PRIORITY: Record<Priority, Priority> = { P4: "P3", P3: "P2", P2: "P2", P1: "P1" };

const escalateTicket = defineTool({
  name: "escalateTicket",
  description:
    "Use this when the user is unhappy with how long one of their tickets is taking and wants it escalated or sped up. The system allows it only if the SLA is actually missed, and tells you why when it refuses. Needs the ticket number.",
  writes: true,
  schema: z.object({
    ticket_id: ticketId,
    reason: z.string().trim().min(5).max(300).describe("Why the user wants it escalated, in their words"),
  }),
  run: async ({ ticket_id, reason }) => {
    const [ticket, rules, teams] = await Promise.all([getOwnTicket(ticket_id), loadSlaRules(), loadTeams()]);
    const rule = rules.get(ticket.priority);
    if (!rule) throw new Error(`No SLA rule found for priority ${ticket.priority}.`);
    const sla = slaFor(ticket, rule);

    if (sla.state === "done") throw new Error(`Ticket #${ticket.id} is ${ticket.status}, so there is nothing to escalate.`);
    if (sla.state === "paused") {
      throw new Error(
        `Ticket #${ticket.id} is waiting for the user's reply, so the SLA clock is paused. Use updateTicket action add_info to reply instead.`
      );
    }
    if (ticket.description.includes("[Escalated")) {
      throw new Error(`Ticket #${ticket.id} was already escalated once. A ticket can be escalated only one time.`);
    }
    if (sla.state !== "breached" && sla.state !== "response_overdue") {
      throw new Error(
        `Not allowed yet: ticket #${ticket.id} (${ticket.priority}) is still within its SLA. ${sla.summary}. Resolve deadline: ${sla.resolve_by}. It can be escalated only after a deadline is missed.`
      );
    }

    // P1 is reserved for outages and security, so an escalation never goes above P2.
    const newPriority = NEXT_PRIORITY[ticket.priority];
    const saved = await saveTicket(ticket.id, {
      priority: newPriority,
      description: withNote(
        ticket.description,
        `Escalated ${ticket.priority} to ${newPriority}, team lead notified`,
        `${reason} (SLA: ${sla.summary})`
      ),
    });
    return {
      escalated: true,
      previous_priority: ticket.priority,
      new_priority: newPriority,
      why_allowed: sla.summary,
      team_lead_notified: teams.get(ticket.team_id)?.name ?? ticket.team_id,
      updated: presentTicket(saved, rules, teams),
    };
  },
});

const getOpenIncidents = defineTool({
  name: "getOpenIncidents",
  description:
    "Use this when the user asks whether there is a known outage or company-wide incident, whether other people have the same problem, or wants a summary of open P1 tickets. Returns every active P1 ticket in the company, without employee names.",
  schema: z.object({}),
  run: async () => {
    const [{ data, error }, rules, teams] = await Promise.all([
      getSupabase()
        .from("tickets")
        .select(TICKET_COLUMNS)
        .eq("priority", "P1")
        .in("status", ACTIVE_STATUSES)
        .order("created_at", { ascending: false })
        .limit(20),
      loadSlaRules(),
      loadTeams(),
    ]);
    if (error) throw new Error(error.message);
    // Privacy rule: other employees' names and descriptions are never returned here.
    const incidents = (data as TicketRow[]).map((t) => ({
      ...presentTicket(t, rules, teams),
      raised_by_you: t.employee_id === CURRENT_EMPLOYEE_ID,
    }));
    return { count: incidents.length, incidents };
  },
});

/** Every tool in this list is given to Gemini. */
export const tools: AgentTool[] = [
  getMyProfile,
  searchKnowledgeBase,
  getMyTickets,
  getTicketStatus,
  getOpenIncidents,
  createTicket,
  updateTicket,
  escalateTicket,
];
