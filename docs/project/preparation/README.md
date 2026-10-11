# G2の設計・実装契約

G1検査待ち中に準備した設計を置く。2026-10-11にG1合格・マージと次実装のユーザー指示を受け、G2の実装契約として採用した。文書の期待値と実際の検証結果は区別する。

## 今回準備したもの

- [G2_DESIGN.md](G2_DESIGN.md): 視界/陣営view、経済/生産、交戦/制圧、研究/チケット、tick順序、最小UIの具体案。
- [G2_AGENT_INSTRUCTIONS.md](G2_AGENT_INSTRUCTIONS.md): G1合格後に親が担当へ渡す段階別指示と編集範囲。
- [G2_TEST_MATRIX.md](G2_TEST_MATRIX.md): 固定fixture、境界テスト、ユーザー検査の期待結果。実測記録ではない。

## 境界

[G1 PR #8](https://github.com/heishi1HUMANITY/rts-match-prototype/pull/8)は合格・マージ済み。G2 Issue #3の進捗を正とし、G2の合格前にG3実装・G2マージは行わない。

合格commitと先行設計の観測commitにsimulation差分なしを確認。G1-r02の部隊ドラッグ操作を維持する。検査操作と未確認範囲は [G2_SCENARIOS.md](../inspection/G2_SCENARIOS.md)、技術記録は [G2_TECHNICAL_CHECK.md](../inspection/G2_TECHNICAL_CHECK.md) を参照。
