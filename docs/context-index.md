# Local context index

`bin/fm-context-index` makes one firstmate home's conversational and operational history semantically searchable.
It embeds session transcripts, durable records, per-task briefs and reports, and status history into a local vector store, then answers plain-language queries with provenance.
The script's own header and `--help` own its exact flags and environment variables.

This is the ingestion and search layer only.
How agents are expected to query it, and any automatic refresh, are separate pieces of work; nothing here schedules, watches, or hooks anything.

## Privacy boundary

Every part of this stays on the machine that runs it.

- Embeddings are computed by a local [sentence-transformers](https://www.sbert.net/) model.
  No embedding API, no cloud inference, and no request that carries indexed text off the machine.
  The first run downloads the model weights from the model hub into the local cache; after that the tool works offline.
- Vectors and payloads live in a Qdrant instance that is bound to loopback only.
  The endpoint is loopback-only in the tool as well: it talks to `127.0.0.1`, `::1`, and `localhost` and refuses any other host, so a stray `FM_CONTEXT_QDRANT_URL` cannot ship transcripts, records, and briefs to a remote machine.
  A remote store would have to be a separate, deliberate decision.
- The index is per-home: it reads the home given by `--home` (default `FM_HOME`) and the transcript glob for that home, and nothing else.

## One store per home

Nothing about the store is a shared constant.
Every identity it uses is derived from the resolved home, so a second copy of this environment in another folder gets its own store the moment it runs, with nothing to configure and nothing to remember:

| Identity | Derived as | Example for a home at `/Users/you/appB` |
| -------- | ---------- | --------------------------------------- |
| instance label | the home's folder name plus a short digest of its absolute path | `appb-83e5f876` |
| collection | `fm-context-<instance>` | `fm-context-appb-83e5f876` |
| container | `fm-context-qdrant-<instance>` | `fm-context-qdrant-appb-83e5f876` |
| volume | `fm-context-qdrant-storage-<instance>` | `fm-context-qdrant-storage-appb-83e5f876` |
| compose project | `fm-context-<instance>` | `fm-context-appb-83e5f876` |
| loopback port | a digest of the home path, inside the reserved window 6600-6899 | `127.0.0.1:6857` |
| transcripts | Claude Code's directory for that home: its absolute path with every non-alphanumeric character replaced by a dash | `~/.claude/projects/-Users-you-appB/*.jsonl` |

The folder name keeps the label recognisable while debugging; the digest keeps two homes whose folders share a name apart.
The values are a pure function of the home path, so they survive restarts, reboots, and reinstalls unchanged.

`bin/fm-context-index identity` prints all of them, and every `index` and `search` result names the collection and endpoint it used, so which store is in play is never a guess:

```sh
bin/fm-context-index identity            # what this home resolves to
bin/fm-context-index identity --json     # the same, machine-readable
bin/fm-context-index identity --env      # KEY=value assignments for the compose file
```

### What a second copy of this environment gets, and what it does not see

A second copy is a separate application's environment, so its index is separate too.

It gets its own container, volume, port, and collection, built from its own transcripts, records, briefs, reports, and status history.
It cannot read the first copy's conversation history, captain records, briefs, scout reports, or status history, and the first copy cannot read this one's.
That separation is the point rather than a limitation, but it has a real cost worth stating: a question asked in one application's session cannot recall how the same problem was solved in the other.
Knowledge that should travel between applications belongs in a durable record that each home carries, not in a shared index.

### Three refusals, so a misconfiguration stops rather than leaks

- A host other than `127.0.0.1`, `::1`, or `localhost` is refused by name, because nothing indexed here may leave the device.
- Ports 6333 and 6334 are the conventional Qdrant ports an application's own instance already serves, so the tool refuses to use them and says why rather than reading or writing a store that is not firstmate's.
- The first `index` run stamps a collection with the home that owns it.
  Indexing or searching a collection stamped by a different home is refused, naming both homes, rather than performed.
  A collection no home has claimed is not refused; the next `index` claims it.

Search is additionally bound to the indexing home: every result must carry this home's path, so a collection that somehow ended up holding two homes' records still answers with only this home's.
Point ids include the indexing home for the same reason, so two homes can never collapse onto one record.

## Starting this home's instance

`docs/examples/fm-context-qdrant.compose.yml` defines the store: its own pinned image, `restart: unless-stopped`, and a loopback-only port.
Its project, container, volume, and port all come from `identity --env`, and every one of them is required, so a missing value stops compose by name instead of starting an unidentified container:

```sh
env $(bin/fm-context-index identity --env) docker compose -f docs/examples/fm-context-qdrant.compose.yml up -d    # start
env $(bin/fm-context-index identity --env) docker compose -f docs/examples/fm-context-qdrant.compose.yml ps       # check
env $(bin/fm-context-index identity --env) docker compose -f docs/examples/fm-context-qdrant.compose.yml down     # stop, keeping the volume
```

The substitution is deliberately unquoted: `identity --env` prints one assignment per line, and word-splitting them into arguments of `env` is exactly what the command needs.
So that this stays safe, `identity --env` publishes only values that cannot contain whitespace, and refuses by name if an override ever gives it one.
The transcript glob is the one value that can realistically contain a space, so it is not published there at all; compose does not need it, and `identity` and `identity --json` still print it.

Two homes derive different ports, so their instances run side by side.
If two homes ever do collide on a port, Docker refuses the second bind visibly and `FM_CONTEXT_QDRANT_URL` moves one of them.
The port an identity reports always comes from the endpoint in use, so an overridden URL moves the compose bind with it and `identity` never names a port the tool does not talk to.

### Overrides

Each setting below replaces exactly one derived value; a command-line flag wins over the environment variable, which wins over the derived default.

| Variable | Flag | Replaces |
| -------- | ---- | -------- |
| `FM_HOME` | `--home` | the home every other value is derived from |
| `FM_CONTEXT_INSTANCE` | `--instance` | the instance label, and with it the collection, container, volume, and compose project |
| `FM_CONTEXT_QDRANT_URL` | `--url` | the endpoint, including the derived port; the host must be `127.0.0.1`, `::1`, or `localhost` |
| `FM_CONTEXT_COLLECTION` | `--collection` | the collection name |
| `FM_CONTEXT_TRANSCRIPTS` | `--transcripts` (on `index`) | the transcript glob, for an unusual Claude Code layout |
| `CLAUDE_CONFIG_DIR` | - | the config directory the transcript glob is derived under |
| `FM_CONTEXT_MODEL` | `--model` | the local embedding model |

## Migrating a store built before per-home identity

The first version of this tool used one fixed collection, `fm-context`, on one fixed port, `127.0.0.1:6631`, in a container named `fm-context-qdrant`.
A home that indexed into it re-indexes instead of renaming anything, because rebuilding is one command and every source it needs is still on disk:

```sh
env $(bin/fm-context-index identity --env) docker compose -f docs/examples/fm-context-qdrant.compose.yml up -d
bin/fm-context-index index
```

Nothing is lost: the index is derived entirely from local transcripts and records, so the rebuilt collection contains what the old one did, minus chunks whose sources have since been deleted.
Once the new store answers searches, retire the old one:

```sh
docker rm -f fm-context-qdrant
docker volume rm fm-context-qdrant-storage
```

## Dependencies

- Docker, for the instance above.
- Python 3, already required elsewhere in this repo.
  Qdrant is reached over its HTTP API from the standard library, so no client package is needed.
- `sentence-transformers`, installed locally: `pip3 install sentence-transformers`.
  The default model is `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions); `FM_CONTEXT_MODEL` selects another local model, and changing models means re-indexing into a fresh collection because vector sizes differ.

Both the index and search commands report the missing dependency and the exact install or start command instead of failing obscurely.

## What is indexed

| Kind | Source | Task id |
| ---- | ------ | ------- |
| `transcript` | Claude Code session transcripts for this home, from the glob derived above (one document per session) | - |
| `captain` | `data/captain.md`, `data/captain-shared.md`, tracked `doctrine/captain-principles.md` | - |
| `learning` | `data/learnings.md`, tracked `doctrine/operational-learnings.md` | - |
| `record` | every other `data/*.md`, such as the project registry, the secondmate routing table, and the backlog, plus any other tracked `doctrine/*.md` | - |
| `report` | `data/<id>/report.md` | `<id>` |
| `brief` | `data/<id>/brief.md` | `<id>` |
| `status` | `state/<id>.status` | `<id>` |

The tracked `doctrine/` files are read from the invoking clone's code root (`FM_ROOT_OVERRIDE`, else the clone the command itself lives in), while every store identity still comes from the home, and they are indexed as that home's records into that home's own collection.
Run without `--home`, which is how a session uses it, that is the instance's own clone into the instance's own collection.
Run with `--home`, it is the invoking clone's doctrine into the named home's collection, which may sit at a different fast-forward point; the store boundary is unaffected either way, since no other home's collection is read or written.
A clone with no `doctrine/` directory simply contributes nothing from it.

Transcripts keep only the user and assistant text turns.
Tool calls, tool results, hook and system records, slash-command plumbing, and injected reminders are dropped, so a search matches what was actually said rather than command output.

Documents are split into overlapping chunks of roughly 750 tokens with about 100 tokens of overlap, on line boundaries so a hit reads as a coherent snippet.
Each chunk carries its source path, kind, chunk position, content hash, indexing home, timestamp, role, and the task or session id where one can be derived.

## Running it

```sh
bin/fm-context-index index                          # ingest this home incrementally
bin/fm-context-index index --dry-run                # show what would be ingested
bin/fm-context-index index --kind report --kind brief
bin/fm-context-index search "kratos session limit"
bin/fm-context-index search "merge authority" --k 5 --kind captain --kind learning
bin/fm-context-index search "why the poll never fired" --json
```

Ingestion is incremental and idempotent.
A chunk's point id is derived from the hash of its content, origin, and indexing home, so re-running after a quiet day embeds and writes only what actually changed, and a second run over unchanged material ingests nothing.
Edited text is ingested as a new chunk; the superseded chunk stays until the collection is rebuilt.

`index` reports the chunks each source kind contributed, in both its human and `--json` output, so a kind that contributed nothing is visible rather than absorbed into one total.
When transcripts were asked for and the derived glob matched no files, the run still succeeds, because a home with no recorded sessions yet is the normal first run, but it warns on stderr and names the exact glob that matched nothing.
If the glob's directory does not exist at all, the warning says so and points at the likely causes: an `FM_HOME` reached through a symlink, so the resolved path is not the one Claude Code encoded, or a `CLAUDE_CONFIG_DIR` that differs for the invoking shell.
Excluding transcripts deliberately with `--kind` silences it.

`search` prints the collection and endpoint it used, then ranked hits as score, kind, date, task, source path, and a compact snippet, or the same data as JSON.

## Limitations

- Refresh is manual: the index is as current as the last `index` run.
- Deletions and edits are not garbage-collected, so a source that shrinks leaves its older chunks searchable until the collection is dropped and rebuilt: stop the instance, `docker volume rm` the volume `identity` names, and index again, or delete just this home's collection.
- Chunk sizing uses a character-based token estimate rather than the model's tokenizer, so chunk boundaries are approximate.
- Retrieval is dense-vector only: there is no keyword, hybrid, or reranking pass, so exact-identifier lookups are still better served by `grep`.
- Only this home is indexed, and only this home's records are returned; another home indexes and searches its own store.

## Tests

`tests/fm-context-index.test.sh` covers chunking, content-hash dedupe, transcript extraction, per-home identity derivation, the home-derived transcript glob, both empty-glob warnings, per-kind counts, tracked-doctrine ingestion and its per-home point ids, all three refusals, and the CLI contract everywhere.
Its integration layer exercises real ingest, a real incremental re-run, real search, the refusal to index or search a collection another home claimed, and the guarantee that a contaminated collection never answers with another home's records.
It writes only to its own throwaway collections, and skips with a reason when this home's instance or the embedding model is unavailable.
