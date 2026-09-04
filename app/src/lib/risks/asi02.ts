import type { AttackScenario, Control, RiskDetail } from "./types";

/**
 * ASI02 Tool Misuse and Exploitation.
 * Source: OWASP Top 10 for Agentic Applications 2026, version 12.6.
 *
 * NOT YET TRANSCRIBED. The standard publishes 8 prevention and mitigation
 * guidelines and 7 example attack scenarios for this risk. Until they are
 * transcribed the product says so plainly rather than implying this risk's
 * score is control-derived.
 */

const SCENARIOS: readonly AttackScenario[] = [];

const CONTROLS: readonly Control[] = [];

/** What the standard publishes, used for the not-yet-transcribed notice. */
export const ASI02_PUBLISHED = { controls: 8, scenarios: 7 } as const;

export const ASI02: RiskDetail | undefined =
  CONTROLS.length > 0 ? { id: "ASI02", scenarios: SCENARIOS, controls: CONTROLS } : undefined;
