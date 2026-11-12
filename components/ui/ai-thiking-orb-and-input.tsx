"use client";

import { useEffect, useRef, useState } from "react";

const THINKING_STEPS = ["Thinking", "Searching", "Analyzing", "Composing"];

export interface MorphOrbProps {
  onSubmit: (text: string) => Promise<string> | string;
  request?: { text: string; n: number } | null;
  placeholder?: string;
  minThinkMs?: number;
}

export default function MorphOrb({
  onSubmit,
  request,
  placeholder = "Describe your IT issue...",
  minThinkMs = 250,
}: MorphOrbProps) {
  const [value, setValue] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "thinking" | "answered">("idle");
  const [thinkingStep, setThinkingStep] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<(text: string) => Promise<void>>(async () => {});

  async function submit(text: string) {
    const prompt = text.trim();
    if (!prompt || phase === "thinking") return;

    setValue("");
    setAnswer("");
    setError("");
    setPhase("thinking");
    setThinkingStep(0);

    const startedAt = Date.now();
    try {
      const reply = await onSubmit(prompt);
      const remaining = minThinkMs - (Date.now() - startedAt);
      if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
      setAnswer(reply);
      setPhase("answered");
    } catch (submitError) {
      const remaining = minThinkMs - (Date.now() - startedAt);
      if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
      setError(submitError instanceof Error ? submitError.message : "DeskBot could not complete that request.");
      setPhase("answered");
    }
  }

  useEffect(() => {
    submitRef.current = submit;
  });

  useEffect(() => {
    if (request) void submitRef.current(request.text);
  }, [request?.n, request?.text]);

  useEffect(() => {
    if (phase !== "thinking") return;
    const timer = window.setInterval(() => {
      setThinkingStep((current) => (current + 1) % THINKING_STEPS.length);
    }, 1100);
    return () => window.clearInterval(timer);
  }, [phase]);

  function reset() {
    setPhase("idle");
    setAnswer("");
    setError("");
    setValue("");
    window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }

  return (
    <div className={`morph-orb-stage morph-orb-${phase}`}>
      <div className="morph-orb-atmosphere" aria-hidden="true" />
      <div className="morph-orb-center">
        <div className="morph-orb-glow" aria-hidden="true" />
        <div className="morph-orb" role="img" aria-label={phase === "thinking" ? "DeskBot is thinking" : "DeskBot"}>
          <span className="morph-orb-core" />
          <span className="morph-orb-sheen" />
          <span className="morph-orb-ring morph-orb-ring-one" />
          <span className="morph-orb-ring morph-orb-ring-two" />
        </div>

        {phase === "idle" && (
          <p className="morph-orb-caption">Ask DeskBot about an IT issue</p>
        )}
        {phase === "thinking" && (
          <p className="morph-orb-caption" role="status" aria-live="polite">
            {THINKING_STEPS[thinkingStep]}<span className="morph-orb-ellipsis" aria-hidden="true">...</span>
          </p>
        )}
        {phase === "answered" && (
          <div className="morph-orb-answer-wrap">
            <section className={`morph-orb-answer ${error ? "morph-orb-error" : ""}`} aria-live="polite">
              <p className="morph-orb-answer-label">{error ? "Could not complete" : "DeskBot"}</p>
              <p className="morph-orb-answer-text">{error || answer}</p>
            </section>
            <button type="button" className="morph-orb-reset" onClick={reset}>New question</button>
          </div>
        )}
      </div>

      <form
        className="morph-orb-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(value);
        }}
      >
        <span className="morph-orb-spark" aria-hidden="true">✦</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          aria-label="Describe your IT issue"
          autoComplete="off"
          maxLength={500}
          disabled={phase === "thinking"}
        />
        <button type="submit" disabled={!value.trim() || phase === "thinking"} aria-label="Send to DeskBot">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
          </svg>
        </button>
      </form>
    </div>
  );
}
