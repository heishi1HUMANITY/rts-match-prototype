# 補給・生産・研究

## 経済と生産

- 資源はCenti整数（100で1ポイント）。生存陣営に基本研究収入を与え、所有稼働拠点から規模・強化・研究に応じた補給/研究収入を加える。部隊ごとの維持費を引き、補給は0未満にしない。赤字時に部隊を自動除去しない。
- 自首都で陸/空部隊、自港で水上部隊を生産する。研究解放、資源、キュー、部隊上限を同時に検証。生産予約時に費用と部隊枠を確保し、IDを予約する。
- 上限は `min(maxUnits, baseUnits + 稼働する自非首都拠点数 × unitsPerOwnedBase)`。現存部隊＋予約数で新規受付を判定。領土を失っても既存部隊を削除せず、現存数が上限以上なら生産進行を止める。
- 陣営ごとの直列キュー。tick開始時にactiveだったjobだけ進み、完成時は首都/港へ出現、次jobをactiveにする。取消は支払済み全額を返す。作戦「緊急増産」は [作戦指令](TACTICS.md)。

## 研究充填

- 選択対象へ既存バンクを直ちに充填し、その後の収入も必要量まで充填する。必要量到達で即完了し、余りはバンク。研究未指定なら全量バンク。
- 指定解除・切替でも研究ID別進捗を保持し、返金・移し替えはしない。同選択の再入力で二重消費しない。完了時は選択解除し、次研究を自動選択しない。
- 研究は戦力/兵站/情報/工兵の4分野。安定ID、段階、必要量、前提ID集合、対称排他ID集合、登録済み効果の集合を定義する。
- 完了済み、前提未達、完了済み研究との排他は拒否。効果はdamage、vision、補給収入、維持費軽減、渡河/兵種/拠点Lv/施設解放、施設工期短縮のみ。自由記述の任意コードを実行しない。
- 経済後に充填完了した効果は、そのtickの既に終わった戦闘へ遡及しない。pauseでは収入も研究も停止。resetでバンク・選択・進捗・完了を初期化。

## 研究定義編集

研究定義編集はマスタ上で研究IDの追加・削除・変更、前提/排他/登録済み効果の接続を提供する。重複・存在しない参照・循環・不正な効果等を検証し、不正な定義を試合へ適用しない。保存済み定義の変更は進行中試合へ反映しない。

数値: `research`、`limits`、`units.*`、`bases.*`、`baseUpgrades`。実装: [economy.ts](../../../src/simulation/economy.ts)、[production.ts](../../../src/simulation/production.ts)、[research.ts](../../../src/simulation/research.ts)、[research-editor.ts](../../../src/ui/research-editor.ts)。検証: [strategy-economy.test.ts](../../../src/simulation/strategy-economy.test.ts)、[research.test.ts](../../../src/simulation/research.test.ts)、[research-effects.test.ts](../../../src/simulation/research-effects.test.ts)、[research-editor.test.ts](../../../src/ui/research-editor.test.ts)。関連: [マスタ管理・診断再現](MASTER.md)。
