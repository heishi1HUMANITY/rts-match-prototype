# RTS Match Prototype

ブラウザの対戦本編を新規に作るプロジェクト。目標は **プレイヤー1人＋NPC2人の 1v1v1** を、世界観の知識なしで開始・操作・終了・再戦できること。

現在は **G1: 盤面と移動の検査版**。seed付き40×40盤面、3陣営各2部隊、自軍の選択・移動・停止、カメラ、停止/再開、リセットを実装しています。NPCの判断、戦闘、生産、研究、勝敗は未実装です。G1のユーザー合格はまだ受けていません。

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

「開始」後に橙色の◆A部隊を移動したい地面までドラッグし、離すと移動します。部隊からのドラッグは移動、地面からのドラッグはカメラ移動です。部隊/部隊カードを押して選び、地面を押す操作も補助として使えます。ホイールまたはピンチでズーム。「部隊停止」は次のセル中心で止まり、「一時停止」は試合全体を止めます。タブを隠すと自動停止し、戻ったら「再開」が必要です。

現在のグリッドと簡易部隊記号は動作確認用の仮表示です。完成版の部隊モデル・地形表現・最終UIではありません。

「リセット」は現在のseedで初期化します。seedを変更する場合は「検査設定」を開き、整数を入力して「適用してリセット」を押します。初期seedは42。ラベル付きの孤立セル(30,10)で到達不能の拒否を試せます。「診断JSONを保存」はseed・命令履歴・最終tick・状態・ビルド情報を保存するローカル機能です。

具体的な操作順と未検証範囲は [G1検査シナリオ](docs/project/inspection/G1_SCENARIOS.md) を参照してください。

## 最初に読む文書

- [実装・検査の進め方](docs/project/WORKFLOW.md): エージェントへの開始指示、あなたの検査・修正指示
- [実装タスク一覧](docs/project/TASKS.md): 4つの検査区切りと18の内部タスク
- [G1の具体設計](docs/project/G1_IMPLEMENTATION_DESIGN.md) / [lunaへの実装指示](docs/project/G1_LUNA_INSTRUCTIONS.md): 盤面・移動・入力・検査の契約
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
| src/ai         | NPCの意思決定（未実装）              |
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
