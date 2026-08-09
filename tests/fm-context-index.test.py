#!/usr/bin/env python3
"""Unit tests for bin/fm-context-index's chunker, dedupe, and home identity.

Driven by tests/fm-context-index.test.sh, which owns the gate reporting.
"""
import http.server
import importlib.machinery
import importlib.util
import os
import shlex
import tempfile
import threading
import unittest
from pathlib import Path

SCRIPT_PATH = Path(__file__).parents[1] / "bin" / "fm-context-index"
SPEC = importlib.util.spec_from_loader(
    "fm_context_index",
    importlib.machinery.SourceFileLoader("fm_context_index", str(SCRIPT_PATH)),
)
INDEX = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(INDEX)


def paragraph(word: str, count: int) -> str:
    return "\n".join("%s %d" % (word, i) for i in range(count))


class ChunkTextTest(unittest.TestCase):
    def test_short_text_is_one_chunk(self):
        text = "captain prefers plain outcomes over mechanics in every report"
        self.assertEqual(INDEX.chunk_text(text), [text])

    def test_text_below_the_minimum_is_dropped(self):
        self.assertEqual(INDEX.chunk_text("too short"), [])

    def test_long_text_splits_into_bounded_chunks(self):
        chunks = INDEX.chunk_text(paragraph("line", 800))
        self.assertGreater(len(chunks), 1)
        for chunk in chunks:
            self.assertLessEqual(
                INDEX.estimate_tokens(chunk), INDEX.TARGET_TOKENS * 2)

    def test_consecutive_chunks_overlap(self):
        chunks = INDEX.chunk_text(paragraph("line", 800))
        first_tail = chunks[0].splitlines()[-1]
        self.assertIn(first_tail, chunks[1].splitlines())

    def test_chunking_is_deterministic(self):
        text = paragraph("line", 500)
        self.assertEqual(INDEX.chunk_text(text), INDEX.chunk_text(text))

    def test_oversized_single_line_is_kept_whole(self):
        line = "x" * (INDEX.TARGET_TOKENS * 8)
        chunks = INDEX.chunk_text(line)
        self.assertEqual(chunks, [line])

    def test_invalid_overlap_is_refused(self):
        with self.assertRaises(INDEX.ContextIndexError):
            INDEX.chunk_text("some text that is long enough to chunk",
                             target_tokens=10, overlap_tokens=10)


class ContentHashTest(unittest.TestCase):
    def test_same_content_same_id(self):
        left = INDEX.content_hash("report", "/a/report.md", "finding text")
        right = INDEX.content_hash("report", "/a/report.md", "finding text")
        self.assertEqual(INDEX.point_id(left), INDEX.point_id(right))

    def test_different_text_differs(self):
        left = INDEX.content_hash("report", "/a/report.md", "finding text")
        right = INDEX.content_hash("report", "/a/report.md", "other text")
        self.assertNotEqual(INDEX.point_id(left), INDEX.point_id(right))

    def test_different_source_differs(self):
        left = INDEX.content_hash("report", "/a/report.md", "finding text")
        right = INDEX.content_hash("report", "/b/report.md", "finding text")
        self.assertNotEqual(INDEX.point_id(left), INDEX.point_id(right))

    def test_point_id_is_a_uuid(self):
        value = INDEX.point_id(INDEX.content_hash("brief", "/b", "text"))
        self.assertRegex(
            value, r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

    def test_different_home_differs(self):
        left = INDEX.content_hash("report", "/r.md", "finding", "/homes/a")
        right = INDEX.content_hash("report", "/r.md", "finding", "/homes/b")
        self.assertNotEqual(INDEX.point_id(left), INDEX.point_id(right))


class InstanceIdentityTest(unittest.TestCase):
    """Two homes must not collide on any identity the store is keyed by."""

    KEYED = ("instance", "url", "port", "collection", "container", "volume",
             "compose_project", "transcripts")

    def test_two_homes_differ_in_every_keyed_identity(self):
        left = INDEX.Instance("/homes/appA").fields()
        right = INDEX.Instance("/homes/appB").fields()
        for key in self.KEYED:
            self.assertNotEqual(left[key], right[key], key)

    def test_same_folder_name_under_different_parents_still_differs(self):
        left = INDEX.Instance("/one/firstmate").fields()
        right = INDEX.Instance("/two/firstmate").fields()
        for key in self.KEYED:
            self.assertNotEqual(left[key], right[key], key)

    def test_identity_is_stable_across_calls(self):
        self.assertEqual(INDEX.Instance("/homes/appA").fields(),
                         INDEX.Instance("/homes/appA").fields())

    def test_slug_stays_readable(self):
        self.assertTrue(INDEX.Instance("/homes/appA").slug.startswith("appa-"))

    def test_derived_port_stays_inside_the_reserved_window(self):
        for name in ("appA", "appB", "firstmate", "x", "a-very-long-home-name"):
            port = INDEX.Instance("/homes/" + name).port
            self.assertGreaterEqual(port, INDEX.PORT_WINDOW_START)
            self.assertLess(
                port, INDEX.PORT_WINDOW_START + INDEX.PORT_WINDOW_SIZE)
            self.assertNotIn(port, INDEX.FOREIGN_QDRANT_PORTS)

    def test_explicit_settings_override_the_derived_ones(self):
        instance = INDEX.Instance(
            "/homes/appA", url="http://127.0.0.1:6999",
            collection="scratch", transcripts="/tmp/t/*.jsonl", label="tagged")
        self.assertEqual(instance.url, "http://127.0.0.1:6999")
        self.assertEqual(instance.collection, "scratch")
        self.assertEqual(instance.transcripts, "/tmp/t/*.jsonl")
        self.assertEqual(instance.container, "fm-context-qdrant-tagged")

    def test_the_derived_url_carries_the_derived_port(self):
        instance = INDEX.Instance("/homes/appA")
        self.assertEqual(instance.port, INDEX.instance_port(instance.home))
        self.assertEqual(instance.url, "http://127.0.0.1:%d" % instance.port)

    def test_an_explicit_url_decides_the_reported_port(self):
        instance = INDEX.Instance("/homes/appA", url="http://127.0.0.1:6700")
        self.assertEqual(instance.port, 6700)
        self.assertEqual(instance.fields()["port"], 6700)
        self.assertIn("FM_CONTEXT_PORT=6700", instance.environment())
        self.assertIn("FM_CONTEXT_QDRANT_URL=http://127.0.0.1:6700",
                      instance.environment())

    def test_a_portless_explicit_url_is_still_refused(self):
        with self.assertRaises(INDEX.ContextIndexError):
            INDEX.Instance("/homes/appA", url="http://localhost")

    def test_environment_assignments_cover_every_compose_variable(self):
        keys = {line.split("=", 1)[0]
                for line in INDEX.Instance("/homes/appA").environment()}
        self.assertEqual(
            {"FM_CONTEXT_COMPOSE_PROJECT", "FM_CONTEXT_CONTAINER",
             "FM_CONTEXT_VOLUME", "FM_CONTEXT_PORT", "FM_CONTEXT_QDRANT_URL",
             "FM_CONTEXT_COLLECTION"}, keys)

    def test_an_ordinary_value_is_emitted_unquoted(self):
        assignments = INDEX.Instance("/homes/appA").environment()
        self.assertIn("FM_CONTEXT_CONTAINER=%s"
                      % INDEX.Instance("/homes/appA").container, assignments)

    def test_the_transcript_glob_is_not_published_to_compose(self):
        glob = "/con fig/projects/-homes-appA/*.jsonl"
        instance = INDEX.Instance("/homes/appA", transcripts=glob)
        self.assertEqual(instance.fields()["transcripts"], glob)
        self.assertNotIn("FM_CONTEXT_TRANSCRIPTS",
                         {line.split("=", 1)[0]
                          for line in instance.environment()})

    def test_no_published_value_contains_whitespace(self):
        # The documented start command word-splits these assignments, so one
        # word per assignment is what keeps it correct.
        assignments = INDEX.Instance(
            "/homes/appA", transcripts="/con fig/p/*.jsonl").environment()
        self.assertEqual(assignments, shlex.split(" ".join(assignments)))

    def test_a_value_containing_whitespace_is_refused_by_name(self):
        instance = INDEX.Instance("/homes/appA", label="bad label")
        with self.assertRaises(INDEX.ContextIndexError) as caught:
            instance.environment()
        self.assertIn("FM_CONTEXT_COMPOSE_PROJECT", str(caught.exception))


class TranscriptGlobTest(unittest.TestCase):
    def test_glob_is_derived_from_the_home_path(self):
        glob = INDEX.Instance("/homes/appA").transcripts
        self.assertTrue(glob.endswith("/-homes-appA/*.jsonl"), glob)

    def test_every_non_alphanumeric_character_becomes_a_dash(self):
        glob = INDEX.Instance("/a.b/c_d/e f").transcripts
        self.assertTrue(glob.endswith("/-a-b-c-d-e-f/*.jsonl"), glob)

    def test_claude_config_dir_relocates_the_glob(self):
        previous = os.environ.get("CLAUDE_CONFIG_DIR")
        os.environ["CLAUDE_CONFIG_DIR"] = "/elsewhere/claude"
        try:
            glob = INDEX.Instance("/homes/appA").transcripts
        finally:
            if previous is None:
                del os.environ["CLAUDE_CONFIG_DIR"]
            else:
                os.environ["CLAUDE_CONFIG_DIR"] = previous
        self.assertEqual(glob, "/elsewhere/claude/projects/-homes-appA/*.jsonl")


class EmptyTranscriptGlobTest(unittest.TestCase):
    """A glob that matched nothing must be named, and its cause told apart."""

    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory()
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)

    def test_a_matching_transcript_warns_about_nothing(self):
        (self.root / "session.jsonl").write_text("{}\n", encoding="utf-8")
        self.assertIsNone(
            INDEX.transcript_glob_warning(str(self.root / "*.jsonl")))

    def test_an_existing_but_empty_directory_reads_as_a_first_run(self):
        pattern = str(self.root / "*.jsonl")
        message = INDEX.transcript_glob_warning(pattern)
        self.assertIn(pattern, message)
        self.assertIn("expected on a first run", message)

    def test_a_missing_directory_names_the_overrides_to_check(self):
        pattern = str(self.root / "never-encoded" / "*.jsonl")
        message = INDEX.transcript_glob_warning(pattern)
        self.assertIn(pattern, message)
        self.assertIn("does not exist", message)
        self.assertIn("FM_CONTEXT_TRANSCRIPTS", message)
        self.assertIn("CLAUDE_CONFIG_DIR", message)

    def test_excluding_transcripts_collects_without_warning(self):
        warnings = []
        original = INDEX.warn
        INDEX.warn = warnings.append
        self.addCleanup(setattr, INDEX, "warn", original)
        INDEX.collect(self.root, str(self.root / "nowhere" / "*.jsonl"), ["status"])
        self.assertEqual(warnings, [])
        INDEX.collect(self.root, str(self.root / "nowhere" / "*.jsonl"), None)
        self.assertEqual(len(warnings), 1)


class KindCountsTest(unittest.TestCase):
    def records(self, *kinds):
        return [{"kind": kind} for kind in kinds]

    def test_a_requested_kind_that_contributed_nothing_counts_zero(self):
        counts = INDEX.kind_counts(self.records("status"), ["status", "transcript"])
        self.assertEqual(counts, {"status": 1, "transcript": 0})

    def test_an_unfiltered_run_counts_every_kind(self):
        counts = INDEX.kind_counts(self.records("captain", "captain"), None)
        self.assertEqual(set(counts), set(INDEX.KINDS))
        self.assertEqual(counts["captain"], 2)
        self.assertEqual(counts["transcript"], 0)


class SelectNewTest(unittest.TestCase):
    def records(self):
        return INDEX.make_chunks(
            "learning", "/home/data/learnings.md", paragraph("learned fact", 400))

    def test_nothing_indexed_yet_selects_everything(self):
        records = self.records()
        new, skipped = INDEX.select_new(records, [])
        self.assertEqual(len(new), len(records))
        self.assertEqual(skipped, 0)

    def test_second_pass_selects_nothing(self):
        records = self.records()
        new, skipped = INDEX.select_new(
            records, [record["id"] for record in records])
        self.assertEqual(new, [])
        self.assertEqual(skipped, len(records))

    def test_duplicate_ids_within_one_batch_collapse(self):
        records = self.records()
        new, skipped = INDEX.select_new(records + records, [])
        self.assertEqual(len(new), len(records))
        self.assertEqual(skipped, len(records))

    def test_only_changed_chunks_are_new(self):
        records = self.records()
        existing = [record["id"] for record in records[1:]]
        new, skipped = INDEX.select_new(records, existing)
        self.assertEqual([record["id"] for record in new], [records[0]["id"]])
        self.assertEqual(skipped, len(records) - 1)


class TranscriptExtractionTest(unittest.TestCase):
    def test_plain_string_content_is_kept(self):
        self.assertEqual(
            INDEX.message_text({"role": "user", "content": "what broke the build"}),
            "what broke the build")

    def test_tool_blocks_are_skipped(self):
        message = {"content": [
            {"type": "text", "text": "running the tests now"},
            {"type": "tool_use", "name": "Bash", "input": {"command": "ls"}},
            {"type": "tool_result", "content": "a lot of output"},
        ]}
        self.assertEqual(INDEX.message_text(message), "running the tests now")

    def test_thinking_blocks_are_skipped(self):
        message = {"content": [
            {"type": "thinking", "thinking": "half-formed scratch reasoning"},
            {"type": "text", "text": "the tests pass"},
        ]}
        self.assertEqual(INDEX.message_text(message), "the tests pass")

    def test_system_reminders_are_stripped(self):
        message = {"content": [
            {"type": "text",
             "text": "keep this<system-reminder>drop this</system-reminder>"},
        ]}
        self.assertEqual(INDEX.message_text(message), "keep this")

    def test_slash_command_plumbing_is_skipped(self):
        message = {"content": "<command-name>/afk</command-name>"}
        self.assertEqual(INDEX.message_text(message), "")

    def test_non_message_input_is_empty(self):
        self.assertEqual(INDEX.message_text(None), "")
        self.assertEqual(INDEX.message_text({"content": 7}), "")


class ForeignInstanceGuardTest(unittest.TestCase):
    def test_application_rag_ports_are_refused(self):
        for port in INDEX.FOREIGN_QDRANT_PORTS:
            with self.assertRaises(INDEX.ContextIndexError):
                INDEX.resolve_url("http://127.0.0.1:%d" % port)

    def test_portless_url_defaults_to_the_refused_port(self):
        with self.assertRaises(INDEX.ContextIndexError):
            INDEX.resolve_url("http://localhost")

    def test_dedicated_port_is_accepted_without_trailing_slash(self):
        self.assertEqual(
            INDEX.resolve_url("http://127.0.0.1:6631/"), "http://127.0.0.1:6631")

    def test_every_loopback_host_is_accepted(self):
        for host in ("127.0.0.1", "localhost", "[::1]"):
            url = "http://%s:6631" % host
            self.assertEqual(INDEX.resolve_url(url), url)

    def test_a_remote_host_is_refused_by_name(self):
        for url in ("http://10.0.0.5:6700", "https://qdrant.example.com:6700"):
            with self.assertRaises(INDEX.ContextIndexError) as caught:
                INDEX.resolve_url(url)
            self.assertIn(url.split("//")[1].split(":")[0], str(caught.exception))

    def test_a_url_with_no_host_is_refused(self):
        with self.assertRaises(INDEX.ContextIndexError):
            INDEX.resolve_url("127.0.0.1:6700")


class CollectionAbsenceTest(unittest.TestCase):
    """Absence is decided by the HTTP status, never by the rendered message.

    The bodies below all contain the digits 404, as a real Qdrant error naming
    a collection whose derived slug contains them would.
    """

    def client(self, status):
        body = b'{"status":{"error":"collection fm-context-a404b1c2 unavailable"}}'

        class Handler(http.server.BaseHTTPRequestHandler):
            def respond(self):
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self):  # noqa: N802 - http.server's own naming
                self.respond()

            def do_POST(self):  # noqa: N802 - http.server's own naming
                length = int(self.headers.get("Content-Length") or 0)
                self.rfile.read(length)
                self.respond()

            def log_message(self, *args):
                pass

        server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        return INDEX.Qdrant(INDEX.Instance(
            "/homes/appA", url="http://127.0.0.1:%d" % server.server_port,
            collection="fm-context-a404b1c2"), timeout=10.0)

    def test_a_404_means_the_collection_is_absent(self):
        self.assertFalse(self.client(404).has_collection())

    def test_a_server_error_is_raised_rather_than_read_as_absent(self):
        for status in (500, 503):
            with self.assertRaises(INDEX.ContextIndexError):
                self.client(status).has_collection()

    def test_a_server_error_never_reads_as_an_unclaimed_collection(self):
        with self.assertRaises(INDEX.ContextIndexError):
            self.client(500).claim_identity(384)

    def test_an_absent_collection_is_reported_as_no_index_yet(self):
        with self.assertRaises(INDEX.ContextIndexError) as caught:
            self.client(404).require_collection()
        self.assertIn("no index for this home yet", str(caught.exception))


class ForeignHomeGuardTest(unittest.TestCase):
    """A collection another home claimed must be refused, not written."""

    def refuse(self, payload):
        INDEX.check_store_identity(
            payload, "/homes/appB", "fm-context-appA", "http://127.0.0.1:6624")

    def test_a_collection_claimed_by_another_home_is_refused(self):
        with self.assertRaises(INDEX.ContextIndexError) as caught:
            self.refuse({"home": "/homes/appA"})
        message = str(caught.exception)
        self.assertIn("/homes/appA", message)
        self.assertIn("fm-context-appA", message)

    def test_this_home_s_own_collection_is_allowed(self):
        self.refuse({"home": "/homes/appB"})

    def test_an_unclaimed_collection_is_allowed(self):
        self.refuse(None)
        self.refuse({})


class SearchFilterTest(unittest.TestCase):
    def clauses(self, home, kinds):
        return {clause["key"]: clause["match"]
                for clause in INDEX.search_filter(home, kinds)["must"]}

    def test_every_search_is_bound_to_one_home(self):
        for kinds in (None, [], ["status"]):
            self.assertEqual(
                self.clauses("/homes/appA", kinds)["home"],
                {"value": "/homes/appA"})

    def test_an_unfiltered_search_still_excludes_the_instance_marker(self):
        allowed = self.clauses("/homes/appA", None)["kind"]["any"]
        self.assertEqual(sorted(allowed), sorted(INDEX.KINDS))

    def test_a_kind_filter_narrows_further(self):
        self.assertEqual(
            self.clauses("/homes/appA", ["status"])["kind"], {"any": ["status"]})


if __name__ == "__main__":
    unittest.main(verbosity=2)
