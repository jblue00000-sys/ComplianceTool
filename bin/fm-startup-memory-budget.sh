#!/usr/bin/env bash
# Read and account for the local startup-memory budget.
# Usage:
#   fm-startup-memory-budget.sh read
#   fm-startup-memory-budget.sh report
#
# `read` prints the one validated effective budget from
# config/startup-memory-budget.  `report` prints the stable local estimate for
# data/captain.md, data/captain-shared.md, and data/learnings.md together, then
# reports the tracked doctrine/ files separately, against their own ceiling and
# never against this home's allowance.
#
# Doctrine shares the startup prompt-memory surface but is changed through the
# firstmate PR path rather than by local curation, so it is bounded instead by
# its own repository-owned ceiling, reported in the same
# within-budget/over-budget vocabulary.
# Bootstrap owns default materialization; this command never creates or repairs
# configuration, so an absent, malformed, symlinked, hardlinked, or otherwise
# unsafe value is a concrete error rather than an inferred default.
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FM_ROOT="${FM_ROOT_OVERRIDE:-$(cd "$SCRIPT_DIR/.." && pwd)}"
FM_HOME="${FM_HOME:-${FM_ROOT_OVERRIDE:-$FM_ROOT}}"
CONFIG="${FM_CONFIG_OVERRIDE:-$FM_HOME/config}"
DATA="${FM_DATA_OVERRIDE:-$FM_HOME/data}"

# shellcheck source=bin/fm-startup-memory-budget-lib.sh
. "$SCRIPT_DIR/fm-startup-memory-budget-lib.sh"
# shellcheck source=bin/fm-doctrine-lib.sh
. "$SCRIPT_DIR/fm-doctrine-lib.sh"

usage() {
  sed -n '2,11{s/^# \{0,1\}//;p;}' "$0"
}

print_error() {
  printf 'startup-memory-budget: %s\n' "$1" >&2
}

# A single status token naming why a doctrine file could not be measured. The
# path is dropped: the file= field already identifies it.
doctrine_failure_status() {
  local reason
  reason=$(printf '%s' "${FM_STARTUP_MEMORY_BUDGET_ERROR%%:*}" \
    | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-')
  reason=${reason#-}
  reason=${reason%-}
  printf 'unmeasured-%s\n' "${reason:-measurement-failed}"
}

read_budget() {
  if ! fm_startup_memory_budget_read "$CONFIG" >/dev/null; then
    print_error "invalid config/$FM_STARTUP_MEMORY_BUDGET_FILE - $FM_STARTUP_MEMORY_BUDGET_ERROR"
    return 1
  fi
  printf '%s\n' "$FM_STARTUP_MEMORY_BUDGET_VALUE"
}

report() {
  local budget bytes tokens presence total=0 shared_tokens=0 role=primary
  local doctrine_total=0 doctrine_unmeasured=0
  if ! budget=$(read_budget); then
    return 2
  fi

  if [ -e "$FM_HOME/.fm-secondmate-home" ] || [ -L "$FM_HOME/.fm-secondmate-home" ]; then
    role=secondmate
  fi

  printf 'estimator=ceil(UTF-8 bytes / 3) conservative-local-estimate\n'
  printf 'role=%s\n' "$role"
  printf 'effective_budget_tokens=%s\n' "$budget"
  for file in captain.md captain-shared.md learnings.md; do
    if ! fm_startup_memory_measure_file "$DATA/$file" >/dev/null; then
      print_error "$FM_STARTUP_MEMORY_BUDGET_ERROR"
      return 2
    fi
    bytes=$FM_STARTUP_MEMORY_MEASURE_BYTES
    tokens=$FM_STARTUP_MEMORY_MEASURE_TOKENS
    presence=$FM_STARTUP_MEMORY_MEASURE_PRESENCE
    total=$((total + tokens))
    [ "$file" != captain-shared.md ] || shared_tokens=$tokens
    printf 'file=data/%s bytes=%s estimated_tokens=%s status=%s\n' \
      "$file" "$bytes" "$tokens" "$presence"
  done
  printf 'total_estimated_tokens=%s\n' "$total"
  if fm_startup_memory_decimal_le "$total" "$budget"; then
    printf 'budget_status=within-budget\n'
  else
    printf 'budget_status=over-budget\n'
  fi
  if [ "$role" = secondmate ] \
    && ! fm_startup_memory_decimal_le "$shared_tokens" "$budget"; then
    printf 'exception=primary-owned-shared-file-alone-exceeds-budget\n'
  fi

  # The tracked doctrine files are part of the same startup prompt-memory
  # surface, so their cost is reported. They are deliberately NOT added to
  # total_estimated_tokens: the budget is this home's allowance for the local
  # memory a /stow pass can actually curate, and doctrine changes only through
  # the firstmate PR path. Counting an uncurateable constant against a local
  # allowance would produce excess no local pass could ever clear.
  #
  # For the same reason a doctrine file this home cannot measure degrades to a
  # reported status instead of failing the report: the local accounting a /stow
  # pass depends on is complete and correct, and no local curation could repair
  # a tracked file anyway. Local files stay fail-closed above.
  # The set is derived, not named: a doctrine file this clone carries but the
  # accounting never saw would escape the ceiling entirely, and splitting an
  # over-large file is exactly what the ceiling's own failure message asks for.
  # bin/fm-doctrine-lib.sh owns the set the session-start digest walks too.
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    if ! fm_startup_memory_measure_file "$FM_ROOT/doctrine/$file" >/dev/null; then
      print_error "$FM_STARTUP_MEMORY_BUDGET_ERROR"
      printf 'file=doctrine/%s bytes=unknown estimated_tokens=unknown status=%s\n' \
        "$file" "$(doctrine_failure_status)"
      doctrine_unmeasured=$((doctrine_unmeasured + 1))
      continue
    fi
    doctrine_total=$((doctrine_total + FM_STARTUP_MEMORY_MEASURE_TOKENS))
    printf 'file=doctrine/%s bytes=%s estimated_tokens=%s status=%s\n' \
      "$file" "$FM_STARTUP_MEMORY_MEASURE_BYTES" \
      "$FM_STARTUP_MEMORY_MEASURE_TOKENS" "$FM_STARTUP_MEMORY_MEASURE_PRESENCE"
  done < <(fm_doctrine_all_names "$FM_ROOT")
  printf 'tracked_doctrine_estimated_tokens=%s not-counted-against-local-budget\n' \
    "$doctrine_total"

  # Excluded from the home allowance, but not unbounded: tracked doctrine gets
  # its own ceiling in the same vocabulary, so growth that no local /stow pass
  # could ever curate still has one place that says it went too far. The
  # ceiling is a repository constant owned by fm-startup-memory-budget-lib.sh,
  # not per-home configuration, because doctrine only changes through the PR
  # path that would review it.
  printf 'tracked_doctrine_ceiling_tokens=%s\n' \
    "$FM_STARTUP_MEMORY_DOCTRINE_CEILING"
  if fm_startup_memory_decimal_le "$doctrine_total" \
    "$FM_STARTUP_MEMORY_DOCTRINE_CEILING"; then
    printf 'tracked_doctrine_status=within-budget\n'
  else
    printf 'tracked_doctrine_status=over-budget\n'
  fi
  # A within-budget verdict computed from an incomplete measurement would read
  # as an all-clear it did not earn, so the missing files are named beside it.
  if [ "$doctrine_unmeasured" -gt 0 ]; then
    printf 'tracked_doctrine_unmeasured_files=%s\n' "$doctrine_unmeasured"
  fi
}

case "${1:-}" in
  read)
    [ "$#" -eq 1 ] || { usage >&2; exit 2; }
    read_budget
    ;;
  report)
    [ "$#" -eq 1 ] || { usage >&2; exit 2; }
    report
    ;;
  -h|--help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
