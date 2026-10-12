"""Standard-library helpers embedded in the standalone Colab notebook."""
from __future__ import annotations

import fnmatch
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import subprocess
import tarfile
import tempfile
import threading
import time
import urllib.request
import uuid

CHECKPOINT_LOCK = threading.Lock()


def run(args, cwd=None, env=None, capture=False):
    return subprocess.run(args, cwd=cwd, env=env, check=True, text=True,
                          stdout=subprocess.PIPE if capture else None,
                          stderr=subprocess.PIPE if capture else None).stdout


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp-" + uuid.uuid4().hex)
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as source:
        for block in iter(lambda: source.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def safe_child(root, name):
    relative = PurePosixPath(name)
    if relative.is_absolute() or ".." in relative.parts or "\\" in name or ":" in name:
        raise ValueError(f"Unsafe relative path: {name}")
    root = Path(root).resolve()
    target = (root / name).resolve()
    if target == root or not target.is_relative_to(root):
        raise ValueError(f"Path escapes root: {name}")
    return target


def extract_files(archive, destination):
    """Restore only regular files/directories; never links or special files."""
    destination = Path(destination)
    with tarfile.open(archive, "r:gz") as source:
        members = source.getmembers()
        for member in members:
            safe_child(destination, member.name)
            if not (member.isfile() or member.isdir()):
                raise ValueError(f"Unsupported archive entry: {member.name}")
        for member in members:
            target = safe_child(destination, member.name)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with source.extractfile(member) as src, target.open("wb") as dst:
                    shutil.copyfileobj(src, dst)
                target.chmod(member.mode & 0o777)


def selected_files(siblings, pattern):
    files = sorted((item for item in siblings
                    if fnmatch.fnmatch(PurePosixPath(item["rfilename"]).name, pattern)),
                   key=lambda item: item["rfilename"])
    if not files:
        raise ValueError(f"No GGUF matches {pattern}; check the model Files page.")
    for item in files:
        safe_child(Path(tempfile.gettempdir()) / "model", item["rfilename"])
        if not item["rfilename"].endswith(".gguf") or "mmproj" in item["rfilename"].lower():
            raise ValueError("Choose language-model GGUF files only.")
        if not item.get("size") or not re.fullmatch(r"[0-9a-f]{64}", item.get("lfs", {}).get("sha256", "")):
            raise ValueError("Missing file size/SHA256 metadata.")
    names = [PurePosixPath(item["rfilename"]).name for item in files]
    parts = [re.fullmatch(r"(.+)-(\d{5})-of-(\d{5})\.gguf", name) for name in names]
    if len(files) > 1 or any(parts):
        if (not all(parts) or len({p[1] for p in parts}) != 1
                or len({p[3] for p in parts}) != 1
                or int(parts[0][3]) != len(parts)
                or sorted(int(p[2]) for p in parts) != list(range(1, len(parts) + 1))):
            raise ValueError("Ambiguous quantization or incomplete split GGUF.")
    return files


def copy_verified(source, destination, expected_hash):
    source, destination = Path(source), Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and sha256(destination) == expected_hash:
        return destination
    temporary = destination.with_suffix(destination.suffix + ".partial")
    shutil.copyfile(source, temporary)
    if sha256(temporary) != expected_hash:
        temporary.unlink()
        raise ValueError("Model checksum failed; cached file may be damaged. Re-run download with REPAIR_MODEL=True.")
    temporary.replace(destination)
    return destination


def prepare_model(cache, local, repo_id, pattern, revision, repair=False):
    from huggingface_hub import HfApi, hf_hub_download
    key = hashlib.sha256(f"{repo_id}|{pattern}|{revision}".encode()).hexdigest()[:16]
    store = Path(cache) / "models" / key
    manifest = store / "manifest.json"
    if manifest.exists():
        metadata = read_json(manifest)
        print("保存済みのモデル版を再利用:", metadata["revision"])
    else:
        info = HfApi().model_info(repo_id, revision=revision or "main", files_metadata=True)
        siblings = [{"rfilename": f.rfilename, "size": f.size,
                     "lfs": {"sha256": f.lfs.sha256} if f.lfs else {}} for f in info.siblings]
        metadata = {"repo": repo_id, "revision": info.sha, "files": selected_files(siblings, pattern)}
        write_json(manifest, metadata)
    needed = sum(f["size"] for f in metadata["files"]
                 if not safe_child(store, f["rfilename"]).exists())
    local_needed = sum(f["size"] for f in metadata["files"]
                       if not safe_child(local, f["rfilename"]).exists()
                       or sha256(safe_child(local, f["rfilename"])) != f["lfs"]["sha256"])
    for directory, amount in [(store, needed), (Path(local), local_needed)]:
        directory.mkdir(parents=True, exist_ok=True)
        if shutil.disk_usage(directory).free < amount + 2 * 1024**3:
            raise RuntimeError(f"空き容量不足: {directory} / 約{amount / 1024**3:.1f} GiB + 2 GiB必要")
    result = []
    for item in metadata["files"]:
        saved = safe_child(store, item["rfilename"])
        invalid = not saved.exists() or saved.stat().st_size != item["size"]
        if repair and saved.exists():
            invalid = invalid or sha256(saved) != item["lfs"]["sha256"]
        if invalid:
            print("モデル取得:", item["rfilename"])
            downloaded = hf_hub_download(repo_id, item["rfilename"], revision=metadata["revision"],
                                         local_dir=store, force_download=repair)
            if sha256(downloaded) != item["lfs"]["sha256"]:
                raise ValueError("Downloaded model checksum mismatch")
        else:
            print("Driveの保存済みモデルを使用:", item["rfilename"])
        result.append(copy_verified(saved, safe_child(local, item["rfilename"]), item["lfs"]["sha256"]))
    return result[0], metadata


def install_node(cache, runtime):
    store = Path(cache) / "node"
    lock = store / "manifest.json"
    if lock.exists():
        metadata = read_json(lock)
    else:
        base = "https://nodejs.org/dist/latest-v24.x/"
        lines = urllib.request.urlopen(base + "SHASUMS256.txt", timeout=60).read().decode().splitlines()
        checksum, name = next(line.split() for line in lines if line.endswith("linux-x64.tar.xz"))
        version = name.removeprefix("node-").removesuffix("-linux-x64.tar.xz")
        metadata = {"name": name, "sha256": checksum, "url": f"https://nodejs.org/dist/{version}/{name}"}
        write_json(lock, metadata)
    saved = store / metadata["name"]
    if not saved.exists() or sha256(saved) != metadata["sha256"]:
        urllib.request.urlretrieve(metadata["url"], saved.with_suffix(".partial"))
        saved.with_suffix(".partial").replace(saved)
    if sha256(saved) != metadata["sha256"]:
        raise ValueError("Node archive checksum mismatch")
    destination = Path(runtime) / "node"
    destination.mkdir(parents=True, exist_ok=True)
    run(["tar", "-xJf", str(saved), "--strip-components=1", "-C", str(destination)])
    os.environ["PATH"] = str(destination / "bin") + os.pathsep + os.environ["PATH"]
    os.environ["npm_config_cache"] = str(Path(cache) / "npm-cache")
    run(["node", "--version"])


def build_server(cache, runtime, requested_ref):
    nvcc = run(["nvcc", "--version"], capture=True)
    capability = run(["nvidia-smi", "--query-gpu=compute_cap", "--format=csv,noheader"], capture=True).splitlines()[0].strip().replace(".", "")
    compiler = run(["c++", "--version"], capture=True).splitlines()[0]
    system = Path("/etc/os-release").read_text()
    lock = Path(cache) / "llama" / "source.json"
    if lock.exists() and read_json(lock)["requested_ref"] == requested_ref:
        commit = read_json(lock)["commit"]
    else:
        commit = run(["git", "ls-remote", "https://github.com/ggml-org/llama.cpp.git", requested_ref], capture=True).split()[0]
        write_json(lock, {"requested_ref": requested_ref, "commit": commit})
    fingerprint = hashlib.sha256(f"{commit}|{nvcc}|{capability}|{compiler}|{system}".encode()).hexdigest()[:20]
    archive = Path(cache) / "llama" / f"{fingerprint}.tar.gz"
    output = Path(runtime) / "llama" / fingerprint
    binary = output / "bin" / "llama-server"
    if archive.exists():
        extract_files(archive, output)
        try:
            run([str(binary), "--version"], capture=True)
            print("GPU/CUDA環境が一致: llama-serverのビルドを再利用")
            return binary, commit
        except (OSError, subprocess.CalledProcessError):
            print("保存済み実行ファイルを使えないため再ビルドします")
    source = Path(runtime) / "llama-source"
    if not (source / ".git").exists():
        run(["git", "clone", "--filter=blob:none", "https://github.com/ggml-org/llama.cpp.git", str(source)])
    run(["git", "fetch", "origin", commit], cwd=source)
    run(["git", "checkout", "--detach", commit], cwd=source)
    run(["cmake", "-S", str(source), "-B", str(output), "-DGGML_CUDA=ON",
         f"-DCMAKE_CUDA_ARCHITECTURES={capability}", "-DGGML_NATIVE=OFF",
         "-DBUILD_SHARED_LIBS=OFF", "-DLLAMA_CURL=OFF", "-DCMAKE_BUILD_TYPE=Release"])
    run(["cmake", "--build", str(output), "--config", "Release", "-j", "2", "--target", "llama-server"])
    archive.parent.mkdir(parents=True, exist_ok=True)
    temporary = archive.with_suffix(".partial")
    with tarfile.open(temporary, "w:gz") as tar:
        tar.add(output / "bin", arcname="bin")
    temporary.replace(archive)
    return binary, commit


def checkpoint(repo, destination, details=None):
    with CHECKPOINT_LOCK:
        return _checkpoint(repo, destination, details)


def _checkpoint(repo, destination, details=None):
    repo, destination = Path(repo), Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    checkpoint_id = time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:8]
    folder = destination / checkpoint_id
    folder.mkdir()
    head = run(["git", "rev-parse", "HEAD"], cwd=repo, capture=True).strip()
    branch = run(["git", "branch", "--show-current"], cwd=repo, capture=True).strip()
    if not branch:
        raise RuntimeError("Checkpoint requires a named branch")
    run(["git", "bundle", "create", str(folder / "repo.bundle"), "--all"], cwd=repo, capture=True)
    patch = subprocess.check_output(["git", "diff", "--binary", "HEAD"], cwd=repo)
    (folder / "changes.patch").write_bytes(patch)
    names = subprocess.check_output(["git", "ls-files", "--others", "--exclude-standard", "-z"], cwd=repo).decode().split("\0")
    with tarfile.open(folder / "untracked.tar.gz", "w:gz") as tar:
        for name in filter(None, names):
            path = safe_child(repo, name)
            if path.is_symlink() or not path.is_file():
                raise ValueError(f"Unsupported untracked file: {name}")
            tar.add(path, arcname=name, recursive=False)
    if run(["git", "rev-parse", "HEAD"], cwd=repo, capture=True).strip() != head:
        raise RuntimeError("HEAD changed during checkpoint; retry")
    metadata = {"id": checkpoint_id, "head": head, "branch": branch, "details": details or {}}
    write_json(folder / "manifest.json", metadata)
    write_json(destination / "latest.json", metadata)
    return folder


def restore_checkpoint(destination, repo, remote):
    destination, repo = Path(destination), Path(repo)
    if repo.exists():
        raise RuntimeError("Existing workspace is preserved; restore into an empty path")
    metadata = read_json(destination / "latest.json")
    folder = safe_child(destination, metadata["id"])
    run(["git", "clone", "--branch", metadata["branch"], str(folder / "repo.bundle"), str(repo)], capture=True)
    run(["git", "remote", "set-url", "origin", remote], cwd=repo)
    if run(["git", "rev-parse", "HEAD"], cwd=repo, capture=True).strip() != metadata["head"]:
        raise ValueError("Checkpoint HEAD mismatch")
    patch = folder / "changes.patch"
    if patch.stat().st_size:
        run(["git", "apply", "--binary", str(patch)], cwd=repo)
    extract_files(folder / "untracked.tar.gz", repo)
    return metadata


def agent_settings(context_size, reviewer=False):
    settings = {
        "security": {"auth": {"selectedType": "openai"}},
        "model": {"name": "qwen-local"},
        "modelProviders": {"openai": [{"id": "qwen-local", "baseUrl": "http://127.0.0.1:8080/v1",
            "envKey": "LOCAL_LLM_API_KEY", "generationConfig": {"contextWindowSize": context_size,
            "timeout": 600000, "samplingParams": {"temperature": 1.0, "top_p": 0.95, "max_tokens": 4096}}}]},
        "context": {"fileName": ["AGENTS.md", "QWEN.md"]},
        "tools": {"approvalMode": "auto-edit", "core": ["read_file", "read_many_files",
            "list_directory", "grep_search", "glob", "write_file", "edit", "run_shell_command", "todo_write"]},
        "permissions": {"allow": ["run_shell_command(npm run check)", "run_shell_command(npm run references:check)",
            "run_shell_command(npm run format)", "run_shell_command(npm run typecheck)", "run_shell_command(npm test *)",
            "run_shell_command(npm run build)", "run_shell_command(git status *)", "run_shell_command(git diff *)", "run_shell_command(git log *)", "run_shell_command(rg *)"],
            "deny": ["run_shell_command(git push *)", "run_shell_command(gh *)", "run_shell_command(rm -rf *)"]},
        "memory": {"enableManagedAutoMemory": False, "enableManagedAutoDream": False, "enableAutoSkill": False},
        "telemetry": {"enabled": False}}
    if reviewer:
        settings["tools"] = {"approvalMode": "plan", "core": [
            "read_file", "read_many_files", "list_directory", "grep_search", "glob"]}
        settings["permissions"] = {"allow": [], "deny": [
            "run_shell_command", "write_file", "edit", "agent", "web_fetch", "web_search"]}
    return settings


def agent_command(prompt, turns=60, minutes=45, reviewer=False):
    command = ["qwen", "--auth-type", "openai", "--model", "qwen-local", "--approval-mode", "plan" if reviewer else "auto-edit",
            "--max-session-turns", str(turns), "--max-tool-calls", "150", "--max-wall-time", f"{minutes}m",
            "--output-format", "stream-json", "--include-partial-messages"]
    excluded = ["agent", "workflow", "exec", "skill", "tool_call", "tool_search",
        "web_fetch", "web_search", "enter_worktree", "exit_worktree", "record_artifact",
        "report_findings", "send_message", "task_stop", "update_goal", "get_goal", "list_agents"]
    if reviewer:
        command += ["--json-schema", json.dumps(REVIEW_SCHEMA)]
        excluded += ["write_file", "edit", "notebook_edit", "run_shell_command", "todo_write"]
    command += ["--exclude-tools", ",".join(excluded)]
    command += ["--prompt", prompt]
    return command


REVIEW_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "status": {"type": "string", "enum": ["pass", "changes_required", "blocked"]},
        "findings": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "properties": {"id": {"type": "string"}, "file": {"type": "string"},
                "severity": {"type": "string", "enum": ["high", "medium", "low"]},
                "problem": {"type": "string"}, "expected": {"type": "string"},
                "verification": {"type": "string"}},
            "required": ["id", "file", "severity", "problem", "expected", "verification"]}},
        "unchecked": {"type": "array", "items": {"type": "string"}},
        "user_checks": {"type": "array", "minItems": 3, "maxItems": 5,
            "items": {"type": "object", "additionalProperties": False,
                "properties": {"action": {"type": "string"}, "expected": {"type": "string"}},
                "required": ["action", "expected"]}}},
    "required": ["status", "findings", "unchecked", "user_checks"]}


def review_ready(report):
    """Fail closed even when a model contradicts its own pass verdict."""
    if not isinstance(report, dict) or set(report) != set(REVIEW_SCHEMA["required"]):
        return False
    if report["status"] != "pass" or report["findings"] != []:
        return False
    if not isinstance(report["unchecked"], list) or not all(isinstance(s, str) for s in report["unchecked"]):
        return False
    checks = report["user_checks"]
    return (isinstance(checks, list) and 3 <= len(checks) <= 5
            and all(isinstance(c, dict) and set(c) == {"action", "expected"}
                    and all(isinstance(v, str) and v.strip() for v in c.values()) for c in checks))


def workspace_fingerprint(repo):
    """Bind verification to file contents, including deletions and untracked files.

    Commits with unchanged contents keep the same fingerprint. Ignored build/cache
    files do not invalidate the source review.
    """
    names = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=repo).decode().split("\0")
    digest = hashlib.sha256()
    for name in sorted(set(filter(None, names))):
        if (Path(repo) / name).is_symlink():
            raise ValueError(f"Review does not support symbolic links: {name}")
        path = safe_child(repo, name)
        if not path.is_file():
            continue
        digest.update(name.encode() + b"\0")
        digest.update(sha256(path).encode() + b"\0")
    return digest.hexdigest()


def prepare_control_folder(repo):
    folder = Path(repo) / ".colab"
    folder.mkdir(exist_ok=True)
    git_dir = Path(run(["git", "rev-parse", "--absolute-git-dir"], cwd=repo, capture=True).strip())
    exclude = git_dir / "info/exclude"
    exclude.parent.mkdir(exist_ok=True)
    previous = exclude.read_text(encoding="utf-8") if exclude.exists() else ""
    if "/.colab/" not in previous.splitlines():
        exclude.write_text(previous + "\n/.colab/\n", encoding="utf-8")
    return folder


def choose_work_branch(issue_number, requested, saved, related):
    if requested:
        return requested
    candidates = {p["headRefName"] for p in related}
    default = f"colab/issue-{issue_number}"
    if saved and (not candidates or saved in candidates):
        return saved
    if default in candidates or not candidates:
        return default
    if len(candidates) == 1:
        return next(iter(candidates))
    raise RuntimeError("関連PRが複数あり継続先を選べません。WORK_BRANCHで対象を指定してください。")


def run_qwen_phase(repo, destination, prompt, env, context_size, turns, minutes, reviewer=False):
    """One fresh CLI conversation; never resumes the implementation's transcript."""
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    settings_path = Path.home() / ".qwen/settings.json"
    write_json(settings_path, agent_settings(context_size, reviewer))
    process = None
    result = None
    denials = []
    try:
        process = subprocess.Popen(agent_command(prompt, turns, minutes, reviewer), cwd=repo,
            env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1,
            start_new_session=True)
        with (destination / "events.jsonl").open("w", encoding="utf-8") as log:
            for line in process.stdout:
                clean = line.replace(env.get("LOCAL_LLM_API_KEY", "__missing_key__"), "[redacted]")
                log.write(clean); log.flush()
                print(clean, end="")
                try:
                    event = json.loads(clean)
                    if event.get("type") == "result":
                        result = event
                        denials.extend(event.get("permission_denials") or [])
                except (ValueError, AttributeError):
                    pass
        exit_code = process.wait()
    finally:
        if process is not None and process.poll() is None:
            stop_owned_process(process)
        write_json(settings_path, agent_settings(context_size))
    success = (exit_code == 0 and isinstance(result, dict) and not result.get("is_error")
               and result.get("subtype") == "success" and not denials)
    report = None
    if reviewer and result:
        report = result.get("structured_result")
        if report is None:
            try:
                report = json.loads(result.get("result", ""))
            except (ValueError, TypeError):
                pass
    summary = {"success": success, "exit_code": exit_code, "permission_denials": denials, "report": report}
    write_json(destination / "result.json", summary)
    return summary


def run_required_checks(repo, destination):
    results = []
    for command in (["npm", "run", "check"], ["npm", "run", "references:check"]):
        process = subprocess.run(command, cwd=repo, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True)
        results.append({"command": command, "exit_code": process.returncode, "output": process.stdout[-12000:]})
        print(process.stdout[-12000:])
    write_json(Path(destination) / "checks.json", results)
    return results


def checks_passed(checks):
    required = {("npm", "run", "check"), ("npm", "run", "references:check")}
    return (isinstance(checks, list) and len(checks) == len(required)
            and all(isinstance(c, dict) and c.get("exit_code") == 0
                    and isinstance(c.get("command"), list) for c in checks)
            and {tuple(c.get("command", [])) for c in checks} == required)


def run_issue_workflow(repo, destination, issue_number, issue_context, env, context_size,
                       turns=60, minutes=45, repairs=2, feedback="",
                       phase_runner=run_qwen_phase, checker=run_required_checks):
    """Python owns the required implement -> review -> fix -> re-review loop."""
    repo, destination = Path(repo), Path(destination)
    if repairs not in (0, 1, 2):
        raise ValueError("At most two automatic repair rounds are supported")
    destination.mkdir(parents=True, exist_ok=True)
    control = prepare_control_folder(repo)
    state_path = destination / "workflow.json"
    # Immediately revoke an earlier successful run before any new edits/checks.
    state = {"ready": False, "issue": issue_number,
        "branch": run(["git", "branch", "--show-current"], cwd=repo, capture=True).strip(),
        "phase": "implementing", "rounds": []}
    write_json(state_path, state)
    common = (f"Issue #{issue_number}。作業場所 {repo}。AGENTS.mdと.colab/workflow.md、"
        "docs/project/ISSUE_AGENT_RUNBOOK.mdとISSUE_IMPLEMENTATION_GUIDE.mdの対象節を読む。"
        f"最新Issue/コメント/関連PRは {issue_context}。.colab/ci-failures.jsonがあればCI失敗ログも読み修正する。既存差分は保全して継続する。"
        "利用者へ技術設計やコードレビューを要求しない。GitHub投稿/push/merge/Issue closeは親セル専用。"
        "実施していないテスト/ブラウザ操作/ユーザー合格を実施済みと書かない。")
    request = common + ("設計・実装・テスト・ユーザー用3〜5操作と期待結果を.COLAB_HANDOFF.mdへ記録。"
        "範囲を内部APIだけに縮小せず、通常対戦へ接続する。" + ("\nユーザーの追加指示:\n" + feedback if feedback.strip() else ""))
    for attempt in range(repairs + 1):
        round_dir = destination / f"round-{attempt + 1}"
        implementation = phase_runner(repo, round_dir / "implementation", request, env, context_size, turns, minutes)
        state["phase"] = "checking"
        write_json(state_path, state)
        checks = checker(repo, round_dir)
        fingerprint = workspace_fingerprint(repo)
        input_path = control / "review-input.json"
        base = run(["git", "merge-base", "origin/main", "HEAD"], cwd=repo, capture=True).strip()
        diff = subprocess.check_output(["git", "diff", "--binary", base], cwd=repo).decode(errors="replace")
        (control / "review.diff").write_text(diff, encoding="utf-8")
        write_json(input_path, {"issue_context": str(issue_context), "base": base,
            "diff_file": str(control / "review.diff"), "files": run(["git", "status", "--short"], cwd=repo, capture=True),
            "implementation": implementation, "checks": checks, "fingerprint": fingerprint,
            "feedback": feedback, "previous_rounds": state["rounds"]})
        state["phase"] = "reviewing"
        write_json(state_path, state)
        review_prompt = common + (f"\nあなたは実装者と別会話の読み取り専用レビュー担当。{input_path}とreview.diff、"
            "変更/追加ファイル、実際のテストを読む。通常対戦への接続、仕様・受入条件、境界、NPC公平性、"
            "費用/視界/command、マスタ契約、回帰、テストの検出力を独立に検証。"
            "実装者の自己申告を合格の根拠にしない。コード編集やshell実行はしない。"
            "現物で確認した問題はseverity/file/problem/expected/verification付きfindingsへ。"
            "未解決問題やテスト失敗はchanges_required、必要資料不足はblocked。"
            "findingsゼロかつ全必須チェック成功のときだけpass。見た目の実機未検査はuncheckedへ明示。"
            "user_checksは利用者が画面で試せる3〜5操作と期待結果。指定schemaのJSONを出力。")
        review = phase_runner(repo, round_dir / "review", review_prompt, env, context_size,
            turns, minutes, reviewer=True)
        unchanged = workspace_fingerprint(repo) == fingerprint
        passed = (implementation["success"] and review["success"] and unchanged
            and checks_passed(checks) and review_ready(review.get("report"))
            and (repo / ".COLAB_HANDOFF.md").is_file())
        record = {"implementation_success": implementation["success"], "review": review,
            "checks_passed": checks_passed(checks), "source_unchanged": unchanged}
        state["rounds"].append(record)
        state.update({"ready": passed, "fingerprint": fingerprint, "phase": "ready" if passed else "needs-fix"})
        write_json(state_path, state)
        if passed:
            return state
        if not unchanged:
            state["phase"] = "review-modified-workspace"
            write_json(state_path, state)
            return state
        request = common + (f"\n前回のチェック/独立レビュー結果は {input_path} と "
            f"{round_dir / 'review/result.json'}。指摘と失敗を修正し、.COLAB_HANDOFF.mdを更新する。"
            "レビュー結果を編集して合格にしない。必要な根拠でコード/テストを直す。")
    return state


def require_reviewed_workspace(repo, state, issue_number=None):
    if (not state.get("ready") or workspace_fingerprint(repo) != state.get("fingerprint")
            or (issue_number is not None and state.get("issue") != issue_number)
            or (state.get("branch") is not None and state["branch"] != run(
                ["git", "branch", "--show-current"], cwd=repo, capture=True).strip())):
        raise RuntimeError("独立レビュー未完了、またはレビュー後に内容が変わりました。実装セルで再検証してください。")


def require_approved_revision(repo, state, issue_number, preview, published_sha, pr):
    require_reviewed_workspace(repo, state, issue_number)
    expected = run(["git", "rev-parse", "HEAD"], cwd=repo, capture=True).strip()
    if preview.get("dirty") is not False or preview.get("commit") != expected or published_sha != expected:
        raise RuntimeError("PR提出後のclean版をセル12で画面確認してください。")
    if pr.get("headRefOid") != expected:
        raise RuntimeError("PRの内容が検査版から変わっています。再検査してください。")
    checks = pr.get("statusCheckRollup") or []
    required_names = {"checks (ubuntu-latest)", "checks (windows-latest)"}
    successful = {c.get("name") for c in checks if c.get("conclusion") == "SUCCESS"}
    if not required_names <= successful or not all(
            c.get("conclusion") in ("SUCCESS", "SKIPPED", "NEUTRAL") or c.get("state") == "SUCCESS" for c in checks):
        raise RuntimeError("Windows/Linux CI成功待ち、または未完了/失敗のチェックがあります。")
    return expected


def stop_owned_process(process):
    """Only for processes launched by this notebook with start_new_session=True."""
    if process is None or process.poll() is not None:
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=20)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait()
    except ProcessLookupError:
        process.wait()
