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
    <main className="login-screen">
      <div className="login-grid" aria-hidden="true" />
      <form onSubmit={handleSubmit} className="login-form">
        <header className="login-header">
          <h1>DESKBOT<br /><span>ACCESS</span></h1>
        </header>

        <label className="login-field">
          <span>TEAM PASSCODE</span>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Enter passcode"
            aria-label="Team passcode"
            autoComplete="current-password"
            autoFocus
          />
        </label>

        {error && <p role="alert" className="login-error">{error}</p>}

        <button type="submit" disabled={loading || !passcode} className="login-submit">
          <span>{loading ? "VERIFYING ACCESS" : "INITIALIZE SESSION"}</span>
          <span aria-hidden="true">↗</span>
        </button>
      </form>
    </main>
  );
}
