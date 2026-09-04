import type { AttackScenario, Control, RiskDetail } from "./types";

/**
 * ASI08 Cascading Failures.
 * Source: OWASP Top 10 for Agentic Applications 2026, version 12.6.
 *
 * NOT YET TRANSCRIBED. The standard publishes 10 prevention and mitigation
 * guidelines and 8 example attack scenarios for this risk. Until they are
 * transcribed the product says so plainly rather than implying this risk's
 * score is control-derived.
 */

const SCENARIOS: readonly AttackScenario[] = [];

const CONTROLS: readonly Control[] = [];

/** What the standard publishes, used for the not-yet-transcribed notice. */
export const ASI08_PUBLISHED = { controls: 10, scenarios: 8 } as const;

export const ASI08: RiskDetail | undefined =
  CONTROLS.length > 0 ? { id: "ASI08", scenarios: SCENARIOS, controls: CONTROLS } : undefined;
