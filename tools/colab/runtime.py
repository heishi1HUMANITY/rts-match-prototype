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


def agent_settings(context_size):
    return {
        "security": {"auth": {"selectedType": "openai"}},
        "model": {"name": "qwen-local"},
        "modelProviders": {"openai": [{"id": "qwen-local", "baseUrl": "http://127.0.0.1:8080/v1",
            "envKey": "LOCAL_LLM_API_KEY", "generationConfig": {"contextWindowSize": context_size,
            "timeout": 600000, "samplingParams": {"temperature": 1.0, "top_p": 0.95, "max_tokens": 4096}}}]},
        "context": {"fileName": ["AGENTS.md", "QWEN.md"]},
        "tools": {"approvalMode": "auto-edit"},
        "permissions": {"allow": ["run_shell_command(npm run check)", "run_shell_command(npm run references:check)",
            "run_shell_command(npm run format)", "run_shell_command(npm run typecheck)", "run_shell_command(npm test *)",
            "run_shell_command(npm run build)", "run_shell_command(git status *)", "run_shell_command(git diff *)", "run_shell_command(git log *)", "run_shell_command(rg *)"],
            "deny": ["run_shell_command(git push *)", "run_shell_command(gh *)", "run_shell_command(rm -rf *)"]},
        "memory": {"enableManagedAutoMemory": False, "enableManagedAutoDream": False, "enableAutoSkill": False},
        "telemetry": {"enabled": False}}


def agent_command(prompt, turns=60, minutes=45):
    return ["qwen", "--auth-type", "openai", "--model", "qwen-local", "--approval-mode", "auto-edit",
            "--max-session-turns", str(turns), "--max-tool-calls", "150", "--max-wall-time", f"{minutes}m",
            "--output-format", "stream-json", "--include-partial-messages", "--prompt", prompt]


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
