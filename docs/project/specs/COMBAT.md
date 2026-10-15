# 兵種・戦闘・回復

## 兵種

| ID         | 表示名   | 既定移動領域 | 主な特徴                             |
| ---------- | -------- | ------------ | ------------------------------------ |
| assault    | 強襲     | land         | 初期解放、制圧・渡河工事             |
| scout      | 斥候     | land         | 初期解放、索道通行、高視界           |
| artillery  | 自走砲   | land         | 研究解放、長射程、移動中攻撃不可     |
| antiAir    | 対空車両 | land         | 研究解放、航空対象優先               |
| helicopter | 攻撃ヘリ | air          | 研究解放、地形を無視、既定で制圧不可 |
| patrolBoat | 哨戒艇   | water        | 研究解放、港生産、既定で制圧不可     |

これは既定プロフィール。性能・領域・制圧・駐留・攻撃対象は試合へ適用された `rules.units` を読む。

## 戦闘

- HP、射程、視界、移動速度、領域別ダメージ、構造物ダメージ、損失チケットを兵種ごとに持つ。Entity集合 `attackTargets` と対象領域のdamageが両方許可する場合に攻撃できる。
- 部隊、守備、拠点、渡河設備、現地勢力本拠、施設を区別する。射程/視界/所有/対象制約で選び、距離・IDによる決定的な選択を行う。
- 共通攻撃プロフィールは `windupTicks`、`intervalTicks`、`canAttackWhileMoving`。構え・発射・待ちを固定tickで進め、同じsnapshotから被害を予約して同時解決する。配列順による先制撃破を与えない。
- 中立守備・駐留守備・首都保護・施設・作戦指令はそれぞれの対象条件を通す。対戦NPCも共通ルールを使う。
- 部隊が失われると兵種別チケット損失を反映する。補給0だけで部隊を自動消滅させない。

## 回復

生存する自首都からマンハッタン距離3以内、経路なし、当tickに被弾なしの部隊を10tickごとに最大HPの4%切上げ（最低1）、最大HPまで回復する。全領域共通。この距離・頻度・率は現在 `step.ts` 内の固定値で、マスタ編集対象ではない。自動退避命令や練度上昇は提供しない。

実装: [combat.ts](../../../src/simulation/combat.ts)、[unit-capabilities.ts](../../../src/simulation/unit-capabilities.ts)、[step.ts](../../../src/simulation/step.ts)。検証: [combat.test.ts](../../../src/simulation/combat.test.ts)、[unit-domains.test.ts](../../../src/simulation/unit-domains.test.ts)。関連: [拠点・守備・施設](BASES.md)、[作戦指令](TACTICS.md)。
