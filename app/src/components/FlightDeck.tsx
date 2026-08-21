"use client";

import { useMemo, useState } from "react";
import { ACTIVITY, AGENTS, agentById, ORGANISATION } from "@/lib/data";
import {
  actsUnsupervised,
  hasIrreversibleReach,
  neverExpires,
  reachTier,
  standingBand,
  standingScore,
} from "@/lib/scoring";
import type { AccessGrant, Agent, EventSeverity, ToolGrant } from "@/lib/types";
import { useShell } from "./AppShell";
import { ACCESS_MODE, BAND_COLOR, PageHeading } from "./ui";

/* ---------- filters ---------- */

interface Tile {
  id: string;
  label: string;
  note: string;
  colour?: string;
  match: (agent: Agent) => boolean;
}

const TILES: readonly Tile[] = [
  { id: "all", label: "Agents live", note: "Show everything", match: () => true },
  {
    id: "unsupervised",
    label: "Act unsupervised",
    note: "No human approval step",
    colour: BAND_COLOR.amber,
    match: actsUnsupervised,
  },
  {
    id: "money",
    label: "Can move money",
    note: "Payment or ordering rights",
    colour: BAND_COLOR.red,
    match: (a) => a.canMoveMoney,
  },
  {
    id: "irreversible",
    label: "Irreversible reach",
    note: "Cannot be undone",
    colour: BAND_COLOR.red,
    match: hasIrreversibleReach,
  },
  {
    id: "no-expiry",
    label: "No expiry set",
    note: "Runs forever by default",
    colour: BAND_COLOR.amber,
    match: neverExpires,
  },
];

/* ---------- estate geometry ---------- */

const CENTRE = { x: 350, y: 238 };
const RING_RADIUS: Record<1 | 2 | 3, number> = { 1: 112, 2: 172, 3: 228 };
const RING_SQUASH = 0.84;

const RING_META: ReadonlyArray<{ tier: 1 | 2 | 3; label: string; colour: string }> = [
  { tier: 1, label: "READS ONLY", colour: BAND_COLOR.green },
  { tier: 2, label: "MAKES CHANGES", colour: BAND_COLOR.amber },
  { tier: 3, label: "CANNOT BE UNDONE", colour: BAND_COLOR.red },
];

interface Placed {
  agent: Agent;
  x: number;
  y: number;
  radius: number;
}

/**
 * Spread each ring's agents evenly, offset per ring so the three rings never
 * line their nodes up into a false radial spoke.
 */
function placeAgents(): Placed[] {
  const byTier = new Map<1 | 2 | 3, Agent[]>([
    [1, []],
    [2, []],
    [3, []],
  ]);
  for (const agent of AGENTS) byTier.get(reachTier(agent))?.push(agent);

  const placed: Placed[] = [];
  for (const [tier, group] of byTier) {
    const offset = tier * 0.75;
    group.forEach((agent, i) => {
      const angle = offset + (i / group.length) * Math.PI * 2;
      placed.push({
        agent,
        x: CENTRE.x + Math.cos(angle) * RING_RADIUS[tier],
        y: CENTRE.y + Math.sin(angle) * RING_RADIUS[tier] * RING_SQUASH,
        radius: 8 + Math.round(agent.authority / 11),
      });
    });
  }
  return placed;
}

/* ---------- agent geometry ---------- */

const STROKE_FOR_MODE = { read: 1.4, write: 2.4, irreversible: 3.6 } as const;

interface SideItem {
  grant: AccessGrant;
  x: number;
  y: number;
  anchor: "start" | "end";
}

function stackSide(grants: AccessGrant[], x: number, anchor: "start" | "end"): SideItem[] {
  const gap = Math.min(78, 300 / Math.max(grants.length, 1));
  const first = CENTRE.y - ((grants.length - 1) * gap) / 2;
  return grants.map((grant, i) => ({ grant, x, y: first + i * gap, anchor }));
}

interface ToolPill {
  tool: ToolGrant;
  x: number;
  width: number;
}

function layoutTools(tools: readonly ToolGrant[]): ToolPill[] {
  const span = 480;
  const step = tools.length > 1 ? span / (tools.length - 1) : 0;
  return tools.map((tool, i) => ({
    tool,
    x: tools.length > 1 ? 110 + i * step : CENTRE.x,
    width: Math.max(tool.name.length * 6.6 + 16, 60),
  }));
}

/* ---------- tooltip ---------- */

interface Tip {
  text: string;
  x: number;
  y: number;
}

/* ---------- map views ---------- */

function EstateMap({
  placed,
  matches,
  onPick,
  onHover,
}: {
  placed: readonly Placed[];
  matches: (agent: Agent) => boolean;
  onPick: (id: string) => void;
  onHover: (tip: Tip | null) => void;
}) {
  return (
    <>
      <defs>
        <radialGradient id="centreGlow">
          <stop offset="0" stopColor="#7f6bff" />
          <stop offset="1" stopColor="#2b2270" />
        </radialGradient>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {RING_META.map((ring) => (
        <g key={ring.tier} fill="none">
          <ellipse
            cx={CENTRE.x}
            cy={CENTRE.y}
            rx={RING_RADIUS[ring.tier]}
            ry={RING_RADIUS[ring.tier] * RING_SQUASH}
            stroke={ring.colour}
            strokeOpacity={0.16}
            strokeDasharray="3 5"
          />
          <text
            x={CENTRE.x}
            y={CENTRE.y - RING_RADIUS[ring.tier] * RING_SQUASH - 7}
            textAnchor="middle"
            fontSize="9"
            fill={ring.colour}
            fillOpacity={0.6}
            fontFamily="ui-monospace, monospace"
          >
            {ring.label}
          </text>
        </g>
      ))}

      {placed.map((p) => (
        <line
          key={`line-${p.agent.id}`}
          x1={CENTRE.x}
          y1={CENTRE.y}
          x2={p.x}
          y2={p.y}
          stroke="#25344c"
          strokeWidth={reachTier(p.agent)}
          opacity={matches(p.agent) ? 0.75 : 0.1}
        />
      ))}

      <circle cx={CENTRE.x} cy={CENTRE.y} r={46} fill="url(#centreGlow)" filter="url(#softGlow)" />
      <text x={CENTRE.x} y={CENTRE.y - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#e9eff9">
        {ORGANISATION.split(" ")[0].toUpperCase()}
      </text>
      <text
        x={CENTRE.x}
        y={CENTRE.y + 10}
        textAnchor="middle"
        fontSize="8.5"
        fill="#c9d3e8"
        fontFamily="ui-monospace, monospace"
      >
        YOUR BUSINESS
      </text>

      {placed.map((p) => {
        const dimmed = !matches(p.agent);
        return (
          <g
            key={p.agent.id}
            className="cursor-pointer"
            opacity={dimmed ? 0.14 : 1}
            onClick={() => onPick(p.agent.id)}
            onMouseMove={(e) =>
              onHover({
                text: `${p.agent.name} · ${p.agent.department} · authority ${p.agent.authority}/100 · standing ${standingScore(p.agent)}/100 — click to see its connections`,
                x: e.clientX,
                y: e.clientY,
              })
            }
            onMouseLeave={() => onHover(null)}
          >
            <circle
              cx={p.x}
              cy={p.y}
              r={p.radius}
              fill={BAND_COLOR[standingBand(p.agent)]}
              opacity={0.88}
            />
            {/* Generous transparent target so small low-authority nodes stay clickable. */}
            <circle cx={p.x} cy={p.y} r={p.radius + 14} fill="transparent" />
            <text
              x={p.x}
              y={p.y + p.radius + 13}
              textAnchor="middle"
              fontSize="9.5"
              fill="#94a4bf"
              fontFamily="ui-monospace, monospace"
            >
              {p.agent.name.split(" ")[0].toLowerCase()}
            </text>
          </g>
        );
      })}
    </>
  );
}

function AgentMap({ agent }: { agent: Agent }) {
  const reads = agent.access.filter((a) => a.mode === "read");
  const changes = agent.access.filter((a) => a.mode !== "read");
  const left = stackSide(reads, 120, "end");
  const right = stackSide(changes, 580, "start");
  const tools = layoutTools(agent.tools);
  const sBand = standingBand(agent);
  const [firstWord, ...restWords] = agent.name.split(" ");

  return (
    <>
      <defs>
        <radialGradient id="agentGlow">
          <stop offset="0" stopColor="#7f6bff" />
          <stop offset="1" stopColor="#2b2270" />
        </radialGradient>
        <filter id="agentSoft">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <text x={120} y={34} textAnchor="middle" fontSize="10" fill={BAND_COLOR.green} fontFamily="ui-monospace, monospace">
        IT CAN SEE
      </text>
      <text x={580} y={34} textAnchor="middle" fontSize="10" fill={BAND_COLOR.amber} fontFamily="ui-monospace, monospace">
        IT CAN CHANGE
      </text>

      {[...left, ...right].map((item) => (
        <line
          key={`edge-${item.grant.name}`}
          x1={CENTRE.x}
          y1={CENTRE.y}
          x2={item.x}
          y2={item.y}
          stroke={ACCESS_MODE[item.grant.mode].color}
          strokeWidth={STROKE_FOR_MODE[item.grant.mode]}
          opacity={0.55}
        />
      ))}

      {tools.map((pill) => (
        <line
          key={`tool-edge-${pill.tool.name}`}
          x1={CENTRE.x}
          y1={CENTRE.y}
          x2={pill.x}
          y2={418}
          stroke={ACCESS_MODE[pill.tool.mode].color}
          strokeWidth={1}
          opacity={0.22}
          strokeDasharray="3 4"
        />
      ))}

      {[...left, ...right].map((item) => {
        const labelX = item.anchor === "end" ? item.x - 13 : item.x + 13;
        return (
          <g key={`node-${item.grant.name}`}>
            <circle cx={item.x} cy={item.y} r={7} fill={ACCESS_MODE[item.grant.mode].color} opacity={0.9} />
            <text x={labelX} y={item.y + 4} textAnchor={item.anchor} fontSize="11.5" fill="#c9d3e8">
              {item.grant.name}
            </text>
            <text
              x={labelX}
              y={item.y + 17}
              textAnchor={item.anchor}
              fontSize="8.5"
              fill="#65788f"
              fontFamily="ui-monospace, monospace"
            >
              {ACCESS_MODE[item.grant.mode].label.toUpperCase()}
            </text>
          </g>
        );
      })}

      <circle cx={CENTRE.x} cy={CENTRE.y} r={52} fill="url(#agentGlow)" filter="url(#agentSoft)" />
      <circle cx={CENTRE.x} cy={CENTRE.y} r={52} fill="none" stroke={BAND_COLOR[sBand]} strokeWidth={3} />
      <text x={CENTRE.x} y={CENTRE.y - 6} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#e9eff9">
        {firstWord}
      </text>
      <text x={CENTRE.x} y={CENTRE.y + 8} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#e9eff9">
        {restWords.join(" ")}
      </text>
      <text
        x={CENTRE.x}
        y={CENTRE.y + 24}
        textAnchor="middle"
        fontSize="8.5"
        fill={BAND_COLOR[sBand]}
        fontFamily="ui-monospace, monospace"
      >
        {standingScore(agent)}/100
      </text>

      <text x={CENTRE.x} y={410} textAnchor="middle" fontSize="10" fill="#65788f" fontFamily="ui-monospace, monospace">
        TOOLS IT CAN CALL
      </text>
      {tools.map((pill) => (
        <g key={`tool-${pill.tool.name}`}>
          <rect
            x={pill.x - pill.width / 2}
            y={419}
            width={pill.width}
            height={24}
            rx={7}
            fill={ACCESS_MODE[pill.tool.mode].color}
            fillOpacity={0.13}
            stroke={ACCESS_MODE[pill.tool.mode].color}
            strokeOpacity={0.55}
          />
          <text
            x={pill.x}
            y={435}
            textAnchor="middle"
            fontSize="10"
            fill={ACCESS_MODE[pill.tool.mode].color}
            fontFamily="ui-monospace, monospace"
          >
            {pill.tool.name}
          </text>
        </g>
      ))}
    </>
  );
}

/* ---------- legend ---------- */

function Swatch({ colour }: { colour: string }) {
  return <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: colour }} />;
}

function EstateLegend() {
  return (
    <>
      <span>
        <b className="text-(--color-mute)">The centre</b> is your business — the systems, money
        and records your agents act on.
      </span>
      <span className="flex items-center gap-1.5">
        <Swatch colour={BAND_COLOR.green} />Ring 1 · reads only
      </span>
      <span className="flex items-center gap-1.5">
        <Swatch colour={BAND_COLOR.amber} />Ring 2 · makes changes
      </span>
      <span className="flex items-center gap-1.5">
        <Swatch colour={BAND_COLOR.red} />Ring 3 · cannot be undone
      </span>
      <span>
        <b className="text-(--color-mute)">Dot size</b> = authority held.{" "}
        <b className="text-(--color-mute)">Dot colour</b> = current standing.
      </span>
    </>
  );
}

function AgentLegend() {
  return (
    <>
      <span className="flex items-center gap-1.5">
        <Swatch colour={BAND_COLOR.green} />Reads it — can see this
      </span>
      <span className="flex items-center gap-1.5">
        <Swatch colour={BAND_COLOR.amber} />Changes it — can alter this
      </span>
      <span className="flex items-center gap-1.5">
        <Swatch colour={BAND_COLOR.red} />Cannot be undone — money, access or destruction
      </span>
      <span>
        <b className="text-(--color-mute)">Line thickness</b> = how much damage that connection
        allows.
      </span>
    </>
  );
}

/* ---------- activity feed ---------- */

const SEVERITY_COLOUR: Record<EventSeverity, string> = {
  critical: BAND_COLOR.red,
  warning: BAND_COLOR.amber,
  info: "var(--color-accent)",
};

/* ---------- page ---------- */

export function FlightDeck() {
  const { openAgent, focusedAgentId, focusAgent, showAgentRisks } = useShell();
  const [filterId, setFilterId] = useState("all");
  const [tip, setTip] = useState<Tip | null>(null);

  const placed = useMemo(placeAgents, []);
  const filter = TILES.find((t) => t.id === filterId) ?? TILES[0];
  const focused = focusedAgentId ? agentById(focusedAgentId) : undefined;
  const matching = AGENTS.filter(filter.match).length;

  const hint = focused
    ? `${focused.access.length} systems · ${focused.tools.length} tools`
    : filterId === "all"
      ? "click an agent to see what it touches"
      : `showing ${matching} of ${AGENTS.length}`;

  return (
    <div>
      <PageHeading kicker="Direction A · live operations" title="Flight Deck">
        Start with the whole estate, then click any agent to see exactly what it is wired into
        — what it can read, what it can change, and what it can do that cannot be undone.
      </PageHeading>

      <div className="grid items-start gap-3.5 xl:grid-cols-[210px_minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-2.5">
          {TILES.map((tile) => {
            const count = AGENTS.filter(tile.match).length;
            const selected = filterId === tile.id;
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => {
                  setFilterId(tile.id);
                  focusAgent(null);
                }}
                aria-pressed={selected}
                className={`rounded-xl border bg-(--color-panel) p-3.5 text-left transition hover:bg-(--color-panel-2) ${
                  selected
                    ? "border-(--color-accent) shadow-[inset_0_0_0_1px_var(--color-accent)]"
                    : "border-(--color-line) hover:border-(--color-accent)"
                }`}
              >
                <div className="font-mono text-[10px] font-bold tracking-[0.13em] text-(--color-dim) uppercase">
                  {tile.label}
                </div>
                <div
                  className="mt-1 text-[28px] font-extrabold tracking-tight"
                  style={tile.colour ? { color: tile.colour } : undefined}
                >
                  {count}
                </div>
                <div className="mt-0.5 text-[11.5px] text-(--color-dim)">{tile.note}</div>
              </button>
            );
          })}
        </div>

        <div className="min-w-0 rounded-[14px] border border-(--color-line) bg-(--color-panel) p-2.5">
          <div className="flex flex-wrap items-center gap-2.5 px-2 pt-1 pb-2">
            <span className="text-sm font-bold">
              {focused ? `${focused.name} — what it is wired into` : "Where your agents sit"}
            </span>
            {focused ? (
              <>
                <button
                  type="button"
                  onClick={() => focusAgent(null)}
                  className="rounded-lg border border-(--color-line-2) px-2.5 py-1 text-xs text-(--color-mute) hover:border-(--color-accent) hover:text-(--color-ink)"
                >
                  ← Back to all agents
                </button>
                <button
                  type="button"
                  onClick={() => showAgentRisks(focused.id)}
                  className="rounded-lg bg-(--color-accent) px-2.5 py-1 text-xs font-bold text-[#06101d]"
                >
                  See its OWASP controls →
                </button>
              </>
            ) : null}
            <span className="ml-auto font-mono text-[11.5px] text-(--color-dim)">{hint}</span>
          </div>

          <svg viewBox="0 0 700 470" className="block h-auto w-full">
            {focused ? (
              <AgentMap agent={focused} />
            ) : (
              <EstateMap
                placed={placed}
                matches={filter.match}
                onPick={(id) => focusAgent(id)}
                onHover={setTip}
              />
            )}
          </svg>

          <div className="mt-1.5 flex flex-wrap gap-4 border-t border-(--color-line) px-2 pt-2.5 text-[11.8px] text-(--color-dim)">
            {focused ? <AgentLegend /> : <EstateLegend />}
          </div>
        </div>

        <div className="max-h-[600px] overflow-auto rounded-[14px] border border-(--color-line) bg-(--color-panel) p-3">
          <h4 className="mb-2.5 font-mono text-xs tracking-[0.13em] text-(--color-dim) uppercase">
            Live activity
          </h4>
          {ACTIVITY.map((event, i) => {
            const agent = agentById(event.agentId);
            if (!agent) return null;
            return (
              <button
                key={`${event.agentId}-${i}`}
                type="button"
                onClick={() => {
                  focusAgent(event.agentId);
                  openAgent(event.agentId);
                }}
                style={{ borderLeftColor: SEVERITY_COLOUR[event.severity] }}
                className="mb-2 block w-full rounded-[9px] border border-l-[3px] border-(--color-line) bg-(--color-panel-2) px-2.5 py-2.5 text-left transition hover:bg-(--color-panel-3)"
              >
                <span className="flex gap-2 font-mono text-[10px] font-bold tracking-wider text-(--color-dim) uppercase">
                  <b className="text-(--color-accent)">{event.asi}</b>
                  <span>{event.age}</span>
                </span>
                <span className="mt-1.5 block text-[12.8px] text-(--color-mute)">
                  <b className="text-(--color-ink)">{agent.name}</b> {event.message.charAt(0).toLowerCase()}
                  {event.message.slice(1)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {tip ? (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-100 rounded-lg border border-(--color-line-2) bg-[#0b111b] px-2.5 py-1.5 text-xs"
          style={{ left: Math.min(tip.x + 14, 1200), top: tip.y - 34 }}
        >
          {tip.text}
        </div>
      ) : null}
    </div>
  );
}
