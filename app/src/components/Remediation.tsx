"use client";

import { useMemo, useState } from "react";
import {
  remediationTasks,
  TASK_PRIORITY_ORDER,
  type RemediationTask,
  type TaskPriority,
  type TaskState,
} from "@/lib/controls";
import { riskDetail } from "@/lib/mitigations";
import { useShell } from "./AppShell";
import { BAND_COLOR, PageHeading, Panel } from "./ui";

const ALL = "All";

const PRIORITY_TONE: Record<TaskPriority, string> = {
  high: "bg-[rgba(244,97,107,0.16)] text-[#ff8b93]",
  medium: "bg-[rgba(240,180,41,0.16)] text-[#f5c860]",
  low: "bg-[rgba(91,157,255,0.14)] text-[#9fc4ff]",
};

const STATE_LABEL: Record<TaskState, string> = {
  open: "Not started",
  "in-progress": "In progress",
  blocked: "Blocked",
};

const STATE_TONE: Record<TaskState, string> = {
  open: "text-(--color-mute)",
  "in-progress": "text-[#f5c860]",
  blocked: "text-[#ff8b93]",
};

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

function Stat({ label, value, colour, note }: { label: string; value: number | string; colour: string; note: string }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[10px] font-bold tracking-[0.13em] text-(--color-dim) uppercase">
        {label}
      </div>
      <div className="mt-1 text-[26px] font-extrabold" style={{ color: colour }}>{value}</div>
      <div className="text-[11.5px] text-(--color-dim)">{note}</div>
    </div>
  );
}

function TaskRow({ task, onOpenAgent }: { task: RemediationTask; onOpenAgent: () => void }) {
  const control = riskDetail(task.risk)?.controls.find((c) => c.n === task.controlN);
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-(--color-line) last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="grid w-full grid-cols-[minmax(0,1fr)_88px] items-center gap-3.5 px-3.5 py-3 text-left transition hover:bg-(--color-panel-2) lg:grid-cols-[minmax(0,1fr)_150px_128px_112px_88px]"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10.5px] font-bold text-(--color-accent)">
              {task.risk}·{task.controlN}
            </span>
            <span className="text-[13.5px] font-semibold">{task.controlShort}</span>
          </span>
          <span className="mt-1 block text-[12.3px] text-(--color-dim)">
            {task.agentName} · {task.gap}
          </span>
        </span>

        <span className="hidden text-[12.5px] text-(--color-mute) lg:block">
          {task.assignee}
          <span className="mt-0.5 block font-mono text-[10.5px] text-(--color-dim)">
            {task.team}
          </span>
        </span>

        <span className="hidden text-[12.5px] lg:block">
          <span className="text-(--color-mute)">{task.due}</span>
          <span className={`mt-0.5 block font-mono text-[10.5px] ${STATE_TONE[task.state]}`}>
            {STATE_LABEL[task.state]}
          </span>
        </span>

        <span className="hidden font-mono text-[10.5px] text-(--color-dim) lg:block">
          {task.effort} of work
        </span>

        <span>
          <span
            className={`inline-block rounded-md px-2 py-1.5 text-center font-mono text-[10px] font-bold tracking-wide uppercase ${PRIORITY_TONE[task.priority]}`}
          >
            {task.priority}
          </span>
        </span>
      </button>

      {open && control ? (
        <div className="border-t border-(--color-line) bg-[#0c1220] px-3.5 py-3.5">
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenAgent}
              className="rounded-lg border border-(--color-line-2) px-3 py-1.5 text-xs text-(--color-mute) hover:border-(--color-accent) hover:text-(--color-ink)"
            >
              Open {task.agentName} →
            </button>
          </div>
          <div className="grid gap-3.5 lg:grid-cols-2">
            <div>
              <div className="mb-2 font-mono text-[10px] font-bold tracking-[0.13em] text-(--color-dim) uppercase">
                What closes it
              </div>
              <ol className="m-0 list-decimal pl-4 text-[12.9px] text-(--color-mute)">
                {control.steps.map((s) => (
                  <li key={s} className="mb-1.5">{s}</li>
                ))}
              </ol>
            </div>
            <div>
              <div className="mb-2 font-mono text-[10px] font-bold tracking-[0.13em] text-(--color-dim) uppercase">
                How it gets signed off
              </div>
              <p className="m-0 text-[12.9px] text-(--color-mute)">{control.verification}</p>
              <p className="mt-3 mb-0 text-[12.9px] text-(--color-mute)">
                <b className="text-(--color-ink)">{task.assignee}</b> is accountable;{" "}
                <b className="text-(--color-ink)">{task.team}</b> does the work.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Remediation() {
  const { openAgent } = useShell();
  const all = useMemo(() => remediationTasks(), []);
  const [priority, setPriority] = useState<TaskPriority | typeof ALL>(ALL);
  const [assignee, setAssignee] = useState<string>(ALL);
  const [state, setState] = useState<TaskState | typeof ALL>(ALL);
  const [query, setQuery] = useState("");

  const assignees = useMemo(
    () => [ALL, ...Array.from(new Set(all.map((t) => t.assignee))).sort()],
    [all],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all
      .filter((t) => {
        if (priority !== ALL && t.priority !== priority) return false;
        if (assignee !== ALL && t.assignee !== assignee) return false;
        if (state !== ALL && t.state !== state) return false;
        if (needle) {
          const hay = `${t.agentName} ${t.controlShort} ${t.assignee} ${t.team} ${t.department}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          TASK_PRIORITY_ORDER[a.priority] - TASK_PRIORITY_ORDER[b.priority] ||
          a.agentName.localeCompare(b.agentName),
      );
  }, [all, priority, assignee, state, query]);

  const counts = useMemo(() => {
    const high = all.filter((t) => t.priority === "high").length;
    const blocked = all.filter((t) => t.state === "blocked").length;
    const owners = new Set(all.map((t) => t.assignee)).size;
    return { high, blocked, owners };
  }, [all]);

  const selectClass =
    "rounded-full border border-(--color-line) bg-(--color-panel) px-3.5 py-2 text-[13px] text-(--color-ink) outline-none focus:border-(--color-accent)";

  return (
    <div>
      <PageHeading kicker="Remediation" title="Open tasks">
        Every gap across the estate, with the person accountable and a date. One row per control
        per agent — controls that are in place, or genuinely not applicable, raise no task.
      </PageHeading>

      <Panel className="mb-4 grid items-center gap-3.5 p-4.5 md:grid-cols-4">
        <Stat label="Open tasks" value={all.length} colour="var(--color-ink)" note="across ASI01 only" />
        <Stat label="High priority" value={counts.high} colour={BAND_COLOR.red} note="due within six weeks" />
        <Stat label="Blocked" value={counts.blocked} colour={BAND_COLOR.amber} note="waiting on a decision" />
        <Stat label="People accountable" value={counts.owners} colour="var(--color-accent)" note="named agent managers" />
      </Panel>

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        {([ALL, "high", "medium", "low"] as const).map((p) => (
          <Chip key={p} selected={priority === p} onClick={() => setPriority(p)}>
            {p === ALL ? "Any priority" : p.charAt(0).toUpperCase() + p.slice(1)}
          </Chip>
        ))}
        <span className="w-2" />
        {([ALL, "open", "in-progress", "blocked"] as const).map((s) => (
          <Chip key={s} selected={state === s} onClick={() => setState(s)}>
            {s === ALL ? "Any state" : STATE_LABEL[s]}
          </Chip>
        ))}
        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          aria-label="Filter by person accountable"
          className={selectClass}
        >
          {assignees.map((a) => (
            <option key={a} value={a}>{a === ALL ? "Anyone accountable" : a}</option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search agent, control or team…"
          aria-label="Search tasks"
          className={`${selectClass} min-w-[220px]`}
        />
      </div>

      {visible.length === 0 ? (
        <p className="p-5 text-(--color-dim)">No tasks match those filters.</p>
      ) : (
        <Panel className="overflow-hidden p-0">
          <div className="hidden grid-cols-[minmax(0,1fr)_150px_128px_112px_88px] gap-3.5 border-b border-(--color-line) bg-(--color-panel-2) px-3.5 py-2.5 font-mono text-[10px] font-bold tracking-[0.1em] text-(--color-dim) uppercase lg:grid">
            <span>Task</span>
            <span>Accountable</span>
            <span>Due</span>
            <span>Effort</span>
            <span>Priority</span>
          </div>
          {visible.map((t) => (
            <TaskRow key={t.id} task={t} onOpenAgent={() => openAgent(t.agentId)} />
          ))}
        </Panel>
      )}

      <p className="mt-4 max-w-[820px] text-[13px] text-(--color-dim)">
        Dates and states are demonstration data. Whether these become real assignable items here,
        or hand off to your existing ticketing system, is still an open decision.
      </p>
    </div>
  );
}
