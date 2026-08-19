#!/usr/bin/env bash
# Behavior tests for the launch prompt bin/fm-spawn.sh composes and launches.
#
# A brief scaffolded by bin/fm-brief.sh carries only its task-specific half plus
# a declaration naming its standing-rules variant; tracked worker-rules.md holds
# those rules once. These tests drive fm-spawn with a fake tmux and a real
# isolated git worktree, and assert on what the worker would actually be handed:
# the composed state/<id>.launch-prompt.md file and the literal launch command
# that reads it. That is the structural claim - the rules ride in the launch
# prompt, not in a pointer a worker could decline to follow - so it is checked
# here rather than assumed.
set -u

# shellcheck source=tests/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

SPAWN="$ROOT/bin/fm-spawn.sh"
TMP_ROOT=$(fm_test_tmproot fm-spawn-launch-prompt)

make_fakebin() {
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
  list-windows) exit 0 ;;
  new-window)
    [ -z "${FM_FAKE_TMUX_FAIL_NEW_WINDOW:-}" ] || { echo 'fake tmux: new-window refused' >&2; exit 1; }
    exit 0 ;;
  has-session|new-session|kill-window) exit 0 ;;
  send-keys)
    if [ -n "${FM_FAKE_LAUNCH_LOG:-}" ]; then
      prev=
      for a in "$@"; do
        [ "$prev" = "-l" ] && printf '%s\n' "$a" >> "$FM_FAKE_LAUNCH_LOG"
        prev=$a
      done
    fi
    exit 0
    ;;
esac
exit 0
SH
  chmod +x "$fakebin/tmux"
  fm_fake_exit0 "$fakebin" treehouse
  printf '%s\n' "$fakebin"
}

# Scaffold one real brief through bin/fm-brief.sh and set the case globals.
make_case() {  # <name> <id> <brief-args...>
  local name=$1 id=$2
  shift 2
  CASE_DIR="$TMP_ROOT/$name"
  HOME_DIR="$CASE_DIR/home"
  PROJ_DIR="$CASE_DIR/project"
  WT_DIR="$CASE_DIR/wt"
  LAUNCH_LOG="$CASE_DIR/launch.log"
  FAKEBIN_DIR=$(make_fakebin "$CASE_DIR/fake")
  mkdir -p "$HOME_DIR/data" "$HOME_DIR/projects" "$HOME_DIR/state" "$HOME_DIR/config"
  printf '%s\n' claude > "$HOME_DIR/config/crew-harness"
  fm_git_worktree "$PROJ_DIR" "$WT_DIR" "wt-$name"
  touch "$HOME_DIR/state/.last-watcher-beat"
  FM_HOME="$HOME_DIR" FM_DATA_OVERRIDE="$HOME_DIR/data" FM_STATE_OVERRIDE="$HOME_DIR/state" \
    "$ROOT/bin/fm-brief.sh" "$id" "$(basename "$PROJ_DIR")" "$@" >/dev/null \
    || fail "$name: fm-brief.sh scaffold exited non-zero"
}

run_spawn() {
  : > "$LAUNCH_LOG"
  FM_ROOT_OVERRIDE='' FM_HOME="$HOME_DIR" \
    FM_STATE_OVERRIDE="$HOME_DIR/state" FM_DATA_OVERRIDE="$HOME_DIR/data" \
    FM_PROJECTS_OVERRIDE="$HOME_DIR/projects" FM_CONFIG_OVERRIDE="$HOME_DIR/config" \
    FM_SPAWN_NO_GUARD=1 FM_FAKE_PANE_PATH="$WT_DIR" TMUX="fake,1,0" \
    CLAUDE_CONFIG_DIR='' FM_FAKE_LAUNCH_LOG="$LAUNCH_LOG" \
    PATH="$FAKEBIN_DIR:$PATH" \
    "$SPAWN" "$@" 2>&1
}

# The rules must reach the worker in the prompt it is launched with, and the
# launch command must read exactly that composed file.
test_spawn_launches_the_composed_prompt() {
  local id out status prompt launch
  id=lp-compose-a1
  make_case compose "$id" --mode no-mistakes
  out=$(run_spawn "$id" "$PROJ_DIR" --mode no-mistakes --yolo off)
  status=$?
  expect_code 0 "$status" "spawn from a declared brief should succeed (got: $out)"

  prompt="$HOME_DIR/state/$id.launch-prompt.md"
  assert_present "$prompt" "spawn did not compose a launch prompt"
  assert_grep "Verify isolation before anything else" "$prompt" \
    "the launched prompt lost the worktree-isolation assertion"
  assert_grep "Never push to the default branch" "$prompt" \
    "the launched prompt lost rule 1"
  assert_grep "# Quality bar" "$prompt" "the launched prompt lost the standing quality bar"
  grep -qx "Delivery contract: mode=no-mistakes" "$prompt" \
    || fail "the launched prompt lost its delivery contract line"
  assert_grep "$HOME_DIR/state/$id.status" "$prompt" \
    "the launched prompt lost this task's own status file path"

  launch=$(cat "$LAUNCH_LOG")
  case "$launch" in
    *"< '$prompt'"*) ;;
    *) fail "the launch command does not read the composed prompt: $launch" ;;
  esac
  case "$launch" in
    *"$HOME_DIR/data/$id/brief.md"*)
      fail "the launch command still reads the task-only brief: $launch" ;;
  esac
  pass "fm-spawn.sh: the worker is launched with the composed rules-plus-task prompt"
}

# A brief scaffolded before this contract carries its whole rule set already, so
# it must be launched exactly as before with nothing composed.
test_brief_without_a_declaration_launches_unchanged() {
  local id out status launch
  id=lp-legacy-a2
  make_case legacy "$id" --mode direct-PR
  # Stand in for a pre-contract brief: whole rules inline, no declaration.
  printf '%s\n' 'You are a crewmate.' '' '# Task' 'legacy task' '' '# Definition of done' \
    'Delivery contract: mode=direct-PR' > "$HOME_DIR/data/$id/brief.md"
  out=$(run_spawn "$id" "$PROJ_DIR" --mode direct-PR --yolo off)
  status=$?
  expect_code 0 "$status" "spawn from a pre-contract brief should still succeed (got: $out)"
  assert_absent "$HOME_DIR/state/$id.launch-prompt.md" \
    "a pre-contract brief should have nothing composed for it"
  launch=$(cat "$LAUNCH_LOG")
  case "$launch" in
    *"< '$HOME_DIR/data/$id/brief.md'"*) ;;
    *) fail "a pre-contract brief was not launched from its own file: $launch" ;;
  esac
  pass "fm-spawn.sh: a brief with no rules declaration launches exactly as before"
}

# The prompt reaches the harness as one argument, so an oversized one must be
# refused before any endpoint exists, naming the fix. Driven through the
# documented override so the test does not have to build a megabyte of prose.
test_oversized_launch_prompt_is_refused_before_any_endpoint() {
  local id out status
  id=lp-oversize-a3
  make_case oversize "$id" --mode no-mistakes
  out=$(FM_LAUNCH_PROMPT_MAX=512 run_spawn "$id" "$PROJ_DIR" --mode no-mistakes --yolo off)
  status=$?
  [ "$status" -ne 0 ] || fail "an oversized launch prompt was spawned anyway"
  assert_contains "$out" "over the 512-byte limit" "the refusal did not state the limit it hit"
  assert_contains "$out" "shorten the # Task section" "the refusal did not name the fix"
  assert_contains "$out" "$HOME_DIR/data/$id/brief.md" \
    "the refusal did not name the file to shorten"
  assert_absent "$HOME_DIR/state/$id.meta" "a refused spawn still recorded task metadata"
  assert_absent "$HOME_DIR/state/$id.launch-prompt.md" \
    "a refused spawn still left a composed launch prompt behind"
  [ ! -s "$LAUNCH_LOG" ] || fail "a refused spawn still sent a launch command"

  # The same task launches once the prompt fits, so the refusal is about size.
  out=$(run_spawn "$id" "$PROJ_DIR" --mode no-mistakes --yolo off)
  status=$?
  expect_code 0 "$status" "the same task should spawn under the real limit (got: $out)"
  pass "fm-spawn.sh: an over-long launch prompt is refused by name before anything is created"
}

# fm-promote.sh turns a scout task into a ship task by rewriting its metadata,
# not its brief, so a later relaunch spawns a scout-scaffolded brief as a ship.
# That must still launch, on the rules the brief actually declares.
test_promoted_scout_brief_still_launches() {
  local id out status prompt
  id=lp-promoted-a4
  make_case promoted "$id" --scout
  out=$(run_spawn "$id" "$PROJ_DIR" --mode no-mistakes --yolo off)
  status=$?
  expect_code 0 "$status" "a promoted scout brief should still spawn as a ship task (got: $out)"
  prompt="$HOME_DIR/state/$id.launch-prompt.md"
  assert_grep "This is a SCOUT task" "$prompt" \
    "the relaunch did not compose the rules the brief actually declares"
  pass "fm-spawn.sh: a promoted scout's brief still launches on the rules it declares"
}

# A brief that lost its declaration AND carries no standing rule sections of its
# own is damaged, not pre-contract: launching it would hand the worker no
# isolation assertion, no "never push to the default branch", and no status
# protocol. Two shapes must stay on the launch path: a brief carrying either
# anchored heading, and a persistent secondmate charter, which is exempt by kind
# because it is a whole document rather than a scaffold with rules rendered at
# launch.
test_declarationless_brief_without_rule_sections_is_refused() {
  local id out status
  id=lp-damaged-a5
  make_case damaged "$id" --mode no-mistakes
  printf '%s\n' 'You are a crewmate.' '' '# Task' 'do the thing' \
    > "$HOME_DIR/data/$id/brief.md"
  out=$(run_spawn "$id" "$PROJ_DIR" --mode no-mistakes --yolo off)
  status=$?
  [ "$status" -ne 0 ] || fail "a brief with no declaration and no rule sections was spawned anyway"
  assert_contains "$out" "no standing rule sections of its own" \
    "the refusal did not say why the brief is unusable"
  assert_contains "$out" "re-scaffold the brief with bin/fm-brief.sh" \
    "the refusal did not name the fix"
  assert_contains "$out" "restore its <!-- worker-rules: ... --> declaration line" \
    "the refusal did not name the other fix"
  assert_absent "$HOME_DIR/state/$id.meta" "a refused spawn still recorded task metadata"
  assert_absent "$HOME_DIR/state/$id.launch-prompt.md" \
    "a refused spawn still composed a launch prompt"
  [ ! -s "$LAUNCH_LOG" ] || fail "a refused spawn still sent a launch command"

  # Either anchored heading on its own is enough to read as pre-contract rather
  # than damaged, so both terms of the discriminator are driven here.
  local n=0 heading
  for heading in '# Definition of done' '# Rules'; do
    n=$((n + 1))
    id="lp-onehead-a5-$n"
    make_case "onehead-$n" "$id" --mode no-mistakes
    printf '%s\n' 'You are a crewmate.' '' '# Task' 'do the thing' '' \
      "$heading" 'ready in branch' > "$HOME_DIR/data/$id/brief.md"
    out=$(run_spawn "$id" "$PROJ_DIR" --mode no-mistakes --yolo off)
    status=$?
    expect_code 0 "$status" \
      "a declaration-less brief carrying only '$heading' was refused (got: $out)"
  done
  pass "fm-spawn.sh: a declaration-less brief with no rule sections is refused by name"
}

# A persistent secondmate charter is a whole document on the unchanged
# whole-text path, never a scaffold whose rules are rendered at launch. It is
# exempt by kind, so a charter carrying neither anchored heading must still
# dispatch. This drives a real --secondmate spawn, which is the only case that
# executes that term of the discriminator.
test_declarationless_secondmate_charter_still_launches() {
  local id sm out status
  id=lp-charter-a6
  make_case charter "$id" --mode local-only
  sm="$CASE_DIR/secondmate-home"
  mkdir -p "$sm/bin" "$sm/data"
  printf '%s\n' '# Firstmate' > "$sm/AGENTS.md"
  printf '%s\n' "$id" > "$sm/.fm-secondmate-home"
  printf '%s\n' 'You supervise the domain.' > "$sm/data/charter.md"
  sm=$(cd "$sm" && pwd -P)
  out=$(run_spawn "$id" "$sm" --secondmate)
  status=$?
  expect_code 0 "$status" "a secondmate charter with no anchored headings was refused (got: $out)"
  assert_present "$HOME_DIR/state/$id.meta" "the secondmate spawn recorded no task metadata"
  pass "fm-spawn.sh: a secondmate charter is exempt from the standing-rules discriminator"
}

# state/<id>.launch-prompt.md is the exact prompt the running worker was
# launched with, so a live task owns it and a refused relaunch of the same id
# must neither delete nor rewrite it. The abort driven here is a failed tmux
# window creation, which happens after the prompt would be composed and before
# any metadata this spawn would write. The brief is edited between the two
# spawns so a rewrite is observable: without the fix the refused relaunch
# installs the edited text over the live task's prompt.
test_refused_relaunch_keeps_the_live_prompt() {
  local id out status prompt before
  id=lp-duplicate-a7
  make_case duplicate "$id" --mode no-mistakes
  prompt="$HOME_DIR/state/$id.launch-prompt.md"

  # A prompt this spawn creates is this spawn's to clean up when it aborts.
  out=$(FM_FAKE_TMUX_FAIL_NEW_WINDOW=1 run_spawn "$id" "$PROJ_DIR" --mode no-mistakes --yolo off)
  status=$?
  [ "$status" -ne 0 ] || fail "a spawn whose window could not be created was allowed (got: $out)"
  assert_absent "$prompt" "an aborted first spawn left its own launch prompt behind"

  out=$(run_spawn "$id" "$PROJ_DIR" --mode no-mistakes --yolo off)
  status=$?
  expect_code 0 "$status" "the first successful spawn should succeed (got: $out)"
  assert_present "$prompt" "the first spawn composed no launch prompt"
  before=$(cat "$prompt")

  printf '%s\n' 'A follow-up the live worker was never launched with.' \
    >> "$HOME_DIR/data/$id/brief.md"
  out=$(FM_FAKE_TMUX_FAIL_NEW_WINDOW=1 run_spawn "$id" "$PROJ_DIR" --mode no-mistakes --yolo off)
  status=$?
  [ "$status" -ne 0 ] || fail "a relaunch whose window could not be created was allowed (got: $out)"
  assert_present "$prompt" "a refused relaunch deleted the live task's launch prompt"
  assert_no_grep "A follow-up the live worker was never launched with." "$prompt" \
    "a refused relaunch rewrote the live task's launch prompt with the edited brief"
  [ "$(cat "$prompt")" = "$before" ] \
    || fail "a refused relaunch rewrote the live task's launch prompt"
  pass "fm-spawn.sh: a refused relaunch leaves the live task's prompt intact"
}

test_spawn_launches_the_composed_prompt
test_brief_without_a_declaration_launches_unchanged
test_oversized_launch_prompt_is_refused_before_any_endpoint
test_declarationless_brief_without_rule_sections_is_refused
test_declarationless_secondmate_charter_still_launches
test_refused_relaunch_keeps_the_live_prompt
test_promoted_scout_brief_still_launches
echo "# all fm-spawn-launch-prompt tests passed"
