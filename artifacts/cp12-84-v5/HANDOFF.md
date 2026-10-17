# #84 引き継ぎ: 100×100地形と開始地点別公平性

## 依頼と制約

再開時は `AGENTS.md` と `docs/project/WORKFLOW.md`、Issue #84の最新本文・全commentsを確認し、現行 `docs/project/specs/` は関係する節だけ読む。このHANDOFF.mdはユーザーが今回明示依頼した例外として作成した。通常の引継ぎ文書禁止を一般に解除するものではない。

Issue [#84](https://github.com/heishi1HUMANITY/rts-match-prototype/issues/84) の目的は、固定地形に非対称な進路、守備と迂回の選択、異なる拡張先を作り、実simulationで公平性を評価すること。各開始地点の拡張先を2つ以上、経路・資源・研究・戦力の実ルールで示す。港・船・渡河・増援・撤退・前線転用・第三陣営介入も経路として確認する。

ユーザー入力は、100×100でも単調さが残り、非対称な進路と守備/迂回、異なる拡張先が必要というもの。人間勝率やゲームプレイ合格を自動対戦から推定しない。NPCは通常の視界と同じcommand検証・ルールを使う。CP12全PRのCI成功・マージ後にまとめプレイを依頼し、マージはユーザーに任せる。Issue #84の個別プレイを先に求めない。距離一致だけで公平性を代用しない。

## 作業場所・Git状態

作業rootはこのcloneのrepository root (`.`)。branch `codex/cp12-84` に#84 WIPを転送用commitとして保存し、originへ通常push済み。commit SHAはこの文書自身を含むため記載せず、`git rev-parse HEAD` で確認する。旧PC参考: 作業worktree `C:\Users\iwann\.codex\worktrees\issue-80-map-data\rts-match-prototype`、主checkout `D:\git\rts-match-prototype` (ユーザーdirty変更/scratchあり、編集禁止)。別PCではこの絶対pathを使わない。PowerShellの各コマンドはclone rootへの `Set-Location` から始める。

転送用WIP commitに含まれる#84ファイル:

- `docs/project/DECISIONS.md`
- `docs/project/specs/WORLD.md`
- `docs/project/specs/registry.json`
- `package-lock.json`
- `package.json`
- `src/simulation/map-100.test.ts`
- `src/simulation/map-definitions.ts`
- `src/simulation/map-snapshot.ts`
- WIP commitにはcanonical `scripts/audit-map-fairness.ts`、`tsx` devDependency (`package.json` / lock)、`audit:map-fairness` / `audit:map-fairness:final` scriptsを含む。標準監査の上限は12,000 ticks。

これらの変更は転送保全用のWIP commitであり、#84合格/PR済みを意味しない。`artifacts/cp12-84-v5/` は旧PCではlocal excludeだったが、今回の転送commitでは明示的にtrackingする。このbranchは #105 (`codex/cp12-83`) の状態を土台にしている。現PR stackは #103 (#81, base main) → #104 (#82, base #103) → #105 (#83, base #104)。#106は#102のPRでbase #105、タイトル「[渡河UI] 渡河予定地の両端表示と操作条件を明示」。#103〜#106はすべてOPEN/未merge。#106はCI成功済み。作業再開時に最新のIssue本文/comments、PR base/head/status/checks、Git差分を確認し直す。#84には#102のUI差分を混ぜない。

## WIP commitに保存する地形候補 v5 (未検証)

`ring-three-fronts` 100×100 map definitionをversion 1から5へ変更している。`src/simulation/map-definitions.ts` の差分が正確な定義:

- 大型OUT-02を(50,50)から(58,41)へ移動。
- Mountain terrain patches: (28,55),(29,55); 2×2 at x65–66/y69–70; 2×2 at x57–58/y24–25。
- `CROSS-FLANK-SOUTH-B2`: bridge-2、bankA(31,60)、bankB(40,60)、crossing cells x32–39/y60。
- `src/simulation/map-snapshot.ts` patch cellsを地形へ適用し、通行障害も設定する。

`src/simulation/map-100.test.ts`にはterrain patch/地形snapshot等の検査を追加。距離・局所地形・経路はWORLD.mdに記録したが、勝率や実際の占領・建設時間・戦場競合が公平性条件を満たす証明ではない。主な実装定義は `src/simulation/map-definitions.ts` 参照。

## 現在の採否と公平性結果

v5は採用不可。調整seed 0–17の実NPC simulation勝利はSW 13/18 (72.2%)、SE 5/18 (27.8%)、North 0/18で開始地点20–50%帯を外れた。全18試合でNorthはticket脱落、脱落前HQは1200 HP。これはHQ侵攻による敗北の証拠ではない。120 centiは1.20 ticket。

固定調整set別の既知結果:

- 旧v3 holdout seed100–117: SW16, SE2, North0。すでに見たsetなので独立holdoutとして再利用禁止。
- v4 tuning seed0–17: SW9, SE2, North7。NG。
- v5 tuning seed0–17: SW13, SE5, North0。NG。
- v5 intended holdout 200–217: 未実行。候補がtuningで合格するまで開始しない。

`docs/project/DECISIONS.md` のD077にもv5のNG/未採用を記録済み。Formal v5 summary (`summary.json`) はOUT-02 owner transitionsをbaseId==='OUT-02'かつNorth faction IDで数え、Northの初取得12/18、喪失12回、再取得1回 (seed9) とassertする。North routeは18/18 crossing。脱落時の自軍保有weightは2が2試合、3が15試合、5が1試合。18試合累計ticket-loss componentはcombat 248,538 centi、territory 83,325 centi、time decay 208,137 centi。これらはNorthの18試合合計。unit-death時系列の原因判定には使えない。

## 診断と訂正事項

bounded audit seeds0–2では3例すべてNorthがcrossing routeを選び、OUT-01進路でcombat損耗を記録した。一方OUT-02 ownership loss時のnearby defenders/visible enemiesはseedごとに異なる。seed0/1では喪失後、OUT-02付近で敵antiAirが視認されNorthの部隊が死亡。seed2では喪失時にnearby North units/visible enemiesなし。これだけで中立化原因や一般的なAI/地形欠陥を特定しない。seed0と同seed研究priority ablation (`--north-field-plan`) は1試合のみで、NorthのOUT-02 loss tickは変わらず、ticket eliminationを4610から4820へ210 tick遅らせただけ。n=1、研究順が原因とは結論しない。

訂正済み注意:

- 以前の監査でelimination cleanup後のHQ 0 HPをHQ攻撃と読み違えた。正式記録では脱落前のHQ HPを使用する。
- 以前にNorthがOUT-02を18/18で取った/再取得0と誤集計した。owner遷移assertで初取得12、喪失12、再取得1と確定。
- Northの脱落weightは3が16と誤記したことがある。正しく2:2、3:15、5:1。seed9はHQ-C+OUT-02+MID-03でweight5。
- `scripts/audit-map-fairness.ts` のcombat ticket componentはtick毎のunitsの消失を含むが、ownership変更とunit killの因果は自動確定しない。ゲームログの可視敵・部隊命令を照らし合わせる。

## artifactと再現手順

artifact directory (今回のWIP commitでGit tracking済み): `artifacts/cp12-84-v5/`
旧PC参考: `C:\Users\iwann\.codex\worktrees\issue-80-map-data\rts-match-prototype\artifacts\cp12-84-v5\`

主要ファイル:

- `cp12-map-fairness-tuning-v5-audit3.jsonl`: v5 tuning 0–17の18試合、ticket内訳/ownership/outcomes。
- `summary.json`, `summarize-v5.mjs`: owner遷移・elimination reason・weight分布の集計。再実行してassertを通す。
- `seed0-event-diagnostics.jsonl/.log`, `seeds1-2-event-diagnostics.jsonl/.log`: bounded seed 0–2のcombat events、位置、order、North視点visible enemies、OUT-02 owner before/after。
- `summarize-seeds1-2.mjs`: seed1–2の短い出力整形用。
- `cp12-map-fairness-tuning-v5-selected.jsonl` と `...selected-north-field-plan.jsonl`, 対応stdout log: 旧seed0 ablation/調査結果。
- `audit-map-fairness.ts`: 旧PCのsource snapshot copy。正本はrepository rootの `scripts/audit-map-fairness.ts`。

新しいseedを回す例 (固有output pathを毎回選ぶ。`--output`指定のない非resume実行は標準temp checkpointを空にする):

```powershell
Set-Location $taskRepoPath; npx tsx scripts/audit-map-fairness.ts --seeds=1,2 --diagnose-north --output=artifacts/cp12-84-v5/new-diagnostic-unique.jsonl
```

`--resume`は同一source/map/rules/seed集合のcheckpointに限る。sourceに互換性assertはないので、ファイル名だけで一致と判断しない。tuningは固定0–17を完走し、draw/tied/unresolved-at-12000は勝ちに数えず個別記録する。全18試合で各物理開始地点は各gameに1回参加し、A陣営割当は各開始6回。各開始の勝率分母は18、採点帯20–50%。holdout 200–217はtuning候補が合格してからのみ実行。

現在のbranchで `npm run check` は405 unit pass/1 skip、flow 10 pass、build成功。`npm run references:check` は471 inherited files、`npm run specs:check` は6 tests成功。これらは公平性合格やユーザープレイ合格を意味しない。seed0–2追加runは診断データのみで、ゲームコード変更なし。

## 次の作業

1. 既存artifact・全owner transition・実combat event/命令・同視界の敵情報を使い、OUT-01反復損耗とOUT-02喪失をseed別に切り分ける。原因が特定できなければ未確定のままにする。
2. #84受入要件に照らした候補を設計し、守備/迂回、開始地点ごとの異なる拡張先、建設/研究/船・増援の実行可能性を確認する。地形距離一致のみでは完了にしない。
3. 候補を調整seed0–17で評価。20–50%を外れたらNGを記録し、未観測200–217を使わない。
4. 合格時だけ固定holdoutを実行し、同seed再現・終了理由・道筋・master/map定義版を保存して仕様・DECISIONS・テストを更新。
5. Issue #84の実自動検証/PR/CIを整えてから、ユーザーが指定したCP12まとめプレイを待つ。結果の捏造・人間勝率推定・未検証の合格記録は禁止。
