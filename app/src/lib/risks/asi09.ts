import type { AttackScenario, Control, RiskDetail } from "./types";

/**
 * ASI09 Human-Agent Trust Exploitation.
 * Source: OWASP Top 10 for Agentic Applications 2026, version 12.6.
 *
 * NOT YET TRANSCRIBED. The standard publishes 9 prevention and mitigation
 * guidelines and 8 example attack scenarios for this risk. Until they are
 * transcribed the product says so plainly rather than implying this risk's
 * score is control-derived.
 */

const SCENARIOS: readonly AttackScenario[] = [];

const CONTROLS: readonly Control[] = [];

/** What the standard publishes, used for the not-yet-transcribed notice. */
export const ASI09_PUBLISHED = { controls: 9, scenarios: 8 } as const;

export const ASI09: RiskDetail | undefined =
  CONTROLS.length > 0 ? { id: "ASI09", scenarios: SCENARIOS, controls: CONTROLS } : undefined;
