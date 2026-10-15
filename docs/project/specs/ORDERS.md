# 選択・行軍・駐留

## 入力と命令

- 単体選択に加え、複数選択モードでタップによる追加/解除、全選択を提供する。選択済み自部隊からドラッグすると選択集団へ指示する。一括命令は部隊ID順に個別適用し、一部拒否でも他部隊へ適用する。隊形維持はない。
- 地面への移動、可視敵部隊への追跡、拠点への行軍を区別する。移動・停止で既存の追跡対象を解除する。敵を指定しても攻撃対象制約を無視できない。
- 経路は兵種領域と既知の渡河設備を使って探索。途中の移動は1/1024セル座標で扱う。停止は移動中の辺を終えて次セル中心で止める。
- 追跡対象が見える間だけ現在位置を更新する。見失ったら最終確認位置へ進んで保留し、再発見で再開する。不可視の移動や死を新情報として利用しない。観測できた撃破で対象を解除する。

## 駐留

- `garrison` は自軍の生存部隊と自所有の生存拠点を指定。`units.*.canGarrison` と `bases.*.garrisonCapacity` を検証し、移動中の割当も枠に含める。
- 拠点セル到着で駐留。自所有拠点セルを目的地とする通常移動でも条件を満たせば自動駐留する。駐留中は盤面の部隊枠を隠し、拠点情報で確認する。
- 既定では陸上兵種が駐留可能。マスタで他領域も許可できるが、その兵種の経路制約は維持する。
- 駐留部隊は防衛へ参加し、拠点を狙う攻撃に対して守備となる。別の移動指示で出撃し枠を解放。拠点破壊・所有喪失時は生存駐留部隊を解除する。脱落時の除去は [試合進行・決着](MATCH.md)。

## 参照

実装: [commands.ts](../../../src/simulation/commands.ts)、[march.ts](../../../src/simulation/march.ts)、[controller.ts](../../../src/runtime/controller.ts)、[march-target.ts](../../../src/ui/march-target.ts)。検証: [commands.test.ts](../../../src/simulation/commands.test.ts)、[march.test.ts](../../../src/simulation/march.test.ts)、[garrison.test.ts](../../../src/simulation/garrison.test.ts)、[selection.test.ts](../../../src/runtime/selection.test.ts)。関連: [地形・渡河設備](WORLD.md)、[兵種・戦闘・回復](COMBAT.md)、[表示・入力境界と未提供機能](INTERFACE.md)。
