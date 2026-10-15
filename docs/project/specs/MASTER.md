# マスタ管理・診断再現

## 設定の境界

- 編集draft、localStorage保存値、試合の `MatchState.rules` を区別する。新規試合へ検証済みマスタを複製して固定し、保存操作で進行中試合を書き換えない。
- 編集画面を開くと試合を停止し、閉じても自動再開しない。保存、読込、JSON入出力、標準値へ戻す、研究定義編集を提供する。
- 新規開始/設定リセットは保存値、同じ設定での再戦は直前試合のactive snapshotを使う。既存保存マスタを新標準値で無断上書きしない。古いルール版では標準値への更新案内を行う。
- 保存は同一originのlocalStorage。JSONはenvelope形式、完全なRulesMaster、schemaとrevision等を持つ。未知キー・不正値・不正参照を厳密検証する。
- 対応している旧マスタだけ明示migrationで既存値を保持して新項目を補う。移行できない版や不正データを黙って有効化しない。診断replayの互換性とは別契約。

## 数値の正本

型と標準値は [rules.ts](../../../src/simulation/rules.ts) の `RulesMaster` / `DEFAULT_RULES`、入力定数・配置は [config.ts](../../../src/simulation/config.ts)。許容範囲・参照制約・migrationは [rules-validation.ts](../../../src/simulation/rules-validation.ts)。仕様本文へ数値表を複製せず、各仕様の設定キーから読む。内容IDが同じ試合設定を識別する。

マップ形状・初期配置・tick幅・首都付近回復条件などコード固定のものもある。マスタ画面で任意に変更できると解釈しない。変更が必要な場合は実装を伴う。

## 診断と再現

- 全情報診断JSONは開発用で敵情報も含む。通常UIへ渡す陣営viewとは別経路。
- seed、scenario、順序付き命令履歴、最終tick、完全な適用rules、ルール/schema版、content ID、状態、drop時間、ビルド情報を保存する。
- replayは版とrulesの検証、正規化した内容IDの一致を要求し、現在のlocalStorageを見ない。NPC判断も共通advanceで再生成する。旧診断を暗黙移行しない。
- content IDはキー順正規化＋FNV-1a 64-bitで、設定取り違えの検出用。署名ではない。

実装: [master-store.ts](../../../src/runtime/master-store.ts)、[strict-json.ts](../../../src/runtime/strict-json.ts)、[diagnostics.ts](../../../src/runtime/diagnostics.ts)、[master-editor.ts](../../../src/ui/master-editor.ts)。検証: [master-store.test.ts](../../../src/runtime/master-store.test.ts)、[rules-validation.test.ts](../../../src/simulation/rules-validation.test.ts)、[controller.test.ts](../../../src/runtime/controller.test.ts)。
