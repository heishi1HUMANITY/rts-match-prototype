# F17 / Issue #30 マスタ管理の実装設計

これは実装前の採用案。現在実装済みのAPIではない。Issue #30の最新本文、基点の実装、F02/PR #32のマージ状態を照合し、差があれば理由をDECISIONSへ追記して設計を更新する。ユーザーに技術設計を作り直させない。

## 利用者ができること

「マスタ管理」を開き、兵種・拠点・研究・試合・NPCの値を編集、保存、JSON入出力、標準値へ戻す。変更は次の新規試合/リセットに適用する。試合中のHPや必要研究ポイントを保存操作で変えない。編集値・保存値・現在の試合適用値を区別して表示する。

保存先はブラウザのlocalStorage（同じ端末・同じorigin）。別PC/port/ブラウザやサイトデータ削除後への保持は保証せず、JSON出力を持ち運び手段にする。サーバー、認証、管理権限は追加しない。

## 作業分割と統合順

| 段階 | 実装内容と完了条件                                                                    | 主な範囲                                                                           |
| ---- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| M1   | デフォルト定義、型、項目メタ情報、正規化、厳密検証、版を確定。全既存数値を一覧化      | 新規 `src/simulation/rules.ts`、`rules-validation.ts` 等、既存config/types         |
| M2   | 試合生成時の不変snapshot注入、全ルール/AI/view/表示の参照を移す。既定値で既存挙動一致 | simulation全関連module、runtime/controller、ai/strategy、ui/hud、render/view-model |
| M3   | 保存/読込/import/export/標準値復元、破損復旧、draft/saved/active状態                  | 新規 `src/runtime/master-store.ts` 等                                              |
| M4   | 管理画面、入力検証、dirty表示、保存結果、次試合適用の導線                             | 新規 `src/ui/master-editor.ts` 等、main/hud/styles/input境界                       |
| M5   | 診断にsnapshot・版・内容ID、replay注入、fixtureoverride、回帰/操作検査                | runtime/diagnostics、tests、検査票、build-infoのschema/rules更新                   |

M1の共有型と注入契約を親が先に固定する。M3/M4はその型が安定後に分担できる。M2とM5はルール参照の漏れを親が横断検証する。画面だけ先に完成させて静的定数のままにしない。

## データ契約案

`RulesMaster`はJSON可能なreadonlyデータとして次を持つ。既存のUnitKind/ResearchId/BaseKindは当面維持し、値の編集を対象にする。IDの追加や未実装効果の登録を許可しない。将来F08/F09等で対応範囲を明示拡張する。

| 分類     | 調整対象（内部の単位）                                                                                                          | 既定値の根拠                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| unit     | maxHp/baseDamage/range/vision/costCenti/buildTicks/upkeepCentiPerTick/moveTicksPerCell、陣営全体の部隊上限とキュー上限          | 基点のUNIT_STATS、MOVE_TICKS_PER_CELL、UNIT_LIMIT、PRODUCTION_QUEUE_LIMIT |
| base     | maxHp/vision/supplyIncomeCentiPerTick/researchIncomeCentiPerTick/ticketWeight、captureTicks/captureRadius、拠点差のチケット係数 | BASE_STATS、capture/ticketsの実装                                         |
| research | costCenti/prerequisite/damageBonus、基本研究収入Centi/tick                                                                      | RESEARCH_DEFINITIONS、BASE_RESEARCH_INCOME_CENTI_PER_TICK                 |
| match    | timeLimitTicks、initialSupplyCenti/initialResearchCenti/initialTicketsCenti、unitLossTicketsCenti/hqLossTicketsCenti            | config、match、tickets、outcome                                           |
| npc      | decisionIntervalTicks、現在の防衛判断距離等の方針パラメータ                                                                     | runtime/advance、ai/strategyの直書き値も棚卸し                            |

拠点重み`ticketWeight`は現行の首都0/稼働前哨拠点1を既定値とし、`tickets.ts`の固定加算をマスタ参照へ移す。生存軍・所有・稼働状態の条件は維持する。重みと差分係数・上限は別項目とし、変更時の圧力計算と画面表示が一致することを検証する。

100ms tick、描画のcatch-up、schema、コマンド名、マップ配列形状、内部位置計算法を一般の編集項目にしない。mapサイズ/生成構造や初期配置はF03等の実装と同時に専用検証を追加する。建築・補給・戦術能力など未実装の値を、効果があるかのように公開しない。

`MasterEnvelope`案: `{masterSchemaVersion, revision, rules}`。revisionは表示用で、内容一致の根拠にはしない。項目メタ情報にstable key、日本語名、単位、説明、既定値、min/max/stepを持たせてUIを生成する。表示用文言とゲーム数値を同じオブジェクトへ混在させず、正規化したrulesだけを試合へ渡す。

`MatchState.rules`に検証・clone済みのsnapshotを保持する案を採用する。別のグローバル変数へ現在マスタを置かない。既存signatureへの影響は実装時に整理するが、`createMatch(seed,{scenarioId,rules})`、`applyCommand(state,...)`、`stepMatch(state)`からその試合の値を辿れる構造にする。FactionViewにも公開ルールをdetached copyで渡し、AI/UIはそれを使う。編集中の値を渡さない。

## 既存コードの移行漏れを防ぐ

1. `config.ts`の数値に加え、production/research/economy/combat/capture/visibility/tickets/outcome、NPCの10tick判断や距離、HUDの「上限6」「12秒」「HP100」等の直書きを検索し、調整値を棚卸しする。
2. 生成済み部隊のmaxHp、予約時費用/残ticks、研究進捗、視界、チケット式、AIの生産可否を同じ試合snapshotから計算する。UIは料金だけ変わり実際の課金が変わらない状態を作らない。
3. 移動速度を編集可能にする際、現在のedgeProgressは0/1、render/visibility/combatは半セル前提であることに注意する。部隊ごとのmoveTicksPerCellと整数進捗へ一般化し、位置計算を共通helperへ集約する。3tick/セル等でも補間・視界境界・射程・途中停止・経路変更が一致するテストを追加する。速度の項目だけ用意して固定2tickのままにしない。
4. F02がマージ済みならmarchの射程/視界/半セル保持も同時に移行する。未マージならF02の統合点を記録し、未合格PRを無断マージしない。
5. default snapshotは現在の合格版に一致させる。バランスの再調整はこのIssueに混ぜない。

## 検証と原子的適用

JSON入力はunknownとして扱い、UI/保存/診断から共通validatorへ通す。`as RulesMaster`だけで受理しない。未知版、余分なキー、欠落、重複ID、未対応ID/効果、NaN/Infinity、負数、範囲外、非整数Centi/tick、存在しない前提、自己参照/循環を拒否する。エラーは項目keyと理由で返す。

時間は秒表示を許可するが、100ms tickへ正確に変換できる値だけ受理する。安全な上限を項目ごとに設定し、tick×収入×試合長や距離計算が安全整数の範囲に収まることを横断検証する。上限部隊数は初期部隊数以上、キュー上限は正、研究費用・HP・移動時間は正などの不変条件を確認する。0を許す項目（初期研究、収入、効果等）を個別に定義する。

入力中の空欄や途中の文字列はdraftに保持し、保存/適用時に全件検証する。一部項目だけ反映しない。不正importではdraft/saved/activeの正常値を保持する。検証済みの完全データをlocalStorageへ1回の書込で保存し、失敗時は成功表示せずsavedも更新しない。起動時の破損/未知版は標準値で安全に起動し、復旧理由と元データの書き出し手段を示す。

設定移行はmasterSchemaVersion別の明示migrationで行い、移行後に再検証する。初版で未知の将来版を推測移行しない。

## 編集・保存・試合適用

- draft: 編集中。dirtyと項目別エラー、保存可否を表示。
- saved: 保存成功した次回用設定。JSON読込だけで保存・試合適用しない。
- active: 試合開始時にcloneしたsnapshotと内容ID。保存しても変えない。

管理画面を開く際は進行を明示的に停止する。閉じるだけで勝手に再開しない。DOM操作が盤面のタップ/ドラッグ命令にならないよう既存CanvasInputのHUD境界を利用し、管理画面へ移る前にpreviewを取消す。

「保存」は次回用。「保存値で新しく開始」は検証/保存成功後に試合をリセットして適用する、明確な別操作にする。通常のreset/再戦で保存値を適用する仕様と、結果画面の「同じ設定でもう一戦」の意味を区別する。**同じ設定でもう一戦はactive snapshotを再利用**し、「最新保存値で開始」を別に用意する。seed適用/新規試合はsavedから生成する。編集途中のdraftは試合へ入れない。

## 診断と再現

master schema、rulesVersion、内容識別子、実際に適用した完全snapshotを診断へ保存する。内容識別子はキー順を安定化したcanonical rulesのSHA-256等で作り、表示revisionだけを使わない。非同期hashは保存/起動の境界で計算し、simulation tickへasync処理を持ち込まない。hashだけでsnapshotを省略しない。

replayは診断に含まれるsnapshotを検証して注入し、現在のlocalStorageや編集値を参照しない。内容ID不一致・版不一致を拒否し、許可した明示migration以外で旧診断を黙って読むことはしない。状態schema/rulesVersion/build-infoを一緒に更新する。

検査fixtureの短時間/初期資源などは明示overrideとして扱う。savedが書き換わったように見せない。診断には実際の有効値を残す。標準とfixtureの区別をHUDで維持する。

## 完了を示す検証

- default masterで既存テスト、通常対戦、充填研究、集団移動、導入済み追跡の挙動を維持する。
- 価格、HP、収入、研究費用、試合時間、移動時間、NPC判断間隔の各代表値を変えると、UIと実際の課金/生成/進捗/移動が一致する。
- 試合A中に保存値Bへ変更してもAの状態・AI・表示は変わらない。同じ設定で再戦はA、新規開始はB。
- 保存例外、壊れたJSON、循環前提、未対応ID、境界値、未知版で正常値を壊さず理由が分かる。
- B保存後でもAの診断を再現でき、同seed/履歴/active snapshotで一致する。返されたviewやdraftの書換えでactiveが変わらない。
- ブラウザ再読込で保存値が残り、JSON書出し→標準へ戻す→import→保存→新規開始で同じ設定を復元できる。
- PC/900×420で編集画面が操作でき、終了/リセット/管理画面開閉で盤面に誤命令が出ない。

検査票を `docs/project/inspection/F17_SCENARIOS.md` として実装結果に合わせて作り、対象SHA・CI・実検査範囲をIssue #30へ記録する。
