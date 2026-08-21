"use client";

import { useMemo, useState } from "react";
import { AGENTS, agentById } from "@/lib/data";
import {
  assessmentsFor,
  controlCoverage,
  remediationTasks,
  rollUpScore,
  STATUS_BAND,
  STATUS_LABEL,
  type ControlStatus,
} from "@/lib/controls";
import { riskDetail, RISK_COVERAGE } from "@/lib/mitigations";
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

/* ------------------------------------------------------------- summary ---- */

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
    <Panel className="mb-4 grid items-center gap-3.5 p-4.5 md:grid-cols-[auto_repeat(4,minmax(0,1fr))]">
      <Gauge value={totals.pct} size={100} suffix="CONTROLS" />
      {stats.map((s) => (
        <div key={s.k} className="min-w-0">
          <div className="font-mono text-[10px] font-bold tracking-[0.13em] text-(--color-dim) uppercase">
            {s.k}
          </div>
          <div className="mt-1 text-[26px] font-extrabold" style={{ color: s.c }}>
            {s.v}
          </div>
          <div className="text-[11.5px] text-(--color-dim)">{s.s}</div>
        </div>
      ))}
    </Panel>
  );
}

/* ------------------------------------------------------------ scenarios ---- */

function Scenarios() {
  const detail = riskDetail("ASI01");
  if (!detail) return null;
  return (
    <div className="mb-8 grid gap-3.5 lg:grid-cols-2">
      {detail.scenarios.map((s, i) => (
        <div
          key={s.title}
          className="rounded-xl border border-(--color-line) border-l-[3px] border-l-(--color-bad) bg-(--color-panel) p-4"
        >
          <div className="font-mono text-[10.5px] font-bold tracking-[0.12em] text-(--color-bad) uppercase">
            Scenario {i + 1}
          </div>
          <h4 className="mt-2 mb-1.5 text-[15px] font-bold">{s.title}</h4>
          <p className="m-0 text-[13.3px] text-(--color-mute)">{s.description}</p>
          <div className="mt-3 border-t border-dashed border-(--color-line-2) pt-2.5 font-mono text-[10.5px] text-(--color-dim)">
            <b className="text-(--color-mute)">Broken by:</b>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {s.brokenBy.map((n) => {
                const c = detail.controls.find((x) => x.n === n);
                return (
                  <span
                    key={n}
                    className="rounded bg-[rgba(91,157,255,0.14)] px-1.5 py-1 font-bold text-[#9fc4ff]"
                  >
                    {n}. {c?.short ?? ""}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------- control list ---- */

function ControlList() {
  const detail = riskDetail("ASI01");
  const [open, setOpen] = useState<number | null>(null);
  if (!detail) return null;

  return (
    <div className="mb-8">
      {detail.controls.map((c) => {
        const cov = controlCoverage(c.n);
        const isOpen = open === c.n;
        const total = AGENTS.length || 1;
        return (
          <div
            key={c.n}
            className="mb-2.5 overflow-hidden rounded-xl border border-(--color-line) bg-(--color-panel)"
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : c.n)}
              aria-expanded={isOpen}
              className="grid w-full grid-cols-[38px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2.5 px-4 py-3.5 text-left transition hover:bg-(--color-panel-2) lg:grid-cols-[38px_minmax(0,1fr)_180px_74px]"
            >
              <ControlNumber n={c.n} />
              <span className="min-w-0">
                <span className="block text-[14.5px] font-bold">{c.name}</span>
                <span className="mt-0.5 block text-[12.5px] text-(--color-dim)">
                  {c.description}
                </span>
              </span>
              <span className="col-span-2 min-w-0 lg:col-span-1">
                <span className="flex h-2.5 overflow-hidden rounded-full bg-[#1b2436]">
                  <span style={{ width: `${(cov.inPlace / total) * 100}%`, background: BAND_COLOR.green }} />
                  <span style={{ width: `${(cov.partial / total) * 100}%`, background: BAND_COLOR.amber }} />
                  <span style={{ width: `${(cov.missing / total) * 100}%`, background: BAND_COLOR.red }} />
                  <span style={{ width: `${(cov.notApplicable / total) * 100}%`, background: NEUTRAL }} />
                </span>
                <span className="mt-1.5 flex flex-wrap gap-2.5 font-mono text-[10.5px] text-(--color-dim)">
                  <span style={{ color: "#5fdcaa" }}>{cov.inPlace} in place</span>
                  <span style={{ color: "#f5c860" }}>{cov.partial} partial</span>
                  <span style={{ color: "#ff8b93" }}>{cov.missing} missing</span>
                  {cov.notApplicable > 0 ? <span>{cov.notApplicable} n/a</span> : null}
                </span>
              </span>
              <span
                className="col-span-2 text-[19px] font-extrabold lg:col-span-1 lg:text-right"
                style={{ color: BAND_COLOR[band(cov.compliantPct)] }}
              >
                {cov.compliantPct}%
              </span>
            </button>

            {isOpen ? (
              <div className="border-t border-(--color-line) bg-[#0c1220] p-4">
                <p className="mb-4 border-l-2 border-(--color-accent-2) pl-3.5 text-[13.4px] text-(--color-mute) italic">
                  &ldquo;{c.guideline}&rdquo;
                </p>
                <div className="grid gap-3.5 lg:grid-cols-3">
                  <div className="rounded-[10px] border border-(--color-line) bg-(--color-panel) p-3.5">
                    <div className="mb-2 font-mono text-[10px] font-bold tracking-[0.13em] text-(--color-dim) uppercase">
                      How to close it
                    </div>
                    <ol className="m-0 list-decimal pl-4 text-[12.9px] text-(--color-mute)">
                      {c.steps.map((s) => (
                        <li key={s} className="mb-1.5">{s}</li>
                      ))}
                    </ol>
                  </div>
                  <div className="rounded-[10px] border border-(--color-line) bg-(--color-panel) p-3.5">
                    <div className="mb-2 font-mono text-[10px] font-bold tracking-[0.13em] text-(--color-dim) uppercase">
                      Effort &amp; owner
                    </div>
                    <p className="m-0 text-[12.9px] text-(--color-mute)">
                      <strong className="text-(--color-ink)">{c.effort}</strong> of work.
                      <br />
                      Sits with <strong className="text-(--color-ink)">{c.team}</strong>.
                    </p>
                  </div>
                  <div className="rounded-[10px] border border-(--color-line) bg-(--color-panel) p-3.5">
                    <div className="mb-2 font-mono text-[10px] font-bold tracking-[0.13em] text-(--color-dim) uppercase">
                      How you prove it
                    </div>
                    <p className="m-0 text-[12.9px] text-(--color-mute)">{c.verification}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ drill down ---- */

function DrillRow({
  left,
  title,
  evidence,
  status,
  meta,
  metaSub,
  right,
  rightSub,
  onClick,
}: {
  left: React.ReactNode;
  title: string;
  evidence: string;
  status: ControlStatus;
  meta: string;
  metaSub: string;
  right: string;
  rightSub: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className="grid w-full grid-cols-[38px_minmax(0,1fr)_112px] items-center gap-3.5 border-b border-(--color-line) px-3.5 py-3 text-left last:border-b-0 hover:bg-(--color-panel-2) lg:grid-cols-[38px_minmax(0,1fr)_112px_150px_104px]"
    >
      {left}
      <span className="min-w-0">
        <span className="block text-[13.3px] font-semibold">{title}</span>
        <span className="mt-0.5 block text-[12.2px] text-(--color-dim)">{evidence}</span>
      </span>
      <span><StatusPill status={status} /></span>
      <span className="hidden text-[12px] text-(--color-mute) lg:block">
        {meta}
        <span className="mt-0.5 block font-mono text-[10.5px] text-(--color-dim)">{metaSub}</span>
      </span>
      <span className="hidden text-right text-[12px] text-(--color-mute) lg:block">
        {right}
        <span className="mt-0.5 block font-mono text-[10.5px] text-(--color-dim)">{rightSub}</span>
      </span>
    </Tag>
  );
}

function DrillDown() {
  const { openAgent, riskAgentId, setRiskAgent } = useShell();
  const detail = riskDetail("ASI01");
  const [view, setView] = useState<"agent" | "control">("agent");
  // The agent is shell state so arriving from the Flight Deck or OWASP Live
  // lands on the right one rather than resetting to the first in the list.
  const agentId = riskAgentId ?? AGENTS[0].id;
  const [controlN, setControlN] = useState(1);
  if (!detail) return null;

  const selectClass =
    "min-w-[250px] rounded-[9px] border border-(--color-line) bg-(--color-panel) px-3.5 py-2 text-[13.5px] text-(--color-ink) outline-none focus:border-(--color-accent)";

  return (
    <div className="mb-8">
      <div className="mb-4 flex flex-wrap gap-2">
        {(["agent", "control"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${
              view === v
                ? "border-(--color-accent) bg-(--color-accent) text-[#06101d]"
                : "border-(--color-line) bg-(--color-panel) text-(--color-mute) hover:border-(--color-accent) hover:text-(--color-ink)"
            }`}
          >
            {v === "agent" ? "By agent" : "By control"}
          </button>
        ))}
        {view === "agent" ? (
          <select
            value={agentId}
            onChange={(e) => setRiskAgent(e.target.value)}
            aria-label="Choose an agent"
            className={selectClass}
          >
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>{a.name} · {a.department}</option>
            ))}
          </select>
        ) : (
          <select
            value={controlN}
            onChange={(e) => setControlN(Number(e.target.value))}
            aria-label="Choose a control"
            className={selectClass}
          >
            {detail.controls.map((c) => (
              <option key={c.n} value={c.n}>{c.n}. {c.short}</option>
            ))}
          </select>
        )}
      </div>

      <Panel className="overflow-hidden p-0">
        {view === "agent" ? <ByAgent agentId={agentId} /> : <ByControl controlN={controlN} onOpen={openAgent} />}
      </Panel>
    </div>
  );
}

function ByAgent({ agentId }: { agentId: string }) {
  const detail = riskDetail("ASI01");
  const agent = agentById(agentId);
  const score = rollUpScore(agentId);
  if (!detail || !agent || score === null) return null;
  const assessments = assessmentsFor(agentId);
  const applicable = assessments.filter((a) => a.status !== "not-applicable").length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3.5 border-b border-(--color-line) bg-[linear-gradient(160deg,#141d2e,#101724)] p-4">
        <Avatar name={agent.name} band={band(score)} />
        <div className="min-w-0">
          <div className="text-[17px] font-bold">{agent.name}</div>
          <div className="text-[12.3px] text-(--color-dim)">
            {agent.department} · manager {agent.owner}
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-3xl font-extrabold tracking-tight" style={{ color: BAND_COLOR[band(score)] }}>
            {score}
          </div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-(--color-dim) uppercase">
            ASI01 · from {applicable} controls
          </div>
        </div>
      </div>
      {assessments.map((a) => {
        const c = detail.controls.find((x) => x.n === a.controlN);
        if (!c) return null;
        const settled = a.status === "in-place" || a.status === "not-applicable";
        return (
          <DrillRow
            key={a.controlN}
            left={<ControlNumber n={a.controlN} />}
            title={c.short}
            evidence={a.evidence}
            status={a.status}
            meta={settled ? "—" : c.team}
            metaSub={settled ? "nothing outstanding" : `${c.effort.toLowerCase()} of work`}
            right={a.lastChecked}
            rightSub="last checked"
          />
        );
      })}
    </>
  );
}

function ByControl({ controlN, onOpen }: { controlN: number; onOpen: (id: string) => void }) {
  const detail = riskDetail("ASI01");
  const control = detail?.controls.find((c) => c.n === controlN);
  const cov = controlCoverage(controlN);
  if (!detail || !control) return null;

  const rank: Record<ControlStatus, number> = {
    missing: 0, partial: 1, "in-place": 2, "not-applicable": 3,
  };
  const rows = AGENTS.map((agent) => ({
    agent,
    assessment: assessmentsFor(agent.id).find((a) => a.controlN === controlN),
  }))
    .filter((r) => r.assessment !== undefined)
    .sort((a, b) => rank[a.assessment!.status] - rank[b.assessment!.status]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3.5 border-b border-(--color-line) bg-[linear-gradient(160deg,#141d2e,#101724)] p-4">
        <ControlNumber n={control.n} large />
        <div className="min-w-0">
          <div className="text-[17px] font-bold">{control.name}</div>
          <div className="text-[12.3px] text-(--color-dim)">
            {control.effort} of work each · {control.team} ·{" "}
            {cov.missing + cov.partial} agents need attention
          </div>
        </div>
        <div className="ml-auto text-right">
          <div
            className="text-3xl font-extrabold tracking-tight"
            style={{ color: BAND_COLOR[band(cov.compliantPct)] }}
          >
            {cov.compliantPct}%
          </div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-(--color-dim) uppercase">
            of {cov.applicable} applicable agents
          </div>
        </div>
      </div>
      {rows.map(({ agent, assessment }) => (
        <DrillRow
          key={agent.id}
          left={
            <span
              className="grid size-7.5 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold text-[#06101d]"
              style={{
                background: `linear-gradient(140deg, ${statusColour(assessment!.status)}, var(--color-accent))`,
              }}
            >
              {initials(agent.name)}
            </span>
          }
          title={agent.name}
          evidence={assessment!.evidence}
          status={assessment!.status}
          meta={agent.owner}
          metaSub={agent.department}
          right={assessment!.lastChecked}
          rightSub="last checked"
          onClick={() => onOpen(agent.id)}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------ coverage ----- */

function Replication() {
  const done = new Set(["ASI01"]);
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
            const built = done.has(r.id);
            return (
              <tr key={r.id} className={built ? "bg-[rgba(91,157,255,0.07)]" : undefined}>
                <td className="border-b border-(--color-line) px-3.5 py-2.5">
                  <b className="font-mono text-(--color-accent)">{r.id}</b> {asiRisk(r.id).name}
                </td>
                <td className="border-b border-(--color-line) px-3.5 py-2.5">{r.controls}</td>
                <td className="border-b border-(--color-line) px-3.5 py-2.5">{r.scenarios}</td>
                <td
                  className="border-b border-(--color-line) px-3.5 py-2.5"
                  style={{ color: built ? BAND_COLOR.green : NEUTRAL }}
                >
                  {built ? "Built — you are looking at it" : "Same structure, content to transcribe"}
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

/* ---------------------------------------------------------------- page ----- */

export function Asi01Detail() {
  const { setTab } = useShell();
  const openTasks = useMemo(() => remediationTasks().length, []);

  return (
    <div>
      <PageHeading kicker="Risk detail · ASI01" title="Agent Goal Hijack">
        The nine controls the standard actually asks for, whether each one is in place for a
        given agent, and precisely what to do about the ones that are not. Every ASI01 score in
        this product is the roll-up of these nine — so it can be opened up and challenged.
      </PageHeading>

      <div className="mb-6 flex flex-wrap items-center gap-2.5">
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

      <EstateSummary />

      <h3 className="mt-8 mb-1 text-lg font-bold">What we are defending against</h3>
      <p className="mb-4 max-w-[840px] text-sm text-(--color-mute)">
        The four attack scenarios the standard publishes, each showing which controls break that
        attack chain.
      </p>
      <Scenarios />

      <h3 className="mb-1 text-lg font-bold">The nine controls</h3>
      <p className="mb-4 max-w-[840px] text-sm text-(--color-mute)">
        Click any control for the standard&rsquo;s own wording, the steps that close it, the
        effort and owner, and how you would prove it afterwards.
      </p>
      <ControlList />

      <h3 className="mb-1 text-lg font-bold">Drill down</h3>
      <p className="mb-4 max-w-[840px] text-sm text-(--color-mute)">
        A compliance manager asks who is failing a control. The person who has to fix it asks
        what their agent needs. Both answers come from the same data.
      </p>
      <DrillDown />

      <h3 className="mb-1 text-lg font-bold">The same component covers all ten</h3>
      <p className="mb-4 max-w-[840px] text-sm text-(--color-mute)">
        Every risk in the standard has the identical structure, so extending this is transcription
        rather than engineering.
      </p>
      <Replication />
    </div>
  );
}
