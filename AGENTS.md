# AGENTS.md

Notes for AI coding tools working in this repo.

## Project

DeskBot is the PS4 IT Helpdesk Ticket Agent for the SRM Agentic AI Hackathon (Team 04). The logged-in demo user is employee E101 (Karthik S) at Zentrix Software.

## Stack (do not change)

Next.js App Router, React, TypeScript, Tailwind CSS, Supabase PostgreSQL, Gemini function calling (`@google/genai`), Zod, Vercel.

## Rules

- Agent tools live in `lib/agent/tools.ts`. Each one uses `defineTool` with a Zod schema and a description that starts with "Use this when".
- Business rules live in code in `lib/helpdesk.ts`. Never rely on the prompt alone to enforce a rule.
- Tools read and write Supabase. Never return hard-coded data, and never pick a tool with `if` or `switch` on the user's words.
- `SUPABASE_SECRET_KEY` is used only under `lib/` and `app/api/`. Never in components.
- Never commit `.env.local` or any key.
- Use only the seed data. No real personal data.
- Run `npm run build` before every push.
