"use client";

import { useMemo, useState } from "react";
import { AGENTS, agentById } from "@/lib/data";
import {
  assessmentsFor,
  controlCoverage,
  hasAssessments,
  remediationTasks,
  rollUpScore,
  STATUS_BAND,
  STATUS_LABEL,
  type ControlAssessment,
  type ControlStatus,
} from "@/lib/controls";
import { isTranscribed, riskDetail, RISK_COVERAGE, type Step } from "@/lib/mitigations";
import { asiRisk } from "@/lib/owasp";
import { band } from "@/lib/scoring";
import { useShell } from "./AppShell";
import { Avatar, BAND_COLOR, Gauge, initials, PageHeading, Panel } from "./ui";

const NEUTRAL = "var(--color-dim)";

function statusColour(status: ControlStatus): string {
  const b = STATUS_BAND[status];
  return b === "neutral" ? NEUTRAL : BAND_COLOR[b];
}

const STATUS_TONE: Record<ControlStatus, string> = {
  "in-place": "bg-[rgba(47,191,135,0.16)] text-[#5fdcaa]",
  partial: "bg-[rgba(240,180,41,0.16)] text-[#f5c860]",
  missing: "bg-[rgba(244,97,107,0.16)] text-[#ff8b93]",
  "not-applicable": "bg-[rgba(90,107,131,0.18)] text-[#9fb0c6]",
};

function StatusPill({ status }: { status: ControlStatus }) {
  return (
    <span
      className={`inline-block rounded-md px-2 py-1.5 text-center font-mono text-[10px] font-bold tracking-wide uppercase ${STATUS_TONE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function ControlNumber({ n, large = false }: { n: number; large?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-lg border border-(--color-line-2) bg-(--color-panel-3) font-mono font-extrabold text-(--color-accent) ${
        large ? "size-11 text-base" : "size-7.5 text-xs"
      }`}
    >
      {n}
    </span>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 font-mono text-[10px] font-bold tracking-[0.13em] text-(--color-dim) uppercase">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------- steps ---- */

/**
 * A step with its worked example behind a disclosure. Click rather than hover:
 * the examples run to several sentences and have to work on a touch screen.
 */
function StepItem({ step, index }: { step: Step; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="mb-2.5">
      <span className="text-(--color-mute)">{step.text}</span>{" "}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Example for step ${index + 1}`}
        title={step.example}
        className="ml-0.5 inline-grid size-4 shrink-0 translate-y-px place-items-center rounded-full border border-(--color-accent) text-[9px] font-extrabold text-(--color-accent) hover:bg-(--color-accent) hover:text-[#06101d]"
      >
        ?
      </button>
      {open ? (
        <span className="mt-2 block rounded-lg border border-dashed border-[#3a4a6b] bg-[rgba(127,107,255,0.07)] px-3 py-2.5 text-[12.5px] text-(--color-mute)">
          <b className="text-[#b3a5ff]">For example.</b> {step.example}
        </span>
      ) : null}
    </li>
  );
}

function FixGuidance({ controlN }: { controlN: number }) {
  const control = riskDetail("ASI01")?.controls.find((c) => c.n === controlN);
  if (!control) return null;
  return (
    <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="rounded-[10px] border border-(--color-line) bg-(--color-panel) p-3.5">
        <SubLabel>How to close it — click ? for a worked example</SubLabel>
        <ol className="m-0 list-decimal pl-4 text-[12.9px]">
          {control.steps.map((s, i) => (
            <StepItem key={s.text} step={s} index={i} />
          ))}
        </ol>
      </div>
      <div className="flex flex-col gap-3.5">
        <div className="rounded-[10px] border border-(--color-line) bg-(--color-panel) p-3.5">
          <SubLabel>Effort &amp; owner</SubLabel>
          <p className="m-0 text-[12.9px] text-(--color-mute)">
            <strong className="text-(--color-ink)">{control.effort}</strong> of work per agent.
            <br />
            Sits with <strong className="text-(--color-ink)">{control.team}</strong>.
          </p>
        </div>
        <div className="rounded-[10px] border border-(--color-line) bg-(--color-panel) p-3.5">
          <SubLabel>How you prove it</SubLabel>
          <p className="m-0 text-[12.9px] text-(--color-mute)">{control.verification}</p>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- summary ---- */

function AgentSummary({ agentId }: { agentId: string }) {
  const agent = agentById(agentId);
  const assessments = assessmentsFor(agentId);
  const score = rollUpScore(agentId);
  if (!agent || score === null) return null;

  const count = (s: ControlStatus) => assessments.filter((a) => a.status === s).length;
  const applicable = assessments.filter((a) => a.status !== "not-applicable").length;

  const stats: ReadonlyArray<{ k: string; v: number; c: string; s: string }> = [
    { k: "In place", v: count("in-place"), c: BAND_COLOR.green, s: `of this agent's ${applicable} applicable controls` },
    { k: "Partial", v: count("partial"), c: BAND_COLOR.amber, s: "started, not finished" },
    { k: "Missing", v: count("missing"), c: BAND_COLOR.red, s: "no control at all" },
    { k: "Not applicable", v: count("not-applicable"), c: NEUTRAL, s: "excluded, with a written reason" },
  ];

  return (
    <Panel className="mb-4 p-4.5">
      <div className="mb-4 flex flex-wrap items-center gap-3.5 border-b border-(--color-line) pb-4">
        <Avatar name={agent.name} band={band(score)} />
        <div className="min-w-0">
          <div className="text-[17px] font-bold">{agent.name}</div>
          <div className="text-[12.3px] text-(--color-dim)">
            {agent.department} · manager {agent.owner}
          </div>
        </div>
      </div>
      <div className="grid items-center gap-3.5 md:grid-cols-[auto_repeat(4,minmax(0,1fr))]">
        <Gauge value={score} size={100} suffix="ASI01" />
        {stats.map((s) => (
          <div key={s.k} className="min-w-0">
            <div className="font-mono text-[10px] font-bold tracking-[0.13em] text-(--color-dim) uppercase">
              {s.k}
            </div>
            <div className="mt-1 text-[26px] font-extrabold" style={{ color: s.c }}>{s.v}</div>
            <div className="text-[11.5px] text-(--color-dim)">{s.s}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-(--color-line) pt-3 text-[12.8px] text-(--color-dim)">
        This agent&rsquo;s ASI01 score of <b className="text-(--color-ink)">{score}</b> is the
        average of the {applicable} applicable controls below — in place counts full, partial
        counts half, missing counts nothing.
      </p>
    </Panel>
  );
}

function EstateSummary() {
  const totals = useMemo(() => {
    let inPlace = 0, partial = 0, missing = 0, notApplicable = 0;
    for (const agent of AGENTS) {
      for (const a of assessmentsFor(agent.id)) {
        if (a.status === "in-place") inPlace += 1;
        else if (a.status === "partial") partial += 1;
        else if (a.status === "missing") missing += 1;
        else notApplicable += 1;
      }
    }
    const applicable = inPlace + partial + missing;
    return {
      inPlace, partial, missing, notApplicable, applicable,
      pct: applicable === 0 ? 0 : Math.round((inPlace / applicable) * 100),
    };
  }, []);

  const stats: ReadonlyArray<{ k: string; v: number; c: string; s: string }> = [
    { k: "In place", v: totals.inPlace, c: BAND_COLOR.green, s: `of ${totals.applicable} applicable checks` },
    { k: "Partial", v: totals.partial, c: BAND_COLOR.amber, s: "started, not finished" },
    { k: "Missing", v: totals.missing, c: BAND_COLOR.red, s: "no control at all" },
    { k: "Not applicable", v: totals.notApplicable, c: NEUTRAL, s: "excluded, with a written reason" },
  ];

  return (
    <Panel className="mb-4 p-4.5">
      <p className="mb-3.5 border-b border-(--color-line) pb-3 text-[12.8px] text-(--color-dim)">
        Every agent against every control — <b className="text-(--color-ink)">{AGENTS.length} agents</b>{" "}
        × <b className="text-(--color-ink)">9 controls</b> ={" "}
        <b className="text-(--color-ink)">{AGENTS.length * 9} checks</b>.
      </p>
      <div className="grid items-center gap-3.5 md:grid-cols-[auto_repeat(4,minmax(0,1fr))]">
        <Gauge value={totals.pct} size={100} suffix="COMPLIANT" />
        {stats.map((s) => (
          <div key={s.k} className="min-w-0">
            <div className="font-mono text-[10px] font-bold tracking-[0.13em] text-(--color-dim) uppercase">
              {s.k}
            </div>
            <div className="mt-1 text-[26px] font-extrabold" style={{ color: s.c }}>{s.v}</div>
            <div className="text-[11.5px] text-(--color-dim)">{s.s}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------ control rows ---- */

function AgentControlRow({
  assessment,
  open,
  onToggle,
}: {
  assessment: ControlAssessment;
  open: boolean;
  onToggle: () => void;
}) {
  const control = riskDetail("ASI01")?.controls.find((c) => c.n === assessment.controlN);
  if (!control) return null;
  const settled = assessment.status === "in-place" || assessment.status === "not-applicable";

  return (
    <div className="mb-2.5 overflow-hidden rounded-xl border border-(--color-line) bg-(--color-panel)">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-[38px_minmax(0,1fr)_112px] items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-(--color-panel-2) lg:grid-cols-[38px_minmax(0,1fr)_112px_110px]"
      >
        <ControlNumber n={control.n} />
        <span className="min-w-0">
          <span className="block text-[14.5px] font-bold">{control.name}</span>
          <span
            className="mt-1 block text-[12.5px]"
            style={{ color: settled ? NEUTRAL : statusColour(assessment.status) }}
          >
            {assessment.evidence}
          </span>
        </span>
        <span><StatusPill status={assessment.status} /></span>
        <span className="hidden text-right text-[12px] text-(--color-mute) lg:block">
          {assessment.lastChecked}
          <span className="mt-0.5 block font-mono text-[10.5px] text-(--color-dim)">
            last checked
          </span>
        </span>
      </button>

      {open ? (
        <div className="border-t border-(--color-line) bg-[#0c1220] p-4">
          <p className="mb-4 border-l-2 border-(--color-accent-2) pl-3.5 text-[13.4px] text-(--color-mute) italic">
            &ldquo;{control.guideline}&rdquo;
          </p>
          {assessment.status === "not-applicable" ? (
            <div className="mb-4 rounded-[10px] border border-(--color-line) bg-(--color-panel) p-3.5">
              <SubLabel>Why this does not apply</SubLabel>
              <p className="m-0 text-[12.9px] text-(--color-mute)">{assessment.evidence}</p>
            </div>
          ) : null}
          {settled ? (
            <p className="m-0 text-[13px] text-(--color-dim)">
              Nothing outstanding on this control for this agent.
            </p>
          ) : (
            <FixGuidance controlN={control.n} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function EstateControlRow({
  controlN,
  open,
  onToggle,
}: {
  controlN: number;
  open: boolean;
  onToggle: () => void;
}) {
  const { openAgent, setRiskAgent } = useShell();
  const control = riskDetail("ASI01")?.controls.find((c) => c.n === controlN);
  const cov = controlCoverage(controlN);
  // This surface is ASI01, which is assessed, so coverage is always present.
  if (!control || !cov) return null;
  const total = AGENTS.length || 1;

  const rank: Record<ControlStatus, number> = {
    missing: 0, partial: 1, "in-place": 2, "not-applicable": 3,
  };
  const rows = AGENTS.map((agent) => ({
    agent,
    assessment: assessmentsFor(agent.id).find((a) => a.controlN === controlN),
  }))
    .filter((r): r is { agent: (typeof AGENTS)[number]; assessment: ControlAssessment } =>
      r.assessment !== undefined,
    )
    .sort((a, b) => rank[a.assessment.status] - rank[b.assessment.status]);

  return (
    <div className="mb-2.5 overflow-hidden rounded-xl border border-(--color-line) bg-(--color-panel)">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-[38px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2.5 px-4 py-3.5 text-left transition hover:bg-(--color-panel-2) lg:grid-cols-[38px_minmax(0,1fr)_190px_74px]"
      >
        <ControlNumber n={control.n} />
        <span className="min-w-0">
          <span className="block text-[14.5px] font-bold">{control.name}</span>
          <span className="mt-0.5 block text-[12.5px] text-(--color-dim)">
            {control.description}
          </span>
        </span>
        <span className="col-span-2 min-w-0 lg:col-span-1">
          <span className="flex h-2.5 overflow-hidden rounded-full bg-[#1b2436]">
            <span style={{ width: `${(cov.inPlace / total) * 100}%`, background: BAND_COLOR.green }} />
            <span style={{ width: `${(cov.partial / total) * 100}%`, background: BAND_COLOR.amber }} />
            <span style={{ width: `${(cov.missing / total) * 100}%`, background: BAND_COLOR.red }} />
            <span style={{ width: `${(cov.notApplicable / total) * 100}%`, background: NEUTRAL }} />
          </span>
          <span className="mt-1.5 block font-mono text-[10.5px] text-(--color-dim)">
            across {AGENTS.length} agents:{" "}
            <span style={{ color: "#5fdcaa" }}>{cov.inPlace} in place</span>,{" "}
            <span style={{ color: "#f5c860" }}>{cov.partial} partial</span>,{" "}
            <span style={{ color: "#ff8b93" }}>{cov.missing} missing</span>
            {cov.notApplicable > 0 ? `, ${cov.notApplicable} n/a` : ""}
          </span>
        </span>
        <span
          className="col-span-2 text-[19px] font-extrabold lg:col-span-1 lg:text-right"
          style={{ color: BAND_COLOR[band(cov.compliantPct)] }}
        >
          {cov.compliantPct}%
        </span>
      </button>

      {open ? (
        <div className="border-t border-(--color-line) bg-[#0c1220] p-4">
          <p className="mb-4 border-l-2 border-(--color-accent-2) pl-3.5 text-[13.4px] text-(--color-mute) italic">
            &ldquo;{control.guideline}&rdquo;
          </p>
          <FixGuidance controlN={control.n} />

          <SubLabel>
            <span className="mt-5 block">Where each agent stands</span>
          </SubLabel>
          <div className="overflow-hidden rounded-[10px] border border-(--color-line) bg-(--color-panel)">
            {rows.map(({ agent, assessment }) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  setRiskAgent(agent.id);
                  openAgent(agent.id);
                }}
                className="grid w-full grid-cols-[30px_minmax(0,1fr)_112px] items-center gap-3 border-b border-(--color-line) px-3 py-2.5 text-left last:border-b-0 hover:bg-(--color-panel-2)"
              >
                <span
                  className="grid size-7.5 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold text-[#06101d]"
                  style={{
                    background: `linear-gradient(140deg, ${statusColour(assessment.status)}, var(--color-accent))`,
                  }}
                >
                  {initials(agent.name)}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.3px] font-semibold">{agent.name}</span>
                  <span className="mt-0.5 block text-[12.2px] text-(--color-dim)">
                    {assessment.evidence}
                  </span>
                </span>
                <span><StatusPill status={assessment.status} /></span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------- coverage ----- */

function Replication() {
  const totals = RISK_COVERAGE.reduce(
    (acc, r) => ({ controls: acc.controls + r.controls, scenarios: acc.scenarios + r.scenarios }),
    { controls: 0, scenarios: 0 },
  );
  return (
    <Panel className="overflow-hidden">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr>
            {["Risk", "Controls", "Attack scenarios", "Status"].map((h) => (
              <th
                key={h}
                className="border-b border-(--color-line) bg-(--color-panel-2) px-3.5 py-3 text-left font-mono text-[10.5px] font-bold tracking-[0.1em] text-(--color-mute) uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RISK_COVERAGE.map((r) => {
            const transcribed = isTranscribed(r.id);
            const assessed = transcribed && hasAssessments(r.id);
            return (
              <tr key={r.id} className={transcribed ? "bg-[rgba(91,157,255,0.07)]" : undefined}>
                <td className="border-b border-(--color-line) px-3.5 py-2.5">
                  <b className="font-mono text-(--color-accent)">{r.id}</b> {asiRisk(r.id).name}
                </td>
                <td className="border-b border-(--color-line) px-3.5 py-2.5">{r.controls}</td>
                <td className="border-b border-(--color-line) px-3.5 py-2.5">{r.scenarios}</td>
                <td
                  className="border-b border-(--color-line) px-3.5 py-2.5"
                  style={{
                    color: assessed ? BAND_COLOR.green : transcribed ? BAND_COLOR.amber : NEUTRAL,
                  }}
                >
                  {assessed
                    ? "Built — you are looking at it"
                    : transcribed
                      ? "Transcribed — agents not yet assessed against it"
                      : "Same structure, content to transcribe"}
                </td>
              </tr>
            );
          })}
          <tr>
            <td className="px-3.5 py-2.5"><b>Total</b></td>
            <td className="px-3.5 py-2.5"><b>{totals.controls}</b></td>
            <td className="px-3.5 py-2.5"><b>{totals.scenarios}</b></td>
            <td />
          </tr>
        </tbody>
      </table>
    </Panel>
  );
}

/* ------------------------------------------------------------- page ----- */

export function Asi01Detail() {
  const { setTab, riskAgentId, setRiskAgent } = useShell();
  const detail = riskDetail("ASI01");
  const [scope, setScope] = useState<"agent" | "estate">(riskAgentId ? "agent" : "estate");
  const [openControl, setOpenControl] = useState<number | null>(null);
  const openTasks = useMemo(() => remediationTasks().length, []);

  const agentId = riskAgentId ?? AGENTS[0].id;
  const assessments = scope === "agent" ? assessmentsFor(agentId) : [];
  if (!detail) return null;

  const selectClass =
    "min-w-[250px] rounded-full border border-(--color-line) bg-(--color-panel) px-3.5 py-2 text-[13px] text-(--color-ink) outline-none focus:border-(--color-accent)";

  return (
    <div>
      <PageHeading kicker="Risk detail · ASI01" title="Agent Goal Hijack">
        The nine controls the standard asks for, whether each is in place, and exactly what
        closes the ones that are not. Every ASI01 score in this product is the roll-up of these
        nine, so it can be opened up and challenged.
      </PageHeading>

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => setTab("owasp")}
          className="rounded-lg border border-(--color-line-2) px-3 py-1.5 text-xs text-(--color-mute) hover:border-(--color-accent) hover:text-(--color-ink)"
        >
          ← Back to all ten risks
        </button>
        <button
          type="button"
          onClick={() => setTab("tasks")}
          className="rounded-lg bg-(--color-accent) px-3 py-1.5 text-xs font-bold text-[#06101d]"
        >
          {openTasks} open remediation tasks →
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["agent", "estate"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setScope(s); setOpenControl(null); }}
            aria-pressed={scope === s}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${
              scope === s
                ? "border-(--color-accent) bg-(--color-accent) text-[#06101d]"
                : "border-(--color-line) bg-(--color-panel) text-(--color-mute) hover:border-(--color-accent) hover:text-(--color-ink)"
            }`}
          >
            {s === "agent" ? "One agent" : "Whole estate"}
          </button>
        ))}
        {scope === "agent" ? (
          <select
            value={agentId}
            onChange={(e) => { setRiskAgent(e.target.value); setOpenControl(null); }}
            aria-label="Choose an agent"
            className={selectClass}
          >
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>{a.name} · {a.department}</option>
            ))}
          </select>
        ) : null}
      </div>

      {scope === "agent" ? <AgentSummary agentId={agentId} /> : <EstateSummary />}

      <h3 className="mt-8 mb-1 text-lg font-bold">The nine controls</h3>
      <p className="mb-4 max-w-[840px] text-sm text-(--color-mute)">
        {scope === "agent"
          ? "Each control's status for this agent, and what supports that rating. Open any control for the standard's own wording and the steps that close it."
          : "How the whole estate stands against each control. Open any control for the steps that close it and where every agent stands."}
      </p>

      <div className="mb-8">
        {scope === "agent"
          ? assessments.map((a) => (
              <AgentControlRow
                key={a.controlN}
                assessment={a}
                open={openControl === a.controlN}
                onToggle={() =>
                  setOpenControl((cur) => (cur === a.controlN ? null : a.controlN))
                }
              />
            ))
          : detail.controls.map((c) => (
              <EstateControlRow
                key={c.n}
                controlN={c.n}
                open={openControl === c.n}
                onToggle={() => setOpenControl((cur) => (cur === c.n ? null : c.n))}
              />
            ))}
      </div>

      <h3 className="mb-1 text-lg font-bold">The same component covers all ten</h3>
      <p className="mb-4 max-w-[840px] text-sm text-(--color-mute)">
        Every risk in the standard has the identical structure, so extending this is
        transcription rather than engineering.
      </p>
      <Replication />
    </div>
  );
}
