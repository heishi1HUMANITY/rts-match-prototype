# G1 実装設計

2026-10-11。対象: [Issue #2](https://github.com/heishi1HUMANITY/rts-match-prototype/issues/2)、T101〜T105。実装前の設計であり、技術検証・ユーザー合格を表さない。
基点: `f10cc61190caa157d1e3295605045b14ac7ea04e`。作業場所は `D:/git/rts-match-prototype`。`D:/git/rts` は旧資料の置き場。

## 1. 利用者に渡す結果と範囲

seed入力→開始→自軍部隊を選択→地面を指定→障害物を避けて移動→停止／再開→同じseedでリセット、を操作できる。
マウスとタッチでパン／ズームでき、敵・障害物・到達不能地点への指示は理由付きで拒否する。

- Aは人間、B/Cは将来のNPC陣営。G1ではB/Cの部隊は静止し「NPC判断未実装」と表示する。
- 最小移動部隊だけを置く。戦闘、HP、拠点制圧、資源、生産、研究、チケット、霧、勝敗はG2以降。
- 全陣営が見えるのはG1の検査仕様。G2の可視情報契約へ置換する前提で、renderへ状態を渡す場所をmainの一箇所にまとめる。
- 旧コードを移植せず、原本mockとartworkは変更しない。幾何形状を描画し、素材の追加採用は不要。
- 保存データの読込み、操作履歴の読込みUI、オンライン機能、物理エンジンは追加しない。

## 2. T101で採用する暫定ルール

実装開始時に以下をDECISIONSへD015以降として転記し、SCOPEの盤面と停止の未決定項目を本書へリンクする。G2以降の最終バランス値とは区別する。

| 項目     | G1での決定                                        | 根拠・旧仕様の扱い                                                     |
| -------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| 盤面     | 40×40セル、1セル=描画1単位、simulationではx/y整数 | 旧40×40は採用。3200世界座標は不採用、変換を簡単にする                  |
| 通行     | 平地／障害物の2種、4方向、セル中心を結ぶ          | 河川・山・橋・索道は不採用。経路と入力検査を優先                       |
| 進行     | 100ms/tick、1倍速だけ                             | 旧tick幅は採用、30分やフェーズは未採用                                 |
| 移動     | 隣接セルへ2tick=200ms、5セル/秒                   | G1専用の暫定速度。整数状態で再現可能                                   |
| 衝突     | 部隊同士の重なり可、部隊は地形を変更しない        | 回避・押し出し・占有予約を持ち込まない                                 |
| 開始     | ready→running。readyでは移動不可                  | 開始前に盤面と操作説明を確認できる                                     |
| 停止     | running→paused、再開でrunning                     | 停止中は選択・カメラのみ可、移動／部隊停止命令は拒否                   |
| 非表示   | runningならpausedへ遷移し、自動では再開しない     | 復帰時は「非表示のため停止、再開してください」。壁時計分を追い付かない |
| リセット | 現在のseedでreadyから再作成                       | 部隊・選択・経路・時計・履歴・カメラ・ジェスチャーを初期化             |
| schema   | 2へ上げる。v1の読込みは提供しない                 | 状態にmap/units/phaseを追加。既存保存機能はない                        |

seedは既存のuint32契約を保つ。入力は10進整数文字列のみ、空文字・負数・小数・NaN・Infinity・範囲超過を拒否し、暗黙の丸めをしない。既定42。新しいseedは「適用してリセット」でreadyへ反映する。

## 3. 地形生成と初期配置（T102）

配列index=`y*40+x`。原点は左上。x右向き、y下向き。描画は `(x+0.5, height, y+0.5)`、地面height=0。

| 陣営 | 部隊IDと開始セル           |
| ---- | -------------------------- |
| A    | A-01=(6,33)、A-02=(7,33)   |
| B    | B-01=(33,33)、B-02=(32,33) |
| C    | C-01=(20,6)、C-02=(21,6)   |

配置は全seedで固定。公平性の最終調整はG3で扱う。部隊ID・配列順序はA/B/C、01/02で固定する。

生成手順:

1. 全セルを平地にする。検査用の孤立セル(30,10)を、周囲8セル（x=29..31、y=9..11、中央以外）の障害物で囲う。この3×3は固定。
2. ランダム配置の対象外を予約する: 外周、各開始セルのChebyshev距離2以内、x=20の縦通路、y=20の横通路、固定3×3とその1セル外側（x=28..32、y=8..12）。
3. uint32 LCG `s=(Math.imul(1664525,s)+1013904223)>>>0` をseedで初期化。0も通常seed。行優先で未予約セルごとに1回進め、`s%100<10` のとき障害物候補とする。
4. 候補を置いた状態で(20,20)から4方向flood fill。孤立セル(30,10)以外の全平地と開始セルへ到達できなければ、その候補を取り消す。検査用孤立セル以外の意図しない分断を作らない。
5. map・部隊・path・factions配列は試合間で共有しない。固定定数から可変配列を直接流用しない。

孤立セル・周囲障害物を検査用として地図上に明示する。G1専用fixtureであり、通常対戦の地形として確定したものではない。

## 4. 状態・API契約（T101/T103）

以下は公開契約。readonlyを保ち、各関数は入力stateを変更しない。内部ヘルパーとファイル配置の微調整は可能。

```ts
type FactionId = 'A' | 'B' | 'C';
type Phase = 'ready' | 'running' | 'paused';
interface Cell { readonly x: number; readonly y: number }
interface GridMap {
  readonly width: number;
  readonly height: number;
  readonly blocked: readonly boolean[];
}
interface UnitState {
  readonly id: string;
  readonly factionId: FactionId;
  readonly cell: Cell;
  readonly path: readonly Cell[]; // 現在cellを含まず、次に到達するセルから
  readonly edgeProgress: 0 | 1; // 隣接セルへ向かう2tickのうち何tick完了したか
}
interface MatchState {
  readonly schemaVersion: 2;
  readonly seed: number;
  readonly elapsedTicks: number;
  readonly factions: readonly Faction[]; // 既存のFaction契約を保持
  readonly phase: Phase;
  readonly map: GridMap;
  readonly units: readonly UnitState[];
}
type Command =
  | { readonly type: 'start' | 'pause' | 'resume' }
  | { readonly type: 'move'; readonly unitId: string; readonly target: Cell }
  | { readonly type: 'stop'; readonly unitId: string };
type RejectCode =
  | 'INVALID_COMMAND' | 'INVALID_ACTOR' | 'INVALID_PHASE'
  | 'UNIT_NOT_FOUND' | 'NOT_OWNER' | 'OUT_OF_BOUNDS'
  | 'BLOCKED' | 'UNREACHABLE';
type CommandResult =
  | { readonly ok: true; readonly state: MatchState }
  | { readonly ok: false; readonly state: MatchState; readonly reason: RejectCode };

createMatch(seed: number): MatchState;
applyCommand(state: MatchState, actor: FactionId, input: unknown): CommandResult;
stepMatch(state: MatchState): MatchState;
findPath(map: GridMap, from: Cell, to: Cell): readonly Cell[] | null;
```

- `Faction`はid/controllerの既存exportを維持。移設時はmatch.tsから再exportし、利用側のimportを壊さない。
- Commandは型付き生成、入口はunknownから実行時検証。null、未知type、欠損field、非整数座標、文字列座標も拒否。有限整数の盤外座標はOUT_OF_BOUNDS。
- 検証順序: command構造→actorがA/B/Cか→phase→unit存在→所有→境界→障害物→到達可否。拒否は元stateをそのまま返し、既存経路を消さない。
- start=readyのみ、pause=runningのみ、resume=pausedのみ。ライフサイクル命令は人間Aだけ許可し、B/CはINVALID_ACTOR。move/stopはrunningのみ、同じ所有検証でA/B/Cが使用可能。UIのactorは常にAで、DOM属性や選択部隊から変更しない。
- BFSの近傍順序を上(0,-1)、右(1,0)、下(0,1)、左(-1,0)へ固定。返す経路はfromを含まずtoを含む。from=toは空配列、到達不能はnull。盤外／障害物のfrom/toもnull。
- stepMatchはrunningのときだけelapsedTicks+1。全unitを固定配列順で更新。pathがあればprogressを1進め、2到達時にcell=path先頭、先頭除去、progress=0。pathなしならprogress=0。
- 新しいmoveは既存経路を置換する。progress=0ならcellから探索。progress=1なら進行中の辺を完了させるため旧path[0]を保持し、そのセルから新targetへ探索して連結する。失敗なら旧経路を維持。逆走やセル中央への瞬間移動を作らない。
- stopもprogress=1なら旧path[0]だけ残してその中心で止める。progress=0ならpath=[]。同じ目的地／停止済みへの指示は成功するno-op。
- 選択、hover、camera、フレーム時刻、DOM、メッシュ、履歴はMatchStateに入れない。

## 5. 実行ループと履歴

`src/runtime`がstateを一つだけ所有する。ルールはsimulation、requestAnimationFrame/performance/visibilitychangeはruntime。

1. 1つのrequestAnimationFrameループを維持。前フレームtimestampとaccumulatorはruntimeだけに置く。
2. running時にdeltaをaccumulatorへ足す。100msごとにstepMatch、1フレーム最大5tick。delta上限500msとし、上限を超えた時間は捨てる。catch-upの回数制限後も100ms以上余れば捨て、警告カウンタを診断へ残す。
3. ready/paused/非表示中は進めない。pause/resume/visibilitychange/reset時にaccumulator=0、前timestamp未設定へ戻す。復帰後最初のフレームはdelta=0。
4. commandはブラウザイベントの到着順に同期的に適用する。tick途中の割込みはJS単一スレッド上で生じない。stateを適用したらUI通知、次の描画で反映。
5. 履歴に `{seq, tickBefore, actor, command, ok, reason?}` を全試行分記録。pause/resumeも同じtick内のseqで順序を保つ。command構造が壊れている場合はcommand=nullへ正規化し、安全な短いsummaryを別に記録する。構造検証は最優先なので、再適用したnullもINVALID_COMMANDとなりstate不変を再現できる。元の壊れた値そのものの復元は対象外。
6. 再現入力は `{seed, history, finalTick}`。初期seedから履歴順にtickBeforeまでstepし、commandを適用して結果を比較する。全命令の適用後にfinalTickまで進めて最終stateを比較する。paused/readyのままtickを進める必要がある不整合な履歴はエラーとし、無限ループしない。壁時計・非表示時間・カメラは再現対象外。非表示によるpauseは通常のpause命令として履歴へ残す。
7. 診断出力はJSONとしてダウンロード可能にする（Clipboard APIへの依存は不要）。build commit、schemaVersion、ルール定数、seed、phase、finalTick（出力時のelapsedTicks）、履歴、最新state、捨てた時間のカウンタを含める。読込み／永続保存UIは不要。

リセットは同じcontrollerのstateをcreateMatchで置換し、履歴と入力／選択／描画補間を初期化する。requestAnimationFrameを追加で作らない。アプリdisposeではRAF、DOMイベント、ResizeObserver、メッシュ／geometry／material／rendererを解放する。

## 6. 描画・カメラ（T104）

- npmからthreeと対応する@types/threeを導入しlockfileを更新。導入時に公式配布元で互換性・型同梱の有無を確認し、具体的versionを固定する。CDNや旧node_modulesのコピーは使わない。
- OrthographicCamera、地面XZ、上Y、target=(20,0,20)、初期offset=(0,32,28)。回転は固定。遠近の縮みを抑え、セル指定を見やすくする。
- カメラzoom初期1、範囲0.7〜2.5。全盤面が初期viewportの縦横に収まるorthographic frustumを算出する。パンtargetを盤面[0,40]へclampし、盤面を完全に見失わせない。
- 平地、薄いgrid、障害物box、6部隊を簡易meshで描く。A橙◆、B水色■、C黄⬡をmesh／DOMラベルにも併記。選択リング、経路線、目的地リング、検査用孤立地点ラベルを用意する。
- 描画位置はcellからpath[0]へのedgeProgress/2。tick間補間は直前／現tickの描画位置間だけで行い、未来の地形をショートカットしない。命令・reset・pause直後は補間元を同期して跳ね戻りを防ぐ。
- `pick(clientX, clientY)`はcanvasのgetBoundingClientRect基準のNDCを使い、部隊hit→地面hitの順で返す。地面world座標をfloorしてcellへ変換し、盤外をclampして有効化しない。
- renderはstateを読んでmeshを同期するだけ。経路決定、所有検証、state書換えは禁止。
- resizeは実canvas領域を測り、renderer/camera frustumを更新。pixelRatio上限2、影・後処理なし。毎フレームgeometry/materialを作り直さない。
- WebGL初期化失敗はDOMで理由と再読込を案内。context loss時は進行をpauseし入力ジェスチャーを破棄。復元時は最新stateから描画資源を再同期し、明示再開待ちにする。
- 最初の対象はChrome/Edgeデスクトップと900×420のタッチエミュレーション。暫定性能目安はPCで60fps、900×420で30fps以上。端末／viewport／測定時間を記録し、実機未検証なら明記する。

描画アダプター契約:

```ts
interface BoardView {
  sync(previous: MatchState, current: MatchState, alpha: number): void;
  setSelection(unitId: string | null): void;
  pick(
    clientX: number,
    clientY: number,
  ): { kind: 'unit'; unitId: string } | { kind: 'ground'; cell: Cell } | null;
  pan(from: { x: number; y: number }, to: { x: number; y: number }): void;
  zoomBy(factor: number): void;
  resetCamera(): void;
  resize(): void;
  dispose(): void;
}
```

panはスクリーン上の2点を地面平面へ射影して差分移動する。raycast型やThree.jsオブジェクトをuiへ公開しない。context lossのコールバックは作成時にruntimeから注入する。

## 7. 入力・DOM HUD（T105）

Pointer Eventsでマウス／タッチを共通化。盤面の選択・移動・カメラ操作用pointer/wheelリスナーとtouch-action:noneはcanvasに限定する。
HUDはcanvasの兄弟DOMとし、HUDで押下開始したpointerの座標や命令を盤面処理へ渡さない。ただしHUDのpointerdownから入力状態機械のcancelGesture()へ取消通知だけを送る。これにより盤面の1指tap候補が残った状態でHUDへ2本目を置いてもmoveにならない。取消後は残りの指が離れるまでtap候補を再開しない。window全域のクリックで移動させない。

| 物理入力                | 意味と優先順位                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 主ボタン／1指の短い押下 | pointerup時に判定。自軍部隊なら選択切替。敵なら選択解除＋「他陣営は操作不可」。選択中の地面ならmove。未選択なら案内だけ |
| 1指／主ボタンのドラッグ | 押下開始から6 CSS px超でpanへ固定。選択部隊上でもパン。離したとき命令を出さない                                         |
| 2指                     | 最初の1指tap候補を取消。中点移動でpan、指間距離比でzoom。1指に戻っても全指が離れるまでtapへ戻さない                     |
| wheel                   | canvas上だけズーム。deltaModeを正規化しzoom範囲へclamp。盤面上だけpreventDefault                                        |
| Escape／選択解除ボタン  | 選択解除。DOMのinputにフォーカス中はEscape以外のゲームshortcutを作らない                                                |
| 「部隊停止」            | 選択中のA部隊にstop。アプリの一時停止とは別の表示にする                                                                 |
| 一時停止／再開          | lifecycle command。停止してもカメラと選択は操作可                                                                       |
| リセット／seed適用      | 新しいready状態、選択・ジェスチャー・カメラ・履歴をリセット                                                             |

pointer captureを使用。pointercancel、lostpointercapture、blur、非表示、resetで進行中ジェスチャーを破棄する。canvas外で離したtap候補は命令へしない。6pxちょうどはtap扱い、6px超はpan。二本指の一方をHUDから追加した場合も盤面tap候補を取消し、HUD操作から移動を出さない。

reject codeは日本語の短い理由へ固定マッピングし、aria-live領域に表示する。障害物・到達不能への失敗時は選択と旧経路を維持する。敵のtapは自軍の旧選択を解除し、敵の背後へ移動する命令として扱わない。

HUD配置:

- 上部56px: G1移動検査、陣営凡例、経過時間、進行状態、開始／一時停止／再開／リセット。
- 中央: 独立したcanvas領域。上・下のHUDの下へ広げない。900×420でも高さを確保する。
- 下部80px以内: 左に選択情報と短い操作案内、右にA-01/A-02部隊ボタン、部隊停止／選択解除。ボタンのhit領域は44px以上。
- seedと診断は上部の「検査設定」から開く折畳みパネル。展開中も盤面への入力伝播を遮断する。
- 白・明灰の面、細い罫線、黒い主ボタンをS05から採用。チケット・資源・HP・指導者・研究・ミニマップのダミー表示を置かない。G4の装飾仕上げは先取りしない。

## 8. ファイル責務と実装順

| 段階     | ファイル（予定）                                                                                    | 完了の境界                                   |
| -------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| T101     | simulation/types.ts、config.ts、match.ts、DECISIONS/SCOPE                                           | 状態・API・ルール固定、既存seed検査維持      |
| T102     | simulation/random.ts、map.ts、map.test.ts、match.test.ts                                            | seed再現・接続・初期配置・独立性             |
| T103     | simulation/pathfinding.ts、commands.ts、step.tsと各test                                             | 不正／他陣営拒否、移動・停止・再指示、replay |
| T104     | render/board.ts、camera.ts、objects.ts                                                              | state読取りだけの描画・pick・resize・dispose |
| T105     | runtime/controller.ts、clock.ts、diagnostics.ts、ui/input.ts、hud.ts、styles.css、main.ts、関連test | 一つのループ、UI・入力・ライフサイクル統合   |
| 検査準備 | docs/project/inspection/G1_SCENARIOS.md、README、CI workflow、scripts/build-info.mjs                | 起動・検査手順、commit付きビルド、実測証跡   |

mainは生成・接続・disposeに限定し、ルールやジェスチャー状態機械を詰め込まない。runtime→simulation、render/ui→simulation、main→全adapter。runtimeとrender/ui間はmainのcallbackで接続し、循環importしない。

単独lunaへ段階順に委任するのを基本とする。T103/T104は契約確定後だけ並列化可能だが、今回は段階ごとに親が差分とテストを確認して次を指示する。内部段階でユーザー承認は求めない。

CIへのビルド保存は実装時に追加: build前にcommit情報を生成しdist/build-info.jsonへ同梱、検査成功後にdistをartifactとして保存する。artifact名にはOSと完全SHAを含め、保持期間14日、公開デプロイなし。Actionsはその時点の公式対応版を確認して固定する。ローカルのdirty状態はbuild情報へ明示し、検査対象には使わない。

## 9. 技術検証とユーザー検査

ルールテスト（Vitest、Node）:

- seed 0/42/43/uint32最大の再現、異なる試合でmap/unit/path/factionsが共有されない、JSON round trip。
- 初期配置が平地、孤立セル以外の全平地への到達、固定障害物と到達不能fixtureの維持。
- BFSの近傍順による経路固定、障害物迂回、同一セル、四辺境界、blockedとunreachableの区別。
- command構造、actor、phase、存在／所有の拒否。拒否前後でstateと既存pathが不変。B/Cも自軍moveは同じAPIで成功し、Aが敵を動かせない。
- 1tickで半セル、2tickで隣接中心、到着停止、移動途中の再指示／stop、pausedで進行しない。
- seedとtick/seq付き命令列を再適用し、finalTickまで進めて最終state一致。最後の命令後にも移動が続くケースを含む。成功と拒否の履歴も比較する。
- 注入timestampでclockを検査: 60fps/30fps相当の通常進行一致、500ms上限、pause/hidden復帰のdelta=0、reset後の残時間ゼロ。
- 入力状態機械の6px境界、pan後pointerup、2指→1指、cancel、HUD起点にmoveが出ない。ブラウザ操作検証と両方行う。

実装後にG1_SCENARIOS.mdへ次の手順を検査票化する（まだ実行済みとは書かない）:

| ID     | seed42での手順                                   | 期待結果                                                                 |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------ |
| G1-01  | 開始、A-01を選択、セル(20,20)を指示              | 表示された経路を進み中心に停止。A-02/B/Cは動かない                       |
| G1-02a | Aを選択後B/Cをtap、次に地面tap                   | 敵操作不可、自軍選択解除、敵も自軍も移動しない                           |
| G1-02b | Aを選択し(29,9)と(30,10)へ指示                   | 障害物／経路なしを区別して説明。旧経路は維持                             |
| G1-02c | 単体テストから敵ID／盤外／不正座標を送信         | UI依存なしで拒否、state不変                                              |
| G1-03  | 自軍選択中に6px超ドラッグ、wheel、2指、HUDボタン | カメラ／HUDだけ反応しmove履歴が増えない                                  |
| G1-04  | 移動中にpause、再開、別タブへ10秒、戻る          | pause中不動、復帰時停止、再開後時間ジャンプなし                          |
| G1-04b | 移動途中で部隊停止、リセットを10回、再開始       | 次セル中心で停止。reset後tick0/ready、初期配置、選択なし、ループ重複なし |
| G1-05  | 900×420と1440×900、resize中に選択・移動・カメラ  | HUD重なり／横スクロールなし、pick座標がずれない                          |

PCと900×420の実ブラウザで操作し、screenshotsと入力方式・ブラウザversion・WebGL可否を記録。タッチエミュレーションと実機検証を区別する。context loss/復帰も可能な範囲で検証し、未検証は明記する。

`npm run check`、`npm run references:check`、`git diff --check`、Windows/Linux CIを親が確認する。機能実装前の本設計の確認は文書リンク・整形・既存基盤チェックまでで、G1の合格検査とは別。

## 10. 親の統合と検査への引渡し

1. 各段階の契約遵守と差分を確認。統合で変更したら該当テストと影響範囲を再検査。
2. G1全体を一つの実装PRへまとめる。親がIssueのT101〜T105を技術検証の実績で更新する。
3. G1-r01の検査票をHANDOFFテンプレートから作成。完全SHA、PR、実際に確認した起動URL/コマンド、seed、操作順、期待結果、CI/artifact、既知の制約を記録。
4. 検査対象commitの作業ツリーを固定してuser-reviewへ渡す。無回答やCI成功でacceptedへ進めない。
5. ユーザーの明示合格後だけマージ。G2は合格・マージと実装依頼の範囲を確認して開始する。

設計上の主要なリスクは入力とカメラの競合、半セル移動中の再指示、非表示復帰時のcatch-up。対応を上記契約と検査に固定し、lunaが独自に省略しない。
