"use client";

import { useMemo, useState } from "react";
import { AGENTS, agentById } from "@/lib/data";
import { assessmentsFor, hasAssessments } from "@/lib/controls";
import { ASI_IDS, ASI_RISKS } from "@/lib/owasp";
import { riskDetail } from "@/lib/mitigations";
import {
  band,
  coverageSummary,
  PARTIAL_THRESHOLD,
  PASS_THRESHOLD,
  riskStats,
  standingBand,
  standingScore,
  VERDICT_LABEL,
} from "@/lib/scoring";
import type { AsiId, Band } from "@/lib/types";
import { useShell, type TabId } from "./AppShell";
import { Avatar, BAND_COLOR, Gauge, Meter, PageHeading, Panel } from "./ui";

const BADGE_TONE: Record<Band, string> = {
  green: "bg-[rgba(47,191,135,0.16)] text-[#5fdcaa]",
  amber: "bg-[rgba(240,180,41,0.16)] text-[#f5c860]",
  red: "bg-[rgba(244,97,107,0.16)] text-[#ff8b93]",
};

function Stat({
  label,
  value,
  colour,
  note,
}: {
  label: string;
  value: number;
  colour: string;
  note: string;
}) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[10px] font-bold tracking-[0.13em] text-(--color-dim) uppercase">
        {label}
      </div>
      <div className="mt-1 text-[26px] font-extrabold" style={{ color: colour }}>
        {value}
      </div>
      <div className="text-[11.8px] text-(--color-dim)">{note}</div>
    </div>
  );
}

function SummaryStrip() {
  const summary = useMemo(() => coverageSummary(AGENTS), []);
  return (
    <Panel className="mb-4 grid items-center gap-3.5 p-4.5 md:grid-cols-[auto_repeat(3,minmax(0,1fr))]">
      <Gauge value={summary.compliantPct} size={100} suffix="COMPLIANT" />
      <Stat
        label="Controls in place"
        value={summary.pass}
        colour={BAND_COLOR.green}
        note={`of ${summary.total} agent-by-risk checks`}
      />
      <Stat
        label="Partial"
        value={summary.partial}
        colour={BAND_COLOR.amber}
        note="control exists but is incomplete"
      />
      <Stat
        label="Missing"
        value={summary.fail}
        colour={BAND_COLOR.red}
        note="no effective control today"
      />
    </Panel>
  );
}

function RiskCard({
  id,
  open,
  onToggle,
}: {
  id: AsiId;
  open: boolean;
  onToggle: () => void;
}) {
  const { openAgent, setTab } = useShell();
  const detail = riskDetail(id);
  const risk = ASI_RISKS.find((r) => r.id === id);
  const stats = useMemo(() => riskStats(id, AGENTS), [id]);
  if (!risk) return null;

  const total = AGENTS.length || 1;
  const ranked = [...AGENTS].sort((a, b) => a.posture[id] - b.posture[id]);

  return (
    <div className="mb-2.5 overflow-hidden rounded-[13px] border border-(--color-line) bg-(--color-panel)">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-[56px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2.5 px-4 py-3.5 text-left transition hover:bg-(--color-panel-2) lg:grid-cols-[64px_minmax(0,1fr)_190px_92px]"
      >
        <span className="font-mono text-[13px] font-extrabold tracking-wide text-(--color-accent)">
          {risk.id}
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-bold">{risk.name}</span>
          <span className="mt-0.5 block text-[12.6px] text-(--color-dim)">
            {risk.description}
          </span>
        </span>

        <span className="col-span-2 min-w-0 lg:col-span-1">
          <span className="flex h-2.5 overflow-hidden rounded-full bg-[#1b2436]">
            <span style={{ width: `${(stats.pass / total) * 100}%`, background: BAND_COLOR.green }} />
            <span style={{ width: `${(stats.partial / total) * 100}%`, background: BAND_COLOR.amber }} />
            <span style={{ width: `${(stats.fail / total) * 100}%`, background: BAND_COLOR.red }} />
          </span>
          <span className="mt-1.5 flex flex-wrap gap-2.5 font-mono text-[10.5px] text-(--color-dim)">
            <span style={{ color: "#5fdcaa" }}>{stats.pass} pass</span>
            <span style={{ color: "#f5c860" }}>{stats.partial} partial</span>
            <span style={{ color: "#ff8b93" }}>{stats.fail} fail</span>
          </span>
        </span>

        <span
          className="col-span-2 text-[20px] font-extrabold lg:col-span-1 lg:text-right"
          style={{ color: BAND_COLOR[band(stats.compliantPct)] }}
        >
          {stats.compliantPct}%
        </span>
      </button>

      {open ? (
        <div className="border-t border-(--color-line) bg-[#0c1220] px-4 py-3.5">
          {ranked.map((agent) => {
            const score = agent.posture[id];
            const verdict = band(score);
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => openAgent(agent.id)}
                className="group grid w-full grid-cols-[minmax(0,1fr)_110px_78px] items-center gap-3 border-b border-(--color-line) py-2.5 text-left text-[13.4px] last:border-b-0"
              >
                <span className="min-w-0">
                  <span className="block truncate group-hover:text-(--color-accent)">
                    {agent.name}
                  </span>
                  <span className="block text-[11.5px] text-(--color-dim)">
                    {agent.department} · {agent.owner}
                  </span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-[#1b2436]">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${score}%`, background: BAND_COLOR[verdict] }}
                  />
                </span>
                <span
                  className={`rounded-md px-1.5 py-1.5 text-center font-mono text-[10px] font-bold tracking-wide uppercase ${BADGE_TONE[verdict]}`}
                >
                  {VERDICT_LABEL[verdict]} {score}
                </span>
              </button>
            );
          })}

          <p className="mt-3.5 rounded-[10px] border border-dashed border-[#3a4a6b] bg-[rgba(127,107,255,0.06)] px-3.5 py-2.5 text-[12.8px] text-(--color-mute)">
            <b className="text-[#b3a5ff]">What &ldquo;compliant&rdquo; means here:</b>{" "}
            {risk.compliantMeans}
          </p>

          {detail && hasAssessments(id) && DETAIL_TAB[id] ? (
            <button
              type="button"
              onClick={() => setTab(DETAIL_TAB[id]!)}
              className="mt-3.5 rounded-[10px] bg-(--color-accent) px-3.5 py-2 text-[12.5px] font-bold text-[#06101d]"
            >
              See the {detail.controls.length} controls behind this score →
            </button>
          ) : detail ? (
            <p className="mt-3.5 text-[12.3px] text-(--color-dim)">
              The {detail.controls.length} controls the standard asks for are transcribed, with
              how to close each one. No agent has been assessed against them yet, so this score
              is a declared posture rather than a roll-up of those controls.
            </p>
          ) : (
            <p className="mt-3.5 text-[12.3px] text-(--color-dim)">
              Control-level detail for this risk has not been transcribed yet.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Matrix() {
  const { openAgent, showAgentRisks } = useShell();
  return (
    <Panel className="overflow-x-auto p-3.5">
      <table className="min-w-[760px] border-separate border-spacing-[3px] text-xs">
        <thead>
          <tr>
            <th className="pr-2.5 text-left text-[12.6px] font-semibold text-(--color-mute)">
              Agent
            </th>
            {ASI_IDS.map((id) => (
              <th
                key={id}
                className="p-1 text-center font-mono text-[10px] font-bold tracking-wide text-(--color-dim)"
              >
                {id.replace("ASI", "")}
              </th>
            ))}
            <th className="p-1 text-center font-mono text-[10px] font-bold tracking-wide text-(--color-dim)">
              AVG
            </th>
          </tr>
        </thead>
        <tbody>
          {AGENTS.map((agent) => (
            <tr key={agent.id}>
              <th
                scope="row"
                // The name is the agent-scoped affordance; a cell opens the profile.
                onClick={() => showAgentRisks(agent.id)}
                className="cursor-pointer pr-2.5 text-left text-[12.6px] font-semibold whitespace-nowrap text-(--color-mute) hover:text-(--color-accent)"
              >
                {agent.name}
              </th>
              {ASI_IDS.map((id) => {
                const score = agent.posture[id];
                return (
                  <td
                    key={id}
                    onClick={() => openAgent(agent.id)}
                    // Hue carries the verdict; opacity carries the magnitude, so a
                    // weak pass and a strong pass are still distinguishable.
                    style={{ background: BAND_COLOR[band(score)], opacity: 0.35 + score / 160 }}
                    className="h-7.5 w-11 cursor-pointer rounded-md text-center font-mono text-[10.5px] font-bold text-[#06101d] hover:outline-2 hover:outline-white"
                  >
                    {score}
                  </td>
                );
              })}
              <td
                onClick={() => openAgent(agent.id)}
                style={{ background: BAND_COLOR[standingBand(agent)], opacity: 0.95 }}
                className="h-7.5 w-11 cursor-pointer rounded-md text-center font-mono text-[10.5px] font-bold text-[#06101d] hover:outline-2 hover:outline-white"
              >
                {standingScore(agent)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex flex-wrap gap-4 text-[11.8px] text-(--color-dim)">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: BAND_COLOR.green }} />
          {PASS_THRESHOLD} and above — control in place
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: BAND_COLOR.amber }} />
          {PARTIAL_THRESHOLD} to {PASS_THRESHOLD - 1} — partial
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: BAND_COLOR.red }} />
          below {PARTIAL_THRESHOLD} — missing
        </span>
        <span>
          <b className="text-(--color-mute)">Columns</b> are ASI01 to ASI10. Click any row or
          cell to open that agent.
        </span>
      </div>
    </Panel>
  );
}



const CONTROL_TONE: Record<string, string> = {
  "in-place": "bg-[rgba(47,191,135,0.16)] text-[#5fdcaa]",
  partial: "bg-[rgba(240,180,41,0.16)] text-[#f5c860]",
  missing: "bg-[rgba(244,97,107,0.16)] text-[#ff8b93]",
  "not-applicable": "bg-[rgba(90,107,131,0.18)] text-[#9fb0c6]",
};

/**
 * The tab holding each risk's own detail page. A risk that is absent has no
 * page of its own, and the reader is offered no link at all — sending them to
 * another risk's page reads as an answer to the question they asked.
 */
const DETAIL_TAB: Partial<Record<AsiId, TabId>> = {
  ASI01: "asi01",
};

/**
 * One risk for one agent. Where the controls have been transcribed the row
 * opens to show which specific controls pass, partially pass or fail and the
 * evidence behind each - the headline counts alone never answer "which ones".
 *
 * A risk can have its controls transcribed without this agent having been
 * assessed against them. The row then shows the published control catalogue
 * and says the assessment is outstanding, rather than reporting a status
 * nobody has established.
 */
function AgentRiskRow({ agentId, riskId }: { agentId: string; riskId: AsiId }) {
  const { setTab, setRiskAgent } = useShell();
  const [open, setOpen] = useState(false);
  const agent = agentById(agentId);
  const risk = ASI_RISKS.find((r) => r.id === riskId);
  const detail = riskDetail(riskId);
  const cells = useMemo(
    () => (detail ? assessmentsFor(agentId, riskId) : []),
    [detail, agentId, riskId],
  );
  if (!agent || !risk) return null;

  const score = agent.posture[riskId];
  const verdict = band(score);
  const assessed = cells.length > 0;
  const detailTab = DETAIL_TAB[riskId];
  const inPlace = cells.filter((c) => c.status === "in-place").length;
  const partial = cells.filter((c) => c.status === "partial").length;
  const missing = cells.filter((c) => c.status === "missing").length;
  const na = cells.filter((c) => c.status === "not-applicable").length;

  const Row = detail ? "button" : "div";

  return (
    <div className="border-b border-(--color-line) last:border-b-0">
      <Row
        {...(detail
          ? { type: "button" as const, onClick: () => setOpen((v) => !v), "aria-expanded": open }
          : {})}
        className={`grid w-full grid-cols-[64px_minmax(0,1fr)_92px] items-center gap-3.5 px-4 py-3.5 text-left lg:grid-cols-[64px_minmax(0,1fr)_150px_130px_92px] ${
          detail ? "transition hover:bg-(--color-panel-2)" : ""
        }`}
      >
        <span className="font-mono text-[13px] font-extrabold tracking-wide text-(--color-accent)">
          {risk.id}
        </span>

        <span className="min-w-0">
          <span className="block text-[14.5px] font-bold">{risk.name}</span>
          <span className="mt-0.5 block text-[12.5px] text-(--color-dim)">
            {assessed
              ? `${cells.length} controls — ${inPlace} in place, ${partial} partial, ${missing} missing${na ? `, ${na} n/a` : ""}`
              : detail
                ? `${detail.controls.length} controls the standard asks for — not yet assessed for this agent`
                : risk.description}
          </span>
        </span>

        <span className="hidden lg:block">
          <Meter value={score} color={BAND_COLOR[verdict]} />
          <span className="mt-1.5 block font-mono text-[10.5px] text-(--color-dim)">
            {assessed ? "from its controls" : "declared posture"}
          </span>
        </span>

        <span className="hidden lg:block">
          {detail ? (
            <span className="font-mono text-[10.5px] text-(--color-accent)">
              {open
                ? "hide the controls"
                : assessed
                  ? "show which controls"
                  : "show what it asks for"}
            </span>
          ) : (
            <span className="font-mono text-[10.5px] text-(--color-dim)">
              detail not transcribed
            </span>
          )}
        </span>

        <span
          className={`rounded-md px-1.5 py-1.5 text-center font-mono text-[10px] font-bold tracking-wide uppercase ${BADGE_TONE[verdict]}`}
        >
          {VERDICT_LABEL[verdict]} {score}
        </span>
      </Row>

      {open && detail && !assessed ? (
        <div className="border-t border-(--color-line) bg-[#0c1220] px-4 py-3.5">
          <p className="mb-3 text-[12.4px] text-(--color-dim)">
            These are the controls the standard asks for. Nobody has assessed{" "}
            {agent.name} against them yet, so this risk&rsquo;s score is still the declared
            posture rather than a roll-up of the controls below.
          </p>
          {detail.controls.map((control) => (
            <div
              key={control.n}
              className="grid grid-cols-[30px_minmax(0,1fr)] items-start gap-3 border-b border-(--color-line) py-2.5 last:border-b-0"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-(--color-line-2) bg-(--color-panel-3) font-mono text-[11px] font-extrabold text-(--color-accent)">
                {control.n}
              </span>
              <span className="min-w-0">
                <span className="block text-[13.3px] font-semibold">{control.name}</span>
                <span className="mt-0.5 block text-[12.2px] text-(--color-dim)">
                  {control.description}
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {open && detail && assessed ? (
        <div className="border-t border-(--color-line) bg-[#0c1220] px-4 py-3.5">
          {cells.map((cell) => {
            const control = detail.controls.find((c) => c.n === cell.controlN);
            if (!control) return null;
            return (
              <div
                key={cell.controlN}
                className="grid grid-cols-[30px_minmax(0,1fr)_112px] items-center gap-3 border-b border-(--color-line) py-2.5 last:border-b-0"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-(--color-line-2) bg-(--color-panel-3) font-mono text-[11px] font-extrabold text-(--color-accent)">
                  {control.n}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.3px] font-semibold">{control.short}</span>
                  <span className="mt-0.5 block text-[12.2px] text-(--color-dim)">
                    {cell.evidence}
                  </span>
                </span>
                <span
                  className={`rounded-md px-2 py-1.5 text-center font-mono text-[10px] font-bold tracking-wide uppercase ${CONTROL_TONE[cell.status]}`}
                >
                  {cell.status === "not-applicable" ? "N/A" : cell.status.replace("-", " ")}
                </span>
              </div>
            );
          })}
          {detailTab ? (
            <button
              type="button"
              onClick={() => {
                setRiskAgent(agentId);
                setTab(detailTab);
              }}
              className="mt-3.5 rounded-lg bg-(--color-accent) px-3.5 py-2 text-[12.5px] font-bold text-[#06101d]"
            >
              Open the full detail, including how to close each gap →
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------- by agent ---- */

/**
 * One agent against all ten risks. This is the view a remediation owner wants:
 * not "who is failing control 6" but "what does my agent need".
 */
function ByAgent({ agentId }: { agentId: string }) {
  const agent = agentById(agentId);
  const totals = useMemo(() => {
    if (!agent) return { pass: 0, partial: 0, fail: 0 };
    let pass = 0, partial = 0, fail = 0;
    for (const id of ASI_IDS) {
      const verdict = band(agent.posture[id]);
      if (verdict === "green") pass += 1;
      else if (verdict === "amber") partial += 1;
      else fail += 1;
    }
    return { pass, partial, fail };
  }, [agent]);

  if (!agent) return null;
  const standing = standingScore(agent);

  return (
    <Panel className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-3.5 border-b border-(--color-line) bg-[linear-gradient(160deg,#141d2e,#101724)] p-4">
        <Avatar name={agent.name} band={standingBand(agent)} />
        <div className="min-w-0">
          <div className="text-[17px] font-bold">{agent.name}</div>
          <div className="text-[12.3px] text-(--color-dim)">
            {agent.department} · manager {agent.owner}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-5">
          <span className="font-mono text-[11px] text-(--color-dim)">
            of the ten risks:{" "}
            <b style={{ color: "#5fdcaa" }}>{totals.pass}</b> pass ·{" "}
            <b style={{ color: "#f5c860" }}>{totals.partial}</b> partial ·{" "}
            <b style={{ color: "#ff8b93" }}>{totals.fail}</b> fail
          </span>
          <span className="text-right">
            <span
              className="block text-3xl font-extrabold tracking-tight"
              style={{ color: BAND_COLOR[standingBand(agent)] }}
            >
              {standing}
            </span>
            <span className="block font-mono text-[10px] tracking-[0.12em] text-(--color-dim) uppercase">
              across all ten
            </span>
          </span>
        </div>
      </div>

      {ASI_RISKS.map((risk) => (
        <AgentRiskRow key={risk.id} agentId={agent.id} riskId={risk.id} />
      ))}
    </Panel>
  );
}

export function OwaspLive() {
  const { owaspView: view, setOwaspView: setView, riskAgentId, setRiskAgent } = useShell();
  const [openRisk, setOpenRisk] = useState<AsiId | null>(null);
  const selectedAgentId = riskAgentId ?? AGENTS[0].id;

  return (
    <div>
      <PageHeading kicker="Compliance manager view" title="OWASP Live">
        All ten agentic risks, scored continuously across every agent. Green means the
        controls for that risk are in place, amber means partial, red means the control is
        missing. Open a risk to see exactly who passes and who does not.
      </PageHeading>

      <SummaryStrip />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["risk", "agent", "matrix"] as const).map((v) => (
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
            {v === "risk" ? "By risk" : v === "agent" ? "By agent" : "Full matrix"}
          </button>
        ))}
        {view === "agent" ? (
          <select
            value={selectedAgentId}
            onChange={(e) => setRiskAgent(e.target.value)}
            aria-label="Choose an agent"
            className="min-w-[250px] rounded-full border border-(--color-line) bg-(--color-panel) px-3.5 py-2 text-[13px] text-(--color-ink) outline-none focus:border-(--color-accent)"
          >
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.department}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {view === "risk"
        ? ASI_IDS.map((id) => (
            <RiskCard
              key={id}
              id={id}
              open={openRisk === id}
              onToggle={() => setOpenRisk((cur) => (cur === id ? null : id))}
            />
          ))
        : view === "agent"
          ? <ByAgent agentId={selectedAgentId} />
          : <Matrix />}
    </div>
  );
}
