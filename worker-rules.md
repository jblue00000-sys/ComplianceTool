You are reading firstmate's standing crewmate rules.

This file is the single owner of the text that used to be copied into every scaffolded brief.
`bin/fm-brief.sh` writes only the task-specific half of a brief and records which variant applies.
`bin/fm-spawn.sh` renders the matching variant from this file and joins it to that brief, so the launched worker receives one document with these rules in it.
Nothing here reaches a worker by a pointer it could decline to follow.

`bin/fm-worker-rules-lib.sh` owns extraction, the `{{TOKEN}}` substitutions, and the exact block names required for each variant.
Change what these rules SAY only with the same care as any other shared contract; the standing quality bar is not owned here at all, it is copied from tracked `doctrine/captain-principles.md` into `{{QUALITY_BAR}}`.

Every block below is delimited by its own start and end fence.
A fence that opens without closing, or a block a variant needs that is missing, is a hard error rather than a silently shortened rule set.

## Ship

<!-- rules:ship:start -->
# Quality bar
The captain's standing bar for every change, applying on top of the task above.

{{QUALITY_BAR}}

Do not report done until you can answer every question above yes, or until your done line states plainly which one you could not and why.

{{HERDR_SECTION}}

# Setup
You are in a disposable git worktree of {{REPO}}, at a detached HEAD on a clean default branch.

**Verify isolation before anything else.** Run `pwd -P` and `git rev-parse --show-toplevel`; both must resolve to the disposable task worktree you were launched in, such as a treehouse pool path or an Orca-managed worktree, not the primary checkout firstmate operates from.
The path check is authoritative: `git rev-parse --git-dir` and `git rev-parse --git-common-dir` can help inspect the repo, but they do not prove you are outside the primary checkout.
If the top-level path is the primary checkout or not the worktree you were launched in, STOP - do not branch or commit here - append `blocked: launched in primary checkout, not an isolated worktree` to the status file and stop.

1. First action: create your branch: `git checkout -b fm/{{ID}}`{{SETUP2}}

# Rules
{{RULE1}}
2. Stay inside this worktree; modify nothing outside it.
3. Use gh-axi for GitHub operations and chrome-devtools-axi for browser operations.
4. Report status by appending one line:
   `echo "{state}: {one short line}" >> {{STATUS_FILE}}`
   States: working, needs-decision, blocked, {{PAUSED_VERB}}, done, failed.
   Each append wakes firstmate, so report sparingly: only phase changes a supervisor
   would act on (setup done, bug reproduced, fix implemented, validation passed) and the
   needs-decision/blocked/paused/done/failed states. No step-by-step FYI progress lines;
   firstmate reads your pane for that.
   A mid-task `working:` line (including setup complete) is nonterminal: do not end the
   turn after it; continue the same stage until a defined `done:` gate under Definition of done.
   Use `{{PAUSED_VERB}}: {why}` - distinct from `blocked:` - ONLY when you are deliberately idling on a
   known external wait you expect to clear on its own (an upstream release, a rate-limit reset,
   a scheduled window): firstmate then leaves your idle pane alone and rechecks it on a long
   cadence instead of treating it as a possible wedge. Use `blocked:` when you are stuck and need help.
5. If you hit the same obstacle twice, append `blocked: {why}` and stop; firstmate will help.
6. If a decision belongs above the implementation worker (product choices, destructive actions, ask-user findings),
   append `needs-decision: {summary of options}` and stop. Firstmate will apply the configured authority and reply with the decision.
   A decision or blocker you opened stays open until a `resolved` line carrying its exact key lands; a later `done:` or `working:` line never closes it, even when the answer is what started that work.
   Firstmate's reply normally writes that closing line at answer time; when a blocker or wait clears WITHOUT a firstmate reply, append `resolved: {how it cleared}` yourself (same `[key=<slug>]` if you opened it with one) as you resume.
7. Never stop, restart, or update the shared `no-mistakes` daemon - it is one instance serving
   every lane/home, so restarting it kills other lanes' in-flight pipeline runs. On ANY no-mistakes
   daemon error, append `blocked: {the daemon error}` and stop; only firstmate manages the daemon.

# Project memory
If `AGENTS.md` or `CLAUDE.md` already exists, or if this task produced durable project-intrinsic knowledge, run `{{FM_ROOT}}/bin/fm-ensure-agents-md.sh .` in the worktree.
Record only project knowledge useful to almost every future session.
For anything the codebase already shows, prefer a pointer to the authoritative file, command, or doc over copying the detail.
If you touch a project `AGENTS.md` that lacks `## Maintaining this file`, add that short self-governance section from `{{FM_ROOT}}/bin/fm-ensure-agents-md.sh` in the same pass.
Keep it proportionate: skip `AGENTS.md` edits for trivial tasks that produced no durable project knowledge.

{{DOD}}
<!-- rules:ship:end -->

### Ship setup step

Only `no-mistakes` adds a second setup step; the other two modes deliberately add none, so their blocks are empty.

<!-- rules:ship-setup2-no-mistakes:start -->

2. Run `no-mistakes doctor`; if it reports the repo is not initialized here, run `no-mistakes init`.
<!-- rules:ship-setup2-no-mistakes:end -->

<!-- rules:ship-setup2-direct-PR:start -->
<!-- rules:ship-setup2-direct-PR:end -->

<!-- rules:ship-setup2-local-only:start -->
<!-- rules:ship-setup2-local-only:end -->

### Ship rule 1

<!-- rules:ship-rule1-no-mistakes:start -->
1. Never push to the default branch. Never merge a PR.
<!-- rules:ship-rule1-no-mistakes:end -->

<!-- rules:ship-rule1-direct-PR:start -->
1. Never push to the default branch (push only your `fm/{{ID}}` branch). Never merge a PR.
<!-- rules:ship-rule1-direct-PR:end -->

<!-- rules:ship-rule1-local-only:start -->
1. Never push to any remote and never open a PR. Work only on your `fm/{{ID}}` branch; firstmate handles the merge into local `main`.
<!-- rules:ship-rule1-local-only:end -->

### Ship definition of done

Each block opens with the fixed `Delivery contract: mode=<mode>` line that `bin/fm-spawn.sh` checks a ship spawn against.

<!-- rules:ship-dod-no-mistakes:start -->
# Definition of done
Delivery contract: mode=no-mistakes
The task is complete only when committed on your branch.
When you believe it is complete, append `done: {summary}` to the status file and stop.
Firstmate will then instruct you to run /no-mistakes to validate and ship a PR.

You drive no-mistakes by responding to its gates, not by implementing fixes.
Follow the guidance no-mistakes itself provides for the mechanics: it loads when you invoke /no-mistakes, and `no-mistakes axi run --help` plus the `help` lines in each `axi` response are authoritative and version-matched to the installed binary.
When starting no-mistakes, make `--intent` preserve all relevant content from this brief's `# Task` section plus every later accepted Firstmate requirement, clarification, constraint, exclusion, and supersession, carrying only each requirement's current accepted form; retain direct requirements instead of substituting a diff summary, and exclude generic operational, status, delivery, and other scaffold boilerplate unless it is task-specific.
Then end that `--intent` with this brief's `# Quality bar` block copied verbatim, introduced by the line `Required checklist: answer each numbered question yes or no about the finished change and record every no as a required finding.`
The reviewing agent never sees this brief and treats `--intent` as authoritative acceptance criteria, so a bar left out of `--intent` is a bar nobody checks.
Do not hand-edit, commit, or fix findings yourself while a run is active - the pipeline applies every fix.

Two firstmate-specific rules layer on top of that guidance:
- ask-user findings are never yours to answer: escalate to firstmate (rule 6) and stop.
  Firstmate applies the authority contract in its `AGENTS.md` and obtains any required captain decision.
  When the decision comes back, feed it to the gate with `no-mistakes axi respond` and let the pipeline apply it - do not route the question to "the user" or implement the fix yourself.
- Avoid `--yes`: it would silently bypass firstmate's authority check and any required captain escalation.

After /no-mistakes reports CI green (the CI-ready return point - do not wait for it to keep monitoring in the background until merge), append `done: PR {url} checks green` and stop. You are finished.
<!-- rules:ship-dod-no-mistakes:end -->

<!-- rules:ship-dod-direct-PR:start -->
# Definition of done
Delivery contract: mode=direct-PR
This task ships **direct-PR**: you raise the PR yourself, without the no-mistakes pipeline.
The task is complete only when committed on your branch.
When it is implemented and committed, push your branch and open a PR with `gh-axi`, then append `done: PR {url}` to the status file and stop.
Do NOT run /no-mistakes. The configured merge authority decides whether to merge the PR; firstmate relays the outcome.
<!-- rules:ship-dod-direct-PR:end -->

<!-- rules:ship-dod-local-only:start -->
# Definition of done
Delivery contract: mode=local-only
This task ships **local-only**: no remote, no PR, no pipeline.
The task is complete only when committed on your branch `fm/{{ID}}`. Do NOT push, do NOT open a PR, do NOT merge.
Keep your branch a clean fast-forward onto the current default branch - if `main` has advanced, rebase onto it so the eventual merge stays a fast-forward.
When it is implemented and committed, append `done: ready in branch fm/{{ID}}` to the status file and stop.
The configured merge authority approves the ready branch, then firstmate merges it into local `main` through the guarded fast-forward path.
<!-- rules:ship-dod-local-only:end -->

## Scout

<!-- rules:scout:start -->
{{HERDR_SECTION}}

# Setup
You are in a disposable git worktree of {{REPO}}, at a detached HEAD on a clean default branch.
This is a SCOUT task: the deliverable is a written report, not a PR.
The worktree is your laboratory - install, run, edit, and make scratch commits freely; all of it is discarded at teardown.
The report is the only thing that survives, so anything worth keeping must be in it.

# Rules
1. Never push to any remote and never open a PR.
2. Stay inside this worktree; the only files you may write outside it are the report and the status file below.
3. Use gh-axi for GitHub operations and chrome-devtools-axi for browser operations.
4. Report status by appending one line:
   `echo "{state}: {one short line}" >> {{STATUS_FILE}}`
   States: working, needs-decision, blocked, {{PAUSED_VERB}}, done, failed.
   Each append wakes firstmate, so report sparingly: only phase changes a supervisor
   would act on and the needs-decision/blocked/paused/done/failed states. No step-by-step
   FYI progress lines; firstmate reads your pane for that.
   Use `{{PAUSED_VERB}}: {why}` - distinct from `blocked:` - ONLY when you are deliberately idling on a
   known external wait you expect to clear on its own (an upstream release, a rate-limit reset):
   firstmate then leaves your idle pane alone and rechecks it on a long cadence instead of
   treating it as a possible wedge. Use `blocked:` when you are stuck and need help.
5. If you hit the same obstacle twice, append `blocked: {why}` and stop; firstmate will help.
6. If a decision belongs to a human (product choices, destructive actions),
   append `needs-decision: {summary of options}` and stop. Firstmate will reply with the decision.
   A decision or blocker you opened stays open until a `resolved` line carrying its exact key lands; a later `done:` or `working:` line never closes it, even when the answer is what started that work.
   Firstmate's reply normally writes that closing line at answer time; when a blocker or wait clears WITHOUT a firstmate reply, append `resolved: {how it cleared}` yourself (same `[key=<slug>]` if you opened it with one) as you resume.
7. Never stop, restart, or update the shared `no-mistakes` daemon - it is one instance serving
   every lane/home, so restarting it kills other lanes' in-flight pipeline runs. On ANY no-mistakes
   daemon error, append `blocked: {the daemon error}` and stop; only firstmate manages the daemon.

# Definition of done
Write your findings to `{{DATA}}/{{ID}}/report.md`.
The report must stand alone: what you did, what you found, the evidence (commands run, output, file:line references), and what you recommend.
Before reporting done, read and follow `{{FM_ROOT}}/.agents/skills/decision-hold-lifecycle/SKILL.md` and pass its shared completion gate for the report and any visual review.
When the report is complete, append `done: {one-line conclusion}` to the status file and stop.
If your findings reveal work that should ship (e.g. you reproduced a bug and the fix is clear), say so in the report; firstmate may promote this task in place, and you would then receive mode-specific ship instructions as a follow-up message.
<!-- rules:scout:end -->

## Herdr

`--herdr-lab` selects the isolation contract; every other brief carries the declaration that the contract was deliberately not enabled.

<!-- rules:herdr-lab:start -->
# Herdr isolation - HARD SAFETY CONTRACT
This brief was explicitly scaffolded with `--herdr-lab` because the task will drive Herdr lifecycle behavior.
On Herdr 0.7.3 the API socket is not relocatable by `HERDR_CONFIG_PATH`, `XDG_CONFIG_HOME`, or `HOME`.
A named non-`default` session plus a trailing `--session <name>` on every call is the only viable local isolation.

1. Set `HERDR_LAB_HELPER={{HERDR_LAB_HELPER}}` and generate the session name with `HERDR_LAB_SESSION=$("$HERDR_LAB_HELPER" name {{ID}})`.
   Install `trap '"$HERDR_LAB_HELPER" teardown "$HERDR_LAB_SESSION"' EXIT` before provisioning, then provision only with `"$HERDR_LAB_HELPER" provision "$HERDR_LAB_SESSION"`.
2. Run every task-specific non-lifecycle Herdr command through `"$HERDR_LAB_HELPER" run "$HERDR_LAB_SESSION" <arguments...>`.
   The helper appends the required trailing `--session "$HERDR_LAB_SESSION"`; `HERDR_SESSION` alone is never accepted as isolation.
3. Teardown only through `"$HERDR_LAB_HELPER" teardown "$HERDR_LAB_SESSION"`.
   It re-checks refuse-default immediately before stop and again immediately before delete, and fails closed on ambiguity.
4. If an experiment requires a deliberate mid-run session stop, use only `"$HERDR_LAB_HELPER" stop "$HERDR_LAB_SESSION"`; it performs the same immediate refuse-default check.
5. Forbidden commands: direct `herdr server stop`, every other server-global operation such as `herdr server live-handoff` or reload/update operations, direct `herdr session stop`, direct `herdr session delete`, and any Herdr call scoped only by ambient or inline `HERDR_SESSION`.
6. The helper records the live default session before provisioning and verifies the identical fleet state after teardown.
   A missing, stopped, or changed default session is a hard tripwire failure, never a cleanup warning to ignore.

Never bypass the helper, even for a read-only lifecycle probe or cleanup after failure.
The captain fleet uses the running `default` session.
<!-- rules:herdr-lab:end -->

<!-- rules:herdr-declaration:start -->
# Herdr lifecycle declaration - NOT ENABLED
**HARD SAFETY GATE:** this scaffold cannot inspect the task text that replaces `{TASK}` later.
If the task will start, stop, delete, restart, profile, or otherwise drive Herdr lifecycle behavior, stop and regenerate the brief with `--herdr-lab` before dispatch.
Do not add Herdr lifecycle commands to this unguarded brief by hand.
<!-- rules:herdr-declaration:end -->
