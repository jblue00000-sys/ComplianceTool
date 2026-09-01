import type { AsiId, AsiRisk } from "./types";

/**
 * OWASP Top 10 for Agentic Applications, 2026 edition (published 9 Dec 2025).
 *
 * This catalogue is the display layer. Control scores live on the agent record,
 * so a future revision of the standard is a change to this file alone.
 */
export const ASI_RISKS: readonly AsiRisk[] = [
  {
    id: "ASI01",
    name: "Agent Goal Hijack",
    description:
      "Hidden instructions in documents or email redirect the agent to serve someone else.",
    compliantMeans:
      "Retrieved content is separated from instructions and sensitive actions need confirmation.",
  },
  {
    id: "ASI02",
    name: "Tool Misuse & Exploitation",
    description:
      "Legitimate tools bent to harmful ends through deceptive inputs or poisoned descriptions.",
    compliantMeans:
      "Tools are least-privilege scoped and every call is checked against policy at runtime.",
  },
  {
    id: "ASI03",
    name: "Identity & Privilege Abuse",
    description:
      "Agents borrowing human credentials or holding long-lived, over-broad access.",
    compliantMeans:
      "Each agent holds its own short-lived, task-scoped credential and scopes are reviewed.",
  },
  {
    id: "ASI04",
    name: "Agentic Supply Chain",
    description:
      "Frameworks, connectors and tool registries that keep changing after deployment.",
    compliantMeans:
      "An AI Bill of Materials exists, components are signed and pinned, and loading is policy-gated.",
  },
  {
    id: "ASI05",
    name: "Unexpected Code Execution",
    description:
      "Plain language turning into running code outside the boundary you intended.",
    compliantMeans:
      "Execution is containerised and least-privilege with deny-by-default outbound network.",
  },
  {
    id: "ASI06",
    name: "Memory & Context Poisoning",
    description:
      "False facts planted in memory quietly steering behaviour weeks later.",
    compliantMeans:
      "Memory writes are validated, scoped per user and task, and can be inspected and cleared.",
  },
  {
    id: "ASI07",
    name: "Insecure Inter-Agent Communication",
    description:
      "Agents delegating to agents with no authentication or message integrity.",
    compliantMeans:
      "Mutual authentication, signed messages, and an allowlist of permitted delegation paths.",
  },
  {
    id: "ASI08",
    name: "Cascading Failures",
    description:
      "One agent's bad decision propagating through everything connected to it.",
    compliantMeans:
      "Blast radius is isolated, circuit breakers trip on deviation, dev and production are separate.",
  },
  {
    id: "ASI09",
    name: "Human-Agent Trust Exploitation",
    description:
      "A persuasive summary hiding a harmful action at the moment of approval.",
    compliantMeans:
      "Approvals show the raw action, and displayed content is logged against what executed.",
  },
  {
    id: "ASI10",
    name: "Rogue Agents",
    description:
      "An agent drifting outside policy while still looking entirely legitimate.",
    compliantMeans:
      "Behavioural baselines with deviation alerts, an owner and expiry per agent, tested kill switch.",
  },
] as const;

/** Risk identifiers in published order. */
export const ASI_IDS: readonly AsiId[] = ASI_RISKS.map((r) => r.id);

const BY_ID = new Map(ASI_RISKS.map((r) => [r.id, r]));

/** Look up one risk by identifier. */
export function asiRisk(id: AsiId): AsiRisk {
  const risk = BY_ID.get(id);
  if (!risk) throw new Error(`Unknown ASI identifier: ${id}`);
  return risk;
}
