# RTS Match Prototype

エージェントへの依頼は **「#30を進めて」** のようにIssue番号だけで開始できます。[共通の作業手順](docs/project/ISSUE_AGENT_RUNBOOK.md)、[各Issueの実装ガイド](docs/project/ISSUE_IMPLEMENTATION_GUIDE.md)、[前回の引き継ぎ](docs/project/AGENT_HANDOFF.md) を入口に、設計・実装・検証・PR作成と画面確認の準備まで進めます。動作確認後は「#30 OK、マージして」、修正は「#30の修正。困ったふるまい」を伝えてください。

ブラウザの対戦本編を新規に作るプロジェクト。目標は **プレイヤー1人＋NPC2人の 1v1v1** を、世界観の知識なしで開始・操作・終了・再戦できること。

G1・G2と、NPC/決着/再戦のG3はmainへマージ済みです。必要なゲームプレイ全体は [網羅表](docs/project/GAMEPLAY_COVERAGE.md) / [全体Issue #12](https://github.com/heishi1HUMANITY/rts-match-prototype/issues/12) で追跡します。建築・中立NPC・兵種/研究などを含み、最小試作だけで全体完成とはしません。複数部隊一括移動→対象追跡→マスタ管理の順に基盤を整えます。

通常設定はNPC2陣営と5分制で対戦し、結果から再戦できます。[G3の画面確認手順](docs/project/inspection/G3_SCENARIOS.md)を参照してください。

研究は選択中の対象へポイントを充填し、必要量で即完了します。未指定ならバンク、指定解除でも進捗は残り、再選択でバンクを充填して続けます。基本研究収入は拠点なしでも0.2/秒、所有拠点ごとに＋1/秒です。

## 起動

Node.js 24.x / npm 11〜12 を使用します。

```sh
npm ci
npm run dev
```

表示されたローカルURLを開きます。新規 clone に旧プロジェクトは不要です。

```sh
npm run check             # 整形、型検査、ルールテスト、ビルド
npm run references:check  # 引き継ぎ資料のスナップショット検査
npm run test:watch
npm run build
npm run preview
```

GitHub CI は Windows / Linux の両方で同じ検査を実行し、commit SHA付きのビルド成果物を保存します。`dist/build-info.json`にはcommit、未コミット変更の有無、ルール版、状態schema版が入ります。公開・デプロイの自動処理はありません。

## G1の操作

F01では「複数選択」ONで部隊をタップして追加・解除できます。「すべて選択」も使えます。選択済みの部隊をドラッグすると全部隊へ一括移動、「部隊停止」で一括停止します。[F01の画面確認手順](docs/project/inspection/F01_SCENARIOS.md)を参照してください。

「開始」後に橙色の◆A部隊を移動したい地面までドラッグし、離すと移動します。部隊からのドラッグは移動、地面からのドラッグはカメラ移動です。部隊/部隊カードを押して選び、地面を押す操作も補助として使えます。ホイールまたはピンチでズーム。「部隊停止」は次のセル中心で止まり、「一時停止」は試合全体を止めます。タブを隠すと自動停止し、戻ったら「再開」が必要です。

現在のグリッドと簡易部隊記号は動作確認用の仮表示です。完成版の部隊モデル・地形表現・最終UIではありません。

「リセット」は現在のseed/scenarioで初期化します。変更する場合は「検査設定」を開き、seedとシナリオを選び「適用してリセット」を押します。初期seedは42。ラベル付きの孤立セル(30,10)で到達不能の拒否を試せます。「全情報を含む診断JSONを保存」は敵情報も含むseed・scenario・命令履歴・最終tick・状態・ビルド情報を保存する開発用のローカル機能です。

具体的な操作順と未検証範囲は [G1検査シナリオ](docs/project/inspection/G1_SCENARIOS.md) を参照してください。

## 最初に読む文書

- [実装・検査の進め方](docs/project/WORKFLOW.md): エージェントへの開始指示、あなたの検査・修正指示
- [実装タスク一覧](docs/project/TASKS.md): 4つの検査区切りと18の内部タスク
- [G1の具体設計](docs/project/G1_IMPLEMENTATION_DESIGN.md) / [lunaへの実装指示](docs/project/G1_LUNA_INSTRUCTIONS.md): 盤面・移動・入力・検査の契約
- [G3設計](docs/project/preparation/G3_DESIGN.md): NPCの情報制約・脱落・順位・再戦の契約
- [G2の先行設計案](docs/project/preparation/G2_DESIGN.md): G1検査待ちに進める調査・設計。実装開始前に合格版との照合が必要
- [AGENTS.md](AGENTS.md): エージェントの作業方針
- [初期スコープ](docs/project/SCOPE.md): 今回作る範囲と未決定事項
- [構成・設計](docs/project/ARCHITECTURE.md): ゲーム処理と表示の境界
- [開発手順](CONTRIBUTING.md): タスク・検証・PR
- [開発順序](docs/project/ROADMAP.md): 最初のプレイ可能版までの完了条件
- [参照資料](docs/project/REFERENCES.md): docs / artwork の出所・UI mock
- [判断記録](docs/project/DECISIONS.md): 採用理由と暫定判断

## ディレクトリ

| 場所           | 役割                                 |
| -------------- | ------------------------------------ |
| src/simulation | ブラウザ非依存の状態・ゲームルール   |
| src/ai         | 陣営別viewからNPCの共通commandを生成 |
| src/render     | Three.js 盤面・カメラ・選択表示      |
| src/runtime    | 固定tick時計・履歴・診断             |
| src/ui         | DOMの画面・HUD                       |
| src/assets     | 配信用アセットの安定キー             |
| public/assets  | 採用済みの配信用素材のみ             |
| docs/project   | 新規プロジェクトの正となる仕様・判断 |
| docs のその他  | 引き継いだ資料・UI mock・旧進捗      |
| artwork        | 引き継いだ素材原本                   |
| .github        | CI、Issue、PRテンプレート            |

旧 packages / scripts / tools / node_modules と旧ルート文書は移植していません。
継承資料に登場する旧実装のパス・完了状況・起動手順は、この新規プロジェクトには適用しません。

資料・素材に対する公開ライセンスは設定していません。外部配布時に権利・再配布条件を確認します。
