# G1検査待ち中の先行準備

このディレクトリは後続機能の調査・設計を管理する。実コード、採用済みルール、技術検証結果とは区別する。

## 今回準備したもの

- [G2_DESIGN.md](G2_DESIGN.md): 視界/陣営view、経済/生産、交戦/制圧、研究/チケット、tick順序、最小UIの具体案。
- [G2_AGENT_INSTRUCTIONS.md](G2_AGENT_INSTRUCTIONS.md): G1合格後に親が担当へ渡す段階別指示と編集範囲。
- [G2_TEST_MATRIX.md](G2_TEST_MATRIX.md): 固定fixture、境界テスト、ユーザー検査の操作案。未実装・未実行。

## 境界

[G1 PR #8](https://github.com/heishi1HUMANITY/rts-match-prototype/pull/8)のユーザー検査版は変更しない。合否とレビュー待ち状態を維持する。G2 Issue #3はbacklogのままで、内部タスクはチェックしない。

G1の合格・マージ後に、合格commitと観測commitを比較し、設計を更新してからG2を実装する。先行設計の文書PRをマージしても、G1の合格やG2の実装許可が成立したとは扱わない。
