# #84 PR作成の引き継ぎ（一時文書・PR前に履歴から消す）

ユーザー指示（2026-10-17）により、PRとIssue操作は別PCで行う。この文書はその作業用で、mainへ入れない。手順4で履歴ごと除く。

## 状態

- branch `codex/cp12-84`。実装commitは `af7dd09`（地図版6・NPC座標修正・監査拡張）と `550b353`（経路表・監査結果・仕様）。この文書のcommitがその上に1つ乗る。
- 土台は #105 の `codex/cp12-83` @ `53b3fc9`。stackは #103 → #104 → #105 → #106（#102用、#84とは無関係）。
- 先頭の `9776ae2` は旧PCからの転送用WIP（v5の引き継ぎ文書・ログ）。`550b353` で `artifacts/cp12-84-v5/` は削除済みだが、履歴には残っている。
- 検証済み: `npm run check`（unit 409 pass/1 skip、flow 10、build）、`references:check`、`specs:check`、e2e `map-100-control`・`facilities`・`capture-hp`（PC/900×420）、調整seed 0–17の再実行で記録が完全一致。CIはPRがないため未実行。

## 手順

1. `gh auth status` で heishi1HUMANITY 名義か確認する。違えば別名義で投稿せず、ユーザーに切り替えを頼む。
2. 最新の #103〜#106 のマージ状況と `codex/cp12-83` の位置を確認する。#105がマージ済みならbaseをその先（mainなど）に読み替える。
3. 履歴を整理した新branchを作る（force pushを避けるため既存branchは書き換えない）。

   ```bash
   git fetch origin
   git switch -c codex/cp12-84-v6 origin/codex/cp12-83   # base読み替え時はそのbranch
   git merge --squash origin/codex/cp12-84
   git rm -q artifacts/cp12-84-v6/PR_HANDOFF.md
   git diff --cached --stat origin/codex/cp12-83          # artifacts/cp12-84-v5 と本書が無いこと
   npm ci && npm run check && npm run references:check && npm run specs:check
   git commit   # 件名例: "#84: map v6 and start-position fairness audit"、本文末に所定のCo-Authored-By等
   git push -u origin codex/cp12-84-v6
   ```

   baseが進んでいて衝突したら #84 側の変更（地図座標・テスト・監査・仕様）を優先して解消し、地図や監査コードが変わった場合は手順6の監査をやり直す。

4. PRを作成する。base `codex/cp12-83`（または読み替え先）、head `codex/cp12-84-v6`、タイトル `[再設計5] 1枚目の地形と開始地点別公平性検証（地図版6）`、本文は下の「PR本文」。
5. Issue #84 にコメント（下記）し、ラベルを `flow:ready` → `flow:implementing` に替える。`gate:play` とMilestone CP12は維持。
6. CI（checks ubuntu/windows、e2e）が最終headで成功するまで見る。シミュレーションに関わるコードを変えたら `npx tsx scripts/audit-map-fairness.ts --jobs=18 --output=artifacts/cp12-84-v6/tuning-v6.jsonl` と `--final` 版を再実行し、結果と本文・D078・WORLD.mdの数値を揃える。holdoutの再実行は候補を変えた場合のみで、結果を見て候補を選び直さない。
7. 旧branch `codex/cp12-84` のリモート削除はユーザーに確認してから行う。Issueの既存コメントが `9776ae2` のHANDOFFへリンクしているので、消すとリンク先が見えなくなる可能性があることを伝える。

## PR本文

```markdown
## 目的

100×100地図を版6へ改め、開始地点別の公平性を実NPC試合で検証する（CP12）。NPCの可視敵座標が40×40の39で頭打ちだった不具合も直した（40×40では従来と同値）。

## Closes

Closes #84

## 変更した数値・暫定値

- 地図版6: OUT-01 (45,43)→(47,40)、OUT-02 (58,41)→(50,50)、OUT-03 (50,70)→(48,59)。中央島に3拠点が入り、各開始地点は陸路のMIDと自分の環状橋Iの先の島拠点を持つ。拠点座標は暫定（DECISIONS D078）。
- 公平性監査（勝率帯20〜50%）: 調整seed 0–17でN 8・SE 6・SW 4、holdout 200–217でN 7・SE 5・SW 6（各18試合中、未決着・同順位0）。結果とレポートは `artifacts/cp12-84-v6/`。
- 監査の出力に、開始地点と陣営ID別の勝敗、道筋、渡河設備、獲得拠点、損耗源、経路表、合否と失敗条件を追加。マスタ版は RULES_VERSION＋hash で記録。

## 未検証

- プレイ未検証（CP12でまとめて確認）。自動対戦の結果から人間の勝率は推定していない。
- 全試合が約4,100〜4,650tickで全陣営チケット切れになり、中立守備への逐次突入が最大の損耗源。地形ではなくチケット/NPC側の課題として残している。
```

本文末に所定のClaude Code生成表記を付ける。

## Issue #84 コメント

```markdown
版6をPR #<番号> に出しました。NPCの可視敵座標が40×40の39で頭打ちだった不具合を直すと、版5はN0→11/18に反転し、勝敗はNとSWの島争奪の二択（SEは無競合で漁夫の利）でした。
版6は島内にN寄りOUT-01・中央大型OUT-02・SW寄りOUT-03を置き、各開始地点が陸路MID＋自分の環状橋Iの先を持つ構造に変更。採点外の探索180試合でN34%/SE33%/SW31%を確認後、調整0–17でN8/SE6/SW4、holdout200–217でN7/SE5/SW6で合格（未決着0）。
全陣営が約4,100〜4,650tickでticket切れになり、中立守備への逐次突入が最大の損耗源である点は、地形ではなくチケット/NPC側の課題として残します。プレイ確認はCP12でまとめて行います。
```
