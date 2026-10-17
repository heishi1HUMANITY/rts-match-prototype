# #84 を別PCで再開する手順

このbranchは公平性NGの#84 WIPを転送保全したもの。#84 PRは未作成/未mergeで、v5も未採用。詳細は `artifacts/cp12-84-v5/HANDOFF.md`。Issue: https://github.com/heishi1HUMANITY/rts-match-prototype/issues/84

## Fresh clone (PowerShell)

新PCで `$taskRepoPath` をclone rootにする。各PowerShell行は先頭の `Set-Location` を保つ。`git clone`自体は他shellでも同じremote/branchを使う。

```powershell
Set-Location $env:USERPROFILE; $taskRepoPath = Join-Path (Get-Location) 'rts-match-prototype'; git clone https://github.com/heishi1HUMANITY/rts-match-prototype.git $taskRepoPath
Set-Location $taskRepoPath; git fetch origin
Set-Location $taskRepoPath; git switch --track origin/codex/cp12-84
Set-Location $taskRepoPath; npm ci
Set-Location $taskRepoPath; npm run check
Set-Location $taskRepoPath; npm run references:check
Set-Location $taskRepoPath; npm run specs:check
Set-Location $taskRepoPath; git status --short --branch
Set-Location $taskRepoPath; git rev-parse HEAD
```

既存cloneなら `$taskRepoPath` をそのclone rootにする。`git fetch origin`後、local branchがない場合は `git switch --track origin/codex/cp12-84`、既にある場合は以下のようにfast-forwardする。

```powershell
Set-Location $taskRepoPath; git switch codex/cp12-84
Set-Location $taskRepoPath; git pull --ff-only
```

## 既存監査データの再集計

```powershell
Set-Location $taskRepoPath; node artifacts/cp12-84-v5/summarize-v5.mjs
```

raw JSONL、正式summary、seed0–2の診断JSONL、ablation JSONLは `artifacts/cp12-84-v5/` に保存済み。正本の監査sourceは `scripts/audit-map-fairness.ts`。artifact内の `audit-map-fairness.ts` はcommit時点の重複snapshot。

## 任意の追加simulation

追加runはCPU時間と出力容量を使い、診断モードも勝率/人間プレイの判定にはならない。実行する場合はoutput名を一意にし、既存データを上書きしない。

```powershell
Set-Location $taskRepoPath; npx tsx scripts/audit-map-fairness.ts --seeds=1,2 --diagnose-north --output=artifacts/cp12-84-v5/unique-diagnostic.jsonl
```

`--output`を省略した非resume実行は標準temp checkpointを空にする。`--resume`には同一source・map/master定義・seed集合のcheckpointのみを使う。scriptは一致検証を強制しないので、再利用前に人が確認する。

固定tuning seedは0–17。各18試合に物理開始地点3つすべてが参加し、A陣営の開始割当は各6試合。勝率分母は開始地点ごと18。draw/tied/unresolved-at-12,000-tickは勝ちにせず個別記録する。v5はtuning NG（SW13/18・SE5/18・North0/18）。予定holdout seed200–217は未実行で、候補がtuningで合格するまで実行しない。

既存の `npm run check` は405 unit pass/1 skip、flow10 pass、build成功。`references:check` は471 files、`specs:check` は6 tests成功。これらは公平性合格やプレイ合格を示さない。新PCで取得後に手順の検査を再実行する。
