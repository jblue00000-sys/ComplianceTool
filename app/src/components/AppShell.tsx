"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type TabId = "deck" | "owasp" | "asi01" | "tasks" | "review" | "workforce";

export const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "deck", label: "Flight Deck" },
  { id: "owasp", label: "OWASP Live" },
  { id: "tasks", label: "Remediation" },
  { id: "review", label: "Guided Review" },
  { id: "workforce", label: "Agent Workforce" },
];

/** Which lens the OWASP Live tab is showing. */
export type OwaspView = "risk" | "matrix" | "agent";

interface ShellState {
  tab: TabId;
  setTab: (tab: TabId) => void;
  /** Agent whose detail panel is open, or null. */
  openAgentId: string | null;
  openAgent: (id: string) => void;
  closeAgent: () => void;
  /** Agent the Flight Deck map is focused on, or null for the whole estate. */
  focusedAgentId: string | null;
  focusAgent: (id: string | null) => void;
  advisorOpen: boolean;
  setAdvisorOpen: (open: boolean) => void;
  /** Lens the OWASP Live tab is showing. */
  owaspView: OwaspView;
  setOwaspView: (view: OwaspView) => void;
  /** Agent the risk views are scoped to, or null for the whole estate. */
  riskAgentId: string | null;
  setRiskAgent: (id: string | null) => void;
  /** Jump straight to one agent's ten OWASP controls. */
  showAgentRisks: (id: string) => void;
}

const ShellContext = createContext<ShellState | null>(null);

/** Access shared navigation and selection state. */
export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside <ShellProvider>");
  return ctx;
}

export function ShellProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<TabId>("deck");
  const [openAgentId, setOpenAgentId] = useState<string | null>(null);
  const [focusedAgentId, setFocusedAgentId] = useState<string | null>(null);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [owaspView, setOwaspView] = useState<OwaspView>("risk");
  const [riskAgentId, setRiskAgent] = useState<string | null>(null);

  const openAgent = useCallback((id: string) => setOpenAgentId(id), []);
  const closeAgent = useCallback(() => setOpenAgentId(null), []);
  const focusAgent = useCallback((id: string | null) => setFocusedAgentId(id), []);

  // One route into the per-agent risk view, so every caller lands identically.
  const showAgentRisks = useCallback((id: string) => {
    setRiskAgent(id);
    setOwaspView("agent");
    setOpenAgentId(null);
    setTab("owasp");
  }, []);

  const value = useMemo<ShellState>(
    () => ({
      tab,
      setTab,
      openAgentId,
      openAgent,
      closeAgent,
      focusedAgentId,
      focusAgent,
      advisorOpen,
      setAdvisorOpen,
      owaspView,
      setOwaspView,
      riskAgentId,
      setRiskAgent,
      showAgentRisks,
    }),
    [
      tab,
      openAgentId,
      openAgent,
      closeAgent,
      focusedAgentId,
      focusAgent,
      advisorOpen,
      owaspView,
      riskAgentId,
      showAgentRisks,
    ],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}
