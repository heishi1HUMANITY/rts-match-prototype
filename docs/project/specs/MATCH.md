# 試合進行・決着

## 動作

- 人間Aと対戦NPC B/Cの1v1v1。現地勢力は順位に参加しない。状態はJSON化可能、seedを明示し、100ms固定tickで進む。
- `ready → running ↔ paused → finished`。開始・停止・再開は共通commandで検証する。時間制限は `rules.match.timeLimitTicks`。旧資料の5分・10分を標準値として流用しない。
- runtimeは同一snapshotからB/Cの命令を生成し、共通commandへ順に適用してからsimulationを1tick進める。
- simulation順序は開始時の決着判定 → 追跡/経路再確認 → tick加算 → 現地勢力/施設進行 → 移動/駐留 → 同時戦闘 → 作戦効果整理/首都付近回復 → 制圧/駐留解除 → 拠点強化 → 経済 → 研究充填 → 生産 → チケット → 橋/索道進行 → 決着/施設整理 → 視界更新。順序変更は他機能への効果適用時刻も変える。

## チケットと脱落

- `ticketsCenti <= 0` または自首都HP0で即脱落。首都再建は提供しない。首都のみ破壊して残軍続行する旧契約は無効。`match.hqProtectionTicks` 未満は首都への攻撃ダメージを防ぐ。
- 生存陣営の稼働非首都拠点だけを領土重みへ加算する。現地勢力・中立・首都は除外。定期損失は「他生存陣営の重み合計 − (生存数−1)×自重み」を0〜上限へ制限した拠点差ペナルティと、時間減少の合計。
- 時間減少は開始tick以前0、開始〜終了tickで線形補間、その後は終端値。敵平均重みと自重みの差で領土倍率を補正し、上下限で制限。間隔分を掛けた時間減少を整数へ丸め、チケットを0未満にしない。部隊喪失による損失もある。
- 脱落時はチケット0、部隊・生産キュー・選択中研究・施設を除去し、非首都拠点を中立へ戻して守備を配置する。渡河設備の所有・工事も整理する。経済と研究は停止する。
- 生存1陣営、同時全滅、時間切れで終了。生存者を先にチケット降順、脱落者を脱落tick降順で順位付けする。同チケット・同時脱落は同順位。ID順は表示を安定させるだけで勝者を決めない。
- 人間脱落後は自陣の記憶・公開情報の範囲で観戦。終了後はゲーム命令を拒否し、結果から再戦できる。

## 設定・参照

数値: `match`、`tickets`、`units.*.lossTicketsCenti`。既定値は [rules.ts](../../../src/simulation/rules.ts)。時間・強さ・公平性に関わる数値は調整可能な暫定値。

実装: [step.ts](../../../src/simulation/step.ts)、[tickets.ts](../../../src/simulation/tickets.ts)、[outcome.ts](../../../src/simulation/outcome.ts)。検証: [step.test.ts](../../../src/simulation/step.test.ts)、[tickets.test.ts](../../../src/simulation/tickets.test.ts)、[outcome.test.ts](../../../src/simulation/outcome.test.ts)。関連: [拠点・守備・施設](BASES.md)、[補給・生産・研究](ECONOMY.md)、[作戦指令](TACTICS.md)。
