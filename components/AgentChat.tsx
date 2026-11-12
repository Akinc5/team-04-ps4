"use client";

import { useState } from "react";
import type { AgentResult, AgentStep } from "@/lib/agent/types";
import MorphOrb from "@/components/ui/ai-thiking-orb-and-input";

type Message = { role: "user" | "model"; text: string; steps?: AgentStep[] };

export default function AgentChat({
  onDataChanged,
  queuedPrompt,
}: {
  onDataChanged?: () => void;
  /** A prompt sent from outside the chat, for example by clicking a ticket. */
  queuedPrompt?: { text: string; n: number } | null;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [latestSteps, setLatestSteps] = useState<AgentStep[]>([]);

  async function askDeskBot(text: string): Promise<string> {
    const trimmed = text.trim();
    if (!trimmed) return "";
    const next: Message[] = [...messages, { role: "user", text: trimmed }];
    setMessages(next);
    setLatestSteps([]);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only the last 20 messages are sent, to keep requests small.
        body: JSON.stringify({ messages: next.slice(-20).map(({ role, text }) => ({ role, text })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      const result = data as AgentResult;
      setMessages([...next, { role: "model", text: result.reply, steps: result.steps }]);
      setLatestSteps(result.steps);
      if (result.steps.some((s) => s.writes && s.ok)) onDataChanged?.();
      return result.reply;
    } catch (err) {
      setMessages(next);
      throw err;
    }
  }

  return (
    <div className="bento-card flex min-h-[570px] flex-col">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Ask DeskBot</h2>
        </div>
      </div>

      <MorphOrb onSubmit={askDeskBot} request={queuedPrompt} />
      {latestSteps.length > 0 && (
        <div className="border-t border-[var(--line)] px-4 py-3 sm:px-5">
          <ToolSteps steps={latestSteps} />
        </div>
      )}
    </div>
  );
}

/** Shows each tool call so users (and judges) can see what the agent did. */
function ToolSteps({ steps }: { steps: AgentStep[] }) {
  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => (
        <details key={i} className="rounded-xl border border-[var(--line)] bg-[#101210] px-3 py-2 text-xs">
          <summary className="cursor-pointer select-none text-[#b8beb5]">
            <span className={s.ok ? "text-[var(--accent)]" : "text-[var(--danger)]"}>{s.ok ? "Done" : "Failed"}</span>
            {" · "}
            <span className="font-mono font-medium text-[#d9ded6]">{s.tool}</span>
            {s.writes && <span className="ml-2 rounded-full border border-[#60452a] bg-[#30251a] px-2 py-0.5 text-[10px] text-[#f3bd65]">writes data</span>}
          </summary>
          <pre className="subtle-scrollbar mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] leading-5 text-[#969d94]">
            {JSON.stringify({ args: s.args, ...(s.ok ? { result: s.result } : { error: s.error }) }, null, 2)}
          </pre>
        </details>
      ))}
    </div>
  );
}
