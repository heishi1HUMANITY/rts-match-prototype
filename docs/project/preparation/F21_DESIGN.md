# F21 可変研究マスタ

Issue #45 / CP1 / gate:auto。標準ノード・費用・効果・充填方式は維持する。

- `research.definitions`は安定IDをキーとする1〜128ノード。IDは`^[a-z][a-z0-9-]{0,63}$`、ノードは分野・段階・整数費用・複数前提・相互排他・1〜32効果を持つ。削除は参照を自動修復しない。
- 編集画面は追加・削除と全ノードの関係/効果編集を提供する。参照先は現在の一覧から選ぶ。前提循環、非対称排他、欠落した内部/兵種/拠点参照、範囲外値、未登録効果を同じvalidatorで拒否する。JSONはescape表記を含む同一object内の重複キーを解析時に拒否する。
- 対応効果は攻撃・視界・補給・維持・渡河・兵種・拠点上限。渡河と拠点上限は既定研究IDではなく完了した効果から判定する。NPCの優先度は分野・段階・効果から決め、既存の命令周期/上限と進行中研究の継続を維持する。
- 保存master schema12 / state schema17は維持。schema11の可変ノードを保持し、削除済みノードを復活させない。旧schema7〜10の歴史的形式だけ従来の移行を行う。AI選択の変更を区別するrulesVersionはf21-v1。旧ルール診断は暗黙再現せず拒否し、新版診断は内包snapshotで再現する。
- draft編集・保存・JSON読込は進行中stateを変更しない。保存値は新規開始時に適用する。失敗時に元保存bytesを保持する。充填・バンク・切替時の進捗保持は既存契約とする。

検証は[F21_SCENARIOS](../inspection/F21_SCENARIOS.md)と`e2e/research-editor.spec.ts`、validator/store/strict-json/AI/base-upgrades/crossingsのunit tests。実機タッチと最終バランスは別検査。
