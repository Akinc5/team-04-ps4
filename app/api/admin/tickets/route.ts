import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { TICKET_COLUMNS, formatIST, loadSlaRules, loadTeams, presentTicket, type TicketRow } from "@/lib/helpdesk";

export const runtime = "nodejs";

/*
 * IT ADMIN API (for the IT Admin board)
 * GET   /api/admin/tickets -> every ticket in the company, with employee name and SLA status
 * PATCH /api/admin/tickets -> IT staff change a ticket's status   body: { id, status }
 */

export async function GET() {
  try {
    const db = getSupabase();
    const [tickets, employees, rules, teams] = await Promise.all([
      db.from("tickets").select(TICKET_COLUMNS).order("created_at", { ascending: false }).limit(200),
      db.from("employees").select("id, name, department"),
      loadSlaRules(),
      loadTeams(),
    ]);
    if (tickets.error) throw new Error(tickets.error.message);
    if (employees.error) throw new Error(employees.error.message);
    const names = new Map(employees.data.map((e) => [e.id, `${e.name} (${e.department})`]));

    const list = (tickets.data as TicketRow[]).map((t) => ({
      ...presentTicket(t, rules, teams),
      employee: names.get(t.employee_id) ?? t.employee_id,
    }));
    return NextResponse.json({ tickets: list, teams: [...teams.values()].map((t) => t.name) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load tickets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const changeStatusSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(["open", "in_progress", "waiting_for_user", "resolved", "closed"]),
});

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = changeStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  }
  const { id, status } = parsed.data;

  try {
    const db = getSupabase();
    const current = await db.from("tickets").select("status, description").eq("id", id).maybeSingle();
    if (current.error) throw new Error(current.error.message);
    if (!current.data) return NextResponse.json({ error: `No ticket found with number ${id}` }, { status: 404 });
    if (current.data.status === status) return NextResponse.json({ ok: true, unchanged: true });

    // Keep a history line in the description, so the employee and the agent can see what IT did.
    const note = `[IT changed status from ${current.data.status} to ${status} · ${formatIST(new Date())}]`;
    const { error } = await db
      .from("tickets")
      .update({ status, description: `${current.data.description}\n\n${note}`, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update the ticket";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
