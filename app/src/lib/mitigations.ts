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
 * What the standard publishes for each risk, from the stubs. Used for the
 * risks that have not been transcribed yet, and asserted against the arrays
 * for the ones that have.
 */
export const PUBLISHED_COUNTS: Readonly<
  Partial<Record<AsiId, { controls: number; scenarios: number }>>
> = {
  ASI02: ASI02_PUBLISHED,
  ASI03: ASI03_PUBLISHED,
  ASI04: ASI04_PUBLISHED,
  ASI05: ASI05_PUBLISHED,
  ASI06: ASI06_PUBLISHED,
  ASI07: ASI07_PUBLISHED,
  ASI08: ASI08_PUBLISHED,
  ASI09: ASI09_PUBLISHED,
  ASI10: ASI10_PUBLISHED,
};

/**
 * How many controls and scenarios each risk publishes. A transcribed risk
 * reports what it actually carries, so the coverage table can never disagree
 * with the detail surfaces; the rest fall back to the published count.
 */
export const RISK_COVERAGE: ReadonlyArray<{
  id: AsiId;
  controls: number;
  scenarios: number;
}> = (Object.keys(REGISTRY) as AsiId[]).map((id) => {
  const detail = REGISTRY[id];
  if (detail) {
    return { id, controls: detail.controls.length, scenarios: detail.scenarios.length };
  }
  return { id, ...PUBLISHED_COUNTS[id]! };
});
