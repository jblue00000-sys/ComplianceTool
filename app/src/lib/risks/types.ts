import type { AsiId } from "../types";

/**
 * Shape shared by every risk's transcribed detail.
 *
 * Each risk lives in its own module so the nine still to be transcribed can be
 * worked on independently without editing one shared file.
 */

/** How much work closing a control typically is. Deliberately coarse. */
export type Effort = "Hours" | "Days" | "Weeks";

/**
 * One action that closes part of a control.
 *
 * The example is the difference between a checklist somebody nods at and one
 * they can actually act on, so it is required rather than optional.
 */
export interface Step {
  /** The action itself, in the imperative. */
  text: string;
  /** A concrete worked example, grounded in a real agent doing real work. */
  example: string;
}

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
  steps: readonly Step[];
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
