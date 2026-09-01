import type { AttackScenario, Control, RiskDetail } from "./types";

/**
 * ASI05 Unexpected Code Execution.
 * Source: OWASP Top 10 for Agentic Applications 2026, version 12.6.
 *
 * NOT YET TRANSCRIBED. The standard publishes 7 prevention and mitigation
 * guidelines and 8 example attack scenarios for this risk. Until they are
 * transcribed the product says so plainly rather than implying this risk's
 * score is control-derived.
 */

const SCENARIOS: readonly AttackScenario[] = [];

const CONTROLS: readonly Control[] = [];

/** What the standard publishes, used for the not-yet-transcribed notice. */
export const ASI05_PUBLISHED = { controls: 7, scenarios: 8 } as const;

export const ASI05: RiskDetail | undefined =
  CONTROLS.length > 0 ? { id: "ASI05", scenarios: SCENARIOS, controls: CONTROLS } : undefined;
