# マスタ管理・診断再現

## 採用仕様（2026-10-16・#82実装済み、後続項目は未実装）

- #82でマスタschema23へ移行し、旧schema22の標準 `baseUnits=3` / `maxUnits=9` と研究収入2centi/tickは新標準5/9、12centi/tickへ明示移行する。補給120centi/tickを追加する。妥当な利用者編集値（例: 4/7、研究14）は保持する。不正な組は検証エラーにする。診断MatchState schema26と `cp12-economy-v1` でreplay版を分け、旧diagnosticを暗黙移行しない。

- 現行のdraft・保存値・試合snapshotの境界、厳密検証、明示移行、無断上書きなしを維持する。
- マップごとの定義データと開始地点割当を試合へ固定し、マップID・定義内容/版・seed・割当を保存/再戦/診断で再現する。現在のコード固定配置や現在の保存設定を参照して別の地形へ置き換えない。
- 研究の完了数係数と必要量、定額研究/補給、上限/逆転条件、地形に応じた道筋、NPC難度プリセット、陣営傾向の枠を管理対象へ追加する。正確なキー・型・許容範囲・移行版は実装時に定義し、未実装設定を有効として保存しない。
- 陣営傾向の枠は当初すべて中立。正式比較は開始地点×傾向を軸に、マップ定義・マスタ・seed・NPC方針/道筋・モデル版・出力を再現可能に記録する。実装と異なる簡略モデルは差分を明示する。
- 仕様中の採用不変条件から調整値を算出し、可変数値の正本は実装マスタへ置く。未確定値を旧相談の候補値で埋めない。

採否の根拠は[決定記録](../DECISIONS.md)と[Issue #79](https://github.com/heishi1HUMANITY/rts-match-prototype/issues/79)。この節は採用された変更と未確定の範囲を示す。#82のマスタ移行と診断版更新は実装済み、マップ/道筋/難度/傾向の管理は後続対応。

## 現行実装

### 設定の境界

- 編集draft、localStorage保存値、試合の `MatchState.rules` を区別する。新規試合へ検証済みマスタを複製して固定し、保存操作で進行中試合を書き換えない。
- 編集画面を開くと試合を停止し、閉じても自動再開しない。保存、読込、JSON入出力、標準値へ戻す、研究定義編集を提供する。
- 新規開始/設定リセットは保存値、同じ設定での再戦は直前試合のactive snapshotを使う。既存保存マスタを新標準値で無断上書きしない。古いルール版では標準値への更新案内を行う。
- 保存は同一originのlocalStorage。JSONはenvelope形式、完全なRulesMaster、schemaとrevision等を持つ。未知キー・不正値・不正参照を厳密検証する。
- 対応している旧マスタだけ明示migrationで既存値を保持して新項目を補う。移行できない版や不正データを黙って有効化しない。診断replayの互換性とは別契約。

### 数値の正本

型と標準値は [rules.ts](../../../src/simulation/rules.ts) の `RulesMaster` / `DEFAULT_RULES`、入力定数・配置は [config.ts](../../../src/simulation/config.ts)。許容範囲・参照制約・migrationは [rules-validation.ts](../../../src/simulation/rules-validation.ts)。仕様本文へ数値表を複製せず、各仕様の設定キーから読む。内容IDが同じ試合設定を識別する。

マップ形状・初期配置・tick幅・首都付近回復条件などコード固定のものもある。マスタ画面で任意に変更できると解釈しない。変更が必要な場合は実装を伴う。

### 診断と再現

- 全情報診断JSONは開発用で敵情報も含む。通常UIへ渡す陣営viewとは別経路。
- seed、scenario、マップID/版/全定義snapshot/開始地点割当、順序付き命令履歴、最終tick、完全な適用rules、ルール/schema版、content ID、状態、接敵/終了時刻と終了理由、runtime側tick処理計測、drop時間、ビルド情報を保存する。
- replayは版とrulesの検証、正規化した内容IDの一致を要求し、現在のlocalStorageを見ない。NPC判断も共通advanceで再生成する。旧診断を暗黙移行しない。
- content IDはキー順正規化＋FNV-1a 64-bitで、設定取り違えの検出用。署名ではない。

実装: [master-store.ts](../../../src/runtime/master-store.ts)、[strict-json.ts](../../../src/runtime/strict-json.ts)、[diagnostics.ts](../../../src/runtime/diagnostics.ts)、[controller.ts](../../../src/runtime/controller.ts)、[master-editor.ts](../../../src/ui/master-editor.ts)。検証: [master-store.test.ts](../../../src/runtime/master-store.test.ts)、[rules-validation.test.ts](../../../src/simulation/rules-validation.test.ts)、[controller.test.ts](../../../src/runtime/controller.test.ts)。
