import type { AsiId } from "./types";
import { ASI01 } from "./risks/asi01";
import { ASI02, ASI02_PUBLISHED } from "./risks/asi02";
import { ASI03, ASI03_PUBLISHED } from "./risks/asi03";
import { ASI04, ASI04_PUBLISHED } from "./risks/asi04";
import { ASI05, ASI05_PUBLISHED } from "./risks/asi05";
import { ASI06, ASI06_PUBLISHED } from "./risks/asi06";
import { ASI07, ASI07_PUBLISHED } from "./risks/asi07";
import { ASI08, ASI08_PUBLISHED } from "./risks/asi08";
import { ASI09, ASI09_PUBLISHED } from "./risks/asi09";
import { ASI10, ASI10_PUBLISHED } from "./risks/asi10";

export type {
  AttackScenario,
  Control,
  Effort,
  RiskDetail,
  Step,
} from "./risks/types";

/**
 * The transcribed mitigation detail, one module per risk.
 *
 * Each risk is imported unconditionally so adding one is a change to that
 * risk's own file, never to this index. A risk that has not been transcribed
 * yet resolves to undefined, and the product says so rather than implying its
 * score is control-derived.
 */
const REGISTRY = {
  ASI01,
  ASI02,
  ASI03,
  ASI04,
  ASI05,
  ASI06,
  ASI07,
  ASI08,
  ASI09,
  ASI10,
} as const;

/** Detail for a risk, or undefined when it has not been transcribed yet. */
export function riskDetail(id: AsiId) {
  return REGISTRY[id];
}

/** True when a risk's controls have been transcribed from the standard. */
export function isTranscribed(id: AsiId): boolean {
  return REGISTRY[id] !== undefined;
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
  { id: "ASI01", controls: ASI01.controls.length, scenarios: ASI01.scenarios.length },
  { id: "ASI02", ...ASI02_PUBLISHED },
  { id: "ASI03", ...ASI03_PUBLISHED },
  { id: "ASI04", ...ASI04_PUBLISHED },
  { id: "ASI05", ...ASI05_PUBLISHED },
  { id: "ASI06", ...ASI06_PUBLISHED },
  { id: "ASI07", ...ASI07_PUBLISHED },
  { id: "ASI08", ...ASI08_PUBLISHED },
  { id: "ASI09", ...ASI09_PUBLISHED },
  { id: "ASI10", ...ASI10_PUBLISHED },
];
