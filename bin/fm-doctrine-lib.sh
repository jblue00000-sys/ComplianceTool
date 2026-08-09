# shellcheck shell=bash
# The tracked doctrine set, resolved from a code root.
# Usage: . bin/fm-doctrine-lib.sh
#
# One owner for "which files are doctrine", so the session-start digest that
# loads them and the accounting that bounds them can never cover different
# sets.  A tracked doctrine file that is measured but never printed, or printed
# but never measured, would look perfectly healthy while reaching no agent or
# escaping the ceiling; deriving both from here removes that failure instead of
# catching it afterwards.
#
# The set is resolved by listing the directory, never by asking git: a session
# start must work in any clone, however it was obtained, whether or not git is
# installed, and whatever shape the worktree has.  Tests use `git ls-files` to
# prove the TRACKED set - what a new clone actually receives - is covered by
# what this listing finds.

FM_DOCTRINE_CAPTAIN_FILE="captain-principles.md"
FM_DOCTRINE_LEARNINGS_FILE="operational-learnings.md"

# fm_doctrine_paired_names
# The two files whose position carries meaning: each is the universal base for
# one local memory file and is read immediately before it.  Named rather than
# listed from disk because that pairing is the contract, and because their
# absence is itself meaningful and must still be reported.
fm_doctrine_paired_names() {
  printf '%s\n%s\n' "$FM_DOCTRINE_CAPTAIN_FILE" "$FM_DOCTRINE_LEARNINGS_FILE"
}

# fm_doctrine_additional_names <code-root>
# Every other doctrine file this clone carries, sorted for determinism, so a
# file added tomorrow is loaded and accounted without editing either caller.
# A clone with no doctrine/ directory prints nothing and is not an error.
fm_doctrine_additional_names() {
  local root=$1 path name
  for path in "$root/doctrine"/*.md; do
    [ -e "$path" ] || [ -L "$path" ] || continue
    name=${path##*/}
    case "$name" in
      "$FM_DOCTRINE_CAPTAIN_FILE"|"$FM_DOCTRINE_LEARNINGS_FILE") continue ;;
    esac
    printf '%s\n' "$name"
  done | LC_ALL=C sort
}

# fm_doctrine_all_names <code-root>
# The paired files first, then every additional file, which is the order both
# the accounting and the digest walk.
fm_doctrine_all_names() {
  fm_doctrine_paired_names
  fm_doctrine_additional_names "$1"
}
