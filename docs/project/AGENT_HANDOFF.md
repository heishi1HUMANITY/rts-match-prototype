# エージェントへの引き継ぎ

2026-10-12時点のスナップショット。更新先の正はGitHub Issue/PRであり、実行前に再照合する。

## リポジトリと状態

- repository: `heishi1HUMANITY/rts-match-prototype`
- このPC: `D:/git/rts-match-prototype`。環境のcwd `D:/git/rts` は旧資料のフォルダの場合がある。remoteで照合する。
- G1/PR #8、G2/PR #10、G3/PR #11、F01/PR #31はマージ済み。
- F01合格版: `2e448347a4b958e799aeddc426bd7ad7ad4943e1`。ユーザーはUXの細部を後続検討として合格。main merge: `81fdfc1799170240c37c821243b2783ea8766f43`。
- **F02/#14/PR #32はユーザー検査待ちで未マージ**。ブランチ `feature/f02-target-march`、head `3f94b6c045781aac31c6444b1a4c582b6988b2e8`。この文書整備をF02合格と扱わない。
- F02は21テストファイル・185テストとWindows/Linux CI成功。CI run `38183938883`。schema6/rules f02-v1。F02前のmainはschema5/rules g3-v1。現在の版を実コード/build-infoで必ず再確認する。

## 続きの入口

[#14の検査記録](https://github.com/heishi1HUMANITY/rts-match-prototype/issues/14#issuecomment-6115046138)、[PR #32](https://github.com/heishi1HUMANITY/rts-match-prototype/pull/32)に検査版と未検査を記録済み。F02設計 `docs/project/preparation/F02_DESIGN.md` と検査票 `docs/project/inspection/F02_SCENARIOS.md` はそのPRのブランチにある。mainにない場合はPRのファイルを読むか、そのブランチを別作業ツリーで取得し、未実装と誤認して書き直さない。

当時のpreviewは `http://127.0.0.1:5182/`。プロセス存続を保証しない。F02検査版をclean checkoutして `npm ci` → `npm run build` → `npm run preview -- --port 5182 --strictPort` で再起動できる。別PCからこのPCのlocalhostへ接続できるとは限らない。既存ポートのプロセスを無断で停止しない。

実ブラウザのPC/900×420/タッチ・ピッキング・操作感は未検査。以前のlocalhostブラウザ自動操作がURL制限で拒否されたため、当時は迂回せず未検査とした。将来の環境ではその時点の権限・ツール可用性に従い、過去の拒否を全環境の恒久禁止や検査済みの根拠にしない。

推奨次タスクは **#30/F17マスタ管理**。詳細は [F17設計](preparation/F17_DESIGN.md)。その後は [タスク別ガイド](ISSUE_IMPLEMENTATION_GUIDE.md)と網羅表の依存に沿う。建築・中立NPC等を計画から落とさず、最後に#5/G4と#12の通常通しプレイで全体確認する。

## これまでの重要な合意

- ユーザーは実装コードの技術レビューより、UIを含む意図したふるまいで判断する。画面で確認できる手順を渡す。
- 現在のグリッド/簡易記号は動作確認用。最終3D表現・UXの細部は後続。ただし各機能の操作UIや不可理由は実装時に必要。
- 研究は充填式、未指定はバンク、切替後も研究別進捗保持、必要量で即完了、基本0.2pt/秒＋所有稼働拠点ごと1pt/秒。
- 部隊操作はドラッグ、F01の複数選択/全選択/一括移動・停止を維持する。
- F02は可視敵追跡、不可視では最終確認位置で保留、再発見で再開。拠点進軍と固定地点移動を区別する。
- 旧資料の30分/8・9・18分イベント、再建、徘徊NPCの矛盾は採用済みではない。各Issueで判断し根拠を残す。
