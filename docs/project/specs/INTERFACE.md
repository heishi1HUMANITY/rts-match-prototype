# INTERFACE: 表示・入力境界と未提供機能（UI / F12 / F13 / F14）

## 現行インターフェース

- Three.js盤面とDOM HUD。陣営はA/B/C、色と記号を併記する。PCと横持ち900×420が検査対象。グリッド・簡易部隊記号は試作用で、最終アートやG4完成を意味しない。
- 自部隊起点のドラッグは命令、地面起点はカメラ移動。タップ選択→地面タップを補助操作として残す。ホイール/ピンチでズーム。HUD上/盤外drop、取消、複数指の競合では移動命令を出さない。
- 生産/取消、研究指定/解除、建築、拠点強化、駐留、作戦指令、マスタ編集、開始/一時停止/再開/リセット、結果/再戦を提供する。操作ルールは各機能仕様へ置く。
- タブを隠すと自動停止、復帰後は明示再開。描画復旧待ち等の拒否はruntimeで区別する。時計は1フレーム最大5tick、過大な遅延はdrop時間として診断へ記録する。
- 通常UI/render/対戦AIは `FactionView` を使う。不可視の敵詳細は渡さない。拠点/施設/渡河設備の観測記憶は現在値と区別する。煙幕と視界妨害は [TACTICS](TACTICS.md)、施設妨害は [BASES](BASES.md)。

## 現在提供しない機能

- F12: 首都への補給線接続判定と切断による機能低下はない。所有稼働拠点の収入に補給線条件を加えない。
- F13: 態勢・集結点・自動退避・練度は提供しない。通常の首都近傍回復と駐留は利用できる。
- F14: 行軍先の戦闘予測は未提供。追跡・行軍操作を予測機能と読み替えない。
- 試合外メタ、オンライン通信、世界観、課金は対象外。現地勢力・徘徊NPCの現状は [NPC](NPC.md)。本資料は現在の動作だけを記載する。

実装: [main.ts](../../../src/main.ts)、[input.ts](../../../src/ui/input.ts)、[hud.ts](../../../src/ui/hud.ts)、[board.ts](../../../src/render/board.ts)、[view.ts](../../../src/simulation/view.ts)、[view-model.ts](../../../src/render/view-model.ts)。検証: [input.test.ts](../../../src/ui/input.test.ts)、[view.test.ts](../../../src/simulation/view.test.ts)、[view-model.test.ts](../../../src/render/view-model.test.ts)、[e2e一覧](../../../e2e/README.md)。
