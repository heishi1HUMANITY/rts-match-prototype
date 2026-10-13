# 開発運用（規範文書）

この文書が運用の唯一の規範。他の文書の手順と矛盾する場合は本書が正。プロトタイプ段階の目的は「通常設定で試合が遊べ、体験を検査し、数値を調整できる」状態。細かい不具合はCP検査でNGになったものだけ直す。トークン節約のため、会話・文書・PR本文を短く保つ。

## 役割

| 担当                                 | 行うこと                                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 実装モデル GPT-6 luna (`gpt-6-luna`) | Issueの設計判断、実装、テスト、PR作成、Approve後のマージ、ラベルと#12の更新、CP票の案内             |
| ユーザー                             | kind:decision の採否、PRのApprove、CPごとの通常1試合                                                |
| 上位モデル                           | read-onlyプロファイル。decisionの選択肢整理やNGの切り分けの相談だけ。編集・実装・テスト実行をしない |

独立した会話によるレビュー、設計→実装の引き継ぎ文書、着手記録は廃止した（2026-10-13、DECISIONS参照）。

## 開始

「#30を進めて」で開始する。読むのは AGENTS.md、本書、対象Issueの本文とコメント、[実装ガイド](ISSUE_IMPLEMENTATION_GUIDE.md) の対象節、関係する [DECISIONS](DECISIONS.md) の節。`git status`、`git remote -v`、関連PR（例 `gh pr list --state all --search "#30"`）を確認し、既存PRがあれば続きから進める。設計上の判断はIssueコメントへ5行以内で記録して進める。ユーザー体験や依頼範囲を実質的に変える判断だけ、選択肢を示して確認する。

## ラベル

| ラベル            | 意味                                      |
| ----------------- | ----------------------------------------- |
| flow:ready        | 未着手。依存待ちは本文に明記              |
| flow:implementing | 実装・修正中（PR作成〜Approve待ちを含む） |
| flow:merged       | 実装がmainへマージ済み                    |
| gate:auto         | CIとApproveで閉じてよい                   |
| gate:play         | マージ後のCPでユーザーが1試合検査         |
| status:unverified | gate:play のマージ後、CPプレイ未検証      |
| kind:decision     | 実装なし。ユーザーの採否判断が必要        |
| kind:checkpoint   | CPプレイ検査結果の記録Issue               |
| kind:gate         | G1〜G4の旧区切り。新規には使わない        |

実装Issueは flow を一つ、gate を一方だけ付ける。kind:decision / kind:checkpoint / #12 には flow と gate を付けない。レビュー待ち状態専用の旧フローラベルは使わない。

## Issue本文

目的 / 実装範囲 / 受入条件（3〜6行、自動判定できる文）/ ユーザー検査 要・不要と理由1行 / CP。操作・表示・時間/強さに触るなら gate:play。inspection/Fxx_SCENARIOS.md の作成は任意。

## PRのDoD（マージ条件）

1. CIの checks (ubuntu-latest / windows-latest) と e2e が最終headで成功。
2. 本文に「Closes #番号」（kind:decision は除く）。
3. ルール変更にはユニットテスト、UI変更には既存スモークe2eの成功。調整したい数値はマスタから変更可能にする。
4. ユーザーがGitHub上でApproveする。実装モデルはApprove前にマージしない。

Approve後は実装モデルがマージし、ブランチを削除する。別会話レビュー、修正巡数、照合表は不要。PR本文は「目的 / Closes / 変更した数値・暫定値 / 未検証」の4項目だけ。

## CPと検査

Milestone に CP0、CP1… を作る。gate:play が1件マージされたらそのCPを締めて検査票を出す。1CP = gate:play 1件が基本で、gate:auto は同じCPに何件入ってもよい。検査票は Checkpoint sync が Milestone 所属の kind:checkpoint Issue に自動生成する。票は「通常設定で1試合」「確認3点」「既知の未検証」と自動収載リストだけにし、commit一覧や詳細手順を書かない。

ユーザーは確認3点をそれぞれ OK / NG で返す（例: 「CP1 1:OK 2:NG 施設が建たない 3:OK」）。実装モデルが結果を検査記録Issueへ記録し、OKの機能だけ #12 のプレイ検証済みへチェックして status:unverified を外す。NGは元Issueに紐づく修正Issueを作り、同じDoDでマージして次のCPへ載せる。

前のCPで未検証のまま残った gate:play は、同期が次の開いているCP票へ「持ち越し」として自動で載せる。ユーザーが確認していない範囲は未検証のままにする。

同期の取りこぼしは Checkpoint sync の workflow_dispatch でPR番号を指定し、apply=false の計画を確認してから apply=true で復旧する。処理済みPRの再実行はプレイ合格を取り消すため行わない。

## 進捗

唯一の正は [全体Issue #12](https://github.com/heishi1HUMANITY/rts-match-prototype/issues/12) の「マージ済み」「プレイ検証済み」2列。ローカル文書へ進捗を複製しない。

## 中断

コンテキスト上限や停止の前に、対象Issueへ「ブランチ / 最新SHA / 未コミットの有無 / 残作業 / 次の一手」を5行以内で記録する。未完成の差分を破棄しない。
