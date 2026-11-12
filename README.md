# DeskBot: IT Helpdesk Ticket Agent

Team 04 | PS4 | SRM Agentic AI Hackathon

## The problem

Employees at Zentrix Software flood the IT team with simple tickets such as password resets and VPN issues. Most have known fixes, and the rest often go to the wrong team with the wrong priority.

## What our app does

- **Fixes first, tickets second:** the agent searches the knowledge base and gives the fix steps before it raises any ticket.
- **Right priority and team, every time:** when a ticket is needed, code (not the model) sets the priority from `sla_rules` and routes it to the correct support team.
- **Live SLA tracking:** every ticket shows whether it is on track, due soon or overdue against its SLA.
- **Rules the agent cannot break:** no duplicate tickets, escalation only after a missed SLA, reopening only within 7 days, and employees see only their own tickets.
- **IT Admin board:** IT staff see every ticket, worst SLA first, and change its status. The agent can also summarise open P1 incidents.

## Live demo

- Vercel link: <add your Vercel link>
- Passcode: <add your passcode>
- Try this prompt: "My VPN keeps disconnecting since morning." Then say "That did not work, I cannot work at all."

More prompts to try:

| Prompt | What happens |
| --- | --- |
| "I clicked a strange link in an email." | A P1 Security ticket is raised at once, with safety steps |
| "What is the status of my laptop ticket?" | The agent finds ticket #1 and reports that it is past its SLA |
| "Escalate my laptop battery ticket." | Allowed, because the SLA is missed: P3 becomes P2 |
| "Escalate it again." | Refused: a ticket can be escalated only once |
| "Reopen my Jira access ticket." | Refused: it was resolved more than 7 days ago |
| "My battery is draining quickly, raise a ticket." | Refused as a duplicate of ticket #1 |
| "Are there any open P1 incidents right now?" | The agent summarises open P1 tickets across the company |

Run `seed/ps4_it_helpdesk.sql` again in the Supabase SQL Editor to reset the data before a demo.

## Agent tools

| Tool | What it does | Reads or writes |
| --- | --- | --- |
| `searchKnowledgeBase` | Finds up to 3 help articles that match the problem | Reads |
| `getMyTickets` | Lists the employee's tickets with SLA status | Reads |
| `getTicketStatus` | Full description, history and deadlines of one ticket | Reads |
| `getOpenIncidents` | Open P1 tickets across the company, without names | Reads |
| `getMyProfile` | Employee details, support teams and SLA times | Reads |
| `createTicket` | Raises a ticket; code picks the priority and team | Writes |
| `updateTicket` | Adds information, cancels, confirms a fix or reopens | Writes |
| `escalateTicket` | Raises the priority when the SLA is missed | Writes |

Gemini chooses the tool by itself from the user's plain-English message. Every tool's arguments are checked with Zod before it runs, and every tool call is shown in the chat.

## Business rules

These are checked in code (`lib/helpdesk.ts` and `lib/agent/tools.ts`), not only in the prompt.

- **Priority** follows `sla_rules`: many users blocked or a security issue is P1, one user fully blocked is P2, work slowed is P3, a request is P4.
- **Team** comes from the category, for example VPN goes to Network & VPN.
- **No duplicates:** a new ticket is refused if the employee has an active ticket in the same category with a similar title.
- **Limit:** at most 5 active tickets per employee.
- **Ownership:** employees can only see and change their own tickets.
- **Escalation:** only when the SLA is missed, only once per ticket, and never above P2.
- **Reopen:** only within 7 days of the ticket being resolved or closed.
- **Security tickets** cannot be cancelled by the employee.
- The SLA clock counts calendar hours from when the ticket was created, and pauses while IT waits for the employee.

## Pages

| Page | Path | What it shows |
| --- | --- | --- |
| Helpdesk chat and My Tickets | `/` | The agent chat, with the employee's tickets and SLA status beside it |
| IT Admin board | `/admin` | Every ticket in the company; IT staff change the status here |

## Database tables

- `employees`: staff of Zentrix Software, with department, location and laptop model.
- `support_teams`: the five IT teams and what each one handles.
- `kb_articles`: 30 help articles with step-by-step fixes.
- `tickets`: every ticket, with category, priority, team, status and timestamps.
- `sla_rules`: response and resolve hours for each priority, P1 to P4.

## Tech stack

Next.js, React, TypeScript, Tailwind CSS, Supabase, Gemini API (function calling), Zod, Vercel

## Team

| Name | Role |
| --- | --- |
| <name> | Team Lead |
| <name> | Frontend |
| <name> | Backend / API |
| <name> | Database |
| <name> | AI / Agent |

## Run it locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the keys
3. Run `seed/ps4_it_helpdesk.sql` in the Supabase SQL Editor
4. `npm run dev`

## Folder guide

```
app/
  page.tsx                    Helpdesk chat + My Tickets
  admin/page.tsx              IT Admin board
  api/agent/route.ts          POST /api/agent: runs the agent
  api/tickets/route.ts        GET the employee's tickets
  api/admin/tickets/route.ts  GET all tickets, PATCH a ticket's status
components/
  AgentChat.tsx               Chat UI that shows every tool call
  TicketBoard.tsx             My Tickets panel with SLA status
  AppHeader.tsx               Header and navigation
lib/
  helpdesk.ts                 Business rules: priority, team, SLA, duplicates
  agent/tools.ts              The 8 agent tools
  agent/systemPrompt.ts       Instructions for Gemini
  agent/runAgent.ts           The agent loop (max 5 rounds, with a fallback model)
seed/ps4_it_helpdesk.sql      Seed data
```
