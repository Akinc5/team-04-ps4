"use client";

import Link from "next/link";

/** Shared header with the two views: the employee helpdesk and the IT Admin board. */
export default function AppHeader({ current }: { current: "helpdesk" | "admin" }) {
  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const tab = (active: boolean) =>
    active
      ? "rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white"
      : "rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200";

  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">DeskBot</h1>
        <p className="text-sm text-slate-500">IT helpdesk agent for Zentrix Software · Team 04 · PS4</p>
      </div>
      <nav className="flex items-center gap-1">
        <Link href="/" className={tab(current === "helpdesk")}>
          Helpdesk
        </Link>
        <Link href="/admin" className={tab(current === "admin")}>
          IT Admin board
        </Link>
        <button onClick={logout} className="ml-2 text-sm text-slate-500 hover:text-slate-900">
          Log out
        </button>
      </nav>
    </header>
  );
}
