"use client";

import { ASI_IDS, asiRisk } from "@/lib/owasp";
import { agentById } from "@/lib/data";
import {
  actsUnsupervised,
  band,
  hasIrreversibleReach,
  neverExpires,
  standingBand,
  standingScore,
  STANDING_LABEL,
  weakestControls,
} from "@/lib/scoring";
import type { Agent } from "@/lib/types";
import { useShell } from "./AppShell";
import { ACCESS_MODE, authorityColor, Avatar, BAND_COLOR, Chip, Meter } from "./ui";

const AUTONOMY_LABEL: Record<Agent["autonomy"], string> = {
  "full-approval": "Every action",
  threshold: "Above a threshold only",
  none: "None — acts alone",
};

/**
 * Plain-English guidance for one agent, derived from its own record.
 *
 * The advisor never asserts anything the register does not support, so every
 * clause here maps to a field a reader can go and check.
 */
export function adviceFor(agent: Agent): string {
  const points: string[] = [];
  if (actsUnsupervised(agent) && (agent.canMoveMoney || hasIrreversibleReach(agent))) {
    points.push(
      "it takes actions you cannot undo with no human check — the single highest-value fix on this agent",
    );
  }
  if (neverExpires(agent)) {
    points.push("it has no end date, so its access renews itself indefinitely");
  }
  if (agent.oversight < 40) {
    points.push("its oversight sits far below the level its authority warrants");
  }
  const irreversibleTools = agent.tools.filter((t) => t.mode === "irreversible").length;
  if (irreversibleTools > 2) {
    points.push(`it holds ${irreversibleTools} tools whose effects cannot be reversed`);
  }
  if (points.length === 0) {
    return "Nothing urgent here. Keep the expiry date current and re-confirm the owner at the next quarterly review.";
  }
  return `${points.join("; ")}. I can draft a supervision plan for ${agent.owner} if you want it.`;
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-(--color-line) py-2 text-[13px]">
      <span className="text-(--color-dim)">{label}</span>
      <span className="text-right font-semibold" style={tone ? { color: tone } : undefined}>
        {value}
      </span>
    </div>
  );
}

function Measure({
  label,
  score,
  colour,
  explain,
}: {
  label: string;
  score: number;
  colour: string;
  explain: string;
}) {
  return (
    <div className="mb-3.5">
      <div className="flex justify-between text-[13px] font-semibold">
        <span>{label}</span>
        <span style={{ color: colour }}>{score}/100</span>
      </div>
      <p className="mt-1 mb-1.5 text-[11.5px] text-(--color-dim)">{explain}</p>
      <Meter value={score} color={colour} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mt-6 mb-3 font-mono text-[10.5px] font-bold tracking-[0.14em] text-(--color-dim) uppercase">
      {children}
    </h4>
  );
}

function ControlRow({ id, score }: { id: (typeof ASI_IDS)[number]; score: number }) {
  return (
    <div className="mb-1.5 flex items-center gap-2.5 text-[11.5px]">
      <span className="w-11 shrink-0 font-mono text-[10.5px] font-bold text-(--color-accent)">
        {id}
      </span>
      <span className="min-w-0 flex-1 truncate text-(--color-mute)">{asiRisk(id).name}</span>
      <span className="w-[70px] shrink-0">
        <Meter value={score} color={BAND_COLOR[band(score)]} />
      </span>
      <span className="w-6 shrink-0 text-right font-mono text-[10.5px] text-(--color-dim)">
        {score}
      </span>
    </div>
  );
}

export function AgentDrawer() {
  const { openAgentId, closeAgent, setTab, focusAgent } = useShell();
  const agent = openAgentId ? agentById(openAgentId) : undefined;
  const open = Boolean(agent);

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={closeAgent}
        className={`fixed inset-0 z-80 bg-[rgba(4,7,12,0.6)] transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        aria-hidden={!open}
        className={`fixed top-0 right-0 z-90 h-full w-[min(440px,94vw)] overflow-auto border-l border-(--color-line) bg-(--color-panel) transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-[102%]"
        }`}
      >
        {agent ? <DrawerBody agent={agent} onClose={closeAgent} onShowOnMap={() => {
          closeAgent();
          focusAgent(agent.id);
          setTab("deck");
        }} /> : null}
      </aside>
    </>
  );
}

function DrawerBody({
  agent,
  onClose,
  onShowOnMap,
}: {
  agent: Agent;
  onClose: () => void;
  onShowOnMap: () => void;
}) {
  const standing = standingScore(agent);
  const sBand = standingBand(agent);

  return (
    <>
      <div className="sticky top-0 z-2 flex items-start gap-3 border-b border-(--color-line) bg-(--color-panel) px-4.5 py-4">
        <Avatar name={agent.name} band={sBand} />
        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-bold">{agent.name}</div>
          <div className="truncate text-[11.5px] text-(--color-dim)">
            {agent.department} · manager {agent.owner}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ml-auto rounded-md px-1.5 text-xl leading-none text-(--color-dim) hover:bg-(--color-panel-3) hover:text-(--color-ink)"
        >
          ×
        </button>
      </div>

      <div className="p-4.5">
        <Measure
          label="Authority"
          score={agent.authority}
          colour={authorityColor(agent.authority)}
          explain="How much it can do alone — tools, spend, systems it can change. Higher is more dangerous."
        />
        <Measure
          label="Oversight"
          score={agent.oversight}
          colour={BAND_COLOR[band(agent.oversight)]}
          explain="How much human checking surrounds it — approvals, raw-action visibility, kill switch. Higher is safer."
        />
        <Measure
          label={`Standing · ${STANDING_LABEL[sBand]}`}
          score={standing}
          colour={BAND_COLOR[sBand]}
          explain="The average of its ten OWASP control scores, listed below."
        />

        <Row label="Human approval" value={AUTONOMY_LABEL[agent.autonomy]} />
        <Row
          label="Can move money"
          value={agent.canMoveMoney ? "Yes" : "No"}
          tone={agent.canMoveMoney ? BAND_COLOR.red : BAND_COLOR.green}
        />
        <Row
          label="Irreversible actions"
          value={hasIrreversibleReach(agent) ? "Yes" : "No"}
          tone={hasIrreversibleReach(agent) ? BAND_COLOR.red : BAND_COLOR.green}
        />
        <Row label="In service since" value={agent.inServiceSince} />
        <Row
          label="Access expires"
          value={agent.accessExpires ?? "Never set"}
          tone={agent.accessExpires ? undefined : BAND_COLOR.amber}
        />

        <SectionLabel>What it is wired into</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {agent.access.map((a) => (
            <Chip key={a.name} mode={a.mode}>
              {a.name} · {ACCESS_MODE[a.mode].label.toLowerCase()}
            </Chip>
          ))}
        </div>

        <SectionLabel>Tools it can call</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {agent.tools.map((t) => (
            <Chip key={t.name} mode={t.mode}>
              {t.name}
            </Chip>
          ))}
        </div>

        <button
          type="button"
          onClick={onShowOnMap}
          className="mt-3.5 rounded-[10px] border border-(--color-line-2) px-3 py-1.5 text-[12.5px] font-semibold text-(--color-mute) hover:border-(--color-accent) hover:text-(--color-ink)"
        >
          See its connections on the map →
        </button>

        <SectionLabel>Weakest three controls</SectionLabel>
        {weakestControls(agent, 3).map(([id, score]) => (
          <ControlRow key={id} id={id} score={score} />
        ))}

        <SectionLabel>All ten OWASP controls</SectionLabel>
        {ASI_IDS.map((id) => (
          <ControlRow key={id} id={id} score={agent.posture[id]} />
        ))}

        <div className="mt-4.5 rounded-[11px] border border-[#3a4a6b] bg-[rgba(127,107,255,0.08)] p-3.5 text-[13.3px] text-(--color-mute)">
          <b className="text-[#b3a5ff]">Advisor:</b> {adviceFor(agent)}
        </div>
      </div>
    </>
  );
}
