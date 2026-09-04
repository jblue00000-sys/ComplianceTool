"use client";

import { AGENTS, ORGANISATION } from "@/lib/data";
import { Advisor } from "@/components/Advisor";
import { AgentDrawer } from "@/components/AgentDrawer";
import { ShellProvider, TABS, useShell } from "@/components/AppShell";
import { Asi01Detail } from "@/components/Asi01Detail";
import { FlightDeck } from "@/components/FlightDeck";
import { GuidedReview } from "@/components/GuidedReview";
import { OwaspLive } from "@/components/OwaspLive";
import { Remediation } from "@/components/Remediation";
import { Workforce } from "@/components/Workforce";

function TopBar() {
  const { tab, setTab, setAdvisorOpen } = useShell();
  return (
    <header className="sticky top-0 z-60 flex h-14.5 items-center gap-4 border-b border-(--color-line) bg-[#0b111b] px-5">
      <div className="flex shrink-0 items-center gap-2.5 font-bold tracking-tight">
        <span className="grid size-6.5 place-items-center rounded-lg bg-[linear-gradient(140deg,var(--color-accent),var(--color-accent-2))] text-[13px] font-black text-[#06101d]">
          A
        </span>
        Agentic Risk
      </div>
      <nav className="flex flex-wrap gap-0.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`rounded-[9px] border px-3.5 py-1.5 text-[13.5px] font-semibold transition ${
              tab === t.id
                ? "border-(--color-line-2) bg-(--color-panel-2) text-(--color-ink)"
                : "border-transparent text-(--color-mute) hover:bg-(--color-panel) hover:text-(--color-ink)"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="flex-1" />
      <span className="hidden shrink-0 rounded-full border border-(--color-line) px-3 py-1 font-mono text-xs text-(--color-dim) lg:block">
        {ORGANISATION.toUpperCase()} · {AGENTS.length} agents · demo data
      </span>
      <button
        type="button"
        onClick={() => setAdvisorOpen(true)}
        className="shrink-0 rounded-[9px] bg-[linear-gradient(140deg,var(--color-accent),var(--color-accent-2))] px-3.5 py-2 text-[13px] font-bold text-[#06101d]"
      >
        Ask the advisor
      </button>
    </header>
  );
}

function Body() {
  const { tab } = useShell();
  return (
    <main className="p-5.5">
      {tab === "deck" ? <FlightDeck /> : null}
      {tab === "owasp" ? <OwaspLive /> : null}
      {tab === "asi01" ? <Asi01Detail /> : null}
      {tab === "tasks" ? <Remediation /> : null}
      {tab === "review" ? <GuidedReview /> : null}
      {tab === "workforce" ? <Workforce /> : null}
    </main>
  );
}

export default function Page() {
  return (
    <ShellProvider>
      <TopBar />
      <Body />
      <AgentDrawer />
      <Advisor />
    </ShellProvider>
  );
}
