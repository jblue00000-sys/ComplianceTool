import type { AttackScenario, Control, RiskDetail } from "./types";

/**
 * ASI10 Rogue Agents.
 * Source: OWASP Top 10 for Agentic Applications 2026, version 12.6.
 *
 * NOT YET TRANSCRIBED. The standard publishes 7 prevention and mitigation
 * guidelines and 4 example attack scenarios for this risk. Until they are
 * transcribed the product says so plainly rather than implying this risk's
 * score is control-derived.
 */

const SCENARIOS: readonly AttackScenario[] = [];

const CONTROLS: readonly Control[] = [];

/** What the standard publishes, used for the not-yet-transcribed notice. */
export const ASI10_PUBLISHED = { controls: 7, scenarios: 4 } as const;

export const ASI10: RiskDetail | undefined =
  CONTROLS.length > 0 ? { id: "ASI10", scenarios: SCENARIOS, controls: CONTROLS } : undefined;
