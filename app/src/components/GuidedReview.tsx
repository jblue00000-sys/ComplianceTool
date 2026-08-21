"use client";

import { useMemo, useState } from "react";
import { AGENTS } from "@/lib/data";
import { actsUnsupervised, hasIrreversibleReach } from "@/lib/scoring";
import { useShell } from "./AppShell";
import { BAND_COLOR, Gauge, PageHeading } from "./ui";

interface Option {
  label: string;
  /** Points this answer contributes. The best answer defines the question's maximum. */
  weight: number;
}

interface Question {
  label: string;
  text: string;
  options: readonly Option[];
  /** Shown under every question. It is the trust device, not decoration. */
  why: string;
}

const QUESTIONS: readonly Question[] = [
  {
    label: "Understanding · Procurement Assistant",
    text: "When this assistant places an order, does a person see and approve it first?",
    options: [
      { label: "Always — a person approves every order", weight: 30 },
      { label: "Only above a value threshold", weight: 12 },
      { label: "No, it acts on its own", weight: 0 },
      { label: "I'm not certain — help me find out", weight: 4 },
    ],
    why: "Orders that execute with no human check are where hijacked instructions do real damage. This is OWASP's first and ninth risk.",
  },
  {
    label: "Access · credentials",
    text: "Does this assistant have its own login, or does it use a person's?",
    options: [
      { label: "Its own account, narrow permissions", weight: 25 },
      { label: "Its own account, but broad permissions", weight: 12 },
      { label: "It uses a team member's login", weight: 0 },
      { label: "Not sure", weight: 3 },
    ],
    why: "A borrowed login means one compromise inherits everything that person can do, and the audit trail points at the wrong human. OWASP calls this identity and privilege abuse.",
  },
  {
    label: "Inputs · untrusted content",
    text: "Does it read documents, emails or web pages sent in from outside?",
    options: [
      { label: "No external content at all", weight: 20 },
      { label: "Yes, but content is kept separate from its instructions", weight: 15 },
      { label: "Yes, everything goes into the same prompt", weight: 0 },
      { label: "Not sure", weight: 3 },
    ],
    why: "This is the most exploited path in the wild — hidden text in an ordinary-looking supplier PDF becomes an instruction the assistant obeys.",
  },
  {
    label: "Memory · what it retains",
    text: "Does it remember things between conversations?",
    options: [
      { label: "No memory at all", weight: 15 },
      { label: "Yes, but writes are checked and it can be inspected", weight: 12 },
      { label: "Yes, it remembers freely", weight: 0 },
      { label: "Not sure", weight: 2 },
    ],
    why: "False facts planted in memory keep steering behaviour weeks later, in conversations that look completely unrelated.",
  },
  {
    label: "Lifecycle · ownership",
    text: "Who owns it, and when does its access expire?",
    options: [
      { label: "A named owner and a set expiry date", weight: 20 },
      { label: "A named owner, no expiry", weight: 8 },
      { label: "No clear owner", weight: 0 },
      { label: "Not sure", weight: 2 },
    ],
    why: "Agents without an owner or an end date are how a retired workflow keeps its production credentials for two years.",
  },
  {
    label: "Response · when it goes wrong",
    text: "Could you stop it inside five minutes if it started behaving badly?",
    options: [
      { label: "Yes, and we have tested it", weight: 20 },
      { label: "Probably, but never tested", weight: 9 },
      { label: "No, we'd have to work it out", weight: 0 },
      { label: "Not sure", weight: 2 },
    ],
    why: "A kill switch nobody has tested is not a kill switch. This is the last line of defence against a rogue agent.",
  },
];

type Answers = ReadonlyArray<number | null>;

const EMPTY: Answers = QUESTIONS.map(() => null);

interface Recommendation {
  when: string;
  title: string;
  detail: string;
}

/**
 * Which fixes to surface, given what the reviewer told us. Ordered by impact,
 * capped at three so the page ends with a decision rather than a backlog.
 */
function recommendationsFor(answers: Answers): Recommendation[] {
  const out: Recommendation[] = [];
  if (answers[0] === 2 || answers[0] === 3) {
    out.push({
      when: "Do this first",
      title: "Add a human approval step to ordering",
      detail: "Removes the highest-impact path an attacker has into your spend.",
    });
  }
  if (answers[1] === 1 || answers[1] === 2) {
    out.push({
      when: "Then",
      title: "Give it its own narrow login",
      detail:
        "Stops one compromise inheriting a person's full access, and fixes your audit trail.",
    });
  }
  if (answers[2] === 2) {
    out.push({
      when: "Then",
      title: "Separate incoming documents from instructions",
      detail: "Closes the most exploited attack path currently seen in the wild.",
    });
  }
  if (answers[4] === 1 || answers[4] === 2) {
    out.push({
      when: "Later",
      title: "Set an owner and an expiry date",
      detail: "Stops retired workflows keeping live credentials indefinitely.",
    });
  }
  if (answers[5] !== 0) {
    out.push({
      when: "Later",
      title: "Test that you can stop it in five minutes",
      detail: "An untested kill switch is not a control.",
    });
  }
  if (answers[3] === 2) {
    out.push({
      when: "Later",
      title: "Make its memory inspectable",
      detail: "Lets you see and remove anything planted in it.",
    });
  }
  return out.slice(0, 3);
}

function GhostButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-[10px] border border-(--color-line-2) px-5 py-2.5 text-[13.5px] font-semibold text-(--color-mute) transition hover:border-(--color-accent) hover:text-(--color-ink) disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-[10px] bg-(--color-accent) px-5 py-2.5 text-[13.5px] font-bold text-[#06101d] disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

export function GuidedReview() {
  const { setTab } = useShell();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY);

  const maxScore = useMemo(
    () => QUESTIONS.reduce((sum, q) => sum + Math.max(...q.options.map((o) => o.weight)), 0),
    [],
  );

  const estate = useMemo(() => {
    const irreversible = AGENTS.filter(hasIrreversibleReach);
    return {
      total: AGENTS.length,
      irreversible: irreversible.length,
      unchecked: irreversible.filter(actsUnsupervised).length,
    };
  }, []);

  function choose(optionIndex: number) {
    setAnswers((prev) => prev.map((a, i) => (i === step ? optionIndex : a)));
  }

  function restart() {
    setAnswers(EMPTY);
    setStep(0);
  }

  const finished = step >= QUESTIONS.length;

  if (!finished) {
    const question = QUESTIONS[step];
    const chosen = answers[step];
    return (
      <div>
        <PageHeading kicker="Direction B · guided review" title="Guided Review">
          No dashboard, no training. One plain question at a time — and the picture builds
          itself from your answers.
        </PageHeading>

        <div className="max-w-[720px]">
          <div className="mb-5.5 flex gap-1.5">
            {QUESTIONS.map((q, i) => (
              <span
                key={q.label}
                className="h-[5px] flex-1 rounded-full"
                style={{
                  background:
                    i <= step
                      ? "linear-gradient(90deg, var(--color-accent), var(--color-accent-2))"
                      : "#1b2436",
                }}
              />
            ))}
          </div>

          <p className="font-mono text-[11px] font-bold tracking-[0.14em] text-(--color-accent) uppercase">
            {question.label} · step {step + 1} of {QUESTIONS.length}
          </p>
          <h3 className="mt-3 mb-5 text-2xl font-bold tracking-tight">{question.text}</h3>

          <div className="flex flex-col gap-2.5">
            {question.options.map((option, i) => {
              const selected = chosen === i;
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => choose(i)}
                  aria-pressed={selected}
                  className={`flex items-center gap-3 rounded-[11px] border px-4 py-3.5 text-left text-[14.5px] transition ${
                    selected
                      ? "border-(--color-accent) bg-[rgba(91,157,255,0.12)] text-(--color-ink)"
                      : "border-(--color-line) bg-(--color-panel) text-(--color-mute) hover:border-(--color-accent-2) hover:bg-(--color-panel-2) hover:text-(--color-ink)"
                  }`}
                >
                  <span
                    className={`size-4 shrink-0 rounded-full border-2 ${
                      selected
                        ? "border-(--color-accent) bg-(--color-accent) shadow-[inset_0_0_0_3px_var(--color-panel)]"
                        : "border-(--color-line-2)"
                    }`}
                  />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>

          <p className="mt-5 rounded-[11px] border border-dashed border-[#3a4a6b] bg-[rgba(127,107,255,0.07)] px-3.5 py-3 text-[13.5px] text-(--color-mute)">
            <b className="text-[#b3a5ff]">Why I&rsquo;m asking.</b> {question.why}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <GhostButton onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              Back
            </GhostButton>
            <PrimaryButton onClick={() => setStep((s) => s + 1)} disabled={chosen === null}>
              {step === QUESTIONS.length - 1 ? "See my position" : "Continue"}
            </PrimaryButton>
            <span className="font-mono text-[12.5px] text-(--color-dim)">
              no integration required
            </span>
          </div>
        </div>
      </div>
    );
  }

  const earned = answers.reduce<number>(
    (sum, choice, i) => sum + (choice === null ? 0 : QUESTIONS[i].options[choice].weight),
    0,
  );
  const pct = Math.round((earned / maxScore) * 100);
  const recommendations = recommendationsFor(answers);

  return (
    <div>
      <PageHeading kicker="Direction B · guided review" title="Guided Review">
        No dashboard, no training. One plain question at a time — and the picture builds
        itself from your answers.
      </PageHeading>

      <div className="max-w-[880px]">
        <p className="font-mono text-[11px] font-bold tracking-[0.14em] text-(--color-accent) uppercase">
          Your position, in one page
        </p>

        <div className="mt-5.5 flex flex-wrap items-center gap-4">
          <Gauge value={pct} />
          <p className="min-w-[260px] flex-1 text-[19px] leading-relaxed text-(--color-mute)">
            You have <b className="text-(--color-ink)">{estate.total} agents</b>.{" "}
            <b className="text-(--color-ink)">{estate.irreversible}</b> can take actions you
            cannot undo, and{" "}
            <b style={{ color: BAND_COLOR.red }}>{estate.unchecked}</b> of those have no human
            check at all.{" "}
            {recommendations.length > 0
              ? "Fix the first item below and your position moves toward green."
              : "Nothing urgent is outstanding — hold this position at the next review."}
          </p>
        </div>

        <div className="mt-5.5 grid gap-3 md:grid-cols-3">
          {recommendations.length > 0 ? (
            recommendations.map((r) => (
              <div
                key={r.title}
                className="rounded-xl border border-(--color-line) bg-(--color-panel) p-3.5"
              >
                <div className="font-mono text-[10px] font-bold tracking-[0.13em] text-(--color-dim) uppercase">
                  {r.when}
                </div>
                <div className="mt-2 text-[14.5px] font-semibold">{r.title}</div>
                <div className="mt-1.5 text-[12.8px] text-(--color-mute)">{r.detail}</div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-(--color-line) bg-(--color-panel) p-3.5">
              <div className="font-mono text-[10px] font-bold tracking-[0.13em] text-(--color-dim) uppercase">
                Nothing outstanding
              </div>
              <div className="mt-2 text-[14.5px] font-semibold">
                Re-confirm at the next quarterly review
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <GhostButton onClick={restart}>Start again</GhostButton>
          <PrimaryButton onClick={() => setTab("workforce")}>
            Open the full register
          </PrimaryButton>
          <GhostButton onClick={() => setTab("owasp")}>See it against OWASP</GhostButton>
        </div>
      </div>
    </div>
  );
}
