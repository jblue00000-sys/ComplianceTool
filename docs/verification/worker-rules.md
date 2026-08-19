# Verification: standing worker rules by reference

Maintainer-verification record for the contract in [architecture.md](../architecture.md#the-standing-worker-rules-live-in-one-tracked-file): tracked [`worker-rules.md`](../../worker-rules.md) holds the standing crewmate rules once, `bin/fm-brief.sh` scaffolds only the task-specific half, and `bin/fm-spawn.sh` renders the declared variant and joins it to the brief in the launch prompt.

Verified 2026-08-16 on Darwin 24.2.0 (arm64), tmux 3.7b, Claude Code v2.1.233, bash 3.2.57 and 5.x.

## The composed launch prompt is byte-identical to the brief the previous scaffold wrote

This is the guarantee that makes the change a pure relocation: what a worker is handed did not change, only where it is stored.
Regression coverage lives in `tests/fm-brief.test.sh` (every rule assertion now runs against the composed prompt) and `tests/fm-spawn-launch-prompt.test.sh` (the spawn writes it and launches from it).

Comparing each variant's composed prompt against the same variant scaffolded by the pre-change `bin/fm-brief.sh`:

| variant | brief before | brief after | composed prompt | identical to before |
| --- | --- | --- | --- | --- |
| ship `no-mistakes` | 8555 | 206 | 8555 | yes |
| ship `no-mistakes` `--herdr-lab` | 10221 | 205 | 10221 | yes |
| ship `direct-PR` | 6655 | 204 | 6655 | yes |
| ship `direct-PR` `--herdr-lab` | 8321 | 203 | 8321 | yes |
| ship `local-only` | 6884 | 205 | 6884 | yes |
| ship `local-only` `--herdr-lab` | 8555 | 204 | 8555 | yes |
| scout | 3813 | 196 | 3813 | yes |
| scout `--herdr-lab` | 5473 | 195 | 5473 | yes |
| secondmate charter | 5451 | 5451 | n/a | yes (unchanged path) |

Bytes are for the scaffold with its `{TASK}` placeholder still in place, so the difference is exactly the standing text that is no longer copied: 8349 bytes per `no-mistakes` ship brief.
A secondmate charter is a one-per-domain persistent document rather than a per-task scaffold, so it is still written whole and is byte-for-byte unchanged.

Each composed prompt carries its own delivery contract and none of the other two, and a scout prompt carries no ship delivery contract at all:

```
$ bash tests/fm-brief.test.sh
ok - fm-brief.sh: the standing rules are declared by reference, not copied into the brief
ok - fm-brief.sh: each composed prompt carries exactly its own variant
ok - fm-brief.sh: a missing, unterminated, or incomplete rules file refuses the scaffold
ok - fm-brief.sh: a brief with no rules declaration is left exactly as it is
```

## A real worker receives the rules and acts on them

Harness-dependent, so proven end to end against the real harness rather than a stub.
A `local-only` ship brief was scaffolded, `bin/fm-spawn.sh` composed its launch prompt, and the literal launch command firstmate sends was run against Claude Code v2.1.233 in a real linked git worktree, on a private tmux server so the fleet was untouched:

```
CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION=false claude --dangerously-skip-permissions \
  "$('.../bin/fm-operational-input.sh' encode launch-brief < '.../state/live-isolation-demo.launch-prompt.md')"
```

The worker's first action was the isolation assertion the rules carry - the safety fact a skippable pointer would have put at risk:

```
⏺ I'll verify isolation first.
⏺ Bash(pwd -P; git rev-parse --show-toplevel)
  ⎿  /private/tmp/.../scratchpad/live/demo-wt
     /private/tmp/.../scratchpad/live/demo-wt
⏺ Isolated worktree confirmed.
⏺ Bash(git checkout -b fm/live-isolation-demo && ls)
  ⎿  Switched to a new branch 'fm/live-isolation-demo'
```

It then completed the task and reported through the exact status contract in those rules, on the `local-only` definition of done:

```
$ cat .../state/live-isolation-demo.status
done: ready in branch fm/live-isolation-demo
$ git -C demo-wt log --oneline -1
c5d6043 Add NOTES.md with composed prompt line
```

Refresh this by scaffolding a brief, running `bin/fm-spawn.sh` for it, and launching the recorded command against the installed harness; re-run it after any harness upgrade that changes how a positional prompt is accepted.

## The quality bar still reaches the reviewing agent

`bin/fm-worker-rules-lib.sh` is now the single reader of the fenced `<!-- quality-bar:start -->` block in `doctrine/captain-principles.md`, and both the scaffold and the spawn refuse when it is missing or unterminated.
The bar is rendered into the composed prompt's `# Quality bar` section, and the `no-mistakes` definition of done still requires it to be copied verbatim into `--intent`, which is the only thing the reviewing agent sees.

```
$ bash tests/fm-brief.test.sh
ok - fm-brief.sh: ship briefs copy the doctrine quality bar and route it to the reviewer
$ bash tests/fm-spawn-launch-prompt.test.sh
ok - fm-spawn.sh: the worker is launched with the composed rules-plus-task prompt
```

That test edits fixture doctrine between scaffolds and asserts the new bar reaches the next prompt while the superseded one does not, so the bar is proven copied rather than restated; it also asserts the unterminated-fence and missing-block refusals and that a scout scaffold is unaffected.

## The launch ceiling, measured

The composed prompt reaches the harness as one argv element that the pane shell builds by reading the file, so the binding limit is the kernel's argument cap.
The brief text does not travel through the backend transport: `bin/fm-spawn.sh` sends only the short launch command, which names the prompt file.

Largest prompt that launched, and the first that failed, bisected through a real tmux pane running the real launch shape with `/bin/echo` in place of a harness:

```
pane env bytes: 1848
getconf ARG_MAX: 1048576
largest brief that launched: 1046265 ; first that failed: 1046554
  (failure: `zsh: argument list too long: /bin/echo`)
```

Separately, the tmux transport caps anything firstmate sends literally, which bounds steers and the Kimi brief pointer rather than the prompt:

```
tmux 3.7b
tmux send-keys -l: largest accepted literal = 16331 bytes; first refused = 16332 bytes
  (refusal: `failed to send command`)
```

`FM_LAUNCH_PROMPT_MAX` therefore defaults to 131072 rather than the ~1.04 MB measured here, because Linux caps a single argument at `MAX_ARG_STRLEN` (131072) regardless of `ARG_MAX` and that is the smallest ceiling across supported platforms.
A composed prompt is normally under 15 KB, so the refusal only catches a runaway brief, and it names the fix instead of letting the launch die in the pane and leave a bare shell that still looks busy:

```
$ bash tests/fm-spawn-launch-prompt.test.sh
ok - fm-spawn.sh: an over-long launch prompt is refused by name before anything is created
```

That test also asserts the refusal happens before any endpoint exists: no task metadata is recorded and no launch command is sent.

## Compatibility

- Briefs written before this contract carry no `<!-- worker-rules: ... -->` declaration, already contain their whole rule set, and are launched directly from their own file with nothing composed (`tests/fm-spawn-launch-prompt.test.sh`, `tests/fm-brief.test.sh`).
  No `data/*/brief.md` is rewritten.
  One narrowing of that compatibility was authorized by the captain during review: a declaration-less brief carrying neither an anchored `# Rules` heading nor an anchored `# Definition of done` heading is treated as damaged and refused by name, because launching it would hand the worker no isolation assertion, no "never push to the default branch", and no status protocol.
  Every declaration-less brief carrying either heading still launches unchanged, as does every secondmate charter, and the composition section of `docs/architecture.md` owns the statement of that condition.
- `bin/fm-promote.sh` turns a scout task into a ship task by rewriting its metadata rather than its brief, so a relaunch after promotion spawns a scout-scaffolded brief as a ship.
  The declaration's kind is deliberately not cross-checked against the spawn's kind, so that relaunch still succeeds on the rules the brief declares, exactly as it did when the brief carried them inline (`tests/fm-spawn-launch-prompt.test.sh`).
- Runtime backends are unaffected: composition happens on firstmate's side and every backend receives the same short launch command it received before, with one path substituted.
  `tests/fm-spawn-dispatch-profile.test.sh`, `tests/fm-spawn-batch.test.sh`, `tests/fm-spawn-worktree-settle.test.sh`, and `tests/fm-trace-context-spawn.test.sh` pass unchanged.
- Harnesses are unaffected for the same reason, with one deliberate exception: Kimi is handed an absolute brief pointer instead of a positional prompt, and that pointer now names the composed prompt so a Kimi crewmate reads the rules too.
