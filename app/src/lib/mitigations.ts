import type { AsiId } from "./types";

/**
 * The prevention and mitigation guidelines a risk publishes, plus the attack
 * scenarios they defend against.
 *
 * Source: OWASP Top 10 for Agentic Applications 2026, version 12.6. Every risk
 * in the standard has this same shape - description, common examples, attack
 * scenarios, numbered mitigations - so adding ASI02..ASI10 is content rather
 * than new code.
 */

/** How much work closing a control typically is. Deliberately coarse. */
export type Effort = "Hours" | "Days" | "Weeks";

export interface Control {
  /** Position in the published list, 1-based. */
  n: number;
  /** Plain-English name for the control. */
  name: string;
  /** Short label for dense surfaces. */
  short: string;
  /** One business-readable sentence. */
  description: string;
  /** The standard's own wording, quoted so a rating can be checked against it. */
  guideline: string;
  /** Concrete actions that close the gap. Identical whichever agent it is. */
  steps: readonly string[];
  effort: Effort;
  /** The team that owns the fix. */
  team: string;
  /** How you would prove the control is genuinely in place afterwards. */
  verification: string;
}

export interface AttackScenario {
  title: string;
  description: string;
  /** Control numbers that break this attack chain. */
  brokenBy: readonly number[];
}

export interface RiskDetail {
  id: AsiId;
  scenarios: readonly AttackScenario[];
  controls: readonly Control[];
}

const ASI01_CONTROLS: readonly Control[] = [
  {
    n: 1,
    name: "Treat every natural-language input as untrusted",
    short: "Untrusted input handling",
    description:
      "User text, uploaded documents and retrieved content all pass through injection safeguards before they can influence the agent's goal.",
    guideline:
      "Treat all natural-language inputs (e.g., user-provided text, uploaded documents, retrieved content) as untrusted. Route them through the same input-validation and prompt-injection safeguards defined in LLM01:2025 before they can influence goal selection, planning, or tool calls.",
    steps: [
      "Inventory every path by which outside text reaches the agent — prompts, files, retrieval, tool results, peer agents.",
      "Put an injection-detection filter in front of each path, not just the chat box.",
      "Structurally separate retrieved content from instructions so retrieved text can never outrank the system message.",
      "Hold anything the filter cannot score rather than passing it through.",
    ],
    effort: "Days",
    team: "Platform engineering",
    verification:
      "Replay a known injection corpus through every input path and confirm none reaches goal selection.",
  },
  {
    n: 2,
    name: "Least privilege on tools, human approval on high-impact actions",
    short: "Least privilege + approval",
    description:
      "Even a successfully hijacked agent cannot do much, because its tools are narrow and anything consequential stops for a person.",
    guideline:
      "Minimize the impact of goal hijacking by enforcing least privilege for agent tools and requiring human approval for high-impact or goal-changing actions.",
    steps: [
      "Classify every tool by whether its effect can be undone.",
      "Strip scopes back to the minimum the agent's actual job needs.",
      "Put a human approval step in front of every irreversible or goal-changing action.",
      "Re-check the scopes on a schedule — they drift wider, never narrower.",
    ],
    effort: "Days",
    team: "Agent owner",
    verification:
      "Attempt a high-impact action as the agent and confirm it blocks pending approval.",
  },
  {
    n: 3,
    name: "Lock the system prompt under change control",
    short: "Locked system prompts",
    description:
      "Goal priorities and permitted actions are explicit, auditable, and cannot be edited without review.",
    guideline:
      "Define and lock agent system prompts so that goal priorities and permitted actions are explicit and auditable. Changes to changes in goals or reward definitions must go through configuration management and human approval.",
    steps: [
      "Move the system prompt into version control alongside code.",
      "Make goal priorities and permitted actions explicit rather than implied.",
      "Require review and approval on every change, the same as a code change.",
      "Alert if the running prompt ever differs from the approved one.",
    ],
    effort: "Hours",
    team: "Platform engineering",
    verification: "Change the prompt outside the approved path and confirm the drift alarm fires.",
  },
  {
    n: 4,
    name: "Validate intent at run time and stop on goal drift",
    short: "Run-time intent validation",
    description:
      "Before anything high-impact, check that what the agent is about to do still matches what it was asked to do — and halt if it does not.",
    guideline:
      "At run time, validate both user intent and agent intent before executing goal-changing or high-impact actions. Require confirmation - via human approval, policy engine, or platform guardrails whenever the agent proposes actions that deviate from the original task or scope. Pause or block execution on any unexpected goal shift, surface the deviation for review, and record it for audit.",
    steps: [
      "Capture the original task as a stated goal at the start of every run.",
      "Before each high-impact action, compare the proposed action against that goal.",
      "On any deviation, pause and route to a person or a policy engine rather than proceeding.",
      "Record every deviation and its resolution for audit.",
    ],
    effort: "Weeks",
    team: "Platform engineering",
    verification: "Inject a mid-run goal change and confirm execution pauses and is logged.",
  },
  {
    n: 5,
    name: "Evaluate the intent capsule pattern",
    short: "Intent capsule (emerging)",
    description:
      "Bind the declared goal, its constraints and its context into a signed envelope for each execution cycle, so the goal cannot be silently swapped.",
    guideline:
      "When building agents, evaluate use of “intent capsule”, an emerging pattern to bind the declared goal, constraints, and context to each execution cycle in a signed envelope, restricting run-time use.",
    steps: [
      "Assess whether the agent framework can carry a signed goal envelope.",
      "Prototype on one high-impact agent before committing.",
      "Treat as evaluation rather than a required control — the standard itself flags it as emerging.",
    ],
    effort: "Weeks",
    team: "Architecture",
    verification: "Tamper with the goal envelope in transit and confirm the run refuses to proceed.",
  },
  {
    n: 6,
    name: "Sanitise every connected data source",
    short: "Data source sanitisation",
    description:
      "Retrieved documents, email, calendar invites, uploaded files, API responses, browser output and peer-agent messages are all cleaned before they can steer the agent.",
    guideline:
      "Sanitize and validate any connected data source - including RAG inputs, emails, calendar invites, uploaded files, external APIs, browsing output, and peer-agent messages - using CDR, prompt-carrier detection, and content filtering before the data can influence agent goals or actions.",
    steps: [
      "List every connected source, including the ones nobody thinks of — calendar invites and peer-agent messages.",
      "Apply content disarm and reconstruction to files before the agent reads them.",
      "Run prompt-carrier detection on retrieved text and tool output.",
      "Quarantine anything that fails rather than passing it with a warning.",
    ],
    effort: "Weeks",
    team: "Security engineering",
    verification:
      "Plant a hidden instruction in a document and a calendar invite; confirm both are caught.",
  },
  {
    n: 7,
    name: "Baseline behaviour and alert on goal drift",
    short: "Behavioural baseline & alerting",
    description:
      "Know what normal looks like for this agent — its goal state, its tool patterns — and raise an alarm the moment it changes.",
    guideline:
      "Maintain comprehensive logging and continuous monitoring of agent activity, establishing a behavioral baseline that includes goal state, tool-use patterns, and invariant properties (e.g., schema, access patterns). Track a stable identifier for the active goal where feasible, and alert on any deviations - such as unexpected goal changes, anomalous tool sequences, or shifts from the established baseline - so that unauthorized goal drift is immediately visible in operations.",
    steps: [
      "Log goal state and tool calls, not just outputs.",
      "Build a baseline of normal tool sequences and access patterns over a few weeks.",
      "Give each active goal a stable identifier so a change is detectable.",
      "Alert on deviation, and route the alert somewhere a human actually reads.",
    ],
    effort: "Weeks",
    team: "Security operations",
    verification: "Force an anomalous tool sequence and confirm an alert reaches the on-call queue.",
  },
  {
    n: 8,
    name: "Red-team goal override, and test rollback",
    short: "Red-team & rollback tests",
    description:
      "Periodically try to hijack your own agent, and prove you can put things back afterwards.",
    guideline:
      "Conduct periodic red-team tests simulating goal override and verify rollback effectiveness.",
    steps: [
      "Run a scheduled exercise attempting to redirect the agent's goal.",
      "Cover all four published attack scenarios, not just direct injection.",
      "Verify the rollback actually restores the prior state.",
      "Record findings and re-test the fixes.",
    ],
    effort: "Days",
    team: "Security operations",
    verification: "A dated red-team report exists with findings closed and rollback confirmed.",
  },
  {
    n: 9,
    name: "Bring agents into the insider threat programme",
    short: "Insider threat coverage",
    description:
      "Agents are watched for insider-style abuse the same way staff are — including insiders prompting an agent to reach data they should not.",
    guideline:
      "Incorporate AI Agents into the established Insider Threat Program to monitor any insider prompts intended to get access to sensitive data or to alter the agent behavior and allow for investigation in case of outlier activity.",
    steps: [
      "Add agent identities and their prompts to the insider threat programme's scope.",
      "Monitor for staff prompting an agent toward data they cannot access directly.",
      "Define an investigation path for outlier agent activity.",
      "Confirm legal and HR sign-off on monitoring prompts.",
    ],
    effort: "Days",
    team: "Risk & compliance",
    verification:
      "The programme's written scope names agent activity, and one investigation path has been walked through.",
  },
];

const ASI01_SCENARIOS: readonly AttackScenario[] = [
  {
    title: "EchoLeak — zero-click indirect prompt injection",
    description:
      "An attacker emails a crafted message that silently triggers Microsoft 365 Copilot to execute hidden instructions, exfiltrating confidential email, files and chat logs with no user interaction at all.",
    brokenBy: [1, 6, 4, 7],
  },
  {
    title: "Operator prompt injection via web content",
    description:
      "Malicious content planted on a web page the agent processes tricks it into following unauthorised instructions, then reaching authenticated internal pages and exposing private data.",
    brokenBy: [1, 6, 2, 4],
  },
  {
    title: "Goal-lock drift via scheduled prompts",
    description:
      "A malicious calendar invite injects a recurring instruction that subtly reweights the agent's objectives each morning, steering it toward low-friction approvals while every action stays inside declared policy.",
    brokenBy: [6, 7, 4, 3],
  },
  {
    title: "Inception attack via a shared document",
    description:
      "A malicious document injects instructions for the assistant to exfiltrate user data and to talk the user into an ill-advised business decision.",
    brokenBy: [1, 6, 2, 9],
  },
];

/** Risks with their mitigation detail transcribed. Grows one risk at a time. */
export const RISK_DETAIL: Partial<Record<AsiId, RiskDetail>> = {
  ASI01: { id: "ASI01", scenarios: ASI01_SCENARIOS, controls: ASI01_CONTROLS },
};

/** Detail for a risk, or undefined when it has not been transcribed yet. */
export function riskDetail(id: AsiId): RiskDetail | undefined {
  return RISK_DETAIL[id];
}

/**
 * How many controls and scenarios each risk publishes, taken from the standard.
 * Used to show what is left to transcribe.
 */
export const RISK_COVERAGE: ReadonlyArray<{
  id: AsiId;
  controls: number;
  scenarios: number;
}> = [
  { id: "ASI01", controls: 9, scenarios: 4 },
  { id: "ASI02", controls: 8, scenarios: 7 },
  { id: "ASI03", controls: 9, scenarios: 7 },
  { id: "ASI04", controls: 9, scenarios: 6 },
  { id: "ASI05", controls: 7, scenarios: 8 },
  { id: "ASI06", controls: 9, scenarios: 6 },
  { id: "ASI07", controls: 9, scenarios: 7 },
  { id: "ASI08", controls: 10, scenarios: 8 },
  { id: "ASI09", controls: 9, scenarios: 8 },
  { id: "ASI10", controls: 7, scenarios: 4 },
];
