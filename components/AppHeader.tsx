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
      ? "rounded-full bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-[#15190f]"
      : "rounded-full px-3.5 py-2 text-xs font-medium text-[#a2a79f] transition hover:bg-white/[0.06] hover:text-white";

  return (
    <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-[14px] bg-[var(--accent)] text-lg font-black tracking-[-0.08em] text-[#15190f]">
          d.
        </div>
        <div>
          <h1 className="text-base font-semibold tracking-tight">DeskBot</h1>
          <p className="text-xs text-[#81877f]">IT helpdesk <span className="text-[#4d534c]">·</span> Zentrix Software</p>
        </div>
      </div>
      <nav aria-label="Main navigation" className="flex items-center gap-1 rounded-full border border-[var(--line)] bg-[#101210] p-1">
        <Link href="/" className={tab(current === "helpdesk")}>
          Helpdesk
        </Link>
        <Link href="/admin" className={tab(current === "admin")}>
          IT Admin board
        </Link>
        <button onClick={logout} className="ml-1 rounded-full px-3 py-2 text-xs text-[#858b83] transition hover:text-white">
          Log out
        </button>
      </nav>
    </header>
  );
}
