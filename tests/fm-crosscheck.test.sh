#!/usr/bin/env bash
# Behavior tests for the author/challenger cross-check on briefs and findings.
#
# These drive bin/fm-crosscheck.sh through its CLI, and drive the two gates that
# consume it (bin/fm-spawn.sh before dispatch, bin/fm-teardown.sh before a scout
# is discarded) with a fake tmux pane and a real isolated git worktree, so the
# refusals are proven end to end rather than assumed.
set -u

# shellcheck source=tests/lib.sh
# shellcheck disable=SC1091
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

CROSSCHECK="$ROOT/bin/fm-crosscheck.sh"
SPAWN="$ROOT/bin/fm-spawn.sh"
TEARDOWN="$ROOT/bin/fm-teardown.sh"
TMP_ROOT=$(fm_test_tmproot fm-crosscheck)

make_home() {  # <name>
  local home="$TMP_ROOT/$1"
  mkdir -p "$home/data" "$home/state" "$home/config" "$home/projects"
  printf '%s\n' "$home"
}

cc() {  # <home> <args...>
  local home=$1
  shift
  FM_ROOT_OVERRIDE="$ROOT" FM_HOME="$home" FM_DATA_OVERRIDE="$home/data" \
    "$CROSSCHECK" "$@"
}

seed_artifact() {  # <home> <id> <text>
  local home=$1 id=$2 text=$3
  mkdir -p "$home/data/$id"
  printf '%s\n' "$text" > "$home/data/$id/brief.md"
  printf '%s\n' "$home/data/$id/brief.md"
}

open_brief_crosscheck() {  # <home> <id> [artifact-text]
  local home=$1 id=$2 text=${3:-"Add a widget. Done when the widget exists."} artifact
  artifact=$(seed_artifact "$home" "$id" "$text")
  cc "$home" open "$id" --kind brief --artifact "$artifact" \
    --goal "the captain asked for a widget"
}

# A challenger that finds nothing must be able to say so and stop. Forcing the
# second round would turn the safeguard into ceremony, so the clean round is the
# exit condition and the cap is only a ceiling.
test_clean_first_round_stops_early() {
  local home id out
  home=$(make_home clean-first)
  id=cc-clean-first
  open_brief_crosscheck "$home" "$id" >/dev/null || fail "open failed"

  out=$(cc "$home" round "$id" --clean) || fail "clean round should be accepted"
  assert_contains "$out" "ready after 1 of 2 rounds" "a clean first round must end the cross-check"
  assert_contains "$out" "stopped early" "early termination must be visible, not silent"
  assert_contains "$(cc "$home" state "$id")" "ready" "a clean round leaves the cross-check ready"

  out=$(cc "$home" close "$id") || fail "close after a clean round failed"
  assert_contains "$out" "after 1 of 2 rounds" "close must report the rounds actually used"
  pass "a clean first round terminates the cross-check early"
}

# The whole value is the difference between draft and final. If that difference
# is invisible, nobody can tell whether the mechanism earned its cost.
test_second_round_records_what_the_challenge_changed() {
  local home id artifact objections out
  home=$(make_home shows-change)
  id=cc-shows-change
  artifact="$home/data/$id/brief.md"
  open_brief_crosscheck "$home" "$id" >/dev/null || fail "open failed"

  objections="$home/objections-1.md"
  cat > "$objections" <<'EOF'
O1. The definition of done is not checkable: "the widget exists" names no
observable behavior. Evidence: brief.md:1.
EOF
  out=$(cc "$home" round "$id" --objections "$objections") || fail "objection round failed"
  assert_contains "$out" "objections recorded" "objections must be recorded"
  assert_contains "$(cc "$home" state "$id")" "revise" "objections hand the artifact back to the author"

  printf 'Add a widget. Done when GET /widget returns 200 in the test suite.\n' > "$artifact"
  out=$(cc "$home" revise "$id" --accepted) || fail "revise failed"
  assert_contains "$out" "lines changed since the draft" "a revision must report the change it made"
  assert_contains "$(cc "$home" state "$id")" "open" "before the cap, a revision goes back to the challenger"

  out=$(cc "$home" round "$id" --clean) || fail "second clean round failed"
  assert_contains "$out" "ready after 2 of 2 rounds" "a clean second round ends at ready"

  out=$(cc "$home" close "$id") || fail "close failed"
  assert_contains "$out" "the challenge changed" "close must state what the challenge changed"
  assert_present "$home/data/$id/crosscheck/changed.diff" "the draft-to-final difference must survive"
  assert_grep "GET /widget" "$home/data/$id/crosscheck/changed.diff" "the difference must contain the actual revision"
  assert_present "$home/data/$id/crosscheck/round-1-objections.md" "each round's objections must survive"
  pass "the draft-to-final difference is recorded and readable"
}

# A cross-check that changes nothing every time is not earning its cost, and that
# has to be visible rather than reported as a success.
test_unchanged_outcome_is_stated_plainly() {
  local home id out
  home=$(make_home unchanged)
  id=cc-unchanged
  open_brief_crosscheck "$home" "$id" >/dev/null || fail "open failed"
  cc "$home" round "$id" --clean >/dev/null || fail "clean round failed"
  out=$(cc "$home" close "$id") || fail "close failed"
  assert_contains "$out" "changed NOTHING" "an unchanged artifact must be called out"
  assert_contains "$out" "not earning its cost" "the cost of a no-op cross-check must be named"
  pass "a cross-check that changed nothing says so"
}

# Briefs and reports are Markdown whose lines are mostly plain-dash bullets, so a
# real revision is largely "+- item" lines. Those must count, or the honesty
# message claims nothing changed about a revision that changed the whole list.
test_bullet_only_revision_counts_as_a_change() {
  local home id artifact out
  home=$(make_home bullets)
  id=cc-bullets
  artifact="$home/data/$id/brief.md"
  open_brief_crosscheck "$home" "$id" "$(printf -- '- check the widget\n- ship it\n')" >/dev/null \
    || fail "open failed"
  cc "$home" round "$id" --clean >/dev/null || fail "clean round failed"
  printf -- '- check the widget against GET /widget\n- ship it behind the existing flag\n' > "$artifact"

  out=$(cc "$home" close "$id") || fail "close failed"
  case "$out" in
    *"changed NOTHING"*) fail "a bullet-only revision was reported as no change at all" ;;
  esac
  assert_contains "$out" "the challenge changed 4 lines" "every added and removed bullet line must be counted"
  assert_grep "changed_lines=4" "$home/data/$id/crosscheck/ledger" "the ledger must record the true count"
  pass "a revision to bullet lines is counted as a change"
}

# An author who escalated something on an otherwise-ready cross-check keeps the
# record; it is not silently dropped just because no objection stood.
test_escalation_is_recorded_on_a_ready_close() {
  local home id
  home=$(make_home ready-escalated)
  id=cc-ready-escalated
  open_brief_crosscheck "$home" "$id" >/dev/null || fail "open failed"
  cc "$home" round "$id" --clean >/dev/null || fail "clean round failed"
  cc "$home" close "$id" --escalated "asked the captain whether the widget is still wanted" \
    >/dev/null || fail "ready close with an escalation failed"
  assert_grep "escalated=asked the captain" "$home/data/$id/crosscheck/ledger" \
    "an escalation on a ready close must survive in the ledger"
  pass "an escalation on a ready cross-check is recorded"
}

# Two rounds, then ready or a genuine disagreement. It must never loop.
test_never_runs_a_third_round() {
  local home id artifact objections out rc
  home=$(make_home cap)
  id=cc-cap
  artifact="$home/data/$id/brief.md"
  open_brief_crosscheck "$home" "$id" >/dev/null || fail "open failed"
  objections="$home/objections.md"
  printf 'O1. Unstated assumption. Evidence: brief.md:1.\n' > "$objections"

  cc "$home" round "$id" --objections "$objections" >/dev/null || fail "round 1 failed"
  printf 'Add a widget, reusing the existing widget factory.\n' > "$artifact"
  cc "$home" revise "$id" --accepted >/dev/null || fail "revise 1 failed"
  cc "$home" round "$id" --objections "$objections" >/dev/null || fail "round 2 failed"

  out=$(cc "$home" revise "$id" --stands "the factory is deprecated and the objection assumes it is not") \
    || fail "revise at the cap failed"
  assert_contains "$out" "DISAGREEMENT" "an objection that stands at the cap is a disagreement"
  assert_contains "$out" "does not get a third round" "the cap must be stated at the point of use"

  set +e
  cc "$home" round "$id" --objections "$objections" >/dev/null 2>"$home/third.err"
  rc=$?
  set -e
  [ "$rc" -ne 0 ] || fail "a third round was accepted; the exchange can loop"
  assert_grep "not 'open'" "$home/third.err" "the third round must be refused with a reason"
  pass "the exchange stops at two rounds and cannot loop"
}

# A disagreement is a captain decision, so it must not be closed out quietly.
test_disagreement_requires_escalation_to_close() {
  local home id objections rc out
  home=$(make_home disagreement)
  id=cc-disagreement
  open_brief_crosscheck "$home" "$id" >/dev/null || fail "open failed"
  objections="$home/objections.md"
  printf 'O1. Contradicts the registry. Evidence: brief.md:1.\n' > "$objections"
  cc "$home" round "$id" --objections "$objections" >/dev/null || fail "round 1 failed"
  cc "$home" revise "$id" --accepted >/dev/null || fail "revise 1 failed"
  cc "$home" round "$id" --objections "$objections" >/dev/null || fail "round 2 failed"
  cc "$home" revise "$id" --stands "the registry entry is stale" >/dev/null || fail "revise 2 failed"

  set +e
  cc "$home" close "$id" >/dev/null 2>"$home/close.err"
  rc=$?
  set -e
  [ "$rc" -ne 0 ] || fail "a disagreement closed without escalation"
  assert_grep "escalated" "$home/close.err" "the refusal must name the escalation requirement"

  out=$(cc "$home" close "$id" --escalated "captain asked whether the registry entry is stale") \
    || fail "escalated close failed"
  assert_contains "$out" "disagreement" "the closed outcome must record the disagreement"
  pass "a disagreement cannot be closed without escalating it"
}

# The charge is the difference between a job and a mood. It must withhold the
# author's reasoning, demand citations, and forbid the challenger rewriting.
test_charge_gives_the_challenger_a_job_not_a_mood() {
  local home id charge objections second
  home=$(make_home charge)
  id=cc-charge
  open_brief_crosscheck "$home" "$id" >/dev/null || fail "open failed"

  charge=$(cc "$home" charge "$id") || fail "charge failed"
  assert_contains "$charge" "do not read the originating task's status log" \
    "the challenger must be kept away from the author's reasoning"
  assert_contains "$charge" "must cite external evidence" "objections must be evidence-backed"
  assert_contains "$charge" "Do not rewrite the artifact" "the challenger must not become the author"
  assert_contains "$charge" "NO OBJECTIONS" "agreeing must be an allowed, stated outcome"
  assert_contains "$charge" "Do NOT" "manufacturing an objection must be forbidden"
  assert_contains "$charge" "checkable by someone who did not write it" \
    "the brief charge must ask its concrete questions"

  objections="$home/objections.md"
  printf 'O1. Unstated assumption. Evidence: brief.md:1.\n' > "$objections"
  cc "$home" round "$id" --objections "$objections" >/dev/null || fail "round 1 failed"
  cc "$home" revise "$id" --accepted >/dev/null || fail "revise failed"
  second=$(cc "$home" charge "$id") || fail "second charge failed"
  assert_contains "$second" "round-1-objections.md" "round 2 must judge its own prior objections"
  assert_contains "$second" "ADDRESSED or NOT ADDRESSED" "round 2 must return a verdict per objection"
  assert_contains "$second" "there is none" "the final round must say no round follows"
  pass "the charge asks concrete questions and withholds the author's reasoning"
}

# Findings get their own questions: the challenger re-runs the evidence rather
# than re-reading the argument.
test_findings_charge_re_runs_the_evidence() {
  local home id charge
  home=$(make_home findings)
  id=cc-findings
  mkdir -p "$home/data/$id"
  printf 'The service is slow because of the cache.\n' > "$home/data/$id/report.md"
  cc "$home" open "$id" --kind findings --artifact "$home/data/$id/report.md" \
    --goal "find out why the service is slow" >/dev/null || fail "open failed"
  charge=$(cc "$home" charge "$id") || fail "charge failed"
  assert_contains "$charge" "re-run the command" "a findings challenge must reproduce the evidence"
  assert_contains "$charge" "would have falsified" "a findings challenge must look for disconfirming evidence"
  assert_contains "$charge" "alternative explanation" "a findings challenge must consider another explanation"
  pass "a findings charge re-runs the evidence instead of re-reading the argument"
}

# Code is deliberately out of scope: it already has author/reviewer separation.
test_code_is_out_of_scope() {
  local home id rc
  home=$(make_home scope)
  id=cc-scope
  seed_artifact "$home" "$id" "some brief" >/dev/null
  set +e
  cc "$home" open "$id" --kind code --artifact "$home/data/$id/brief.md" --goal g \
    >/dev/null 2>"$home/scope.err"
  rc=$?
  set -e
  [ "$rc" -ne 0 ] || fail "a code cross-check was accepted"
  assert_grep "brief or findings" "$home/scope.err" "the refusal must name the supported kinds"
  pass "code is refused; the delivery pipeline already covers it"
}

# The goal is what the artifact was supposed to achieve. Without it the
# challenger has nothing to judge against, so it cannot be inferred.
test_goal_is_required() {
  local home id rc
  home=$(make_home goal)
  id=cc-goal
  seed_artifact "$home" "$id" "some brief" >/dev/null
  set +e
  cc "$home" open "$id" --kind brief --artifact "$home/data/$id/brief.md" \
    >/dev/null 2>"$home/goal.err"
  rc=$?
  set -e
  [ "$rc" -ne 0 ] || fail "a cross-check opened with no stated goal"
  assert_grep "cannot be inferred" "$home/goal.err" "the refusal must explain why the goal is required"
  pass "a cross-check cannot open without what the artifact was supposed to achieve"
}

test_gate_passes_unless_a_crosscheck_is_open() {
  local home id rc
  home=$(make_home gate)
  id=cc-gate
  cc "$home" gate "$id" || fail "gate must pass for a task with no cross-check"

  open_brief_crosscheck "$home" "$id" >/dev/null || fail "open failed"
  set +e
  cc "$home" gate "$id" 2>/dev/null
  rc=$?
  set -e
  [ "$rc" -ne 0 ] || fail "gate passed while a cross-check was open"

  cc "$home" round "$id" --clean >/dev/null || fail "clean round failed"
  set +e
  cc "$home" gate "$id" 2>/dev/null
  rc=$?
  set -e
  [ "$rc" -ne 0 ] || fail "gate passed on a ready-but-unclosed cross-check"

  cc "$home" close "$id" >/dev/null || fail "close failed"
  cc "$home" gate "$id" || fail "gate must pass once the cross-check is closed"
  pass "the gate blocks exactly while a cross-check is unfinished"
}

make_spawn_fakebin() {  # <dir>
  local dir=$1 fakebin
  fakebin=$(fm_fakebin "$dir")
  cat > "$fakebin/tmux" <<'SH'
#!/usr/bin/env bash
set -u
case "$*" in
  *"#{pane_current_path}"*) printf '%s\n' "${FM_FAKE_PANE_PATH:-}"; exit 0 ;;
esac
case "${1:-}" in
  display-message) printf 'firstmate\n'; exit 0 ;;
esac
exit 0
SH
  chmod +x "$fakebin/tmux"
  fm_fake_exit0 "$fakebin" treehouse claude
  printf '%s\n' "$fakebin"
}

# Dispatch is the boundary the brief cross-check exists to sit in front of, so an
# unfinished one has to stop the launch rather than rely on being remembered.
test_dispatch_refuses_while_the_brief_is_under_crosscheck() {
  local home id proj wt fakebin out rc
  home=$(make_home spawn-gate)
  id=cc-spawn-gate
  proj="$TMP_ROOT/spawn-gate-project"
  wt="$TMP_ROOT/spawn-gate-wt"
  fakebin=$(make_spawn_fakebin "$TMP_ROOT/spawn-gate-fake")
  fm_git_worktree "$proj" "$wt" "wt-cc-spawn-gate"
  # Pin the crew harness: unpinned, fm-spawn.sh resolves it by detecting the
  # harness this test process runs under, so a plain CI shell resolves 'unknown'
  # and aborts on the launch template before the cross-check gate is reached.
  printf 'claude\n' > "$home/config/crew-harness"
  touch "$home/state/.last-watcher-beat"
  mkdir -p "$home/data/$id"
  printf 'Delivery contract: mode=no-mistakes\nAdd a widget.\n' > "$home/data/$id/brief.md"
  cc "$home" open "$id" --kind brief --artifact "$home/data/$id/brief.md" \
    --goal "the captain asked for a widget" >/dev/null || fail "open failed"

  set +e
  out=$(FM_ROOT_OVERRIDE='' FM_HOME="$home" FM_STATE_OVERRIDE="$home/state" \
    FM_DATA_OVERRIDE="$home/data" FM_PROJECTS_OVERRIDE="$home/projects" \
    FM_CONFIG_OVERRIDE="$home/config" FM_SPAWN_NO_GUARD=1 FM_FAKE_PANE_PATH="$wt" \
    TMUX="fake,1,0" PATH="$fakebin:$PATH" \
    "$SPAWN" "$id" "$proj" --mode no-mistakes --yolo off 2>&1)
  rc=$?
  set -e
  [ "$rc" -ne 0 ] || fail "dispatch launched a brief that was still under cross-check"
  assert_contains "$out" "refusing to dispatch" "the refusal must be explicit"
  assert_absent "$home/state/$id.meta" "a refused dispatch must not record the task as under way"
  pass "dispatch refuses a brief whose cross-check is unfinished"
}

# The scout's scratch worktree is the only thing that can answer the challenger's
# objections, so it must not be discarded while the cross-check is unfinished.
test_scout_teardown_refuses_while_findings_are_under_crosscheck() {
  local home id fakebin rc
  command -v tasks-axi >/dev/null 2>&1 || { echo "skip: tasks-axi not found"; return 0; }
  home=$(make_home teardown-gate)
  id=cc-teardown-gate
  fakebin=$(fm_fakebin "$TMP_ROOT/teardown-gate-fake")
  fm_fake_exit0 "$fakebin" tmux treehouse no-mistakes gh gh-axi
  cp "$ROOT/.tasks.toml" "$home/.tasks.toml"
  cat > "$home/data/backlog.md" <<'EOF'
## In flight

## Queued

## Done
EOF
  mkdir -p "$home/data/$id"
  fm_write_meta "$home/state/$id.meta" \
    "window=firstmate:fm-$id" \
    "worktree=$home/projects/scratch" \
    "project=$home/projects/sample" \
    "harness=claude" \
    "kind=scout" \
    "mode=scout"
  printf 'done: investigation complete\n' > "$home/state/$id.status"
  printf '# Findings\n\nThe cache is the cause.\n' > "$home/data/$id/report.md"
  PATH="$fakebin:$PATH" FM_ROOT_OVERRIDE="$ROOT" FM_HOME="$home" \
    FM_STATE_OVERRIDE="$home/state" FM_DATA_OVERRIDE="$home/data" \
    FM_CONFIG_OVERRIDE="$home/config" \
    "$ROOT/bin/fm-decision-hold.sh" complete "$id" --none >/dev/null \
    || { echo "skip: decision-hold completion unavailable in this environment"; return 0; }
  cc "$home" open "$id" --kind findings --artifact "$home/data/$id/report.md" \
    --goal "find out why the service is slow" >/dev/null || fail "open failed"

  set +e
  PATH="$fakebin:$PATH" FM_ROOT_OVERRIDE="$ROOT" FM_HOME="$home" \
    FM_STATE_OVERRIDE="$home/state" FM_DATA_OVERRIDE="$home/data" \
    FM_CONFIG_OVERRIDE="$home/config" \
    "$TEARDOWN" "$id" >"$home/teardown.out" 2>"$home/teardown.err"
  rc=$?
  set -e
  [ "$rc" -ne 0 ] || fail "scout teardown discarded findings that were still under cross-check"
  assert_grep "cross-check" "$home/teardown.err" "the refusal must name the cross-check"
  assert_present "$home/state/$id.meta" "a refused teardown must preserve the task record"
  pass "scout teardown refuses while the findings cross-check is unfinished"
}

test_clean_first_round_stops_early
test_second_round_records_what_the_challenge_changed
test_unchanged_outcome_is_stated_plainly
test_bullet_only_revision_counts_as_a_change
test_escalation_is_recorded_on_a_ready_close
test_never_runs_a_third_round
test_disagreement_requires_escalation_to_close
test_charge_gives_the_challenger_a_job_not_a_mood
test_findings_charge_re_runs_the_evidence
test_code_is_out_of_scope
test_goal_is_required
test_gate_passes_unless_a_crosscheck_is_open
test_dispatch_refuses_while_the_brief_is_under_crosscheck
test_scout_teardown_refuses_while_findings_are_under_crosscheck
