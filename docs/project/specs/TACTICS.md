# TACTICS: 作戦指令（F15）

## 共通条件

`activate-ability` をA/B/C共通で使う。生存、補給、指令別クールダウン、対象形式を検証。失敗時は資源・状態を変更しない。成功時に費用を払い、当tickから再使用可能tickと効果期限を設定する。数値は `rules.tacticalAbilities`。文明別指令・定型合図は追加しない。

| ID        | 表示名   | 対象・現行効果                                                                                                                                                                                   |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| artillery | 砲撃支援 | 発動時に可視の盤内セル。durationTicks後に範囲攻撃。自軍と航空部隊を除外し、敵陸/水部隊、所有拠点、所有渡河設備、施設へ被害。中立拠点・中立守備・現地勢力本拠は砲撃対象に含めない。首都保護も守る |
| surge     | 緊急増産 | 対象なし。自軍の生産進行をproductionTimePercentで加速。端数は蓄積し、部隊上限と支払いを迂回しない                                                                                                |
| smoke     | 煙幕     | 可視セル。発動時に範囲内の自部隊へ期限を付ける。攻撃phaseがidleの間は敵視界へ表示しない。建物の視界は増やさない                                                                                  |
| bulwark   | 鉄壁     | 対象なし。自陣営の拠点・渡河設備・施設の被害をdamageTakenPercentで軽減。部隊への被害は軽減しない。正の被害は最低1                                                                                |
| survey    | 広域観測 | 可視セル。一定期間、指定半径の視界源を追加。この視界源は妨害倍率による縮小から分けて扱う                                                                                                         |
| jam       | 電波妨害 | 自軍以外の生存A/B/Cを指定。相手の通常視界源をvisionPercentへ縮小。重複時は効果期限の最大値を採用                                                                                                 |

セル対象は不可視セルへ発動できない。予約砲撃は命中時に所有陣営が脱落済みなら発生しない。効果とクールダウンは固定tick状態へ保存され、pauseで進まない。NPCも自陣viewから発動を選ぶ。

実装: [tactical-abilities.ts](../../../src/simulation/tactical-abilities.ts)、[combat.ts](../../../src/simulation/combat.ts)、[visibility.ts](../../../src/simulation/visibility.ts)、[production.ts](../../../src/simulation/production.ts)。検証: [tactical-abilities.test.ts](../../../src/simulation/tactical-abilities.test.ts)、[e2e](../../../e2e/tactical-abilities.spec.ts)。関連: [COMBAT](COMBAT.md)、[ECONOMY](ECONOMY.md)、[NPC](NPC.md)。
