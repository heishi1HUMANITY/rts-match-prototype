# 開発手順

運用の規範は [WORKFLOW](docs/project/WORKFLOW.md)、エージェントの方針は [AGENTS.md](AGENTS.md)、進捗の正は [Issue #12](https://github.com/heishi1HUMANITY/rts-match-prototype/issues/12)。

- mainから短命ブランチを作り、`npm ci` で依存を入れる。`npm run check` と `npm run references:check` を通す。
- マージ条件はCI成功とユーザーのApprove。PR本文は目的 / Closes / 変更した数値 / 未検証の4項目。
- main pushで dist を GitHub Pages へ配備する。配信対象は dist だけで、原本 docs / artwork を含めない。
- リポジトリの公開範囲を変更しない。秘密をコミットしない。
