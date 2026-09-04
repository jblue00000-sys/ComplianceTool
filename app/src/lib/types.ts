/**
 * Domain model for the Agentic Risk Command Centre.
 *
 * The ten OWASP risk identifiers are treated as a display layer over the
 * underlying control scores, so a future revision of the standard changes the
 * catalogue in `owasp.ts` rather than the shape of an agent record.
 */

/** OWASP Top 10 for Agentic Applications (2026) risk identifier. */
export type AsiId =
  | "ASI01" | "ASI02" | "ASI03" | "ASI04" | "ASI05"
  | "ASI06" | "ASI07" | "ASI08" | "ASI09" | "ASI10";

/** A control score from 0 (no control) to 100 (fully in place). */
export type Score = number;

/** Every ASI risk carries exactly one control score per agent. */
export type PostureScores = Record<AsiId, Score>;

/**
 * How an agent touches a system or what a tool does.
 * `read` sees data, `write` alters it, `irreversible` cannot be undone.
 */
export type AccessMode = "read" | "write" | "irreversible";

/** How much human checking sits in front of the agent acting. */
export type Autonomy =
  /** A person approves every action. */
  | "full-approval"
  /** A person approves only above a value or risk threshold. */
  | "threshold"
  /** The agent acts alone. */
  | "none";

/** A system, dataset or external service an agent can reach. */
export interface AccessGrant {
  name: string;
  mode: AccessMode;
}

/** A callable capability the agent holds. */
export interface ToolGrant {
  name: string;
  mode: AccessMode;
}

/** One agent in the register. */
export interface Agent {
  id: string;
  name: string;
  /** Business unit the agent serves. */
  department: string;
  /** Named human accountable for it. */
  owner: string;
  /** Human-readable month it entered service. */
  inServiceSince: string;
  /** Human-readable expiry, or null when access never expires. */
  accessExpires: string | null;
  autonomy: Autonomy;
  /** Holds payment, ordering or budget rights. */
  canMoveMoney: boolean;
  access: AccessGrant[];
  tools: ToolGrant[];
  /**
   * How much the agent can do alone, 0-100. Higher is more dangerous.
   * Drives ASI02, ASI03, ASI05 and ASI08.
   */
  authority: Score;
  /**
   * How much human checking surrounds it, 0-100. Higher is safer.
   * Drives ASI01, ASI06, ASI09 and ASI10.
   */
  oversight: Score;
  posture: PostureScores;
}

/** Verdict band applied consistently to every score in the product. */
export type Band = "green" | "amber" | "red";

/** Severity of a live activity event. */
export type EventSeverity = "info" | "warning" | "critical";

/** One observed behaviour worth a supervisor's attention. */
export interface ActivityEvent {
  agentId: string;
  asi: AsiId;
  severity: EventSeverity;
  /** Relative age, e.g. "now", "11m", "3h". */
  age: string;
  message: string;
}

/** A single risk in the OWASP catalogue. */
export interface AsiRisk {
  id: AsiId;
  name: string;
  /** One plain-English sentence a business reader understands. */
  description: string;
  /** What having this control in place actually looks like. */
  compliantMeans: string;
}
