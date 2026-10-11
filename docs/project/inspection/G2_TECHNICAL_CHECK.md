# G2技術確認記録

2026-10-11、G2-r01。G1合格版からschema3/rules g2-v1へ拡張。完全commit SHA、PR、CI結果はIssue #3に記録します。ユーザー合格は未取得。

## 実装と検証対象

- 通常設定と3検査scenario、資源/HP/拠点/研究/予約/探索状態、JSON再現。
- 全陣営共通の視界。通常UI/renderはFactionViewを受け、敵の現在位置・経路・資源・研究を非可視時に渡さない。unknown/remembered/visible/ownedを区別する。
- 共通commandによる一括支払い、部隊枠予約、FIFO生産、全額取消、一度限りの首都破壊返金、研究前提と2段効果。
- 研究→移動→同時交戦→破壊/損失→制圧→経済→生産→チケット→最終視界の固定tick順。
- 部隊ドラッグ移動・仮経路照会、HUD/取消/停止/復旧、全情報診断と同seed/scenario/履歴のリプレイ。
- 独立レビューで未知の兵種拒否の履歴が再生できない問題を発見し、修正と回帰テストを追加。状態/視界/renderer/UI操作境界/交戦統合の再レビューは追加指摘なし。

## 実ブラウザー確認待ち

親による `npm run check` 成功（整形・型検査・15ファイル114テスト・production build）。`npm run references:check` は471原本成功、`git diff --check` 成功。production JSは約632KB/gzip164KBで500KB閾値警告が継続しており、性能は未実測。

G1-r02で内蔵ブラウザーの操作が自動安全チェックのURLプロトコル制限を理由に拒否されました。別経路で回避せず、G2の実操作・DOM/pick漏洩・900×420実表示・実機タッチは未確認です。CSS寸法計算とpure renderer/inputテストは実操作の代わりにはしません。性能、WebGL喪失復旧、実際の非表示タブ復帰も実機未確認。技術検証完了やuser-reviewへの移行を宣言しません。

手順は [G2_SCENARIOS.md](G2_SCENARIOS.md)。起動URLへのHTTP応答は起動確認に限り、操作検証を意味しません。
