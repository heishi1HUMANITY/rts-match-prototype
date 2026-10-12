"""Exercise review and publication gates using real Git and fake model phases."""
import copy
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

import runtime


def passing_report():
    return {
        "status": "pass", "findings": [], "unchecked": ["Real browser interaction"],
        "user_checks": [
            {"action": "Start the match", "expected": "The board appears"},
            {"action": "Move a unit", "expected": "It reaches the chosen location"},
            {"action": "Reset", "expected": "The initial state returns"},
        ],
    }


class WorkflowTests(unittest.TestCase):
    def test_merge_requires_the_reviewed_preview_published_head_and_successful_ci(self):
        state = self.workflow()
        self.git("add", ".")
        self.git("commit", "-m", "reviewed")
        head = self.git("rev-parse", "HEAD")
        preview = {"commit": head, "dirty": False}
        pr = {"headRefOid": head, "statusCheckRollup": [
            {"name": "checks (ubuntu-latest)", "conclusion": "SUCCESS"},
            {"name": "checks (windows-latest)", "conclusion": "SUCCESS"}]}
        self.assertEqual(runtime.require_approved_revision(self.repo, state, 30, preview, head, pr), head)
        cases = [({"commit": head, "dirty": True}, head, pr),
                 ({"commit": "older", "dirty": False}, head, pr),
                 (preview, "older", pr),
                 (preview, head, {**pr, "headRefOid": "changed"}),
                 (preview, head, {**pr, "statusCheckRollup": []}),
                 (preview, head, {**pr, "statusCheckRollup": pr["statusCheckRollup"][:1]}),
                 (preview, head, {**pr, "statusCheckRollup": pr["statusCheckRollup"] + [
                     {"name": "extra", "status": "IN_PROGRESS"}]})]
        for checked_preview, published, current_pr in cases:
            with self.subTest(preview=checked_preview, published=published, pr=current_pr):
                with self.assertRaises(RuntimeError):
                    runtime.require_approved_revision(self.repo, state, 30, checked_preview, published, current_pr)
        with self.assertRaises(RuntimeError):
            runtime.require_approved_revision(self.repo, state, 31, preview, head, pr)

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.repo = self.root / "repo"
        self.repo.mkdir()
        self.git("init", "-b", "issue-30")
        self.git("config", "user.name", "Workflow Test")
        self.git("config", "user.email", "workflow@example.invalid")
        (self.repo / "tracked.txt").write_text("original\n", encoding="utf-8")
        (self.repo / ".gitignore").write_text("cache/\n", encoding="utf-8")
        self.git("add", ".")
        self.git("commit", "-m", "fixture")
        self.git("update-ref", "refs/remotes/origin/main", "HEAD")
        self.destination = self.root / "workflow"
        self.context = self.root / "issue.json"
        self.context.write_text('{"number": 30}', encoding="utf-8")
        self.events = []

    def tearDown(self):
        self.directory.cleanup()

    def git(self, *args):
        return subprocess.check_output(["git", *args], cwd=self.repo, stderr=subprocess.STDOUT).decode().strip()

    def runner(self, repo, destination, prompt, env, context_size, turns, minutes, reviewer=False):
        destination = Path(destination)
        destination.mkdir(parents=True, exist_ok=True)
        self.events.append(("review" if reviewer else "implementation", destination, prompt))
        if not reviewer:
            (repo / ".COLAB_HANDOFF.md").write_text("Actual checks; browser pending", encoding="utf-8")
        return {"success": True, "report": passing_report() if reviewer else None}

    def checker(self, repo, destination):
        self.events.append(("check", Path(destination), ""))
        return [{"command": ["npm", "run", "check"], "exit_code": 0},
                {"command": ["npm", "run", "references:check"], "exit_code": 0}]

    def workflow(self, **overrides):
        return runtime.run_issue_workflow(self.repo, self.destination, 30, self.context, {}, 16384,
            repairs=overrides.pop("repairs", 0), phase_runner=overrides.pop("phase_runner", self.runner),
            checker=overrides.pop("checker", self.checker), **overrides)

    def test_changes_require_fix_then_new_independent_review(self):
        review_count = 0

        def runner(*args, **kwargs):
            nonlocal review_count
            result = self.runner(*args, **kwargs)
            if kwargs.get("reviewer"):
                review_count += 1
                if review_count == 1:
                    result["report"]["status"] = "changes_required"
                    result["report"]["findings"] = [{"id": "R1", "file": "tracked.txt", "severity": "high",
                        "problem": "Missing rejection", "expected": "Reject invalid input", "verification": "Boundary case"}]
            return result

        state = self.workflow(repairs=2, phase_runner=runner, feedback="選んだ部隊が動かない")
        self.assertTrue(state["ready"])
        self.assertEqual([event[0] for event in self.events],
            ["implementation", "check", "review", "implementation", "check", "review"])
        implementations = [event for event in self.events if event[0] == "implementation"]
        reviews = [event for event in self.events if event[0] == "review"]
        self.assertIn("選んだ部隊が動かない", implementations[0][2])
        self.assertIn("前回", implementations[1][2])
        self.assertNotEqual(reviews[0][1], reviews[1][1])
        self.assertNotEqual(implementations[0][1], reviews[0][1])
        self.assertEqual(len(state["rounds"]), 2)
        runtime.require_reviewed_workspace(self.repo, state)

    def test_failed_check_cannot_be_overruled_by_passing_reviewer(self):
        def failed(repo, destination):
            return [{"command": ["npm", "run", "check"], "exit_code": 1}]
        state = self.workflow(checker=failed)
        self.assertFalse(state["ready"])
        self.assertFalse(state["rounds"][0]["checks_passed"])
        with self.assertRaises(RuntimeError):
            runtime.require_reviewed_workspace(self.repo, state)

    def test_missing_or_duplicate_check_evidence_prevents_ready(self):
        check = {"command": ["npm", "run", "check"], "exit_code": 0}
        references = {"command": ["npm", "run", "references:check"], "exit_code": 0}
        for evidence in ([], [check], [references], [check, check], [check, references, references]):
            with self.subTest(evidence=evidence):
                def checker(repo, destination):
                    return copy.deepcopy(evidence)
                self.assertFalse(self.workflow(checker=checker)["ready"])

    def test_reviewer_cli_excludes_edit_execution_and_delegation_tools(self):
        command = runtime.agent_command("Independent review", reviewer=True)
        self.assertEqual(command[command.index("--approval-mode") + 1], "plan")
        denied = set(command[command.index("--exclude-tools") + 1].split(","))
        self.assertTrue({"write_file", "edit", "notebook_edit", "run_shell_command", "agent",
                         "workflow", "exec", "skill", "tool_call", "tool_search"}.issubset(denied))
        self.assertIn("--json-schema", command)
        self.assertNotIn("--resume", command)
        self.assertNotIn("--continue", command)

    def test_invalid_or_contradictory_report_fails_closed(self):
        malformed = [None, "pass", {}, {**passing_report(), "user_checks": []},
                     {**passing_report(), "findings": [{"problem": "Still broken"}]},
                     {**passing_report(), "unchecked": "Unknown"},
                     {**passing_report(), "extra": "Forged field"}]
        for report in malformed:
            with self.subTest(report=report):
                self.assertFalse(runtime.review_ready(report))
                def runner(*args, **kwargs):
                    result = self.runner(*args, **kwargs)
                    if kwargs.get("reviewer"):
                        result["report"] = copy.deepcopy(report)
                    return result
                self.assertFalse(self.workflow(phase_runner=runner)["ready"])

    def test_permission_failure_or_failed_implementation_prevents_ready(self):
        for failed_role in ("review", "implementation"):
            with self.subTest(role=failed_role):
                def runner(*args, **kwargs):
                    result = self.runner(*args, **kwargs)
                    role = "review" if kwargs.get("reviewer") else "implementation"
                    if role == failed_role:
                        result.update(success=False, permission_denials=[{"tool": "write_file"}])
                    return result
                self.assertFalse(self.workflow(phase_runner=runner)["ready"])

    def test_review_mutation_stops_without_repairing_tampered_workspace(self):
        def runner(*args, **kwargs):
            result = self.runner(*args, **kwargs)
            if kwargs.get("reviewer"):
                (self.repo / "tracked.txt").write_text("reviewer edited", encoding="utf-8")
            return result
        state = self.workflow(repairs=2, phase_runner=runner)
        self.assertFalse(state["ready"])
        self.assertEqual(state["phase"], "review-modified-workspace")
        self.assertEqual([event[0] for event in self.events], ["implementation", "check", "review"])

    def test_tracked_added_or_deleted_files_invalidate_publication(self):
        state = self.workflow()
        tracked = self.repo / "tracked.txt"
        original = tracked.read_bytes()
        tracked.write_text("changed", encoding="utf-8")
        with self.assertRaises(RuntimeError):
            runtime.require_reviewed_workspace(self.repo, state)
        tracked.write_bytes(original)
        untracked = self.repo / "new.txt"
        untracked.write_text("new source", encoding="utf-8")
        with self.assertRaises(RuntimeError):
            runtime.require_reviewed_workspace(self.repo, state)
        untracked.unlink()
        tracked.unlink()
        with self.assertRaises(RuntimeError):
            runtime.require_reviewed_workspace(self.repo, state)

    def test_committing_identical_reviewed_content_preserves_fingerprint(self):
        state = self.workflow()
        self.git("add", ".")
        self.git("commit", "-m", "reviewed implementation")
        self.assertEqual(runtime.workspace_fingerprint(self.repo), state["fingerprint"])
        runtime.require_reviewed_workspace(self.repo, state)

    def test_committing_reviewed_deletion_preserves_fingerprint(self):
        (self.repo / "tracked.txt").unlink()
        state = self.workflow()
        self.git("add", "-A")
        self.git("commit", "-m", "reviewed deletion")
        self.assertEqual(runtime.workspace_fingerprint(self.repo), state["fingerprint"])
        runtime.require_reviewed_workspace(self.repo, state)

    def test_ignored_logs_and_control_files_do_not_invalidate_review(self):
        state = self.workflow()
        (self.repo / ".colab" / "temporary.json").write_text("updated", encoding="utf-8")
        cache = self.repo / "cache"
        cache.mkdir()
        (cache / "build.log").write_text("cached build", encoding="utf-8")
        runtime.require_reviewed_workspace(self.repo, state)

    def test_resume_revokes_previous_ready_before_any_model_action(self):
        previous = self.workflow()
        self.assertTrue(previous["ready"])

        def interrupted(*args, **kwargs):
            disk = json.loads((self.destination / "workflow.json").read_text(encoding="utf-8"))
            self.assertFalse(disk["ready"])
            self.assertEqual(disk["rounds"], [])
            raise RuntimeError("Simulated model startup interruption")

        with self.assertRaisesRegex(RuntimeError, "startup interruption"):
            self.workflow(phase_runner=interrupted)
        disk = json.loads((self.destination / "workflow.json").read_text(encoding="utf-8"))
        with self.assertRaises(RuntimeError):
            runtime.require_reviewed_workspace(self.repo, disk)

    def test_unresolved_findings_exhaust_bounded_repair_budget(self):
        def runner(*args, **kwargs):
            result = self.runner(*args, **kwargs)
            if kwargs.get("reviewer"):
                result["report"]["status"] = "blocked"
            return result
        state = self.workflow(repairs=2, phase_runner=runner)
        self.assertFalse(state["ready"])
        self.assertEqual(len(state["rounds"]), 3)
        self.assertEqual(len([event for event in self.events if event[0] == "review"]), 3)


if __name__ == "__main__":
    unittest.main()
