#!/usr/bin/env bash
# tests/fm-doctrine.test.sh - the privacy boundary tracked doctrine crosses.
#
# doctrine/ holds captain knowledge that is universal enough to travel with
# every clone. That makes it shareable material, while data/ is gitignored and
# private, so promoting a fact from data/ into doctrine/ is the one place where
# private content can become shared content by accident.
#
# Coverage:
#   - both known doctrine files are tracked, present, and non-empty, so the
#     session start that prints them has something to print in a fresh clone
#   - no machine path, email address, account-qualified repository reference,
#     or credential-shaped string crosses into the tracked half, for every
#     tracked file under doctrine/ rather than a hardcoded list: the scan is
#     the private-to-shared boundary, so it must never cover less than what a
#     clone actually receives.
set -u

# shellcheck source=tests/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

KNOWN_DOCTRINE_FILES="doctrine/captain-principles.md doctrine/operational-learnings.md"

# Everything git would hand a fresh clone under doctrine/, into the global
# DOCTRINE_TRACKED. Derived, never hardcoded: a file added or renamed tomorrow
# is scanned without a test edit. It fills a global rather than printing
# through a command substitution so a fail() here aborts the run instead of
# dying in a subshell the caller would ignore.
DOCTRINE_TRACKED=()
load_tracked_doctrine_files() {
  local rel
  DOCTRINE_TRACKED=()
  while IFS= read -r -d '' rel; do
    DOCTRINE_TRACKED+=("$rel")
  done < <(git -C "$ROOT" ls-files -z -- doctrine)
  # A vacuous pass is worse than a failure: reporting success having scanned
  # nothing would hide a doctrine directory that stopped being tracked.
  [ "${#DOCTRINE_TRACKED[@]}" -gt 0 ] \
    || fail "git tracks no file under doctrine/, so the privacy scan would check nothing"
}

test_doctrine_files_are_tracked_and_populated() {
  local rel tracked
  load_tracked_doctrine_files
  tracked=$(printf '%s\n' "${DOCTRINE_TRACKED[@]}")
  for rel in $KNOWN_DOCTRINE_FILES; do
    [ -s "$ROOT/$rel" ] || fail "$rel must exist and be non-empty: a clone starts with whatever this file holds"
    case "$tracked" in
      *"$rel"*) ;;
      *) fail "$rel is not tracked by git, so it would not reach a new clone" ;;
    esac
  done
  pass "doctrine files are tracked and populated"
}

# One private-content class per pattern, each with the reason it must not be
# in shared material. Patterns are deliberately generic: naming the captain's
# own accounts or paths here would itself put them in tracked material.
test_doctrine_carries_no_private_material() {
  local rel hits
  local -a checks=(
    '/Users/[A-Za-z0-9._-]|/home/[A-Za-z0-9._-]|/Volumes/[A-Za-z0-9._-]:an absolute machine path'
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}:an email address'
    'github\.com[:/][A-Za-z0-9_.-]+/|gitlab\.com[:/][A-Za-z0-9_.-]+/:an account-qualified repository reference'
    '(ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{10,}|sk-[A-Za-z0-9]{16,}|xox[baprs]-[A-Za-z0-9-]{10,}:a credential-shaped string'
    '(TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY)[[:space:]]*=[[:space:]]*[^[:space:]]+:an assigned secret value'
  )
  local entry pattern reason
  load_tracked_doctrine_files
  for rel in "${DOCTRINE_TRACKED[@]}"; do
    [ -f "$ROOT/$rel" ] \
      || fail "$rel is tracked but unreadable here, so it would ship unscanned"
    for entry in "${checks[@]}"; do
      pattern=${entry%:*}
      reason=${entry##*:}
      hits=$(grep -nEi -- "$pattern" "$ROOT/$rel" || true)
      [ -z "$hits" ] || fail "$rel contains $reason, which must stay in private data/: $hits"
    done
  done
  pass "${#DOCTRINE_TRACKED[@]} tracked doctrine files carry no machine path, address, account reference, or credential"
}

test_doctrine_files_are_tracked_and_populated
test_doctrine_carries_no_private_material

echo "# fm-doctrine.test.sh: all assertions passed"
