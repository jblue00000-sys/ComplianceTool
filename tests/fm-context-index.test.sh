#!/usr/bin/env bash
# tests/fm-context-index.test.sh - behavior tests for bin/fm-context-index.
#
# Three layers, all through the tool's own interfaces:
#   1. tests/fm-context-index.test.py - chunker, content-hash dedupe, transcript
#      extraction, and the foreign-instance guard as unit tests.
#   2. CLI contract - help, planned-chunk inventory over a fixture home, kind
#      filtering, provenance metadata, and the refusal to touch the application
#      Qdrant on 6333/6334.
#   3. Optional integration - real ingest, real incremental re-run, and real
#      search against the DEDICATED fm-context Qdrant. It skips cleanly, with a
#      reason, when that instance or the local embedding model is unavailable,
#      and always writes to its own throwaway collection.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOL="$ROOT/bin/fm-context-index"
QDRANT_URL="${FM_CONTEXT_QDRANT_URL:-http://127.0.0.1:6631}"

FAILED=0
fail() { printf 'not ok - %s\n' "$1" >&2; FAILED=1; }
pass() { printf 'ok - %s\n' "$1"; }
check() { if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 (want '$3', got '$2')"; fi; }

command -v python3 >/dev/null 2>&1 || { echo "skip: python3 not found"; exit 0; }

SCRATCH=$(mktemp -d)
# Set only by the optional integration layer, which owns its own throwaway
# collection on the dedicated instance and never touches fm-context itself.
COLLECTION=

# shellcheck disable=SC2329 # Invoked by the EXIT-trapped cleanup below.
drop_collection() {
  [ -n "$COLLECTION" ] || return 0
  python3 - "$QDRANT_URL" "$COLLECTION" <<'DROP' >/dev/null 2>&1 || true
import sys
import urllib.request

request = urllib.request.Request(
    "%s/collections/%s" % (sys.argv[1], sys.argv[2]), method="DELETE")
urllib.request.urlopen(request, timeout=10).read()
DROP
}

# shellcheck disable=SC2329 # Invoked by the EXIT trap below.
cleanup() {
  drop_collection
  rm -rf "$SCRATCH"
}
trap cleanup EXIT

# --- layer 1: unit tests ---------------------------------------------------

if python3 "$ROOT/tests/fm-context-index.test.py" >"$SCRATCH/unit.log" 2>&1; then
  pass "chunker, dedupe, and extraction unit tests"
else
  fail "chunker, dedupe, and extraction unit tests"
  cat "$SCRATCH/unit.log" >&2
fi

# --- layer 2: CLI contract over a fixture home -----------------------------

HOME_DIR="$SCRATCH/home"
mkdir -p "$HOME_DIR/data/task-alpha" "$HOME_DIR/state" "$SCRATCH/transcripts"

fixture_body() {  # <prefix>
  local i
  for i in $(seq 1 60); do
    printf '%s line %d about supervision, briefs, and merge authority\n' "$1" "$i"
  done
}

fixture_body captain > "$HOME_DIR/data/captain.md"
fixture_body learning > "$HOME_DIR/data/learnings.md"
fixture_body registry > "$HOME_DIR/data/projects.md"
fixture_body report > "$HOME_DIR/data/task-alpha/report.md"
fixture_body brief > "$HOME_DIR/data/task-alpha/brief.md"
{
  echo "working: started the investigation of the failing merge poll"
  echo "done: report written with the reproduction and the recommended fix"
} > "$HOME_DIR/state/task-alpha.status"

python3 - "$SCRATCH/transcripts/session-one.jsonl" <<'PY'
import json
import sys

turns = [
    {"type": "user", "timestamp": "2026-08-01T10:00:00Z", "sessionId": "session-one",
     "message": {"role": "user", "content": "why did the merge poll never fire"}},
    {"type": "assistant", "timestamp": "2026-08-01T10:00:05Z", "sessionId": "session-one",
     "message": {"role": "assistant", "content": [
         {"type": "text", "text": "the poll was armed before the head was recorded " * 40},
         {"type": "tool_use", "name": "Bash", "input": {"command": "cat state/x.meta"}},
     ]}},
    {"type": "user", "timestamp": "2026-08-01T10:00:09Z", "sessionId": "session-one",
     "message": {"role": "user", "content": [
         {"type": "tool_result", "content": "pr=https://example.invalid/pr/1"}]}},
    {"type": "system", "timestamp": "2026-08-01T10:00:10Z", "subtype": "hook"},
]
with open(sys.argv[1], "w", encoding="utf-8") as handle:
    for turn in turns:
        handle.write(json.dumps(turn) + "\n")
PY

plan() {  # <extra args...>
  "$TOOL" index --home "$HOME_DIR" \
    --transcripts "$SCRATCH/transcripts/*.jsonl" --dry-run --json "$@" 2>"$SCRATCH/plan.err"
}

if ! plan > "$SCRATCH/plan.json"; then
  fail "dry-run planning over the fixture home"
  cat "$SCRATCH/plan.err" >&2
else
  pass "dry-run planning over the fixture home"
fi

query_plan() {  # <python expression over `plan`>
  python3 - "$SCRATCH/plan.json" "$1" <<'PY'
import json
import sys

plan = json.load(open(sys.argv[1]))
print(eval(sys.argv[2], {"plan": plan, "chunks": plan["chunks"]}))
PY
}

check "every documented kind is planned" \
  "$(query_plan 'sorted({c["kind"] for c in chunks})' )" \
  "['brief', 'captain', 'learning', 'record', 'report', 'status', 'transcript']"
check "task id is derived for per-task records" \
  "$(query_plan '{c["task"] for c in chunks if c["kind"] in ("report", "brief", "status")}')" \
  "{'task-alpha'}"
check "every chunk carries its source path" \
  "$(query_plan 'all(c.get("source") for c in chunks)')" "True"
check "every chunk carries a deterministic point id" \
  "$(query_plan 'len({c["id"] for c in chunks}) == len(chunks)')" "True"
check "transcript chunks record their session and timestamp" \
  "$(query_plan '[c["session"] for c in chunks if c["kind"] == "transcript"][:1]')" \
  "['session-one']"
check "tool results never enter a transcript chunk" \
  "$(query_plan 'any("example.invalid" in c["text"] for c in chunks)')" "False"
check "planning is idempotent for unchanged content" \
  "$(plan > "$SCRATCH/plan2.json" && python3 -c '
import json,sys
a=json.load(open(sys.argv[1]))["chunks"]; b=json.load(open(sys.argv[2]))["chunks"]
print([c["id"] for c in a] == [c["id"] for c in b])' "$SCRATCH/plan.json" "$SCRATCH/plan2.json")" \
  "True"

if plan --kind status > "$SCRATCH/plan-status.json"; then
  check "kind filtering restricts ingestion" \
    "$(python3 -c '
import json,sys
print(sorted({c["kind"] for c in json.load(open(sys.argv[1]))["chunks"]}))' "$SCRATCH/plan-status.json")" \
    "['status']"
else
  fail "kind filtering restricts ingestion"
fi

if "$TOOL" index --home "$HOME_DIR" --kind nonsense --dry-run >/dev/null 2>&1; then
  fail "an unknown kind is refused"
else
  pass "an unknown kind is refused"
fi

for port in 6333 6334; do
  if out=$("$TOOL" --url "http://127.0.0.1:$port" search probe 2>&1); then
    fail "the application Qdrant on $port is refused"
  elif printf '%s' "$out" | grep -q "refusing to use"; then
    pass "the application Qdrant on $port is refused"
  else
    fail "the application Qdrant on $port is refused with a clear reason"
  fi
done

if "$TOOL" --help 2>&1 | grep -q 'docs/context-index.md'; then
  pass "help points at the operator documentation"
else
  fail "help points at the operator documentation"
fi

# --- layer 3: optional dedicated-instance integration ----------------------

integration() {
  python3 - "$QDRANT_URL" <<'PY' || return 1
import sys
import urllib.request

try:
    urllib.request.urlopen(sys.argv[1] + "/collections", timeout=3).read()
except Exception:
    sys.exit(1)
PY
  return 0
}

if ! integration; then
  echo "skip: the dedicated fm-context Qdrant is not reachable at $QDRANT_URL"
  echo "      start it with: docker compose -f docs/examples/fm-context-qdrant.compose.yml up -d"
elif ! python3 -c 'import sentence_transformers' >/dev/null 2>&1; then
  echo "skip: sentence-transformers is not installed (see docs/context-index.md)"
else
  COLLECTION="fm-context-test-$$"

  run_index() {
    "$TOOL" --url "$QDRANT_URL" --collection "$COLLECTION" \
      index --home "$HOME_DIR" --transcripts "$SCRATCH/transcripts/*.jsonl" --json \
      2>>"$SCRATCH/integration.err"
  }

  if ! run_index > "$SCRATCH/ingest1.json"; then
    fail "first ingest into the dedicated instance"
    cat "$SCRATCH/integration.err" >&2
  else
    pass "first ingest into the dedicated instance"
    check "first ingest writes every planned chunk" \
      "$(python3 -c '
import json,sys
d=json.load(open(sys.argv[1])); print(d["chunks_new"] == d["chunks_seen"] and d["chunks_new"] > 0)' "$SCRATCH/ingest1.json")" \
      "True"

    if ! run_index > "$SCRATCH/ingest2.json"; then
      fail "second ingest into the dedicated instance"
    else
      check "re-running ingests nothing new" \
        "$(python3 -c '
import json,sys
d=json.load(open(sys.argv[1])); print(d["chunks_new"] == 0 and d["chunks_unchanged"] > 0)' "$SCRATCH/ingest2.json")" \
        "True"
    fi

    if ! "$TOOL" --url "$QDRANT_URL" --collection "$COLLECTION" \
      search "why did the merge poll never fire" --k 3 --json \
      > "$SCRATCH/search.json" 2>>"$SCRATCH/integration.err"; then
      fail "search returns ranked hits"
    else
      check "search returns ranked hits with provenance" \
        "$(python3 -c '
import json,sys
hits=json.load(open(sys.argv[1]))["hits"]
print(bool(hits) and all(h["payload"].get("source") and h["payload"].get("kind") for h in hits))' "$SCRATCH/search.json")" \
        "True"
      check "search honors the kind filter" \
        "$("$TOOL" --url "$QDRANT_URL" --collection "$COLLECTION" \
            search "supervision and merge authority" --k 5 --kind status --json 2>/dev/null |
          python3 -c '
import json,sys
print(sorted({h["payload"]["kind"] for h in json.load(sys.stdin)["hits"]}))')" \
        "['status']"
    fi
  fi
fi

exit "$FAILED"
