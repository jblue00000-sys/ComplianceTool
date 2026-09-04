import { describe, expect, it } from "vitest";
import { AGENTS } from "../data";
import { ASI_IDS } from "../owasp";
import {
  band,
  coverageSummary,
  PARTIAL_THRESHOLD,
  PASS_THRESHOLD,
  riskStats,
  standingScore,
  weakestControls,
} from "../scoring";

describe("band", () => {
  it("splits on the published thresholds", () => {
    expect(band(PASS_THRESHOLD)).toBe("green");
    expect(band(PASS_THRESHOLD - 1)).toBe("amber");
    expect(band(PARTIAL_THRESHOLD)).toBe("amber");
    expect(band(PARTIAL_THRESHOLD - 1)).toBe("red");
  });

  it("handles the extremes", () => {
    expect(band(0)).toBe("red");
    expect(band(100)).toBe("green");
  });
});

describe("standingScore", () => {
  it("is the mean of the ten control scores, never an independent judgement", () => {
    for (const agent of AGENTS) {
      const expected = Math.round(
        ASI_IDS.reduce((sum, id) => sum + agent.posture[id], 0) / ASI_IDS.length,
      );
      expect(standingScore(agent)).toBe(expected);
    }
  });
});

describe("riskStats", () => {
  it("accounts for every agent exactly once", () => {
    for (const id of ASI_IDS) {
      const stats = riskStats(id, AGENTS);
      expect(stats.pass + stats.partial + stats.fail).toBe(AGENTS.length);
    }
  });

  it("measures compliance against the whole population", () => {
    const stats = riskStats("ASI01", AGENTS);
    expect(stats.compliantPct).toBe(Math.round((stats.pass / AGENTS.length) * 100));
  });

  it("returns zero rather than dividing by zero on an empty estate", () => {
    expect(riskStats("ASI01", []).compliantPct).toBe(0);
  });
});

describe("coverageSummary", () => {
  it("covers every agent against every risk", () => {
    const summary = coverageSummary(AGENTS);
    expect(summary.total).toBe(AGENTS.length * ASI_IDS.length);
    expect(summary.pass + summary.partial + summary.fail).toBe(summary.total);
  });
});

describe("weakestControls", () => {
  it("returns the lowest scores first", () => {
    const weakest = weakestControls(AGENTS[0], 3);
    expect(weakest).toHaveLength(3);
    expect(weakest[0][1]).toBeLessThanOrEqual(weakest[1][1]);
    expect(weakest[1][1]).toBeLessThanOrEqual(weakest[2][1]);
  });
});
