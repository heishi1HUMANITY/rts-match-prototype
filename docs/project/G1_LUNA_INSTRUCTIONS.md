# lunaへのG1実装指示

2026-10-11。設計と指示を準備した状態。**この文書の作成によってlunaへ実装を発注したことにはならない。**

対象: [G1 Issue #2](https://github.com/heishi1HUMANITY/rts-match-prototype/issues/2)。実装の正は [G1_IMPLEMENTATION_DESIGN.md](G1_IMPLEMENTATION_DESIGN.md)。

## 親エージェントの開始手順

実装を依頼されたら、以下の順に進める。内部段階の完了確認は親が行い、ユーザーへ毎回確認しない。

1. 本設計を含むcommitと最新main、作業ツリーを確認し、設計を含む基点から `gate/g1-map-movement` を作成する。既存branchがある場合は内容を確認して再利用する。未コミットのユーザー変更を上書きしない。
2. 親が基点の完全SHAとbranchを記録し、Issueをimplementingへ移す。lunaにGitHub書込みを委任しない。
3. `collaboration.spawn_agent` でモデル `gpt-6-luna`、推論強度 `high`、`fork_turns="none"` を指定する。モデル指定が不可能なら代替モデルを黙って使わず、制約を報告して親が扱う。
4. 下の共通指示と段階Aを一緒に送る。完了後は同じlunaへ段階B、C、Dの順にfollowupする。各段階の前に親が基点と最新差分を確認する。
5. 共有作業ツリーで同じファイルを並行編集しない。親は調査とレビューを行い、修正が必要ならlunaへ戻すか、編集終了を待って統合する。

一度にG1全体を渡すより、状態契約→移動→描画→統合の順に分け、局所的な検証結果を次の段階へ引き継ぐ。
今回の設計には未記入のAPIやゲーム数値はない。実装時に必要なパッケージversionと実測値だけをその時点で確定する。

## 共通指示（各段階に適用）

> あなたはG1の実装担当lunaです。作業場所は `D:/git/rts-match-prototype`。親がチェックアウトした `gate/g1-map-movement` 上で作業し、branchの切替、commit、push、PR/Issue編集、merge、deployは親へ任せてください。基点は作業開始時の `git rev-parse HEAD` を読んで報告してください。旧 `D:/git/rts` へ実装しないでください。
>
> 最初にAGENTS.md、README.md、docs/project/SCOPE.md、ARCHITECTURE.md、DECISIONS.md、WORKFLOW.md、TASKS.mdのG1、G1_IMPLEMENTATION_DESIGN.md、本指示を読んでください。GitHub Issue #2の本文は親が確認済みで、TASKSのT101〜T105と同じ範囲です。追加変更があれば親が伝えます。
>
> 利用者が開始→自軍選択→地面指定→障害物を避けた移動→停止/再開→リセットを検査できる状態を作ります。今の段階の編集範囲だけを変更してください。範囲外ファイル・公開契約・ルール値の変更が必要なら、理由と影響を親へ報告してください。内部ヘルパー、見た目の微調整、型安全な分割は判断して進めてかまいません。
>
> simulationは純粋でJSON化可能、乱数seedと固定tickに従います。DOM/Three.js/時刻APIへ依存させません。UIの操作拒否だけで済ませず共通commandで所有・phase・座標・経路を検証してください。readonly入力stateを変更しないでください。
>
> 戦闘・生産・研究・霧・NPC判断・勝敗・世界観・永続保存・オンラインは対象外です。旧実装とmockの疑似処理をコピーしません。docs/project以外のdocsとartworkは編集しません。公開素材の採用、外部API、物理エンジン、CDNは不要です。
>
> 検証は実行したものだけ報告してください。失敗や未検証を隠さず、変更ファイル、仕様判断、テスト結果、既知の制約を簡潔にまとめて親へ戻してください。ユーザー合格は代行しません。

## 段階A: T101/T102 — 状態と盤面

> 編集可能: `src/simulation/types.ts`、`config.ts`、`random.ts`、`map.ts`、`match.ts`、`map.test.ts`、`match.test.ts`、`docs/project/DECISIONS.md`、`SCOPE.md`、`ARCHITECTURE.md`。
>
> G1設計2〜4章の状態契約、schemaVersion=2、uint32 seed、40×40地形、固定3陣営×2部隊を実装してください。LCGとflood fillを仕様どおり実装し、孤立セル(30,10)以外の平地への到達を保証してください。既存のFaction exportとcreateMatch(seed)を維持し、schema変更の既存testを更新します。phaseはready、path空、progress0で初期化します。
>
> DECISIONSへ暫定ルールをD015以降の重複しない番号で記録し、SCOPEとARCHITECTUREから設計へリンクしてください。完了扱いの記述は追加しません。
>
> 完了条件: seed境界と不正seed、全seed検査fixture、初期配置、接続、同一seedの再現、状態独立性、JSON round tripが通ること。少なくとも0/42/43/uint32最大を検査。map/unit/path/factionsが試合間で共有されないことを確認します。
>
> 実行: `npm test -- src/simulation/match.test.ts src/simulation/map.test.ts`、`npm run typecheck`。親へ公開型の場所・テスト結果・変更ファイルを返したら、この段階で止めてください。

親の確認: mapの固定fixture、乱数呼出し順、配置通行性、readonlyとコピー、v1非対応の記録を読む。次の段階に公開型の実ファイルを伝える。

## 段階B: T103 — 共通命令と移動

> 前提: 段階Aの型と生成が親の確認を通過しています。G1設計4〜5章に従います。
>
> 編集可能: `src/simulation/pathfinding.ts`、`commands.ts`、`step.ts`、そのtestファイル、`match.ts`の必要なre-export。公開型の変更は親へ戻してください。
>
> BFSの近傍順、unknownからのcommand検証、所有検証、phase制約、2tick/セル移動、移動途中の再指示・stopを実装してください。progress=1の辺は完了させてから新経路へ移り、拒否時は旧経路を維持します。ライフサイクル命令はAだけ、move/stopはB/Cも同じルールで自軍を操作できます。G1のNPC思考は作りません。
>
> 完了条件: 不正構造/actor/phase/存在/所有/境界/障害物/到達不能の拒否、state不変、同一地点no-op、経路固定、途中のstopと再指示、pause中不動、tick/seq付き命令列をfinalTickまで再現するテストを通してください。unknown入力は型アサーションだけで通さず、欠損や非有限座標を実行時に拒否します。
>
> 実行: `npm test -- src/simulation`、`npm run typecheck`。親へAPI・検証順序・移動の端点処理・テスト結果を報告し、次段階の指示を待ってください。

親の確認: 半セル時の新経路の起点、途中停止、拒否時の不変性、replayの命令適用tickを重点確認する。

## 段階C: T104 — Three.js描画

> 前提: 段階A/Bのstate/APIを利用します。G1設計6章とS05/S05cの面・色＋記号を参照してください。
>
> 編集可能: `src/render/**`、`package.json`、`package-lock.json`。この段階ではmain/ui/runtimeへ編集を広げず、BoardViewを実装してください。依存はthreeと必要な型だけを追加し、公式情報から互換性・具体versionを確認して固定してください。
>
> 斜め見下ろしorthographic camera、地面・障害物・6部隊、陣営記号、選択・経路・目的地、検査地点の表示、pick、pan、zoom、resize、dispose、WebGL失敗とcontext loss通知を実装します。simulationを改変しません。カメラ回転、GLB素材、影、後処理は不要です。
>
> 完了条件: G1設計のBoardView契約が型検査を通り、cameraとrenderer資源の所有・解放が明確なこと。pickはcanvas rectで正規化し盤外を有効化しないこと。DOMイベントやrequestAnimationFrameの恒久ループは段階Dのruntimeが所有します。
>
> 実行: `npm run typecheck`、`npm run build`。ブラウザ操作の実証は統合後に行うため、この段階では検証未了と明記してください。依存version・API・dispose範囲を親へ報告してください。

親の確認: BoardViewの入力型にThree.jsが漏れない、pick優先順、補間と命令直後の同期方法、カメラ範囲、解放漏れを確認する。

## 段階D: T105 — ループ・入力・HUD・検査準備

> 前提: 段階A〜Cを親が確認済み。G1設計5〜10章を実装してください。
>
> 編集可能: `src/runtime/**`、`src/ui/**`、`src/main.ts`、必要な入力/時計test、`README.md`、`docs/project/inspection/G1_SCENARIOS.md`、`scripts/build-info.mjs`、`.github/workflows/ci.yml`、build情報を組み込む必要最小限のpackage scripts/config。既存simulation/renderの修正は親へ理由を報告してから調整します。
>
> 1つのRAFとstate owner、100ms accumulator、5tick上限、明示再開待ちの非表示処理、reset、finalTick付き履歴JSONダウンロードを接続してください。HUDのseed検証・開始・pause/resume・部隊停止・選択解除・カメラ復帰を実装します。mouse/touchの6px判定、2指gesture、pointercancel、HUD起点の分離を省略しません。HUDのpointerdownはcancelGesture通知だけを盤面入力へ渡し、2本目の指から意図しないmoveを発生させないでください。
>
> build情報は完全commit SHA、dirty状態とルールversionを含め、distへ同梱します。CIは両OSの検査成功後にdistを完全SHA入り名のartifactとして14日保存します。新しいActionを使うなら公式対応版を確認・固定し、公開デプロイは追加しません。
>
> G1_SCENARIOSへ設計9章の手順を記載し、READMEへ実装済みの起動・seed適用・検査操作だけを説明してください。未検証の操作を成功と書かないでください。G1の技術検証とユーザー合格は別にします。
>
> 完了条件: clock/入力状態機械のテスト、`npm run check`、`npm run references:check`、`git diff --check`。実ブラウザを使用できれば900×420と1440×900で設計9章を操作し証跡を残します。操作できない環境なら明記し、親が検証を引き取ります。CI・GitHub操作・最終commitは親が行います。
>
> 最終報告: 変更ファイル、実行コマンドと結果、実ブラウザの条件と証跡、未検証項目、既知の制約、設計からの差分。報告後はユーザー検査やG2を開始せず、親へ返してください。

## 親の最終チェック

- 設計の契約と差分を照合し、必要な独立レビューと修正を行う。
- 全体のnpm check/references:check、Windows/Linux CI、実ブラウザ確認を完了する。lunaの報告だけで確認済みとしない。
- 実装PR、Issueのチェックとflow更新、G1-r01の検査票、固定commitの作業ツリーを親が用意する。
- ユーザーの明示合格までmergeしない。指摘はR番号で同じG1に追跡する。G2へ進まない。
