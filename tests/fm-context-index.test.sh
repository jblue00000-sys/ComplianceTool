#!/usr/bin/env bash
# tests/fm-context-index.test.sh - behavior tests for bin/fm-context-index.
#
# Three layers, all through the tool's own interfaces:
#   1. tests/fm-context-index.test.py - chunker, content-hash dedupe, transcript
#      extraction, per-home identity derivation, and both guards as unit tests.
#   2. CLI contract - help, per-home identity, the home-derived transcript glob,
#      the documented start command delivering every compose variable and the
#      refusal to publish one containing whitespace, planned-chunk inventory
#      over a fixture home, per-kind counts, the tracked doctrine/ read from
#      the code root and indexed as this home's own records,
#      the warning for a transcript glob that matched nothing, kind filtering,
#      provenance metadata, and the refusal to touch the application Qdrant on
#      6333/6334.
#   3. Optional integration - real ingest, real incremental re-run, real search,
#      the refusal to index or search a collection another home claimed, and the
#      guarantee that a contaminated collection never answers with another
#      home's records. It skips cleanly, with a reason, when this home's own
#      instance or the local embedding model is unavailable, and always writes
#      to its own throwaway collections.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOL="$ROOT/bin/fm-context-index"

FAILED=0
fail() { printf 'not ok - %s\n' "$1" >&2; FAILED=1; }
pass() { printf 'ok - %s\n' "$1"; }
check() { if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 (want '$3', got '$2')"; fi; }

command -v python3 >/dev/null 2>&1 || { echo "skip: python3 not found"; exit 0; }

json_field() {  # <field> ; reads JSON on stdin
  python3 -c 'import json,sys; print(json.load(sys.stdin)[sys.argv[1]])' "$1"
}

# This home's own instance, exactly as the tool resolves it.
QDRANT_URL="${FM_CONTEXT_QDRANT_URL:-$(
  "$TOOL" identity --home "${FM_HOME:-$ROOT}" --json | json_field url)}"

SCRATCH=$(mktemp -d)
# Set only by the optional integration layer, which owns its own throwaway
# collections on this home's instance and never touches the home's own.
COLLECTION=
FOREIGN_COLLECTION=

# shellcheck disable=SC2329 # Invoked by the EXIT-trapped cleanup below.
drop_collection() {  # <collection>
  [ -n "$1" ] || return 0
  python3 - "$QDRANT_URL" "$1" <<'DROP' >/dev/null 2>&1 || true
import sys
import urllib.request

request = urllib.request.Request(
    "%s/collections/%s" % (sys.argv[1], sys.argv[2]), method="DELETE")
urllib.request.urlopen(request, timeout=10).read()
DROP
}

# shellcheck disable=SC2329 # Invoked by the EXIT trap below.
cleanup() {
  drop_collection "$COLLECTION"
  drop_collection "$FOREIGN_COLLECTION"
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
OTHER_HOME_DIR="$SCRATCH/other-home"
mkdir -p "$HOME_DIR/data/task-alpha" "$HOME_DIR/state" "$SCRATCH/transcripts"
mkdir -p "$OTHER_HOME_DIR/data" "$OTHER_HOME_DIR/state"
HOME_PATH="$(cd "$HOME_DIR" && pwd -P)"
OTHER_HOME_PATH="$(cd "$OTHER_HOME_DIR" && pwd -P)"

fixture_body() {  # <prefix>
  local i
  for i in $(seq 1 60); do
    printf '%s line %d about supervision, briefs, and merge authority\n' "$1" "$i"
  done
}

fixture_body captain > "$HOME_DIR/data/captain.md"
fixture_body learning > "$HOME_DIR/data/learnings.md"
fixture_body registry > "$HOME_DIR/data/projects.md"
# The other home holds real content, so a failed refusal would visibly write.
fixture_body other-home > "$OTHER_HOME_DIR/data/captain.md"
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

# --- per-home identity, the boundary between two instances -----------------

# What a home derives with nothing configured: the case a second copy of this
# environment runs in, so the ambient overrides must not mask it.
derived_identity() {  # <args...>
  env -u FM_CONTEXT_QDRANT_URL -u FM_CONTEXT_COLLECTION \
      -u FM_CONTEXT_INSTANCE -u FM_CONTEXT_TRANSCRIPTS "$TOOL" identity "$@"
}

derived_identity --home "$HOME_DIR" --json > "$SCRATCH/identity-a.json"
derived_identity --home "$OTHER_HOME_DIR" --json > "$SCRATCH/identity-b.json"

check "two homes collide on no identity the store is keyed by" \
  "$(python3 - "$SCRATCH/identity-a.json" "$SCRATCH/identity-b.json" <<'PY'
import json
import sys

a = json.load(open(sys.argv[1]))
b = json.load(open(sys.argv[2]))
keyed = ("instance", "url", "port", "collection", "container", "volume",
         "compose_project", "transcripts")
print(sorted(key for key in keyed if a[key] == b[key]) or "none")
PY
)" "none"

check "the identity is stable across runs" \
  "$(derived_identity --home "$HOME_DIR" --json | json_field collection)" \
  "$(json_field collection < "$SCRATCH/identity-a.json")"

check "the transcript glob is derived from the home, not a fixed path" \
  "$(json_field transcripts < "$SCRATCH/identity-a.json")" \
  "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects/$(
    printf '%s' "$HOME_PATH" | sed 's/[^A-Za-z0-9]/-/g')/*.jsonl"

derived_identity --home "$HOME_DIR" --env > "$SCRATCH/identity-a.env"

check "every compose variable is published for this home" \
  "$(cut -d= -f1 < "$SCRATCH/identity-a.env" | sort | tr '\n' ' ')" \
  "FM_CONTEXT_COLLECTION FM_CONTEXT_COMPOSE_PROJECT FM_CONTEXT_CONTAINER FM_CONTEXT_PORT FM_CONTEXT_QDRANT_URL FM_CONTEXT_VOLUME "

# The documented start command word-splits these assignments, so a published
# value containing whitespace would silently become two arguments. The
# transcript glob, the one value that can realistically contain a space, is
# reported by identity and identity --json but never published here.
check "the transcript glob identity reports is not published to compose" \
  "$(grep -c '^FM_CONTEXT_TRANSCRIPTS=' "$SCRATCH/identity-a.env" || true)" "0"

SPACED_CONFIG="$SCRATCH/con fig"
mkdir -p "$SPACED_CONFIG/projects"
check "no published value contains whitespace, even under a spaced config dir" \
  "$(CLAUDE_CONFIG_DIR="$SPACED_CONFIG" derived_identity --home "$HOME_DIR" --env |
    grep -c '[[:space:]]' || true)" "0"

# The guard exists so an unusual explicit override fails loudly by name rather
# than emitting a line the start command would word-split.
if "$TOOL" --instance "bad label" identity --home "$HOME_DIR" --env \
     >"$SCRATCH/guard.out" 2>"$SCRATCH/guard.err"; then
  fail "a value containing whitespace is refused rather than published"
elif grep -q "FM_CONTEXT_COMPOSE_PROJECT" "$SCRATCH/guard.err" &&
     grep -q "whitespace" "$SCRATCH/guard.err"; then
  pass "a value containing whitespace is refused rather than published"
else
  fail "a value containing whitespace is refused rather than published"
fi

# The documented start command, verbatim: an unquoted substitution whose
# assignments become arguments of env, so the child sees every one of them.
# shellcheck disable=SC2046 # Word splitting the assignments is the point here.
# shellcheck disable=SC2016 # Expansion must happen in the child env, not here.
check "the documented start command delivers every compose variable" \
  "$(env $(derived_identity --home "$HOME_DIR" --env) sh -c \
    'printf "%s %s %s %s %s %s\n" "$FM_CONTEXT_COMPOSE_PROJECT" \
      "$FM_CONTEXT_CONTAINER" "$FM_CONTEXT_VOLUME" "$FM_CONTEXT_PORT" \
      "$FM_CONTEXT_QDRANT_URL" "$FM_CONTEXT_COLLECTION"')" \
  "$(python3 - "$SCRATCH/identity-a.json" <<'PY'
import json
import sys

fields = json.load(open(sys.argv[1]))
print(" ".join(str(fields[key]) for key in (
    "compose_project", "container", "volume", "port", "url", "collection")))
PY
)"

# An overridden endpoint is the documented remedy for a port collision, so the
# port identity reports has to follow it: a port that disagreed with the URL
# would bind compose to one port while every command talked to another.
check "the derived port and the derived url agree" \
  "$(json_field url < "$SCRATCH/identity-a.json")" \
  "http://127.0.0.1:$(json_field port < "$SCRATCH/identity-a.json")"

check "an overridden url decides the port identity reports" \
  "$(FM_CONTEXT_QDRANT_URL="http://127.0.0.1:6700" "$TOOL" identity \
    --home "$HOME_DIR" --json | json_field port)" "6700"

check "an overridden url decides the port published to compose" \
  "$(FM_CONTEXT_QDRANT_URL="http://127.0.0.1:6700" "$TOOL" identity \
    --home "$HOME_DIR" --env | grep '^FM_CONTEXT_PORT=')" \
  "FM_CONTEXT_PORT=6700"

# --- an index run that matched no transcripts must never look like success ---

warn_run() {  # <transcript glob> <extra args...>
  "$TOOL" index --home "$HOME_DIR" --transcripts "$1" --dry-run \
    "${@:2}" >"$SCRATCH/warn.out" 2>"$SCRATCH/warn.err"
}

mkdir -p "$SCRATCH/no-sessions"
if warn_run "$SCRATCH/no-sessions/*.jsonl"; then
  pass "a home with no recorded sessions yet still succeeds"
else
  fail "a home with no recorded sessions yet still succeeds"
fi
if grep -q "expected on a first run" "$SCRATCH/warn.err" &&
   grep -qF "$SCRATCH/no-sessions" "$SCRATCH/warn.err"; then
  pass "an empty transcript directory warns and names the glob"
else
  fail "an empty transcript directory warns and names the glob"
fi

if warn_run "$SCRATCH/never-encoded/*.jsonl"; then
  pass "a transcript directory that does not exist still succeeds"
else
  fail "a transcript directory that does not exist still succeeds"
fi
if grep -q "does not exist" "$SCRATCH/warn.err" &&
   grep -q "CLAUDE_CONFIG_DIR" "$SCRATCH/warn.err" &&
   grep -q "FM_CONTEXT_TRANSCRIPTS" "$SCRATCH/warn.err"; then
  pass "a missing transcript directory names the overrides to check"
else
  fail "a missing transcript directory names the overrides to check"
fi

warn_run "$SCRATCH/never-encoded/*.jsonl" --kind status
check "excluding transcripts with --kind warns about nothing" \
  "$(wc -c <"$SCRATCH/warn.err" | tr -d ' ')" "0"

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
check "every requested kind is counted, including one that contributed nothing" \
  "$("$TOOL" index --home "$OTHER_HOME_DIR" --transcripts "$SCRATCH/no-sessions/*.jsonl" \
      --dry-run --json 2>/dev/null |
    python3 -c '
import json,sys
counts=json.load(sys.stdin)["chunks_by_kind"]
print(sorted(counts) == sorted(["brief","captain","learning","record","report","status","transcript"])
      and counts["transcript"] == 0 and counts["captain"] > 0)')" \
  "True"
check "task id is derived for per-task records" \
  "$(query_plan '{c["task"] for c in chunks if c["kind"] in ("report", "brief", "status")}')" \
  "{'task-alpha'}"
check "every chunk carries its source path" \
  "$(query_plan 'all(c.get("source") for c in chunks)')" "True"
check "every chunk carries a deterministic point id" \
  "$(query_plan 'len({c["id"] for c in chunks}) == len(chunks)')" "True"
check "every chunk is stamped with the home that indexed it" \
  "$(query_plan 'sorted({c["home"] for c in chunks})')" "['$HOME_PATH']"
check "the same content indexed by another home gets different point ids" \
  "$("$TOOL" index --home "$OTHER_HOME_DIR" \
      --transcripts "$SCRATCH/transcripts/*.jsonl" --dry-run --json --kind transcript |
    python3 -c '
import json,sys
other={c["id"] for c in json.load(sys.stdin)["chunks"]}
mine={c["id"] for c in json.load(open(sys.argv[1]))["chunks"] if c["kind"]=="transcript"}
print(bool(other) and bool(mine) and other.isdisjoint(mine))' "$SCRATCH/plan.json")" \
  "True"
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

# --- tracked doctrine is indexed as this home's own records ----------------
#
# Captain knowledge promoted out of data/captain.md and data/learnings.md into
# tracked doctrine/ must stay reachable by the same search, or it gets
# re-derived. It is read from the code root but must never widen the per-home
# store boundary: this home's identity, this home's collection, nothing else's.
# These run in the dry-run planner, so they need no embedding dependency.

DOCTRINE_ROOT="$SCRATCH/doctrine-root"
mkdir -p "$DOCTRINE_ROOT/doctrine"
fixture_body doctrine-principle > "$DOCTRINE_ROOT/doctrine/captain-principles.md"
fixture_body doctrine-learning > "$DOCTRINE_ROOT/doctrine/operational-learnings.md"

doctrine_plan() {  # <root> <home> ; prints the plan JSON
  FM_ROOT_OVERRIDE="$1" "$TOOL" index --home "$2" \
    --transcripts "$SCRATCH/no-sessions/*.jsonl" --dry-run --json 2>/dev/null
}

query_doctrine() {  # <plan file> <python expression over `chunks`>
  python3 - "$1" "$2" <<'PY'
import json
import sys

chunks = json.load(open(sys.argv[1]))["chunks"]
print(eval(sys.argv[2], {"chunks": chunks}))
PY
}

doctrine_plan "$DOCTRINE_ROOT" "$HOME_DIR" > "$SCRATCH/plan-doctrine.json"

check "tracked doctrine is classified like the local files it is the base for" \
  "$(query_doctrine "$SCRATCH/plan-doctrine.json" \
    'sorted({(c["source"].rsplit("/", 1)[1], c["kind"]) for c in chunks if "/doctrine/" in c["source"]})')" \
  "[('captain-principles.md', 'captain'), ('operational-learnings.md', 'learning')]"

check "doctrine chunks are stamped with the home that indexed them" \
  "$(query_doctrine "$SCRATCH/plan-doctrine.json" \
    'sorted({c["home"] for c in chunks if "/doctrine/" in c["source"]})')" \
  "['$HOME_PATH']"

# Two homes reading the same clone's doctrine still index into their own
# stores: the point ids must not collapse onto each other.
doctrine_plan "$DOCTRINE_ROOT" "$OTHER_HOME_DIR" > "$SCRATCH/plan-doctrine-other.json"
check "the same doctrine indexed by another home gets different point ids" \
  "$(python3 - "$SCRATCH/plan-doctrine.json" "$SCRATCH/plan-doctrine-other.json" <<'PY'
import json
import sys


def ids(path):
    return {c["id"] for c in json.load(open(path))["chunks"]
            if "/doctrine/" in c["source"]}


mine, other = ids(sys.argv[1]), ids(sys.argv[2])
print(bool(mine) and bool(other) and mine.isdisjoint(other))
PY
)" "True"

check "restricting to one kind restricts doctrine with it" \
  "$(FM_ROOT_OVERRIDE="$DOCTRINE_ROOT" "$TOOL" index --home "$HOME_DIR" \
      --transcripts "$SCRATCH/no-sessions/*.jsonl" --dry-run --json --kind learning |
    python3 -c '
import json, sys
chunks = json.load(sys.stdin)["chunks"]
sources = {c["source"] for c in chunks if "/doctrine/" in c["source"]}
print(sorted(s.rsplit("/", 1)[1] for s in sources))')" \
  "['operational-learnings.md']"

# A clone that carries no doctrine/ is not an error: it indexes the rest.
mkdir -p "$SCRATCH/rootless"
if doctrine_plan "$SCRATCH/rootless" "$HOME_DIR" > "$SCRATCH/plan-nodoctrine.json"; then
  check "a clone with no doctrine/ still indexes everything else" \
    "$(query_doctrine "$SCRATCH/plan-nodoctrine.json" \
      'not any("/doctrine/" in c["source"] for c in chunks) and len(chunks) > 0')" \
    "True"
else
  fail "a clone with no doctrine/ still indexes everything else"
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

for endpoint in "http://10.0.0.5:6700" "https://qdrant.example.com:6700"; do
  if out=$("$TOOL" --url "$endpoint" search probe 2>&1); then
    fail "a store off this machine at $endpoint is refused"
  elif printf '%s' "$out" | grep -q "is not this machine"; then
    pass "a store off this machine at $endpoint is refused"
  else
    fail "a store at $endpoint is refused with a clear reason ($out)"
  fi
done

for host in "127.0.0.1" "localhost" "[::1]"; do
  check "the loopback host $host is accepted" \
    "$("$TOOL" --url "http://$host:6700" identity --home "$HOME_DIR" --json 2>&1 |
      json_field url)" "http://$host:6700"
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
  echo "skip: this home's own context index is not reachable at $QDRANT_URL"
  echo "      start it with: env \$(bin/fm-context-index identity --env) docker compose \\"
  echo "        -f docs/examples/fm-context-qdrant.compose.yml up -d"
elif ! python3 -c 'import sentence_transformers' >/dev/null 2>&1; then
  echo "skip: sentence-transformers is not installed (see docs/context-index.md)"
else
  COLLECTION="fm-context-test-$$"

  run_index() {
    "$TOOL" --url "$QDRANT_URL" --collection "$COLLECTION" \
      index --home "$HOME_DIR" --transcripts "$SCRATCH/transcripts/*.jsonl" --json \
      2>>"$SCRATCH/integration.err"
  }

  run_search() {  # <query> <extra args...>
    "$TOOL" --url "$QDRANT_URL" --collection "$COLLECTION" \
      search "$1" --home "$HOME_DIR" "${@:2}"
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

    if ! run_search "why did the merge poll never fire" --k 3 --json \
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
        "$(run_search "supervision and merge authority" --k 5 --kind status --json 2>/dev/null |
          python3 -c '
import json,sys
print(sorted({h["payload"]["kind"] for h in json.load(sys.stdin)["hits"]}))')" \
        "['status']"

      # A store that somehow holds a second home's record must never answer
      # with it. Plant one directly, reusing an indexed vector so it would
      # otherwise rank first for the query that found that record.
      python3 - "$QDRANT_URL" "$COLLECTION" "$OTHER_HOME_PATH" <<'PLANT' >/dev/null
import json
import sys
import urllib.request

url, collection, other_home = sys.argv[1], sys.argv[2], sys.argv[3]


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        url + path, data=data, method=method,
        headers={"Content-Type": "application/json"} if data else {})
    return json.loads(urllib.request.urlopen(request, timeout=20).read())


scrolled = call("POST", "/collections/%s/points/scroll" % collection,
                {"limit": 1, "with_vector": True, "with_payload": True})
point = scrolled["result"]["points"][0]
call("PUT", "/collections/%s/points?wait=true" % collection, {"points": [{
    "id": "00000000-0000-4000-8000-00000000fead",
    "vector": point["vector"],
    "payload": {
        "kind": "report",
        "home": other_home,
        "source": other_home + "/data/other-task/report.md",
        "text": "the other application's private finding",
    },
}]})
PLANT

      check "a search never returns another home's record" \
        "$(run_search "why did the merge poll never fire" --k 20 --json 2>/dev/null |
          python3 -c '
import json,sys
hits=json.load(sys.stdin)["hits"]
print(bool(hits) and all(h["payload"]["home"] == sys.argv[1] for h in hits))' "$HOME_PATH")" \
        "True"
    fi

    # A collection this home claimed must refuse another home outright.
    FOREIGN_COLLECTION="fm-context-test-foreign-$$"
    "$TOOL" --url "$QDRANT_URL" --collection "$FOREIGN_COLLECTION" \
      index --home "$HOME_DIR" --transcripts "$SCRATCH/transcripts/*.jsonl" --json \
      >/dev/null 2>>"$SCRATCH/integration.err"

    if out=$("$TOOL" --url "$QDRANT_URL" --collection "$FOREIGN_COLLECTION" \
               index --home "$OTHER_HOME_DIR" --json 2>&1); then
      fail "indexing into a collection another home claimed is refused"
    elif printf '%s' "$out" | grep -q "belongs to the firstmate home"; then
      pass "indexing into a collection another home claimed is refused"
    else
      fail "indexing into a claimed collection is refused with a clear reason ($out)"
    fi

    check "the refused home wrote nothing into that collection" \
      "$(python3 - "$QDRANT_URL" "$FOREIGN_COLLECTION" "$OTHER_HOME_PATH" <<'COUNT'
import json
import sys
import urllib.request

body = json.dumps({"filter": {"must": [
    {"key": "home", "match": {"value": sys.argv[3]}}]}}).encode()
request = urllib.request.Request(
    "%s/collections/%s/points/count" % (sys.argv[1], sys.argv[2]),
    data=body, method="POST", headers={"Content-Type": "application/json"})
print(json.loads(urllib.request.urlopen(request, timeout=20).read())["result"]["count"])
COUNT
)" "0"

    if out=$("$TOOL" --url "$QDRANT_URL" --collection "$FOREIGN_COLLECTION" \
               search "merge authority" --home "$OTHER_HOME_DIR" 2>&1); then
      fail "searching a collection another home claimed is refused"
    elif printf '%s' "$out" | grep -q "belongs to the firstmate home"; then
      pass "searching a collection another home claimed is refused"
    else
      fail "searching a claimed collection is refused with a clear reason ($out)"
    fi
  fi
fi

exit "$FAILED"
