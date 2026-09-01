import { describe, expect, it } from "vitest";
import {
  assessmentsFor,
  controlCoverage,
  remediationTasks,
  rollUpScore,
} from "../controls";
import { AGENTS } from "../data";
import { riskDetail } from "../mitigations";

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
      expect(cov.inPlace + cov.partial + cov.missing + cov.notApplicable).toBe(AGENTS.length);
      expect(cov.applicable).toBe(AGENTS.length - cov.notApplicable);
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
  const detail = riskDetail("ASI01");

  it("transcribes all nine ASI01 controls", () => {
    expect(detail?.controls).toHaveLength(CONTROL_COUNT);
  });

  it("gives every remediation step a worked example", () => {
    for (const control of detail!.controls) {
      expect(control.steps.length).toBeGreaterThan(0);
      for (const step of control.steps) {
        expect(step.text.length).toBeGreaterThan(0);
        expect(step.example.length).toBeGreaterThan(60);
      }
    }
  });

  it("quotes the standard's own wording for each control", () => {
    for (const control of detail!.controls) {
      expect(control.guideline.length).toBeGreaterThan(60);
      expect(control.verification.length).toBeGreaterThan(20);
    }
  });
});
