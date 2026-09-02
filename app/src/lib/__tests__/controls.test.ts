import { describe, expect, it } from "vitest";
import {
  assessmentsFor,
  controlCoverage,
  hasAssessments,
  remediationTasks,
  rollUpScore,
} from "../controls";
import { AGENTS } from "../data";
import {
  isTranscribed,
  PUBLISHED_COUNTS,
  RISK_COVERAGE,
  riskDetail,
} from "../mitigations";
import type { AsiId } from "../types";

const CONTROL_COUNT = 9;

describe("assessmentsFor", () => {
  it("returns one assessment per published control for every agent", () => {
    for (const agent of AGENTS) {
      expect(assessmentsFor(agent.id)).toHaveLength(CONTROL_COUNT);
    }
  });

  it("returns nothing for an unknown agent rather than throwing", () => {
    expect(assessmentsFor("no-such-agent")).toEqual([]);
  });

  it("carries evidence on every rating, so none is unchallengeable", () => {
    for (const agent of AGENTS) {
      for (const a of assessmentsFor(agent.id)) {
        expect(a.evidence.length).toBeGreaterThan(0);
      }
    }
  });

  it("requires a written justification wherever a control is waived", () => {
    for (const agent of AGENTS) {
      for (const a of assessmentsFor(agent.id)) {
        if (a.status === "not-applicable") {
          expect(a.justification).toBeTruthy();
          expect(a.justification?.length ?? 0).toBeGreaterThan(40);
        }
      }
    }
  });
});

describe("rollUpScore", () => {
  it("equals the stored ASI01 score, so the drill-down explains the headline", () => {
    for (const agent of AGENTS) {
      expect(rollUpScore(agent.id)).toBe(agent.posture.ASI01);
    }
  });

  it("excludes not-applicable controls instead of scoring them zero", () => {
    const waived = AGENTS.filter((a) =>
      assessmentsFor(a.id).some((c) => c.status === "not-applicable"),
    );
    expect(waived.length).toBeGreaterThan(0);
    for (const agent of waived) {
      const scored = assessmentsFor(agent.id).filter((c) => c.status !== "not-applicable");
      const naive =
        assessmentsFor(agent.id).reduce(
          (sum, c) =>
            sum + (c.status === "in-place" ? 100 : c.status === "partial" ? 55 : 0),
          0,
        ) / CONTROL_COUNT;
      // Counting a waived control as zero would drag the score below the truth.
      expect(rollUpScore(agent.id)).toBeGreaterThan(Math.round(naive) - 1);
      expect(scored.length).toBeLessThan(CONTROL_COUNT);
    }
  });
});

describe("controlCoverage", () => {
  it("accounts for every agent on every control", () => {
    const detail = riskDetail("ASI01");
    expect(detail).toBeDefined();
    for (const control of detail!.controls) {
      const cov = controlCoverage(control.n);
      expect(cov).not.toBeNull();
      expect(cov!.inPlace + cov!.partial + cov!.missing + cov!.notApplicable).toBe(AGENTS.length);
      expect(cov!.applicable).toBe(AGENTS.length - cov!.notApplicable);
    }
  });
});

describe("remediationTasks", () => {
  const tasks = remediationTasks();

  it("raises a task for every gap and none for a settled control", () => {
    const gaps = AGENTS.flatMap((a) =>
      assessmentsFor(a.id).filter((c) => c.status === "partial" || c.status === "missing"),
    );
    expect(tasks).toHaveLength(gaps.length);
  });

  it("never raises a task against a waived or satisfied control", () => {
    for (const task of tasks) {
      const cell = assessmentsFor(task.agentId).find((c) => c.controlN === task.controlN);
      expect(cell?.status === "partial" || cell?.status === "missing").toBe(true);
    }
  });

  it("gives every task a named person, a team and a date", () => {
    for (const task of tasks) {
      expect(task.assignee.length).toBeGreaterThan(0);
      expect(task.team.length).toBeGreaterThan(0);
      expect(task.due).toMatch(/\d{4}$/);
    }
  });

  it("uses ids that are unique, so nothing collides in a list", () => {
    expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length);
  });
});

describe("published mitigation content", () => {
  const transcribed = RISK_COVERAGE.map((r) => r.id).filter(isTranscribed);

  it("has transcribed more than the template risk", () => {
    expect(transcribed).toContain("ASI01");
    expect(transcribed.length).toBeGreaterThan(1);
  });

  it("transcribes all nine ASI01 controls", () => {
    expect(riskDetail("ASI01")?.controls).toHaveLength(CONTROL_COUNT);
  });

  it.each(transcribed)("%s gives every remediation step a worked example", (id) => {
    for (const control of riskDetail(id)!.controls) {
      expect(control.steps.length).toBeGreaterThan(0);
      for (const step of control.steps) {
        expect(step.text.length).toBeGreaterThan(0);
        expect(step.example.length).toBeGreaterThan(60);
      }
    }
  });

  it.each(transcribed)("%s quotes the standard's own wording for each control", (id) => {
    for (const control of riskDetail(id)!.controls) {
      expect(control.guideline.length).toBeGreaterThan(60);
      expect(control.verification.length).toBeGreaterThan(20);
    }
  });

  it.each(transcribed)("%s numbers its controls 1..n in published order", (id) => {
    const ns = riskDetail(id)!.controls.map((c) => c.n);
    expect(ns).toEqual(ns.map((_, i) => i + 1));
  });

  it.each(transcribed)("%s only cites controls of its own risk in brokenBy", (id) => {
    const detail = riskDetail(id)!;
    const known = new Set(detail.controls.map((c) => c.n));
    expect(detail.scenarios.length).toBeGreaterThan(0);
    for (const scenario of detail.scenarios) {
      expect(scenario.brokenBy.length).toBeGreaterThan(0);
      for (const n of scenario.brokenBy) {
        expect(known.has(n)).toBe(true);
      }
    }
  });

  it.each(transcribed)("%s carries exactly what the standard publishes", (id) => {
    const published = PUBLISHED_COUNTS[id];
    if (!published) return;
    const detail = riskDetail(id)!;
    expect(detail.controls).toHaveLength(published.controls);
    expect(detail.scenarios).toHaveLength(published.scenarios);
  });

  it.each(transcribed)("%s reports its real counts in the coverage table", (id) => {
    const row = RISK_COVERAGE.find((r) => r.id === id)!;
    const detail = riskDetail(id)!;
    expect(row.controls).toBe(detail.controls.length);
    expect(row.scenarios).toBe(detail.scenarios.length);
  });
});

describe("risks with no assessment matrix", () => {
  // ASI02 has a transcribed control catalogue but nobody has assessed the
  // agents against it. Reusing ASI01's cells here would put a rating and an
  // evidence line against a control nobody has looked at.
  const UNASSESSED: AsiId = "ASI02";

  it("has controls transcribed, so this is about the matrix and not the catalogue", () => {
    expect(riskDetail(UNASSESSED)?.controls.length).toBeGreaterThan(0);
    expect(hasAssessments(UNASSESSED)).toBe(false);
  });

  it("yields no assessments for any agent", () => {
    for (const agent of AGENTS) {
      expect(assessmentsFor(agent.id, UNASSESSED)).toEqual([]);
    }
  });

  it("never borrows another risk's evidence", () => {
    const asi01 = new Set(assessmentsFor(AGENTS[0].id, "ASI01").map((a) => a.evidence));
    expect(asi01.size).toBeGreaterThan(0);
    for (const agent of AGENTS) {
      for (const a of assessmentsFor(agent.id, UNASSESSED)) {
        expect(asi01.has(a.evidence)).toBe(false);
      }
    }
  });

  it("rolls up to no score rather than to zero", () => {
    for (const agent of AGENTS) {
      expect(rollUpScore(agent.id, UNASSESSED)).toBeNull();
    }
  });

  it("reports no coverage rather than nobody having the control", () => {
    for (const control of riskDetail(UNASSESSED)!.controls) {
      expect(controlCoverage(control.n, UNASSESSED)).toBeNull();
    }
  });

  it("raises no remediation tasks against an unassessed risk", () => {
    expect(remediationTasks(UNASSESSED)).toEqual([]);
  });
});
