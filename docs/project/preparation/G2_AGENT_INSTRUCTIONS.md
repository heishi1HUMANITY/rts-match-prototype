# G2の段階別エージェント指示案

本書は先行準備。**G1合格・マージ前に実コードへ着手する指示ではない。** 公開契約と値は [G2_DESIGN.md](G2_DESIGN.md)、受入条件は [G2_TEST_MATRIX.md](G2_TEST_MATRIX.md)。親が開始条件を満たしたことを確認してから、以下を担当へ渡す。

## 親の開始手順

1. Issue #2のユーザー合格と対応commitのmainへのマージを確認する。G1検査ツリーを変更しない。
2. 合格版と観測G1 commit `2a1843e751a39e61480a472d283d47c183b6b310`を比較。本設計のschema、配置、移動、入力、view改修点を再確認する。
3. 最新mainからG2実装のbranch/worktreeを作り、Issue #3をimplementingへ移す。先行設計PRのマージだけで移さない。
4. 暫定ルールをDECISIONS/SCOPEへ記録する。旧資料の値・変更理由・対象外を残す。
5. 実装担当はLunaを基本候補とし、範囲が大きい段階を分割する。型・tick orchestrator・共通command・HUDの同一ファイルを複数担当に同時編集させない。

## 共通プロンプト

> G2の実装担当です。親が渡した作業ツリーと基点SHAで作業してください。D:/git/rts（旧実装）やG1の検査用ツリーを変更しないでください。branch切替・commit・push・PR/Issue・merge・deployは親の担当です。
>
> 最初にAGENTS.md、README.md、docs/projectのSCOPE/ARCHITECTURE/DECISIONS/WORKFLOW/TASKS、preparation/G2_DESIGN.md、G2_TEST_MATRIX.mdを読んでください。親が明示した今の段階と編集可能ファイルだけを扱います。
>
> G2ではAIなしで制圧・収入・生産・交戦・研究・チケット変化を操作検査できる状態を作ります。DOM/Three.js/時刻をsimulationに入れません。readonly入力を変更せず、seed・整数tick・同時処理・JSON stateを維持します。失敗命令は元state参照を返し、コストや予約を変更しません。
>
> render/HUD/将来AIへ通常のMatchStateを渡さず、列挙したfieldだけのFactionViewを渡します。霧でmeshを隠すだけでは不十分で、DOMラベル・pick・経路・補間・通知・拒否理由からも隠れた敵の情報を出さないでください。
>
> G3のAI・勝敗・脱落・再建、文明、永続研究、河川、補給線、6兵種、全研究枝、原本docs/artworkの編集は対象外です。仕様変更が必要なら親へ理由と影響を返します。
>
> 実行した検証だけを報告し、変更ファイル・公開API・確認結果・未検証範囲を返してください。段階完了後は止まり、親の統合確認を受けます。ユーザー合格を代行しません。

## A: 状態契約・配置・視界（T201）

> 編集範囲: simulation/types.ts/config.ts/match.ts、追加visibility.ts/view.ts、関連テスト。追加命令の型だけは親と先に合わせる。既存のmap/pathfinding/移動ルールを黙って変更しない。
>
> schema3と資源/HP/拠点/キュー/研究/knowledgeの状態、通常配置、列挙scenario初期化、2倍整数位置、全陣営の視界・探索・拠点記憶、getFactionViewを作る。敵DTOを元stateのspread/Omitで作らない。自軍以外のjob存在/研究/経路/資源を出さない。
>
> 完了条件: 行列V01〜V07/P01/P02が通る。全陣営tick0で視界を持ち、JSON round trip/resetで状態が独立する。親へFactionViewの実型を返す。

## B: 経済・生産・研究（T202/T204の一部）

> 編集範囲: simulation/economy.ts/production.ts/research.ts、commands.ts、関連テスト。types.ts/config.tsの公開型変更は親が確認する。step.tsはまだ統合担当だけが編集する。
>
> 整数資源、予約時支払い、枠の確保、直列生産、取消全額返金、単調増加ID、首都破壊時キュー取消、2段研究と完了効果を実装する。pure helperは明示した入力stateだけを読み、UIへ通知しない。
>
> 完了条件: E01〜E08/R01〜R05。連続注文は受理件数分だけ支払い、同じ取消で二度返金しない。資源・枠・待ち/実行中・首都状態の境界をテスト。親へtick統合用helperと前提を返す。

## C: 交戦・制圧・チケット・tick統合（T203/T204）

> 編集範囲: simulation/combat.ts/capture.ts/tickets.ts/step.ts、必要な命令の観測拒否、関連テスト。A/B後に開始する。同じsnapshotから対象選択・ダメージ一括・破壊/損失一度だけ・制圧・収入・生産・最終視界を設計8章順で接続する。
>
> 完了条件: C01〜C07/T01〜T04/I01〜I04。部隊・拠点配列を並べ替えてもIDで比較した結果が一致し、相互致死や3陣営競合で走査順の優位がない。同tick首都破壊と生産完了で部隊が出ない。研究完了tickの攻撃効果を確認する。

## D: FactionViewへの描画・runtime移行

> 編集範囲: render/board.ts、runtime/controller.ts/diagnostics.ts/build-info型、対応テスト。親がmain/HUDと競合しない順に接続する。runtime内部と明示された全情報診断だけがMatchStateへ触れる。
>
> board.sync等をFactionView契約へ変更し、霧・基地・HP/制圧表示を追加。現viewにない敵はDOM/mesh/pick/補間から即除去。新規発見位置を隠れた過去位置から補間しない。schema/rules/scenarioを含む履歴リプレイを追加。全state診断を通常viewの取得経路から分ける。
>
> 完了条件: 漏洩テストV05/V06、同seed/scenario/command列のリプレイ、pause/reset/visibility/context lossの既存挙動が維持される。型検査とproduction build成功。
>
> runtimeは `previewMove(unitId,target)` の純粋照会を公開し、自軍の仮経路・可否・公開可能な拒否理由だけを返す。mainへ全stateを渡さず、照会で命令履歴・状態・資源を変更しない。tick/カメラ更新時の再評価を維持する。通常onChange/onFrameはFactionViewだけ、全state取得は明示診断とテスト用へ分離する。

## E: 生産・研究・拠点HUDと検査（T205）

> 編集範囲: ui/hud.ts/styles.css/input.ts/main.ts、UIテスト、docs/project/inspectionのG2検査票、README。mockは表示階層のみ参考。通常モードと検査scenarioを画面上で区別し、研究中も試合が進むことを示す。
>
> 生産開始/待ち/取消、資源/上限/前提/実行中の無効理由、自軍HP/敵可視HP/基地進捗、研究2段、収支とチケットを接続。HUDで1click=1commandとし、盤面への誤入力を防ぐ。900×420とPC、44px以上、色＋記号、panel開閉/keyboard Escapeを確認する。
>
> 完了条件: 手動行列U01〜U07が実行可能。検査fixtureの選択方法・通常との差・未検証実機を記録。npm run check/references:checkを実行し、親へユーザー検査可能な版を渡す。

## 親の最終確認

境界・情報漏洩・順序・replayを独立レビューし、Windows/Linux CIと実ブラウザーを確認する。実機タッチや非表示復帰をエミュレーションだけで検証済みとしない。Issueの内部チェックは実装＋技術検証の完了だけを表す。完全SHA・PR・実際に開いたURL・検査票を固定し、G2-user-reviewへ渡す。明示合格までmerge/G3実装をしない。
