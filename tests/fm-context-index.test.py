#!/usr/bin/env python3
"""Unit tests for bin/fm-context-index's chunker and content-hash dedupe.

Driven by tests/fm-context-index.test.sh, which owns the gate reporting.
"""
import importlib.machinery
import importlib.util
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


if __name__ == "__main__":
    unittest.main(verbosity=2)
