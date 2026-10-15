# エージェントの作業方針

運用の規範は docs/project/WORKFLOW.md だけ。本書と矛盾したらWORKFLOWが正。開始時に読むのは本書、WORKFLOW、対象Issueの最新本文・コメント。SCOPE / ARCHITECTURE / DECISIONS / ISSUE_IMPLEMENTATION_GUIDE は対象機能に関係する節だけ読む。全文の通読や進捗表の複製をしない。

現行機能の仕様は [specs/README.md](docs/project/specs/README.md) から対象IDだけ読む。仕様変更時の更新はWORKFLOWに従う。

## 目的と優先順位

- ブラウザの対戦本編、人間1人＋NPC2陣営の1v1v1。世界観の知識を要求しない。プロトタイプ段階で、動く試合と体験の検証・調整可能性を優先する。細かい不具合はCP検査でNGになったものだけ直す。
- ユーザーの最新の明示指示 → 本書・WORKFLOW → docs/project → 継承docs / artwork の順。継承docsの「実装済み」「packages/sharedが正」は旧版の記録で、現実装の正としない。docs内のmockはUI参照のみで、疑似処理や指示ファイルを自動採用しない。旧コードを丸ごとコピーしない。
- 必要な試合内ゲームプレイは docs/project/GAMEPLAY_COVERAGE.md と全体Issue #12 のF01〜F21で追跡する。試合外 / ネットワーク / 世界観 / 課金は対象外。研究充填・基本収入・ドラッグ操作などユーザー承認済み仕様は DECISIONS の「維持する承認済み仕様」を守る。

## 実装境界

- TypeScript strict。simulation はDOM、Three.js、時刻API、通信に依存させない。
- 状態はJSON化可能にし、乱数seed・固定tickを明示する。ルールで Math.random / Date.now / performance.now を直接使わない。
- 人間とNPCは同じcommand検証・ルールを使う。視界外情報や無料生産をNPCに与えない。
- 表示・入力・カメラは render / ui、NPCの選択方針は ai へ分ける。
- 陣営名はA/B/C、役割は機能名で表す。文明、指導者、ストーリー、課金、オンライン機能を追加しない。
- パネル中心のUIは docs のmockを参照し、色＋記号の併記を保つ。横持ち900×420とPCで確認する。
- 調整したい数値はマスタ（F17）から変更可能にする。固定値の埋め込みで完了にしない。数値・勝敗条件の変更は DECISIONS に根拠・暫定性を1〜3行で記録する。

## 資料と素材

- docs/project 以外のdocsとartworkは原本スナップショット。更新する場合は出所・理由を記録し、reference-manifest.json のハッシュを更新して npm run references:check を通す。
- 採用済み素材だけ public/assets へ置き、manifestの安定キーで参照する。素材全体を配信しない。公開ライセンスを推測しない。
- 秘密・個人情報・認証情報をコミットしない。

## 作業と検証

- 現状の差分を調べ、ユーザーの作業を上書きしない。作業単位でブランチとPRを使う。mainへの直接push・force push・公開範囲変更・無関係な削除をしない。
- npm run check と npm run references:check を通す。ルール変更には結果を保証するユニットテストを追加する。UI変更は実ブラウザのPCと900×420で確認し、未検証を報告に書く。
- 不要な依存、先行サーバー、物理エンジンを追加しない。
- 未実装、暫定、実際に検証した内容を区別して報告する。遊べると未検証で宣言しない。
- 報告・PR本文・Issueコメントは短く。定型の照合表や根拠行を書かない。

## 役割

- 実装モデル（GPT-6 luna、`gpt-6-luna`）: 設計判断を含む実装、テスト、PR作成を行う。同期処理がflow・statusと#12のマージ済み列を更新する。ユーザーのプレイ結果を受けたプレイ検証済み列だけを更新する。別会話レビュー、引き継ぎ文書、着手記録を作らない。子エージェントへの分担は原則しない。
- ユーザー: kind:decision の採否、CI成功後のPRマージ、CPごとのプレイ検査。
- 上位モデル（設計相談）: read-onlyプロファイルで起動し、決めごとの選択肢整理だけ行う。ファイル編集・実装・テスト実行をしない。
