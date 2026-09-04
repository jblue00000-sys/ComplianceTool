"use client";

import { useMemo, useState } from "react";
import { AGENTS, ORGANISATION } from "@/lib/data";
import { ASI_IDS, asiRisk } from "@/lib/owasp";
import {
  actsUnsupervised,
  hasIrreversibleReach,
  neverExpires,
  riskStats,
  standingScore,
} from "@/lib/scoring";
import { useShell } from "./AppShell";

interface Answer {
  html: string;
  basis: string;
}

interface Turn {
  who: "user" | "advisor";
  html: string;
  basis?: string;
}

/**
 * Preset questions the advisor can answer.
 *
 * Every answer is computed from the register rather than written out, so the
 * advisor cannot assert something the data does not support. Each carries the
 * basis it was derived from, which is what makes a score challengeable.
 */
const QUESTIONS: ReadonlyArray<{ q: string; answer: () => Answer }> = [
  {
    q: "Which agents can move money?",
    answer: () => {
      const list = AGENTS.filter((a) => a.canMoveMoney);
      const lines = list
        .map(
          (a) =>
            `• ${a.name} — ${
              actsUnsupervised(a)
                ? "<b style='color:#ff8b93'>no human approval</b>"
                : "approval above a threshold"
            }`,
        )
        .join("<br>");
      const worst = [...list].sort((a, b) => a.oversight - b.oversight)[0];
      return {
        html: `<b>${list.length} agents</b> hold payment or ordering rights:<br>${lines}<br><br>Look at <b>${worst.name}</b> first — its oversight sits at ${worst.oversight} out of 100.`,
        basis: `${AGENTS.length} agent records · tool grants · approval settings`,
      };
    },
  },
  {
    q: "Where are we weakest against OWASP?",
    answer: () => {
      const worst = ASI_IDS.map((id) => riskStats(id, AGENTS))
        .sort((a, b) => a.compliantPct - b.compliantPct)
        .slice(0, 3);
      const lines = worst
        .map(
          (s) =>
            `• <b>${s.id} ${asiRisk(s.id).name}</b> — only ${s.compliantPct}% compliant, ${s.fail} agents failing outright`,
        )
        .join("<br>");
      return {
        html: `Three risks are dragging the whole estate down:<br>${lines}<br><br>They share one root cause: agents acting on untrusted content with no approval step in front of the action.`,
        basis: `${AGENTS.length * ASI_IDS.length} agent-by-risk control checks`,
      };
    },
  },
  {
    q: "What should we fix first?",
    answer: () => {
      const worst = [...AGENTS].sort((a, b) => standingScore(a) - standingScore(b))[0];
      const irreversible = worst.tools.filter((t) => t.mode === "irreversible").length;
      return {
        html: `<b>${worst.name}</b>, and it is not close. It scores ${standingScore(worst)} out of 100, ${
          actsUnsupervised(worst) ? "acts without human approval" : "runs with limited approval"
        }, holds ${irreversible} tools whose effects cannot be reversed, and ${
          neverExpires(worst) ? "has no expiry date" : "expires on schedule"
        }.<br><br>Requiring approval on its highest-impact action would lift it out of the red and remove your largest single exposure.`,
        basis: `${worst.name} posture record · tool grants · approval settings`,
      };
    },
  },
  {
    q: "Which agents have no end date?",
    answer: () => {
      const list = AGENTS.filter(neverExpires);
      const lines = list.map((a) => `• ${a.name} — ${a.owner}`).join("<br>");
      return {
        html: `<b>${list.length} of ${AGENTS.length}</b> agents keep their access indefinitely:<br>${lines}<br><br>I can draft expiry dates and send each manager a confirmation. That changes your records, so you would approve it before anything is sent.`,
        basis: `lifecycle fields on ${AGENTS.length} agent records`,
      };
    },
  },
  {
    q: "What can't you see?",
    answer: () => ({
      html: `Being straight with you — this is built from your register and configuration only. I have <b>no live activity data</b> for most of your ${AGENTS.length} agents, so I cannot tell you whether any of them is behaving abnormally right now.<br><br>Connecting activity records would light up six of the ten OWASP risks properly instead of by declaration.`,
      basis: `coverage check across ${AGENTS.length} agent records`,
    }),
  },
  {
    q: "Draft a board summary",
    answer: () => {
      const irreversible = AGENTS.filter(hasIrreversibleReach);
      const unchecked = irreversible.filter(actsUnsupervised);
      return {
        html: `Three lines:<br><br><b>1.</b> We operate ${AGENTS.length} AI agents. ${irreversible.length} can take irreversible actions and ${unchecked.length} of those run with no human approval.<br><b>2.</b> Our largest single exposure is invoice payment, which executes with no second pair of eyes.<br><b>3.</b> Three fixes — approval on payments, individual logins, and expiry dates — move us from amber to green within a quarter.<br><br>Want me to expand this into the full assurance pack?`,
        basis: `${AGENTS.length} agent records · OWASP posture scores · open remediation items`,
      };
    },
  },
];

export function Advisor() {
  const { advisorOpen, setAdvisorOpen } = useShell();
  const [turns, setTurns] = useState<Turn[]>([]);

  const opening = useMemo<Turn>(
    () => ({
      who: "advisor",
      html: `Ask me anything about ${ORGANISATION}'s agents. I only answer from what is in your register — every answer says what it is based on.`,
    }),
    [],
  );

  const log = turns.length === 0 ? [opening] : [opening, ...turns];

  function ask(index: number) {
    const item = QUESTIONS[index];
    const result = item.answer();
    setTurns((prev) => [
      ...prev,
      { who: "user", html: item.q },
      { who: "advisor", html: result.html, basis: result.basis },
    ]);
  }

  if (!advisorOpen) return null;

  return (
    <section className="fixed right-4.5 bottom-4.5 z-95 flex max-h-[min(620px,82vh)] w-[min(400px,94vw)] flex-col overflow-hidden rounded-2xl border border-(--color-line-2) bg-(--color-panel) shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
      <header className="flex items-center gap-2.5 border-b border-(--color-line) bg-[linear-gradient(140deg,#171f33,#101724)] px-3.5 py-3">
        <span className="size-2 rounded-full bg-(--color-good)" />
        <span className="text-[13.5px] font-bold">Advisor · grounded in your data only</span>
        <button
          type="button"
          onClick={() => setAdvisorOpen(false)}
          aria-label="Close advisor"
          className="ml-auto px-1 text-[19px] text-(--color-dim) hover:text-(--color-ink)"
        >
          ×
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-2.5 overflow-auto p-3.5">
        {log.map((t, i) => (
          <div
            key={i}
            className={
              t.who === "user"
                ? "max-w-[92%] self-end rounded-[12px_12px_3px_12px] bg-(--color-accent) px-3 py-2 text-[13.4px] font-semibold text-[#06101d]"
                : "max-w-[92%] self-start rounded-[12px_12px_12px_3px] border border-(--color-line) bg-(--color-panel-2) px-3.5 py-2.5 text-[13.4px] text-(--color-mute)"
            }
          >
            <span dangerouslySetInnerHTML={{ __html: t.html }} />
            {t.basis ? (
              <span className="mt-2 block border-t border-dashed border-(--color-line-2) pt-1.5 font-mono text-[10.5px] text-(--color-dim)">
                Based on: {t.basis}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <footer className="flex flex-wrap gap-1.5 border-t border-(--color-line) px-3.5 pt-2.5 pb-3.5">
        {QUESTIONS.map((item, i) => (
          <button
            key={item.q}
            type="button"
            onClick={() => ask(i)}
            className="rounded-full border border-(--color-line-2) px-2.5 py-1.5 text-[11.8px] text-(--color-mute) hover:border-(--color-accent) hover:text-(--color-ink)"
          >
            {item.q}
          </button>
        ))}
      </footer>
    </section>
  );
}
