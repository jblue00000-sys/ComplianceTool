#!/usr/bin/env bash
# fm-worker-rules-lib.sh - render the standing crewmate rules for one task.
#
# Tracked worker-rules.md is the single owner of the rule text. This library is
# the single owner of how a variant is selected, which blocks it needs, and how
# the {{TOKEN}} placeholders are filled. bin/fm-brief.sh renders a variant at
# scaffold time purely to validate it, and bin/fm-spawn.sh renders the same
# variant at launch and joins it to the task-specific brief, so the rules reach
# the worker inside its launch prompt rather than through a pointer it could
# decline to follow.
#
# Source-safe: defines functions and one constant only.
#
# Public interface:
#   fm_worker_rules_declare <kind> <mode> <herdr-lab 0|1> <repo> <result-var>
#       Build the one-line declaration a scaffolded brief carries.
#   fm_worker_rules_declaration <brief-path> <result-var>
#       Read that line back. Returns 1 when the brief carries none (a brief
#       scaffolded before this contract, which launches unchanged).
#   fm_worker_rules_field <declaration> <name> <result-var>
#       Read one key=value field out of a declaration line.
#   fm_worker_rules_strip_declaration <brief-path> <result-var>
#       The brief's own text with the first declaration line removed, so task
#       text that quotes one survives into the worker's launch prompt.
#   fm_worker_rules_render <kind> <mode> <herdr-lab 0|1> <id> <repo>
#                          <state-dir> <data-dir> <fm-root> <result-var>
#       The rendered standing document for that variant.
#   fm_worker_rules_compose <brief-path> <id> <state-dir> <data-dir> <fm-root>
#                           <result-var>
#       The launch prompt a declared brief produces: its own task text followed
#       by the rendered rules. Returns 1 when the brief declares no variant, so
#       the caller launches that brief unchanged.
#
# Every failure prints one diagnostic naming the missing owner and returns
# non-zero; a shortened or partially rendered rule set is never returned.
# Locals carry a _wr_ prefix because callers pass their own variable NAMES in,
# and an unprefixed local would shadow the caller's result variable.
# Bash 3.2 compatible.

# Bash 5.2 turns patsub_replacement on by default, which expands an unquoted &
# in a ${var//pattern/replacement} replacement to the text the pattern matched.
# A firstmate home, project path, repo name, or FM_CLASSIFY_PAUSED_VERB carrying
# an & would then re-insert the {{TOKEN}} it was filling and trip the
# unfilled-placeholder guard below with a message that wrongly blames
# worker-rules.md. Quoting the replacement is not an option at this repo's bash
# 3.2 floor, where it inserts literal quote characters into the rendered rules.
# This is a no-op before 5.2, and no replacement anywhere in bin/ wants & to
# expand, so turning it off process-wide is safe for the scripts that source
# this library.
shopt -u patsub_replacement 2>/dev/null || true

FM_WORKER_RULES_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=bin/fm-classify-lib.sh
. "$FM_WORKER_RULES_LIB_DIR/fm-classify-lib.sh"

FM_WORKER_RULES_DECLARATION_PREFIX='<!-- worker-rules: v1 '

fm_worker_rules_shell_quote() {  # <text> <result-var>
  local _wr_quoted=''
  _wr_quoted=$(printf '%s' "$1" | sed "s/'/'\\\\''/g")
  printf -v "$2" "'%s'" "$_wr_quoted"
}

# Tracked worker-rules.md under the given code root; there is no override.
fm_worker_rules_file() {  # <fm-root> <result-var>
  printf -v "$2" '%s' "$1/worker-rules.md"
}

fm_worker_rules_declare() {  # <kind> <mode> <herdr-lab> <repo> <result-var>
  local _wr_word=off
  [ "$3" = 1 ] && _wr_word=on
  printf -v "$5" '%s%s -->' "$FM_WORKER_RULES_DECLARATION_PREFIX" \
    "kind=$1 mode=$2 herdr-lab=$_wr_word repo=$4"
}

fm_worker_rules_declaration() {  # <brief-path> <result-var>
  local _wr_line=''
  _wr_line=$(grep '^<!-- worker-rules: ' -- "$1" 2>/dev/null | head -n 1) || true
  [ -n "$_wr_line" ] || return 1
  printf -v "$2" '%s' "$_wr_line"
}

fm_worker_rules_field() {  # <declaration> <name> <result-var>
  local _wr_rest=''
  case " $1 " in
    *" $2="*) ;;
    *) return 1 ;;
  esac
  _wr_rest=${1#*" $2="}
  printf -v "$3" '%s' "${_wr_rest%% *}"
}

fm_worker_rules_strip_declaration() {  # <brief-path> <result-var>
  local _wr_text=''
  _wr_text=$(awk '
    !stripped && /^<!-- worker-rules: / { stripped = 1; next }
    { print }
  ' < "$1") || return 1
  printf -v "$2" '%s' "$_wr_text"
}

# Extract one fenced block. Returns 1 when the block is absent and 3 when its
# start fence is never closed, so a truncated rule set can never be mistaken for
# a deliberately empty one.
fm_worker_rules_block() {  # <rules-file> <block-name> <result-var>
  local _wr_text='' _wr_status=0
  _wr_text=$(awk -v name="$2" '
    $0 == "<!-- rules:" name ":end -->" && inside { inside = 0; closed = 1; next }
    inside { print }
    $0 == "<!-- rules:" name ":start -->" { started = 1; inside = 1 }
    END {
      if (!started) exit 1
      if (!closed) exit 3
    }
  ' "$1") || _wr_status=$?
  case "$_wr_status" in
    0) ;;
    1)
      echo "error: $1 has no <!-- rules:$2 --> block; restore that block there rather than writing the standing rules into a brief by hand" >&2
      return 1 ;;
    *)
      echo "error: the $2 block in $1 opens with <!-- rules:$2:start --> but is never closed by a matching <!-- rules:$2:end --> line; restore that end fence there so a worker gets the whole block and nothing else" >&2
      return 3 ;;
  esac
  printf -v "$3" '%s' "$_wr_text"
}

# The standing quality bar has exactly one owner: the fenced block in tracked
# doctrine/captain-principles.md. This reads it; nothing else may restate it.
fm_worker_rules_quality_bar() {  # <fm-root> <result-var>
  local _wr_src=$1/doctrine/captain-principles.md _wr_text='' _wr_status=0
  if [ -r "$_wr_src" ]; then
    _wr_text=$(awk '
      /^<!-- quality-bar:end -->$/ && inside { inside = 0; closed = 1; next }
      inside { print }
      /^<!-- quality-bar:start -->$/ { started = 1; inside = 1 }
      END { if (started && !closed) exit 3 }
    ' "$_wr_src") || _wr_status=$?
  fi
  if [ "$_wr_status" -ne 0 ]; then
    echo "error: the quality-bar block in $_wr_src opens with <!-- quality-bar:start --> but is never closed by a matching <!-- quality-bar:end --> line; restore that end fence there so a ship brief carries the bar and nothing else" >&2
    return 1
  fi
  if [ -z "$_wr_text" ]; then
    echo "error: no quality-bar block found in $_wr_src; a ship brief must carry the standing quality bar, so restore the fenced <!-- quality-bar:start --> block there rather than writing one into the brief by hand" >&2
    return 1
  fi
  printf -v "$2" '%s' "$_wr_text"
}

fm_worker_rules_render() {  # <kind> <mode> <herdr-lab> <id> <repo> <state-dir> <data-dir> <fm-root> <result-var>
  local _wr_kind=$1 _wr_mode=$2 _wr_herdr=$3 _wr_id=$4 _wr_repo=$5
  local _wr_state=$6 _wr_data=$7 _wr_root=$8 _wr_out=$9
  local _wr_file='' _wr_herdr_text='' _wr_body='' _wr_paused='' _wr_status_file=''
  local _wr_helper='' _wr_bar='' _wr_setup2='' _wr_rule1='' _wr_dod=''

  fm_worker_rules_file "$_wr_root" _wr_file
  [ -r "$_wr_file" ] || {
    echo "error: no readable standing worker rules at $_wr_file; a worker must be launched with them, so restore that tracked file rather than launching without it" >&2
    return 1
  }

  case "$_wr_kind" in
    ship|scout) ;;
    *) echo "error: no standing worker rules variant for kind '$_wr_kind'" >&2; return 1 ;;
  esac

  if [ "$_wr_herdr" = 1 ]; then
    fm_worker_rules_block "$_wr_file" herdr-lab _wr_herdr_text || return 1
    fm_worker_rules_shell_quote "$_wr_root/bin/fm-herdr-lab.sh" _wr_helper
    _wr_herdr_text=${_wr_herdr_text//\{\{HERDR_LAB_HELPER\}\}/$_wr_helper}
  else
    fm_worker_rules_block "$_wr_file" herdr-declaration _wr_herdr_text || return 1
  fi

  fm_worker_rules_block "$_wr_file" "$_wr_kind" _wr_body || return 1

  if [ "$_wr_kind" = ship ]; then
    case "$_wr_mode" in
      no-mistakes|direct-PR|local-only) ;;
      *) echo "error: no standing worker rules variant for delivery mode '$_wr_mode'" >&2; return 1 ;;
    esac
    fm_worker_rules_quality_bar "$_wr_root" _wr_bar || return 1
    fm_worker_rules_block "$_wr_file" "ship-setup2-$_wr_mode" _wr_setup2 || return 1
    fm_worker_rules_block "$_wr_file" "ship-rule1-$_wr_mode" _wr_rule1 || return 1
    fm_worker_rules_block "$_wr_file" "ship-dod-$_wr_mode" _wr_dod || return 1
    _wr_body=${_wr_body//\{\{QUALITY_BAR\}\}/$_wr_bar}
    _wr_body=${_wr_body//\{\{SETUP2\}\}/$_wr_setup2}
    _wr_body=${_wr_body//\{\{RULE1\}\}/$_wr_rule1}
    _wr_body=${_wr_body//\{\{DOD\}\}/$_wr_dod}
  fi

  _wr_paused=${FM_CLASSIFY_PAUSED_VERB:-$FM_CLASSIFY_PAUSED_VERB_DEFAULT}
  fm_worker_rules_shell_quote "$_wr_state/$_wr_id.status" _wr_status_file
  _wr_body=${_wr_body//\{\{HERDR_SECTION\}\}/$_wr_herdr_text}
  _wr_body=${_wr_body//\{\{STATUS_FILE\}\}/$_wr_status_file}
  _wr_body=${_wr_body//\{\{PAUSED_VERB\}\}/$_wr_paused}
  _wr_body=${_wr_body//\{\{FM_ROOT\}\}/$_wr_root}
  _wr_body=${_wr_body//\{\{DATA\}\}/$_wr_data}
  _wr_body=${_wr_body//\{\{REPO\}\}/$_wr_repo}
  _wr_body=${_wr_body//\{\{ID\}\}/$_wr_id}

  case "$_wr_body" in
    *'{{'*)
      echo "error: the rendered worker rules still contain an unfilled {{TOKEN}} placeholder; $_wr_file and bin/fm-worker-rules-lib.sh disagree about the tokens this variant needs" >&2
      return 1 ;;
  esac
  printf -v "$_wr_out" '%s' "$_wr_body"
}

fm_worker_rules_compose() {  # <brief-path> <id> <state-dir> <data-dir> <fm-root> <result-var>
  local _wr_brief=$1 _wr_id=$2 _wr_state=$3 _wr_data=$4 _wr_root=$5 _wr_out=$6
  local _wr_decl='' _wr_kind='' _wr_mode='' _wr_repo='' _wr_word='' _wr_herdr=0 _wr_text='' _wr_task=''

  fm_worker_rules_declaration "$_wr_brief" _wr_decl || return 1
  fm_worker_rules_field "$_wr_decl" kind _wr_kind || _wr_kind=
  fm_worker_rules_field "$_wr_decl" mode _wr_mode || _wr_mode=
  fm_worker_rules_field "$_wr_decl" repo _wr_repo || _wr_repo=
  fm_worker_rules_field "$_wr_decl" herdr-lab _wr_word || _wr_word=off
  [ "$_wr_word" = on ] && _wr_herdr=1
  if [ -z "$_wr_kind" ] || [ -z "$_wr_repo" ]; then
    echo "error: $_wr_brief carries an unreadable worker-rules declaration ($_wr_decl); re-scaffold the brief with bin/fm-brief.sh so its standing rules can be rendered" >&2
    return 1
  fi
  fm_worker_rules_render "$_wr_kind" "$_wr_mode" "$_wr_herdr" "$_wr_id" "$_wr_repo" \
    "$_wr_state" "$_wr_data" "$_wr_root" _wr_text || return 1
  fm_worker_rules_strip_declaration "$_wr_brief" _wr_task || {
    echo "error: could not read the task text out of $_wr_brief" >&2
    return 1
  }
  printf -v "$_wr_out" '%s\n\n%s' "$_wr_task" "$_wr_text"
}
