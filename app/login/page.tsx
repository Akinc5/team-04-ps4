"use client";

import { useState } from "react";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    setLoading(false);
    if (res.ok) {
      window.location.href = "/";
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Login failed");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={handleSubmit} className="bento-card w-full max-w-sm p-6 sm:p-8">
        <div className="mb-6 flex size-11 items-center justify-center rounded-[14px] bg-[var(--accent)] text-lg font-black tracking-[-0.08em] text-[#15190f]">
          d.
        </div>
        <p className="eyebrow mb-1">ZENTRIX SOFTWARE</p>
        <h1 className="text-xl font-semibold tracking-tight">Welcome to DeskBot</h1>
        <p className="muted mt-2 text-sm leading-6">Enter the team passcode to open the IT helpdesk.</p>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className="dark-control mt-5 w-full px-3.5 py-3 text-sm outline-none transition focus:border-[#66734d]"
          placeholder="Passcode"
          aria-label="Team passcode"
          autoFocus
        />
        {error && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
        <button
          type="submit"
          disabled={loading || !passcode}
          className="lime-button mt-4 w-full rounded-xl px-3 py-3 text-sm font-semibold"
        >
          {loading ? "Checking..." : "Continue →"}
        </button>
      </form>
    </main>
  );
}
