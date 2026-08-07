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
- The index is per-home: it reads the home given by `--home` (default `FM_HOME`) and the transcript glob for that home, and nothing else.

## Dedicated instance

Firstmate never shares a vector store with another project.
`docs/examples/fm-context-qdrant.compose.yml` defines the dedicated instance: its own container name `fm-context-qdrant`, its own pinned image, its own named volume `fm-context-qdrant-storage`, and `127.0.0.1:6631` bound to loopback with `restart: unless-stopped`.

```sh
docker compose -f docs/examples/fm-context-qdrant.compose.yml up -d    # start
docker compose -f docs/examples/fm-context-qdrant.compose.yml ps       # check
docker compose -f docs/examples/fm-context-qdrant.compose.yml down     # stop, keeping the volume
```

The default collection is `fm-context`, and the default endpoint is `http://127.0.0.1:6631`.
Ports 6333 and 6334 are the conventional Qdrant ports another project's own instance already serves, so the tool refuses to use them and says why rather than reading or writing a store that is not firstmate's.
`FM_CONTEXT_QDRANT_URL` and `FM_CONTEXT_COLLECTION` move the index elsewhere when a home wants its own endpoint or a throwaway collection.

## Dependencies

- Docker, for the dedicated instance above.
- Python 3, already required elsewhere in this repo.
  Qdrant is reached over its HTTP API from the standard library, so no client package is needed.
- `sentence-transformers`, installed locally: `pip3 install sentence-transformers`.
  The default model is `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions); `FM_CONTEXT_MODEL` selects another local model, and changing models means re-indexing into a fresh collection because vector sizes differ.

Both the index and search commands report the missing dependency and the exact install or start command instead of failing obscurely.

## What is indexed

| Kind | Source | Task id |
| ---- | ------ | ------- |
| `transcript` | Claude Code session transcripts for this home (`FM_CONTEXT_TRANSCRIPTS`, one document per session) | - |
| `captain` | `data/captain.md`, `data/captain-shared.md` | - |
| `learning` | `data/learnings.md` | - |
| `record` | every other `data/*.md`, such as the project registry, the secondmate routing table, and the backlog | - |
| `report` | `data/<id>/report.md` | `<id>` |
| `brief` | `data/<id>/brief.md` | `<id>` |
| `status` | `state/<id>.status` | `<id>` |

Transcripts keep only the user and assistant text turns.
Tool calls, tool results, hook and system records, slash-command plumbing, and injected reminders are dropped, so a search matches what was actually said rather than command output.

Documents are split into overlapping chunks of roughly 750 tokens with about 100 tokens of overlap, on line boundaries so a hit reads as a coherent snippet.
Each chunk carries its source path, kind, chunk position, content hash, timestamp, role, and the task or session id where one can be derived.

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
A chunk's point id is derived from the hash of its content and origin, so re-running after a quiet day embeds and writes only what actually changed, and a second run over unchanged material ingests nothing.
Edited text is ingested as a new chunk; the superseded chunk stays until the collection is rebuilt.

`search` prints ranked hits as score, kind, date, task, source path, and a compact snippet, or the same data as JSON.

## Limitations

- Refresh is manual: the index is as current as the last `index` run.
- Deletions and edits are not garbage-collected, so a source that shrinks leaves its older chunks searchable until the collection is dropped and rebuilt (`docker volume rm fm-context-qdrant-storage` after `down`, or delete just the `fm-context` collection).
- Chunk sizing uses a character-based token estimate rather than the model's tokenizer, so chunk boundaries are approximate.
- Retrieval is dense-vector only: there is no keyword, hybrid, or reranking pass, so exact-identifier lookups are still better served by `grep`.
- Only this home is indexed; another home indexes itself with its own `FM_HOME` and collection.

## Tests

`tests/fm-context-index.test.sh` covers chunking, content-hash dedupe, transcript extraction, the foreign-instance refusal, and the CLI contract everywhere.
Its integration layer exercises real ingest, a real incremental re-run, and real search in a throwaway collection on the dedicated instance, and skips with a reason when that instance or the embedding model is unavailable.
