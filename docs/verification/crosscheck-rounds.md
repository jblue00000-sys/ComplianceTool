# Cross-check rounds verification

Audience: maintainer verification.

This record supports the author/challenger cross-check policy in `.agents/skills/crosscheck-rounds/SKILL.md` and its mechanics in `bin/fm-crosscheck.sh`.
It records what a round actually costs and what a challenge actually caught, because both are claims the mechanism has to keep earning.
Task chronology and delivery evidence stay in the private task report and PR evidence.

## What was run

Verified 2026-08-10, on this branch, against two real artifacts, both taken to the two-round cap.

- **Brief:** the job instructions for this task itself, cross-checked against a separately stated goal (the captain's verbatim ask plus the scope the originating investigation set).
- **Findings:** section 3 of the investigation `data/fm-harness-design-grading/report.md`, the section this task was built on, cross-checked against what that section was supposed to establish.

Each challenger was a separate agent with a fresh context, given the artifact snapshot, the goal file, and the charge printed by `bin/fm-crosscheck.sh charge`, and nothing else.
Round two resumed the same challenger against the revised artifact, so it judged whether its own objections had been answered.

The demonstration ran the challengers from inside a task worktree, where `bin/fm-subagent-pretool-check.sh` is inert by design (`fm_primary_scope_matches` returns early outside a primary home).
A firstmate primary cannot dispatch that way and must spawn the challenger as an ordinary scout crewmate through `bin/fm-spawn.sh`.
So this evidence establishes the mechanism and its cost per round; it does not exercise the primary's dispatch path, and the crewmate spawn and worktree setup a primary pays are on top of the figures below.

## Measured cost per round

Nothing in this repository instruments agent cost, so wall clock and tokens come from the agent runtime that executed each round.
One round is one agent pass, so they attribute to a round without apportionment.

| Round | Artifact | Wall clock | Tokens | Tool calls | Result |
|---|---|---|---|---|---|
| 1 | brief, 113 lines | 6 min 25 s | 91,682 | 27 | 11 objections |
| 2 | brief, revised | 3 min 36 s | 117,024 | 6 | 11 addressed, 0 outstanding, 4 new |
| 1 | findings, 71 lines, re-running the cited commands | 7 min 15 s | 95,615 | 46 | 7 objections |
| 2 | findings, revised | 3 min 46 s | 118,430 | 10 | 6 addressed, 1 outstanding, 5 new |

A full two-round cross-check therefore cost 10 min for the brief and 11 min for the findings, plus one author revision pass per round, which was a single editing pass in both cases.
Round two is faster in wall clock and cheaper in tool calls but higher in tokens, because the challenger resumes carrying its own round-one context rather than re-reading the repository.

The honest read: a cross-checked brief costs roughly a quarter of an hour of machine time before any work starts, and a cross-checked investigation slightly more.
That is small against a wrong-target task and large against a task that would itself have taken a quarter of an hour, which is why the policy is conditional rather than universal.
It is also why the skip decision belongs in the backlog note - a considered skip and a forgotten one otherwise leave identical traces.

## What the challenge actually caught

Neither first round came back clean, and both challengers cited evidence for every objection.
The catches that changed something are recorded here because "it caught something" is otherwise the author's unfalsifiable word.

**Against the findings, the challenger falsified the section's own load-bearing premise.**
The report stated that the delivery pipeline's review "runs once, at the end, on finished code" and "grades against no stated bar".
The challenger queried the pipeline's own state database and found review steps running one to five rounds, 42 of 74 running two or more, with real findings still produced in later rounds; and it read the shipped binary's prompt text, which instructs the reviewer to treat `--intent` as authoritative acceptance criteria and defines an error/warning/info merge bar.
That narrows the whole design question: a bounded critique loop with a stated bar already exists over code, and what was missing was its coverage of briefs and reports, not the loop itself.
In round two it also established that the same reviewer already files findings against tracked prose, including `AGENTS.md` and `docs/`, which is why this skill now scopes itself by what that reviewer never sees - briefs and scout reports live under `data/` and are never in a PR.

**Against the brief, the challenger found a gap in what was being built.**
Its objection O11 observed that the instructions required "the author revises" a challenged scout report, while scout completion and teardown place a report's author at the end of its life - so in practice firstmate would revise a report it had also challenged, collapsing the author/evaluator separation the mechanism exists to create.
`.agents/skills/crosscheck-rounds/SKILL.md` step 5 was changed because of that objection: for findings the scout is the author and is steered to revise its own report, which the teardown gate keeps alive long enough to do.
Round two added the requirement that the skip decision be recorded, which is also in that skill now.
Both changes are in this branch's diff.

Round two of the brief cross-check also predicted that folding the gate into the scout-completion path would refuse the challenger scout's own teardown, reintroducing the regress the exemption exists to stop.
That failure does not occur here, and the reason is worth keeping: both gates key on whether a cross-check was opened for that task, never on the task's kind, so a challenger scout - which no kind distinguishes from any other scout - passes both gates untouched.
`tests/fm-crosscheck.test.sh` pins that a task with no cross-check is never gated.

## The two terminal paths, both exercised

- The brief cross-check ended `ready` after two rounds: every objection from round one confirmed addressed, and the four new ones acted on. Recorded change: 30 lines between draft and final.
- The findings cross-check ended in `disagreement` after two rounds and was closed only with the escalation recorded, because one objection stood - whether the paper-design exclusion should be narrowed is the captain's scope call, not the author's. Recorded change: 14 lines.

Round two produced new objections in both cases, which is the complexity-inflation pressure the originating investigation warned about, and is exactly why the cap exists: there was no third round, and the unresolved objection became a captain decision instead.

## What this evidence does not show

No live round came back clean, so early termination is not demonstrated by a live challenger declining to object.
It is pinned instead by `tests/fm-crosscheck.test.sh`, where a clean first round ends the cross-check at `ready` after one of two rounds and says it stopped early.
Staging a clean round to produce the evidence would have proved nothing.
Two rounds is a ceiling, not a quota: a run whose first round is clean is a complete cross-check.

## Regression pointer

`tests/fm-crosscheck.test.sh` is the portable regression for the round cap, the clean-round exit, the disagreement path, the charge contract, and both consuming gates (`bin/fm-spawn.sh` before dispatch, `bin/fm-teardown.sh` before a scout is discarded).
Refresh this record when a round's cost changes materially, or when a later cross-check contradicts the catches above.
