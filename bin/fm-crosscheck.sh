#!/usr/bin/env bash
# fm-crosscheck.sh - deterministic rounds for the author/challenger cross-check.
#
# The semantic policy is owned once by
# .agents/skills/crosscheck-rounds/SKILL.md. This script owns only what memory
# must not be trusted with: the round cap, the early-exit on a clean round, the
# snapshots that make the change visible, and the gate that stops a draft being
# used before its cross-check closed.
#
# It applies to exactly two artifacts, both of them things work gets built ON:
#   brief     job instructions, before the task is dispatched
#   findings  an investigation's conclusions, before they are relayed or acted on
# Code is out of scope: the delivery pipeline already separates author from
# reviewer there.
#
# Round shape. The author drafts, a SEPARATE agent challenges the draft, the
# author revises, the challenger checks the revision. A round that finds nothing
# ends the cross-check immediately - the cap is a ceiling, not a quota. Two
# rounds is the hard cap, so the exchange can never loop: at the cap the ledger
# resolves to `ready` or to `disagreement`, and a disagreement goes to the
# captain rather than to a third round.
#
# The challenger is an ordinary scout crewmate. `charge` prints its task text:
# the artifact snapshot, the stated goal, and the concrete questions it must
# answer. It never receives the author's reasoning - the charge names the
# snapshot and the goal as its only inputs, and forbids reading the origin
# task's log or pane - so it can reach a different conclusion instead of
# auditing the author's logic.
#
# All records live under data/<id>/crosscheck/, alongside the report they belong
# to, because the draft-versus-final difference IS the evidence that the
# mechanism earned its cost. Nothing is written to state/.
#
# Usage:
#   fm-crosscheck.sh open <id> --kind <brief|findings> --artifact <path>
#     (--goal <text> | --goal-file <path>)
#   fm-crosscheck.sh charge <id>
#   fm-crosscheck.sh round <id> (--clean | --objections <path>)
#   fm-crosscheck.sh revise <id> (--accepted | --stands <why>) [--note <text>]
#   fm-crosscheck.sh show <id>
#   fm-crosscheck.sh close <id> [--escalated <what went to the captain>]
#   fm-crosscheck.sh state <id>
#   fm-crosscheck.sh gate <id>
#
# `round --clean` records that the challenger produced no evidence-backed
# objection and ends the cross-check at `ready`. `round --objections` records
# its report and waits for the author. `revise --accepted` means every objection
# was acted on; `revise --stands <why>` means at least one was not, and at the
# cap that is what turns into `disagreement`.
#
# `show` prints the draft-to-current difference, and `close` writes it to
# changed.diff. A cross-check whose final diff is empty every time is a
# mechanism that is not earning its keep, and this is where that shows.
#
# `close` on a disagreement REQUIRES --escalated, so an unresolved objection
# cannot be closed out quietly.
#
# `state` prints one word for a human. `gate` is the machine check: it exits 0
# when the id has no cross-check at all or its cross-check is closed, and
# non-zero while one is still open. bin/fm-spawn.sh calls it before launching a
# task, and bin/fm-teardown.sh before discarding a scout, so an opened
# cross-check cannot be forgotten and skipped.
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FM_ROOT="${FM_ROOT_OVERRIDE:-$(cd "$SCRIPT_DIR/.." && pwd)}"
FM_HOME="${FM_HOME:-${FM_ROOT_OVERRIDE:-$FM_ROOT}}"
DATA="${FM_DATA_OVERRIDE:-$FM_HOME/data}"

CAP=2

usage() {
  awk '
    NR == 1 { next }
    /^#/ { sub(/^# ?/, ""); print; next }
    { exit }
  ' "$0"
}

fail() {
  printf 'fm-crosscheck: %s\n' "$*" >&2
  exit 1
}

validate_slug() {  # <label> <value>
  case "$2" in
    ''|*[!A-Za-z0-9._-]*) fail "$1 must be a non-empty privacy-safe slug: $2" ;;
  esac
}

validate_one_line() {  # <label> <value>
  [ -n "$2" ] || fail "$1 must not be empty"
  case "$2" in
    *$'\n'*|*$'\r'*) fail "$1 must be one line" ;;
  esac
}

need_value() {  # <flag> <value>
  [ "$#" -ge 2 ] || fail "$1 requires a value"
  case "$2" in
    --*) fail "$1 requires a value" ;;
  esac
}

DIR=''
LEDGER=''
set_paths() {  # <id>
  validate_slug "task id" "$1"
  DIR="$DATA/$1/crosscheck"
  LEDGER="$DIR/ledger"
}

ledger_get() {  # <key>
  local line
  line=$(grep "^$1=" "$LEDGER" 2>/dev/null | tail -1) || true
  printf '%s' "${line#"$1"=}"
}

ledger_set() {  # <key> <value>
  local tmp
  tmp="$LEDGER.tmp.$$"
  { grep -v "^$1=" "$LEDGER" 2>/dev/null || true; printf '%s=%s\n' "$1" "$2"; } > "$tmp"
  mv "$tmp" "$LEDGER"
}

require_ledger() {
  [ -f "$LEDGER" ] || fail "no cross-check for this task: $LEDGER does not exist (open one with 'open')"
}

require_status() {  # <expected> <hint>
  local actual
  actual=$(ledger_get status)
  [ "$actual" = "$1" ] || fail "cross-check is '$actual', not '$1': $2"
}

artifact_path() {
  ledger_get artifact
}

# Called in the current shell, so a missing artifact stops the command instead
# of collapsing to an empty diff that would read as "the challenge changed
# nothing" - the one wrong answer this script must never give.
require_artifact() {
  local artifact
  artifact=$(artifact_path)
  [ -f "$artifact" ] || fail "the artifact under cross-check is gone: $artifact"
}

# diff exits 1 when the files differ, which is the normal case here.
diff_draft_to_current() {
  diff -u "$DIR/draft.md" "$(artifact_path)" 2>/dev/null || true
}

changed_line_count() {
  diff_draft_to_current | grep -vE '^(---|\+\+\+) ' | grep -c '^[-+]' || true
}

cmd_open() {
  local id=$1; shift
  set_paths "$id"
  local kind='' artifact='' goal='' goal_file=''
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --kind) need_value "$@"; kind=$2; shift 2 ;;
      --artifact) need_value "$@"; artifact=$2; shift 2 ;;
      --goal) need_value "$@"; goal=$2; shift 2 ;;
      --goal-file) need_value "$@"; goal_file=$2; shift 2 ;;
      *) fail "unknown argument for open: $1" ;;
    esac
  done
  case "$kind" in
    brief|findings) ;;
    '') fail "open requires --kind <brief|findings>" ;;
    *) fail "--kind must be brief or findings (got '$kind'); code is out of scope, the delivery pipeline already separates author from reviewer there" ;;
  esac
  [ -n "$artifact" ] || fail "open requires --artifact <path>"
  [ -f "$artifact" ] || fail "artifact does not exist: $artifact"
  [ -s "$artifact" ] || fail "artifact is empty: $artifact"
  artifact=$(cd "$(dirname "$artifact")" && printf '%s/%s' "$(pwd -P)" "$(basename "$artifact")")
  [ ! -e "$LEDGER" ] || fail "a cross-check already exists for $id: $LEDGER"
  if [ -n "$goal_file" ]; then
    [ -z "$goal" ] || fail "pass --goal or --goal-file, not both"
    [ -s "$goal_file" ] || fail "goal file is missing or empty: $goal_file"
  else
    [ -n "$goal" ] || fail "open requires --goal <text> or --goal-file <path>: the challenger is judged against what the artifact was supposed to achieve, so it cannot be inferred"
  fi

  mkdir -p "$DIR"
  cp "$artifact" "$DIR/draft.md"
  if [ -n "$goal_file" ]; then
    cp "$goal_file" "$DIR/goal.md"
  else
    printf '%s\n' "$goal" > "$DIR/goal.md"
  fi
  : > "$LEDGER"
  ledger_set id "$id"
  ledger_set kind "$kind"
  ledger_set artifact "$artifact"
  ledger_set cap "$CAP"
  ledger_set round 0
  ledger_set status open
  printf 'opened: %s cross-check on %s (%s), cap %s rounds\n' "$id" "$artifact" "$kind" "$CAP"
  printf 'next: dispatch a separate challenger with the task text from\n'
  printf '  %s charge %s\n' "$0" "$id"
}

charge_questions() {  # <kind>
  if [ "$1" = brief ]; then
    cat <<'EOF'
1. What would make a worker following these instructions exactly still fail, or
   deliver the wrong thing? Name the concrete failure, not a general risk.
2. What do these instructions assume about the repository, the product, or work
   already done, without stating it and without evidence? Check each assumption
   against the actual code and say which ones are wrong.
3. Where could a competent worker reasonably read this two different ways? Quote
   the exact sentence and give both readings.
4. What does this duplicate or contradict - something already built, already
   decided, or already recorded? Cite file:line.
5. What will the requester ask for later that these instructions do not cover?
   Point at the part of the stated goal that makes you say so.
6. Is the definition of done checkable by someone who did not write it? If not,
   name the specific part that is not checkable.
EOF
  else
    cat <<'EOF'
1. Take each load-bearing claim and re-run the command or re-read the cited
   file yourself. Which ones do not reproduce? Give the command and its actual
   output, not a summary.
2. Which conclusions do not follow from the evidence given, even where the
   evidence itself is correct?
3. What evidence would have falsified the main conclusion? Was it looked for? If
   not, look for it now and report exactly what you found.
4. Which numbers, quotes, paths, or version facts are stale or wrong today?
5. What alternative explanation fits the same evidence? State it, and state what
   would distinguish it from the report's explanation.
6. What is presented as verified that is actually judgement, inference, or
   second-hand?
EOF
  fi
}

cmd_charge() {
  local id=$1; shift
  [ "$#" -eq 0 ] || fail "charge takes no further arguments"
  set_paths "$id"
  require_ledger
  require_status open "the challenger runs only while the cross-check is awaiting a challenge"
  local kind round next artifact
  require_artifact
  kind=$(ledger_get kind)
  round=$(ledger_get round)
  next=$((round + 1))
  artifact=$(artifact_path)

  cat <<EOF
You are the challenger in a cross-check. You are NOT the author of what follows,
and you must not become its author.

# What you are judging
Artifact: $artifact
What it was supposed to achieve: $DIR/goal.md
EOF
  if [ "$next" -eq 1 ]; then
    printf 'Round 1 of at most %s.\n' "$CAP"
  else
    printf 'Round %s of %s - the final round.\n' "$next" "$CAP"
    printf 'Your own objections from the previous round: %s\n' "$DIR/round-$round-objections.md"
    printf 'The author has since revised the artifact.\n'
  fi
  cat <<EOF

# Rules
- Those two files are your inputs. Do NOT go looking for the author's reasoning:
  do not read the originating task's status log, its pane, its chat, or any
  working notes. You are meant to be able to reach a DIFFERENT conclusion, not
  to audit how the author reached theirs.
- Every objection must cite external evidence: a file:line you read, or a
  command with its actual output. An objection you cannot cite is dropped - do
  not include it. The repository is your ground truth; your own reasoning is not.
- Do not rewrite the artifact and do not propose an alternative design. Your job
  is to falsify specific claims, not to improve prose or make it nicer.
- Agreeing is a legitimate result. If you find no evidence-backed objection,
  your report must be exactly the line NO OBJECTIONS, followed by one sentence
  per question below saying what you checked and what you found. Do NOT
  manufacture an objection to look useful - a clean round ends this early, which
  is the point.
- Number your objections O1, O2, ... Each one: what is wrong, the evidence, and
  what it costs if it ships unchanged.

# Your questions
EOF
  charge_questions "$kind"
  if [ "$next" -gt 1 ]; then
    cat <<EOF

# This round only
For each objection you raised last round, state ADDRESSED or NOT ADDRESSED with
the evidence for that verdict. Do not re-raise one the revision addressed. Then
apply the questions above to anything the revision newly introduced.
This is the last round: after it, this either goes ahead or the disagreement
goes to the captain. Do not save anything for a later round - there is none.
EOF
  fi
}

cmd_round() {
  local id=$1; shift
  set_paths "$id"
  require_ledger
  require_status open "record a round only while the cross-check is awaiting a challenge"
  local clean=0 objections=''
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --clean) clean=1; shift ;;
      --objections) need_value "$@"; objections=$2; shift 2 ;;
      *) fail "unknown argument for round: $1" ;;
    esac
  done
  if [ "$clean" -eq 1 ]; then
    [ -z "$objections" ] || fail "pass --clean or --objections, not both"
  else
    [ -n "$objections" ] || fail "round requires --clean or --objections <path>"
    [ -s "$objections" ] || fail "objections file is missing or empty: $objections"
  fi

  local round next
  round=$(ledger_get round)
  next=$((round + 1))
  [ "$next" -le "$CAP" ] || fail "round cap of $CAP already reached; a cross-check never runs a third round"

  ledger_set round "$next"
  if [ "$clean" -eq 1 ]; then
    ledger_set status ready
    ledger_set clean_round "$next"
    printf 'round %s: clean - no evidence-backed objection\n' "$next"
    if [ "$next" -lt "$CAP" ]; then
      printf 'ready after %s of %s rounds (stopped early; a clean round is the exit condition)\n' "$next" "$CAP"
    else
      printf 'ready after %s of %s rounds\n' "$next" "$CAP"
    fi
    printf 'next: %s close %s\n' "$0" "$id"
    return 0
  fi
  cp "$objections" "$DIR/round-$next-objections.md"
  ledger_set status revise
  printf 'round %s: objections recorded at %s\n' "$next" "$DIR/round-$next-objections.md"
  printf 'next: the AUTHOR revises the artifact, then run\n'
  printf '  %s revise %s --accepted | --stands "<why one stands>"\n' "$0" "$id"
}

cmd_revise() {
  local id=$1; shift
  set_paths "$id"
  require_ledger
  require_status revise "record a revision only after a round raised objections"
  local accepted=0 stands='' note=''
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --accepted) accepted=1; shift ;;
      --stands) need_value "$@"; stands=$2; shift 2 ;;
      --note) need_value "$@"; note=$2; shift 2 ;;
      *) fail "unknown argument for revise: $1" ;;
    esac
  done
  if [ "$accepted" -eq 1 ]; then
    [ -z "$stands" ] || fail "pass --accepted or --stands, not both"
  else
    [ -n "$stands" ] || fail "revise requires --accepted (every objection acted on) or --stands <why at least one is not>"
    validate_one_line "--stands" "$stands"
  fi
  [ -z "$note" ] || validate_one_line "--note" "$note"

  local round artifact
  require_artifact
  round=$(ledger_get round)
  artifact=$(artifact_path)
  cp "$artifact" "$DIR/round-$round-revision.md"
  [ -z "$note" ] || ledger_set "round_${round}_note" "$note"
  if [ "$accepted" -eq 1 ]; then
    ledger_set "round_${round}_disposition" accepted
  else
    ledger_set "round_${round}_disposition" "stands: $stands"
  fi
  printf 'revision after round %s recorded (%s lines changed since the draft)\n' "$round" "$(changed_line_count)"

  if [ "$round" -lt "$CAP" ]; then
    ledger_set status open
    printf 'next: the SAME challenger checks the revision -\n'
    printf '  %s charge %s\n' "$0" "$id"
    return 0
  fi
  if [ "$accepted" -eq 1 ]; then
    ledger_set status ready
    printf 'ready after %s of %s rounds\n' "$round" "$CAP"
    printf 'next: %s close %s\n' "$0" "$id"
  else
    ledger_set status disagreement
    printf 'DISAGREEMENT after the final round: %s\n' "$stands"
    printf 'This does not get a third round. Put the objection and the reason it stands to the captain, then\n'
    printf '  %s close %s --escalated "<what you put to the captain>"\n' "$0" "$id"
  fi
}

cmd_show() {
  local id=$1; shift
  [ "$#" -eq 0 ] || fail "show takes no further arguments"
  set_paths "$id"
  require_ledger
  require_artifact
  local status round kind
  status=$(ledger_get status)
  round=$(ledger_get round)
  kind=$(ledger_get kind)
  printf 'cross-check %s: kind=%s status=%s rounds=%s/%s\n' "$id" "$kind" "$status" "$round" "$CAP"
  local n=1
  while [ "$n" -le "$round" ]; do
    if [ -f "$DIR/round-$n-objections.md" ]; then
      printf 'round %s: %s objection(s) - %s\n' "$n" \
        "$(grep -c '^O[0-9]' "$DIR/round-$n-objections.md" || true)" \
        "$DIR/round-$n-objections.md"
    else
      printf 'round %s: clean\n' "$n"
    fi
    local disp
    disp=$(ledger_get "round_${n}_disposition")
    [ -z "$disp" ] || printf '  author: %s\n' "$disp"
    n=$((n + 1))
  done
  printf '\nwhat the challenge changed (%s lines):\n' "$(changed_line_count)"
  diff_draft_to_current
}

cmd_close() {
  local id=$1; shift
  set_paths "$id"
  require_ledger
  local escalated=''
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --escalated) need_value "$@"; escalated=$2; shift 2 ;;
      *) fail "unknown argument for close: $1" ;;
    esac
  done
  [ -z "$escalated" ] || validate_one_line "--escalated" "$escalated"

  local status round changed
  status=$(ledger_get status)
  round=$(ledger_get round)
  case "$status" in
    ready)
      [ -z "$escalated" ] || ledger_set escalated "$escalated" ;;
    disagreement)
      [ -n "$escalated" ] || fail "this cross-check ended in disagreement; close it only with --escalated <what you put to the captain>, so an unresolved objection is never closed out quietly"
      ledger_set escalated "$escalated" ;;
    closed) fail "cross-check for $id is already closed" ;;
    *) fail "cross-check is '$status'; it closes only from ready or disagreement" ;;
  esac

  require_artifact
  diff_draft_to_current > "$DIR/changed.diff"
  changed=$(changed_line_count)
  ledger_set changed_lines "$changed"
  ledger_set outcome "$status"
  ledger_set status closed
  printf 'closed: %s cross-check %s after %s of %s rounds\n' "$id" "$status" "$round" "$CAP"
  if [ "$changed" -eq 0 ]; then
    printf 'the challenge changed NOTHING: draft and final are identical.\n'
    printf 'Record that plainly - a cross-check that never changes anything is not earning its cost.\n'
  else
    printf 'the challenge changed %s lines; the difference is at %s\n' "$changed" "$DIR/changed.diff"
  fi
}

cmd_state() {
  local id=$1; shift
  [ "$#" -eq 0 ] || fail "state takes no further arguments"
  set_paths "$id"
  if [ ! -f "$LEDGER" ]; then
    printf 'none\n'
    return 0
  fi
  ledger_get status
  printf '\n'
}

cmd_gate() {
  local id=$1; shift
  [ "$#" -eq 0 ] || fail "gate takes no further arguments"
  set_paths "$id"
  [ -f "$LEDGER" ] || return 0
  local status
  status=$(ledger_get status)
  [ "$status" != closed ] || return 0
  printf 'fm-crosscheck: %s has an open cross-check (%s) at %s\n' "$id" "$status" "$LEDGER" >&2
  printf 'Finish it, or close it, before this draft is used.\n' >&2
  return 1
}

case "${1:-}" in
  -h|--help|'') usage; exit 0 ;;
esac
VERB=$1; shift
[ "$#" -ge 1 ] || fail "$VERB requires a task id"
case "$VERB" in
  open) cmd_open "$@" ;;
  charge) cmd_charge "$@" ;;
  round) cmd_round "$@" ;;
  revise) cmd_revise "$@" ;;
  show) cmd_show "$@" ;;
  close) cmd_close "$@" ;;
  state) cmd_state "$@" ;;
  gate) cmd_gate "$@" ;;
  *) fail "unknown command: $VERB" ;;
esac
