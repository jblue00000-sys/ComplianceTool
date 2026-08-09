# Operational learnings

Operational facts about this environment and its tooling that hold in every instance, whatever application it is building.

This file is tracked, so it travels with every clone and is printed at session start in every instance with no copying step.
Instance-specific and application-specific gotchas stay in each home's gitignored `data/learnings.md`, which extends this file and never restates it.
[`docs/configuration.md`](../docs/configuration.md) owns what belongs here versus locally, and how an improvement reaches another instance.
Keep it curated the same way a local learnings file is kept: dated, evidence-backed, rewritten and pruned rather than appended to forever.

## Credit runway

- `quota-axi --json` reports three distinct Claude windows: a **5-hour session** window, a **7-day account** window, and **per-model weekly** windows.
  Read it before starting any validation run and before dispatching parallel lanes.
- **The 5-hour session window is the operational constraint, not the weekly one.**
  Observed 2026-08-08: the session window sat at 81% used with about 20 minutes to reset while the weekly window still had 43% left.
  A "credits are nearly out" moment is usually the session window, and it self-heals on its own reset, so park cleanly and resume rather than treating it as a hard stop.
- `pace.status` and `projectedExhaustedAt` give an earlier warning than the raw percentage does.
- A cheaper model burns its own weekly window fast: Fable 5 was 90% used by 2026-08-08.
  That is one more reason the validation-pipeline model pin matters - it stops consumption nobody chose.
- `quota-axi` needs `--allow-keychain-prompt` once, run by the captain, before it returns real numbers.

## no-mistakes pipeline

- **2026-08-05 - a run can strand a branch in `pipeline_owned` state that no documented recovery clears.**
  Symptom: `axi sync --recover` repeatedly returns `blocked_recover_gate_diverged` because the run record's `current_head` disagrees with the daemon's actual gate-branch storage.
  The root cause in that case was the review step's internal agent dying mid-fix on a transient `API Error: Connection closed mid-response`.
  `axi abort`, `axi sync --recover`, and `--recover --keep-local` all failed to clear it.
  **Working fix, with no daemon restart:** create a new branch name from the same clean HEAD (`git checkout -b <branch>-2`) and start a fresh run there.
  The stuck record is keyed to the old branch name, so the new branch gets a clean run.
  This matters because the daemon is shared: restarting it would kill every other lane's in-flight run.
- **2026-08-07 - `axi run` publishes HEAD to the gate mirror at run start, even when the run is aborted before its push step.**
  Consequence: rebasing a branch after an aborted run leaves the gate ref divergent, and the next `axi run` on that branch fails non-fast-forward with `axi sync` refusing (`blocked_wrong_branch`, no push binding).
  Rule: on a given branch name, rebase before the first `axi run`.
  The pipeline has its own rebase step, so a post-abort manual rebase is never needed.
  If already bitten, the fix is the same as above: a new branch name from the clean HEAD, and never a hand-edit of the shared gate repository's refs.
- Heavy parallel dispatch causes repeated rebase conflict rounds against a fast-moving default branch.
  That is expected and the pipeline resolves it, but it makes every run much slower, so consider serializing when several tasks touch the same evidence or documentation files.
- A project with no CI checks configured leaves the pipeline's CI-monitor step with nothing to observe, so it idles until the PR is merged or closed.
  A run sitting in `ci` for hours on such a project is expected rather than a stall: confirm the repository reports no configured checks and that the branch is mergeable, then merge.

## Claude Code crewmates

- **Session and usage limits are hit frequently.**
  A crewmate parks at a `/rate-limit-options` menu and looks wedged.
  Recovery: `bin/fm-send.sh <task> --key Escape` to dismiss, then a text nudge, because dismissing alone often leaves the pane idle rather than auto-resuming.
  Check the `Credits: %` line in the pane footer to confirm the limit actually reset before nudging.
- Long foreground polling loops inside a crewmate make its pane look identical across checks and trigger repeated stale or wedge escalations.
  Confirm real progress from `no-mistakes axi status` - `active_steps` showing a live `agent_pid` and an advancing `active_for` - rather than from the pane alone.
- On the herdr backend the watcher fails often with "cycle ended without an actionable reason"; re-arm it with `bin/fm-watch-arm.sh` as its own background task.
  That is routine on that backend, not a sign of a deeper problem.

## Worktrees and running services

- **A disposable task worktree does not inherit the persistent clone's untracked secrets.**
  Environment files must be present in both the persistent clone, for the services that run there, and in each task worktree that needs live verification.
  A crewmate hitting a missing token in a fresh worktree is expected, not a bug.
- A failed background restart of a local service can silently leave the old process bound to its port (`[Errno 48] address already in use`), so it keeps serving stale environment variables.
  Free the port explicitly before restarting rather than assuming the restart replaced the process.

## Credit and token efficiency

Observed burn drivers, in order (captain-directed review, 2026-08-06):

1. session-limit deaths mid-validation, forcing reruns that repeat review and tests at full price - the largest pure waste;
2. 1M-context workers carrying 200k-plus sessions, re-billed uncached after every limit pause;
3. too many parallel lanes draining one shared limit window, causing more mid-run deaths, so the parallelism defeats itself;
4. maximum reasoning effort on tasks that did not need it.

Standing mitigations: cap concurrent no-mistakes validations at about two and queue the rest; tear down promptly after a merge; read the session window before dispatching a wave.
Model and effort are deliberately **not** cost levers here - [`captain-principles.md`](captain-principles.md) owns that decision, and its cheaper-tier veto outranks driver 4 above.
