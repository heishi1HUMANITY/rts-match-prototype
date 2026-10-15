# 現行機能仕様の入口

このディレクトリは現行コードの振る舞いを記述する。初回整理の基準は main の `a6a9f16`（PR #75まで、F13取消のPR #74を含む）。以後は変更PRで仕様と対応表を同時更新する。マージ・プレイ合格の進捗表は置かない。進捗は [全体Issue #12](https://github.com/heishi1HUMANITY/rts-match-prototype/issues/12) のみ。

AIは次の順で必要な部分だけ読む。

1. [WORKFLOW](../WORKFLOW.md) と対象Issueの最新本文・コメントを読む。
2. 下の機能IDから担当仕様を選ぶ。相互作用を変える場合だけ関連仕様も読む。
3. [registry.json](registry.json) の `sources` から実装へ進む。テストは各仕様末尾を参照する。
4. 数値は [DEFAULT_RULES](../../../src/simulation/rules.ts) とその入力元 [config.ts](../../../src/simulation/config.ts) を読む。試合中は `MatchState.rules` が適用値で、保存済みマスタや標準値とは異なる場合がある。

## 機能ID → 仕様

| ID                    | 仕様                      | 主な内容                                           |
| --------------------- | ------------------------- | -------------------------------------------------- |
| CORE / F16            | [MATCH](MATCH.md)         | 固定tick、試合進行、チケット、首都保護、脱落・順位 |
| F01 / F02 / F18       | [ORDERS](ORDERS.md)       | 複数選択、移動・追跡、停止、駐留                   |
| F03 / F04             | [WORLD](WORLD.md)         | 地形、港、橋・索道、経路                           |
| F08                   | [COMBAT](COMBAT.md)       | 6兵種、攻撃対象、同時戦闘、回復                    |
| F05 / F10 / F11 / F19 | [BASES](BASES.md)         | 守備、制圧、拠点強化、施設                         |
| F09 / F21             | [ECONOMY](ECONOMY.md)     | 補給、生産、研究充填、研究定義                     |
| F06 / F07 / F20       | [NPC](NPC.md)             | B/C、中立守備、現地勢力、徘徊NPCの区別             |
| F15                   | [TACTICS](TACTICS.md)     | 共通の作戦指令6種類                                |
| F17                   | [MASTER](MASTER.md)       | 編集・保存・移行、試合snapshot、診断再現           |
| UI / F12 / F13 / F14  | [INTERFACE](INTERFACE.md) | 入力・表示境界、現在提供しない機能                 |

## 資料の役割

- ここは「現在どう動くか」。`preparation`、G1〜G3設計は設計時点の案・契約であり、後続変更を自動反映しない。
- [DECISIONS](../DECISIONS.md) は採用理由・承認履歴。最新Issueで決定済みでも未実装なら、現行仕様へ混ぜない。
- [GAMEPLAY_COVERAGE](../GAMEPLAY_COVERAGE.md) は機能とIssueの計画索引。`inspection` は検査手順であり仕様の正本ではない。
- コードと本書が違う場合は現状をコード・テストで確認し、差異を明示する。文書に合わせて無断でルールを変更しない。

## 変更時の更新

手順の規範は [WORKFLOW](../WORKFLOW.md)。以下は検査形式の説明。

`registry.json` は安定した仕様ID、機能ID、文書パス、実装パス、確認済み実装のSHA-256を持つ。行番号・見出しの自動生成アンカーに依存せず、仕様IDとファイルへの相対リンクで参照する。ファイルは原則改名しない。統合・分割時は旧パスに案内を残し、対応表と全参照を更新する。

```sh
npm run specs:check
# 表示された担当仕様と関連仕様を確認・修正した後、確認したIDだけ指定
npm run specs:review -- MATCH ECONOMY
npm run specs:check
```

コード変更に対して文言変更が不要な場合も、影響がないことを確認してから `specs:review` を実行する。ハッシュ更新は仕様の自動生成・正しさの証明ではなく、レビューした対象の記録。本文の意味の更新漏れまでは自動判定できない。

`npm run check` とCIで、仕様内の相対リンク、明示アンカー、対応表の参照先、実装ハッシュ、未登録の本番srcファイル、F01〜F21の割当を検査する。外部URLの死活と旧資料全体のリンクは検査範囲外。改行はLF/CRLFを正規化して比較する。
