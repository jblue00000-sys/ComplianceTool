import { ASI_IDS } from "./owasp";
import type { Agent, AsiId, Band, Score } from "./types";

/**
 * One set of thresholds is used everywhere in the product so a score means the
 * same thing on every screen.
 */
export const PASS_THRESHOLD = 70;
export const PARTIAL_THRESHOLD = 50;

/** Band a raw 0-100 score. */
export function band(score: Score): Band {
  if (score >= PASS_THRESHOLD) return "green";
  if (score >= PARTIAL_THRESHOLD) return "amber";
  return "red";
}

/**
 * An agent's standing is the mean of its ten OWASP control scores. It is
 * deliberately not an independent judgement: the ten scores are the evidence,
 * and standing is only their summary.
 */
export function standingScore(agent: Agent): Score {
  const total = ASI_IDS.reduce((sum, id) => sum + agent.posture[id], 0);
  return Math.round(total / ASI_IDS.length);
}

/** Band of an agent's overall standing. */
export function standingBand(agent: Agent): Band {
  return band(standingScore(agent));
}

/** Business-language label for a standing band. */
export const STANDING_LABEL: Record<Band, string> = {
  green: "In good standing",
  amber: "Review access",
  red: "Needs supervision",
};

/** Verdict label for a single control check. */
export const VERDICT_LABEL: Record<Band, string> = {
  green: "Pass",
  amber: "Partial",
  red: "Fail",
};

/** True when the agent can take an action that cannot be undone. */
export function hasIrreversibleReach(agent: Agent): boolean {
  return (
    agent.access.some((a) => a.mode === "irreversible") ||
    agent.tools.some((t) => t.mode === "irreversible")
  );
}

/** True when no human sees the action before it happens. */
export function actsUnsupervised(agent: Agent): boolean {
  return agent.autonomy === "none";
}

/** True when the agent's access has no end date. */
export function neverExpires(agent: Agent): boolean {
  return agent.accessExpires === null;
}

/**
 * How far an agent reaches, used to place it on the estate map.
 * 1 reads only, 2 makes changes, 3 cannot be undone.
 */
export function reachTier(agent: Agent): 1 | 2 | 3 {
  if (hasIrreversibleReach(agent)) return 3;
  if (agent.canMoveMoney || agent.authority > 55) return 2;
  return 1;
}

/** Compliance summary for one risk across a population of agents. */
export interface RiskStats {
  id: AsiId;
  pass: number;
  partial: number;
  fail: number;
  /** Percentage of agents with the control fully in place. */
  compliantPct: number;
}

/** Roll one risk up across every supplied agent. */
export function riskStats(id: AsiId, agents: readonly Agent[]): RiskStats {
  let pass = 0;
  let partial = 0;
  let fail = 0;
  for (const agent of agents) {
    const verdict = band(agent.posture[id]);
    if (verdict === "green") pass += 1;
    else if (verdict === "amber") partial += 1;
    else fail += 1;
  }
  const compliantPct = agents.length === 0 ? 0 : Math.round((pass / agents.length) * 100);
  return { id, pass, partial, fail, compliantPct };
}

/** Estate-wide totals across every agent-by-risk check. */
export interface CoverageSummary {
  pass: number;
  partial: number;
  fail: number;
  total: number;
  compliantPct: number;
}

/** Roll every risk up across every agent. */
export function coverageSummary(agents: readonly Agent[]): CoverageSummary {
  let pass = 0;
  let partial = 0;
  let fail = 0;
  for (const agent of agents) {
    for (const id of ASI_IDS) {
      const verdict = band(agent.posture[id]);
      if (verdict === "green") pass += 1;
      else if (verdict === "amber") partial += 1;
      else fail += 1;
    }
  }
  const total = pass + partial + fail;
  const compliantPct = total === 0 ? 0 : Math.round((pass / total) * 100);
  return { pass, partial, fail, total, compliantPct };
}

/** The agent's weakest controls, worst first. */
export function weakestControls(agent: Agent, count: number): Array<[AsiId, Score]> {
  return ASI_IDS.map((id): [AsiId, Score] => [id, agent.posture[id]])
    .sort((a, b) => a[1] - b[1])
    .slice(0, count);
}
