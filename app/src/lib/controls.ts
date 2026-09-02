import { AGENTS, agentById } from "./data";
import { riskDetail } from "./mitigations";
import type { AsiId, Band } from "./types";

/**
 * Per-agent status against each published control.
 *
 * This is what turns a risk score into something a reader can challenge: the
 * ASI01 number an agent carries is the roll-up of these nine cells, not an
 * independent judgement.
 */

export type ControlStatus = "in-place" | "partial" | "missing" | "not-applicable";

/** Points a status contributes. Not-applicable is excluded, never counted as zero. */
const STATUS_WEIGHT: Record<ControlStatus, number | null> = {
  "in-place": 100,
  partial: 55,
  missing: 0,
  "not-applicable": null,
};

export const STATUS_LABEL: Record<ControlStatus, string> = {
  "in-place": "In place",
  partial: "Partial",
  missing: "Missing",
  "not-applicable": "Not applicable",
};

/** Band a status shares with the rest of the product's palette. */
export const STATUS_BAND: Record<ControlStatus, Band | "neutral"> = {
  "in-place": "green",
  partial: "amber",
  missing: "red",
  "not-applicable": "neutral",
};

type Cells = Record<number, "in" | "pa" | "mi" | "na">;

const ASI01_CELLS: Record<string, Cells> = {
  "procurement-assistant": { 1: "pa", 2: "pa", 3: "in", 4: "mi", 5: "mi", 6: "mi", 7: "mi", 8: "mi", 9: "mi" },
  "dev-assistant": { 1: "in", 2: "pa", 3: "mi", 4: "mi", 5: "mi", 6: "in", 7: "in", 8: "in", 9: "in" },
  "reporting-analyst": { 1: "in", 2: "in", 3: "in", 4: "pa", 5: "mi", 6: "na", 7: "in", 8: "in", 9: "in" },
  "customer-support-bot": { 1: "mi", 2: "mi", 3: "mi", 4: "mi", 5: "mi", 6: "in", 7: "pa", 8: "in", 9: "mi" },
  "hr-intake-agent": { 1: "in", 2: "pa", 3: "in", 4: "mi", 5: "mi", 6: "pa", 7: "in", 8: "in", 9: "in" },
  "scheduler": { 1: "in", 2: "pa", 3: "in", 4: "pa", 5: "mi", 6: "na", 7: "in", 8: "in", 9: "in" },
  "contract-reviewer": { 1: "in", 2: "pa", 3: "in", 4: "mi", 5: "mi", 6: "in", 7: "mi", 8: "mi", 9: "in" },
  "campaign-writer": { 1: "in", 2: "pa", 3: "mi", 4: "mi", 5: "mi", 6: "in", 7: "mi", 8: "in", 9: "in" },
  "it-provisioning-agent": { 1: "mi", 2: "mi", 3: "mi", 4: "mi", 5: "mi", 6: "in", 7: "mi", 8: "mi", 9: "in" },
  "treasury-reconciler": { 1: "mi", 2: "pa", 3: "pa", 4: "mi", 5: "mi", 6: "in", 7: "in", 8: "in", 9: "mi" },
  "supplier-screener": { 1: "in", 2: "in", 3: "in", 4: "mi", 5: "mi", 6: "mi", 7: "in", 8: "in", 9: "mi" },
  "security-triage-agent": { 1: "in", 2: "pa", 3: "in", 4: "mi", 5: "mi", 6: "mi", 7: "in", 8: "mi", 9: "in" },
  "exec-briefing-agent": { 1: "mi", 2: "pa", 3: "in", 4: "mi", 5: "mi", 6: "mi", 7: "mi", 8: "mi", 9: "mi" },
  "invoice-processor": { 1: "in", 2: "mi", 3: "mi", 4: "mi", 5: "mi", 6: "mi", 7: "mi", 8: "mi", 9: "pa" },
};

/**
 * The per-agent assessment matrix, by risk.
 *
 * Only ASI01 has been assessed. A risk that is absent here has no per-agent
 * status at all, and the product must say so: borrowing another risk's cells
 * would put a rating and an evidence line against a control nobody has looked
 * at, which is invented compliance evidence. Transcribing a risk's controls
 * deliberately does not add it here.
 */
const MATRICES: Partial<Record<AsiId, Record<string, Cells>>> = {
  ASI01: ASI01_CELLS,
};

/** True when a risk has a real per-agent assessment matrix behind it. */
export function hasAssessments(risk: AsiId): boolean {
  return MATRICES[risk] !== undefined;
}

const EXPAND: Record<"in" | "pa" | "mi" | "na", ControlStatus> = {
  in: "in-place",
  pa: "partial",
  mi: "missing",
  na: "not-applicable",
};

/**
 * Not-applicable has to be earned. Without a written reason it is the easiest
 * way to game a score, so the model refuses to carry one silently.
 */
const NA_JUSTIFICATION: Record<string, Record<number, string>> = {
  "reporting-analyst": {
    6: "Reads only the internal data warehouse. No retrieved documents, email, calendar or peer-agent messages reach this agent, so there is no connected source to sanitise. Confirmed by S. Vale, Apr 2026.",
  },
  scheduler: {
    6: "Operates solely against the internal directory and calendar system. No external or user-supplied content enters its context. Confirmed by H. Nair, Feb 2026.",
  },
};

const EVIDENCE: Record<number, Record<"in-place" | "partial" | "missing", string>> = {
  1: {
    "in-place": "Injection filtering confirmed on every input path, including retrieval and tool output",
    partial: "Filtering on the chat input only; retrieved content bypasses it",
    missing: "No injection filtering on any input path",
  },
  2: {
    "in-place": "Tool scopes reviewed and approval required on every irreversible action",
    partial: "Scopes narrowed, but approval is only required above a value threshold",
    missing: "Broad tool scopes and no approval step on irreversible actions",
  },
  3: {
    "in-place": "System prompt held in version control with a drift alarm active",
    partial: "Prompt is in version control, but changes are not reviewed before release",
    missing: "Prompt is edited directly in the vendor console",
  },
  4: {
    "in-place": "Goal comparison runs before every high-impact action",
    partial: "Deviations are logged but do not halt execution",
    missing: "No run-time intent check of any kind",
  },
  5: {
    "in-place": "Signed goal envelope enforced on each execution cycle",
    partial: "Prototyped on this agent, not yet enforced",
    missing: "Not evaluated — the standard lists this as an emerging pattern",
  },
  6: {
    "in-place": "Disarm and prompt-carrier detection on every connected source",
    partial: "Uploaded documents are cleaned; calendar and peer-agent messages are not",
    missing: "No sanitisation on any connected source",
  },
  7: {
    "in-place": "Baseline established and goal-drift alerts route to the on-call queue",
    partial: "Activity is logged, but there is no baseline and no alerting",
    missing: "Goal state is not logged, so drift would be invisible",
  },
  8: {
    "in-place": "Red-team exercise completed against all four scenarios, rollback verified",
    partial: "Tested against direct injection only",
    missing: "Never tested",
  },
  9: {
    "in-place": "Named in the insider threat programme scope with an investigation path",
    partial: "In scope, but no investigation path has been defined",
    missing: "Not in the programme's scope",
  },
};

const MONTHS = [
  "Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026",
  "May 2026", "Jun 2026", "Jul 2026", "Aug 2026",
];

export interface ControlAssessment {
  agentId: string;
  risk: AsiId;
  controlN: number;
  status: ControlStatus;
  /** What supports this rating. A status with no evidence cannot be audited. */
  evidence: string;
  lastChecked: string;
  /** Present only when the status is not-applicable. */
  justification?: string;
}

function agentIndex(agentId: string): number {
  return AGENTS.findIndex((a) => a.id === agentId);
}

/**
 * Every control assessment for one agent against one risk.
 *
 * Empty when the risk has no assessment matrix, even where its controls have
 * been transcribed — a published control catalogue is not a statement about
 * this agent.
 */
export function assessmentsFor(agentId: string, risk: AsiId = "ASI01"): ControlAssessment[] {
  const detail = riskDetail(risk);
  const cells = MATRICES[risk]?.[agentId];
  if (!detail || !cells) return [];
  const idx = agentIndex(agentId);
  return detail.controls.map((control) => {
    const status = EXPAND[cells[control.n]];
    const justification = NA_JUSTIFICATION[agentId]?.[control.n];
    const evidence =
      status === "not-applicable"
        ? (justification ?? "No reason recorded.")
        : EVIDENCE[control.n][status];
    return {
      agentId,
      risk,
      controlN: control.n,
      status,
      evidence,
      lastChecked: MONTHS[(idx * 3 + control.n) % MONTHS.length],
      justification,
    };
  });
}

/**
 * The risk score for one agent, rolled up from its control assessments.
 * Null when there is nothing to roll up, so a caller cannot mistake the
 * absence of an assessment for a score of zero.
 */
export function rollUpScore(agentId: string, risk: AsiId = "ASI01"): number | null {
  const scored = assessmentsFor(agentId, risk)
    .map((a) => STATUS_WEIGHT[a.status])
    .filter((w): w is number => w !== null);
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((x, y) => x + y, 0) / scored.length);
}

/** How the whole estate stands against one control. */
export interface ControlCoverage {
  controlN: number;
  inPlace: number;
  partial: number;
  missing: number;
  notApplicable: number;
  /** Percentage in place, measured against applicable agents only. */
  compliantPct: number;
  applicable: number;
}

/**
 * How the estate stands against one control, or null when the risk has no
 * per-agent assessment. Zeroed counts would read as "nobody has this control",
 * which is a finding rather than the silence it actually is.
 */
export function controlCoverage(controlN: number, risk: AsiId = "ASI01"): ControlCoverage | null {
  if (!hasAssessments(risk)) return null;
  let inPlace = 0, partial = 0, missing = 0, notApplicable = 0;
  for (const agent of AGENTS) {
    const cell = assessmentsFor(agent.id, risk).find((a) => a.controlN === controlN);
    if (!cell) continue;
    if (cell.status === "in-place") inPlace += 1;
    else if (cell.status === "partial") partial += 1;
    else if (cell.status === "missing") missing += 1;
    else notApplicable += 1;
  }
  const applicable = inPlace + partial + missing;
  return {
    controlN,
    inPlace,
    partial,
    missing,
    notApplicable,
    applicable,
    compliantPct: applicable === 0 ? 0 : Math.round((inPlace / applicable) * 100),
  };
}

/* ---------------------------------------------------------------- tasks ---- */

export type TaskPriority = "high" | "medium" | "low";
export type TaskState = "open" | "in-progress" | "blocked";

export interface RemediationTask {
  id: string;
  risk: AsiId;
  controlN: number;
  controlShort: string;
  agentId: string;
  agentName: string;
  department: string;
  /** The person accountable — the agent's manager. */
  assignee: string;
  /** The team that does the work. */
  team: string;
  effort: string;
  priority: TaskPriority;
  state: TaskState;
  due: string;
  /** Why this task exists. */
  gap: string;
}

const DUE_BY_PRIORITY: Record<TaskPriority, string[]> = {
  high: ["12 Sep 2026", "19 Sep 2026", "26 Sep 2026"],
  medium: ["17 Oct 2026", "31 Oct 2026", "14 Nov 2026"],
  low: ["28 Nov 2026", "12 Dec 2026", "16 Jan 2027"],
};

/**
 * Priority combines how bad the gap is with how much damage the agent could do
 * and how many published attack scenarios the control defends against.
 */
function priorityFor(agentId: string, controlN: number, status: ControlStatus): TaskPriority {
  const agent = agentById(agentId);
  const detail = riskDetail("ASI01");
  let points = status === "missing" ? 2 : 1;
  if (agent?.canMoveMoney) points += 1;
  if (agent && agent.autonomy === "none") points += 1;
  const defends = detail?.scenarios.filter((s) => s.brokenBy.includes(controlN)).length ?? 0;
  if (defends >= 3) points += 1;
  if (points >= 4) return "high";
  if (points >= 3) return "medium";
  return "low";
}

/**
 * Every open gap across the estate, as a task with an owner and a date.
 * In-place and not-applicable controls produce no task.
 */
export function remediationTasks(risk: AsiId = "ASI01"): RemediationTask[] {
  const detail = riskDetail(risk);
  if (!detail) return [];
  const tasks: RemediationTask[] = [];
  AGENTS.forEach((agent, agentIdx) => {
    for (const assessment of assessmentsFor(agent.id, risk)) {
      if (assessment.status === "in-place" || assessment.status === "not-applicable") continue;
      const control = detail.controls.find((c) => c.n === assessment.controlN);
      if (!control) continue;
      const priority = priorityFor(agent.id, control.n, assessment.status);
      const slot = (agentIdx + control.n) % 3;
      tasks.push({
        id: `${agent.id}-${risk.toLowerCase()}-${control.n}`,
        risk,
        controlN: control.n,
        controlShort: control.short,
        agentId: agent.id,
        agentName: agent.name,
        department: agent.department,
        assignee: agent.owner,
        team: control.team,
        effort: control.effort,
        priority,
        state:
          assessment.status === "partial"
            ? "in-progress"
            : control.n === 5
              ? "blocked"
              : "open",
        due: DUE_BY_PRIORITY[priority][slot],
        gap: assessment.evidence,
      });
    }
  });
  return tasks;
}

export const TASK_PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
