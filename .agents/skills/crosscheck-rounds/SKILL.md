---
name: crosscheck-rounds
description: >-
  Agent-only policy for cross-checking a draft against a separate challenger agent before work is built on it.
  Load before dispatching a brief and before relaying or acting on an investigation's findings, and on every step of an open cross-check.
user-invocable: false
metadata:
  internal: true
---

# Cross-check rounds

This skill is the single policy owner for the author/challenger cross-check.
`bin/fm-crosscheck.sh --help` owns the commands, the ledger, and the round mechanics.

## What it is for

Author-versus-reviewer separation already exists for code, after something is built.
Nothing challenged the inputs that work is built ON, which is where being wrong is cheapest to fix and most expensive to miss.
This cross-check puts a separate agent in front of exactly two artifacts:

- **A brief**, before the task is dispatched.
- **An investigation's findings**, before they are relayed to the captain or acted on.

Nothing else.
Code is out of scope because the delivery pipeline already separates author, reviewer, and fixer there, and that reviewer also grades the tracked prose in a change.
What it never sees is a brief or a scout report: both live under `data/`, which is never in a PR.
That gap is exactly what this covers.
Paper designs are deliberately out of scope: with no artifact to test against, a challenger has no oracle, and two agents reasoning at each other produces longer documents rather than truer ones.
A challenger's own report is never itself cross-checked.

## The risk this design exists to survive

The failure mode is two agents politely agreeing and producing confident nonsense.
Mutual agreement is not evidence.
Four rules carry the whole design, and dropping any one turns it into ceremony:

1. **The challenger is a different agent and never sees the author's reasoning.**
   Dispatch it as an ordinary scout crewmate whose task text is exactly `bin/fm-crosscheck.sh charge <id>`.
   That charge names the artifact snapshot and the goal file as its only inputs and forbids reading the originating task's log, pane, or working notes.
   The point is that it can reach a *different* conclusion, not that it audits how the author reached theirs.
2. **It gets a job, not a mood.** "Review this" produces agreement.
   The charge asks concrete questions - what makes this fail, what is assumed without evidence, what would a worker misread, what will the requester ask for later - and requires every objection to cite a `file:line` or a command with its actual output.
   An objection that cites nothing is dropped; the repository is the challenger's oracle, its own reasoning is not.
3. **A clean round ends it.** A challenger that finds nothing must say so and stop.
   Do not run a second round for form's sake.
4. **Two rounds is a hard cap.** After the final round it is ready, or it is a genuine disagreement that goes to the captain.
   It never loops, and the script refuses a third round.

## Operating sequence

1. Write the draft yourself as normal: the brief under `AGENTS.md` section 11, or receive the scout's report.
2. `bin/fm-crosscheck.sh open <id> --kind brief|findings --artifact <path> --goal <what it was supposed to achieve>`.
   The goal is what the captain actually asked for, in their words where possible; it cannot be inferred, so state it.
3. Run `charge <id>`, scaffold a scout brief for a challenger task, and paste that charge text in as the task.
   Dispatch it through `bin/fm-spawn.sh` like any other scout.
4. When it reports, read its report.
   No objection, or nothing that cites evidence: `round <id> --clean`, and go to step 7 - this is the intended cheap path, not a failure.
   Otherwise `round <id> --objections <its report path>`.
5. The author revises, then `revise <id> --accepted`, or `--stands "<why one objection does not hold>"` when you are not acting on one.
   For a brief you are the author, so you revise it.
   For findings the SCOUT is the author, and it is still alive because teardown is gated on this cross-check: steer it with the objections and let it revise its own report.
   Firstmate revising a report it also challenged would make one agent author and evaluator at once, collapsing the separation the captain asked for.
   The challenger never rewrites the artifact either way.
6. Round 2 goes back to the SAME challenger with the revised artifact, so it judges whether its own objections were addressed.
   A second round of objections at the cap resolves to ready or to disagreement through `revise`; there is no third round.
7. `close <id>`, or `close <id> --escalated "<what you put to the captain>"` for a disagreement.
   Close prints and stores the draft-to-final difference.

## What to do with the outcome

Relay the outcome in the captain's terms under `AGENTS.md` section 9: what the challenge changed and what it cost, never the round mechanics.
A disagreement is a captain decision, so put the objection and the reason it stands to them before the work proceeds.
Record the difference honestly.
If the final artifact keeps coming back identical to the draft, this mechanism is spending real time to change nothing, and that is a finding about the mechanism worth reporting rather than a quiet success.

## Cost

Each round is one scout crewmate: a challenge over a brief is a short read-only pass, and a challenge over a full investigation is heavier because it re-runs the cited commands.
`docs/verification/crosscheck-rounds.md` holds the measured figures.
This is spent before any work starts, so use it where wrong-target work is expensive and skip it for work small enough that doing it is cheaper than checking it.
Record which way that judgment went in the backlog item note, the same way the delivery mode is recorded, so a considered skip is distinguishable from a forgotten one.
