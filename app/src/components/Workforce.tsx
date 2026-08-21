"use client";

import { useMemo, useState } from "react";
import { AGENTS } from "@/lib/data";
import {
  band,
  neverExpires,
  PARTIAL_THRESHOLD,
  PASS_THRESHOLD,
  standingBand,
  standingScore,
  STANDING_LABEL,
} from "@/lib/scoring";
import type { Agent, Band } from "@/lib/types";
import { useShell } from "./AppShell";
import { authorityColor, Avatar, Badge, BAND_COLOR, Meter, PageHeading } from "./ui";

const ALL = "All";

/**
 * The two drivers behind the ten control scores, and which risks each one
 * moves. This answers the question the measures always provoke: "where does
 * this number come from?"
 */
const DEFINITIONS: ReadonlyArray<{
  term: string;
  body: React.ReactNode;
  risks?: readonly string[];
}> = [
  {
    term: "Authority",
    body: (
      <>
        How much this agent is able to do on its own — the breadth of its tools, whether it
        can spend money, whether its actions can be reversed, and how many systems it can
        write to. <b className="text-(--color-ink)">Higher is more dangerous.</b> It is the
        &ldquo;how much damage is possible&rdquo; half of the equation.
      </>
    ),
    risks: [
      "ASI02 Tool Misuse",
      "ASI03 Identity & Privilege",
      "ASI05 Code Execution",
      "ASI08 Cascading Failure",
    ],
  },
  {
    term: "Oversight",
    body: (
      <>
        How much human checking surrounds it — approval steps before it acts, whether the
        human sees the raw action or just the agent&rsquo;s summary, whether its memory can
        be inspected, and whether a tested kill switch exists.{" "}
        <b className="text-(--color-ink)">Higher is safer.</b> It is the &ldquo;how likely
        are we to catch it&rdquo; half.
      </>
    ),
    risks: [
      "ASI01 Goal Hijack",
      "ASI06 Memory Poisoning",
      "ASI09 Trust Exploitation",
      "ASI10 Rogue Agents",
    ],
  },
  {
    term: "Standing",
    body: (
      <>
        The overall verdict, and it is not a separate opinion —{" "}
        <b className="text-(--color-ink)">
          it is literally the average of that agent&rsquo;s ten OWASP control scores
        </b>
        , shown out of 100. Authority and Oversight are the two plain-English drivers behind
        those ten scores, so a high-authority, low-oversight agent will always carry a poor
        standing. Open any agent to see all ten scores that produced it.
      </>
    ),
    risks: ["average of ASI01–ASI10"],
  },
  {
    term: "The bands",
    body: (
      <>
        <b style={{ color: "#5fdcaa" }}>{PASS_THRESHOLD} and above</b> — in good standing,
        controls in place. <b style={{ color: "#f5c860" }}>{PARTIAL_THRESHOLD} to {PASS_THRESHOLD - 1}</b>{" "}
        — review access, controls partial.{" "}
        <b style={{ color: "#ff8b93" }}>below {PARTIAL_THRESHOLD}</b> — needs supervision, at
        least one control is missing outright. The same thresholds are used everywhere in the
        product, including the OWASP Live tab.
      </>
    ),
  },
];

function Definitions() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-(--color-line) bg-(--color-panel)">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[13.5px] font-semibold hover:bg-(--color-panel-2)"
      >
        <span className="grid size-4.5 shrink-0 place-items-center rounded-full border-[1.5px] border-(--color-accent) text-[11px] font-extrabold text-(--color-accent)">
          i
        </span>
        What do Authority, Oversight and Standing mean — and how do they map to the OWASP Top 10?
        <span className="ml-auto text-xs text-(--color-dim)">{open ? "hide" : "show"}</span>
      </button>
      {open ? (
        <div className="border-t border-(--color-line) px-4 pb-4.5">
          {DEFINITIONS.map((d) => (
            <div
              key={d.term}
              className="grid gap-3.5 border-b border-(--color-line) py-3.5 last:border-b-0 sm:grid-cols-[120px_minmax(0,1fr)]"
            >
              <div className="text-[13.5px] font-bold">{d.term}</div>
              <div className="text-[13.3px] text-(--color-mute)">
                {d.body}
                {d.risks ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {d.risks.map((r) => (
                      <span
                        key={r}
                        className="rounded border border-(--color-line-2) px-1.5 py-1 font-mono text-[10.5px] text-(--color-accent)"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${
        selected
          ? "border-(--color-accent) bg-(--color-accent) text-[#06101d]"
          : "border-(--color-line) bg-(--color-panel) text-(--color-mute) hover:border-(--color-accent) hover:text-(--color-ink)"
      }`}
    >
      {children}
    </button>
  );
}

function BarRow({
  label,
  value,
  colour,
}: {
  label: string;
  value: number;
  colour: string;
}) {
  return (
    <div className="flex items-center gap-2.5 font-mono text-[10px] text-(--color-dim)">
      <span className="w-[62px] shrink-0 tracking-wider uppercase">{label}</span>
      <span className="min-w-0 flex-1">
        <Meter value={value} color={colour} />
      </span>
      <span className="w-6.5 shrink-0 text-right text-(--color-mute)">{value}</span>
    </div>
  );
}

function AgentCard({ agent, onOpen }: { agent: Agent; onOpen: () => void }) {
  const sBand = standingBand(agent);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="min-w-0 rounded-[13px] border border-(--color-line) bg-(--color-panel) p-3.5 text-left transition hover:-translate-y-0.5 hover:border-(--color-accent)"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={agent.name} band={sBand} />
        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-bold">{agent.name}</div>
          <div className="truncate text-[11.5px] text-(--color-dim)">
            {agent.department} · reports to {agent.owner}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <BarRow label="Authority" value={agent.authority} colour={authorityColor(agent.authority)} />
        <BarRow
          label="Oversight"
          value={agent.oversight}
          colour={BAND_COLOR[band(agent.oversight)]}
        />
        <BarRow label="Standing" value={standingScore(agent)} colour={BAND_COLOR[sBand]} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge band={sBand}>{STANDING_LABEL[sBand]}</Badge>
        {neverExpires(agent) ? <Badge band="amber">No end date</Badge> : null}
      </div>
    </button>
  );
}

export function Workforce() {
  const { openAgent } = useShell();
  const [department, setDepartment] = useState<string>(ALL);
  const [standing, setStanding] = useState<Band | typeof ALL>(ALL);
  const [query, setQuery] = useState("");

  const departments = useMemo(
    () => [ALL, ...Array.from(new Set(AGENTS.map((a) => a.department)))],
    [],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return AGENTS.filter((agent) => {
      if (department !== ALL && agent.department !== department) return false;
      if (standing !== ALL && standingBand(agent) !== standing) return false;
      if (needle) {
        const haystack = [
          agent.name,
          agent.owner,
          ...agent.access.map((a) => a.name),
          ...agent.tools.map((t) => t.name),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [department, standing, query]);

  const standingFilters: ReadonlyArray<{ value: Band | typeof ALL; label: string }> = [
    { value: ALL, label: "Any standing" },
    { value: "red", label: STANDING_LABEL.red },
    { value: "amber", label: STANDING_LABEL.amber },
    { value: "green", label: STANDING_LABEL.green },
  ];

  return (
    <div>
      <PageHeading kicker="Direction C · governance" title="Agent Workforce">
        Every agent as a member of staff — a manager, a start date, an end date, an authority
        level and a standing.
      </PageHeading>

      <Definitions />

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        {departments.map((d) => (
          <Chip key={d} selected={department === d} onClick={() => setDepartment(d)}>
            {d}
          </Chip>
        ))}
        <span className="w-2.5" />
        {standingFilters.map((f) => (
          <Chip key={f.label} selected={standing === f.value} onClick={() => setStanding(f.value)}>
            {f.label}
          </Chip>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, manager or system…"
          aria-label="Search agents"
          className="min-w-[210px] rounded-full border border-(--color-line) bg-(--color-panel) px-3.5 py-2 text-[13px] text-(--color-ink) outline-none focus:border-(--color-accent)"
        />
      </div>

      {visible.length === 0 ? (
        <p className="p-5 text-(--color-dim)">No agents match those filters.</p>
      ) : (
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(285px,1fr))]">
          {visible.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onOpen={() => openAgent(agent.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
