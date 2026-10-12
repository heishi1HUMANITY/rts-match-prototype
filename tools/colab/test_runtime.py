"""Run with python -m unittest discover -s tools/colab -p test_*.py."""
import hashlib
from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

import runtime


class RuntimeTests(unittest.TestCase):
    def test_child_output_is_forwarded_to_notebook_and_failures_are_not_hidden(self):
        output = io.StringIO()
        with redirect_stdout(output):
            runtime.run([sys.executable, "-c", "import sys; print('build-out', flush=True); print('build-error', file=sys.stderr, flush=True)"])
        self.assertIn("build-out", output.getvalue())
        self.assertIn("build-error", output.getvalue())
        captured = io.StringIO()
        with redirect_stdout(captured):
            self.assertEqual(runtime.run([sys.executable, "-c", "print('private-output')"], capture=True).strip(), "private-output")
        self.assertEqual(captured.getvalue(), "")
        with redirect_stdout(io.StringIO()), self.assertRaises(subprocess.CalledProcessError):
            runtime.run([sys.executable, "-c", "raise SystemExit(7)"])

    def test_progress_stage_marks_success_and_interruption_accurately(self):
        output = io.StringIO()
        with redirect_stdout(output):
            with runtime.progress_stage("test-stage"):
                pass
            with self.assertRaises(KeyboardInterrupt):
                with runtime.progress_stage("interrupted-stage"):
                    raise KeyboardInterrupt()
        self.assertIn("開始: test-stage", output.getvalue())
        self.assertIn("完了: test-stage", output.getvalue())
        self.assertIn("中断/失敗: interrupted-stage", output.getvalue())
        self.assertNotIn("完了: interrupted-stage", output.getvalue())

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)

    def tearDown(self):
        self.directory.cleanup()

    def test_selection_requires_one_complete_quantization(self):
        def entry(name):
            return {"rfilename": name, "size": 12, "lfs": {"sha256": "a" * 64}}
        a = entry("model-UD-Q4_K_M-00001-of-00002.gguf")
        b = entry("model-UD-Q4_K_M-00002-of-00002.gguf")
        self.assertEqual(runtime.selected_files([b, a], "*UD-Q4_K_M*.gguf"), [a, b])
        for files in ([a], [entry("a-Q4.gguf"), entry("b-Q4.gguf")],
                      [entry("../model-Q4.gguf")], [entry("mmproj-Q4.gguf")]):
            with self.assertRaises(ValueError):
                runtime.selected_files(files, "*Q4*.gguf")

    def test_verified_copy_does_not_replace_good_file_with_bad_cache(self):
        src, dst = self.root / "cache", self.root / "local"
        src.write_bytes(b"complete-model")
        expected = hashlib.sha256(src.read_bytes()).hexdigest()
        runtime.copy_verified(src, dst, expected)
        first_time = dst.stat().st_mtime_ns
        src.write_bytes(b"damaged-model")
        runtime.copy_verified(src, dst, expected)
        self.assertEqual(dst.stat().st_mtime_ns, first_time)
        dst.write_bytes(b"broken")
        with self.assertRaises(ValueError):
            runtime.copy_verified(src, dst, expected)
        self.assertEqual(dst.read_bytes(), b"broken")
        self.assertFalse(dst.with_suffix(".partial").exists())

    def test_archive_rejects_escape_and_links_before_writing(self):
        for name, kind in [("../outside", tarfile.REGTYPE), ("inside", tarfile.SYMTYPE)]:
            archive = self.root / "bad.tar.gz"
            with tarfile.open(archive, "w:gz") as tar:
                info = tarfile.TarInfo(name)
                info.type = kind
                info.linkname = "../outside"
                tar.addfile(info, io.BytesIO(b""))
            with self.assertRaises(ValueError):
                runtime.extract_files(archive, self.root / "restore")
        self.assertFalse((self.root / "outside").exists())

    def test_model_reuses_pinned_drive_files_without_network_or_extra_capacity(self):
        content = b"fake-model"
        checksum = hashlib.sha256(content).hexdigest()
        name = "model-UD-Q4_K_M.gguf"
        info = SimpleNamespace(sha="fixed-revision", siblings=[SimpleNamespace(
            rfilename=name, size=len(content), lfs=SimpleNamespace(sha256=checksum))])
        calls = []
        def download(repo, filename, revision, local_dir, force_download):
            calls.append((repo, revision))
            path = Path(local_dir) / filename
            path.write_bytes(content)
            return str(path)
        api = SimpleNamespace(model_info=lambda *a, **k: info)
        hub = SimpleNamespace(HfApi=lambda: api, hf_hub_download=download)
        cache, local = self.root / "cache", self.root / "local"
        with patch.dict("sys.modules", {"huggingface_hub": hub}):
            model, metadata = runtime.prepare_model(cache, local, "test/model", "*UD-Q4_K_M*.gguf", "")
            self.assertEqual(model.read_bytes(), content)
            self.assertEqual(metadata["revision"], "fixed-revision")
            api.model_info = lambda *a, **k: self.fail("Should not query the Hub on reuse")
            # Exactly the safety margin is free; no second copy is needed.
            free = SimpleNamespace(free=2 * 1024**3 + 1)
            with patch.object(runtime.shutil, "disk_usage", return_value=free):
                second, _ = runtime.prepare_model(cache, local, "test/model", "*UD-Q4_K_M*.gguf", "")
            self.assertEqual(second, model)
            self.assertEqual(calls, [("test/model", "fixed-revision")])

    def git(self, repo, *args):
        return runtime.run(["git", *args], cwd=repo, capture=True)

    def test_checkpoint_roundtrip_keeps_deletion_binary_and_untracked(self):
        repo = self.root / "repo"
        repo.mkdir()
        self.git(repo, "init", "-b", "colab/issue-30")
        self.git(repo, "config", "user.name", "Test")
        self.git(repo, "config", "user.email", "test@example.test")
        self.git(repo, "config", "core.autocrlf", "false")
        (repo / "remove.txt").write_text("old")
        (repo / "binary.dat").write_bytes(bytes(range(256)))
        (repo / ".gitignore").write_text(".env\nnode_modules/\n")
        self.git(repo, "add", ".")
        self.git(repo, "commit", "-m", "initial")
        (repo / "remove.txt").unlink()
        (repo / "binary.dat").write_bytes(b"\x00changed\xff")
        self.git(repo, "add", "binary.dat")
        (repo / "new.txt").write_text("unfinished")
        (repo / ".env").write_text("not-backed-up")
        saved = self.root / "saved"
        runtime.checkpoint(repo, saved)
        restored = self.root / "restored"
        result = runtime.restore_checkpoint(saved, restored, "https://example.test/repo.git")
        self.assertEqual(result["branch"], "colab/issue-30")
        self.assertFalse((restored / "remove.txt").exists())
        self.assertEqual((restored / "binary.dat").read_bytes(), b"\x00changed\xff")
        self.assertEqual((restored / "new.txt").read_text(), "unfinished")
        self.assertFalse((restored / ".env").exists())
        with self.assertRaises(RuntimeError):
            runtime.restore_checkpoint(saved, restored, "https://example.test/repo.git")

    def test_failed_checkpoint_keeps_previous_generation(self):
        repo = self.root / "repo"
        repo.mkdir()
        self.git(repo, "init", "-b", "work")
        self.git(repo, "config", "user.name", "Test")
        self.git(repo, "config", "user.email", "test@example.test")
        (repo / "a").write_text("a")
        self.git(repo, "add", ".")
        self.git(repo, "commit", "-m", "initial")
        saved = self.root / "saved"
        runtime.checkpoint(repo, saved)
        previous = runtime.read_json(saved / "latest.json")
        self.git(repo, "checkout", "--detach")
        with self.assertRaises(RuntimeError):
            runtime.checkpoint(repo, saved)
        self.assertEqual(runtime.read_json(saved / "latest.json"), previous)

    def test_settings_do_not_include_secret_or_unrestricted_approval(self):
        settings = runtime.agent_settings(16384)
        encoded = json.dumps(settings)
        self.assertNotIn("yolo", encoded)
        self.assertIn("run_shell_command(npm run check)", settings["permissions"]["allow"])
        self.assertTrue(all(rule.startswith("run_shell_command(") for rule in settings["permissions"]["allow"]))
        self.assertNotIn("run_shell_command(*)", encoded)
        self.assertFalse(settings["memory"]["enableManagedAutoMemory"])
        self.assertFalse(settings["memory"]["enableManagedAutoDream"])
        self.assertIn("AGENTS.md", settings["context"]["fileName"])
        self.assertEqual(settings["modelProviders"]["openai"][0]["generationConfig"]["contextWindowSize"], 16384)
        command = runtime.agent_command("Issue #30; $(do-not-execute)")
        self.assertEqual(command[-1], "Issue #30; $(do-not-execute)")
        self.assertIn("--max-session-turns", command)

    def test_notebook_is_standalone_and_cells_compile(self):
        notebook = Path(__file__).resolve().parents[2] / "notebooks/RTS_Qwen_Colab.ipynb"
        data = runtime.read_json(notebook)
        self.assertEqual(data["nbformat"], 4)
        code = []
        for cell in data["cells"]:
            if cell["cell_type"] == "code":
                self.assertEqual(cell["outputs"], [])
                source = "".join(cell["source"])
                compile(source, cell["id"], "exec")
                code.append(source)
        self.assertIn(Path(runtime.__file__).read_text(encoding="utf-8").strip(), code)
        guide = notebook.parents[1] / "docs/project/QWEN_AGENT_WORKFLOW.md"
        self.assertTrue(any("QWEN_WORKFLOW_INSTRUCTIONS = " + repr(guide.read_text(encoding="utf-8")) in source
                            for source in code))
        self.assertTrue(any("RUN_AGENT = False" in source for source in code))
        self.assertTrue(any("PUBLISH_PR = False" in source for source in code))
        self.assertTrue(any("USER_ACCEPTED = False" in source for source in code))

    def test_branch_selection_resumes_without_technical_input(self):
        related = [{"headRefName": "colab/issue-30"}, {"headRefName": "other"}]
        self.assertEqual(runtime.choose_work_branch(30, "", "colab/issue-30", related), "colab/issue-30")
        self.assertEqual(runtime.choose_work_branch(30, "", "", related), "colab/issue-30")
        self.assertEqual(runtime.choose_work_branch(30, "", "", [{"headRefName": "existing-feature"}]), "existing-feature")
        self.assertEqual(runtime.choose_work_branch(30, "", "saved-work", []), "saved-work")
        with self.assertRaises(RuntimeError):
            runtime.choose_work_branch(30, "", "", [{"headRefName": "a"}, {"headRefName": "b"}])


if __name__ == "__main__":
    unittest.main()
