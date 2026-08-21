"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type TabId = "deck" | "owasp" | "review" | "workforce";

export const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "deck", label: "Flight Deck" },
  { id: "owasp", label: "OWASP Live" },
  { id: "review", label: "Guided Review" },
  { id: "workforce", label: "Agent Workforce" },
];

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

  const openAgent = useCallback((id: string) => setOpenAgentId(id), []);
  const closeAgent = useCallback(() => setOpenAgentId(null), []);
  const focusAgent = useCallback((id: string | null) => setFocusedAgentId(id), []);

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
    }),
    [tab, openAgentId, openAgent, closeAgent, focusedAgentId, focusAgent, advisorOpen],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}
