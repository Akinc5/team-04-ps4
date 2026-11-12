import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  CURRENT_EMPLOYEE_ID,
  TICKET_COLUMNS,
  loadSlaRules,
  loadTeams,
  presentTicket,
  type TicketRow,
} from "@/lib/helpdesk";

export const runtime = "nodejs";

/** GET /api/tickets -> the logged-in employee, their tickets with SLA status, and summary counts. */
export async function GET() {
  try {
    const db = getSupabase();
    const [employee, tickets, rules, teams] = await Promise.all([
      db
        .from("employees")
        .select("id, name, department, location, laptop_model")
        .eq("id", CURRENT_EMPLOYEE_ID)
        .maybeSingle(),
      db
        .from("tickets")
        .select(TICKET_COLUMNS)
        .eq("employee_id", CURRENT_EMPLOYEE_ID)
        .order("created_at", { ascending: false })
        .limit(50),
      loadSlaRules(),
      loadTeams(),
    ]);
    if (employee.error) throw new Error(employee.error.message);
    if (tickets.error) throw new Error(tickets.error.message);

    const list = (tickets.data as TicketRow[]).map((t) => presentTicket(t, rules, teams));
    const active = list.filter((t) => t.sla?.state !== "done");
    return NextResponse.json({
      employee: employee.data,
      tickets: list,
      stats: {
        active: active.length,
        overdue: active.filter((t) => t.sla?.state === "breached" || t.sla?.state === "response_overdue").length,
        waiting_for_you: list.filter((t) => t.status === "waiting_for_user" || t.status === "resolved").length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load tickets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
