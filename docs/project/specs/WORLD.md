# WORLD: 地形・渡河設備（F03 / F04）

## 盤面と経路

- 40×40セル。陸地、河岸、川、山と地形等級、中央島、港、首都/小/中/大拠点、橋・索道予定地を持つ。seedによる生成と固定配置を組み合わせる。配置・地形形状は現行マスタの編集対象外。
- 陸上は通行可能セルと完成済み渡河設備、航空は地形を無視した直線、水上は川セルで移動する。港は哨戒艇の生産先。到達不能な移動命令は拒否する。
- 川・山の予定地表示だけでは通行権を与えない。橋3級は陸上4兵種、索道2級は斥候だけ通せる。陣営の経路計画は所有/観測済み設備を使い、実移動時にも設備状態を確認する。

## 建設・奪取・解体

- 所有する強襲部隊を予定地の岸へ隣接させ、`build-crossing` で開始する。橋I以外は対応する研究効果の完了が必要。開始時に補給を払い、同じ自工事の再入力は二重課金しない。
- 建設/解体は必要な部隊が隣接している間に進行する。工事中・所有済み・資源不足等は共通検証で拒否する。解体は自所有設備を対象とする。
- 完成設備は攻撃可能。撃破時は同時被害の一意最大陣営へ所有が移り、同率最大は中立化する。設備の変化で経路を再確認し、通れない区間へ進み続けない。
- 設備付属施設の喪失条件は [BASES](BASES.md)。現地勢力は完成経路を兵種制約に従って利用する。

## 設定・参照

数値: `crossings.*` の費用・建設/解体tick・HP・回復・視界。研究解放は `research.definitions.*.effects`。通行兵種集合は [crossings.ts](../../../src/simulation/crossings.ts) の `CROSSING_ALLOWED_UNIT_KINDS`。

実装: [map.ts](../../../src/simulation/map.ts)、[pathfinding.ts](../../../src/simulation/pathfinding.ts)、[config.ts](../../../src/simulation/config.ts)。検証: [map.test.ts](../../../src/simulation/map.test.ts)、[pathfinding.test.ts](../../../src/simulation/pathfinding.test.ts)、[crossings.test.ts](../../../src/simulation/crossings.test.ts)、[crossing-combat.test.ts](../../../src/simulation/crossing-combat.test.ts)。マップの距離・対戦バランス合格はここから推測しない。
