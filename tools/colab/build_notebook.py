"""Generate a standalone notebook; runtime.py is embedded, not fetched at run time."""
import json
from pathlib import Path
import textwrap

ROOT = Path(__file__).resolve().parents[2]
cells = []


def md(source):
    cells.append({"cell_type": "markdown", "metadata": {}, "source": textwrap.dedent(source).strip().splitlines(True)})


def code(source):
    cells.append({"cell_type": "code", "metadata": {}, "execution_count": None,
                  "outputs": [], "source": textwrap.dedent(source).strip().splitlines(True)})


md('''
# RTS 実装エージェント — Qwen3.8 / Colab Pro

上から順番に実行してください。**ランタイム → ランタイムのタイプを変更 → GPU**。
初回はDrive接続・モデル約16.5GB取得・CUDAビルドに時間がかかります。Driveに20GB以上の空きを用意してください。
次回は同じDriveフォルダからモデル・Node・npmキャッシュを使います。
llama-serverはGPU/CUDA/OS/コンパイラが一致すればビルドも再利用します。
毎セッションのDrive→一時ディスクへのモデルコピーとGPUへの読込は必要です。

標準設定は **Qwen3.8-27B / Unsloth UD-Q4_K_M / 16K context / テキストのみ**。
画像入力・自動ブラウザ検査はこのNotebookの初版には含みません。
モデル取得とAPI・ツール呼び出しの確認後、「実装する」を有効にします。
GitHub SecretsはColab左側の鍵から `GH_TOKEN`（対象repoへアクセスできるtoken）を登録。
tokenはNotebook本文やDriveには保存しません。

実装Qwen → 必須チェック → 別会話の読み取り専用Qwenレビュー → 最大2回の修正・再レビューを親セルが管理します。
GPT/Codex/Claudeのレビューを前提にしません。外部投稿とPR作成は最後の専用セルで行います。
マージはユーザーが画面検査後に明示合格した場合だけ、最後の専用セルで行います。
Colabのセッション終了は防げません。作業は120秒ごと・実行終了時に保存します。
強制終了直前の最大120秒程度の変更は失われる可能性があり、途中保存は検証合格を意味しません。
''')
code('''
# @title 1. 設定（次回も同じDRIVE_FOLDERを使用）
ISSUE_NUMBER = 30 # @param {type:"integer"}
DRIVE_FOLDER = "rts-qwen-colab" # @param {type:"string"}
MODEL_REPO = "unsloth/Qwen3.8-27B-GGUF" # @param {type:"string"}
MODEL_PATTERN = "*UD-Q4_K_M*.gguf" # @param {type:"string"}
# 空欄: 初回に解決したrevisionをDriveへ固定。更新したいときだけSHAを変更。
MODEL_REVISION = "" # @param {type:"string"}
LLAMA_REF = "refs/heads/master" # @param {type:"string"}
CONTEXT_SIZE = 16384 # @param [8192,16384,32768] {type:"raw"}
REPAIR_MODEL = False # @param {type:"boolean"}
RESUME_WORK = True # @param {type:"boolean"}
# 通常は空欄。保存済みbranch/明確な既存PRを自動選択。複数候補のときだけ指定。
WORK_BRANCH = "" # @param {type:"string"}
RUN_AGENT = False # @param {type:"boolean"}
MAX_TURNS = 60 # @param {type:"integer"}
MAX_MINUTES = 45 # @param {type:"integer"}
MAX_REPAIRS = 2 # @param [0,1,2] {type:"raw"}
USER_FEEDBACK = "" # @param {type:"string"}
# MAX_MINUTESは各実装/レビュー担当の上限。全体は修正回数・テスト時間によって延びます。
REPOSITORY = "heishi1HUMANITY/rts-match-prototype"
QWEN_CODE_VERSION = "0.25.1"
assert ISSUE_NUMBER > 0 and MAX_TURNS > 0 and 1 <= MAX_MINUTES <= 180
assert DRIVE_FOLDER and "/" not in DRIVE_FOLDER and "\\\\" not in DRIVE_FOLDER and DRIVE_FOLDER not in (".", "..")
''')
code('''
# @title 2. DriveとGPUを確認
from google.colab import drive
from pathlib import Path
import subprocess, os
drive.mount("/content/drive")
CACHE = Path("/content/drive/MyDrive") / DRIVE_FOLDER
RUNTIME = Path("/content/rts-agent-runtime")
CACHE.mkdir(parents=True, exist_ok=True)
RUNTIME.mkdir(parents=True, exist_ok=True)
gpu = subprocess.check_output(["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"], text=True)
print("GPU:", gpu.strip())
vram_mib = int(subprocess.check_output(["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"], text=True).splitlines()[0])
if vram_mib < 22000:
    raise RuntimeError("標準27B設定は22GB以上のGPUが必要です。40GB以上推奨。GPUを変更して再実行してください。")
print("保存先:", CACHE)
''')
code('''
# @title 3. 必要ツールを準備（GPU/モデルには触れません）
import sys
subprocess.run([sys.executable, "-m", "pip", "install", "huggingface_hub>=0.34,<2"], check=True)
subprocess.run(["apt-get", "update", "-qq"], check=True)
subprocess.run(["apt-get", "install", "-y", "-qq", "git", "gh", "ripgrep", "cmake", "build-essential", "libssl-dev"], check=True)
''')
md('''
以下は同梱の補助処理です。編集せず実行してください。
モデルと実行環境の取得は再実行可能です。設定revisionを変えない限り同じ版を使います。
''')
code((ROOT / "tools/colab/runtime.py").read_text(encoding="utf-8"))
code("# Qwenだけで実装・レビュー・検査準備を進める共通指示\nQWEN_WORKFLOW_INSTRUCTIONS = " + repr((ROOT / "docs/project/QWEN_AGENT_WORKFLOW.md").read_text(encoding="utf-8")))
code('''
# @title 4. Node / Qwen Code / CUDA実行プログラム
install_node(CACHE, RUNTIME)
run(["npm", "install", "--global", f"@qwen-code/qwen-code@{QWEN_CODE_VERSION}"])
SERVER_BINARY, LLAMA_COMMIT = build_server(CACHE, RUNTIME, LLAMA_REF)
print("llama.cpp revision:", LLAMA_COMMIT)
run(["qwen", "--version"])
''')
code('''
# @title 5. モデルをDriveに取得し一時ディスクへコピー
MODEL_PATH, MODEL_METADATA = prepare_model(CACHE, RUNTIME / "models", MODEL_REPO,
                                         MODEL_PATTERN, MODEL_REVISION, REPAIR_MODEL)
print("モデル:", MODEL_PATH.name, "revision:", MODEL_METADATA["revision"])
''')
code('''
# @title 6. ローカルAPIを起動（外部へ公開しません）
import secrets, socket, urllib.error
if "server_process" in globals() and server_process.poll() is None:
    stop_owned_process(server_process)
with socket.socket() as test_socket:
    test_socket.bind(("127.0.0.1", 8080))
LOCAL_LLM_API_KEY = secrets.token_urlsafe(32)
server_log = open(RUNTIME / "llama-server.log", "w", encoding="utf-8")
server_process = subprocess.Popen([
    str(SERVER_BINARY), "--model", str(MODEL_PATH), "--alias", "qwen-local",
    "--host", "127.0.0.1", "--port", "8080", "--api-key", LOCAL_LLM_API_KEY,
    "--n-gpu-layers", "99", "--ctx-size", str(CONTEXT_SIZE), "--parallel", "1",
    "--jinja", "--reasoning-format", "deepseek", "--reasoning-budget", "2048",
    "--chat-template-kwargs", json.dumps({"enable_thinking": True, "reasoning_effort": "medium"}),
], stdout=server_log, stderr=subprocess.STDOUT, start_new_session=True)
deadline = time.monotonic() + 600
while True:
    if server_process.poll() is not None:
        raise RuntimeError("モデル起動失敗。次の診断セルでログを確認してください。")
    try:
        request = urllib.request.Request("http://127.0.0.1:8080/health", headers={"Authorization": "Bearer " + LOCAL_LLM_API_KEY})
        with urllib.request.urlopen(request, timeout=5) as response:
            if response.status == 200: break
    except (urllib.error.URLError, TimeoutError):
        pass
    if time.monotonic() > deadline:
        stop_owned_process(server_process)
        raise TimeoutError("10分以内にモデルが起動しませんでした。ログを確認してください。")
    time.sleep(2)
print("モデルAPI起動完了")
''')
code('''
# @title 7. 診断（必要な場合のみ）
# キーを出力に残さず末尾だけ確認。
print((RUNTIME / "llama-server.log").read_text(errors="replace")[-5000:].replace(LOCAL_LLM_API_KEY, "[redacted]"))
''')
code('''
# @title 8. ツール呼び出しの動作確認
def model_request(payload):
    request = urllib.request.Request("http://127.0.0.1:8080/v1/chat/completions",
        data=json.dumps({"model": "qwen-local", **payload}).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + LOCAL_LLM_API_KEY})
    with urllib.request.urlopen(request, timeout=300) as response:
        return json.load(response)
smoke = model_request({"messages": [{"role": "user", "content": "Call echo with value ready."}],
    "tools": [{"type": "function", "function": {"name": "echo", "description": "Echo a value",
    "parameters": {"type": "object", "properties": {"value": {"type": "string"}}, "required": ["value"]}}}],
    "tool_choice": "required", "max_tokens": 1024, "temperature": 0.1,
    "chat_template_kwargs": {"enable_thinking": False}})
call = smoke["choices"][0]["message"].get("tool_calls", [])
assert call and call[0]["function"]["name"] == "echo", "ツール呼び出しに失敗。実装は開始せずログと版を確認してください。"
assert json.loads(call[0]["function"]["arguments"])["value"] == "ready"
print("APIとツール呼び出し: OK（実装品質の合格ではありません）")
''')
code('''
# @title 9. Issueと作業ブランチを準備・前回作業を復元
from google.colab import userdata
GH_TOKEN_VALUE = userdata.get("GH_TOKEN")
github_env = os.environ.copy()
github_env.update({"GH_TOKEN": GH_TOKEN_VALUE, "GH_CONFIG_DIR": str(RUNTIME / "gh-config")})
def gh(args):
    return run(["gh", *args], env=github_env, capture=True)
issue = json.loads(gh(["issue", "view", str(ISSUE_NUMBER), "--repo", REPOSITORY,
    "--json", "number,title,body,comments,state,labels"]))
assert issue["state"] == "OPEN", "完了済みIssueです。再実装せず別Issueを指定してください。"
pulls = json.loads(gh(["pr", "list", "--repo", REPOSITORY, "--state", "open",
    "--json", "number,title,body,headRefName,url"]))
related = [p for p in pulls if re.search(rf"(?<![0-9])#{ISSUE_NUMBER}(?![0-9])", p["body"] + " " + p["title"])]
if related:
    print("関連候補PR:", [(p["number"], p["headRefName"], p["url"]) for p in related])
CHECKPOINTS = CACHE / "work" / f"issue-{ISSUE_NUMBER}"
saved_branch = read_json(CHECKPOINTS / "latest.json")["branch"] if RESUME_WORK and (CHECKPOINTS / "latest.json").exists() else ""
branch = choose_work_branch(ISSUE_NUMBER, WORK_BRANCH, saved_branch, related)
print("作業ブランチを選択:", branch)
run(["git", "check-ref-format", "--branch", branch], capture=True)
assert branch not in ("main", "master"), "専用ブランチを指定してください"
REPO = RUNTIME / f"issue-{ISSUE_NUMBER}"
CHECKPOINTS = CACHE / "work" / f"issue-{ISSUE_NUMBER}"
remote = f"https://github.com/{REPOSITORY}.git"
if not REPO.exists():
    if RESUME_WORK and saved_branch == branch and (CHECKPOINTS / "latest.json").exists():
        restored = restore_checkpoint(CHECKPOINTS, REPO, remote)
        assert restored["branch"] == branch, "保存branchと設定が異なります。WORK_BRANCHを合わせてください。"
        print("作業を復元:", restored["id"])
    else:
        run(["gh", "auth", "setup-git"], env=github_env)
        run(["git", "clone", remote, str(REPO)], env=github_env)
        existing = run(["git", "branch", "-r", "--list", f"origin/{branch}"], cwd=REPO, capture=True).strip()
        if existing:
            run(["git", "switch", "--track", f"origin/{branch}"], cwd=REPO)
        else:
            assert not WORK_BRANCH, "指定branchがありません。継続先を確認してください。"
            run(["git", "switch", "-c", branch, "origin/main"], cwd=REPO)
assert run(["git", "branch", "--show-current"], cwd=REPO, capture=True).strip() == branch
assert run(["git", "remote", "get-url", "origin"], cwd=REPO, capture=True).strip() == remote
run(["git", "config", "user.name", "Colab implementation agent"], cwd=REPO)
run(["git", "config", "user.email", "colab-agent@users.noreply.github.com"], cwd=REPO)
run(["npm", "ci"], cwd=REPO)
CONTROL = prepare_control_folder(REPO)
(CONTROL / "workflow.md").write_text(QWEN_WORKFLOW_INSTRUCTIONS, encoding="utf-8")
ISSUE_CONTEXT = CONTROL / "issue-context.json"
def refresh_issue_context():
    current_issue = json.loads(gh(["issue", "view", str(ISSUE_NUMBER), "--repo", REPOSITORY,
        "--json", "number,title,body,comments,state,labels"]))
    assert current_issue["state"] == "OPEN", "対象Issueが完了済みです。再実装しません。"
    current_prs = json.loads(gh(["pr", "list", "--repo", REPOSITORY, "--head", branch, "--state", "open",
        "--json", "number,title,body,headRefName,headRefOid,url,statusCheckRollup"]))
    failures = []
    for pr in current_prs:
        for check in pr.get("statusCheckRollup", []):
            if check.get("conclusion") in ("FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED") or check.get("state") in ("FAILURE", "ERROR"):
                match = re.match(rf"https://github.com/{re.escape(REPOSITORY)}/actions/runs/([0-9]+)", check.get("detailsUrl", ""))
                log = "失敗ログの自動取得ができませんでした。未確認として扱ってください。"
                if match:
                    try: log = gh(["run", "view", match[1], "--repo", REPOSITORY, "--log-failed"])[-60000:]
                    except subprocess.CalledProcessError: pass
                failures.append({"pr": pr["number"], "head": pr["headRefOid"], "check": check, "log": log})
    write_json(ISSUE_CONTEXT, {"issue": current_issue, "related_prs": current_prs or related})
    write_json(CONTROL / "ci-failures.json", {"failures": failures})
    return current_issue
issue = refresh_issue_context()
write_json(Path.home() / ".qwen/settings.json", agent_settings(CONTEXT_SIZE))
checkpoint(REPO, CHECKPOINTS, {"phase": "prepared", "model": MODEL_METADATA["revision"]})
print(issue["title"], "branch:", branch)
''')
code('''
# @title 10. 実装・独立レビュー・修正する（RUN_AGENT=Trueで有効）
import threading
if RUN_AGENT:
    WORKFLOW_STATE = {"ready": False}
    issue = refresh_issue_context()
    agent_env = {k: v for k, v in os.environ.items()
                 if not any(word in k.upper() for word in ("TOKEN", "SECRET", "PASSWORD", "API_KEY"))}
    agent_env["LOCAL_LLM_API_KEY"] = LOCAL_LLM_API_KEY
    stop_checkpoints = threading.Event()
    def periodic_save():
        while not stop_checkpoints.wait(120):
            try: checkpoint(REPO, CHECKPOINTS, {"phase": "in-progress"})
            except Exception as error: print("途中保存に失敗:", type(error).__name__)
    saver = threading.Thread(target=periodic_save, daemon=True)
    saver.start()
    WORKFLOW_DIR = CHECKPOINTS / ("workflow-" + time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:8])
    write_json(CONTROL / "active-workflow.json", {"directory": str(WORKFLOW_DIR)})
    WORKFLOW_STATE = {"ready": False}
    try:
        WORKFLOW_STATE = run_issue_workflow(REPO, WORKFLOW_DIR, ISSUE_NUMBER, ISSUE_CONTEXT,
            agent_env, CONTEXT_SIZE, MAX_TURNS, MAX_MINUTES, MAX_REPAIRS, USER_FEEDBACK)
        print("状態:", WORKFLOW_STATE["phase"])
        if WORKFLOW_STATE["ready"]:
            print("Qwen独立レビューと必須チェック完了。ユーザーの動作確認へ進めます。")
        else:
            print("指摘/未完了が残っています。合格ではありません。差分を保存しました。")
        last_review = WORKFLOW_STATE["rounds"][-1]["review"].get("report") if WORKFLOW_STATE["rounds"] else None
        if last_review:
            print("画面で確認する操作:")
            for index, item in enumerate(last_review.get("user_checks", []), 1):
                print(f"{index}. {item['action']} → {item['expected']}")
            for item in last_review.get("unchecked", []): print("未検査:", item)
    finally:
        stop_checkpoints.set(); saver.join(timeout=30)
        checkpoint(REPO, CHECKPOINTS, {"phase": "workflow-stopped", "model": MODEL_METADATA["revision"]})
    print("保存先:", CHECKPOINTS)
else:
    print("RUN_AGENT=Trueにして実行します。修正依頼はUSER_FEEDBACKへ普通の言葉で記入します。")
''')
code('''
# @title 11. 保存・差分確認（いつでも実行可能）
print(run(["git", "status", "--short"], cwd=REPO, capture=True))
checkpoint(REPO, CHECKPOINTS, {"phase": "manual-save"})
handoff = REPO / ".COLAB_HANDOFF.md"
if handoff.exists(): print(handoff.read_text(encoding="utf-8"))
print("作業保存済み。ログ/途中保存はDriveに残ります。")
''')
code('''
# @title 12. 検証と画面プレビュー（エージェント終了後）
require_reviewed_workspace(REPO, WORKFLOW_STATE, ISSUE_NUMBER)
run(["npm", "run", "check"], cwd=REPO)
run(["npm", "run", "references:check"], cwd=REPO)
PREVIEW_BUILD = read_json(REPO / "dist/build-info.json")
require_reviewed_workspace(REPO, WORKFLOW_STATE, ISSUE_NUMBER)
PREVIEW_SHA = PREVIEW_BUILD["commit"]
PREVIEW_CLEAN = not PREVIEW_BUILD["dirty"]
CHECKED_DIFF = run(["git", "diff", "--binary", "HEAD"], cwd=REPO, capture=True)
if "preview_process" in globals() and preview_process.poll() is None and globals().get("preview_repo") != REPO:
    stop_owned_process(preview_process)
if "preview_process" not in globals() or preview_process.poll() is not None:
    preview_log = open(RUNTIME / "preview.log", "w")
    preview_process = subprocess.Popen(["npm", "run", "preview", "--", "--port", "5182", "--strictPort"],
        cwd=REPO, stdout=preview_log, stderr=subprocess.STDOUT, start_new_session=True)
    preview_repo = REPO
    time.sleep(3)
    assert preview_process.poll() is None, "プレビュー起動失敗。preview.logを確認してください。"
from google.colab import output
output.serve_kernel_port_as_iframe(5182, height=650)
print("このColab内の画面です。ブラウザ操作・900×420・タッチなどは別途確認してください。")
''')
md('''
## PRを作る場合
次のセルはチェックを再実行してから、専用ブランチをpushし、PRを作成/更新します。
`PUBLISH_PR=True`を選んだ場合だけ外部へ反映します。mainへ直接pushせず、マージもしません。
既存PRがある場合は新規PRを重複作成しません。
CI失敗時はセル10を再実行すると、最新コメントとCI失敗ログをQwenへ渡して修正・再レビューします。
技術確認は親セルとQwenレビューが担当します。ユーザーはセル12の操作案内に沿ってふるまいを確認します。
''')
code('''
# @title 13. PRを作成/更新する（任意）
PUBLISH_PR = False # @param {type:"boolean"}
PR_TITLE = "" # @param {type:"string"}
PR_DESCRIPTION = "" # @param {type:"string"}
if PUBLISH_PR:
    require_reviewed_workspace(REPO, WORKFLOW_STATE, ISSUE_NUMBER)
    assert run(["git", "branch", "--show-current"], cwd=REPO, capture=True).strip() == branch
    assert branch not in ("main", "master")
    assert json.loads(gh(["issue", "view", str(ISSUE_NUMBER), "--repo", REPOSITORY, "--json", "state"]))["state"] == "OPEN", "対象Issueが完了済みです。重複実装を提出しないでください。"
    run(["npm", "run", "check"], cwd=REPO)
    run(["npm", "run", "references:check"], cwd=REPO)
    require_reviewed_workspace(REPO, WORKFLOW_STATE, ISSUE_NUMBER)
    run(["git", "add", "--all"], cwd=REPO)
    if run(["git", "diff", "--cached", "--name-only"], cwd=REPO, capture=True).strip():
        run(["git", "commit", "-m", PR_TITLE or issue["title"]], cwd=REPO)
    run(["npm", "run", "build"], cwd=REPO)
    assert not read_json(REPO / "dist/build-info.json")["dirty"], "検査版はclean commitから作成してください"
    require_reviewed_workspace(REPO, WORKFLOW_STATE, ISSUE_NUMBER)
    run(["gh", "auth", "setup-git"], env=github_env)
    run(["git", "push", "--set-upstream", "origin", branch], cwd=REPO, env=github_env)
    PUBLISHED_SHA = run(["git", "rev-parse", "HEAD"], cwd=REPO, capture=True).strip()
    existing = json.loads(gh(["pr", "list", "--repo", REPOSITORY, "--head", branch,
                              "--state", "open", "--json", "number,url"]))
    body = RUNTIME / "pr-body.md"
    handoff_file = REPO / ".COLAB_HANDOFF.md"
    description = PR_DESCRIPTION.strip() or (handoff_file.read_text(encoding="utf-8") if handoff_file.exists()
        else "実装エージェントの引き継ぎが未記載です。完了扱いせず、差分と未完了事項の確認が必要です。")
    review = WORKFLOW_STATE["rounds"][-1]["review"]["report"]
    description += "\\n\\nQwen独立レビュー: pass（別会話・読み取り専用）。\\n"
    description += "\\n".join(f"- {item['action']} → {item['expected']}" for item in review["user_checks"])
    description += "\\n未検査: " + " / ".join(review["unchecked"])
    body.write_text(description + f"\\n\\nRelated: #{ISSUE_NUMBER}\\n\\n検証: npm run check / npm run references:check成功。ブラウザ実操作は別途確認。\\nモデル: {MODEL_REPO} @ {MODEL_METADATA['revision']} / llama.cpp @ {LLAMA_COMMIT}\\nユーザー合格後にマージ。", encoding="utf-8")
    if existing:
        print(gh(["pr", "edit", str(existing[0]["number"]), "--repo", REPOSITORY, "--body-file", str(body)]))
    else:
        print(gh(["pr", "create", "--draft", "--repo", REPOSITORY, "--base", "main", "--head", branch,
                  "--title", PR_TITLE or issue["title"], "--body-file", str(body)]))
    checkpoint(REPO, CHECKPOINTS, {"phase": "pr-published"})
    print("PR提出SHA:", PUBLISHED_SHA, "。セル12を再実行して、このclean版を画面で確認してください。")
else:
    print("GitHubへの反映は行っていません。作業はDriveへ保存できます。")
''')
md('''
## 動作確認で合格した場合のみ
PR提出後にセル12を再実行し、cleanな対象版を画面で確認してください。
修正が必要ならセル1のUSER_FEEDBACKへ普通の言葉で記入し、セル10からやり直します。
合格した場合だけ次のUSER_ACCEPTEDを有効にします。PRのheadと検査版SHAが同じでCI成功ならマージします。
''')
code('''
# @title 14. ユーザー検査に合格した版をマージする（任意）
USER_ACCEPTED = False # @param {type:"boolean"}
if USER_ACCEPTED:
    require_reviewed_workspace(REPO, WORKFLOW_STATE, ISSUE_NUMBER)
    expected_sha = run(["git", "rev-parse", "HEAD"], cwd=REPO, capture=True).strip()
    candidates = json.loads(gh(["pr", "list", "--repo", REPOSITORY, "--head", branch, "--state", "open", "--json", "number"]))
    assert len(candidates) == 1, "対象PRを一意に確認できません。"
    pr_number = candidates[0]["number"]
    pr = json.loads(gh(["pr", "view", str(pr_number), "--repo", REPOSITORY,
        "--json", "headRefOid,isDraft,statusCheckRollup"]))
    expected_sha = require_approved_revision(REPO, WORKFLOW_STATE, ISSUE_NUMBER, PREVIEW_BUILD, PUBLISHED_SHA, pr)
    if pr["isDraft"]: gh(["pr", "ready", str(pr_number), "--repo", REPOSITORY])
    print(gh(["pr", "merge", str(pr_number), "--repo", REPOSITORY, "--squash", "--match-head-commit", expected_sha]))
    merged = json.loads(gh(["pr", "view", str(pr_number), "--repo", REPOSITORY, "--json", "state"]))
    assert merged["state"] == "MERGED", "マージ未完了です。Issueは閉じません。"
    gh(["issue", "close", str(ISSUE_NUMBER), "--repo", REPOSITORY, "--reason", "completed",
        "--comment", f"ユーザーがNotebookで検査合格を明示。検査対象 {expected_sha} / PR #{pr_number} をマージ済み。"])
    checkpoint(REPO, CHECKPOINTS, {"phase": "merged", "approved_sha": expected_sha})
    print("合格版をマージしIssueを完了しました。")
else:
    print("まだマージしていません。ゲームの動作確認で合格した場合だけUSER_ACCEPTED=Trueにします。")
''')
code('''
# @title 15. 終了（保存してGPUを解放）
for name in ("agent_process", "preview_process", "server_process"):
    process = globals().get(name)
    if process is not None and process.poll() is None:
        stop_owned_process(process)
if "REPO" in globals() and REPO.exists(): checkpoint(REPO, CHECKPOINTS, {"phase": "shutdown"})
print("保存・プロセス停止済み。Colabメニューでランタイムを切断してください。")
''')
md('''
## 再開・トラブル
- 次回も同じDriveフォルダ・Issue番号・WORK_BRANCHで、セル1から順に実行します。
  不具合はUSER_FEEDBACKへ操作と困った結果を記入し、セル10を再実行します。
  Driveのモデルは再ダウンロードせず、同じ版を使用します。作業差分はセル9で復元します。
- 16GB GPUでは標準27B構成を開始しません。GPUを変更してください。
- モデル破損が疑われる場合はREPAIR_MODEL=Trueで再実行します。
- llama.cppを更新する場合はLLAMA_REFを新しいtag/refへ変更します。
  モデル更新はMODEL_REVISIONに新しいSHAを指定します。元のキャッシュは保持します。
- 途中保存は世代ごとに残ります。Drive容量が不足したら、不要になった古いwork世代を手動で整理してください。
- 許可されていないシェルコマンドは実行が拒否されます。ログと引き継ぎを確認し、必要なコマンドだけ
  agent_settingsのallowへ追加してください。権限の一括スキップは使用していません。
- 切断後の再開はコード差分と引き継ぎから行います。Qwenの会話履歴そのものは復元しません。
- ログ・変更ファイルは私有Driveへ保存されます。Secretsをソース/ログへ書く指示を出さないでください。

参照: [モデル配布](https://huggingface.co/unsloth/Qwen3.8-27B-GGUF) /
[Qwen Code](https://github.com/QwenLM/qwen-code) /
[Qwenサブエージェント](https://qwenlm.github.io/qwen-code-docs/en/users/features/sub-agents/) /
[llama.cpp](https://github.com/ggml-org/llama.cpp/tree/master/tools/server) /
[Colabの制限](https://research.google.com/colaboratory/faq.html)
''')

for index, cell in enumerate(cells):
    cell["id"] = f"rts-colab-{index:02d}"
notebook = {"cells": cells, "metadata": {"colab": {"name": "RTS_Qwen_Colab.ipynb"},
    "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
    "language_info": {"name": "python"}, "accelerator": "GPU"}, "nbformat": 4, "nbformat_minor": 5}
destination = ROOT / "notebooks/RTS_Qwen_Colab.ipynb"
destination.parent.mkdir(exist_ok=True)
destination.write_text(json.dumps(notebook, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(destination)
