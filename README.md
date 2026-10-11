# RTS Match Prototype

ブラウザの対戦本編を新規に作るプロジェクト。目標は **プレイヤー1人＋NPC2人の 1v1v1** を、世界観の知識なしで開始・操作・終了・再戦できること。

現在は **開発基盤のみ**。起動確認ページと初期状態の契約テストがあり、盤面・対戦・NPCの意思決定は未実装です。

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

GitHub CI は Windows / Linux の両方で同じ検査を実行します。公開・デプロイの自動処理はありません。

## 最初に読む文書

- [実装・検査の進め方](docs/project/WORKFLOW.md): エージェントへの開始指示、あなたの検査・修正指示
- [実装タスク一覧](docs/project/TASKS.md): 4つの検査区切りと18の内部タスク
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
| src/ai         | NPCの意思決定（未実装）              |
| src/render     | Three.js 盤面アダプター（未実装）    |
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
