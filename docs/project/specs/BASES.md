# BASES: 拠点・守備・施設（F05 / F10 / F11 / F19）

## 中立守備と制圧

- 中立守備は拠点に紐づくHPプールで、順位に参加する陣営ではない。守備が残る間は拠点本体を守る。守備撃破後に本体HP0とし、非首都の中立拠点を制圧する。
- 半径内の生存部隊から `canCaptureBase` と効率を集計する。同一陣営の効率を加算し、`requiredTicks × 100` 到達で所有を変更する。
- 他陣営が半径内にいる間は進捗を保留。制圧可能部隊がいなくなると進捗を解除、単独候補が変わると新候補の効率から開始する。首都は制圧対象外。
- 制圧時はLv1へ戻し、`capture.restoredHpPercent` で最大HPに対する再稼働HPを設定する（切捨て、最低1）。強化途中のjobは破棄する。
- 守備復活が有効なら、撃破後に制圧可能部隊がいない連続tickが規模別 `respawnTicks` に達すると守備と拠点HPを全回復。無効でも初期守備は存在する。
- 所有拠点の破壊による再中立化時は設定に従い守備を再配置する。陣営脱落時の中立化は別処理で、現行実装は守備を配置する。詳細は [MATCH](MATCH.md)。

## 拠点強化

- 自所有の稼働拠点をLv1→2→3へ強化する。対応研究、補給、同拠点のjobなしを確認し、開始時に支払う。
- 固定tickで完成し最大HP変更時にHP比を維持する。レベルごとのHP/補給・研究収入倍率と砲座性能を適用。所有喪失でLv1へ戻し、途中jobを返金せず破棄する。
- 砲座は範囲内の敵へ決定的に射撃し、航空対象へのdamageを半減・切上げ。拠点自身は被弾後の待ち時間を経て自動回復する。

## 防御施設

- `turret`、`antiAir`、`mine`、`watchtower`、`jammer`。自拠点または完成済み自渡河設備をanchorに、研究・補給・枠・陣営上限を確認して建築する。拠点強化中や渡河工事中は拒否する。
- 配置は公開地形と固定候補順で決まり、不可視の敵占有を受付可否へ使わない。建設中は効果なし。工兵研究で工期を短縮する。
- 砲塔/対空施設は射撃、地雷は一度だけ起動、監視塔は視界拡大、妨害施設は敵視界を縮小し味方部隊を隠しやすくする。重複妨害は倍率を乗算。妨害範囲内の敵監視塔の視界源を無効化する。
- HP0、anchor喪失、所有陣営脱落で施設を除去する。地雷は敵viewへ公開しない。現地勢力部隊は現在施設を攻撃対象としない。

## 設定・参照

数値: `bases`、`defenses`、`capture`、`baseUpgrades`、`facilities`。駐留は [ORDERS](ORDERS.md)。実装: [capture.ts](../../../src/simulation/capture.ts)、[base-upgrades.ts](../../../src/simulation/base-upgrades.ts)、[facilities.ts](../../../src/simulation/facilities.ts)。検証: [capture.test.ts](../../../src/simulation/capture.test.ts)、[neutral-defense.test.ts](../../../src/simulation/neutral-defense.test.ts)、[base-upgrades.test.ts](../../../src/simulation/base-upgrades.test.ts)、[facilities.test.ts](../../../src/simulation/facilities.test.ts)。
